# Desain Rilis v1.0.83 — Halaman Pengaturan Minimal

Status: **Keputusan sudah dikunci 2026-05-14 malam.** Eksekusi menunggu v1.0.82 stabil di lapangan.
Dibuat: 2026-05-14 malam.
Tujuan: blueprint detail untuk eksekusi v1.0.83 (sebelumnya disebut "Rilis 1.2.0").

Lihat `RENCANA-FITUR.md` untuk konteks rilis. Dokumen ini mengisi detail teknis
yang sengaja tidak ditaruh di sana (terlalu spesifik kode).

---

## 1. Scope

Rilis 1.2.0 hanya 2 tab:
- **Tab Usaha** — pindahan dari Profil (nama_usaha, alamat, telepon, catatan) + tambah logo
- **Tab Struk & Cetak** — header tambahan, footer struk, ukuran kertas default, tampilkan/tidak logo

Tab tambahan (Numbering, Pajak, Notifikasi) **dipisah ke rilis lain** kalau ada permintaan user.

---

## 2. Risiko & Mitigasi (Singkat)

| Aspek | Risiko | Mitigasi |
|---|---|---|
| Tabel `pengaturan` baru | 🟢 Tabel terpisah, tidak menyentuh data lama | `CREATE TABLE IF NOT EXISTS` |
| Field nama/alamat/telepon usaha | 🟢 Tetap di tabel `usaha`, hanya UI yang berpindah | Endpoint `PUT /api/usaha/mine` tetap dipakai |
| Logo upload | 🟡 File terpisah di `userData/logos/` | IPC `pengaturan:saveLogo` + cleanup ke folder dedicated |
| Backup format baru | 🟡 Naik versi `1.7` → `1.8`, include logo base64 | Parser restore harus backward-compatible (cek `version`) |
| Struk lama vs baru | 🟢 Header/footer lama hardcode, baru pakai setting; kalau setting kosong fallback ke nilai sekarang | `getSetting(key, defaultValue)` |

**Bottom line**: tidak ada `DROP COLUMN`, tidak ada `RENAME`, tidak ada perubahan `NOT NULL` tanpa default. Risiko data rusak nol.

---

## 3. Skema DB

### 3.1 Tabel baru `pengaturan`

```sql
CREATE TABLE IF NOT EXISTS pengaturan (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  usaha_id INTEGER NOT NULL REFERENCES usaha(id),
  key TEXT NOT NULL,
  value TEXT,
  updated_at INTEGER NOT NULL DEFAULT (CAST((julianday('now') - 2440587.5)*86400000 AS INTEGER))
);
CREATE UNIQUE INDEX IF NOT EXISTS pengaturan_usaha_key ON pengaturan (usaha_id, key);
```

Lokasi: `lib/db/src/index.ts`, di blok `sqlite.exec(...)` setelah blok yang sudah ada.

### 3.2 Schema Drizzle

File baru: `lib/db/src/schema/pengaturan.ts`

