# Workspace

## Overview

This project is a pnpm workspace monorepo using TypeScript, designed to be **Usahaku by KetanTech** — an Aplikasi Manajemen Bisnis (Business Management App) for Indonesian small businesses (warung, toko kelontong, penggilingan padi). It provides comprehensive tools for managing customer debts, financial records (masuk/keluar), stock/inventory, kasir (POS), and reporting, with both web and desktop (Electron) interfaces. The application supports role-based access: Super Admin for global management and Owners for business-specific operations.

**Current version: 1.0.56**

**Next planned release: 1.0.57**

Key features:
- CRUD for customers, debts, payments
- Jatuh tempo hutang: field opsional `tanggal_jatuh_tempo` di setiap hutang; badge "Terlambat" (merah) atau "Segera JT" (kuning, ≤7 hari) di tabel hutang; field dibackup/restore
- Keuangan (income/expense) with auto-integration
- Stok barang with low-stock alerts and auto-keuangan
- Kasir (POS) with multi-item cart, receipt modal, auto-stok decrement, hapus transaksi kasir (void) via Riwayat Penjualan
- Laporan: tab Penjualan Kasir (harian/bulanan chart, top produk, export CSV/PDF), Hutang, Keuangan, Stok, Gaji & Upah (summary cards, rekap per pekerja, export CSV)
- Dashboard: kasir summary cards (hari ini & bulan ini), tren keuangan chart
- Gaji & Tenaga: profil pekerja permanen (nama/jabatan/telepon), catatan upah dengan cicilan (bayar sebagian), auto-integrasi ke Keuangan kategori "Gaji & Upah"; summary cards (total sisa upah, jumlah pekerja, catatan belum lunas); export CSV catatan upah; **kwitansi pembayaran upah** (cetak/PDF setelah bayar single maupun bayar batch, format A5 landscape)
- Backup/restore (v1.4 format includes kasir + pekerja/upah_pekerja/bayar_upah tables)
- Pengingat backup otomatis: banner kuning muncul jika belum backup > 7 hari (localStorage-based)
- Auto-backup saat tutup aplikasi: salin file .db ke Documents/UsahakuBackup/, simpan 7 file terbaru (production/Electron only)
- Offline license key system (HMAC-SHA256, format BUKU-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX); tipe: 1bulan(30h)/3bulan(90h)/6bulan(180h)/1tahun(365h)
- Auto-update (electron-updater, GitHub releases) + manual check button + version display in sidebar
- Remote password reset via signed code (RST-XXXX-XXXX-XXXX-XXXX, 24-hour expiry, no auth required)
- "Lupa username?" — pelanggan bisa lihat daftar akun owner di halaman login
- Standalone HTML tools (offline): `license-generator.html` dan `password-reset-generator.html` di `artifacts/hutang-app/public/`
- PelangganCombobox: searchable dropdown untuk pilih pelanggan di dialog tambah hutang & terima pembayaran

## Technical Debt (Status Terkini)

### TD-001 — TS4023: `sqliteRaw` export di `lib/db/src/index.ts` (Resolved di v1.0.56)
**File:** `lib/db/src/index.ts` baris 168
**Error:** `TS4023: Exported variable 'sqliteRaw' has or is using name 'BetterSqlite3.Database' from external module but cannot be named.`
**Dampak:** Karena `lib/db` gagal generate file `.d.ts`, semua file yang import dari `@workspace/db` mendapat error TS6305 (cascade), dan callback di beberapa route mendapat TS7006 (implicit any). Total muncul ~127 error saat `tsc --noEmit`.
**Tidak menyebabkan crash** — runtime pakai esbuild (baca source langsung, tidak butuh `.d.ts`). Tapi TypeScript tidak bisa jaga tipe di area-area yang pakai `sqliteRaw`.
**Fix (1 baris) sudah diterapkan:**
```ts
// Ubah dari:
export const sqliteRaw = sqlite;
// Jadi:
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const sqliteRaw: any = sqlite;
```
**Penyebab root:** `better-sqlite3` di-import sebagai `import type` (bukan value import) karena Electron butuh dynamic require — sehingga tipe `BetterSqlite3.Database` tidak bisa ditulis ke file `.d.ts`.

---

## Riwayat Perubahan Terbaru (v1.0.21 – v1.0.56)

### v1.0.56 — Bundle Stabilitas Rilis dan Keamanan
**Isi rilis:**
- Ringkasan keuangan atas diperbaiki agar tetap akumulasi semua waktu saat ganti bulan.
- Pipeline release dioptimasi (hapus build duplikat, install lockfile ketat `--frozen-lockfile`).
- Quality gate ditambahkan sebelum packaging (`typecheck`, build backend, build frontend).
- Secret policy production diperketat: warning saat fallback secret dipakai, dengan opsi fail via `STRICT_SECRET_POLICY=fail`.
- Template catatan release dirapikan (manual + generate release notes).

### v1.0.54 — Fix Ringkasan Keuangan Tetap Tampil Saat Ganti Bulan
**Bug:** Kartu ringkasan paling atas di tab Keuangan (Total Masuk, Total Keluar, Saldo) ikut filter bulan/tahun, sehingga saat pindah ke bulan yang belum ada transaksi nilainya terlihat hilang/0.
**Fix:** Ringkasan atas sekarang mengambil data akumulasi semua waktu (tanpa filter bulan), sementara tabel transaksi, grafik, rincian kategori, export CSV, dan cetak tetap mengikuti filter periode.
- Frontend: tambah query `keuangan-rekap-total` dan invalidasi cache-nya setelah tambah/edit/hapus transaksi.
- File: `artifacts/hutang-app/src/pages/keuangan.tsx`

### v1.0.53 — Fix Backup JSON: keuangan_id Hutang Tidak Ter-restore
**Bug:** Setelah restore JSON, hapus hutang tidak ikut hapus entri keuangan "uang keluar" yang terkait — karena `keuangan_id` di tabel hutang tidak diekspor maupun di-restore dalam backup JSON.
**Root cause:** 2 tempat yang luput saat fitur integrasi hutang↔keuangan ditambahkan di v1.0.51:
1. **Export** — field `keuangan_id` tidak disertakan di map hutang → nilai hilang dari file backup JSON
2. **Restore** — INSERT hutang tidak menyertakan kolom `keuangan_id` dan tidak melakukan ID remapping → hutang yang di-restore selalu punya `keuangan_id = NULL`
**Fix:**
- Export: tambah `keuangan_id: h.keuanganId ?? null` ke map hutang
- Restore: UPDATE SQL INSERT hutang sertakan kolom `keuangan_id`, remap via `keuanganIdMap` (sama seperti pola pembayaran, stok, kasir)
- Versi format backup dinaikkan `"1.4"` → `"1.5"`
- Kompatibel mundur: backup lama (tanpa `keuangan_id` di hutang) di-restore dengan `keuangan_id = NULL` (fallback aman)
- File: `artifacts/api-server/src/routes/backup.ts`

