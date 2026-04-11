# Panduan Rilis Versi Baru — Usahaku by KetanTech

Ikuti langkah-langkah ini setiap kali ingin merilis pembaruan aplikasi ke pengguna.

---

## Langkah 1 — Naikkan Nomor Versi

Buka file:
```
artifacts/electron-app/package.json
```

Ubah nomor versi:
```json
"version": "1.0.1"
```

> Gunakan format: BESAR.MINOR.PATCH
> Contoh: perbaikan kecil → 1.0.1, fitur baru → 1.1.0, perubahan besar → 2.0.0

---

## Langkah 2 — Push ke GitHub (dari Shell Replit)

```
git push
```

---

## Langkah 3 — Build Installer di Windows

Buka Command Prompt di folder project, jalankan:

```
git checkout -- package.json pnpm-lock.yaml
git pull
pnpm --filter @workspace/electron-app run dist:win
```

> Catatan: Jika `git pull` gagal dengan "local changes would be overwritten",
> jalankan dulu: `git checkout -- package.json pnpm-lock.yaml`

Setelah selesai, cari 3 file ini di folder:
```
artifacts\electron-app\release\
```

| File | Keterangan |
|------|------------|
| `Usahaku-Setup-1.0.1.exe` | Installer untuk pengguna baru |
| `Usahaku-Setup-1.0.1.exe.blockmap` | File teknis untuk proses update |
| `latest.yml` | Daftar versi terbaru (wajib ada) |

---

## Langkah 4 — Buat GitHub Release

1. Buka browser, pergi ke:
   ```
   https://github.com/ketanvpn/usahaku-app/releases
   ```

2. Klik tombol **"Draft a new release"**

3. Isi kolom **"Choose a tag"** → ketik `v1.0.1` → klik **"Create new tag"**

4. Isi kolom **"Release title"** → ketik `Usahaku v1.0.1`

5. Di kolom deskripsi, tulis apa saja yang berubah di versi ini
   (contoh: "Perbaikan bug tampilan" atau "Tambah fitur pengingat hutang")

6. Di bagian **"Attach binaries"**, upload ketiga file dari Langkah 3:
   - `Usahaku-Setup-1.0.1.exe`
   - `Usahaku-Setup-1.0.1.exe.blockmap`
   - `latest.yml`

7. Pastikan **"Set as latest release"** dicentang

8. Klik **"Publish release"**

---

## Setelah Publish

Tidak perlu lakukan apa-apa lagi.

Aplikasi pengguna yang sudah terinstall akan:
- Otomatis cek update **10 detik setelah dibuka**
- Cek ulang setiap **6 jam**
- Tampilkan banner hijau saat ada versi baru
- Download dan install hanya dengan 2 klik

---

## Untuk Rilis Pertama (v1.0.0)

Lakukan hal yang sama tapi dengan file dari build pertama Anda.
File `latest.yml` dan `.blockmap` sudah ada di folder `release\` dari build sebelumnya.

---

## Ringkasan Singkat

```
1. Ubah "version" di package.json
2. git push (dari Replit Shell)
3. git pull + dist:win (di Windows)
4. Buat GitHub Release, upload 3 file
5. Publish → pengguna otomatis dapat notifikasi
```

---

*Panduan ini berlaku untuk Usahaku by KetanTech — dibuat oleh KetanTech*
