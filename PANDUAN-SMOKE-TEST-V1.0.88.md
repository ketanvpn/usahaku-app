# Panduan Smoke Test Usahaku v1.0.88

Tujuan: memastikan fitur **logo embed di backup** (yang baru di v1.0.88) jalan
benar di mesin user beneran, sebelum kita lanjut ke fitur baru.

> Centang `[x]` di tiap langkah yang sudah berhasil. Kalau gagal, catat di
> bagian **Catatan Bug** di bawah, jangan lanjutkan tes berikutnya — lapor
> dulu supaya bisa di-hot-fix sebagai v1.0.89.

---

## Persiapan

- [ ] **P1.** Pastikan versi app yang terinstal = **1.0.88**.
  Cek di sidebar bawah: tulisan "Versi 1.0.88 — Cek Pembaruan".
  Kalau bukan: klik "Cek Pembaruan" → restart app sampai jadi 1.0.88.
- [ ] **P2.** Login sebagai owner.
- [ ] **P3.** Siapkan 1 file logo (PNG atau JPG, ukuran < 1 MB) di Desktop
  untuk diupload nanti. Logo apa saja boleh — yang penting ada gambarnya.

---

## Tes 1 — Round-trip logo (1 mesin) **[PRIORITAS UTAMA]**

Cek apakah logo benar-benar masuk ke file backup, dan benar-benar bisa
dikembalikan dari file backup.

### 1.1 Upload logo & cek tampil di struk

- [ ] **1.1.a** Buka menu **Pengaturan** (sidebar SISTEM).
- [ ] **1.1.b** Pindah ke tab **Data Usaha**.
  Pastikan nama_usaha, alamat, telepon sudah terisi (kalau belum, isi dulu
  dan klik Simpan).
- [ ] **1.1.c** Pindah ke tab **Struk & Cetak**.
- [ ] **1.1.d** Klik **Pilih File** di kotak Logo → pilih file logo dari Desktop.
- [ ] **1.1.e** Pastikan toggle **"Tampilkan logo di struk"** dalam keadaan ON.
- [ ] **1.1.f** Klik tombol **Simpan**.
- [ ] **1.1.g** Lihat panel **Pratinjau Struk** di sebelah kanan — logo harus
  tampil di bagian atas struk.

### 1.2 Export backup .json (versi 1.9 — yang ada logonya)

- [ ] **1.2.a** Buka menu **Backup & Restore** (sidebar SISTEM).
- [ ] **1.2.b** Cari kartu **"Simpan Cadangan"** (icon download biru, kolom kiri).
- [ ] **1.2.c** Klik tombol **"Simpan File Cadangan..."**.
- [ ] **1.2.d** Akan muncul dialog Windows "Save As". Simpan dengan nama
  yang gampang diingat, misal `tes-v1.9.json`. Lokasinya bebas (Desktop OK).
- [ ] **1.2.e** Tunggu sampai muncul toast hijau "Backup berhasil disimpan".

### 1.3 Cek isi file backup (yang ini paling penting)

- [ ] **1.3.a** Buka file `tes-v1.9.json` di Notepad atau VS Code.
  (Kalau Notepad lambat membuka, pakai VS Code.)
- [ ] **1.3.b** Cari kata `"version"` di baris atas (Ctrl+F).
  Harus ada baris: `"version": "1.9",`
  Kalau masih `"1.8"` atau `"1.7"` → **fitur tidak jalan, lapor!**
- [ ] **1.3.c** Cari kata `logo_base64` (Ctrl+F).
  Harus ada baris: `"logo_base64": "iVBORw0KGgo..."` (string panjang sekali).
  Kalau **tidak ada** → fitur tidak jalan, lapor.
- [ ] **1.3.d** Cari kata `logo_ext`. Harus ada: `"logo_ext": "png"` atau `"jpg"`.
- [ ] **1.3.e** Tutup file (jangan diedit).

### 1.4 Hapus logo, lalu restore dari file backup

- [ ] **1.4.a** Kembali ke menu **Pengaturan** → tab **Struk & Cetak**.
- [ ] **1.4.b** Klik tombol **Hapus Logo** di kotak logo.
- [ ] **1.4.c** Pastikan panel Pratinjau di kanan **TIDAK** menampilkan logo
  lagi (struk tampil tanpa gambar di atas).
- [ ] **1.4.d** Klik **Simpan**.
- [ ] **1.4.e** Buka menu **Backup & Restore** → kartu **"Pulihkan Data"**
  (kolom kanan).
- [ ] **1.4.f** Klik tombol **Pilih File** (atau "Choose File"), pilih file
  `tes-v1.9.json` yang tadi.
- [ ] **1.4.g** Cek di area Preview muncul jumlah pelanggan/hutang/pembayaran
  (artinya file dikenali).
- [ ] **1.4.h** Klik tombol **Mulai Pulihkan**.
- [ ] **1.4.i** Konfirmasi di dialog "Ya, Pulihkan Sekarang".
- [ ] **1.4.j** Tunggu toast hijau "Restore data berhasil!".

### 1.5 Cek logo otomatis muncul lagi

- [ ] **1.5.a** Kembali ke **Pengaturan** → tab **Struk & Cetak**.
- [ ] **1.5.b** **Logo harus tampil lagi di kotak Logo** (filename baru
  hasil restore, biasanya format `logo-<timestamp>.png`).
- [ ] **1.5.c** Panel Pratinjau Struk juga harus menampilkan logo lagi.
- [ ] **1.5.d** Buka menu **Kasir** → buat 1 transaksi dummy (1 barang
  apa saja) → cetak struk → **logo harus muncul di atas struk** (bukan
  cuma di preview).