### v1.0.52 — Hotfix: Tambah Hutang Gagal 500 (Missing .all())
**Bug:** v1.0.51 selalu error HTTP 500 saat tambah hutang baru — crash karena `.returning()` tanpa `.all()` di dalam `db.transaction()` tidak mengeksekusi query, sehingga `keuangan` jadi `undefined` dan `keuangan.id` throw error.
**Fix:** Tambahkan `.all()` pada kedua `.returning()` di dalam transaction POST /hutang, mengikuti pola yang benar di codebase (seperti di `pembayaran.ts`).
- File: `artifacts/api-server/src/routes/hutang.ts`

### v1.0.51 — Integrasi Hutang ke Keuangan (Uang Keluar Otomatis)
**Fix krusial:** Saat tambah catatan hutang baru, sistem kini otomatis membuat entri keuangan **uang keluar** — sehingga laporan keuangan mencerminkan uang/barang yang sudah dikeluarkan.
- **Tambah hutang** → otomatis buat entri keuangan `tipe: "keluar"`, `kategori: "Hutang"`, keterangan `"Hutang - [Nama Pelanggan]"` (atau dengan catatan jika ada), dalam satu DB transaction
- **Edit nominal/keterangan/tanggal hutang** → entri keuangan terkait ikut diperbarui secara otomatis
- **Hapus hutang** → entri keuangan uang keluar (dari pembuatan hutang) ikut terhapus bersama entri pembayaran yang sudah ada
- **Database migration:** `ALTER TABLE hutang ADD COLUMN keuangan_id INTEGER` — kolom baru untuk menyimpan referensi ke keuangan
- **Schema:** tambah field `keuanganId` di `hutangTable` (Drizzle)
- Alur kini simetris: hutang baru = uang keluar, bayar hutang = uang masuk
- Files: `lib/db/src/schema/hutang.ts`, `lib/db/src/index.ts`, `artifacts/api-server/src/routes/hutang.ts`

### v1.0.50 — Perbaikan Halaman Profil Pengguna
**Fix:**
- Avatar menampilkan **inisial huruf pertama** nama pengguna (bukan ikon generik `UserCircle`)
- Label "ID Usaha Terhubung" berubah jadi "Usaha Terhubung" dengan **nilai nama usaha** (contoh: "Toko Sumber Makmur Jaya"), bukan nomor ID mentah `#1`
- Fallback: tampilkan "Memuat..." saat query belum selesai, kembali ke `#ID` jika query gagal
- File: `artifacts/hutang-app/src/pages/profil.tsx`

### v1.0.49 — Kwitansi Pembayaran Upah
**Fitur:** Cetak kwitansi/receipt setelah bayar upah (single maupun batch), format A5 landscape.
- Dialog "Cetak Kwitansi?" muncul setelah pembayaran berhasil; user bisa cetak atau tutup
- Electron: buka via `openInBrowser`, browser biasa: blob URL dengan `window.print()` auto-trigger
- HTML tergenerate inline (`buildKwitansiUpahHtml`) dengan CSS embedded: nama usaha, data pekerja, nominal, tanggal, keterangan
- Ukuran cetak: `body { width: 182mm }`, font 9–12pt agar pas A5 landscape
- Pattern: `pendingKwitansiRef` (useRef) menjembatani data form dari submit handler ke `onSuccess` mutation callback
- File: `artifacts/hutang-app/src/pages/gaji-tenaga.tsx`

### v1.0.48 — 4 Perbaikan Serentak
1. **Fix aria-describedby** — `aria-describedby={undefined}` ditambahkan ke setiap `<DialogContent>` (bukan AlertDialog) di 10 file halaman; menghilangkan warning aksesibilitas di konsol browser
2. **Summary Cards Gaji & Tenaga** — 3 kartu ringkasan di atas tab: Total Sisa Upah (merah), Jumlah Pekerja, Catatan Belum Lunas; menggunakan data dari query yang sudah ada
3. **Export CSV Catatan Upah** — tombol "Export CSV" di tab Catatan Upah; export `filteredUpah` (mengikuti filter/search aktif); kolom: No, Pekerja, Jabatan, Keterangan, Tanggal Kerja, Total Upah, Sudah Dibayar, Sisa, Status, Catatan
4. **Tab Gaji & Upah di Laporan** — tab baru (setelah Stok Barang): summary cards 3 item, rekap per-pekerja (tabel), semua catatan upah (tabel), export CSV

### v1.0.47 — Bayar Batch Upah
**Fitur:** Pembayaran upah massal untuk 1 pekerja (FIFO distribution) dari tab Daftar Pekerja.
- **Backend:** `POST /api/pekerja/:id/bayar-batch` — validasi, distribusi FIFO (terlama duluan), 1 entri Keuangan, N entri `bayar_upah`, semua dalam 1 DB transaction
- **Zod types:** `BayarBatchUpahParams` + `BayarBatchUpahBody` di `lib/api-zod`
- **API schemas:** `BayarBatchUpahBody` + `BayarBatchUpahResponse` di `api.schemas.ts`
- **Client hook:** `bayarBatchUpah()` + `useBayarBatchUpah()` di `api-client-react`
- **Frontend (Daftar Pekerja table):** Kolom "Sisa Upah" baru (merah jika ada sisa, "Lunas" jika 0), tombol "Bayar" per baris (disabled jika lunas)
- **Dialog Bayar Batch:** Preview distribusi FIFO live saat nominal diubah, input jumlah + tanggal + catatan opsional
- **Computed:** `sisaPerPekerja` (Map) dan `batchUpahList` via `useMemo` dari `allUpahList` (unfiltered query)
- **Bugfix:** `Cache-Control: no-store` ditambahkan ke semua `/api` response di Express (`app.ts`) — mencegah browser HTTP cache mengembalikan data lama (304 Not Modified) setelah mutation, sehingga list selalu langsung diperbarui
- **Bugfix:** Backend harus di-build ulang (`pnpm run build`) sebelum restart agar route baru aktif (dist-based server)
- **Bugfix:** `DELETE /bayar-upah/:id` — jika bayar_upah adalah bagian dari batch payment (berbagi `keuangan_id` dengan bayar_upah lain), sekarang keuangan hanya dikurangi nominalnya, bukan dihapus seluruhnya; keuangan baru dihapus jika ini satu-satunya bayar yang tersisa untuk keuangan tersebut

