# Prompt untuk Replit Baru
> Copy-paste teks di bawah ini ke Replit Agent saat pertama kali buka proyek di device/akun baru

---

## TEKS PROMPT (copy dari sini):

```
Halo! Ini adalah proyek aplikasi desktop "Usahaku by KetanTech" yang sudah berjalan.
Tolong pelajari dulu kondisi proyeknya sebelum kita mulai.

Ringkasan proyek:
- Nama aplikasi: Usahaku by KetanTech
- Tujuan: Aplikasi manajemen bisnis untuk UMKM/warung Indonesia, bisa offline
- Platform: Desktop Windows (Electron), bisa auto-update
- Stack: React + Vite (frontend), Express + SQLite (backend), Electron (desktop wrapper)
- Struktur: pnpm monorepo

Fitur yang sudah ada:
- Manajemen hutang (tambah, bayar, riwayat)
- Keuangan (pemasukan & pengeluaran)
- Inventori & stok barang
- POS (kasir sederhana)
- Laporan
- Backup & restore data (manual + otomatis)
- Auto-update aplikasi via GitHub Releases
- Reminder backup kalau sudah 7 hari tidak backup

Cara rilis versi baru:
1. Update versi di artifacts/electron-app/package.json
2. git push ke GitHub
3. Buat release baru di https://github.com/ketanvpn/usahaku-app
4. GitHub Actions otomatis build dan upload .exe

Yang perlu kamu ketahui:
- Bahasa UI: Indonesia
- Target pengguna: orang kampung/non-teknis, jadi UI harus simpel dan jelas
- Jangan ubah fitur yang sudah ada kecuali diminta
- Selalu ingatkan saya untuk git push setelah selesai kerja
- Repo GitHub: https://github.com/ketanvpn/usahaku-app

Sekarang saya ingin: [TULIS PERMINTAAN ANDA DI SINI]
```

---

## CARA PAKAI:

1. Buka Replit Agent di proyek yang baru di-import
2. Copy seluruh teks di dalam kotak di atas
3. Ganti bagian **`[TULIS PERMINTAAN ANDA DI SINI]`** dengan apa yang mau dikerjakan
4. Paste dan kirim ke Agent

**Contoh permintaan:**
- `Sekarang saya ingin: tambahkan fitur cetak struk di halaman POS`
- `Sekarang saya ingin: perbaiki tampilan halaman laporan di layar kecil`
- `Sekarang saya ingin: update versi ke 1.0.8 dan siapkan rilis baru`
