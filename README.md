# Buku Hutang — Aplikasi Manajemen Hutang

Aplikasi web manajemen hutang untuk usaha kecil. Dibangun dengan React + Vite (frontend), Express + Drizzle ORM (backend), dan PostgreSQL (database).

---

## Fitur Utama

- **Dua Role Pengguna**: Super Admin (pengelola global) dan Owner (pengelola per-usaha)
- **Manajemen Pelanggan**: Tambah, edit, hapus dengan proteksi data (tidak bisa hapus jika masih ada hutang)
- **Manajemen Hutang**: Catat, edit, hapus hutang; status Aktif/Lunas otomatis dihitung
- **Manajemen Pembayaran**: Catat pembayaran, sisa hutang diperbarui otomatis; hapus pembayaran mengembalikan sisa
- **Dashboard**: Ringkasan statistik per usaha (owner) atau global (super admin)
- **Laporan**: Filter by pelanggan / status / tanggal, export CSV, cetak/print PDF (A4 landscape)
- **Backup & Restore**: Export JSON, restore dengan validasi dan preview data
- **Manajemen User & Usaha**: Super Admin bisa kelola semua user dan usaha
- **Ganti Password**: Owner bisa ganti password sendiri; Super Admin bisa reset password owner
- **Isolasi Data**: Owner hanya bisa akses data usahanya sendiri

---

## Akun Default

| Role        | Username  | Password   |
|-------------|-----------|------------|
| Super Admin | `admin`   | `admin123` |
| Owner       | `owner1`  | `owner123` |

---

## Cara Install & Run Lokal

### Prasyarat

- Node.js 18+
- pnpm 8+
- PostgreSQL (sudah tersedia via environment Replit)

### Install Dependensi

```bash
pnpm install
```

### Jalankan Aplikasi

```bash
# Jalankan backend API
pnpm --filter @workspace/api-server run dev

# Jalankan frontend (terminal terpisah)
pnpm --filter @workspace/hutang-app run dev
```

Atau via Replit: tekan tombol **Run** yang sudah dikonfigurasi.

Frontend tersedia di: `http://localhost:PORT` (PORT otomatis dari environment)  
Backend API di: `http://localhost:8080`

---

## Cara Backup & Restore

### Backup (Export)

1. Login sebagai Owner
2. Buka menu **Backup**
3. Klik **Unduh File Backup**
4. File JSON akan terunduh ke komputer (`backup_hutang_YYYY-MM-DD.json`)

### Restore (Import)

1. Buka menu **Backup**
2. Di bagian **Restore Data**, klik pilih file dan pilih file JSON backup
3. Preview data akan ditampilkan (jumlah pelanggan, hutang, pembayaran)
4. Klik **Mulai Restore**
5. Konfirmasi di dialog yang muncul
6. **Perhatian**: Restore akan menghapus semua data saat ini dan menggantinya dengan data backup

---

## Cara Cetak Laporan (PDF)

1. Login sebagai Owner
2. Buka menu **Laporan**
3. Terapkan filter jika diperlukan (pelanggan, status, periode)
4. Klik **Cetak / PDF**
5. Jendela baru akan terbuka dengan tampilan laporan siap cetak (A4 landscape)
6. Gunakan Print dialog browser untuk simpan sebagai PDF atau cetak ke printer

> **Catatan**: Pastikan pop-up blocker browser dimatikan untuk domain ini agar jendela cetak bisa terbuka.

---

## Catatan Role

### Super Admin
- Akses ke Dashboard Global (semua usaha)
- Kelola daftar Usaha (tambah, edit)
- Kelola semua User (tambah, edit, reset password, aktif/nonaktif, hapus)
- Tidak memiliki data hutang/pelanggan sendiri

### Owner
- Akses hanya ke data usahanya sendiri
- Kelola Pelanggan, Hutang, Pembayaran
- Lihat Laporan dan export data
- Backup & Restore data usaha
- Ganti password di halaman Profil
- Tidak bisa mengakses halaman admin

---

## Catatan Database

- Foreign key diaktifkan: hapus hutang akan menghapus semua pembayarannya (cascade)
- Hapus pelanggan hanya bisa jika tidak ada hutang (aktif maupun lunas) — harus hapus hutang dulu
- Status hutang (Aktif/Lunas) dihitung otomatis dari total pembayaran vs nominal hutang
- Semua query difilter per `usaha_id` untuk memastikan isolasi data antar usaha

---

## Saran untuk Versi Desktop (Windows)

Aplikasi ini sudah siap dikemas sebagai aplikasi desktop menggunakan **Electron** atau **Tauri**:

1. **Electron**: Wrap tampilan web (`localhost`) dalam window Electron; bundel Node.js backend bersama executable
2. **Tauri** (lebih ringan): Frontend web + backend Rust untuk I/O; deploy lebih kecil
3. Untuk database: Gunakan **SQLite** sebagai alternatif PostgreSQL agar tidak perlu install DB terpisah (Drizzle ORM mendukung SQLite)
4. Instalasi bisa dibuat dengan **electron-builder** (Windows `.exe` installer / portable)

Langkah utama:
- Ganti koneksi PostgreSQL ke SQLite untuk mode offline/desktop
- Buat window Electron yang menjalankan Express backend dan serve frontend
- Build dengan `electron-builder` untuk installer Windows
