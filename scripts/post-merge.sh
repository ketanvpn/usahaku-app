#!/bin/bash
set -e
pnpm install --frozen-lockfile
# Catatan: schema migrasi dijalankan otomatis oleh lib/db/src/index.ts
# (CREATE TABLE IF NOT EXISTS + ALTER TABLE ADD COLUMN dengan try/catch).
# Tidak perlu drizzle-kit push di sini.
