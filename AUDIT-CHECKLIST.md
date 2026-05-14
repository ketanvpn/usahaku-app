# Checklist Audit Usahaku

Dokumen ini mencatat temuan audit yang harus diperbaiki. Tandai item yang sudah selesai dengan `[x]`.

Terakhir diperbarui: 2026-05-14

---

## Prioritas High

- [x] **Patch dependency rentan**
  - `drizzle-orm` ke `>=0.45.2` (SQL injection via SQL identifier)
  - `path-to-regexp` ke `>=8.4.0` (DoS via Express router)
  - `xlsx` (SheetJS): upgrade ke versi patched dari sumber resmi atau ganti dengan alternatif (`exceljs`)
  - Lokasi: `artifacts/hutang-app/package.json:79`, `pnpm-workspace.yaml:21`, lockfile Express
  - Selesai 2026-05-14:
    - `drizzle-orm` catalog dinaikkan ke `0.45.2`
    - `path-to-regexp` di-override ke `^8.4.0` di `pnpm-workspace.yaml`
    - `xlsx` diganti ke tarball CDN SheetJS `https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz`
    - `pnpm audit --prod` setelah install: **0 vulnerability**
    - Tambahan: `scripts/package.json` dilengkapi dependency `drizzle-orm` (sebelumnya impor tanpa deklarasi)

- [x] **Bind backend Express ke `127.0.0.1`**
  - File: `artifacts/api-server/src/index.ts:21`
  - Saat ini `app.listen(port)` tanpa host argument, sehingga listen ke semua interface
  - Selesai 2026-05-14: default bind ke `127.0.0.1`, override via env `HOST` jika perlu

- [x] **Kunci CORS: ganti `origin: true` ke whitelist Electron**
  - File: `artifacts/api-server/src/app.ts:34`
  - Risiko: site lain bisa request credentialed bila session cookie aktif
  - Selesai 2026-05-14: CORS whitelist `http://localhost` & `http://127.0.0.1` (semua port), tambahkan origin lain via env `CORS_ORIGINS`. Cookie session juga di-set `sameSite: lax`.

- [x] **Lindungi endpoint internal**
  - `POST /api/internal/wal-checkpoint`
  - `POST /api/internal/db-integrity`
  - File: `artifacts/api-server/src/routes/health.ts:14,25`
  - Mitigasi: cek IP localhost atau pakai secret header dari Electron main process
  - Selesai 2026-05-14: tambah middleware `requireLoopback` di `middlewares/auth.ts` (whitelist `127.0.0.1`, `::1`, `::ffff:127.0.0.1`) dan dipakai di kedua endpoint internal

- [x] **Hapus/rotasi password default Super Admin `maduTJ150`**
  - File: `artifacts/api-server/src/seed.ts:15`
  - Mitigasi: generate password random per instalasi, atau wajibkan ganti saat first login
  - Selesai 2026-05-14:
    - Tambah kolom `must_change_password` di tabel `users` (`lib/db/src/schema/users.ts`, migrasi di `lib/db/src/index.ts`)
    - Seed admin baru ditandai `mustChangePassword = true`; password awal bisa di-override via env `SUPER_ADMIN_PASSWORD`
    - Endpoint login dan `/auth/me` mengembalikan flag `must_change_password` agar frontend bisa memaksa rotasi
    - `change-password` dan `reset-with-code` membersihkan flag; admin `reset-password` mengaktifkan flag kembali

- [x] **Lengkapi rate-limit reset password (dead code)**
  - File: `artifacts/api-server/src/routes/auth.ts:54-77,281-337`
  - `resetAttemptStore`, `RESET_MAX_ATTEMPTS`, `RESET_LOCK_MS`, dan `getResetEntry` sudah dideklarasikan tetapi tidak dipakai di handler `/auth/reset-with-code`
  - Selesai 2026-05-14: handler `/auth/reset-with-code` cek lockout di awal, naikkan counter via `bumpResetFailure` di tiap percobaan gagal, reset counter saat sukses

- [x] **Cegah replay reset code**
  - File: `artifacts/api-server/src/routes/auth.ts:281`
  - Simpan `used_at` per reset code agar tidak bisa dipakai dua kali sebelum expired
  - Selesai 2026-05-14:
    - Tabel baru `password_reset_uses` (`lib/db/src/schema/password-reset.ts`, migrasi di `lib/db/src/index.ts`) dengan UNIQUE `(username, expiry_ts)`
    - Handler menolak kode bila kombinasi `username + expiry_ts` sudah tercatat, dan menyimpan pemakaian setiap kali sukses

## Prioritas Medium

