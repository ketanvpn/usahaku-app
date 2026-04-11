# Usahaku by KetanTech

**Aplikasi Manajemen Bisnis Desktop untuk Usaha Kecil**

Usahaku membantu Anda mencatat hutang pelanggan, keuangan masuk/keluar, stok barang, dan laporan secara rapi — langsung di komputer Windows, tanpa internet, tanpa server, tanpa biaya langganan.

---

## Daftar Isi

- [Fitur Utama](#fitur-utama)
- [Akun Default](#akun-default)
- [Panduan Pengguna Windows](#panduan-pengguna-windows)
- [Panduan Build Windows (Langkah per Langkah)](#panduan-build-windows-langkah-per-langkah)
- [Panduan Developer](#panduan-developer)
- [Lokasi File Penting](#lokasi-file-penting)
- [Checklist Pengujian Final](#checklist-pengujian-final)
- [Troubleshooting](#troubleshooting-masalah-umum)

---

## Fitur Utama

| Fitur | Keterangan |
|-------|-----------|
| Catat Pelanggan | Tambah, edit, hapus data pelanggan |
| Catat Hutang | Nominal, tanggal, keterangan per pelanggan |
| Catat Pembayaran | Pembayaran sebagian maupun lunas |
| Kwitansi Otomatis | Kwitansi A5 bernomor urut tercetak saat pembayaran dicatat |
| Status Otomatis | Status Aktif / Lunas dihitung otomatis |
| Keuangan | Catatan pemasukan & pengeluaran, rekap bulanan, grafik |
| Auto-Keuangan | Pembayaran hutang otomatis tercatat sebagai pemasukan di Keuangan |
| Stok Barang | Kelola barang, harga beli/jual, stok minimum, transaksi masuk/keluar |
| Laporan | Filter tanggal, pelanggan, status — cetak atau unduh CSV |
| Export CSV | Unduh data ke Excel/spreadsheet |
| Cetak PDF | Cetak laporan & kwitansi via browser default |
| Backup Data | Export semua data (hutang, keuangan, stok) ke file JSON |
| Restore Data | Pulihkan data dari file backup (kompatibel antar versi) |
| License Key | Sistem lisensi untuk aktivasi aplikasi |
| Multi Usaha | Super Admin kelola banyak toko/usaha |
| Offline 100% | Tidak butuh internet sama sekali |

---

## Akun Default

| Role | Username | Password | Akses |
|------|----------|----------|-------|
| Super Admin | `admin` | `admin123` | Kelola semua usaha & pengguna |
| Owner | `owner1` | `owner123` | Kelola usaha sendiri |

> **Penting**: Ganti password segera setelah login pertama kali melalui menu **Profil**.

---

## Panduan Pengguna Windows

### Instalasi Aplikasi

1. Jalankan file **Usahaku-Setup-1.0.0.exe**
2. Klik **Next** / **Lanjut** di setiap langkah
3. Pilih lokasi instalasi (default sudah tepat)
4. Centang **Create Desktop Shortcut** agar ada ikon di Desktop
5. Klik **Install**
6. Setelah selesai, klik **Finish**

### Membuka Aplikasi

- Klik dua kali ikon **Usahaku** di Desktop
- Atau cari "Usahaku" di Start Menu Windows

### Pertama Kali Buka

1. Layar loading akan muncul sebentar — ini normal
2. Tunggu sampai halaman **Setup Awal** muncul
3. Isi nama usaha dan data awal, klik **Mulai**
4. Login dengan akun Owner atau Super Admin

### Mengelola Pelanggan

1. Klik menu **Pelanggan** di sidebar kiri
2. Klik **Tambah Pelanggan** untuk menambah baru
3. Isi nama dan nomor telepon, klik **Simpan**
4. Untuk edit: klik ikon pensil di baris pelanggan
5. Untuk hapus: klik ikon tempat sampah (hanya bisa dihapus jika tidak ada hutang)

### Mencatat Hutang

1. Klik menu **Hutang** di sidebar
2. Klik **Tambah Hutang**
3. Pilih pelanggan, isi keterangan, nominal, dan tanggal
4. Klik **Simpan** — hutang tersimpan dengan status **Aktif**

### Mencatat Pembayaran

1. Klik menu **Pembayaran**
2. Klik **Tambah Pembayaran**
3. Pilih hutang yang dibayar, isi jumlah pembayaran dan tanggal
4. Klik **Simpan**
5. Kwitansi A5 otomatis muncul dan bisa dicetak
6. Status hutang berubah otomatis menjadi **Lunas** jika sudah terbayar penuh
7. Pembayaran otomatis tercatat sebagai **Pemasukan** di menu Keuangan

### Mencetak Kwitansi

- Kwitansi muncul otomatis setelah pembayaran disimpan
- Klik **Cetak Kwitansi** untuk membuka di browser default → lalu `Ctrl+P`
- Kwitansi bernomor urut format `KWT-YYYY-NNNN` (tidak pernah duplikat)

### Keuangan (Pemasukan & Pengeluaran)

1. Klik menu **Keuangan** di sidebar
2. Pilih bulan dan tahun yang ingin dilihat
3. Lihat rekap **Total Masuk**, **Total Keluar**, dan **Saldo**
4. Klik **Tambah Transaksi** untuk catat pemasukan/pengeluaran manual
5. Klik **Cetak** untuk mencetak laporan keuangan bulan tersebut
6. Klik **Unduh CSV** untuk export ke Excel

> Pembayaran hutang otomatis muncul di sini sebagai "Pelunasan Hutang" — tidak perlu catat manual.

### Stok Barang

1. Klik menu **Stok** di sidebar
2. Klik **Tambah Barang** untuk mendaftarkan barang baru (nama, satuan, harga beli/jual, stok minimum)
3. Klik barang untuk melihat riwayat transaksi stok
4. Klik **Tambah Transaksi** untuk catat barang masuk atau keluar
5. Barang yang stoknya di bawah minimum akan ditandai otomatis

### Melihat Laporan Hutang

1. Klik menu **Laporan**
2. Gunakan filter di atas tabel untuk menyaring berdasarkan:
   - Pelanggan tertentu
   - Status (Aktif / Lunas / Semua)
   - Periode tanggal
3. Klik **Reset Filter** untuk kembali ke tampilan semua data
4. Klik **Cetak** untuk mencetak laporan via browser default

### Export CSV (ke Excel)

1. Buka menu **Laporan** atau **Keuangan**
2. Atur filter sesuai kebutuhan (opsional)
3. Klik tombol **Unduh CSV**
4. File akan tersimpan di folder **Unduhan** komputer Anda
5. Buka file tersebut di Excel atau Google Sheets

### Backup Data

1. Klik menu **Backup**
2. Klik **Unduh File Backup**
3. File JSON tersimpan di folder **Unduhan** komputer Anda
4. Simpan file ini di tempat aman (flashdisk, Google Drive, dll.)
5. Beri nama file yang mudah diingat, misalnya: `backup_januari_2025.json`

> **Disarankan**: Backup data secara rutin, misalnya setiap minggu.
> File backup mencakup seluruh data: pelanggan, hutang, pembayaran, keuangan, dan stok.

### Restore Data dari Backup

1. Klik menu **Backup**
2. Scroll ke bagian **Restore Data**
3. Klik **Pilih File Backup** dan pilih file JSON backup Anda
4. Preview data akan ditampilkan (jumlah pelanggan, hutang, pembayaran)
5. Klik **Mulai Restore**
6. Konfirmasi di dialog yang muncul
7. **Perhatian**: Restore akan menggantikan seluruh data saat ini

> File backup versi lama (v1.0) tetap bisa di-restore di versi aplikasi terbaru.

### Ganti Password

1. Klik menu **Profil** di sidebar bawah
2. Isi **Password Lama** (password saat ini)
3. Isi **Password Baru** dan **Konfirmasi Password Baru**
4. Klik **Simpan Perubahan**

### Menutup Aplikasi

- Klik tombol **X** di pojok kanan atas window
- Semua data tersimpan otomatis — tidak perlu simpan manual

---

## Panduan Developer

---

## Panduan Build Windows (Langkah per Langkah)

> Panduan ini untuk siapapun yang ingin menghasilkan file installer `.exe` dari kode sumber, **termasuk yang belum pernah pakai terminal sebelumnya**. Ikuti urutan ini dari awal sampai selesai.

---

### Langkah 1 — Install Node.js

Node.js adalah program yang dibutuhkan untuk menjalankan kode aplikasi ini.

1. Buka browser, kunjungi: **https://nodejs.org**
2. Klik tombol **"LTS"** (bukan "Current") untuk download versi stabil
3. Jalankan file yang terunduh (contoh: `node-v20.x.x-x64.msi`)
4. Klik **Next** terus sampai selesai — semua pilihan default sudah benar
5. **Restart komputer** setelah instalasi selesai

**Cek apakah berhasil:**
- Tekan `Windows + R`, ketik `cmd`, tekan Enter
- Di jendela hitam yang muncul, ketik:
  ```
  node --version
  ```
- Harus muncul angka versi, contoh: `v20.11.0`
- Kalau muncul versi, Node.js sudah terpasang dengan benar ✅

---

### Langkah 2 — Install pnpm

pnpm adalah alat untuk mengunduh semua komponen yang dibutuhkan aplikasi.

1. Masih di jendela Command Prompt tadi (atau buka yang baru)
2. Ketik perintah berikut lalu tekan Enter:
   ```
   npm install -g pnpm
   ```
3. Tunggu sampai selesai (biasanya 1-2 menit)

**Cek apakah berhasil:**
```
pnpm --version
```
Harus muncul angka versi, contoh: `9.x.x` ✅

> Jika muncul error `pnpm : File ... cannot be loaded`, buka **PowerShell sebagai Administrator** lalu ketik:
> ```
> Set-ExecutionPolicy RemoteSigned
> ```
> Ketik `Y` lalu Enter, lalu coba install ulang pnpm.

---

### Langkah 3 — Install Git

Git digunakan untuk mengunduh kode dari GitHub.

1. Buka browser, kunjungi: **https://git-scm.com/download/win**
2. Download otomatis dimulai — jalankan file installer-nya
3. Klik **Next** terus, semua pilihan default sudah benar
4. Klik **Install**, tunggu sampai selesai, klik **Finish**

**Cek apakah berhasil** (buka Command Prompt baru):
```
git --version
```
Harus muncul angka versi, contoh: `git version 2.x.x` ✅

---

### Langkah 4 — Download Kode dari GitHub

1. Buka Command Prompt (tekan `Windows + R`, ketik `cmd`, Enter)
2. Pilih folder tempat menyimpan kode. Contoh, ke Desktop:
   ```
   cd Desktop
   ```
3. Download kode dengan perintah berikut:
   ```
   git clone https://github.com/ketanvpn/usahaku-app.git
   ```
4. Tunggu sampai selesai — akan muncul folder baru bernama `usahaku-app` di Desktop
5. Masuk ke dalam folder tersebut:
   ```
   cd usahaku-app
   ```

---

### Langkah 5 — Install Semua Komponen

Perintah ini mengunduh semua komponen yang dibutuhkan aplikasi (hanya perlu dilakukan sekali):

```
pnpm install
```

Tunggu sampai selesai — bisa memakan waktu **3-10 menit** tergantung kecepatan internet. Ini normal.

Kalau muncul tulisan `Done` atau kembali ke prompt `>`, berarti berhasil ✅

---

### Langkah 6 — Build Installer

Perintah ini menghasilkan file `.exe` yang bisa diinstall di komputer Windows manapun:

```
pnpm --filter @workspace/electron-app run dist:win
```

Proses ini memakan waktu **5-15 menit**. Selama proses berjalan akan muncul banyak tulisan — ini normal, biarkan sampai selesai.

Tanda berhasil: muncul tulisan seperti `target=nsis` atau `built` di bagian akhir ✅

---

### Langkah 7 — Ambil File Installer

Setelah build selesai, file installer ada di:

```
usahaku-app\artifacts\electron-app\release\
```

Cari file bernama **`Usahaku-Setup-1.0.0.exe`** — inilah file yang bisa dibagikan dan diinstall.

**Cara buka folder tersebut:**
1. Buka File Explorer
2. Navigasi ke: `Desktop → usahaku-app → artifacts → electron-app → release`
3. File `.exe` ada di sana

---

### Masalah Umum Saat Build

| Masalah | Solusi |
|---------|--------|
| `pnpm: command not found` | Tutup dan buka ulang Command Prompt setelah install pnpm |
| `git: command not found` | Tutup dan buka ulang Command Prompt setelah install Git |
| `Error: EACCES permission denied` | Buka Command Prompt **sebagai Administrator** (klik kanan → Run as administrator) |
| Build terhenti tiba-tiba | Jalankan ulang perintah `dist:win` — biasanya langsung lanjut |
| File `.exe` tidak muncul | Cek apakah ada pesan `Error` di terminal, kirimkan ke pengembang |
| Antivirus memblokir proses | Sementara matikan antivirus, build ulang, lalu aktifkan kembali |

---

### Cara Update ke Versi Baru

Saat ada pembaruan kode di GitHub, cukup jalankan:

```
git pull
pnpm install
pnpm --filter @workspace/electron-app run dist:win
```

Tiga perintah ini sudah cukup — tidak perlu install ulang Node.js, pnpm, atau Git.

---

### Prasyarat (Ringkasan untuk Developer)

- Node.js 18+
- pnpm 8+
- Git

### Install Dependencies

```bash
pnpm install
```

### Mode Development

```bash
# Terminal 1 — Backend API
pnpm --filter @workspace/api-server run dev

# Terminal 2 — Frontend (opsional untuk hot reload)
pnpm --filter @workspace/hutang-app run dev

# Terminal 3 — Buka Electron desktop window
pnpm --filter @workspace/electron-app run electron
```

### Mode Production (Build + Jalankan)

```bash
# Build semua (backend + frontend + electron main)
pnpm --filter @workspace/electron-app run build:desktop

# Jalankan dalam mode production
pnpm --filter @workspace/electron-app run electron:prod
```

### Build Windows Installer (.exe)

```bash
# Harus dijalankan di mesin Windows dengan Node.js terinstall
pnpm --filter @workspace/electron-app run dist:win
```

Output: `artifacts/electron-app/release/Usahaku-Setup-1.0.0.exe`

### Update Versi Aplikasi

Edit file `artifacts/electron-app/package.json`:
```json
{
  "version": "1.0.1"
}
```
Lalu build ulang dengan `dist:win`.

### Menambah Icon Aplikasi

1. Siapkan file gambar PNG ukuran **512x512 piksel** (atau lebih besar)
2. Konversi ke format ICO di: https://cloudconvert.com/png-to-ico (pilih ukuran 16, 32, 48, 128, 256)
3. Taruh file sebagai: `artifacts/electron-app/assets/icon.ico`
4. Rebuild: `pnpm --filter @workspace/electron-app run build:desktop`

### Struktur Project

```
artifacts/
  api-server/          ← Backend Express + SQLite
    src/               ← Source TypeScript
    dist/              ← Hasil build (auto-generated)
    data/app.db        ← Database lokal (development)
  hutang-app/          ← Frontend React + Vite
    src/               ← Source React
    dist/public/       ← Hasil build (auto-generated)
  electron-app/        ← Desktop wrapper Electron
    src/main.ts        ← Main process
    build/             ← Hasil compile (auto-generated)
    assets/            ← Icon & aset
    release/           ← Installer output (auto-generated)
    electron-builder.yml
lib/
  db/                  ← Schema database (Drizzle ORM)
    src/schema/        ← Schema per tabel
  api-zod/             ← Tipe API (auto-generated)
```

### Reset Database

```bash
rm -f artifacts/api-server/data/app.db*
pnpm --filter @workspace/api-server run dev
```
Database akan dibuat ulang dengan data seed otomatis.

---

## Lokasi File Penting

| File / Folder | Lokasi | Keterangan |
|---------------|--------|-----------|
| Database (desktop) | `C:\Users\{nama}\AppData\Roaming\Usahaku\app.db` | Data utama |
| Log aplikasi | `C:\Users\{nama}\AppData\Roaming\Usahaku\buku-hutang.log` | Log error & info |
| Database (dev) | `artifacts/api-server/data/app.db` | Data development |
| File Backup | Folder Unduhan | Setelah klik "Unduh Backup" |
| Export CSV | Folder Unduhan | Setelah klik "Unduh CSV" |
| Installer | `artifacts/electron-app/release/` | Hasil `dist:win` |
| Icon | `artifacts/electron-app/assets/icon.ico` | Untuk build installer |

### Database Mode Desktop (Windows)

Saat aplikasi dijalankan sebagai installer, database tersimpan di:

```
C:\Users\{nama_pengguna}\AppData\Roaming\Usahaku\app.db
```

Folder ini **tidak ikut terhapus** saat uninstall, sehingga data tetap aman.
Saat install ulang atau update versi, data lama otomatis digunakan kembali.

---

## Checklist Pengujian Final

Gunakan checklist ini sebelum mendistribusikan ke pengguna:

### Instalasi & Startup
- [ ] Installer berjalan tanpa error
- [ ] Ikon muncul di Desktop dan Start Menu
- [ ] Aplikasi terbuka — halaman setup atau login muncul
- [ ] Tidak ada blank screen yang lama

### Setup Awal & Login
- [ ] Setup wizard muncul saat pertama buka (fresh install)
- [ ] Isi nama usaha → berhasil masuk ke halaman login
- [ ] Login Super Admin: `admin` / `admin123` → masuk ke dashboard admin
- [ ] Login Owner: `owner1` / `owner123` → masuk ke dashboard owner
- [ ] Logout berfungsi — kembali ke halaman login
- [ ] Login ulang berfungsi

### Hutang & Pembayaran
- [ ] Tambah pelanggan baru → muncul di daftar
- [ ] Edit nama/telepon pelanggan → tersimpan
- [ ] Tambah hutang untuk pelanggan → status "Aktif"
- [ ] Tambah pembayaran sebagian → sisa hutang berkurang
- [ ] Kwitansi A5 muncul otomatis setelah pembayaran disimpan
- [ ] Nomor kwitansi format `KWT-YYYY-NNNN` dan tidak duplikat
- [ ] Tambah pembayaran penuh → status berubah "Lunas"
- [ ] Hapus pembayaran → sisa hutang kembali
- [ ] Coba hapus pelanggan yang masih punya hutang → muncul pesan error
- [ ] Hapus hutang → berhasil
- [ ] Hapus pelanggan yang tidak punya hutang → berhasil

### Keuangan
- [ ] Pembayaran hutang otomatis muncul di Keuangan sebagai "Pelunasan Hutang"
- [ ] Hapus pembayaran → entri keuangan terkait ikut terhapus
- [ ] Tambah transaksi keuangan manual (masuk & keluar) → muncul di daftar
- [ ] Rekap Total Masuk / Keluar / Saldo terhitung benar
- [ ] Filter bulan & tahun bekerja
- [ ] Klik Cetak → terbuka di browser default
- [ ] Unduh CSV → file terunduh dan terbaca di Excel

### Stok Barang
- [ ] Tambah barang baru → muncul di daftar
- [ ] Edit barang → tersimpan
- [ ] Tambah transaksi stok masuk → stok bertambah
- [ ] Tambah transaksi stok keluar → stok berkurang
- [ ] Barang stok di bawah minimum → ditandai

### Laporan & Export
- [ ] Laporan menampilkan semua data hutang
- [ ] Filter status "Aktif" bekerja
- [ ] Filter "Lunas" bekerja
- [ ] Filter berdasarkan pelanggan bekerja
- [ ] Filter berdasarkan tanggal bekerja
- [ ] Reset filter mengembalikan semua data
- [ ] Klik "Unduh CSV" → file terunduh dan terbaca di Excel
- [ ] Klik "Cetak" → terbuka di browser default

### Backup & Restore
- [ ] Klik "Unduh File Backup" → file JSON terunduh
- [ ] Buka file JSON — pastikan berisi data pelanggan, hutang, keuangan, dan stok
- [ ] Upload file JSON → preview data muncul
- [ ] Klik "Mulai Restore" + konfirmasi → data terganti
- [ ] Data setelah restore sesuai dengan isi backup
- [ ] Restore file backup versi lama (v1.0) → tetap berhasil

### Persistensi Data
- [ ] Tutup aplikasi
- [ ] Buka kembali aplikasi
- [ ] Login → semua data masih ada

### Super Admin
- [ ] Login admin → melihat daftar semua usaha
- [ ] Tambah usaha baru → muncul di daftar
- [ ] Melihat daftar semua user/owner
- [ ] Reset password owner → owner bisa login dengan password baru

### Ketahanan
- [ ] Nonaktifkan koneksi internet → aplikasi tetap berjalan
- [ ] Jalankan di PC berbeda (dengan install) → berfungsi normal

---

## Troubleshooting (Masalah Umum)

### Aplikasi stuck di layar loading / "Server tidak merespons"

**Penyebab**: Backend gagal start saat pertama buka.

**Langkah diagnosis**:
1. Lihat file log di: `C:\Users\{nama}\AppData\Roaming\Usahaku\buku-hutang.log`
2. Cari baris `[backend:err]` atau `FATAL` di log tersebut
3. Kirim isi log tersebut ke pengembang untuk analisis lebih lanjut

**Solusi umum**:
- Tutup aplikasi dan buka kembali
- Pastikan tidak ada aplikasi lain yang menggunakan port 8080
- Coba restart komputer, lalu buka aplikasi lagi
- Jika masih gagal, uninstall dan install ulang aplikasi

### Error: "Cannot find module better-sqlite3" atau database crash saat startup

**Penyebab**: Native module `better-sqlite3` tidak terkompilasi untuk Electron ABI yang benar.

**Solusi**: Pastikan build dilakukan dengan langkah yang benar:
```powershell
pnpm install
pnpm run dist:win
```

Perintah `dist:win` akan otomatis rebuild `better-sqlite3` untuk Electron ABI (`npmRebuild: true`).

**Jangan** copy manual file `better-sqlite3` dari folder lain — harus melalui proses build ini.

### Error: "Cannot find module 'bindings'"

**Sudah diperbaiki secara otomatis**: Proyek ini sudah menyertakan `bindings-stub` di `electron-app/assets/bindings-stub/`. Pastikan build dilakukan dari source code terbaru.

Jika masih error, cek log file:
```
C:\Users\{nama}\AppData\Roaming\Usahaku\buku-hutang.log
```

### Dialog error muncul saat pertama buka

| Error | Solusi |
|-------|--------|
| "File Aplikasi Tidak Ditemukan" | Uninstall dan install ulang |
| "Gagal Membuat Folder Data" | Periksa izin folder AppData |
| "Server tidak merespons setelah 30 detik" | Port 8080 mungkin dipakai app lain; coba restart PC |
| "Layanan Aplikasi Berhenti" | Lihat log di AppData, kirim ke pengembang |

### Data hilang setelah uninstall lalu install ulang

Data **tidak** dihapus saat uninstall. Data tersimpan di:
```
C:\Users\{nama}\AppData\Roaming\Usahaku\app.db
```
Saat install ulang, data lama otomatis digunakan kembali.

### Lupa password

Hubungi Super Admin untuk melakukan reset password melalui menu **Admin → Kelola User**.

---

## Catatan Keamanan

- Tidak ada data yang dikirim ke internet — semua tersimpan lokal
- Database SQLite tersimpan di folder AppData pengguna
- Session cookie hanya berlaku di localhost
- Ganti password default sebelum digunakan di lingkungan produksi

---

## Stack Teknologi

| Komponen | Teknologi |
|----------|-----------|
| Desktop wrapper | Electron 33 |
| Frontend | React 19 + Vite + Tailwind CSS |
| Backend | Express 5 + TypeScript |
| Database | SQLite (better-sqlite3) + Drizzle ORM |
| Auth | express-session + bcrypt |
| Installer | electron-builder (NSIS) |
| Monorepo | pnpm workspaces |

---

## Versi

| Versi | Keterangan |
|-------|-----------|
| 1.0.0 | Rilis awal — hutang, pembayaran, laporan, stok, keuangan |
| — | Format backup v1.1 — mencakup keuangan & stok |
