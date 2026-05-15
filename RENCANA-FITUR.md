# Rencana Fitur Usahaku — Penilaian Risiko terhadap Data User Existing

Dibuat: 2026-05-14
Status: **Eksekusi Rilis 1.1.0 dimulai 14 Mei 2026 malam.** Keputusan per item sudah dikunci di bawah.

Dokumen ini mencatat semua usulan perbaikan menu / penambahan fitur dari diskusi
sore 14 Mei 2026, lengkap dengan **penilaian risiko terhadap data user yang sudah
pakai aplikasi**. Tidak ada satu pun item di sini yang sudah dikerjakan.

---

## Konteks Risiko Umum

Sebelum masuk per-item, ini fakta yang menentukan tingkat risiko semua item:

1. **Pola migrasi DB sekarang aman** — `lib/db/src/index.ts` pakai
   `CREATE TABLE IF NOT EXISTS` dan `try { ALTER TABLE … ADD COLUMN … } catch {}`.
   Artinya:
   - Tabel baru tidak menyentuh tabel lama → **tidak bisa rusak data existing**.
   - Kolom baru selalu nullable / punya DEFAULT → **row lama otomatis dapat nilai default**.
   - Tidak pernah ada `DROP COLUMN` atau `ALTER … DROP`.
2. **Tabel inti yang tidak boleh diutak-atik destruktif**: `usaha`, `users`,
   `pelanggan`, `hutang`, `pembayaran`, `keuangan`, `barang`, `transaksi_stok`,
   `transaksi_kasir`, `transaksi_kasir_item`, `pekerja`, `upah_pekerja`,
   `bayar_upah`, `license_keys`, `password_reset_uses`. Semua perubahan harus
   **add only**, tidak rename / drop / type-change.
3. **Backup file `.usahaku-bak` harus tetap restorable di versi baru**. Restore
   memuat row apa adanya, jadi kolom baru yang nullable aman karena tidak dipakai
   kalau backup lama tidak punya kolom itu. Yang riskan: kalau ditambah constraint
   `NOT NULL` tanpa default → restore akan gagal.
4. **Frontend rename label murni kosmetik** — tidak menyentuh DB sama sekali.
   Risiko kerusakan data: 0.
5. **Auto-update electron-updater aktif**. Begitu rilis baru di-push, semua user
   akan dapat update. Artinya rilis tidak boleh setengah jadi atau merusak DB.

Skala risiko yang aku pakai:
- 🟢 **Rendah** — tidak menyentuh DB existing / hanya kosmetik / tabel baru terpisah.
- 🟡 **Sedang** — tambah kolom baru ke tabel existing, atau ubah perilaku tulis. Aman bila kolom nullable + ada fallback.
- 🔴 **Tinggi** — ubah skema kolom existing, atau ubah cara hitung / format data lama. **Butuh strategi migrasi + uji restore backup lama**.

---

## A. Restruktur Menu Sidebar (Owner)

### A1. Group sidebar baru

**Sekarang:**
```
UTAMA     → Dashboard
PIUTANG   → Pelanggan, Hutang, Pembayaran
BISNIS    → Kasir, Stok Barang, Keuangan, Gaji & Tenaga
LAPORAN   → Laporan
SISTEM    → Backup & Restore, Lisensi, Profil
```

**Opsi 1 — minor reshuffle (paling aman):**
```
UTAMA       → Dashboard
PIUTANG     → Pelanggan, Hutang, Pembayaran
PENJUALAN   → Kasir, Barang & Stok
KEUANGAN    → Keuangan, Pekerja & Upah
LAPORAN     → Laporan
SISTEM      → Backup & Restore, Lisensi
[footer]    → Profil, Keluar, Versi
```

**Opsi 2 — pisah master data (paling bersih):**
```
UTAMA         → Dashboard
MASTER DATA   → Pelanggan, Barang & Stok, Pekerja
TRANSAKSI     → Kasir, Hutang, Pembayaran, Pekerja & Upah, Keuangan
LAPORAN       → Laporan
SISTEM        → Backup & Restore, Lisensi
[footer]      → Profil, Keluar
```
Catatan: butuh sedikit refactor halaman gaji-tenaga (master pekerja vs transaksi upah jadi 2 menu).