```ts
import { sqliteTable, integer, text } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";
import { usahaTable } from "./usaha";

export const pengaturanTable = sqliteTable("pengaturan", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  usahaId: integer("usaha_id").notNull().references(() => usahaTable.id),
  key: text("key").notNull(),
  value: text("value"),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(CAST((julianday('now') - 2440587.5)*86400000 AS INTEGER))`),
});
```

Tambah re-export di `lib/db/src/schema/index.ts`.

### 3.3 Tidak ada perubahan tabel existing

`usaha.nama_usaha`, `usaha.alamat`, `usaha.telepon`, `usaha.catatan` tetap.
Form di Tab Usaha kirim ke endpoint **lama** `PUT /api/usaha/mine`.
Tab Struk & Cetak kirim ke endpoint **baru** `PUT /api/pengaturan/batch`.

---

## 4. Daftar Key Pengaturan (Initial)

| key | type | default | dipakai di |
|---|---|---|---|
| `struk_header` | string | `""` (kosong) | tampil di atas alamat usaha di struk kasir & kwitansi |
| `struk_footer` | string | `"Terima kasih atas kunjungan Anda"` | tampil di bawah total di struk kasir |
| `struk_ukuran_kertas` | enum `"58mm"` \| `"80mm"` \| `"A4"` | `"80mm"` | CSS `@page` di template struk |
| `struk_tampilkan_logo` | bool (`"1"` / `"0"`) | `"1"` | toggle render logo di struk/kwitansi |
| `logo_filename` | string | null | nama file di `userData/logos/<usaha_id>/<filename>` |

Helper di server: `getSetting(usahaId, key, defaultValue)` — cek tabel, kalau row tidak ada → return default.

---

## 5. API Endpoint

File baru: `artifacts/api-server/src/routes/pengaturan.ts`

### 5.1 GET /api/pengaturan

Return semua setting untuk usaha aktif sebagai object key-value.

```ts
router.get("/pengaturan", requireAuth, async (req, res) => {
  const usahaId = req.session.usahaId;
  const rows = await db.select().from(pengaturanTable)
    .where(eq(pengaturanTable.usahaId, usahaId));
  const obj: Record<string, string | null> = {};
  for (const r of rows) obj[r.key] = r.value;
  // Inject default supaya frontend tidak perlu fallback
  res.json({
    struk_header: obj.struk_header ?? "",
    struk_footer: obj.struk_footer ?? "Terima kasih atas kunjungan Anda",
    struk_ukuran_kertas: obj.struk_ukuran_kertas ?? "80mm",
    struk_tampilkan_logo: obj.struk_tampilkan_logo ?? "1",
    logo_filename: obj.logo_filename ?? null,
  });
});
```

### 5.2 PUT /api/pengaturan/batch

Body: `{ key: value }[]`. Upsert per key.

```ts
const PengaturanBatchBody = z.object({
  items: z.array(z.object({
    key: z.string().min(1).max(64),
    value: z.string().nullable(),
  })),
});

router.put("/pengaturan/batch", requireAuth, requireLicense, async (req, res) => {
  const parsed = PengaturanBatchBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "..." }); return; }
  const usahaId = req.session.usahaId;
  for (const { key, value } of parsed.data.items) {
    const existing = await db.select().from(pengaturanTable)
      .where(and(eq(pengaturanTable.usahaId, usahaId), eq(pengaturanTable.key, key)));
    if (existing.length) {
      await db.update(pengaturanTable).set({ value, updatedAt: new Date() })
        .where(and(eq(pengaturanTable.usahaId, usahaId), eq(pengaturanTable.key, key)));
    } else {
      await db.insert(pengaturanTable).values({ usahaId, key, value });
    }
  }
  res.json({ success: true });
});
```

Whitelist key yang boleh disimpan untuk menghindari user nyimpan key acak (DoS):
```ts
const ALLOWED_KEYS = new Set(["struk_header", "struk_footer", "struk_ukuran_kertas", "struk_tampilkan_logo", "logo_filename"]);
```

### 5.3 POST /api/pengaturan/logo

Multipart form data — satu file PNG/JPG max 1 MB. Server validasi mime, simpan ke staging temp, balas filename.

**Alternatif lebih simple**: tidak pakai endpoint server, tapi langsung IPC ke main process yang tulis file ke `userData/logos/`. Server cuma simpan `logo_filename` di tabel `pengaturan` setelah file disimpan. Ini lebih konsisten dengan pola backup yang sudah ada.

→ Saran: **Pakai IPC**, bukan multipart server endpoint. Detail di section 6.

### 5.4 Mounting

`artifacts/api-server/src/app.ts`:
```ts
import pengaturanRouter from "./routes/pengaturan";
app.use("/api", pengaturanRouter);
```

---

## 6. IPC Logo Upload

### 6.1 Main process (`artifacts/electron-app/src/main.ts`)

Tambah handler:
```ts
ipcMain.handle("pengaturan:saveLogo", async (_event, payload: { usahaId: number; data: string; ext: string }): Promise<{ success: boolean; filename?: string; message?: string }> => {
  if (!mainWindow) return { success: false, message: "Window tidak tersedia" };

  const { usahaId, data, ext } = payload;

  // Validasi: hanya png/jpg
  if (!["png", "jpg", "jpeg"].includes(ext.toLowerCase())) {
    return { success: false, message: "Format harus PNG/JPG" };
  }

  // Validasi: max 1 MB (base64 ~33% lebih besar dari binary)
  if (data.length > 1.4 * 1024 * 1024) {
    return { success: false, message: "Logo maksimal 1 MB" };
  }

  // Validasi base64
  if (!/^[A-Za-z0-9+/=]+$/.test(data.slice(0, 1000))) {
    return { success: false, message: "Data logo tidak valid" };
  }

  const logosDir = path.join(app.getPath("userData"), "logos", String(usahaId));
  await fs.promises.mkdir(logosDir, { recursive: true });

  // Hapus logo lama (jika ada) supaya folder tidak menumpuk
  const oldFiles = await fs.promises.readdir(logosDir);
  for (const f of oldFiles) await fs.promises.unlink(path.join(logosDir, f)).catch(() => {});

  const filename = `logo-${Date.now()}.${ext}`;
  const filePath = path.join(logosDir, filename);
  const buffer = Buffer.from(data, "base64");
  await fs.promises.writeFile(filePath, buffer, { mode: 0o600 });

  return { success: true, filename };
});

