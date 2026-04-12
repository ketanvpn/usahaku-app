# Workspace

## Overview

This project is a pnpm workspace monorepo using TypeScript, designed to be **Usahaku by KetanTech** — an Aplikasi Manajemen Bisnis (Business Management App) for Indonesian small businesses (warung, toko kelontong, penggilingan padi). It provides comprehensive tools for managing customer debts, financial records (masuk/keluar), stock/inventory, kasir (POS), and reporting, with both web and desktop (Electron) interfaces. The application supports role-based access: Super Admin for global management and Owners for business-specific operations.

**Current version: 1.0.6**

Key features:
- CRUD for customers, debts, payments
- Keuangan (income/expense) with auto-integration
- Stok barang with low-stock alerts and auto-keuangan
- Kasir (POS) with multi-item cart, receipt modal, auto-stok decrement
- Laporan: tab Penjualan Kasir (harian/bulanan chart, top produk, export CSV/PDF), Hutang, Keuangan, Stok
- Dashboard: kasir summary cards (hari ini & bulan ini), tren keuangan chart
- Backup/restore (v1.2 format includes kasir tables)
- Pengingat backup otomatis: banner kuning muncul jika belum backup > 7 hari (localStorage-based)
- Auto-backup saat tutup aplikasi: salin file .db ke Documents/UsahakuBackup/, simpan 7 file terbaru (production/Electron only)
- Offline license key system
- Auto-update (electron-updater, GitHub releases) + manual check button + version display in sidebar

## User Preferences

The user wants the agent to focus on high-level architectural decisions and system design rather than granular implementation details or historical changes. The agent should prioritize stability and robust error handling, especially concerning native module integration and database operations in packaged environments. When making changes, ensure that existing data and functionalities remain compatible and that user experience is smooth, particularly during application startup and error scenarios.

## System Architecture

The application is built as a pnpm workspace monorepo.

**Technology Stack:**
- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **TypeScript version**: 5.9
- **Package manager**: pnpm
- **API framework**: Express 5
- **Database**: SQLite (better-sqlite3) + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **Frontend**: React + Vite + Tailwind CSS
- **Auth**: Express session + bcryptjs

**Core Architectural Decisions:**
- **Roles**: Super Admin (global management) and Owner (business-specific operations).
- **Database**: Migrated from PostgreSQL to SQLite for self-contained, no-external-server deployment, especially for desktop. Uses WAL mode and PRAGMA foreign_keys. Database file `app.db` is automatically created.
- **Backend API**: Express 5 serves as the API framework. For desktop environments, it can also serve static frontend files.
- **Frontend**: React + Vite + Tailwind CSS provides a responsive user interface.
- **Desktop Packaging (Electron)**:
    - Dedicated `electron-app` package.
    - Uses `electron.utilityProcess.fork()` to spawn the backend within Electron's Node.js runtime.
    - Database path dynamically determined (`app.getPath('userData')` for desktop).
    - Frontend static files served by the Express backend in production desktop builds.
    - Security focused with `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`.
    - Improved startup experience with loading screens and robust error logging for backend failures.
    - Native modules are handled carefully: see **Electron Packaging — Native Module Chain** below for full details.
    - `bcrypt` replaced with `bcryptjs` (pure JS, bundled by esbuild). Hash format compatible.
    - `better-sqlite3` added to `electron-app/dependencies`, rebuilt for Electron ABI by `npmRebuild: true`.
    - A custom `bindings-stub` at `assets/bindings-stub/` replaces the `bindings` package, avoiding pnpm virtual store issues with transitive deps.
- **Security & Hardening**:
    - `bcryptjs` for password hashing, compatible with `bcrypt` hashes.
    - Debt deletion is blocked if associated with active/lunas hutang.
    - User can change their password with current password verification.
    - Error messages are user-friendly and localized (Indonesian).
    - `SESSION_SECRET` is derived from `userData` path for uniqueness.

**Feature Specifications:**
- **Owner Pages**: Dashboard (summary), Customer List (CRUD, search, safe delete), Customer Detail (split active/lunas hutang, payment history), Debt List (filters), Debt Detail, Payment Recording, Reports (filters, CSV, PDF), Backup/Restore (with preview), Profile (change password, logout).
- **Super Admin Pages**: Global Dashboard, Business Management, Owner Account Management.
- **UI/UX**: Consistent icon support, clean default Electron menu, proper Windows taskbar grouping, human-readable error messages. Report section includes "Reset Filter" and active filter summary. Backup/Restore provides data count previews.