**Opsi 3 — hybrid by frekuensi pakai:**
```
UTAMA      → Dashboard, Kasir
HARIAN     → Pembayaran, Hutang
DATA       → Pelanggan, Barang & Stok, Pekerja & Upah
KEUANGAN   → Keuangan, Laporan
SISTEM     → Backup & Restore, Lisensi
[footer]   → Profil, Keluar
```

**Risiko: 🟢 Rendah.** Cuma ubah file `Layout.tsx`, tidak menyentuh DB / API / route. Kalau salah, tinggal revert satu file. Tidak akan merusak data user. URL halaman tidak berubah, jadi bookmark tetap jalan.

**Catatan**: bila Opsi 2 dipilih, halaman `gaji-tenaga.tsx` perlu dipecah jadi `pekerja.tsx` (master) + `upah.tsx` (transaksi). Itu bukan migrasi data — cuma split komponen. Bisa juga awalnya 1 halaman dipakai 2 menu dengan tab pre-selected.

### A2. Rename label

| Sekarang | Usulan |
|---|---|
| Gaji & Tenaga | Pekerja & Upah |
| Stok Barang | Barang & Stok |
| Backup & Restore | Backup Data |

**Risiko: 🟢 Rendah.** Murni string label di sidebar. Tidak ada perubahan URL / data / API.

### A3. Profil pindah ke footer sidebar

Profil dipindah ke area di bawah "Versi 1.0.53 — Cek Pembaruan", sebagai tombol kecil dengan nama user.

**Risiko: 🟢 Rendah.** Sama seperti A2, perubahan UI saja.

---

## B. Halaman Pengaturan Terpusat

Konfigurasi yang sekarang tersebar mau dikumpulkan jadi satu halaman dengan tab.

### B1. Scope penuh (5 tab) vs minimal (2 tab)

**Penuh — 5 tab:**
1. Tab Usaha (pindahan dari Profil): nama_usaha, alamat, telepon, logo
2. Tab Struk & Cetak: header tambahan, footer, ukuran kertas (58/80/A4), tampilkan logo
3. Tab Numbering: format nomor invoice (`INV-{YYYY}{MM}-{0001}`), nomor kwitansi
4. Tab Pajak & Diskon: PPN aktif, persen, mode include/exclude
5. Tab Notifikasi: threshold backup reminder, stok minimum global

**Minimal — 2 tab:**
1. Tab Usaha (pindahan)
2. Tab Struk & Cetak

### B2. Penyimpanan setting

**Opsi A — tabel `pengaturan` key-value:**
```sql
CREATE TABLE pengaturan (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  usaha_id INTEGER NOT NULL REFERENCES usaha(id),
  key TEXT NOT NULL,
  value TEXT,
  UNIQUE(usaha_id, key)
);
```
Pro: fleksibel, tambah setting baru tanpa migrasi.
Kontra: nilai semuanya string, perlu parse di kode.

**Opsi B — extend tabel `usaha`:** tambah kolom `logo_path`, `struk_header`, `struk_footer`, `ppn_persen`, `nomor_invoice_format`, dll.
Pro: typed.
Kontra: tiap setting baru butuh ALTER + redeploy.

**Logo penyimpanan:**
- File di `userData/logos/<usaha_id>.png` (saran). Backup file ini di-include ke export `.usahaku-bak`.
- Atau base64 di DB. Bikin DB cepat membengkak.

### Risiko Pengaturan

