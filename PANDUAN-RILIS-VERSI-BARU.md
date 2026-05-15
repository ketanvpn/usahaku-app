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

5. Klik **"Generate release notes"** dulu (otomatis ambil perubahan dari commit/PR)

6. Rapikan hasil generate pakai format ringkas:
   - `fix: ...`
   - `improve: ...`
   - `note: ...`

7. Klik **"Publish release"**

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

## Troubleshooting Build Gagal di GitHub Actions

Kalau build di GitHub Actions tiba-tiba gagal padahal kode tidak diubah, biasanya penyebabnya **environment runner GitHub yang berubah**. Workflow `.github/workflows/build-release.yml` sudah di-set defensif (windows-2022 + setup-msbuild + retry install), tapi kalau masih gagal cek pola error berikut:

### Pola 1: `better-sqlite3 install gagal: could not find any Visual Studio installation`

**Penyebab:** Image runner GitHub di-upgrade ke versi Visual Studio yang lebih baru dari yang dikenali `node-gyp`. Pernah kejadian di v1.0.87 saat `windows-latest` migrasi ke VS 2026.

**Cara fix:**
1. Cek `.github/workflows/build-release.yml` — pastikan `runs-on: windows-2022` (bukan `windows-latest`).
2. Pastikan ada step `microsoft/setup-msbuild@v2` setelah Setup Node.js di kedua job.
3. Pastikan env `npm_config_msvs_version: "2022"` ada di top-level workflow.
4. Kalau `windows-2022` di-deprecate Microsoft (biasanya ada heads-up 6-12 bulan), pindah ke runner berikutnya yang masih support — `windows-2025` saat itu menjadi jagoannya.

### Pola 2: `prebuild-install warn install Request timed out`

**Penyebab:** `better-sqlite3` coba download prebuilt binary dari GitHub Releases, tapi koneksi runner timeout. Ini sporadis — kadang sukses, kadang tidak.

**Cara fix:** Workflow sudah punya retry 3x untuk `pnpm install`. Kalau retry juga gagal semua 3x, biasanya ini masalah jaringan GitHub yang sedang turun. Tunggu 30 menit, lalu re-run job (di tab Actions, klik run yang gagal → Re-run failed jobs).

### Pola 3: `Lockfile is not up to date with package.json`

**Penyebab:** `pnpm-lock.yaml` tidak match dengan `package.json` setelah ada perubahan dependency. Biasa terjadi kalau ada commit yang ubah dependency di package.json tapi lupa commit lock-file-nya.

**Cara fix:** Lokal jalankan `pnpm install` (tanpa `--frozen-lockfile`) → commit `pnpm-lock.yaml` yang ter-update → push.

### Apa yang harus dilakukan kalau build gagal di tag yang sudah ada?

Kalau release sudah ke-publish tapi build gagal:

1. **Push fix ke `main`** (workflow tidak akan auto-trigger karena tidak ada release event baru, jadi tidak perlu khawatir double-build).
2. **Pindah tag ke commit fix.** Lewat git lokal:
   ```
   git tag -d v1.0.XX
   git push origin :refs/tags/v1.0.XX
   git tag v1.0.XX <commit-hash-fix>
   git push origin v1.0.XX
   ```
3. **Hapus release lama di GitHub** (Releases → klik release → Delete release; **JANGAN delete tag** karena tag sudah pindah ke commit yang benar).
4. **Re-create release dari tag yang sama** → Publish → workflow auto-trigger lagi dengan code yang sudah ada fix.

Aman dilakukan **kalau release lama belum punya installer ter-upload** (build pertama gagal). Kalau installer sudah ada dan user mungkin sudah download, jangan pindah tag — buat versi baru saja (v1.0.XX+1) dengan fix-nya.

---

*Panduan ini berlaku untuk Usahaku by KetanTech — dibuat oleh KetanTech*