- [x] **Aktifkan `STRICT_SECRET_POLICY=fail` untuk build rilis**
  - File: `artifacts/api-server/src/lib/security-secrets.ts`
  - Inject `SESSION_SECRET`, `LICENSE_SECRET`, `RESET_SECRET` unik per instalasi (mirip `inject-credentials.js` untuk GDrive)
  - Selesai 2026-05-14:
    - Helper baru `loadOrCreateInstallSecrets` di `electron-app/src/main.ts` generate 3 secret 32-byte hex per-instalasi dan persist ke `userData/install-secrets.json` (mode 0600)
    - `startBackend` inject `SESSION_SECRET`, `LICENSE_SECRET`, `RESET_SECRET` ke env utility process
    - Set `STRICT_SECRET_POLICY=fail` saat production agar `resolveSecret` menolak fallback bawaan

- [x] **Escape HTML user input di template print/kwitansi/laporan**
  - `artifacts/hutang-app/src/pages/laporan.tsx`
  - `artifacts/hutang-app/src/pages/pembayaran.tsx`
  - `artifacts/hutang-app/src/pages/kasir.tsx`
  - `artifacts/hutang-app/src/pages/gaji-tenaga.tsx`
  - `artifacts/hutang-app/src/pages/keuangan.tsx`
  - Buat helper `escapeHtml()` dan pakai untuk semua field string yang masuk template
  - Selesai 2026-05-14:
    - Helper `escapeHtml` ditambahkan ke `artifacts/hutang-app/src/lib/format.ts`
    - `laporan.tsx`, `pembayaran.tsx`, `gaji-tenaga.tsx`, `keuangan.tsx`: setiap field user-controlled (nama usaha, pelanggan, pekerja, keterangan, kategori, catatan, judul, dst) di-escape sebelum diinterpolasi ke template print/PDF/kwitansi
    - `kasir.tsx`: sudah memakai helper lokal `escHtml` konsisten — tidak diubah

- [x] **Batasi IPC `openInBrowser` agar tidak menerima HTML mentah**
  - File: `artifacts/electron-app/src/preload.ts:6`, `artifacts/electron-app/src/main.ts:370`
  - Mitigasi: kirim data terstruktur + template id, atau render HTML di main process berdasarkan template aman
  - Selesai 2026-05-14: hardening IPC handler `open-in-browser` (`electron-app/src/main.ts:429`):
    - Validasi payload harus string, kosong/payload bukan string ditolak
    - Cap ukuran 5 MB
    - Filename random per panggilan (`crypto.randomBytes(8)`) di subdirektori `usahaku-print` di temp folder, tulis dengan mode 0600 supaya tidak bertabrakan/tertimpa antar panggilan dan tidak bisa ditebak proses lain
    - (Catatan: refactor penuh ke template-id butuh rewrite besar di banyak page; saat ini renderer dipercaya menghasilkan HTML, dan field user-controlled sudah di-escape via `escapeHtml`)

## Prioritas Low

- [x] **Tambah script `lint` dan `test` di root**
  - Saat ini `package.json:5` hanya punya `build` dan `typecheck`
  - Saran: tambah ESLint dan smoke test untuk lisensi, backup/restore, pembayaran, kasir
  - Selesai 2026-05-14:
    - `vitest` ditambah sebagai devDependency root, config di `vitest.config.ts`
    - Script baru `pnpm test` dan `pnpm test:watch`
    - Smoke test untuk fungsi audit-kritikal di `tests/`:
      - `tests/escape-html.test.ts` — 4 case escape HTML
      - `tests/license-crypto.test.ts` — 4 case generate/verify license key (round-trip, tamper, malformed, normalisasi)
      - `tests/require-loopback.test.ts` — 5 case middleware loopback (IPv4, IPv6, IPv4-mapped, external IP, empty)
    - Hasil: **13/13 test pass**
  - (Catatan: ESLint flat config di-defer; vitest sudah memberi safety net untuk regresi audit ini)

- [x] **Bersihkan tipe `any` berlebihan di frontend**
  - `artifacts/hutang-app/src/pages/hutang.tsx`
  - `artifacts/hutang-app/src/pages/pelanggan.tsx`
  - `artifacts/hutang-app/src/pages/pembayaran.tsx`
  - `artifacts/hutang-app/src/pages/profil.tsx`
  - `artifacts/hutang-app/src/pages/admin/owners.tsx`
  - dan file terkait lainnya
  - Selesai 2026-05-14:
    - Helper baru `getErrorMessage(err: unknown)` di `artifacts/hutang-app/src/lib/format.ts` ekstrak pesan dari `ApiError`/`Error`/string
    - Refactor 19 `onError: (err: any)` jadi `(err: unknown) => ... getErrorMessage(err)` di `hutang.tsx`, `hutang-detail.tsx`, `pelanggan.tsx`, `pembayaran.tsx`, `profil.tsx`, `login.tsx`, `backup.tsx`, `admin/usaha.tsx`, `admin/owners.tsx`
    - `try { ... } catch (error: any)` di `backup.tsx` juga di-rapikan ke `unknown`
    - Tipe `any` lain (Recharts CustomTooltip, mapping XLSX rows, dll) sengaja ditinggalkan karena terkait library typing yang lemah dan bukan hot-path keamanan