- **Tabel `pengaturan` baru: 🟢 Rendah.** Tabel terpisah, default tidak ada row → app harus fallback ke nilai default kalau kosong. User existing tidak terpengaruh.
- **Pindah field profil usaha (nama/alamat/telepon) ke halaman Pengaturan: 🟢 Rendah.** Field tetap di tabel `usaha`, cuma form berpindah halaman. Endpoint `PUT /api/usaha/mine` tetap dipakai.
- **Logo upload: 🟡 Sedang.** Butuh handler IPC/file write di Electron + folder `userData/logos/`. Kalau backup `.usahaku-bak` tidak include file logo, restore di mesin lain logo hilang (tapi data inti aman). Mitigasi: include logo ke struktur backup ZIP atau base64.
- **Format nomor invoice diberlakukan ke transaksi baru: 🟡 Sedang.** Transaksi lama tetap pakai format lama (`Date.now().slice(-8)`), tidak boleh re-numbering retro karena akan inkonsisten dengan struk yang sudah dicetak/dibagi ke pelanggan. **Mitigasi: counter mulai dari 1 untuk nomor format baru, tidak menyentuh transaksi lama**.
- **PPN aktif/diskon default: 🟡 Sedang.** Cuma berlaku untuk transaksi baru. Tidak menghitung ulang transaksi lama. Tabel `transaksi_kasir` butuh kolom baru `ppn TEXT NOT NULL DEFAULT '0'` (nullable / default 0 supaya row lama aman).

**Bottom line B**: 🟢-🟡, semua **add-only**, tidak menulis ulang data lama. Risiko data rusak hampir nol selama migrasi pakai pattern `try/catch ALTER ADD COLUMN`.

---

## C. Master Supplier + Hutang Usaha

### C1. Mini — cuma master Supplier

Tabel baru `suppliers (id, usaha_id, nama, telepon, alamat, catatan, created_at)`.
Tabel `transaksi_stok` ditambah kolom `supplier_id INTEGER` nullable.
Halaman baru `/supplier`. Saat input "stok masuk", optional pilih supplier.

**Risiko: 🟢 Rendah.**
- Tabel baru, tidak menyentuh data lama.
- Kolom `supplier_id` di `transaksi_stok` nullable → row lama dapat NULL, tidak mengubah perilaku app.
- Backup lama (`.usahaku-bak`) tetap restorable: kolom baru di-skip atau di-isi NULL.

### C2. Penuh — Supplier + Hutang Usaha + Pembayaran Hutang Usaha

Tambah:
- `hutang_usaha (id, usaha_id, supplier_id, tanggal, jumlah, sisa, status, ...)`
- `pembayaran_hutang_usaha (id, usaha_id, hutang_usaha_id, tanggal, jumlah, ...)`
- Saat "stok masuk" toggle "Bayar tunai / Hutang ke supplier".
- Halaman `/hutang-usaha` + `/pembayaran-hutang-usaha`.

**Risiko: 🟡 Sedang.**
- Tabel baru semua → DB existing aman.
- Yang berubah perilaku: alur input "stok masuk". Saat ini selalu auto-buat entry keuangan KELUAR. Kalau toggle "Hutang", harus **tidak** buat entry keuangan, dan baru buat saat dibayar.
- **Risiko data lama: nol.** Hanya alur ke depan yang berubah.
- **Risiko regresi**: kalau bug di toggle, user bisa double-record (keuangan keluar + hutang usaha). Mitigasi: unit test untuk kedua jalur, plus tampilkan badge "Belum dibayar" jelas di UI.
- **Restore backup lama**: aman, tabel baru kosong saja. Backup baru harus include 2 tabel ini.

**Catatan tambahan**: kalau hutang usaha jarang dipakai, bisa diakali tanpa fitur baru — pakai menu Keuangan kategori "Hutang ke Supplier". Tapi tidak ada tracking sisa per supplier.

---

## D. Pusat Notifikasi + Badge Angka di Sidebar

### D1. Badge angka sidebar (cepat)

Di item sidebar "Barang & Stok", "Pekerja & Upah", "Hutang" tampilkan angka kecil:
- Stok ≤ minimum (data: `GET /api/barang/peringatan` sudah ada)
- Upah belum dibayar (data: `GET /api/upah?status=belum_lunas` sudah ada)
- Hutang jatuh tempo (kolom `tanggal_jatuh_tempo` sudah ada di `hutang`, tinggal query yang lewat hari ini)

**Risiko: 🟢 Rendah.** Read-only query, tidak ubah data.

### D2. Halaman /notifikasi terpusat