ipcMain.handle("pengaturan:getLogoData", async (_event, usahaId: number, filename: string): Promise<string | null> => {
  if (!filename) return null;
  const filePath = path.join(app.getPath("userData"), "logos", String(usahaId), filename);
  try {
    const buf = await fs.promises.readFile(filePath);
    return buf.toString("base64");
  } catch {
    return null;
  }
});

ipcMain.handle("pengaturan:deleteLogo", async (_event, usahaId: number) => {
  const logosDir = path.join(app.getPath("userData"), "logos", String(usahaId));
  try {
    await fs.promises.rm(logosDir, { recursive: true, force: true });
    return { success: true };
  } catch (e) {
    return { success: false, message: String(e) };
  }
});
```

### 6.2 Preload (`preload.ts`)

```ts
pengaturan: {
  saveLogo: (payload: { usahaId: number; data: string; ext: string }) =>
    ipcRenderer.invoke("pengaturan:saveLogo", payload),
  getLogoData: (usahaId: number, filename: string) =>
    ipcRenderer.invoke("pengaturan:getLogoData", usahaId, filename),
  deleteLogo: (usahaId: number) =>
    ipcRenderer.invoke("pengaturan:deleteLogo", usahaId),
}
```

### 6.3 Renderer flow

```
User pilih file PNG/JPG
  → FileReader.readAsDataURL → base64
  → window.electronApp.pengaturan.saveLogo({ usahaId, data, ext })
  → terima filename
  → PUT /api/pengaturan/batch dengan items: [{ key: "logo_filename", value: filename }]
  → invalidate query "pengaturan"
```

Untuk **menampilkan logo** di struk:
```
Saat render struk:
  → const filename = pengaturan.logo_filename
  → if (!filename) → tidak render <img>
  → else → window.electronApp.pengaturan.getLogoData(usahaId, filename)
  → terima base64
  → <img src="data:image/png;base64,..." />
```

Browser non-electron: `window.electronApp` undefined → logo tidak tampil. Acceptable karena app target = Electron.

---

## 7. Halaman /pengaturan

File baru: `artifacts/hutang-app/src/pages/pengaturan.tsx`

### 7.1 Struktur

```tsx
<Tabs defaultValue="usaha">
  <TabsList>
    <TabsTrigger value="usaha">Data Usaha</TabsTrigger>
    <TabsTrigger value="struk">Struk & Cetak</TabsTrigger>
  </TabsList>

  <TabsContent value="usaha">
    <FormUsaha /> {/* Form yang reuse dari profil.tsx */}
    <UploadLogo />
  </TabsContent>

  <TabsContent value="struk">
    <FormStruk />
  </TabsContent>
