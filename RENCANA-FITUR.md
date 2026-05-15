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

Status: **✅ Published** — 2026-05-15 sore

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

### Rilis v1.0.86 — Cetak ulang struk + header kwitansi konsisten (🟢)

Status: **✅ Published** — 2026-05-15 sore

Dua peningkatan UX yang user-facing langsung kelihatan:

**A. Cetak ulang struk dari Riwayat Penjualan Kasir.** Sebelumnya tombol di dialog Riwayat hanya bisa hapus. Sekarang tiap baris ada tombol Printer yang panggil `buildStrukHtml` yang sama dengan transaksi baru — header logo, alamat, footer kustom, ukuran kertas semua ikut pengaturan. Subtotal direkonstruksi dari `total + diskon` supaya angka sama persis dengan struk pertama.

**B. Header kwitansi pembayaran hutang + kwitansi upah konsisten dengan struk Kasir.** Sebelumnya kedua kwitansi cuma render `nama usaha` polos dari snapshot lama. Sekarang menampilkan logo + alamat + telepon + teks header tambahan dari Pengaturan yang sama dengan struk Kasir.

File yang berubah:
- `artifacts/hutang-app/src/lib/struk.ts` — tambah `buildPrintHeaderHtml()` + `getDefaultPrintHeaderCss()` untuk dipakai di dokumen non-thermal (kwitansi, laporan).
- `artifacts/hutang-app/src/hooks/use-print-context.tsx` (baru) — hook `usePrintContext()` yang gabungkan data usaha + pengaturan jadi satu objek. Plus helper async `loadLogoForPrint()`.
- `artifacts/hutang-app/src/pages/kasir.tsx` — interface `RiwayatTransaksi` dilengkapi `harga_satuan`, `uang_bayar`, `kembalian`. Tambah `handlePrintRiwayat()` dan tombol Cetak per baris di dialog Riwayat.
- `artifacts/hutang-app/src/pages/pembayaran.tsx` — `buildKwitansiGabunganHtml` dan `buildKwitansiLamaHtml` pakai header bersama. CSS lama yang spesifik dipindah ke `getDefaultPrintHeaderCss`.
- `artifacts/hutang-app/src/pages/gaji-tenaga.tsx` — `buildKwitansiUpahHtml` pakai header bersama (override CSS supaya kompak di A5 landscape).
- `tests/struk-builder.test.ts` — +7 test baru untuk `buildPrintHeaderHtml` dan `getDefaultPrintHeaderCss` (smoke + escape XSS + edge case).

Verifikasi:
- [x] `pnpm vitest run` — 57/57 pass (50 lama + 7 baru) ✅
- [x] `pnpm --filter @workspace/hutang-app typecheck` — 0 error ✅
- [x] `pnpm --filter @workspace/hutang-app build:electron` — sukses ✅
- [ ] Smoke test manual: cetak ulang struk dari Riwayat Kasir → muncul logo + footer dari Pengaturan
- [ ] Smoke test manual: cetak kwitansi pembayaran hutang → muncul logo + alamat + telepon
- [ ] Smoke test manual: cetak kwitansi upah → muncul logo + alamat + telepon

Tidak menyentuh DB / API / format backup. Halaman `laporan.tsx` (4 template print A4 landscape) sengaja **defer** ke rilis berikut karena scope-nya 4 template internal yang risiko regresinya beda dengan kwitansi user-facing.

### Rilis v1.0.87 — Pratinjau struk live di Pengaturan (🟢)

Status: **✅ Published** — 2026-05-15 sore

Friction yang di-solve: dulu user harus simpan setting → buka Kasir → buat transaksi dummy → cetak → kembali → revisi → ulang. Sekarang panel Pratinjau di tab "Struk & Cetak" langsung update tiap kali field berubah, jadi user tidak perlu siklus simpan-cetak-revisi sama sekali.

Yang berubah:
- `artifacts/hutang-app/src/lib/struk.ts` — tambah opsi `forPreview: true` di `BuildStrukOptions`. Kalau aktif, script `window.print()` di-skip supaya iframe preview tidak trigger dialog cetak browser. Default behavior (cetak transaksi nyata) tidak berubah.
- `artifacts/hutang-app/src/components/struk-preview.tsx` (baru) — komponen `StrukPreview` yang render iframe sandbox dengan `srcDoc`. Logo di-load via IPC sesuai toggle. Debounce 200ms saat field berubah supaya typing di textarea header/footer tidak rebuild iframe per huruf.
- `artifacts/hutang-app/src/pages/pengaturan.tsx` — tab "Struk & Cetak" jadi grid 2 kolom (form di kiri, preview di kanan). `form.watch()` di-wire ke kedua tab (Data Usaha + Struk) supaya preview menampilkan komposit yang akurat — termasuk kalau user mengubah nama usaha di tab Data Usaha tanpa simpan dulu.
- `tests/struk-builder.test.ts` — +3 test untuk opsi `forPreview` (default tetap auto-print, forPreview skip auto-print, layout tetap konsisten).

