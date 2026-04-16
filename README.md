# Usahaku by KetanTech

**Aplikasi Manajemen Bisnis Desktop untuk Usaha Kecil**

Usahaku membantu Anda mencatat hutang pelanggan, keuangan masuk/keluar, stok barang, dan laporan secara rapi — langsung di komputer Windows, tanpa internet, tanpa server, tanpa biaya langganan.

---

## Daftar Isi

- [Fitur Utama](#fitur-utama)
- [Akun Default](#akun-default)
- [Panduan Pengguna Windows](#panduan-pengguna-windows)
  - [Backup & Restore Google Drive](#backup--restore-google-drive)
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
| Laporan | Filter tanggal, pelanggan, status — cetak atau export ke Excel |
| Export Excel | Unduh laporan hutang, keuangan, dan stok ke file Excel (.xlsx) |
| Cetak PDF | Cetak laporan & kwitansi via browser default |
| Auto-Backup | Data dicadangkan otomatis setiap kali menutup aplikasi (file .db) |
| Backup JSON | Export semua data ke file JSON untuk cadangan manual |
| Restore JSON | Pulihkan data dari file backup JSON |
| Restore Auto-Backup | Pulihkan data dari file auto-backup .db dengan pengaman rollback otomatis |
| Backup Google Drive | Backup otomatis ke Google Drive setiap 15 menit — file tersimpan aman di cloud |
| Restore dari Drive | Pulihkan data langsung dari daftar backup yang tersimpan di Google Drive |
| License Key | Sistem lisensi untuk aktivasi aplikasi |
| Multi Usaha | Super Admin kelola banyak toko/usaha |
| Offline 100% | Tidak butuh internet sama sekali (fitur Google Drive butuh koneksi hanya saat backup) |

---

## Akun Default

| Role | Username | Password | Akses |
|------|----------|----------|-------|
| Super Admin | `admin` | `maduTJ150` | Kelola semua usaha & pengguna |
| Owner | *(dibuat saat setup)* | *(ditentukan saat setup)* | Kelola usaha sendiri |

> **Penting**: Ganti password Super Admin segera setelah login pertama kali melalui menu **Profil**.

---

## Panduan Pengguna Windows

### Instalasi Aplikasi

1. Jalankan file **Usahaku-Setup-x.x.x.exe** yang Anda terima (contoh: `Usahaku-Setup-1.0.9.exe`)
2. Kalau muncul peringatan "Windows melindungi PC Anda" — klik **Informasi selengkapnya**, lalu klik **Tetap jalankan**
3. Klik **Next** / **Lanjut** di setiap langkah
4. Pilih lokasi instalasi (biarkan default sudah tepat)
5. Centang **Create Desktop Shortcut** agar ada ikon di Desktop
6. Klik **Install**
7. Setelah selesai, klik **Finish**

### Membuka Aplikasi

- Klik dua kali ikon **Usahaku** di Desktop
- Atau cari "Usahaku" di Start Menu Windows

### Pertama Kali Buka

1. Layar loading akan muncul sebentar — ini normal, tunggu sampai 30 detik
2. Setelah loading selesai, halaman **Setup Awal** akan muncul
3. Isi nama usaha Anda, lalu klik **Mulai**
4. Selanjutnya akan muncul halaman **Login**
5. Login menggunakan akun Owner atau Super Admin (lihat tabel Akun Default di atas)

---

### Mengelola Pelanggan

1. Klik menu **Pelanggan** di sidebar kiri
2. Klik tombol **Tambah Pelanggan**
3. Isi nama dan nomor telepon pelanggan, lalu klik **Simpan**
4. Pelanggan baru akan muncul di daftar
5. Untuk **mengubah data**: klik ikon pensil (✏️) di baris pelanggan
6. Untuk **menghapus**: klik ikon tempat sampah (🗑️) — pelanggan hanya bisa dihapus jika tidak ada hutang aktif

---

### Mencatat Hutang

1. Klik menu **Hutang** di sidebar
2. Klik tombol **Tambah Hutang**
3. Pilih nama pelanggan dari daftar dropdown
4. Isi keterangan (contoh: "Beras 5kg"), nominal hutang, dan tanggal
5. Klik **Simpan**
6. Hutang akan muncul di daftar dengan status **Aktif**

---

### Mencatat Pembayaran

1. Klik menu **Pembayaran** di sidebar
2. Klik tombol **Tambah Pembayaran**
3. Pilih hutang yang sedang dibayar dari daftar
4. Isi jumlah pembayaran dan tanggal
5. Klik **Simpan**
6. Kwitansi A5 otomatis muncul — klik **Cetak Kwitansi** untuk mencetak via printer
7. Status hutang akan otomatis berubah menjadi **Lunas** jika sudah terbayar penuh
8. Pembayaran ini juga otomatis tercatat sebagai **Pemasukan** di menu Keuangan

---

### Mencetak Kwitansi

- Kwitansi muncul otomatis setelah pembayaran disimpan
- Klik **Cetak Kwitansi** → browser default (Chrome/Edge) akan terbuka
- Tekan **Ctrl + P** di browser untuk mencetak
- Kwitansi bernomor urut format `KWT-YYYY-NNNN` dan tidak pernah duplikat
- Untuk mencetak ulang kwitansi lama: buka menu **Pembayaran** → klik ikon cetak di baris pembayaran

---

### Keuangan (Pemasukan & Pengeluaran)

1. Klik menu **Keuangan** di sidebar
2. Pilih bulan dan tahun yang ingin dilihat di bagian atas
3. Akan terlihat rekap **Total Masuk**, **Total Keluar**, dan **Saldo** bulan tersebut
4. Untuk tambah catatan manual: klik **Tambah Transaksi**, isi jenis (masuk/keluar), nominal, dan keterangan
5. Untuk mencetak laporan bulan ini: klik **Cetak**
6. Untuk export ke Excel: klik **Export Excel**

> Pembayaran hutang otomatis muncul di sini sebagai "Pelunasan Hutang" — tidak perlu catat manual.

---

### Stok Barang

1. Klik menu **Stok** di sidebar
2. Klik **Tambah Barang** untuk mendaftarkan barang baru
   - Isi nama barang, satuan (contoh: kg, pcs, karton), harga beli, harga jual, dan stok minimum
3. Klik nama barang untuk melihat riwayat transaksi stok barang tersebut
4. Klik **Tambah Transaksi** untuk mencatat barang masuk (beli stok) atau keluar (terjual/terpakai)
5. Barang yang stoknya di bawah angka minimum akan ditandai merah secara otomatis

---

### Melihat Laporan

1. Klik menu **Laporan** di sidebar
2. Di sini ada beberapa tab: **Kasir**, **Hutang**, **Keuangan**, dan **Stok**
3. Gunakan filter di setiap tab untuk menyaring data berdasarkan:
   - Pelanggan tertentu
   - Status (Aktif / Lunas / Semua)
   - Periode tanggal tertentu
4. Klik **Reset Filter** untuk kembali menampilkan semua data
5. Klik **Cetak** untuk mencetak laporan via browser default
6. Klik **Export Excel** (tombol hijau) untuk mengunduh laporan ke file Excel (.xlsx)
   - File Excel akan tersimpan di folder **Unduhan** komputer Anda
   - Buka dengan Microsoft Excel atau aplikasi spreadsheet lain

---

### Backup Data (Cadangan Manual - Format JSON)

Backup JSON berguna untuk menyimpan cadangan data yang bisa dibuka dan dicek isinya.

1. Klik menu **Backup** di sidebar
2. Di bagian **Export Data**, klik tombol **Simpan File Backup...**
3. Pilih lokasi penyimpanan (disarankan: flashdisk atau folder yang mudah diingat)
4. Beri nama file yang mudah diingat, contoh: `backup-toko-januari-2025.json`
5. Klik **Simpan**

> **Disarankan**: Lakukan backup manual setiap bulan dan simpan di flashdisk terpisah.

---

### Auto-Backup (Cadangan Otomatis - Format .db)

Auto-backup berjalan **otomatis setiap kali Anda menutup aplikasi** — tidak perlu melakukan apapun secara manual.

**Cara melihat file auto-backup:**
1. Klik menu **Backup** di sidebar
2. Di bagian **Pengaturan Auto-Backup**, terlihat folder tempat file auto-backup disimpan
3. Maksimal **7 file backup terakhir** yang disimpan — yang paling lama dihapus otomatis

**Mengubah folder auto-backup:**
1. Di bagian yang sama, klik tombol **Ubah Folder Auto-Backup**
2. Pilih folder baru (contoh: folder di flashdisk yang selalu ditancapkan)
3. Klik **OK** — mulai sekarang backup otomatis masuk ke folder itu

---

### Restore Data dari Backup JSON

Gunakan ini untuk memulihkan data dari file backup `.json` yang pernah Anda simpan.

1. Klik menu **Backup** di sidebar
2. Di bagian **Restore Data**, klik tombol **Pilih File** dan cari file `.json` backup Anda
3. Akan muncul preview berisi jumlah pelanggan, hutang, dan pembayaran yang akan di-restore
4. Pastikan preview sesuai dengan yang Anda harapkan
5. Klik **Mulai Restore**
6. Konfirmasi di dialog yang muncul dengan klik **Ya, Restore Sekarang**

> **Perhatian**: Restore akan **menghapus semua data saat ini** dan menggantinya dengan isi file backup. Pastikan Anda sudah yakin sebelum melanjutkan.

---

### Restore Data dari Auto-Backup (.db)

Gunakan ini untuk memulihkan data dari file auto-backup `.db` yang tersimpan otomatis.

Fitur ini dilengkapi **pengaman otomatis** — jika file backup yang dipilih ternyata rusak atau tidak valid, data Anda saat ini akan **dikembalikan seperti semula secara otomatis**.

**Langkah-langkahnya:**

1. Klik menu **Backup** di sidebar
2. Di bagian **Restore dari Auto-Backup (.db)**, klik tombol **Pilih File Auto-Backup & Restore...**
3. Dialog konfirmasi akan muncul — baca dulu, lalu klik **Lanjutkan, Pilih File...**
4. Jendela pemilihan file akan terbuka, otomatis mengarah ke folder auto-backup
5. Pilih file `.db` yang ingin Anda restore (nama file mengandung tanggal)
6. Klik **Open** / **Buka**
7. Aplikasi akan memproses restore — tunggu beberapa detik
8. Setelah selesai, aplikasi otomatis memuat ulang dan menampilkan data yang sudah di-restore

**Jika restore gagal** (misal file rusak):
- Akan muncul pesan error
- Data Anda saat ini **tidak berubah** — aplikasi otomatis mengembalikan ke kondisi semula
- Coba pilih file auto-backup yang lain

---

### Backup & Restore Google Drive

Fitur ini memungkinkan data Anda tersimpan aman di Google Drive secara otomatis. Backup berjalan sendiri setiap **15 menit** selama aplikasi aktif dan terkoneksi internet — Anda tidak perlu melakukan apapun setelah setup awal.

> **Catatan**: Fitur ini membutuhkan koneksi internet hanya saat proses backup/restore berlangsung. Data utama tetap bekerja 100% offline.

**Cara Menghubungkan Google Drive (pertama kali):**

1. Klik menu **Backup** di sidebar
2. Di bagian **Backup Google Drive**, klik tombol **Hubungkan Google Drive**
3. Browser akan terbuka otomatis dan menampilkan halaman login Google
4. Pilih akun Google yang ingin digunakan
5. Akan muncul halaman peringatan: **"usahaku belum diverifikasi Google"** — ini normal
   - Klik **"Advanced"** (tulisan kecil di bagian bawah halaman)
   - Klik **"Go to usahaku (unsafe)"**
6. Klik **Izinkan**
7. Setelah berhasil, browser akan menampilkan pesan *"Berhasil! Google Drive berhasil dihubungkan"*
8. Kembali ke aplikasi — status akan berubah menampilkan email akun Google yang terhubung

> **Kenapa muncul peringatan "belum diverifikasi"?** Ini adalah peringatan standar Google untuk aplikasi desktop yang belum melalui proses verifikasi resmi. Aplikasi Usahaku aman digunakan — hanya mengakses file yang dibuat oleh aplikasi itu sendiri di Drive Anda.

**Backup Manual (kapan saja):**

1. Klik menu **Backup** di sidebar
2. Di bagian **Backup Google Drive**, klik tombol **Backup Sekarang**
3. Tunggu beberapa detik — akan muncul konfirmasi backup berhasil

**Melihat & Memulihkan Backup dari Drive:**

1. Klik menu **Backup** di sidebar
2. Di bagian **Backup Google Drive**, klik **Lihat X backup di Drive**
3. Daftar file backup akan muncul beserta tanggal dan ukurannya
4. Klik **Pulihkan** di sebelah file yang ingin digunakan
5. Konfirmasi di dialog yang muncul — data akan dipulihkan dan aplikasi memuat ulang otomatis

> Maksimal **7 file backup** tersimpan di Drive — file terlama dihapus otomatis saat ada backup baru.

**Memutus Koneksi Google Drive:**

1. Klik menu **Backup** di sidebar
2. Di bagian **Backup Google Drive**, klik **Putuskan Koneksi**
3. Konfirmasi di dialog — token akses dihapus dari komputer, data di Drive tidak ikut terhapus

---

### Ganti Password

1. Klik menu **Profil** di sidebar bagian bawah
2. Isi kolom **Password Lama** dengan password yang sekarang digunakan
3. Isi kolom **Password Baru** dengan password yang diinginkan
4. Isi kolom **Konfirmasi Password Baru** (ketik ulang password baru)
5. Klik **Simpan Perubahan**

---

### Menutup Aplikasi

- Klik tombol **X** di pojok kanan atas window
- Semua data tersimpan otomatis — tidak perlu simpan manual
- Auto-backup juga berjalan otomatis saat menutup aplikasi

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
- Di jendela hitam yang muncul, ketik perintah berikut lalu tekan Enter:
  ```
  node --version
  ```
- Harus muncul angka versi, contoh: `v20.11.0`
- Kalau muncul versi, Node.js sudah terpasang dengan benar ✅

---

### Langkah 2 — Install pnpm

pnpm adalah alat untuk mengunduh semua komponen yang dibutuhkan aplikasi.

1. Masih di jendela Command Prompt tadi (atau buka yang baru dengan `Windows + R` → `cmd` → Enter)
2. Ketik perintah berikut lalu tekan Enter:
   ```
   npm install -g pnpm
   ```
3. Tunggu sampai selesai (biasanya 1-2 menit) — biarkan tulisan-tulisan di layar berjalan sendiri

**Cek apakah berhasil:**
```
pnpm --version
```
Harus muncul angka versi, contoh: `9.x.x` ✅

> **Jika muncul error** `pnpm : File ... cannot be loaded`, buka **PowerShell sebagai Administrator**:
> - Klik Start Menu → cari "PowerShell" → klik kanan → **Run as Administrator**
> - Ketik perintah berikut lalu tekan Enter:
>   ```
>   Set-ExecutionPolicy RemoteSigned
>   ```
> - Ketik `Y` lalu Enter
> - Tutup PowerShell, buka Command Prompt biasa, dan coba install pnpm lagi

---

### Langkah 3 — Install Git

Git digunakan untuk mengunduh kode dari GitHub.

1. Buka browser, kunjungi: **https://git-scm.com/download/win**
2. Download akan mulai otomatis — tunggu sampai selesai
3. Jalankan file installer yang terunduh (contoh: `Git-2.x.x-64-bit.exe`)
4. Klik **Next** terus sampai selesai — semua pilihan default sudah benar
5. Klik **Install**, tunggu sampai selesai, lalu klik **Finish**

**Cek apakah berhasil** (buka Command Prompt baru):
```
git --version
```
Harus muncul angka versi, contoh: `git version 2.x.x` ✅

> Jika `git` tidak dikenali, tutup dan buka ulang Command Prompt, lalu coba lagi.

---

### Langkah 4 — Download Kode dari GitHub

1. Buka Command Prompt (tekan `Windows + R`, ketik `cmd`, tekan Enter)
2. Arahkan ke Desktop dengan mengetik perintah berikut lalu tekan Enter:
   ```
   cd Desktop
   ```
3. Download kode dengan perintah berikut lalu tekan Enter:
   ```
   git clone https://github.com/ketanvpn/usahaku-app.git
   ```
4. Tunggu sampai selesai — akan muncul folder baru bernama `usahaku-app` di Desktop
5. Masuk ke dalam folder tersebut:
   ```
   cd usahaku-app
   ```
6. Pastikan sudah masuk ke folder yang benar — di Command Prompt tertulis `...\Desktop\usahaku-app>` ✅

---

### Langkah 5 — Install Semua Komponen

Perintah ini mengunduh semua komponen yang dibutuhkan aplikasi. Ketik perintah berikut lalu tekan Enter:

```
pnpm install
```

- Tunggu sampai selesai — bisa memakan waktu **5-15 menit** tergantung kecepatan internet
- Biarkan saja tulisan-tulisan yang muncul di layar, itu normal
- Tanda berhasil: muncul tulisan `Done` atau kembali ke prompt `>` ✅

> **Normal**: Jika muncul pesan kuning `Ignored build scripts: bcrypt, electron` — itu **bukan error**, abaikan dan lanjutkan ke langkah berikutnya.

---

### Langkah 6 — Izinkan Build Scripts

Karena pnpm versi baru memerlukan izin khusus untuk beberapa komponen, jalankan perintah berikut:

```
pnpm approve-builds
```

- Akan muncul daftar nama-nama komponen
- Tekan tombol **Spasi** di keyboard untuk memilih setiap baris (tandai semua)
- Setelah semua dipilih, tekan **Enter** untuk konfirmasi

> Jika perintah ini tidak menghasilkan daftar apapun (langsung kembali ke prompt), lewati saja ke langkah berikutnya.

---

### Langkah 7 — Build Installer

Perintah ini menghasilkan file `.exe` yang bisa diinstall di komputer Windows manapun:

```
pnpm --filter @workspace/electron-app run dist:win
```

- Proses ini memakan waktu **5-15 menit**
- Selama proses berjalan akan muncul banyak tulisan — biarkan saja, itu normal
- Tanda berhasil: muncul tulisan seperti `target=nsis` atau `built` di bagian akhir ✅
- Jika tiba-tiba berhenti, coba jalankan perintah yang sama sekali lagi — biasanya langsung lanjut

---

### Langkah 8 — Ambil File Installer

Setelah build selesai, file installer ada di folder:

```
Desktop\usahaku-app\artifacts\electron-app\release\
```

Cari file bernama **`Usahaku-Setup-x.x.x.exe`** (contoh: `Usahaku-Setup-1.0.9.exe`) — inilah file yang bisa dibagikan dan diinstall di komputer Windows manapun.

**Cara membuka folder tersebut:**
1. Buka **File Explorer** (ikon folder di taskbar)
2. Navigasi ke: `Desktop` → `usahaku-app` → `artifacts` → `electron-app` → `release`
3. File `.exe` ada di dalam folder `release` tersebut

---

### Masalah Umum Saat Build

| Masalah | Solusi |
|---------|--------|
| `pnpm: command not found` | Tutup dan buka ulang Command Prompt setelah install pnpm |
| `git: command not found` | Tutup dan buka ulang Command Prompt setelah install Git |
| `Error: EACCES permission denied` | Buka Command Prompt **sebagai Administrator** (klik kanan → Run as administrator) |
| `Cannot find module @rollup/rollup-win32-x64-msvc` | Jalankan: `pnpm add @rollup/rollup-win32-x64-msvc -w` lalu build ulang |
| `Cannot find module lightningcss.win32-x64-msvc` | Jalankan: `pnpm add lightningcss-win32-x64-msvc -w` lalu build ulang |
| `Cannot find native binding` dari `@tailwindcss/oxide` | Jalankan: `pnpm add @tailwindcss/oxide-win32-x64-msvc -w` lalu build ulang |
| `Ignored build scripts: bcrypt, electron` (pesan kuning) | Ini **normal**, bukan error — lanjutkan saja ke langkah berikutnya |
| Build terhenti tiba-tiba | Jalankan ulang perintah `dist:win` — biasanya langsung lanjut |
| File `.exe` tidak muncul | Cek apakah ada pesan `Error` di terminal, kirimkan ke pengembang |
| Antivirus memblokir proses | Sementara matikan antivirus, build ulang, lalu aktifkan kembali |
| `git pull` gagal: "local changes would be overwritten" | Jalankan: `git checkout -- package.json pnpm-lock.yaml` lalu `git pull` |

---

### Cara Update ke Versi Baru

Saat ada pembaruan kode di GitHub, cukup jalankan urutan perintah ini satu per satu:

```
git pull
pnpm install
pnpm approve-builds
pnpm --filter @workspace/electron-app run dist:win
```

> Tidak perlu install ulang Node.js, pnpm, atau Git — cukup 4 perintah di atas.

**Jika `git pull` gagal** dengan pesan "local changes would be overwritten":
```
git checkout -- package.json pnpm-lock.yaml
git pull
pnpm install
pnpm approve-builds
pnpm --filter @workspace/electron-app run dist:win
```

---

## Panduan Developer

### Prasyarat

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

### Build Windows Installer (.exe) — Tanpa Publish

Untuk build lokal tanpa upload ke GitHub Release:

```bash
pnpm --filter @workspace/electron-app run dist:win:nopublish
```

Output: `artifacts/electron-app/release/Usahaku-Setup-x.x.x.exe`

### Rilis Versi Baru ke Pengguna (via GitHub Actions)

Fitur **auto-update** sudah aktif — aplikasi yang terinstall di komputer pengguna akan otomatis mendeteksi versi baru dan menampilkan notifikasi untuk update.

Proses build dan upload `.exe` ditangani **otomatis oleh GitHub Actions** — tidak perlu build manual di Windows.

**Langkah rilis versi baru:**

1. Naikkan versi di `artifacts/electron-app/package.json`:
   ```json
   {
     "version": "1.0.9"
   }
   ```

2. Commit dan push ke GitHub:
   ```bash
   git add .
   git commit -m "chore: bump version to 1.0.9"
   git push origin main
   ```

3. Buat **GitHub Release** baru di https://github.com/ketanvpn/usahaku-app/releases :
   - Klik **Draft a new release**
   - **Tag**: ketik `v1.0.9` (harus diawali huruf `v`)
   - **Title**: `Usahaku v1.0.9`
   - Isi deskripsi perubahan (changelog)
   - Klik **Publish release**

4. GitHub Actions akan otomatis mulai build dalam beberapa menit
5. Setelah selesai (±10-15 menit), file `.exe` akan ter-upload otomatis ke release tersebut
6. Semua pengguna aktif akan otomatis mendapat notifikasi pembaruan di dalam aplikasi

> **Jangan upload .exe secara manual** ke release yang sama — biarkan GitHub Actions yang menangani.

### Icon Aplikasi

Icon aplikasi (logo hijau emerald bertuliskan "U") sudah di-embed langsung di dalam script build di `artifacts/electron-app/scripts/generate-icon.js`. Icon di-generate **otomatis setiap kali** `dist:win` dijalankan — tidak perlu menyiapkan file ICO secara manual.

Jika ingin mengganti icon:
1. Siapkan file PNG baru ukuran **512x512 piksel** (atau lebih besar)
2. Konversi ke format ICO di: https://cloudconvert.com/png-to-ico (pilih ukuran 16, 32, 48, 64, 128, 256)
3. Hapus file script lama: `artifacts/electron-app/scripts/generate-icon.js`
4. Taruh ICO hasil konversi sebagai: `artifacts/electron-app/assets/icon.ico`
5. Rebuild: `pnpm --filter @workspace/electron-app run dist:win`

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
| Auto-backup | `C:\Users\{nama}\AppData\Roaming\Usahaku\UsahakuBackup\` | Backup otomatis saat tutup app (default) |
| Token Google Drive | `C:\Users\{nama}\AppData\Roaming\Usahaku\gdrive-tokens.dat` | Token OAuth2 terenkripsi (hapus untuk disconnect manual) |
| Log aplikasi | `C:\Users\{nama}\AppData\Roaming\Usahaku\usahaku.log` | Log error & info |
| Database (dev) | `artifacts/api-server/data/app.db` | Data development |
| File Backup JSON | Pilihan user saat export | Hasil klik "Simpan File Backup" |
| Export Excel | Folder Unduhan | Hasil klik "Export Excel" di Laporan |
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
- [ ] Tidak ada blank screen yang lama (maks 30 detik loading)

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
- [ ] Klik Export Excel → file .xlsx terunduh dan terbaca di Excel

### Stok Barang
- [ ] Tambah barang baru → muncul di daftar
- [ ] Edit barang → tersimpan
- [ ] Tambah transaksi stok masuk → stok bertambah
- [ ] Tambah transaksi stok keluar → stok berkurang
- [ ] Barang stok di bawah minimum → ditandai merah

### Laporan & Export Excel
- [ ] Laporan tab Kasir menampilkan data
- [ ] Laporan tab Hutang menampilkan semua data hutang
- [ ] Filter status "Aktif" bekerja
- [ ] Filter "Lunas" bekerja
- [ ] Filter berdasarkan pelanggan bekerja
- [ ] Filter berdasarkan tanggal bekerja
- [ ] Reset filter mengembalikan semua data
- [ ] Klik "Export Excel" di setiap tab → file .xlsx terunduh
- [ ] File Excel berisi data yang benar dan bisa dibuka di Excel
- [ ] Klik "Cetak" → terbuka di browser default

### Backup & Restore
- [ ] Klik "Simpan File Backup" → dialog simpan muncul, file JSON tersimpan
- [ ] Upload file JSON → preview data muncul (jumlah pelanggan, hutang, pembayaran)
- [ ] Klik "Mulai Restore" + konfirmasi → data terganti
- [ ] Data setelah restore sesuai dengan isi backup
- [ ] Tutup aplikasi → file .db auto-backup tersimpan di folder auto-backup
- [ ] Klik "Pilih File Auto-Backup & Restore" → dialog konfirmasi muncul
- [ ] Pilih file .db → restore berhasil, aplikasi reload otomatis
- [ ] Jika pilih file .db yang rusak → muncul pesan error, data tidak berubah (auto-rollback)

### Backup Google Drive
- [ ] Klik "Hubungkan Google Drive" → browser terbuka ke halaman login Google
- [ ] Login Google + klik Izinkan → halaman sukses muncul di browser
- [ ] Kembali ke app → email akun Google tampil, status "Terhubung"
- [ ] Klik "Backup Sekarang" → muncul konfirmasi berhasil
- [ ] Klik "Lihat X backup di Drive" → daftar file backup tampil dengan tanggal & ukuran
- [ ] Klik "Pulihkan" + konfirmasi → data dipulihkan, app reload otomatis
- [ ] Klik "Putuskan Koneksi" → status kembali ke "Belum terhubung", Drive tidak berubah
- [ ] Biarkan app menyala 45 detik → auto-backup berjalan otomatis (cek log usahaku.log)

### Persistensi Data
- [ ] Tutup aplikasi
- [ ] Buka kembali aplikasi
- [ ] Login → semua data masih ada

### Auto-Update
- [ ] Rilis versi baru di GitHub
- [ ] Buka aplikasi versi lama → muncul notifikasi update tersedia
- [ ] Klik update → proses download dan install berjalan

### Super Admin
- [ ] Login admin → melihat daftar semua usaha
- [ ] Tambah usaha baru → muncul di daftar
- [ ] Melihat daftar semua user/owner
- [ ] Reset password owner → owner bisa login dengan password baru

### Ketahanan
- [ ] Nonaktifkan koneksi internet → aplikasi tetap berjalan normal
- [ ] Jalankan di PC berbeda (dengan install) → berfungsi normal

---

## Troubleshooting (Masalah Umum)

### Aplikasi stuck di layar loading / "Server tidak merespons"

**Penyebab**: Backend gagal start saat pertama buka.

**Langkah diagnosis**:
1. Lihat file log di: `C:\Users\{nama}\AppData\Roaming\Usahaku\buku-hutang.log`
2. Buka file tersebut dengan Notepad
3. Cari baris yang mengandung kata `[backend:err]` atau `FATAL`
4. Kirim isi log tersebut ke pengembang untuk analisis lebih lanjut

**Solusi umum**:
- Tutup aplikasi dan buka kembali
- Pastikan tidak ada aplikasi lain yang menggunakan port 8080
- Coba restart komputer, lalu buka aplikasi lagi
- Jika masih gagal, uninstall dan install ulang aplikasi

---

### Error: "Cannot find module better-sqlite3" atau database crash saat startup

**Penyebab**: Native module `better-sqlite3` tidak terkompilasi untuk Electron ABI yang benar.

**Solusi**: Pastikan build dilakukan dengan langkah yang benar:
```powershell
pnpm install
pnpm run dist:win
```

Perintah `dist:win` akan otomatis rebuild `better-sqlite3` untuk Electron ABI (`npmRebuild: true`).

**Jangan** copy manual file `better-sqlite3` dari folder lain — harus melalui proses build ini.

---

### Error: "Cannot find module 'bindings'"

**Sudah diperbaiki secara otomatis**: Proyek ini sudah menyertakan `bindings-stub` di `electron-app/assets/bindings-stub/`. Pastikan build dilakukan dari source code terbaru.

Jika masih error, cek log file:
```
C:\Users\{nama}\AppData\Roaming\Usahaku\buku-hutang.log
```

---

### Dialog error muncul saat pertama buka

| Error | Solusi |
|-------|--------|
| "File Aplikasi Tidak Ditemukan" | Uninstall dan install ulang |
| "Gagal Membuat Folder Data" | Periksa izin folder AppData |
| "Server tidak merespons setelah 30 detik" | Port 8080 mungkin dipakai app lain; coba restart PC |
| "Layanan Aplikasi Berhenti" | Lihat log di AppData, kirim ke pengembang |

---

### Data hilang setelah uninstall lalu install ulang

Data **tidak** dihapus saat uninstall. Data tersimpan di:
```
C:\Users\{nama}\AppData\Roaming\Usahaku\app.db
```
Saat install ulang, data lama otomatis digunakan kembali.

---

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
| Export Excel | SheetJS (xlsx) |
| Installer | electron-builder (NSIS) |
| CI/CD | GitHub Actions |
| Monorepo | pnpm workspaces |

---

## Riwayat Versi

| Versi | Keterangan |
|-------|-----------|
| 1.0.0 | Rilis awal — hutang, pembayaran, laporan, stok, keuangan |
| 1.0.1–1.0.6 | Perbaikan bug, stabilitas, auto-update |
| 1.0.7 | GitHub Actions auto-build & release diperbaiki |
| 1.0.8 | Fix: dialog crash palsu saat menutup aplikasi |
| 1.0.9 | Fitur: Export Excel di semua laporan, Restore dari auto-backup .db dengan pengaman rollback otomatis |
| 1.0.10 | Perbaikan: Restore JSON kini aman (database transaction), mendukung pindah PC, menampilkan nama usaha di preview |
