# Panduan Rilis Versi Baru — Usahaku by KetanTech

Ikuti langkah-langkah ini setiap kali ingin merilis pembaruan aplikasi ke pengguna.

---

## Langkah 1 — Push Kode ke GitHub (dari Shell Replit)

Jalankan perintah berikut di Shell Replit:

```
git add .
git commit -m "keterangan perubahan"
git push
```

> **Catatan git push:** GitHub tidak mendukung login pakai password biasa.
> Harus pakai **Personal Access Token (PAT)**.
>
> Cara setup PAT (cukup sekali):
> 1. Buka [github.com/settings/tokens](https://github.com/settings/tokens)
> 2. Klik **"Generate new token (classic)"** → centang scope **`repo`** → klik Generate
> 3. Copy token-nya, lalu jalankan di Shell Replit:
>    ```
>    git remote set-url origin https://TOKEN@github.com/ketanvpn/usahaku-app.git
>    ```
> 4. Setelah itu `git push` langsung jalan tanpa minta password lagi.

---

## Langkah 2 — Buat GitHub Release

1. Buka browser, pergi ke:
   ```
   https://github.com/ketanvpn/usahaku-app/releases
   ```

2. Klik tombol **"Draft a new release"**

3. Isi kolom **"Choose a tag"** → ketik versi baru misalnya `v1.0.54` → klik **"Create new tag"**

4. Isi kolom **"Release title"** → ketik `Usahaku v1.0.54`

5. Di kolom deskripsi, tulis apa saja yang berubah di versi ini
   (contoh: "Perbaikan bug tampilan" atau "Tambah fitur pengingat hutang")

6. Klik **"Publish release"**

---

## Langkah 3 — Tunggu Build Otomatis

Setelah release dipublish, **GitHub Actions otomatis akan:**
- Build installer Windows (`.exe`) di server GitHub
- Upload file installer ke release tersebut secara otomatis
- Tidak perlu build manual di komputer Windows

Pantau prosesnya di:
```
https://github.com/ketanvpn/usahaku-app/actions
```

Tunggu sampai statusnya **hijau (✓)**. Biasanya selesai dalam 5–10 menit.

Nomor versi di installer akan **otomatis sesuai dengan tag** yang dibuat — tidak perlu ubah `package.json` secara manual.

---

## Setelah Publish

Tidak perlu lakukan apa-apa lagi.

Aplikasi pengguna yang sudah terinstall akan:
- Otomatis cek update **10 detik setelah dibuka**
- Cek ulang setiap **6 jam**
- Tampilkan banner hijau saat ada versi baru
- Download dan install hanya dengan 2 klik

---

## Ringkasan Singkat

```
1. Edit kode di Replit
2. git add . && git commit -m "..." && git push
3. Buat GitHub Release dengan tag baru (misal v1.0.54)
4. Klik Publish release → GitHub Actions otomatis build & upload .exe
5. Tunggu ~10 menit → pengguna otomatis dapat notifikasi update
```

---

## Template Catatan Release (Biar Rapi)

Saat klik **Edit release** atau saat buat release baru, pakai template ini:

```md
## Perbaikan
- fix: ...
- fix: ...

## Peningkatan
- improve: ...

## Catatan
- ...
```

Contoh untuk v1.0.54:

```md
## Perbaikan
- fix: ringkasan keuangan (Total Masuk, Total Keluar, Saldo) sekarang tampil akumulasi semua waktu dan tidak hilang saat ganti bulan
- fix: cache rekap total ikut di-refresh setelah tambah/edit/hapus transaksi

## Catatan
- tabel transaksi, grafik, export CSV, dan cetak tetap mengikuti filter bulan/tahun
```

---

## Catat Versi Rilis (WAJIB)

Setiap selesai publish release, langsung catat ke file:

`CATATAN-RILIS.md`

Format isi yang dipakai:

```
| Versi | Tanggal | Status | Catatan Singkat |
| --- | --- | --- | --- |
| v1.0.54 | 2026-05-02 | Published | Perbaikan tab keuangan |
```

Tujuannya supaya riwayat versi rapi, gampang rollback, dan gampang cek user pakai versi berapa.

---

*Panduan ini berlaku untuk Usahaku by KetanTech — dibuat oleh KetanTech*