List semua peringatan, klik → ke item terkait. UI baru, tanpa skema baru.

**Risiko: 🟢 Rendah.** Read-only.

---

## E. Menu Bantuan

Item baru di footer SISTEM yang buka dialog modal berisi `PANDUAN-KERJA-USAHAKU.md` di-render markdown, atau panggil `shell.openPath` ke file PDF.

**Risiko: 🟢 Rendah.** UI saja.

---

## Ringkasan Tabel Risiko

| Item | Skema DB | Sentuh data lama? | Restore backup lama tetap jalan? | Skala risiko |
|---|---|---|---|---|
| A1 grup menu | tidak | tidak | ya | 🟢 |
| A2 rename label | tidak | tidak | ya | 🟢 |
| A3 profil ke footer | tidak | tidak | ya | 🟢 |
| B1 halaman Pengaturan minimal | tidak / opsional | tidak | ya | 🟢 |
| B1 halaman Pengaturan penuh | tabel baru `pengaturan` + ALTER nullable | tidak | ya | 🟢→🟡 |
| B2 logo upload | tabel `pengaturan` + folder file | tidak | ya (logo bisa hilang kalau restore antar mesin tanpa file logo) | 🟡 |
| B3 format nomor invoice | counter baru, transaksi lama tidak diubah | tidak | ya | 🟡 |
| B4 PPN default | ALTER `transaksi_kasir` ADD COLUMN nullable | tidak | ya | 🟡 |
| C1 master Supplier saja | tabel baru `suppliers` + ALTER `transaksi_stok` nullable | tidak | ya | 🟢 |
| C2 Supplier + Hutang Usaha | 2-3 tabel baru | tidak | ya | 🟡 |
| D badge & notifikasi | tidak | tidak | ya | 🟢 |
| E menu Bantuan | tidak | tidak | ya | 🟢 |

**Tidak ada item yang masuk 🔴.** Semua bisa dilakukan tanpa risiko merusak data
user existing **selama**:
1. Pakai pattern `CREATE TABLE IF NOT EXISTS` untuk tabel baru.
2. Pakai `try { ALTER TABLE … ADD COLUMN … nullable / DEFAULT } catch {}`
   untuk kolom baru di tabel existing.
3. Tidak ada `DROP COLUMN`, `RENAME COLUMN`, atau ubah `NOT NULL` tanpa default.
4. Sebelum rilis: jalankan `pnpm test`, install di mesin uji yang sudah ada DB
   v lama, **lalu uji restore backup `.usahaku-bak` lama**.

---

## Strategi Rilis Aman (Wajib)

Untuk setiap batch perubahan yang menyentuh DB:

1. **Bump versi minor** (1.0.53 → 1.1.0) supaya jelas ada fitur baru.
2. **Jalankan `pnpm test` & `pnpm run typecheck`** sebelum tag release. Sekarang harus 19/19 pass + 0 error TS.
3. **Uji install di-atas DB lama** — copy `app.db` user beneran (atau backup) ke
   mesin dev, install versi baru, pastikan:
   - App tetap bisa login
   - Semua menu existing tetap render
   - Restore backup `.usahaku-bak` lama tetap sukses
   - Backup baru tetap restorable
4. **Tulis catatan di `CATATAN-RILIS.md`** apa saja yang berubah & migrasi otomatis apa yang dijalankan.
5. **Auto-update electron-updater**: kalau yakin baru rilis ke segelintir user, bisa pause auto-update sementara dengan tidak generate `latest.yml` ke channel publik. Atau biarkan saja kalau sudah lulus uji (3) di atas.

---

## Keputusan Terkunci (2026-05-14 malam)

