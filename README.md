# 📒 Buku Hutang

**Aplikasi Manajemen Hutang Desktop untuk Usaha Kecil**

Buku Hutang membantu Anda mencatat hutang pelanggan, pembayaran, dan laporan secara rapi — langsung di komputer Windows, tanpa internet, tanpa server, tanpa biaya langganan.

---

## Daftar Isi

- [Fitur Utama](#fitur-utama)
- [Akun Default](#akun-default)
- [Panduan Pengguna Windows](#panduan-pengguna-windows)
- [Panduan Developer](#panduan-developer)
- [Lokasi File Penting](#lokasi-file-penting)
- [Checklist Pengujian Final](#checklist-pengujian-final)

---

## Fitur Utama

| Fitur | Keterangan |
|-------|-----------|
| Catat Pelanggan | Tambah, edit, hapus data pelanggan |
| Catat Hutang | Nominal, tanggal, keterangan per pelanggan |
| Catat Pembayaran | Pembayaran sebagian maupun lunas |
| Status Otomatis | Status Aktif / Lunas dihitung otomatis |
| Laporan | Filter tanggal, pelanggan, status |
| Export CSV | Unduh data ke Excel/spreadsheet |
| Cetak PDF | Print laporan langsung dari aplikasi |
| Backup Data | Export semua data ke file JSON |
| Restore Data | Pulihkan data dari file backup |
| Multi Usaha | Super Admin kelola banyak toko/usaha |
| Offline 100% | Tidak butuh internet sama sekali |

---

## Akun Default

| Role | Username | Password | Akses |
|------|----------|----------|-------|
| Super Admin | `admin` | `admin123` | Kelola semua usaha & pengguna |
| Owner | `owner1` | `owner123` | Kelola usaha sendiri |

> Ganti password setelah login pertama kali melalui menu **Profil**.

---

## Panduan Pengguna Windows

### Instalasi Aplikasi

1. Jalankan file **BukuHutang-Setup-1.0.0.exe**
2. Klik **Next** / **Lanjut** di setiap langkah
3. Pilih lokasi instalasi (default sudah tepat)
4. Centang **Create Desktop Shortcut** agar ada ikon di Desktop
5. Klik **Install**
6. Setelah selesai, klik **Finish**

### Membuka Aplikasi

- Klik dua kali ikon **Buku Hutang** di Desktop
- Atau cari "Buku Hutang" di Start Menu Windows

### Pertama Kali Buka

1. Layar biru dengan tulisan **"Memuat aplikasi, harap tunggu..."** akan muncul sebentar — ini normal
2. Tunggu sampai halaman login muncul (biasanya 3-10 detik)
3. Login dengan akun Owner atau Super Admin

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
5. Status hutang berubah otomatis menjadi **Lunas** jika sudah terbayar penuh

### Melihat Laporan

1. Klik menu **Laporan**
2. Gunakan filter di atas tabel untuk menyaring berdasarkan:
   - Pelanggan tertentu
   - Status (Aktif / Lunas / Semua)
   - Periode tanggal
3. Klik **Reset Filter** untuk kembali ke tampilan semua data

### Export CSV (ke Excel)

1. Buka menu **Laporan**
2. Atur filter sesuai kebutuhan (opsional)
3. Klik tombol **Unduh CSV**
4. File akan tersimpan di folder **Unduhan** komputer Anda
5. Buka file tersebut di Excel atau Google Sheets

### Cetak Laporan (PDF)

1. Buka menu **Laporan**
2. Klik tombol **Cetak / PDF**
3. Jendela cetak akan terbuka
4. Pilih printer atau **Save as PDF**
5. Klik **Print / Cetak**

> Pastikan pop-up blocker browser tidak aktif (tidak berlaku di mode desktop).

### Backup Data

1. Klik menu **Backup**
2. Klik **Unduh File Backup**
3. File JSON tersimpan di folder **Unduhan** komputer Anda
4. Simpan file ini di tempat aman (flashdisk, Google Drive, dll.)
5. Beri nama file yang mudah diingat, misalnya: `backup_januari_2025.json`

> **Disarankan**: Backup data secara rutin, misalnya setiap minggu.

### Restore Data dari Backup

1. Klik menu **Backup**
2. Scroll ke bagian **Restore Data**
3. Klik **Pilih File Backup** dan pilih file JSON backup Anda
4. Preview data akan ditampilkan (jumlah pelanggan, hutang, pembayaran)
5. Klik **Mulai Restore**
6. Konfirmasi di dialog yang muncul
7. **Perhatian**: Restore akan menggantikan seluruh data saat ini

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

### Build Windows Installer (.exe)

```bash
# Harus dijalankan di mesin Windows dengan Node.js terinstall
pnpm --filter @workspace/electron-app run dist:win
```

Output: `artifacts/electron-app/release/BukuHutang-Setup-1.0.0.exe`

### Menambah Icon Aplikasi

1. Siapkan file gambar PNG ukuran **512x512 piksel** (atau lebih besar)
2. Konversi ke format ICO di: https://cloudconvert.com/png-to-ico (pilih ukuran 16, 32, 48, 128, 256)
3. Taruh file sebagai: `artifacts/electron-app/assets/icon.ico`
4. Rebuild: `pnpm --filter @workspace/electron-app run build:desktop`

File SVG placeholder sudah tersedia di: `artifacts/electron-app/assets/icon.svg`

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
| Database (desktop) | `C:\Users\{nama}\AppData\Roaming\Buku Hutang\app.db` | Data utama |
| Database (dev) | `artifacts/api-server/data/app.db` | Data development |
| File Backup | Folder Unduhan | Setelah klik "Unduh Backup" |
| Export CSV | Folder Unduhan | Setelah klik "Unduh CSV" |
| Installer | `artifacts/electron-app/release/` | Hasil `dist:win` |
| Icon | `artifacts/electron-app/assets/icon.ico` | Untuk build installer |

### Database Mode Desktop (Windows)

Saat aplikasi dijalankan sebagai installer, database tersimpan di:

```
C:\Users\{nama_pengguna}\AppData\Roaming\Buku Hutang\app.db
```

Folder ini **tidak ikut terhapus** saat uninstall, sehingga data tetap aman.

---

## Checklist Pengujian Final

Gunakan checklist ini sebelum mendistribusikan ke pengguna:

### Instalasi & Startup
- [ ] Installer berjalan tanpa error
- [ ] Ikon muncul di Desktop dan Start Menu
- [ ] Aplikasi terbuka — muncul layar loading biru
- [ ] Layar login muncul dalam 10 detik
- [ ] Tidak ada blank screen yang lama

### Login & Autentikasi
- [ ] Login Super Admin: `admin` / `admin123` → masuk ke dashboard admin
- [ ] Login Owner: `owner1` / `owner123` → masuk ke dashboard owner
- [ ] Logout berfungsi — kembali ke halaman login
- [ ] Login ulang berfungsi

### Manajemen Data (Owner)
- [ ] Tambah pelanggan baru → muncul di daftar
- [ ] Edit nama/telepon pelanggan → tersimpan
- [ ] Tambah hutang untuk pelanggan → status "Aktif"
- [ ] Tambah pembayaran sebagian → sisa hutang berkurang
- [ ] Tambah pembayaran penuh → status berubah "Lunas"
- [ ] Hapus pembayaran → sisa hutang kembali
- [ ] Coba hapus pelanggan yang masih punya hutang → muncul pesan error (tidak bisa dihapus)
- [ ] Hapus hutang → berhasil
- [ ] Hapus pelanggan yang tidak punya hutang → berhasil

### Laporan & Export
- [ ] Laporan menampilkan semua data hutang
- [ ] Filter status "Aktif" bekerja
- [ ] Filter "Lunas" bekerja
- [ ] Filter berdasarkan pelanggan bekerja
- [ ] Filter berdasarkan tanggal bekerja
- [ ] Reset filter mengembalikan semua data
- [ ] Klik "Unduh CSV" → file terunduh
- [ ] Buka CSV di Excel → data terbaca dengan benar
- [ ] Klik "Cetak / PDF" → jendela print terbuka

### Backup & Restore
- [ ] Klik "Unduh File Backup" → file JSON terunduh
- [ ] Buka kembali menu Backup
- [ ] Upload file JSON → preview data muncul
- [ ] Klik "Mulai Restore" + konfirmasi → data terganti
- [ ] Data setelah restore sesuai dengan isi backup

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
1. Lihat file log di: `C:\Users\{nama}\AppData\Roaming\Buku Hutang\buku-hutang.log`
2. Cari baris `[backend:err]` atau `FATAL` di log tersebut
3. Kirim isi log tersebut ke pengembang untuk analisis lebih lanjut

**Solusi umum**:
- Tutup aplikasi dan buka kembali
- Pastikan tidak ada aplikasi lain yang menggunakan port 8080
- Coba restart komputer, lalu buka aplikasi lagi
- Jika masih gagal, uninstall dan install ulang aplikasi

### Dialog error muncul saat pertama buka

**Kemungkinan penyebab dan solusi**:

| Error | Solusi |
|-------|--------|
| "File Aplikasi Tidak Ditemukan" | Uninstall dan install ulang |
| "Gagal Membuat Folder Data" | Periksa izin folder AppData (biasanya izin administrator) |
| "Server tidak merespons setelah 30 detik" | Port 8080 mungkin dipakai app lain; coba restart PC |
| "Layanan Aplikasi Berhenti" (saat sudah jalan) | Lihat log di AppData, kirim ke pengembang |

### Data hilang setelah uninstall lalu install ulang

Data **tidak** dihapus saat uninstall. Data tersimpan di:
```
C:\Users\{nama}\AppData\Roaming\Buku Hutang\app.db
```
Saat install ulang, data lama otomatis digunakan kembali.

### Lupa password

Hubungi Super Admin untuk melakukan reset password melalui menu **Admin → Kelola User**.

Super Admin bisa reset password di: *Admin → Users → Edit User → Reset Password*

---

## Catatan Keamanan

- Tidak ada data yang dikirim ke internet — semua tersimpan lokal
- Database SQLite terenkripsi di folder AppData pengguna
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