</Tabs>
```

### 7.2 Tab Usaha

- Reuse logic form dari `profil.tsx` (`usahaSchema`, `useMutation` PUT `/api/usaha/mine`, dll)
- Tambah komponen `<LogoUpload />`:
  - Preview logo saat ini (kalau ada)
  - Tombol "Pilih File" → `<input type="file" accept="image/png,image/jpeg">`
  - Tombol "Hapus Logo"
  - Validasi ukuran ≤ 1 MB di renderer juga (defense in depth)

### 7.3 Tab Struk & Cetak

```tsx
<Form>
  <FormField name="struk_header" label="Teks Header Tambahan">
    <Textarea placeholder="Contoh: Toko XYZ — Buka 08:00-21:00" />
    <FormDescription>Tampil di atas alamat di struk kasir & kwitansi.</FormDescription>
  </FormField>

  <FormField name="struk_footer" label="Teks Footer">
    <Textarea placeholder="Terima kasih atas kunjungan Anda" />
    <FormDescription>Tampil di bawah total di struk.</FormDescription>
  </FormField>

  <FormField name="struk_ukuran_kertas" label="Ukuran Kertas Default">
    <Select>
      <SelectItem value="58mm">58mm (struk thermal kecil)</SelectItem>
      <SelectItem value="80mm">80mm (struk thermal standar)</SelectItem>
      <SelectItem value="A4">A4 (printer kantor)</SelectItem>
    </Select>
  </FormField>

  <FormField name="struk_tampilkan_logo" label="Tampilkan Logo di Struk">
    <Switch />
  </FormField>

  <Button type="submit">Simpan Pengaturan Struk</Button>
</Form>
```

### 7.4 Routing

`App.tsx` tambah:
```tsx
<Route path="/pengaturan">
  <ProtectedRoute allowedRoles={["owner"]}>
    <Layout><PengaturanPage /></Layout>
  </ProtectedRoute>
</Route>
```

### 7.5 Sidebar entry

`Layout.tsx`, grup SISTEM, tambah:
```ts
{ href: "/pengaturan", label: "Pengaturan", icon: Settings },
```

Atau jadikan grup SISTEM:
```
SISTEM → Pengaturan, Backup & Restore, Lisensi
```

### 7.6 Profil page

Form usaha di `profil.tsx` di-keep, tapi:
- Tambah notice di atas: "Pengaturan usaha lebih lengkap (struk, logo) ada di menu **Pengaturan**."
- Atau pindahkan total dan profil cuma berisi password & info user.

→ Saran: **keep di profil + notice link** supaya transisi gentle. Tab Usaha di pengaturan = pintu utama, profil = pintu cepat untuk edit nama saja.

---

## 8. Update Format Backup

### 8.1 Naik versi backup `1.7` → `1.8`

`artifacts/api-server/src/routes/backup.ts`:

```ts
const pengaturanList = await db.select().from(pengaturanTable)
  .where(eq(pengaturanTable.usahaId, usahaId));