| # | Item | Keputusan | Alasan singkat |
|---|---|---|---|
| A1 | Grup menu | **Opsi 1** (PIUTANG, PENJUALAN, KEUANGAN, LAPORAN, SISTEM) | Perubahan minimal, user lama tetap familiar dengan lokasi menu existing |
| A2 | Rename label | **"Pekerja & Upah"** + **"Barang & Stok"** (Backup & Restore tetap) | Akurat & singkat. "Restore" tetap dipertahankan karena penting untuk pemahaman user |
| A3 | Profil ke footer sidebar | **Ya** | Profil bukan menu navigasi harian, footer pattern sudah jadi konvensi modern |
| B1 | Halaman Pengaturan | **Minimal — 2 tab** (Usaha + Struk & Cetak) | Ship vertical slice: 2 tab benar-benar pakai > 5 tab setengah jadi |
| B2 | Logo | **File di `userData/logos/`** + include ke backup | DB tetap ramping, logo tidak membengkak SQLite |
| C2 | Supplier + Hutang Usaha | **Mini dulu — cuma master Supplier** | Solve 60% kebutuhan dengan risiko rendah. Hutang usaha tunggu data permintaan user nyata |
| D | Notifikasi | **Cuma badge angka di sidebar** (D1) | Halaman /notifikasi (D2) redundant dengan badge sidebar |
| E | Bantuan | **Render markdown di modal** | `shell.openPath` ke PDF butuh build + bundle PDF + reader; markdown 1 sumber & auto-update |

---

## Roadmap Eksekusi

Eksekusi bertahap per rilis, satu rilis selesai dulu (test pass + manual smoke) baru lanjut ke rilis berikutnya. Kalau di tengah jalan ada item yang ternyata terlalu berisiko, **boleh di-skip dan dilewati ke item berikut tanpa menahan rilis** — sesuai instruksi user.

### Rilis v1.0.82 — UI polish (semua 🟢, tidak menyentuh DB)

Status: **✅ Selesai (siap dipublish)** — 2026-05-14 malam

- [x] A1 Opsi 1 — restruktur grup sidebar: UTAMA, PIUTANG, PENJUALAN, KEUANGAN, LAPORAN, SISTEM
- [x] A2 — rename label "Gaji & Tenaga" → "Pekerja & Upah", "Stok Barang" → "Barang & Stok" (Backup & Restore tetap)
- [x] A3 — Profil pindah ke footer sidebar (sebelum Versi & Cek Pembaruan, menampilkan nama user)
- [x] D1 — Badge angka di sidebar:
  - Hutang: jumlah hutang yang sudah lewat `tanggal_jatuh_tempo` (badge merah)
  - Barang & Stok: jumlah barang dengan stok ≤ minimum (badge amber, dari `/api/barang/peringatan`)
  - Pekerja & Upah: jumlah upah dengan status `belum_lunas` (badge orange)
  - Badge fetch otomatis dimatikan kalau lisensi mati / jam dimanipulasi (hemat request)
- [x] E — Menu Bantuan: item baru di footer sidebar yang buka `HelpDialog` (panduan per-menu, tanpa dependency markdown library tambahan untuk meminimalkan risiko)

File yang berubah:
- `artifacts/hutang-app/src/components/layout/Layout.tsx` (rewrite)
- `artifacts/hutang-app/src/components/layout/HelpDialog.tsx` (baru)
- `CATATAN-RILIS.md` (entry v1.0.82)
- `RENCANA-FITUR.md` (status update)

Verifikasi:
- [x] `pnpm run typecheck` — 0 error ✅
- [x] `pnpm test` — 19/19 pass ✅
- [ ] Smoke test manual: login owner → semua menu render → klik tiap badge → buka Bantuan (perlu user lakukan)
- [x] Catat di `CATATAN-RILIS.md` (rilis berikutnya: v1.0.82)

Tidak menyentuh DB / migrasi / endpoint baru. Restore backup lama tetap jalan.

### Rilis v1.0.83 — Pengaturan minimal (🟢→🟡)

Status: **✅ Published** — 2026-05-15 pagi

7 commit bertahap, semua self-contained, typecheck 0 error, test 30/30 pass:

