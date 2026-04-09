# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Aplikasi Manajemen Hutang (Debt Management App) for Indonesian small businesses.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
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
