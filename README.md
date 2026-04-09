# Buku Hutang — Aplikasi Manajemen Hutang

Aplikasi web manajemen hutang untuk usaha kecil. Dibangun dengan React + Vite (frontend), Express + Drizzle ORM (backend), dan **SQLite** (database lokal, tanpa instalasi server database).

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
- **Mode Offline**: Menggunakan SQLite — tidak butuh server database eksternal

---

## Akun Default

| Role        | Username  | Password   |
|-------------|-----------|------------|
| Super Admin | `admin`   | `admin123` |
| Owner       | `owner1`  | `owner123` |

---

## Database SQLite

### Lokasi File Database

```
artifacts/api-server/data/app.db
```

File ini dibuat **otomatis** saat pertama kali aplikasi dijalankan. Tidak perlu setup database sama sekali.

### File Penting untuk Backup Manual

| File | Keterangan |
|------|-----------|
| `artifacts/api-server/data/app.db` | Database utama SQLite |
| `artifacts/api-server/data/app.db-shm` | Shared memory (pendamping WAL) |
| `artifacts/api-server/data/app.db-wal` | Write-Ahead Log (aktif saat dijalankan) |

> **Tips**: Untuk backup penuh, salin ketiga file sekaligus saat aplikasi dalam keadaan berhenti. Atau gunakan fitur **Backup JSON** di dalam aplikasi.

### Cara Reset Database

Hapus file SQLite dan restart aplikasi — seed data akan dibuat ulang otomatis:

```bash
rm -f artifacts/api-server/data/app.db*
pnpm --filter @workspace/api-server run dev
```

### Cara Seed Ulang

Reset database seperti di atas. Seed dijalankan otomatis saat startup (hanya jika data belum ada).

---

## Cara Install & Run Lokal

### Prasyarat

- Node.js 18+
- pnpm 8+
- **Tidak perlu PostgreSQL** — database otomatis menggunakan SQLite

### Install Dependensi

```bash
pnpm install
```

### Jalankan Aplikasi (Mode Pengembangan)

```bash
# Terminal 1: Backend API
pnpm --filter @workspace/api-server run dev

# Terminal 2: Frontend
pnpm --filter @workspace/hutang-app run dev
```

Frontend: `http://localhost:PORT` (PORT dari environment)  
Backend API: `http://localhost:8080`

> Di Replit: tekan tombol **Run** yang sudah dikonfigurasi — semua berjalan otomatis.

### Variabel Environment

| Variabel | Default | Keterangan |
|----------|---------|-----------|
| `DATABASE_PATH` | `{cwd}/data/app.db` | Path file SQLite |
| `SESSION_SECRET` | fallback string | Secret untuk session cookie |
| `PORT` | wajib diisi | Port backend |

---

## Cara Backup & Restore

### Backup (Export JSON)

1. Login sebagai Owner
2. Buka menu **Backup**
3. Klik **Unduh File Backup**
4. File JSON terunduh: `backup_hutang_YYYY-MM-DD.json`

### Restore (Import JSON)

1. Buka menu **Backup**
2. Di bagian **Restore Data**, pilih file JSON backup
3. Preview ditampilkan: jumlah pelanggan, hutang, pembayaran yang akan diimport
4. Klik **Mulai Restore** → konfirmasi
5. ⚠️ Restore menghapus semua data saat ini dan menggantinya dengan data backup

### Backup File SQLite Langsung

Salin file `data/app.db` (dan `app.db-shm`, `app.db-wal`) ke tempat aman saat aplikasi berhenti. Ini adalah backup penuh yang bisa dipulihkan dengan mengganti file.

---

## Cara Cetak Laporan (PDF)

1. Login sebagai Owner → buka **Laporan**
2. Terapkan filter jika diperlukan
3. Klik **Cetak / PDF**
4. Jendela baru terbuka — gunakan Print dialog browser untuk simpan PDF

> Pastikan popup blocker dinonaktifkan untuk domain ini.

---

## Catatan Role

### Super Admin
- Dashboard Global (semua usaha)
- Kelola daftar Usaha (tambah, edit)
- Kelola semua User (tambah, edit, reset password, aktif/nonaktif, hapus)

### Owner
- Data usahanya sendiri saja
- Kelola Pelanggan, Hutang, Pembayaran
- Laporan, CSV export, print
- Backup & Restore
- Ganti password di Profil

---

## Catatan Database

- **SQLite** dengan WAL mode (performa tinggi, aman dari data corruption)
- **Foreign key diaktifkan** — hapus hutang cascade hapus pembayarannya
- **Proteksi hapus pelanggan**: hanya bisa dihapus jika tidak ada hutang (aktif maupun lunas)
- **Status hutang** (Aktif/Lunas) dihitung otomatis dari total pembayaran vs nominal
- Semua query difilter per `usaha_id` untuk isolasi data antar usaha

---

## Kesiapan Desktop (Electron)

Aplikasi ini sudah **siap** untuk dikemas sebagai aplikasi desktop:

| Aspek | Status | Catatan |
|-------|--------|---------|
| Database lokal (SQLite) | ✅ Selesai | Tidak butuh server eksternal |
| Backend tanpa cloud | ✅ Selesai | Pure Node.js + SQLite |
| Frontend buildable | ✅ Siap | React + Vite |
| No external dependencies | ✅ | Semua berjalan lokal |
| Entry point backend | `artifacts/api-server/dist/index.mjs` | Entry untuk Electron |
| Entry point frontend | `artifacts/hutang-app/dist/index.html` | Setelah `vite build` |

### Langkah Menuju Electron

```
1. npm run build (atau pnpm build semua packages)
2. Buat package electron dengan main process yang:
   - Spawn Express server dari dist/index.mjs
   - Buka BrowserWindow ke localhost:{port}
3. Build installer dengan electron-builder
4. Hasilkan .exe (Windows) atau .dmg (macOS)
```

> Database SQLite akan tersimpan di folder AppData pengguna (Windows) atau ~/Library (macOS) saat dikemas dengan Electron.

---

## Stack Teknologi

| Layer | Teknologi |
|-------|-----------|
| Frontend | React 19 + Vite + Tailwind CSS |
| Backend | Express 5 + TypeScript |
| Database | SQLite (better-sqlite3) + Drizzle ORM |
| Auth | express-session + bcrypt |
| Monorepo | pnpm workspaces |
| Build | esbuild (backend), Vite (frontend) |