✅ Kalau semua langkah Tes 1 ter-centang → **fitur logo embed jalan**.

---

## Tes 2 — Backup lintas mesin / fresh state **[YANG PALING PENTING]**

Inti dari fitur v1.0.88: backup di mesin A bisa dipindah ke mesin B
(atau ke folder fresh) dan logo tetap muncul tanpa upload manual.

Pilih salah satu skenario:

### Skenario A — Punya 2 mesin

- [ ] **2A.1** Mesin A: pastikan logo terupload (kalau belum, ikut langkah 1.1).
- [ ] **2A.2** Mesin A: export backup ke file `lintas.json` (langkah 1.2).
- [ ] **2A.3** Pindahkan file `lintas.json` ke mesin B (USB / email / cloud).
- [ ] **2A.4** Mesin B: install Usahaku versi 1.0.88 (kalau belum). Login.
- [ ] **2A.5** Mesin B: buka **Pengaturan** → tab Struk & Cetak → pastikan
  logo **kosong** (belum pernah upload di mesin B).
- [ ] **2A.6** Mesin B: buka **Backup & Restore** → restore `lintas.json`
  (langkah 1.4.e sampai 1.4.j).
- [ ] **2A.7** Mesin B: buka Pengaturan → **logo harus muncul otomatis**.
- [ ] **2A.8** Mesin B: cetak struk dummy dari Kasir → logo muncul di struk.

### Skenario B — Cuma 1 mesin (simulasi mesin baru)

- [ ] **2B.1** Pastikan logo terupload (langkah 1.1).
- [ ] **2B.2** Export backup ke `simulasi.json` (langkah 1.2).
- [ ] **2B.3** Tutup app Usahaku **sepenuhnya** (klik X, jangan minimize).
- [ ] **2B.4** Buka File Explorer → tekan `Win+R` → ketik `%APPDATA%\usahaku\logos`
  → tekan Enter. Kalau folder ini ada, **hapus seluruh isinya** (file .png/.jpg).
  Kalau folder tidak ada (Windows-nya belum nyimpan logo di sana), skip.
- [ ] **2B.5** Buka app Usahaku lagi.
- [ ] **2B.6** Pengaturan → Struk & Cetak → logo harus **rusak / tidak tampil**
  (karena file fisik dihapus tapi `logo_filename` di DB masih ada).
- [ ] **2B.7** Backup & Restore → restore file `simulasi.json` (langkah 1.4.e-j).
- [ ] **2B.8** Pengaturan → **logo harus muncul lagi** (file di-tulis ulang
  dari `logo_base64` di backup).
- [ ] **2B.9** Cetak struk dummy dari Kasir → logo muncul.

✅ Kalau Skenario A atau B sukses → **fitur backup lintas mesin jalan**.

---

## Tes 3 — Restore backup lama (regression check)

Pastikan backup versi lama (v1.7 / v1.8) tetap bisa dipulihkan tanpa crash.

- [ ] **3.1** Cari file backup lama `.json` yang dibuat dari aplikasi versi
  v1.0.83 sampai v1.0.87 (kalau punya arsip).
  - Kalau **tidak punya** arsip backup lama → skip Tes 3, catat sebagai
    "tidak ter-uji" di bagian Catatan Bug.
- [ ] **3.2** Sebelum restore, simpan dulu backup terbaru (v1.9) sebagai
  cadangan, biar kalau ada masalah bisa balik.
- [ ] **3.3** Restore file backup lama (langkah 1.4.e-j).
- [ ] **3.4** Pastikan tidak crash, tidak ada toast merah error.
- [ ] **3.5** Cek data pelanggan/hutang/pembayaran tetap ada (buka menu
  Pelanggan, Hutang, dst).
- [ ] **3.6** Logo: kalau backup lama itu **tidak punya** logo embed,
  logo lama (yang sekarang ada di mesin) tidak boleh hilang.

---

## Tes 4 — Cetak fisik di printer thermal

Skip kalau tidak punya printer thermal asli (cetak ke PDF tidak menggantikan).

- [ ] **4.1** Cetak struk Kasir 58mm di printer thermal — pastikan tidak
  overflow (yang di-fix di v1.0.84): nama barang di atas, qty/harga/subtotal
  di bawahnya, total tidak kepotong.
- [ ] **4.2** Cetak ulang struk dari **Riwayat Kasir** (klik tombol Printer
  per baris) — header logo + alamat + telepon + footer harus muncul.
- [ ] **4.3** Cetak kwitansi pembayaran hutang dari menu **Pembayaran** —
  header lengkap (logo + alamat + telepon).
- [ ] **4.4** Cetak kwitansi upah dari menu **Pekerja & Upah** (A5
  landscape) — header lengkap.

---

## Catatan Bug (isi kalau ada yang gagal)

| Langkah | Gejala / Pesan Error | Screenshot? |
|---|---|---|
| (contoh: 1.3.b) | (contoh: tidak ada `"version": "1.9"`, masih `"1.8"`) | (link/path) |
|  |  |  |
|  |  |  |

---

## Hasil Akhir

- [ ] Tes 1 lulus
- [ ] Tes 2 (Skenario A atau B) lulus
- [ ] Tes 3 lulus / di-skip (alasan: ____)
- [ ] Tes 4 lulus / di-skip (alasan: ____)

**Kesimpulan:**
- ☐ Semua aman → kabari developer untuk lanjut ke Master Supplier (Rilis 1.1.0)
- ☐ Ada bug → catat di tabel di atas, kabari developer untuk hot-fix v1.0.89