### v1.0.46 — Fitur Gaji & Tenaga
**Fitur:** Modul manajemen upah/gaji tenaga kerja, mirip pola hutang/pembayaran.
- **Database:** 3 tabel baru: `pekerja`, `upah_pekerja`, `bayar_upah` (migrasi inline di `lib/db/src/index.ts`)
- **Drizzle schema:** `lib/db/src/schema/pekerja.ts` + `lib/db/src/schema/upah.ts` (field `pekerjaid` mapping ke kolom `pekerja_id`)
- **API types:** `lib/api-zod/src/generated/api.ts` + `lib/api-client-react/src/generated/api.schemas.ts` — Pekerja, UpahPekerja, UpahDetail, BayarUpahItem, CreatePekerjaBody, UpdatePekerjaBody, CreateUpahBody, UpdateUpahBody, CreateBayarUpahBody, GetUpahListParams, UpahStatus
- **Backend:** `artifacts/api-server/src/routes/pekerja.ts` + `upah.ts`; POST /upah/:id/bayar auto-create Keuangan "Gaji & Upah" (tipe keluar); DELETE bayar juga hapus Keuangan terkait
- **Hooks:** `lib/api-client-react/src/generated/api.ts` — useGetPekerjaList, useCreatePekerja, useUpdatePekerja, useDeletePekerja, useGetUpahList, useCreateUpah, useGetUpah, useUpdateUpah, useDeleteUpah, useBayarUpah, useDeleteBayarUpah + semua query keys
- **Backup:** Format v1.4 — export + restore mencakup pekerja, upah_pekerja, bayar_upah dengan ID remapping
- **Frontend:** Halaman `/gaji-tenaga` (Tab "Catatan Upah" + Tab "Daftar Pekerja"), menu sidebar "Gaji & Tenaga" di grup BISNIS (ikon HardHat)
- **Cicilan:** Bayar sebagian didukung — satu upah bisa punya banyak bayar_upah, status auto "lunas"/"belum_lunas"

### v1.0.45 — Fitur Jatuh Tempo Hutang
**Fitur:** Field opsional `tanggal_jatuh_tempo` ditambahkan ke tabel hutang.
- **Database:** `ALTER TABLE hutang ADD COLUMN tanggal_jatuh_tempo TEXT` (migrasi inline di `lib/db/src/index.ts`)
- **Drizzle schema:** `lib/db/src/schema/hutang.ts` — field `tanggalJatuhTempo`
- **API types:** `lib/api-zod/` + `lib/api-client-react/` — field `tanggal_jatuh_tempo?: string | null` di Hutang, HutangDetail, CreateHutangBody, UpdateHutangBody
- **Backend route:** `formatHutang()`, POST insert, PUT update — semua tangani `tanggalJatuhTempo`
- **Backup:** Export + restore mencakup `tanggal_jatuh_tempo` (format backup v1.3 tetap kompatibel)
- **Frontend:** Form tambah/edit hutang punya field "Jatuh Tempo (Opsional)"; tabel hutang punya kolom "Jatuh Tempo" dengan badge "Terlambat" (merah) jika sudah lewat, atau "Segera JT" (kuning) jika ≤7 hari lagi

### v1.0.44 — Fix Backup: Field `diskon` & `keuangan_id` Kasir Tidak Ter-export
**Masalah:** Field `diskon` dan `keuangan_id` di tabel `transaksi_kasir` ada di schema DB tapi tidak disertakan di backup JSON (export/restore). Restore dari backup lama mengabaikan nilai diskon transaksi kasir.
**Fix:**
- Export: tambah `diskon` dan `keuangan_id` ke map `transaksi_kasir` di `backup.ts`
- Restore: UPDATE query INSERT kasir untuk sertakan `diskon` dan `keuangan_id` (dengan ID remapping ke keuangan baru), fallback `diskon ?? 0` untuk kompatibilitas backup lama (v1.2)
- Versi format backup dinaikkan dari `"1.2"` → `"1.3"`
- File: `artifacts/api-server/src/routes/backup.ts`

### v1.0.43 — Fix Badge Jumlah Item Kasir Terpotong
**Masalah:** Badge angka jumlah item di pojok kanan atas kartu produk terpotong karena posisi `-top-2 -right-2` (di luar batas kartu) diclip oleh `overflow:hidden` milik Card.
**Fix:** Ubah posisi badge ke `top-2 right-2` (di dalam batas kartu). Angka sekarang tampil utuh.
**Catatan versi:** v1.0.42 tag di GitHub menunjuk ke commit sebelum fix ini, sehingga bump ke v1.0.43 diperlukan agar fix masuk ke build.
- File: `artifacts/hutang-app/src/pages/kasir.tsx`

### v1.0.42 — Redesign UI Halaman Kasir
**Alasan versi baru:** v1.0.41 sudah ter-release di GitHub dengan konten lama (sebelum perubahan UI). Daripada hapus + force-push tag (berbahaya, auto-updater tidak akan detect sebagai versi baru), lebih aman bump ke v1.0.42.
**Perubahan UI Kasir:**
- "Riwayat Penjualan" dipindah dari kolom ketiga yang aneh ke **Dialog** — dibuka via tombol "Riwayat" di sebelah kolom pencarian. Layout utama kini 2 kolom bersih: produk (kiri) + keranjang (kanan).
- Kartu produk lebih rapi: nama 2 baris penuh (tidak terpotong tiba-tiba), harga lebih menonjol (lebih besar), stok dengan angka tebal, kartu yang masuk keranjang punya border hijau + background hijau tipis + badge pojok.
- Keranjang: total lebih besar (text-2xl), tombol Selesaikan Transaksi lebih tinggi, kembalian/kurang dengan highlight warna lebih tegas.
- File: `artifacts/hutang-app/src/pages/kasir.tsx`

### v1.0.41 — Penguatan Keamanan Backup/Restore .db
**Masalah yang diperbaiki:**
1. **Delay terlalu pendek (600ms)** — di PC Windows lambat, backend belum melepas file lock saat `copyFileSync` dijalankan → restore gagal dengan EPERM/EBUSY. Fix: naikkan ke 1500ms.
2. **Tidak ada retry saat copy gagal** — satu kali gagal langsung error. Fix: tambah `copyFileWithRetry` (3 percobaan, jeda 600ms antar percobaan).
3. **Tidak ada verifikasi integritas setelah restore** — DB bisa ter-copy tapi rusak, baru ketahuan saat user pakai. Fix: tambah endpoint `POST /api/internal/db-integrity` (PRAGMA integrity_check) — dipanggil setelah backend start, sebelum reload window. Jika gagal, otomatis rollback ke data sebelumnya.
4. **Auto-backup tidak validasi file hasil copy** — backup tersimpan tapi mungkin corrupt tanpa peringatan. Fix: setelah `copyFileSync`, jalankan `validateBackupDbFile` — jika tidak valid, hapus file corrupt dan log peringatan.
- File: `artifacts/electron-app/src/main.ts`, `artifacts/api-server/src/routes/health.ts`

