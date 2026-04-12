# Panduan Kerja Proyek Usahaku
> Dari buka Replit baru sampai rilis versi baru

---

## BAGIAN 1 — Pertama Kali di Device/Akun Replit Baru

### Langkah 1: Buka Replit
- Buka https://replit.com dan login dengan akun Anda
- Klik tombol **"+ Create Repl"** di pojok kiri atas

### Langkah 2: Import dari GitHub
- Pilih tab **"Import from GitHub"**
- Masukkan URL repo: `https://github.com/ketanvpn/usahaku-app`
- Klik **"Import from GitHub"**
- Tunggu sampai selesai loading (bisa 1-2 menit)

### Langkah 3: Setup Git (lakukan sekali saja di akun baru)
Buka **Shell** di Replit, ketik satu per satu:
```
git config user.email "email_github_anda@gmail.com"
git config user.name "Nama Anda"
```
> Ganti dengan email dan nama akun GitHub Anda yang sebenarnya

### Langkah 4: Hubungkan ke GitHub
- Klik ikon **Git** di sidebar kiri Replit
- Kalau diminta login GitHub, ikuti prosesnya sampai selesai
- Pastikan remote sudah benar dengan ketik di Shell:
```
git remote -v
```
Harus muncul: `origin  https://github.com/ketanvpn/usahaku-app`

---

## BAGIAN 2 — Setiap Kali Mulai Kerja

### Langkah 5: Ambil kode terbaru dari GitHub
Sebelum mulai edit apapun, selalu lakukan ini di Shell:
```
git pull origin main
```
> Ini memastikan Anda punya versi terbaru, apalagi kalau terakhir kerja di device lain

### Langkah 6: Jalankan aplikasi
Klik tombol **Run** atau pastikan workflow sudah jalan:
- **Backend API** — harus running
- **Start application** — harus running

Kalau belum jalan, klik tombol play di samping nama workflow masing-masing.

### Langkah 7: Mulai ngobrol dengan AI (Replit Agent)
- Klik ikon **Agent** di sidebar
- Ceritakan apa yang mau ditambah atau diperbaiki
- Contoh: *"Tambahkan fitur ekspor laporan ke PDF"*
- Biarkan Agent bekerja, nanti dikabari kalau selesai

---

## BAGIAN 3 — Setiap Kali Selesai Kerja

### Langkah 8: Simpan perubahan ke GitHub (WAJIB sebelum tutup)
Buka Shell, ketik:
```
git add .
git commit -m "tulis keterangan singkat apa yang diubah"
git push origin main
```

Contoh keterangan commit yang bagus:
- `"tambah fitur ekspor PDF laporan keuangan"`
- `"perbaiki bug tombol hapus hutang"`
- `"update tampilan halaman utama"`

> ⚠️ PENTING: Kalau lupa push, perubahan tidak tersimpan di GitHub dan tidak bisa dilanjutkan di device lain!

---

## BAGIAN 4 — Cara Rilis Versi Baru

Lakukan ini kalau sudah siap rilis ke pengguna.

### Langkah 9: Update nomor versi
Buka file `artifacts/electron-app/package.json`, ubah bagian ini:
```json
"version": "1.0.7"
```
Ganti angkanya sesuai versi baru, misal `"1.0.8"`

### Langkah 10: Push ke GitHub
```
git add .
git commit -m "release: versi 1.0.8"
git push origin main
```

### Langkah 11: Buat Release di GitHub
1. Buka https://github.com/ketanvpn/usahaku-app
2. Klik **"Releases"** di sidebar kanan
3. Klik **"Draft a new release"**
4. Klik **"Choose a tag"** → ketik `v1.0.8` → klik **"Create new tag: v1.0.8"**
5. Isi **Release title**: `Usahaku v1.0.8`
6. Isi deskripsi perubahan (opsional)
7. Klik **"Publish release"**

### Langkah 12: Tunggu GitHub Actions
- Setelah publish, buka tab **"Actions"** di GitHub
- Akan muncul workflow baru yang sedang berjalan (lingkaran kuning)
- Tunggu sampai jadi centang hijau ✅ (sekitar 3-5 menit)
- File `.exe` otomatis ter-upload ke release

### Langkah 13: Verifikasi
- Kembali ke halaman **Releases**
- Buka release v1.0.8
- Pastikan ada file `Usahaku-Setup-1.0.8.exe` dan `latest.yml`
- Selesai! Pengguna bisa download atau update otomatis

---

## CATATAN PENTING

| Hal | Yang Harus Dilakukan |
|-----|---------------------|
| Ganti device | `git pull` dulu sebelum mulai |
| Selesai kerja | Selalu `git push` sebelum tutup |
| Upload .exe manual | ❌ JANGAN — biarkan GitHub Actions yang upload |
| Lupa push | Perubahan hilang kalau Replit di-reset |

---

## RINGKASAN CEPAT

**Mulai kerja:**
```
git pull origin main
```

**Selesai kerja:**
```
git add .
git commit -m "keterangan"
git push origin main
```

**Rilis versi baru:**
1. Update versi di `package.json`
2. Push ke GitHub
3. Buat release baru di GitHub → Publish
4. Tunggu Actions selesai ✅