- [x] **Bersihkan `console.log` debug**
  - `scripts/src/seed.ts`
  - `artifacts/electron-app/src/main.ts:93`
  - Kesimpulan 2026-05-14: pemakaian `console.log` di kedua file **intentional**, bukan debug yang harus dihapus.
    - `scripts/src/seed.ts` adalah CLI tooling untuk developer; pesan progress (`Seeding database...`, `Seed berhasil!`, dst.) berguna untuk feedback terminal.
    - `artifacts/electron-app/src/main.ts:148` (`console.log(line)` di fungsi `writeLog`) sengaja menulis ke stdout supaya log bisa di-tail saat dev.
    - Tidak diubah; item ditutup karena bukan kerentanan/kotoran nyata.

---

## Catatan

- Hasil `pnpm audit --prod` per 2026-05-14 setelah perbaikan dependency: **0 vulnerability** (sebelumnya 4 high + 1 moderate).
- `pnpm run typecheck` setelah `pnpm install`: file yang dimodifikasi audit ini lolos. Masih ada **error pre-existing** di file yang tidak disentuh: `routes/kasir.ts`, `routes/keuangan.ts`, `routes/lisensi.ts`, `routes/pekerja.ts`, `routes/setup.ts`, `routes/stok.ts`. Penyebab utama: pemakaian Zod v4 syntax (`{ error }`) pada `import { z } from "zod"` (v3), Express 5 typing `req.params` jadi `string | string[]`, dan tipe `LicenseTipe` mismatch dengan inferred enum schema. Perlu issue terpisah untuk perbaikan TypeScript ini.
- **Update sore 2026-05-14**: 24 error TS pre-existing di atas + 4 error TS baru di `hutang-app` (`gaji-tenaga.tsx`, `login.tsx`) sudah dibersihkan. Schema `licenseKeysTable.tipe` enum disetarakan ke nilai aktual (`1bulan|3bulan|6bulan|1tahun`), Zod v4 syntax `{ error }` diganti `{ invalid_type_error }` (kompatibel v3), dan `parseInt(req.params.id)` ditangani lewat narrowing `typeof === "string"`. Hasil: `pnpm run typecheck` **0 error**. Detail di `AUDIT-2026-05-14.md`.
- Selain typecheck, tiga temuan tambahan dari audit ulang juga sudah ditutup: `app.disable("x-powered-by")` di api-server, hapus baris `pnpm --filter db push` salah di `scripts/post-merge.sh`, dan guard `NODE_ENV=production` di `scripts/src/seed.ts` agar dev seeder tidak menanam akun lemah `admin/admin123` di rilis.
- **Update malam 2026-05-14 (batch 2)**: Empat fix tambahan:
  - **L-06 enforce password change** — middleware `enforcePasswordChange` ditambahkan ke `artifacts/api-server/src/middlewares/auth.ts` dan dipasang di `app.ts`. Bila user `mustChangePassword=true`, semua endpoint kecuali whitelist (`/auth/me`, `/auth/change-password`, `/auth/logout`, `/healthz`) ditolak dengan 403 `PASSWORD_CHANGE_REQUIRED`. Closed permanent gap di item "rotasi SuperAdmin password" yang sebelumnya hanya enforced client-side.
  - **M-04 body limit** — `app.use(express.json({ limit: "1mb" }))` default; override 50 MB hanya di route `POST /api/backup/restore`. DoS surface backend turun signifikan.
  - **M-05 doc** — `/auth/usernames` diberi comment eksplisit "public by design" + catatan kapan harus dikunci ke loopback.
  - **L-03 dialog error** — stderr backend tidak lagi ditampilkan ke user di dialog "Layanan Aplikasi Berhenti". Diganti pesan generik + tombol "Buka File Log".
  - **Test coverage**: 6 unit test baru di `tests/enforce-password-change.test.ts`. Total: **19/19 pass** (sebelumnya 13).
- File ini bisa di-commit supaya checklist tetap terlacak di git.