const backup = {
  version: "1.8",
  exported_at: new Date().toISOString(),
  usaha_id: usahaId,
  usaha: { ... },
  // ... tabel existing
  pengaturan: pengaturanList.map(p => ({
    key: p.key,
    value: p.value,
    updated_at: p.updatedAt.toISOString(),
  })),
  logo_base64: <ambil via fs>, // null kalau tidak ada
  logo_ext: <png/jpg>,         // null kalau tidak ada
};
```

Logo dibaca dari file dan di-embed sebagai base64. Begitu di-restore di mesin lain, logo tetap ada.

### 8.2 Restore handler

```ts
// Cek versi
if (backup.version === "1.7") {
  // Backward compat: tidak ada pengaturan, tidak ada logo
} else if (backup.version === "1.8") {
  if (Array.isArray(backup.pengaturan)) {
    // Hapus pengaturan lama untuk usaha ini, insert dari backup
    await db.delete(pengaturanTable).where(eq(pengaturanTable.usahaId, usahaId));
    for (const p of backup.pengaturan) {
      await db.insert(pengaturanTable).values({
        usahaId, key: p.key, value: p.value,
      });
    }
  }
  if (backup.logo_base64 && backup.logo_ext) {
    // IPC equivalent? Tidak, ini server side. Server tidak bisa tulis ke userData.
    // Solusi: server return logo_base64 ke client, client panggil IPC saveLogo.
  }
}
```

⚠️ **Tantangan**: server tidak punya akses `userData/logos/`. Logo restore harus di-handle 2 step:
1. Server tulis row `pengaturan` (termasuk `logo_filename` lama).
2. Server kirim balik ke client `{ logo_base64, logo_ext, suggested_filename }`.
3. Client panggil `window.electronApp.pengaturan.saveLogo({ ... })` untuk tulis file ke `userData`.
4. Client update `logo_filename` lewat `PUT /api/pengaturan/batch` kalau filename hasil saveLogo berbeda.

Atau lebih simple: **logo disimpan di DB sebagai base64** di rilis 1.2.0, hanya file di rilis berikut. Trade-off: DB membengkak, tapi flow restore lebih simple.

→ Saran: **logo di file** seperti rancangan awal, restore handle 2-step di renderer page Backup. Sedikit lebih ribet tapi DB tetap ramping.

### 8.3 Smoke test wajib

- Backup di app v1.0.82 → restore di app v1.2.0 (skip tabel pengaturan, default kosong) ✅
- Backup di app v1.2.0 (tanpa logo) → restore di v1.2.0 ✅
- Backup di app v1.2.0 (dengan logo) → restore di mesin lain v1.2.0 (logo muncul) ✅
- Backup di app v1.2.0 → coba restore di v1.0.82 lama (harus tetap jalan, kolom pengaturan diabaikan)
  - Catatan: ini **tidak penting** karena auto-update one-way, tapi defensif tetap baik.

---

## 9. Integrasi ke Struk Kasir & Kwitansi

Halaman yang generate HTML print sekarang hardcode header. Setelah 1.2.0:

### 9.1 Frontend ambil pengaturan

Tambah hook bersama:
```ts
// artifacts/hutang-app/src/hooks/use-pengaturan.tsx
export function usePengaturan() {
  return useQuery({
    queryKey: ["pengaturan"],
    queryFn: async () => {
      const r = await fetch(`${BASE}/api/pengaturan`, { credentials: "include" });
      if (!r.ok) throw new Error("Gagal");
      return r.json();
    },
    staleTime: 5 * 60 * 1000,
  });
}
```

### 9.2 Helper render header struk

```ts
// artifacts/hutang-app/src/lib/struk.ts
export function renderHeaderHtml(usaha: Usaha, pengaturan: Pengaturan, logoBase64: string | null): string {
  const logoTag = pengaturan.struk_tampilkan_logo === "1" && logoBase64
    ? `<img src="data:image/png;base64,${logoBase64}" style="max-height:50px;display:block;margin:0 auto 6px"/>`
    : "";
  const headerExtra = pengaturan.struk_header
    ? `<div class="struk-header-extra">${escapeHtml(pengaturan.struk_header)}</div>`
    : "";
  return `${logoTag}<div class="struk-nama-usaha">${escapeHtml(usaha.nama_usaha)}</div>${headerExtra}<div class="struk-alamat">${escapeHtml(usaha.alamat ?? "")}</div>`;
}
```

### 9.3 Halaman yang harus diupdate

- `kasir.tsx` — struk transaksi
- `pembayaran.tsx` — kwitansi pembayaran
- `gaji-tenaga.tsx` — kwitansi upah
- `laporan.tsx` — header print
- `keuangan.tsx` — header print

Refactor jadi import helper bersama supaya satu sumber kebenaran.

### 9.4 CSS ukuran kertas

```ts
function getPageCss(ukuran: string) {
  if (ukuran === "58mm") return `@page { size: 58mm auto; margin: 2mm; }`;
  if (ukuran === "80mm") return `@page { size: 80mm auto; margin: 3mm; }`;
  return `@page { size: A4; margin: 15mm; }`;
}
```

Inject ke `<style>` template print.

---

## 10. Test

Tambah ke `tests/`:

### 10.1 `tests/pengaturan-defaults.test.ts`
- GET `/api/pengaturan` saat row kosong → return semua default
- GET setelah PUT batch satu key → return key tersebut + sisa default
- PUT batch dengan key tidak whitelisted → 400
- PUT batch dengan value > limit → 400 (kalau batas dipasang)

### 10.2 `tests/backup-version-1.8.test.ts`
- Parse backup v1.7 lama → `pengaturan` di-set kosong, app tidak crash
- Parse backup v1.8 dengan logo_base64 → field tersedia
- Parse backup v1.8 tanpa logo → logo_base64 = null

Target: minimum **+8 test baru**, total dari 19 → 27 pass.

---

## 11. Roadmap Eksekusi (per Sub-langkah)

Saat eksekusi nanti, urutan kerja yang aku rekomendasikan (commit terpisah per sub):

1. **Commit 1**: Schema DB + migrasi
   - `lib/db/src/schema/pengaturan.ts` baru
   - `lib/db/src/schema/index.ts` re-export
   - `lib/db/src/index.ts` `CREATE TABLE IF NOT EXISTS pengaturan`
   - `pnpm typecheck` lulus
2. **Commit 2**: API endpoint
   - `routes/pengaturan.ts` baru (GET, PUT batch)
   - Mount di `app.ts`
   - Test untuk endpoint
3. **Commit 3**: IPC logo
   - 3 handler di `main.ts`
   - Expose di `preload.ts`
   - Update `electron.d.ts` di hutang-app
4. **Commit 4**: Halaman /pengaturan
   - Page baru dengan 2 tab
   - Hook `usePengaturan()`
   - Routing di `App.tsx`
   - Sidebar entry di `Layout.tsx`
5. **Commit 5**: Backup format 1.8
   - Update export & restore di `backup.ts`
   - Test `backup-version-1.8`
6. **Commit 6**: Integrasi ke struk/kwitansi
   - Helper `lib/struk.ts`
   - Refactor 5 halaman pakai helper
7. **Commit 7**: Catatan rilis
   - `CATATAN-RILIS.md` entry v1.0.83 (atau v1.1.0 sesuai kebijakan minor bump)
   - `RENCANA-FITUR.md` status update

Tiap commit = self-contained, build tetap jalan, test tetap pass. Kalau ada bug di commit 6, commit 1-5 tetap aman dan bisa di-revert tanpa mengorbankan progres skema.

---

## 12. Yang Sengaja Tidak Diperhatikan di 1.2.0

| Item | Alasan tidak di-include |
|---|---|
| Format nomor invoice custom | Tidak ada permintaan user, format `Date.now().slice(-8)` masih jalan |
| PPN aktif | Butuh ALTER `transaksi_kasir` + ubah perhitungan total. Risiko regresi tinggi. Tunggu permintaan PKP |
| Threshold backup reminder per-usaha | Saat ini hardcoded 7 hari, sudah OK |
| Stok minimum global default | Setiap barang sudah punya field sendiri, redundant |
| Logo di multi-resolusi | Cukup 1 file, browser scale otomatis |
| Tab Pengaturan untuk super_admin | Super admin tidak butuh struk; sembunyikan menu untuk role super_admin |

---

## 13. Keputusan Terkunci (2026-05-14 malam)

User: "ngikutin rekomendasi mu aja". Berikut nilai default yang dipakai saat eksekusi:

| # | Item | Nilai dipakai | Alasan |
|---|---|---|---|
| 1 | Default `struk_footer` | `"Terima kasih atas kunjungan Anda"` | Sopan, generik, cocok semua jenis usaha |
| 2 | Ukuran logo max | **1 MB** | Cukup untuk PNG resolusi tinggi tanpa membuat backup membengkak |
| 3 | Format logo | **PNG + JPG** (tanpa SVG) | SVG butuh sanitisasi tambahan (XSS via `<script>`/`<foreignObject>`); PNG/JPG cukup |
| 4 | Strategi backup logo | **Embed base64 di `.usahaku-bak`** | User tidak perlu pegang 2 file; restore antar mesin tetap mulus |
| 5 | Akses super_admin ke /pengaturan | **Tidak** | Super admin tidak punya konteks usaha (`usaha_id` null) |
| 6 | Versi rilis | **v1.0.83** | Konsisten dengan pola incrementing existing. v1.1.0 disisakan untuk milestone besar berikutnya |

---

Total estimasi: 6-8 sesi kerja, atau ~3 hari kalau full focus.