### v1.0.40 — Re-release: Restore JSON Selalu Gagal (v1.0.39 dibuild sebelum fix di-push)
**Masalah:** v1.0.39 dibuild dan di-tag di GitHub SEBELUM fix backup.ts di-push ke repo, sehingga binary yang ter-release masih berisi kode lama `db.transaction(async ...)`. v1.0.40 adalah re-release dengan kode yang sudah benar.
**Isi fix (sama dengan v1.0.39):** `sqliteRaw.transaction()` sinkron, error dialog besar, threshold 8 KB.

### v1.0.39 — Fix Bug: Restore JSON Selalu Gagal (Transaction function cannot return a promise)
**Root cause:** `db.transaction(async (tx) => { await ... })` tidak valid di Drizzle + better-sqlite3. better-sqlite3 bersifat SINKRON; Drizzle mendeteksi callback async (returns Promise) dan throw error "Transaction function cannot return a promise". Bug ini menyebabkan restore JSON **selalu gagal** sejak fitur pertama dibuat.
**Fix:** Ganti seluruh restore route (`POST /backup/restore`) dari `await db.transaction(async ...)` ke `sqliteRaw.transaction(() => { ... })` — native better-sqlite3 transaction yang sinkron. Menggunakan `.prepare().run()` dan `r.lastInsertRowid` untuk mendapat ID baru.
**Perubahan lain di v1.0.39:**
- Error dialog restore JSON: dari toast kecil ke AlertDialog besar dengan teks error lengkap (scrollable), sehingga mudah dibaca/di-screenshot
- Threshold validasi ukuran backup diturunkan dari 20 KB ke 8 KB (20 KB terlalu tinggi — bisa tolak DB valid yang datanya sedikit)
- File: `artifacts/api-server/src/routes/backup.ts`, `artifacts/hutang-app/src/pages/backup.tsx`

### v1.0.38 — Fix Kritis: Restore Data Tidak Berubah + Backup Tidak Lengkap (SQLite WAL)
**Fix 1 — Restore tidak berubah:**
- Bug kritis: setelah restore (lokal maupun Google Drive), data tidak berubah — tampak seperti restore tidak berjalan
- Penyebab: SQLite WAL mode menyimpan transaksi terbaru di file `.db-wal` dan `.db-shm`. Saat restore mengganti file `.db`, kedua file WAL lama masih ada. Ketika backend restart, SQLite menerapkan WAL lama ke DB yang baru di-restore sehingga data lama "balik lagi"
- Fix: hapus file `.db-wal` dan `.db-shm` setelah backend dimatikan dan sebelum DB di-replace di fungsi `performRestoreFromFile`
- Bug ini mempengaruhi SEMUA jenis restore: lokal (.db), maupun dari Google Drive
- File: `artifacts/electron-app/src/main.ts` (fungsi `performRestoreFromFile`)

**Fix 2 — Backup Google Drive bisa tidak lengkap:**
- Bug tersembunyi: backup Google Drive membaca file `.db` mentah secara langsung. Data terbaru yang belum di-flush dari `.db-wal` ke `.db` tidak ikut ter-backup
- Fix: tambahkan WAL checkpoint (`PRAGMA wal_checkpoint(TRUNCATE)`) via HTTP ke backend sebelum backup, memastikan semua data sudah di file `.db` sebelum dibaca
- Tambah endpoint internal `POST /api/internal/wal-checkpoint` di backend (tidak perlu auth, hanya localhost)
- Export `sqliteRaw` dari `lib/db/src/index.ts` untuk akses raw better-sqlite3 instance
- File: `artifacts/api-server/src/routes/health.ts`, `lib/db/src/index.ts`, `artifacts/electron-app/src/main.ts` (fungsi `walCheckpoint` + `uploadBackupToDrive`)

**Fix 3 — Backup lokal saat tutup aplikasi juga bisa tidak lengkap:**
- Bug tersembunyi: alur lama = kill backend → tunggu 400ms → copy `.db`. WAL flush saat SIGTERM tidak dijamin 100%
- Fix: ubah urutan menjadi: checkpoint WAL (selagi backend masih hidup) → kill backend → tunggu 200ms → copy `.db`
- Urutan baru lebih aman karena WAL di-flush secara eksplisit via HTTP sebelum backend dimatikan
- File: `artifacts/electron-app/src/main.ts` (handler `mainWindow.on("close")`)

**Fix 4 — Restore dari file backup kosong (DB belum disetup):**
- Bug lapangan: restore dari file `.db` yang ternyata kosong/belum ada data → aplikasi tampil halaman setup dari awal
- Penyebab 1: file backup yang terbentuk di sesi pertama install (sebelum ada data) ikut tersimpan sebagai kandidat restore
- Penyebab 2: `staleTime: 5 menit` di query `setup-status` → setelah reload, frontend pakai cache lama yang bilang `needsSetup: true`
- Fix 1: validasi file backup sebelum restore — cek magic bytes SQLite + ukuran file minimum 8 KB (DB kosong tanpa schema hanya ~4 KB = 1 page SQLite)
- Fix 2: `staleTime: 0` dan `gcTime: 0` pada query `setup-status` → selalu fetch ulang saat reload
- File: `artifacts/electron-app/src/main.ts` (fungsi `validateBackupDbFile`), `artifacts/hutang-app/src/hooks/use-auth.tsx`

### v1.0.37 — Interval Auto-Backup Google Drive: 60 Menit → 15 Menit
- Interval backup otomatis dipercepat dari 60 menit menjadi 15 menit
- Alasan: 60 menit terlalu berisiko untuk data hutang/transaksi bisnis kecil — kehilangan data maksimal kini hanya 15 menit
- File: `artifacts/electron-app/src/main.ts` (fungsi `scheduleGDriveAutoBackup`)

### v1.0.36 — Fix Auto-Backup Google Drive Selalu Dilewati
- Bug fix: pengecekan mtime file `.db` untuk deteksi "data berubah" tidak bekerja karena SQLite menulis ke file `-wal` terlebih dahulu — mtime file `.db` utama tidak berubah meski ada data baru
- Solusi: hapus pengecekan mtime, backup berjalan setiap 60 menit tanpa kondisi tambahan (selama online dan sudah connect)
- File: `artifacts/electron-app/src/main.ts` (fungsi `tryGDriveAutoBackup`)

