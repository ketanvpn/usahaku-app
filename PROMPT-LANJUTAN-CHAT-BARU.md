# Prompt Briefing untuk Chat Baru

> Copy-paste seluruh blok di bawah ini ke chat baru. Update bagian `## Status sekarang`
> kalau ada perubahan setelah 16 Mei 2026.

---

Halo, aku lanjutkan kerjaan di repo Usahaku (https://github.com/ketanvpn/usahaku-app),
sebuah app Electron monorepo (pnpm workspaces) untuk pencatatan piutang/kasir/stok
dengan SQLite + better-sqlite3 + Drizzle, React + Vite, Express API server, auto-update
via electron-updater + GitHub Releases.

# Status sekarang (16 Mei 2026 pagi)

Versi terakhir di GitHub: **v1.1.4** (commit `e9abc07` di main, sudah di-tag &
ter-publish lewat CI, sudah ter-install di PC user dan jalan aman).

## Riwayat rilis terakhir (urutan kronologis)

| Versi | Topik | Status |
|---|---|---|
| v1.0.82–v1.0.88 | Burst polish: pengaturan, struk 58mm, cetak ulang struk, header kwitansi, preview live, logo embed di backup | ✅ Stabil di lapangan |
| v1.1.0 | Master Supplier (tabel `suppliers` + ALTER `transaksi_stok ADD supplier_id` nullable + halaman /supplier + dropdown di stok masuk + backup v1.10) | ✅ Stabil |
| v1.1.1 | Detail Supplier + Laporan Pembelian per Supplier (halaman /supplier/:id + tab "Pembelian Supplier" di /laporan + cetak A4 landscape) | ✅ Stabil |
| v1.1.2 | **GAGAL — REVERTED.** Code-split per route + manualChunks vendor → app blank putih di .exe production. Path resolution dynamic chunk tidak compatible dengan setup Electron production | ❌ Reverted |
| v1.1.3 | Hotfix revert v1.1.2 (skip versi 1.1.2, langsung 1.1.1 → 1.1.3 supaya updater push ke user yang sudah ke v1.1.2) | ✅ Skip publish (digabung ke v1.1.4) |
| v1.1.4 | **Safety net.** App Menu permanen (Aplikasi + Bantuan di top bar) + halaman Recovery otomatis di did-fail-load + 7 IPC shortcut di preload (`getAppVersion`, `checkUpdate`, `downloadUpdate`, `installUpdate`, `openUserData`, `openReleases`, `quitApp`). `autoDownload` tetap `false` (filosofi opt-in dipertahankan); menu cuma kasih akses tombol fisik kalau user butuh | ✅ Published, user install aman |

## Pelajaran v1.1.2 (penting untuk diingat)

- **Code-splitting di Electron app harus diuji di hasil .exe installer akhir**,
  bukan cuma `pnpm build:desktop` output. `electron-builder` packaging mengubah
  path resolution.
- CI hanya build, tidak validasi runtime. Untuk perubahan struktural seperti
  bundle/build wajib build `.exe` local + smoke test sebelum tag release.

## Smoke test backlog (belum dilakukan, semakin lama makin penting)

1. **Pakai app v1.1.4 untuk operasional 2-3 hari** — observasi natural,
   catat janggalan apa pun.
2. **Recovery flow v1.1.4**: stop backend manual via Task Manager (kill Node.js
   process) saat app jalan → halaman Recovery harusnya muncul dengan 5 tombol fisik
   (Coba Muat Ulang, Cek & Pasang Update, Buka Folder Data, Buka Halaman Rilis, Tutup).
3. **Cetak struk 58mm di printer thermal asli** (skip dari v1.0.84 + v1.0.88
   karena tidak ada printer).
4. **Round-trip backup lintas mesin**: di mesin A export → mesin B fresh install
   restore → suppliers tampil, supplier_id konsisten, logo otomatis muncul.
5. **Restore backup lama (v1.7/v1.8/v1.9) di app v1.1.4** — penting karena ada 2
   format backup baru (v1.10 supplier + v1.11 logo). Backward-compat wajib jalan.

# Backlog yang sengaja di-defer

- **Performance optimization (redo v1.1.2 yang gagal)** — bundle JS 1.77 MB monolitik
  belum di-fix. Kalau mau coba ulang: set `base: "./"` di Vite supaya path chunk
  relative + lazy hanya 4-5 halaman terberat (laporan/dashboard/kasir/gaji-tenaga),
  bukan 24 sekaligus, **wajib build .exe local + smoke test sebelum tag**.
- **Migrasi 4 template print di `laporan.tsx`** ke `buildPrintHeaderHtml`
  (deferred dari v1.0.86, A4 landscape internal, low priority).
- **Logo embed di Google Drive backup** (`.db` mode) — niche, tunggu user complain.
- **B1 tab tambahan di Pengaturan** (Numbering/Pajak/Notifikasi) — observasi dulu
  apakah dibutuhkan.
- **C2 Hutang Usaha penuh** — tunggu permintaan user nyata.

# Konvensi penting di repo ini

1. **Aturan migrasi DB:** `CREATE TABLE IF NOT EXISTS` untuk tabel baru,
   `try { ALTER ... ADD COLUMN ... } catch {}` untuk kolom baru di tabel
   existing, **tidak pernah** `DROP COLUMN` / `RENAME COLUMN`.
2. **Tiap rilis yang menyentuh DB** wajib uji restore backup versi sebelumnya.
3. **Versi backup** sekarang v1.10 (supplier) atau v1.11 (supplier + logo).
   Backward compat dengan v1.7/v1.8/v1.9 wajib dijaga.
4. **Tag git format `vX.Y.Z`** ditegakkan oleh workflow preflight step di
   `.github/workflows/build-release.yml` (pin `windows-2022`, setup-msbuild
   explicit, `npm_config_msvs_version=2022`, retry 3x untuk `pnpm install`).
5. **Setiap rilis** update `CATATAN-RILIS.md` (table) + `RENCANA-FITUR.md`
   (section status + backlog).
6. **Tiap commit** sertakan verifikasi `pnpm vitest run` (sekarang 60/60 pass),
   `pnpm typecheck`, dan `pnpm --filter @workspace/electron-app build:desktop`.
   Untuk perubahan struktural (vite config, main.ts, build pipeline) **wajib
   tambahan**: build `.exe` local + smoke test installer.
7. **Filosofi auto-update**: `autoDownload = false` di main.ts. User opt-in
   eksplisit untuk update — JANGAN ubah ini tanpa diskusi (alasan: takut user
   kena update di waktu salah / saat operasional jalan).

# Dokumen referensi

- `RENCANA-FITUR.md` — roadmap + status per rilis + risiko per item +
  post-mortem v1.1.2
- `CATATAN-RILIS.md` — riwayat tabel rilis published + siap dipublish
- `PANDUAN-RILIS-VERSI-BARU.md` — langkah publish + Troubleshooting CI
- `DESAIN-RILIS-1.2.0.md` — blueprint detail Pengaturan (sudah selesai dieksekusi)
- `PANDUAN-KERJA-USAHAKU.md` — panduan user-facing
- `AUDIT-2026-05-14.md` + `AUDIT-CHECKLIST.md` — hasil audit

# Yang aku butuh dari kamu

Tunggu briefing dariku. Bisa salah satu dari:

(a) **"Smoke test v1.1.4 hasil X, ada bug Y"** → langsung hot-fix sebagai v1.1.5.
(b) **"Smoke test aman, lanjut ke fitur baru / backlog"** → analisis risiko dulu,
   kasih aku 2-3 opsi sebelum mulai eksekusi.
(c) **"Ada permintaan user baru: ..."** → analisis risiko dulu sebelum eksekusi.
(d) **"Mau coba ulang performance optimization (yang gagal di v1.1.2)"** →
   strategi konservatif dengan validasi `.exe` local sebelum tag.

Sebelum mulai apa-apa, baca `RENCANA-FITUR.md` + `CATATAN-RILIS.md` untuk
re-konfirmasi state. Pakai bahasa Indonesia, jaga nada konsultatif tapi
langsung ke poin (gaya dev senior yang udah biasa kerja sama saya).

**Aturan main**:
- **Jeda dulu** sebelum bikin rilis baru, sampai smoke test v1.1.4 di
  lapangan beres. Kalau ada bug → hot-fix sebagai v1.1.5.
- Jangan dorong perubahan struktural (build, bundle, vite config, electron-updater
  setup) tanpa validasi `.exe` local — pelajaran v1.1.2.
- Kalau ragu, jangan eksekusi — diskusikan dulu.