## External Dependencies

- `better-sqlite3`: SQLite database driver for Node.js.
- `drizzle-orm`: TypeScript ORM for SQLite.
- `zod`: Schema declaration and validation library.
- `drizzle-zod`: Integrates Drizzle ORM with Zod for schema validation.
- `orval`: Generates API hooks and Zod schemas from OpenAPI specifications.
- `esbuild`: Fast JavaScript bundler.
- `react`: Frontend UI library.
- `vite`: Next-generation frontend tooling.
- `tailwindcss`: CSS framework for rapid UI development.
- `express`: Web application framework for Node.js.
- `express-session`: Session management middleware for Express.
- `bcryptjs`: Pure JavaScript password hashing library.
- `electron`: Framework for building desktop applications with web technologies.
- `electron-builder`: A complete solution to package and build a ready for distribution Electron app.

## Electron Packaging — Native Module Chain

### Problem History & Fixes

**Fix 1: bcrypt → bcryptjs (Phase 7)**
`bcrypt` (native C++) was in esbuild's `external` list but not in `extraResources`.
Fix: replaced with `bcryptjs` (pure JS), removed from external list → now bundled in `dist/index.mjs`.

**Fix 2: better-sqlite3 ABI mismatch (Phase 8)**
Original `extraResources` copied from `api-server/node_modules/better-sqlite3` (Linux/regular Node ABI).
Fix: added `better-sqlite3` to `electron-app/package.json` dependencies → `npmRebuild: true` rebuilds it for Electron ABI → `extraResources` copies from `./node_modules/better-sqlite3` (rebuilt version).

**Fix 3: bindings not found (Phase 9)**  
`better-sqlite3/lib/database.js:48`: `require('bindings')('better_sqlite3.node')`.
pnpm virtual store keeps `bindings` and `file-uri-to-path` as sibling packages in `.pnpm/` virtual store, NOT symlinked to `electron-app/node_modules/`. `extraResources` copies only the package, not its siblings.
Fix: Created `assets/bindings-stub/index.js` — a minimal replacement for `bindings` that:
- Requires NO external dependencies (only Node.js built-ins)
- Finds `better_sqlite3.node` from `path.join(__dirname, '../better-sqlite3/build/Release/')`
- Also accepts `BETTER_SQLITE3_PATH` env var (for diagnostics)
- Copied to `resources/backend/node_modules/bindings/` via extraResources

### Final Structure in Packaged App
```
resources/
  backend/
    dist/
      index.mjs              ← esbuild bundle (bcryptjs bundled, better-sqlite3 external)
    node_modules/
      better-sqlite3/        ← copied from electron-app/node_modules (Electron ABI rebuilt)
        lib/database.js      ← requires 'bindings' → finds our stub
        build/Release/
          better_sqlite3.node  ← Windows native binary for Electron ABI
      bindings/              ← our bindings-stub (zero deps)
        index.js             ← resolves binary from ../better-sqlite3/build/Release/
  frontend/                  ← React static files
```

### Environment Variables (backend process)
- `DATABASE_PATH` — absolute path to SQLite database file
- `PORT` — HTTP port (8080)
- `SERVE_STATIC=true` + `STATIC_PATH` — serve frontend
- `SESSION_SECRET` — derived from userData path
- `BETTER_SQLITE3_PATH` — absolute path to better-sqlite3 package (for logging/fallback)

### Build Command (Windows)
```powershell
pnpm install                    # installs all deps including electron-app/better-sqlite3
cd artifacts/electron-app
pnpm run dist:win               # builds backend+frontend+electron, rebuilds native, packages
```

### Diagnostic Log (on startup failure)
`C:\Users\{name}\AppData\Roaming\Buku Hutang\buku-hutang.log`
Key lines to check:
- `[native] better-sqlite3 exists: true/false`
- `[native] bindings stub exists: true/false`
- `[native] better_sqlite3.node exists: true/false`
- `[native] build/Release files: better_sqlite3.node` ← this file must exist
- `[backend:err] ...` ← backend error output