### v1.0.35 — Fix Auto-Backup Google Drive Setelah Connect
- Bug fix: backup otomatis pertama berjalan 45 detik setelah app dibuka — jika user belum connect Google Drive saat itu, backup dilewati dan baru coba lagi 60 menit kemudian
- Sekarang: setelah `gdrive:connect` berhasil, backup otomatis langsung dipicu dalam 5 detik
- File: `artifacts/electron-app/src/main.ts` (handler `gdrive:connect`)

### v1.0.34 — Fix Credentials Google Drive (Baked-In ke Binary)
- Perbaikan: credentials `GDRIVE_CLIENT_ID` dan `GDRIVE_CLIENT_SECRET` sebelumnya hanya dibaca dari `process.env` saat runtime (tidak tersedia di .exe hasil build) — sekarang di-inject langsung ke binary saat kompilasi
- Ditambahkan `scripts/inject-credentials.js`: membaca env vars dan menulis `src/credentials.ts` sebelum `tsc` berjalan
- `main.ts` sekarang import dari `./credentials` (bukan `process.env`) — nilai tertanam permanen di binary
- `build:main` script diupdate: `node scripts/inject-credentials.js && tsc -p tsconfig.json`
- `src/credentials.ts` ditambahkan ke `.gitignore` (tidak ikut commit ke repo publik)
- GitHub Actions workflow sudah meneruskan `GDRIVE_CLIENT_ID` dan `GDRIVE_CLIENT_SECRET` dari GitHub Secrets ke step build
- Fix: `GDRIVE_CLIENT_ID` di Replit Secrets sebelumnya mengandung prefix `http://` yang salah — sudah dikoreksi
- **Google Cloud Console**: OAuth consent screen di-publish ke "In production" (bukan Testing) agar semua user bisa connect tanpa perlu didaftarkan satu-satu sebagai test user. User akan melihat peringatan "unverified app" dan bisa bypass lewat Advanced → "Go to usahaku (unsafe)"
- Scope `drive.file` tidak memerlukan verifikasi penuh dari Google untuk dipublish — cukup publish consent screen
- Files: `artifacts/electron-app/scripts/inject-credentials.js`, `artifacts/electron-app/src/main.ts`, `artifacts/electron-app/package.json`, `artifacts/electron-app/.gitignore`

### v1.0.33 — Backup Google Drive (Infrastruktur)
- Ditambahkan fitur backup otomatis ke Google Drive (Electron only)
- OAuth2 flow tanpa package tambahan — pakai `https` + `http` bawaan Node.js + Electron `safeStorage` untuk enkripsi token
- Token disimpan terenkripsi di `userData/gdrive-tokens.dat` (via `safeStorage`, fallback plain jika tidak tersedia)
- Auto-backup berjalan 45 detik setelah app siap, lalu setiap 60 menit — hanya jika ada internet + data berubah
- Upload multipart ke Drive, folder "Usahaku Backup", simpan max 7 file terbaru (hapus yang lebih lama otomatis)
- IPC handlers: `gdrive:getStatus`, `gdrive:connect`, `gdrive:disconnect`, `gdrive:backupNow`, `gdrive:listBackups`, `gdrive:restoreFromDrive`
- Renderer event: `gdrive:backupDone` (dikirim ke frontend setiap backup selesai)
- UI di halaman Backup: kartu Google Drive dengan status, email, waktu backup terakhir, daftar file, tombol Backup Sekarang & Pulihkan
- Fungsi restore DB di-refactor jadi `performRestoreFromFile(sourcePath)` — dipakai bersama oleh restore lokal dan restore dari Drive
- **Bug fix (OAuth)**: Handler OAuth server lokal sekarang mengabaikan request `/favicon.ico` & request duplikat dari browser — pakai flag `settled` agar `resolve` hanya dipanggil sekali
- **Bug fix (token expired)**: Jika refresh token dicabut user dari Google (invalid_grant), token lokal otomatis dihapus dan muncul pesan "Hubungkan ulang" — sebelumnya app diam tanpa info
- GitHub Actions build workflow diupdate: `GDRIVE_CLIENT_ID` dan `GDRIVE_CLIENT_SECRET` sekarang diteruskan ke step build `.exe` dari GitHub Secrets
- **PENTING**: Credentials (`GDRIVE_CLIENT_ID`, `GDRIVE_CLIENT_SECRET`) dibaca dari env var. Harus di-set sebagai GitHub Secrets sebelum build. Tanpa credentials, fitur tampil tapi muncul pesan "Belum Dikonfigurasi"
- Files: `artifacts/electron-app/src/main.ts`, `artifacts/electron-app/src/preload.ts`, `artifacts/hutang-app/src/types/electron.d.ts`, `artifacts/hutang-app/src/pages/backup.tsx`, `.github/workflows/build-release.yml`

### v1.0.32 — Paket & Harga Lisensi di Halaman Lisensi + Fix Keamanan Batch
- Ditambahkan section "Paket & Harga Lisensi" di halaman Lisensi (bawah kartu aktivasi key)
- Menampilkan 4 paket: 1 Bulan (Rp19.900), 3 Bulan (Rp54.900), 6 Bulan (Rp99.000), 1 Tahun (Rp179.000)
- Paket 3 Bulan ditandai badge "Populer"
- Keterangan harga dapat berubah sewaktu-waktu
- Tombol "Hubungi Admin via WhatsApp" langsung buka WA ke 082397803813 dengan pesan otomatis (di Electron otomatis buka browser sistem via `shell.openExternal`)
- **Fix keamanan backend**: tambah validasi di `POST /pembayaran/batch` — semua hutang_ids harus milik pelanggan yang sama, tolak dengan 400 jika tidak
- **Fix kode frontend**: hapus parameter `sisaHutang` yang tidak terpakai dari fungsi `toggleHutang` di `pembayaran.tsx`
- File: `artifacts/hutang-app/src/pages/lisensi.tsx`, `artifacts/api-server/src/routes/pembayaran.ts`, `artifacts/hutang-app/src/pages/pembayaran.tsx`

### v1.0.31 — Multi-Pilih Nota Hutang saat Terima Pembayaran
- Dialog "Terima Pembayaran" sekarang menggunakan **checkbox list** (bukan dropdown tunggal) — user bisa pilih lebih dari 1 nota hutang sekaligus
- Ada tombol **"Pilih Semua"** untuk centang semua nota hutang aktif pelanggan sekaligus
- Nominal bayar otomatis terisi total sisa dari nota yang dipilih, tapi bisa dikurangi
- **Preview distribusi realtime**: setiap kali nominal diubah, langsung tampil hutang mana yang kena berapa (sistem FIFO — hutang terlama didahulukan)
- **Kwitansi gabungan**: 1 kwitansi berisi semua nota hutang yang dibayar dalam 1 transaksi
- Backend: endpoint baru `POST /api/pembayaran/batch` yang memproses semua pembayaran dalam 1 database transaction (atomik)
- Hapus pembayaran tetap per baris (tidak berubah)



