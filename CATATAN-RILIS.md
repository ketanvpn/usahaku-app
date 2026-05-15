## Catatan Rilis Usahaku

File ini dipakai untuk mencatat semua versi yang sudah dipublish di GitHub Releases.

Aturan pakai:
- Tambah 1 baris setiap kali klik `Publish release`.
- Versi harus format `vX.Y.Z` (contoh: `v1.0.54`).
- Tanggal pakai format `YYYY-MM-DD`.
- Update bagian `Versi terbaru` setelah rilis sukses.

Versi terbaru: `v1.1.0`

Rilis berikutnya (siap dipublish): `v1.1.1` — Detail Supplier + Laporan Pembelian per Supplier (lihat baris paling atas tabel di bawah).

| Versi | Tanggal | Status | Catatan Singkat |
| --- | --- | --- | --- |
| v1.1.1 | 2026-05-15 | Siap publish | Master Supplier closing-loop: halaman Detail Supplier (klik nama supplier → tampil ringkasan total transaksi + total nilai pembelian + daftar barang yang pernah dibeli + 10 transaksi terakhir) dan tab baru "Pembelian Supplier" di halaman Laporan dengan filter bulan/tahun + tombol Cetak A4 landscape (pakai `buildPrintHeaderHtml` jadi header logo+alamat+telepon+teks header otomatis ikut). Endpoint baru `GET /api/suppliers/:id` (extend dari sebelumnya) + `GET /api/laporan/pembelian-supplier`. Tidak menyentuh DB / format backup — pure additive read-only query. Manfaat: supplier sekarang punya halaman yang berisi sesuatu, user bisa lihat siapa supplier paling diandalkan dan untuk barang apa |
| v1.1.0 | 2026-05-15 | Siap publish | Master Supplier: tabel baru `suppliers` (per usaha), halaman `/supplier` di sidebar grup PENJUALAN dengan CRUD lengkap (nama wajib, telepon/alamat/catatan opsional). Form Barang Masuk di halaman Stok dapat dropdown supplier opsional ("— Tanpa Supplier —" sebagai default). Saat dipilih, kolom `supplier_id` ditulis ke `transaksi_stok` dan keterangan keuangan otomatis jadi "Beli X dari Supplier Y". Hapus supplier ditolak kalau masih dipakai di transaksi stok masuk (cegah dangling reference). Format backup naik ke v1.10 (server) / v1.11 (client + logo) — backup v1.7-v1.9 tetap bisa di-restore (suppliers kosong & supplier_id null), dan ID lama→baru di-mapping seperti tabel lain. Tidak ada `DROP/RENAME COLUMN`, hanya `CREATE TABLE IF NOT EXISTS suppliers` + `ALTER TABLE transaksi_stok ADD COLUMN supplier_id INTEGER` |
| v1.0.88 | 2026-05-15 | Published | Logo usaha sekarang ikut di-include di file backup `.usahaku-bak` (format naik dari v1.8 ke v1.9). Dulu kalau user pindah laptop / restore di mesin lain, logo hilang dan harus di-upload ulang dari halaman Pengaturan. Sekarang: saat export, client baca file logo dari userData/logos/ via IPC dan tempel sebagai `logo_base64` di payload. Saat restore, file logo otomatis ditulis ulang ke userData lokasi baru, lalu `logo_filename` di DB di-update. Backward-compat penuh: backup v1.7 dan v1.8 lama tetap bisa di-restore (logo yang ada saat ini tidak diutak-atik). Server tidak berubah |
| v1.0.87 | 2026-05-15 | Published | Pratinjau struk live di halaman Pengaturan tab "Struk & Cetak" — saat user ubah header, footer, ukuran kertas, atau toggle logo, pratinjau di sebelahnya langsung menampilkan hasilnya tanpa harus simpan dan cetak transaksi dummy. Iframe sandbox + debounce 200ms supaya tetap responsif. Memakai `buildStrukHtml` dengan opsi baru `forPreview: true` yang skip auto-print script |
| v1.0.86 | 2026-05-15 | Published | Cetak ulang struk dari Riwayat Penjualan Kasir (tombol Printer per baris memakai `buildStrukHtml` yang sama dengan transaksi baru) + kwitansi Pembayaran Hutang dan Pembayaran Upah otomatis menampilkan logo, alamat, telepon, dan teks header tambahan dari Pengaturan. Helper bersama `buildPrintHeaderHtml` + `getDefaultPrintHeaderCss` di `lib/struk.ts` plus hook `usePrintContext` untuk dipakai ulang halaman lain |
| v1.0.85 | 2026-05-15 | Published | Bersih-bersih halaman Profil: form edit data usaha (nama, telepon, alamat, catatan) dihapus dari Profil dan dipindah seluruhnya ke halaman Pengaturan tab Data Usaha agar tidak ada dua sumber kebenaran yang bisa nulis ke endpoint yang sama. Halaman Profil sekarang fokus ke profil pengguna + ganti password, dengan tombol cepat "Atur Data Usaha" yang link ke Pengaturan |
| v1.0.84 | 2026-05-15 | Published | Perbaikan struk Kasir 58mm: layout dirombak jadi 2-baris per item (nama di atas, qty/harga/subtotal di bawah) supaya tidak overflow di printer thermal 58mm. Lebar body dipersempit ke 50mm + font 8pt + format angka tanpa prefix Rp untuk hemat ruang. Layout 80mm dan A4 tidak berubah (tetap tabel 4 kolom yang sudah aman). Builder HTML struk dipindah ke `lib/struk.ts` (`buildStrukHtml`) supaya bisa dipakai ulang |
| v1.0.83 | 2026-05-15 | Published | Halaman Pengaturan baru (tab Data Usaha + Struk & Cetak): upload logo (PNG/JPG, maks 1 MB), atur teks header/footer struk, ukuran kertas default (58/80mm/A4), toggle tampilkan logo. Struk Kasir otomatis mengikuti pengaturan (logo + alamat + telepon + footer kustom). Backup format naik ke v1.8 dengan include data pengaturan; backup lama tetap kompatibel saat di-restore |
| v1.0.82 | 2026-05-14 | Published | Penataan ulang menu sidebar (grup baru: PIUTANG/PENJUALAN/KEUANGAN/SISTEM), label "Pekerja & Upah" + "Barang & Stok", Profil & Bantuan pindah ke footer sidebar, badge angka peringatan di sidebar (stok rendah, upah belum lunas, hutang lewat jatuh tempo), dan dialog Bantuan terintegrasi |
| v1.0.79 | 2026-05-06 | Published | Penyempurnaan input nominal uang: format ribuan otomatis, prefix Rp, angka lebih mudah dibaca, dan tombol nominal cepat dibuat sebagai penambah nilai |
| v1.0.76 | 2026-05-06 | Published | Penyempurnaan Gaji & Tenaga ↔ Piutang: pilih banyak hutang saat batch, dialog batch dibuat lebih stabil, dan rollback pembayaran lebih aman |
| v1.0.68 | 2026-05-06 | Published | Sinkronisasi Gaji & Tenaga ↔ Piutang: link pekerja ke pelanggan, opsi potong hutang saat bayar upah (single/batch), dan backup/restore relasi baru |
| v1.0.67 | 2026-05-05 | Published | Hotfix Kasir: daftar item keranjang tetap terlihat saat input pembayaran (area list distabilkan agar tidak tertekan) |
| v1.0.66 | 2026-05-05 | Published | Fokus Kasir: shortcut keyboard, autofokus pencarian, validasi stok lebih jelas, dan tombol quick bayar (Pas/+nominal) |
| v1.0.65 | 2026-05-02 | Published | Perbaikan filter laporan keuangan + UX laporan (copy ringkasan, mode custom) serta penyempurnaan dashboard dan backup |
| v1.0.64 | 2026-05-02 | Published | Perbaikan banner backup (hanya tampil >=7 hari) + peningkatan UX dashboard (CTA empty state, periode chart) dan tombol Refresh Status di Backup |
| v1.0.63 | 2026-05-02 | Published | Stabilitas dashboard & backup (sinkronisasi status backup), optimasi fetch dashboard, serta penyempurnaan UX sidebar dan filter laporan |
| v1.0.62 | 2026-05-02 | Published | Optimasi navigasi sidebar: grup PIUTANG, badge status Backup/Lisensi, indikator menu aktif, dan perapihan visual struktur menu |
| v1.0.61 | 2026-05-02 | Published | Stabilitas startup pasca update + UX filter laporan (preset aktif), Minggu ini, buka folder backup, dan info backup terakhir di dashboard |
| v1.0.60 | 2026-05-02 | Published | Peningkatan UX audit: status backup manual terakhir + shortcut Dashboard ke Laporan/Backup |
| v1.0.59 | 2026-05-02 | Published | Peningkatan UX laporan & backup + stabilisasi pipeline rilis (preset periode cepat, copy path backup, validasi workflow) |
| v1.0.58 | 2026-05-02 | Published | Peningkatan pipeline release: validasi format tag, trigger manual workflow, migrasi Node 24, dan perbaikan alur verify/release agar stabil |
| v1.0.57 | 2026-05-02 | Published | Peningkatan workflow release: pisah job verify/release dan penamaan job agar lebih jelas di GitHub Actions |
| v1.0.56 | 2026-05-02 | Published | Bundle perbaikan: ringkasan keuangan lintas bulan, optimasi pipeline release, hardening secret policy production, template release notes, dan quality gate sebelum packaging |
| v1.0.54 | 2026-05-02 | Published | Fix ringkasan keuangan agar tetap tampil akumulasi semua waktu saat ganti bulan |
| v1.0.53 | 2026-05-02 | Baseline | Versi aktif saat catatan rilis mulai dibuat |