Verifikasi:
- [x] `pnpm vitest run` — 60/60 pass (57 lama + 3 baru) ✅
- [x] `pnpm --filter @workspace/hutang-app typecheck` — 0 error ✅
- [x] `pnpm --filter @workspace/hutang-app build:electron` — sukses ✅
- [ ] Smoke test manual: buka /pengaturan tab Struk & Cetak → ubah header/footer/ukuran → preview ikut berubah
- [ ] Smoke test manual: ubah nama usaha di tab Data Usaha (tanpa simpan) → buka tab Struk → preview menampilkan nama yang baru

Tidak menyentuh DB / API / format backup. Iframe pakai `sandbox=""` (no scripts, no same-origin) sehingga isolasi penuh dari halaman induk — `forPreview` skip auto-print sebagai defense in depth tapi sandbox sudah block script execution juga.

### Rilis v1.0.88 — Logo embed di backup (🟡)

Status: **✅ Published + smoke test lapangan lulus** — 2026-05-15 sore

Smoke test 2026-05-15 sore (`PANDUAN-SMOKE-TEST-V1.0.88.md`):
- Tes 1 (round-trip logo 1 mesin) — ✅ aman
- Tes 2 (backup lintas mesin / fresh state) — ✅ aman
- Tes 3 (regression restore backup v1.7/v1.8 lama) — ✅ aman
- Tes 4 (cetak printer thermal asli) — ⏭ skip, driver printer tidak tersedia (boleh divalidasi later kalau user lain punya printer)

Closing loop dari v1.0.83. Saat itu sudah dirancang format backup naik ke v1.8 dengan include data tabel `pengaturan` (key/value), tapi **file logo** sengaja di-skip dengan catatan "user upload ulang setelah restore antar mesin" — karena server tidak punya akses `userData/logos/`.

Sekarang logo otomatis ikut di-include lewat client-side enrichment, tanpa harus mengubah API server.

Strategi:
- **Server tidak berubah** (`/api/backup/export` tetap return v1.8 tanpa logo). Komentar di server diperbarui supaya jelas pembagian tanggung jawab.
- **Client export (`backup.tsx` handleExport)**: setelah dapat payload v1.8 dari server, kalau ada `logo_filename` di pengaturan dan ada IPC `pengaturan.getLogoData`, ambil base64 logo, tempel ke `data.logo_base64` + `data.logo_ext`, bump `data.version = "1.9"`. File yang disimpan ke disk: v1.9 dengan logo.
- **Client restore (`backup.tsx` restoreLogoIfPresent)**: setelah `useImportBackup` mutation sukses, kalau payload punya `logo_base64`, panggil `pengaturan.saveLogo` IPC untuk tulis file ke `userData/logos/<usaha_id>/`, lalu `PUT /api/pengaturan/batch` dengan `logo_filename` baru (timestamp baru dari saveLogo). Logo otomatis tampil di pengaturan + struk berikutnya.

Backward-compat:
- **v1.7** (sebelum pengaturan): server skip array `pengaturan` yang tidak ada → tidak crash. Logo tidak ada → tidak diutak-atik.
- **v1.8** (pengaturan tanpa logo): server restore array pengaturan biasa. `logo_filename` di backup tetap dihormati, tapi file fisik logo di mesin tujuan harus sudah ada (atau user upload ulang). Sama persis dengan perilaku v1.0.83-v1.0.87.
- **v1.9** (full): semua di-restore + logo ditulis ulang. `logo_filename` di-overwrite ke filename baru hasil saveLogo (timestamp baru) supaya konsisten dengan file fisik di disk.

File yang berubah:
- `artifacts/api-server/src/routes/backup.ts` — komentar saja: jelaskan pembagian tanggung jawab server vs client.
- `artifacts/hutang-app/src/pages/backup.tsx` — tambah enrichment logo di `handleExport`, plus helper `restoreLogoIfPresent` yang dipanggil di `onSuccess` import.
- `CATATAN-RILIS.md` — entri v1.0.88 + v1.0.87 ke Published.
- `RENCANA-FITUR.md` — section v1.0.88, backlog jadi v1.0.89+.