### v1.0.30 — Bug Fix: Fallback Keuangan untuk Transaksi Kasir Lama
- Hapus kasir untuk transaksi lama (keuangan_id = NULL, sebelum v1.0.29): sekarang ada fallback aman — cari keuangan via tanggal+jumlah+kategori, hapus HANYA jika tepat 1 match (tidak ada risiko hapus keuangan transaksi orang lain)
- Kalau match > 1 (2 transaksi total sama di hari yang sama): keuangan tidak auto-hapus → user hapus manual dari halaman Keuangan

### v1.0.29 — Bug Fix: Kasir Delete, Cache Invalidation
- **Bug fix (penting)**: Hapus kasir sebelumnya mencocokkan keuangan dengan tanggal+total yang tidak unik → bisa hapus keuangan transaksi lain. Sekarang `transaksi_kasir` menyimpan `keuangan_id` langsung (migration + schema update), hapus kasir pakai ID persis.
- **Bug fix**: `selesaikanMutation` sekarang juga invalidate `kasir-riwayat`, semua laporan kasir, dan `keuangan-rekap` agar semua halaman langsung sinkron setelah transaksi baru
- **Bug fix**: `hapusMutation` sekarang juga invalidate `laporan-kasir-bulanan`, `keuangan`, `keuangan-rekap`
- Migration DB: `ALTER TABLE transaksi_kasir ADD COLUMN keuangan_id INTEGER`

### v1.0.28 — Hapus Transaksi Kasir (Void)
- Ditambahkan `DELETE /api/kasir/transaksi/:id` di backend: hapus transaksi kasir beserta item, keuangan, transaksi_stok terkait; restore stok jika barang masih ada — semua atomic dalam satu transaction
- Ditambahkan section "Riwayat Penjualan (50 terakhir)" di halaman Kasir — collapsible, tampilkan tabel transaksi dengan tombol hapus
- Konfirmasi AlertDialog sebelum hapus
- Setelah hapus: invalidate cache laporan kasir (ringkasan, harian, top produk) + barang list

### v1.0.27 — PelangganCombobox: Pencarian Pelanggan di Hutang & Pembayaran
- Dibuat komponen `PelangganCombobox` (`artifacts/hutang-app/src/components/pelanggan-combobox.tsx`) menggunakan Popover + Command (shadcn/ui pattern) — bisa search/filter nama pelanggan secara real-time
- Diintegrasikan di `pembayaran.tsx` (Step 1 "Pilih Pelanggan" di dialog Terima Pembayaran)
- Diintegrasikan di `hutang.tsx` (field Pelanggan di dialog tambah hutang baru)
- Props: `value: number|null`, `onValueChange: (id: number|null) => void`, `pelangganList?: Pelanggan[]`, `placeholder?`, `disabled?`, `className?`

### v1.0.21 — Brute Force & License Enforcement
**Brute force login (per-username → lanjut ke v1.0.22):**
- Sebelumnya hanya melacak percobaan gagal untuk username yang ADA di DB. Username yang tidak ada tidak terlindungi.
- Ditambahkan `memStore` (Map) untuk semua username (ada maupun tidak ada): 5 percobaan gagal → dikunci 15 menit dengan countdown.

**License enforcement — frontend button disable:**
- Dibuat `LicenseContext` di `artifacts/hutang-app/src/context/license-context.tsx`
- `Layout.tsx` menyediakan context `lisensiAktif` + `jamDimanipulasi` via `LicenseContext.Provider`
- Semua tombol write (tambah/edit/hapus) di semua halaman dinonaktifkan saat `lisensiAktif = false`:
  - `pelanggan.tsx`, `hutang.tsx`, `pembayaran.tsx`, `keuangan.tsx`, `stok.tsx`, `kasir.tsx`
- **Backend**: `requireLicense` middleware di `auth.ts` cek `lastSeenDate` — jika `today < lastSeenDate` (v1.0.21) → 403 JAM_DIMANIPULASI, blokir semua write API

### v1.0.22 — Brute Force Per-Device & License Context Fix
**Brute force diperbaiki lagi — per-device (bukan per-username):**
- Masalah: dikunci username "abc" → ganti ke username benar → bisa masuk bebas
- Fix: `deviceStore` (Map keyed by IP/remoteAddress) melacak SEMUA percobaan gagal dari satu perangkat
- Setelah 5 percobaan gagal (username apapun) → perangkat dikunci 15 menit
- Login berhasil → reset device counter
- Kode di: `artifacts/api-server/src/routes/auth.ts`

**License context fix:**
- `lisensiAktif` sekarang juga `false` jika `jam_dimanipulasi: true`
- `staleTime` dikurangi 5 menit → 1 menit, `refetchOnWindowFocus: true`, `refetchInterval: 2 menit`

### v1.0.23 — Banner "Cek Ulang" & Cache Fix
**Masalah:** Setelah tanggal dikembalikan ke benar, license masih muncul tidak aktif karena cache React Query belum expired.
- Ditambahkan tombol **"Cek Ulang"** di banner "Lisensi tidak aktif" → langsung `invalidateQueries(["lisensi-status"])`
- Pesan banner berubah jadi spesifik: "Tanggal sistem terdeteksi dimundurkan. Betulkan tanggal lalu klik Cek Ulang."
- `staleTime` dikurangi 1 menit → 10 detik, `refetchInterval` 2 menit → 1 menit

### v1.0.25 — Fix Cascade Delete Keuangan saat Pembayaran Dihapus
**Masalah:** Saat pembayaran dihapus, entri keuangan "Pelunasan Hutang" tidak ikut terhapus jika `keuanganId` null (terjadi pada data lama sebelum kolom `keuangan_id` ditambahkan).
- **Fix:** Tambahkan fallback di `DELETE /pembayaran/:id`: jika `keuanganId` null, cari keuangan berdasarkan `tanggal + jumlah + kategori "Pelunasan Hutang" + tipe "masuk"` — hanya hapus jika ditemukan **tepat 1 data** (aman, tidak salah hapus)
- File: `artifacts/api-server/src/routes/pembayaran.ts`

### v1.0.26 — Fix Cascade Delete Keuangan saat Hutang Dihapus
**Masalah (lebih besar dari v1.0.25):** Saat hutang dihapus, pembayaran-pembayarannya ikut dihapus — TAPI entri keuangan dari setiap pembayaran tersebut **tidak ikut terhapus** (jadi orphan/data mengambang).
- **Fix:** Route `DELETE /hutang/:id` sekarang: (1) ambil semua pembayaran terkait + `keuanganId`-nya, (2) hapus semua keuangan terkait, (3) hapus pembayaran, (4) hapus hutang — semua dalam satu transaction atomik
- File: `artifacts/api-server/src/routes/hutang.ts`