- [x] Commit 1 (`5afa373`): Tabel baru `pengaturan` (CREATE IF NOT EXISTS) + schema Drizzle
- [x] Commit 2 (`b64911b`): API `/api/pengaturan` GET + PUT batch + whitelist key + 11 unit test baru
- [x] Commit 3 (`27f59a9`): IPC `pengaturan:saveLogo`/`getLogoData`/`deleteLogo` di Electron main + preload + electron.d.ts
- [x] Commit 4 (`a1c2430`): Hook `usePengaturan()` + halaman `/pengaturan` 2 tab (Data Usaha + Struk & Cetak) + entry sidebar grup SISTEM
- [x] Commit 5 (`c25ba16`): Backup format 1.7 → 1.8 dengan field `pengaturan` (file logo tidak di-include karena server tidak akses userData; user upload ulang setelah restore antar mesin)
- [x] Commit 6 (`f53c9f6`): Helper bersama `lib/struk.ts` + integrasi ke struk Kasir (logo, alamat, telepon, header, footer, ukuran kertas). Halaman lain (laporan/pembayaran/gaji-tenaga/keuangan) defer ke rilis berikut
- [x] Commit 7 (`be10711`): Catatan rilis (file ini)

Temuan lapangan setelah publish:
- [x] Smoke test login owner → buka /pengaturan → upload logo → simpan struk → cetak transaksi kasir → **80mm OK, 58mm berantakan** (di-fix di v1.0.84)
- [ ] Restore backup v1.7 lama di app v1.0.83 (pengaturan tetap kosong, app tidak crash)
- [ ] Backup v1.0.83 → restore di v1.0.83 lain (pengaturan ikut dipulihkan, logo perlu upload ulang antar mesin)

### Rilis v1.0.84 — Hotfix struk 58mm (🟢)

Status: **✅ Published** — 2026-05-15 siang

User-reported issue setelah v1.0.83 dipasang: cetak struk dengan ukuran kertas 58mm masih berantakan (kolom harga lompat ke baris berikutnya, total kepotong). Ukuran 80mm dan A4 sudah aman.

Akar masalah:
- Template struk lama pakai 1 layout tabel 4 kolom (Barang | Qty | Harga | Sub) untuk semua ukuran.
- Di lebar body 54mm, format Rupiah `Rp 50.000` × 2 kolom + nama barang panjang membuat baris pecah / overflow.
- 80mm body 72mm punya cukup ruang, jadi terlihat aman. 58mm tidak.

Solusi:
- Pisahkan template per ukuran. 58mm pakai layout **2-baris per item** (nama di atas, `qty satuan × harga` + subtotal di bawah), font 8pt, body 50mm (safety margin printer thermal yang area cetak efektif ~48mm), format angka tanpa prefix "Rp" untuk hemat ruang.
- 80mm dan A4 **tidak berubah** (tetap tabel 4 kolom yang sudah aman). A4 dapat font lebih besar saja.
- Builder HTML dipindah dari `kasir.tsx` ke `lib/struk.ts` sebagai `buildStrukHtml(...)` supaya bisa dipakai ulang nanti (cetak ulang dari riwayat, dsb).

Commit:
- [x] `feat(struk): layout 58mm dirombak + buildStrukHtml di lib/struk.ts` — refactor `lib/struk.ts`, simplify `kasir.tsx`, +20 unit test (`tests/struk-builder.test.ts`), update `CATATAN-RILIS.md`

Verifikasi:
- [x] `pnpm vitest run` — 50/50 pass (30 lama + 20 baru) ✅
- [x] `pnpm --filter @workspace/hutang-app typecheck` — 0 error ✅
- [x] `pnpm --filter @workspace/hutang-app build:electron` — sukses ✅
- [ ] Smoke test manual: cetak struk 58mm di printer thermal user (perlu user lakukan)
- [ ] Smoke test regression: cetak struk 80mm + A4 (verifikasi tidak berubah)

Tidak menyentuh DB / API / format backup. Tidak ada migrasi. Restore backup lama tetap jalan.

### Rilis v1.0.85 — Cleanup form usaha duplikat (🟢)

Status: **✅ Selesai (siap dipublish)** — 2026-05-15 sore

Sebelum: form edit data usaha (nama_usaha, telepon, alamat, catatan) ada di **2 tempat**:
- `/profil` Card "Info Usaha / Toko"
- `/pengaturan` tab "Data Usaha"