Verifikasi:
- [x] `pnpm vitest run` — 60/60 pass ✅ (tidak ada test yang impact)
- [x] `pnpm --filter @workspace/hutang-app typecheck` — 0 error ✅
- [x] `pnpm --filter @workspace/api-server typecheck` — 0 error ✅
- [x] `pnpm --filter @workspace/hutang-app build:electron` — sukses ✅
- [ ] Smoke test manual: di mesin A, upload logo → export backup → buka file `.json` → cek ada `logo_base64` dan `version: "1.9"`
- [ ] Smoke test manual: di mesin B fresh install (atau hapus folder logos), restore backup v1.9 → tab Pengaturan langsung tampil logo di preview, struk Kasir cetak dengan logo
- [ ] Smoke test regression: restore backup v1.7 atau v1.8 lama di app v1.0.88 → tetap sukses, tidak crash, logo lama (kalau ada) tidak hilang

Kekecualian yang sudah disadari: kalau user pakai **Google Drive backup** (kartu kedua di halaman Backup), file yang di-upload adalah `.db` SQLite langsung (bukan JSON). Logo di `.db` itu cuma referensi `logo_filename`, file fisiknya tidak ikut. v1.0.88 tidak menyentuh jalur Google Drive — defer kalau ada user complain.

### Backlog v1.0.89+ (defer)

- Migrasi 4 template print di `laporan.tsx` ke helper `buildPrintHeaderHtml` (A4 landscape — laporan keuangan, kasir, hutang, stok)
- Logo embed di backup Google Drive (`.db` mode) — butuh perubahan format / paket logo terpisah

### Rilis 1.1.0 — Master Supplier (🟢)

Status: **🟡 Siap publish** — 2026-05-15 sore. Smoke test v1.0.88 lapangan lulus, langsung jalan ke C1.

Eksekusi sesuai blueprint section C1 di atas:
- ✅ Tabel baru `suppliers (id, usaha_id, nama, telepon, alamat, catatan, created_at)` di `lib/db/src/schema/suppliers.ts` + migration `CREATE TABLE IF NOT EXISTS` di `lib/db/src/index.ts`.
- ✅ `ALTER TABLE transaksi_stok ADD COLUMN supplier_id INTEGER` (nullable) — try/catch sesuai konvensi, transaksi lama tetap aman.
- ✅ Halaman `/supplier` di sidebar grup PENJUALAN (CRUD mirror dari Pelanggan): nama wajib + title-case, telepon/alamat/catatan opsional. Hapus ditolak kalau supplier masih dipakai di `transaksi_stok`.
- ✅ API `GET/POST/PUT/DELETE /api/suppliers` (`artifacts/api-server/src/routes/suppliers.ts`) + dropdown supplier opsional di form Barang Masuk halaman Stok. `supplier_id` disertakan di payload `POST /api/stok/masuk`. Stok keluar tidak butuh supplier (dipisah ke schema sendiri).
- ✅ Saat supplier dipilih, keterangan keuangan otomatis "Beli {nama} {jumlah} {satuan} dari {supplier_nama}" — jadi kelihatan jelas di tabel Riwayat Transaksi tanpa perlu kolom tambahan.
- ✅ Backup format naik: server return v1.10 dengan array `suppliers` + field `supplier_id` di `transaksi_stok`. Client (Electron) bump ke v1.11 saat ada logo (di-atas v1.10). Backup v1.7-v1.9 lama tetap restorable: array `suppliers` di-skip kalau tidak ada, `supplier_id` di-skip jadi `null`. ID lama→baru di-mapping seperti `pelangganIdMap`/`barangIdMap`.
- ⏭ Laporan total beli per supplier — defer ke v1.1.x kalau user request, tidak masuk scope rilis ini supaya tetap fokus pada master + integrasi minimal.

Verifikasi:
- [x] `pnpm vitest run` — 60/60 pass ✅
- [x] `pnpm typecheck` — 0 error di semua workspace (libs + 4 artifact) ✅
- [x] `pnpm --filter @workspace/electron-app build:desktop` — backend + frontend + main build sukses ✅
- [ ] Smoke test manual: tambah 2 supplier, buat transaksi Barang Masuk dengan + tanpa supplier, cek keterangan keuangan otomatis menyertakan "dari {supplier_nama}".
- [ ] Smoke test manual: hapus supplier yang masih dipakai → muncul error 400 dari server, supplier tidak terhapus.
- [ ] Smoke test regression: restore backup v1.9 lama (sebelum suppliers ada) → app tidak crash, tabel suppliers kosong, transaksi_stok lama dengan `supplier_id NULL`.
- [ ] Smoke test round-trip: di mesin A buat supplier + transaksi → export → di mesin B restore → supplier muncul, supplier_id di transaksi tetap konsisten (nama tampil di keterangan).