**Frontend fix:** Setelah hapus hutang, query keuangan dan dashboard sekarang ikut di-invalidate agar tampilan langsung refresh
- File: `artifacts/hutang-app/src/pages/hutang.tsx`

### v1.0.24 — Toleransi 1 Hari Deteksi Manipulasi Jam
**Masalah:** `lastSeenDate` bisa "terkontaminasi" jika sistem pernah berjalan di tanggal besok (e.g., April 14). Saat dikembalikan ke tanggal asli (April 13), dianggap manipulasi karena `"2026-04-13" < "2026-04-14"`.
- **Fix:** Toleransi 1 hari — hanya flag manipulasi jika mundur **lebih dari 1 hari**
- Rumus: `selisihHari = (lastSeenDate - today) / 1 hari`. Flag jika `selisihHari > 1`
- Toleransi ini juga mengatasi edge case timezone UTC vs WIB (bisa selisih 1 hari di string tanggal)
- Fix diterapkan di dua tempat: `artifacts/api-server/src/routes/lisensi.ts` + `artifacts/api-server/src/middlewares/auth.ts`

## Rencana Fitur ke Depan (Backlog)

Fitur-fitur di bawah ini sudah didiskusikan dan dikonfirmasi belum ada, dicatat untuk dikerjakan di sesi mendatang:

1. **Jatuh Tempo Hutang** — Tambah field tanggal jatuh tempo di nota hutang. Tampilkan indikator merah/kuning di daftar hutang untuk yang sudah/hampir jatuh tempo.

2. **Kirim Tagihan ke Pelanggan via WhatsApp** — Tombol di halaman detail pelanggan untuk kirim pesan WA otomatis berisi ringkasan sisa hutang pelanggan tersebut.

3. **Retur Barang di Kasir** — Alur pengembalian barang oleh pelanggan: stok otomatis naik kembali, ada catatan retur, keuangan ter-adjust.

4. **Hutang ke Pemasok / Supplier** — Pencatatan hutang toko ke pemasok (hutang usaha), terpisah dari piutang pelanggan yang sudah ada.

5. **Rekap / Tutup Kasir per Shift** — Fitur tutup shift kasir: ringkasan total transaksi, total uang masuk, dan saldo akhir per kasir/sesi.

6. **Target Omzet di Dashboard** — Owner bisa set target penjualan bulanan, dashboard tampilkan progress bar pencapaian target.

---

## Catatan Penting untuk Sesi Berikutnya

- **GitHub repo**: `https://github.com/ketanvpn/usahaku-app` (PUBLIC)
- **Auto-update**: GitHub Actions build `.exe` saat tag `vX.X.X` di-push. Workflow di `.github/workflows/`
- **Admin default**: username `admin`, password `maduTJ150` — seeded di setiap install (risiko yang diterima karena repo public)
- **License key format**: `BUKU-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX` (HMAC-SHA256)
- **Tier codes**: 1bulan=1, 3bulan=2, 6bulan=3, 1tahun=4
- **Generator tools** (offline HTML): `artifacts/hutang-app/public/license-generator.html` + `password-reset-generator.html`
- **User preference**: Selalu tampilkan perintah `git add`, `git commit`, `git push`, `git tag`, `git push --tags` setelah setiap perubahan
- **User preference**: JANGAN install npm package baru yang native (bisa merusak .exe build)
- **Database migrations**: Inline di `lib/db/src/index.ts` — kolom `failed_attempts`, `locked_until`, `last_seen_date` sudah ada

## User Preferences

The user wants the agent to focus on high-level architectural decisions and system design rather than granular implementation details or historical changes. The agent should prioritize stability and robust error handling, especially concerning native module integration and database operations in packaged environments. When making changes, ensure that existing data and functionalities remain compatible and that user experience is smooth, particularly during application startup and error scenarios.

- **Selalu ingatkan perintah git setelah setiap perubahan kode.** Di akhir setiap pekerjaan, selalu tampilkan perintah git lengkap yang harus dijalankan user di Shell Replit, contoh:
  ```
  git add -A
  git commit -m "feat: v1.0.XX — deskripsi singkat perubahan"
  git tag v1.0.XX
  git push origin main --tags
  ```
- Penjelasan dalam Bahasa Indonesia, pelan dan jelas.
- Hati-hati tidak merusak fitur yang sudah ada.

## System Architecture

The application is built as a pnpm workspace monorepo.

**Technology Stack:**
- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **TypeScript version**: 5.9
- **Package manager**: pnpm
- **API framework**: Express 5
- **Database**: SQLite (better-sqlite3) + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **Frontend**: React + Vite + Tailwind CSS
- **Auth**: Express session + bcryptjs

**Core Architectural Decisions:**
- **Roles**: Super Admin (global management) and Owner (business-specific operations).
- **Database**: Migrated from PostgreSQL to SQLite for self-contained, no-external-server deployment, especially for desktop. Uses WAL mode and PRAGMA foreign_keys. Database file `app.db` is automatically created.
- **Backend API**: Express 5 serves as the API framework. For desktop environments, it can also serve static frontend files.
- **Frontend**: React + Vite + Tailwind CSS provides a responsive user interface.
- **Desktop Packaging (Electron)**:
    - Dedicated `electron-app` package.
    - Uses `electron.utilityProcess.fork()` to spawn the backend within Electron's Node.js runtime.
    - Database path dynamically determined (`app.getPath('userData')` for desktop).
    - Frontend static files served by the Express backend in production desktop builds.
    - Security focused with `contextIsolation: true`, `nodeIntegration: false`, `sandbox: false` (required for utilityProcess).
    - Improved startup experience with loading screens and robust error logging for backend failures.
    - Native modules are handled carefully: see **Electron Packaging — Native Module Chain** below for full details.
    - `bcrypt` replaced with `bcryptjs` (pure JS, bundled by esbuild). Hash format compatible.
    - `better-sqlite3` added to `electron-app/dependencies`, rebuilt for Electron ABI by `npmRebuild: true`.
    - A custom `bindings-stub` at `assets/bindings-stub/` replaces the `bindings` package, avoiding pnpm virtual store issues with transitive deps.
- **Security & Hardening**:
    - `bcryptjs` for password hashing, compatible with `bcrypt` hashes.
    - Debt deletion is blocked if associated with active/lunas hutang.
    - User can change their password with current password verification.
    - Error messages are user-friendly and localized (Indonesian).
    - `SESSION_SECRET` is derived from `userData` path for uniqueness.