Keduanya pakai schema Zod yang persis sama, query `usaha-mine` yang sama, dan endpoint `PUT /api/usaha/mine` yang sama. Implikasi: dua sumber kebenaran yang sama-sama bisa edit, label/style sedikit beda, bisa bingungkan user.

Keputusan: `/pengaturan` jadi single source of truth. `/profil` fokus ke akun + ganti password.

Yang berubah:
- `artifacts/hutang-app/src/pages/profil.tsx`:
  - Hapus `usahaSchema`, `usahaForm`, `updateUsahaMutation`, state `editingUsaha`, dan seluruh Card "Info Usaha / Toko".
  - Pertahankan: Card profil pengguna, query `usaha-mine` (read-only) untuk menampilkan nama usaha, Card "Ganti Password", tombol Logout.
  - Tambah tombol kecil "Atur Data Usaha" di area "Usaha Terhubung" yang link ke `/pengaturan` (hanya untuk role owner).
  - Tambah info-box dengan link ke halaman Pengaturan untuk setting struk + logo.
- Hapus import yang tidak terpakai (Textarea, beberapa icon, dst).

Verifikasi:
- [x] `pnpm vitest run` — 50/50 pass ✅ (tidak ada test yang impact)
- [x] `pnpm --filter @workspace/hutang-app typecheck` — 0 error ✅
- [x] `pnpm --filter @workspace/hutang-app build:electron` — sukses, bundle JS turun ~4 kB ✅
- [ ] Smoke test manual: login owner → /profil → klik tombol "Atur Data Usaha" → muncul /pengaturan tab usaha (perlu user lakukan)

Tidak menyentuh DB / API / format backup / endpoint baru. Endpoint `PUT /api/usaha/mine` tetap ada (dipakai oleh `/pengaturan`). Restore backup lama tetap jalan.

### Backlog v1.0.86+ (defer dari 1.2.0)

- Migrasi struk halaman lain ke helper `lib/struk.ts` (laporan, pembayaran, gaji-tenaga, keuangan) — A4/A5, bukan terkait bug 58mm, cuma konsistensi header logo + alamat + footer
- Logo embed di backup (butuh API server/IPC bridge untuk akses userData)

### Rilis 1.3.0 — Master Supplier (🟢)

Status: ⏸ Menunggu 1.2.0

- Tabel baru `suppliers (id, usaha_id, nama, telepon, alamat, catatan, created_at)`
- ALTER `transaksi_stok` ADD COLUMN `supplier_id INTEGER` nullable
- Halaman `/supplier` (CRUD mirror dari Pelanggan)
- Form "stok masuk" tambah dropdown supplier opsional
- Laporan baru: total beli per supplier
- Verifikasi: uji restore backup 1.2.x di app 1.3.0

### Backlog (tidak masuk roadmap, build kalau ada permintaan user)

- B1 tab tambahan (Numbering, Pajak, Notifikasi threshold) — observasi dulu apakah dibutuhkan
- C2 Hutang Usaha penuh — tunggu data permintaan + desain edge case
- D2 halaman /notifikasi terpusat — kalau alert per-jenis perlu di-mute
- A1 Opsi 2/3 (restruktur menu radikal) — sengaja di-skip
- Format nomor invoice custom — sengaja di-skip

---

## Aturan Eksekusi (Wajib di Setiap Item)

1. Tidak ada `DROP COLUMN`, `RENAME COLUMN`, atau ubah constraint `NOT NULL` tanpa default.
2. Tabel baru pakai `CREATE TABLE IF NOT EXISTS`.
3. Kolom baru di tabel existing pakai `try { ALTER TABLE … ADD COLUMN … } catch {}`.
4. Tiap rilis yang menyentuh DB → wajib uji restore backup versi sebelumnya.
5. Kalau di tengah eksekusi item ternyata ada side-effect ke data lama yang tidak terprediksi → **skip item itu, lanjut item berikut, catat di dokumen ini sebagai "🟠 di-skip karena…"**.
6. Tiap rilis bump versi minor + update `CATATAN-RILIS.md`.
