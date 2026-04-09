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
- `/pelanggan` — customer list (CRUD)
- `/pelanggan/:id` — customer detail with debt history
- `/hutang` — debt list with filters
- `/hutang/:id` — debt detail with payment history
- `/pembayaran` — payment recording
- `/laporan` — reports with CSV export and print
- `/backup` — backup & restore JSON
- `/profil` — profile and logout

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

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