- **Data Integrity — Database Transactions**:
    - `POST /kasir/transaksi`: All writes (keuangan, stok update, transaksi_stok, transaksi_kasir, transaksi_kasir_item) wrapped in a single `db.transaction()`. Menyimpan `keuangan_id` di `transaksi_kasir` sejak v1.0.29.
    - `DELETE /kasir/transaksi/:id`: hapus kasir_item + kasir + keuangan + transaksi_stok + restore stok, atomik. Gunakan `keuangan_id` langsung (v1.0.29+); fallback fuzzy match (1 result only) untuk transaksi lama.
    - `POST /pembayaran`: keuangan insert + pembayaran insert + hutang update wrapped atomically.
    - `DELETE /pembayaran/:id`: hutang update + keuangan delete + pembayaran delete wrapped atomically. Fallback fuzzy match untuk keuangan lama (null keuangan_id).
    - `DELETE /hutang/:id`: collect semua keuangan dari pembayaran → hapus keuangan → hapus pembayaran → hapus hutang, satu transaction.
    - `POST /stok/masuk` & `POST /stok/keluar`: keuangan insert + transaksi_stok insert + barang stok update wrapped atomically.
    - `DELETE /stok/transaksi/:id`: keuangan delete + transaksi_stok delete + barang stok update wrapped atomically.

**Feature Specifications:**
- **Owner Pages**: Dashboard (summary), Customer List (CRUD, search, safe delete), Customer Detail (split active/lunas hutang, payment history), Debt List (filters), Debt Detail, Payment Recording, Reports (filters, CSV, PDF), Backup/Restore (with preview), Profile (change password, logout).
- **Super Admin Pages**: Global Dashboard, Business Management, Owner Account Management.
- **UI/UX**: Consistent icon support, clean default Electron menu, proper Windows taskbar grouping, human-readable error messages. Report section includes "Reset Filter" and active filter summary. Backup/Restore provides data count previews.

## External Dependencies

- `better-sqlite3`: SQLite database driver for Node.js.
- `drizzle-orm`: TypeScript ORM for SQLite.
- `zod`: Schema declaration and validation library.
- `drizzle-zod`: Integrates Drizzle ORM with Zod for schema validation.
- `orval`: Generates API hooks and Zod schemas from OpenAPI specifications.
- `esbuild`: Fast JavaScript bundler.
- `react`: Frontend UI library.
- `vite`: Next-generation frontend tooling.
- `tailwindcss`: CSS framework for rapid UI development.
- `express`: Web application framework for Node.js.
- `express-session`: Session management middleware for Express.
- `bcryptjs`: Pure JavaScript password hashing library.
- `electron`: Framework for building desktop applications with web technologies.
- `electron-builder`: A complete solution to package and build a ready for distribution Electron app.

## Electron Packaging — Native Module Chain

### Problem History & Fixes

**Fix 1: bcrypt → bcryptjs (Phase 7)**
`bcrypt` (native C++) was in esbuild's `external` list but not in `extraResources`.
Fix: replaced with `bcryptjs` (pure JS), removed from external list → now bundled in `dist/index.mjs`.

**Fix 2: better-sqlite3 ABI mismatch (Phase 8)**
Original `extraResources` copied from `api-server/node_modules/better-sqlite3` (Linux/regular Node ABI).
Fix: added `better-sqlite3` to `electron-app/package.json` dependencies → `npmRebuild: true` rebuilds it for Electron ABI → `extraResources` copies from `./node_modules/better-sqlite3` (rebuilt version).

**Fix 3: bindings not found (Phase 9)**  
`better-sqlite3/lib/database.js:48`: `require('bindings')('better_sqlite3.node')`.
pnpm virtual store keeps `bindings` and `file-uri-to-path` as sibling packages in `.pnpm/` virtual store, NOT symlinked to `electron-app/node_modules/`. `extraResources` copies only the package, not its siblings.
Fix: Created `assets/bindings-stub/index.js` — a minimal replacement for `bindings` that:
- Requires NO external dependencies (only Node.js built-ins)
- Finds `better_sqlite3.node` from `path.join(__dirname, '../better-sqlite3/build/Release/')`
- Also accepts `BETTER_SQLITE3_PATH` env var (for diagnostics)
- Copied to `resources/backend/node_modules/bindings/` via extraResources

### Final Structure in Packaged App
```
resources/
  backend/
    dist/
      index.mjs              ← esbuild bundle (bcryptjs bundled, better-sqlite3 external)
    node_modules/
      better-sqlite3/        ← copied from electron-app/node_modules (Electron ABI rebuilt)
        lib/database.js      ← requires 'bindings' → finds our stub
        build/Release/
          better_sqlite3.node  ← Windows native binary for Electron ABI
      bindings/              ← our bindings-stub (zero deps)
        index.js             ← resolves binary from ../better-sqlite3/build/Release/
  frontend/                  ← React static files
```

### Environment Variables (backend process)
- `DATABASE_PATH` — absolute path to SQLite database file
- `PORT` — HTTP port (8080)
- `SERVE_STATIC=true` + `STATIC_PATH` — serve frontend
- `SESSION_SECRET` — derived from userData path
- `BETTER_SQLITE3_PATH` — absolute path to better-sqlite3 package (for logging/fallback)

### Git Push ke GitHub (dari Replit)

GitHub sudah tidak mendukung login pakai password biasa. Harus pakai **Personal Access Token (PAT)**.

**Setup sekali (sudah dilakukan):**
```bash
git remote set-url origin https://TOKEN@github.com/ketanvpn/usahaku-app.git
```
Ganti `TOKEN` dengan PAT yang dibuat di [github.com/settings/tokens](https://github.com/settings/tokens) (centang scope `repo`).

**Setelah itu, format perintah push untuk setiap versi:**
```bash
git add -A
git commit -m "feat: v1.0.XX — deskripsi singkat perubahan"
git tag v1.0.XX
git push origin main --tags
```

> Catatan: Jika token expired atau dicabut, buat token baru dan jalankan `git remote set-url` lagi.

---

### Build Command (Windows)
```powershell
pnpm install                    # installs all deps including electron-app/better-sqlite3
cd artifacts/electron-app
pnpm run dist:win               # builds backend+frontend+electron, rebuilds native, packages
```

### Diagnostic Log (on startup failure)
`C:\Users\{name}\AppData\Roaming\Usahaku\\usahaku.log`
Key lines to check:
- `[native] better-sqlite3 exists: true/false`
- `[native] bindings stub exists: true/false`
- `[native] better_sqlite3.node exists: true/false`
- `[native] build/Release files: better_sqlite3.node` ← this file must exist
- `[backend:err] ...` ← backend error output