Files yang berubah:
- `lib/db/src/schema/suppliers.ts` (baru)
- `lib/db/src/schema/index.ts`, `lib/db/src/schema/stok.ts`, `lib/db/src/index.ts` (migration + relasi)
- `artifacts/api-server/src/routes/suppliers.ts` (baru), `artifacts/api-server/src/routes/index.ts` (registrasi)
- `artifacts/api-server/src/routes/stok.ts` (POST /stok/masuk + format response)
- `artifacts/api-server/src/routes/backup.ts` (export v1.10 + restore include suppliers + map ID)
- `artifacts/hutang-app/src/pages/supplier.tsx` (baru), `App.tsx` (route), `components/layout/Layout.tsx` (sidebar entry)
- `artifacts/hutang-app/src/pages/stok.tsx` (dropdown di dialog Barang Masuk)
- `artifacts/hutang-app/src/pages/backup.tsx` (bump versi v1.10 → v1.11 saat ada logo)
- `artifacts/electron-app/package.json` (1.0.53 → 1.1.0)
- `CATATAN-RILIS.md`, `RENCANA-FITUR.md` (entri rilis ini)

### Rilis 1.1.1 — Detail Supplier + Laporan Pembelian per Supplier (🟢)

Status: **🟡 Siap publish** — 2026-05-15 sore. v1.1.0 sudah dipasang user, jalan tanpa error.

User report setelah pakai v1.1.0: "supplier ini nyambungnya kemana?" — closing-loop yang dijawab di rilis ini. Supplier yang dulu cuma jadi label di transaksi sekarang punya halaman dengan agregasi + laporan periodik.

Eksekusi:
- ✅ `GET /api/suppliers/:id` di-extend: selain data identitas, sekarang return `total_transaksi`, `total_pembelian`, `barang_terbeli` (group by barang dengan total qty + nilai), `transaksi_terakhir` (10 terbaru, ter-resolve nama barang).
- ✅ `GET /api/laporan/pembelian-supplier?bulan=&tahun=&supplier_id=` baru: ringkasan per supplier untuk periode tertentu, plus baris "Tanpa Supplier" untuk transaksi `supplier_id NULL`. Optional breakdown per barang kalau filter `supplier_id` ada.
- ✅ Halaman `/supplier/:id` (`supplier-detail.tsx`): identitas supplier + 2 KPI (jumlah transaksi & total nilai pembelian) + tabel barang yang pernah dibeli (sort by total nilai) + 10 transaksi terakhir. Tombol Eye di tabel `/supplier`.
- ✅ Tab baru "Pembelian Supplier" di `/laporan`: filter bulan/tahun (default bulan ini), 3 KPI summary (periode, jumlah transaksi, total nilai), tabel ringkasan per supplier urut nilai tertinggi, tombol Cetak A4 landscape pakai `buildPrintHeaderHtml` dari `lib/struk.ts` jadi header logo+alamat+telepon ikut konsisten dengan kwitansi/struk.

Pure additive read-only — tidak menyentuh DB / format backup / schema.

File yang berubah:
- `artifacts/api-server/src/routes/suppliers.ts` — extend GET /:id dengan agregasi.
- `artifacts/api-server/src/routes/laporan.ts` — endpoint baru `/laporan/pembelian-supplier`.
- `artifacts/hutang-app/src/pages/supplier-detail.tsx` (baru), `supplier.tsx` (Eye button), `App.tsx` (route /supplier/:id).
- `artifacts/hutang-app/src/components/laporan/laporan-supplier-tab.tsx` (baru), `pages/laporan.tsx` (TabsTrigger + TabsContent).
- `artifacts/electron-app/package.json` (1.1.0 → 1.1.1).
- `CATATAN-RILIS.md`, `RENCANA-FITUR.md`.

Verifikasi:
- [x] `pnpm vitest run` — 60/60 pass ✅
- [x] `pnpm typecheck` — 0 error ✅
- [x] `pnpm --filter @workspace/electron-app build:desktop` — sukses ✅
- [ ] Smoke test manual: klik Eye di /supplier → muncul detail dengan ringkasan benar.
- [ ] Smoke test manual: di /laporan tab "Pembelian Supplier", ganti bulan → data ikut berubah; klik Cetak A4 → header lengkap muncul.

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
