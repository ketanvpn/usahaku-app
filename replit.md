# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Aplikasi Manajemen Hutang (Debt Management App) for Indonesian small businesses.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: SQLite (better-sqlite3) + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **Frontend**: React + Vite + Tailwind CSS
- **Auth**: Express session + bcrypt

## Application Features

### Roles
- **Super Admin**: Manage all businesses and owner accounts globally
- **Owner**: Manage their own business's customers, debts, and payments

### Pages (Owner)
- `/dashboard` — debt/payment summary dashboard
- `/pelanggan` — customer list (CRUD, search, safe delete with hutang check)
- `/pelanggan/:id` — customer detail with split active/lunas hutang sections + payment history (sorted newest first)
- `/hutang` — debt list with filters (newest first)
- `/hutang/:id` — debt detail with payment history and delete payment
- `/pembayaran` — payment recording
- `/laporan` — reports with filter (reset button + active filter summary), CSV export, and print PDF
- `/backup` — backup export JSON + restore with preview (shows pelanggan/hutang/pembayaran counts before confirm)
- `/profil` — profile + change password (ganti password) + logout

### Pages (Super Admin)
- `/admin/dashboard` — global summary
- `/admin/usaha` — business management
- `/admin/owners` — owner account management

## Default Credentials

- **Super Admin**: username: `admin`, password: `admin123`
- **Owner**: username: `owner1`, password: `owner123`

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally
- `pnpm --filter @workspace/hutang-app run dev` — run frontend locally

## Database Schema

- `usaha` — businesses
- `users` — user accounts (super_admin | owner)
- `pelanggan` — customers (per business)
- `hutang` — debts (per business)
- `pembayaran` — payments (per debt)

## Phase 6 Final Polish & Release Readiness (Applied)

### Electron main.ts Improvements
- `Menu.setApplicationMenu(null)` — sembunyikan menu bar default Electron (tampilan lebih rapi)
- `app.setAppUserModelId('com.bukuhutang.app')` — Windows taskbar grouping yang benar
- `app.setName('Buku Hutang')` — nama aplikasi konsisten
- `ensureUserDataDir()` — auto-buat folder AppData sebelum start backend (dengan error dialog jika gagal)
- `createLoadingWindow()` — tampilkan layar loading biru saat backend sedang start (no blank screen)
- `loadApp(url)` — pisahkan loading window dari loadURL (transisi mulus dari loading ke app)
- Icon support via `getIconPath()` — cari `icon.png` atau `icon.ico` di assets folder
- Error messages lebih manusiawi dalam bahasa Indonesia
- Session secret berbasis userData path (unik per mesin, tidak hardcoded)
- Backend stdout disembunyikan di production, hanya stderr yang di-log

### electron-builder.yml Improvements
- `artifactName: "BukuHutang-Setup-${version}.exe"` — nama file installer yang rapi
- `requestedExecutionLevel: asInvoker` — tidak perlu hak admin untuk install/run
- `deleteAppDataOnUninstall: false` — data user aman saat uninstall
- `allowToChangeInstallationDirectory: false` — install ke Program Files standar
- Source map files (`!**/*.map`) dikecualikan dari extraResources untuk ukuran lebih kecil

### Assets
- `artifacts/electron-app/assets/icon.svg` — placeholder SVG icon (512x512, biru #1d4ed8)
- Dokumentasi cara konversi SVG → ICO tersedia di README

### README
- Ditulis ulang lengkap untuk pengguna awam (non-teknis)
- Mencakup: instalasi, cara pakai semua fitur, backup/restore, export, print
- Panduan developer terpisah: dev mode, build, reset database
- Tabel lokasi file penting (Windows AppData, folder Unduhan)
- Checklist pengujian final lengkap (44 item)

## Phase 5 Electron Desktop Packaging (Applied)

### New Package: `artifacts/electron-app/`
- **Main process**: `src/main.ts` → compiled to `build/main.js` (CommonJS, Electron-compatible)
- **Preload**: `src/preload.ts` → exposes minimal `window.electronApp` context bridge
- **Security**: `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`
- **Build config**: `electron-builder.yml` (Windows target, NSIS installer)
- **Entry point**: `main` = `build/main.js`

### Backend Start Strategy
- Uses `electron.utilityProcess.fork()` to spawn the ESM backend (`dist/index.mjs`) inside Electron's Node.js runtime
- No separate Node.js binary needed — uses Electron's built-in
- Backend started at `PORT=8080`; Electron waits via polling `/api/healthz` before opening window
- On backend exit: shows error dialog and quits app
- In dev mode: checks if backend already running; starts if not

### Database Path (Desktop Mode)
- Desktop: `app.getPath('userData')` → Windows AppData/Roaming/Buku Hutang/app.db
- Dev: continues using `artifacts/api-server/data/app.db`

### Static File Serving (Production Mode)
- `artifacts/api-server/src/app.ts` updated:
  - When `SERVE_STATIC=true`: serves static frontend files via Express
  - When `STATIC_PATH` env is set: serves from that path, otherwise falls back to `../../hutang-app/dist/public`
  - Uses `app.use(express.static(...))` + `app.use()` catch-all for SPA fallback
  - API routes (`/api/*`) take priority over static files
- Frontend must be built with `BASE_PATH=/` for Electron mode

### Development Workflow (Electron)
```bash
# Terminal 1 — backend
pnpm --filter @workspace/api-server run dev

# Terminal 2 — frontend (optional for live reload)
pnpm --filter @workspace/hutang-app run dev

# Terminal 3 — Electron desktop window
pnpm --filter @workspace/electron-app run electron
```
Electron in dev mode loads frontend at `http://localhost:VITE_PORT` (5173 by default).

### Production Build Workflow
```bash
# Build all + package (dir only, no installer)
pnpm --filter @workspace/electron-app run pack

# Build all + create Windows installer
pnpm --filter @workspace/electron-app run dist:win
```
`build:desktop` script builds: backend → frontend (BASE_PATH=/) → Electron main TypeScript

### Scripts Summary

| Command | What it does |
|---------|-------------|
| `pnpm --filter @workspace/electron-app run electron` | Run Electron in dev mode |
| `pnpm --filter @workspace/electron-app run build:main` | Compile Electron TypeScript only |
| `pnpm --filter @workspace/electron-app run build:desktop` | Build backend + frontend + Electron |
| `pnpm --filter @workspace/electron-app run pack` | Build all + package (no installer) |
| `pnpm --filter @workspace/electron-app run dist:win` | Build all + Windows .exe installer |

### electron-builder extraResources Layout
```
resources/
  backend/
    dist/index.mjs          ← bundled API server
    node_modules/
      better-sqlite3/       ← only native dependency
  frontend/
    index.html              ← built React app (BASE_PATH=/)
    assets/
      index-*.css
      index-*.js
```

### Notes for Final Windows Build
- Icon: Place `icon.ico` in `artifacts/electron-app/assets/` (512px PNG → .ico via CloudConvert)
- `better-sqlite3` native module must be rebuilt for Windows via `electron-builder --win` (`npmRebuild: true`)
- `SESSION_SECRET` env should be set or will use built-in desktop fallback
- Installer output: `artifacts/electron-app/release/`

## Phase 4 SQLite Migration (Applied)

### Database
- **Migrated from PostgreSQL → SQLite** using `better-sqlite3` + Drizzle ORM
- Database file: `artifacts/api-server/data/app.db` (created automatically on first run)
- WAL mode enabled for performance and safety
- Foreign keys enabled via `PRAGMA foreign_keys = ON`
- Tables created inline with `CREATE TABLE IF NOT EXISTS` on startup
- No external database server required — fully self-contained

### Schema Changes (PostgreSQL → SQLite)
- `pgTable` → `sqliteTable`
- `serial("id").primaryKey()` → `integer("id").primaryKey({ autoIncrement: true })`
- `timestamp(...)` → `integer("...", { mode: "timestamp_ms" })` (epoch ms, returns `Date`)
- `boolean("is_active")` → `integer("is_active", { mode: "boolean" })`
- `numeric("nominal", ...)` → `text("nominal")` (string storage, parseFloat on read — same as before)

### Package Changes
- Removed: `pg`, `@types/pg` from `lib/db`
- Added: `better-sqlite3`, `@types/better-sqlite3` to `lib/db`
- Added: `better-sqlite3` to `artifacts/api-server` (required for esbuild external resolution)
- Added `better-sqlite3` to `pnpm-workspace.yaml` `onlyBuiltDependencies`

### Build System
- `better-sqlite3` already listed in `artifacts/api-server/build.mjs` external list
- `lib/db/dist/` rebuilt with SQLite types (`tsc -b lib/db/tsconfig.json`)
- `lib/api-zod/src/index.ts` fixed: removed duplicate `export * from "./generated/types"` (pre-existing bug)

### Kesiapan Desktop (Electron Ready)
- No cloud/external DB dependency
- Backend entry: `artifacts/api-server/dist/index.mjs`
- Frontend entry: `artifacts/hutang-app/dist/index.html` (after `vite build`)
- `DATABASE_PATH` env var lets Electron control DB file location

## Phase 3 Hardening (Applied)

### Backend
- `DELETE /pelanggan/:id`: Blocked if pelanggan has any hutang (active or lunas) — must delete hutang first
- `POST /auth/change-password`: New endpoint — owner can change own password with current password verification
- `GET /pelanggan/:id`: Hutang and pembayaran lists now ordered DESC (newest first)

### Frontend
- Login: `autoFocus` on username field; error extraction fixed; redirect via `useEffect` (no render-phase setState)
- Profil: Added "Ganti Password" card with form (current_password, new_password, confirm_password validation)
- Laporan: Reset Filter button (shows when filter active); active filter summary strip with badges + row count
- Backup: Preview data counts (pelanggan/hutang/pembayaran) shown when file selected; Restore button disabled until file is valid; restore success toast shows counts
- Pelanggan Detail: Split hutang list into "Hutang Aktif" and "Hutang Lunas" separate sections; count badges in Ringkasan card
- All admin pages (owners, usaha): Fixed error extraction pattern (`err?.data?.error || err?.message`)

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
