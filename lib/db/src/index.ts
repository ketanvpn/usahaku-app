import { createRequire } from "module";
import type BetterSqlite3 from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { mkdirSync } from "fs";
import path from "path";
import * as schema from "./schema";

const _require = createRequire(import.meta.url);

const _bsPath = process.env.BETTER_SQLITE3_PATH;
const Database = (_bsPath ? _require(_bsPath) : _require("better-sqlite3")) as typeof BetterSqlite3;

const DB_PATH = process.env.DATABASE_PATH || path.join(process.cwd(), "data", "app.db");

mkdirSync(path.dirname(DB_PATH), { recursive: true });

const sqlite = new Database(DB_PATH);

sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

sqlite.exec(`
  CREATE TABLE IF NOT EXISTS usaha (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nama_usaha TEXT NOT NULL,
    alamat TEXT,
    telepon TEXT,
    catatan TEXT,
    created_at INTEGER NOT NULL DEFAULT (CAST((julianday('now') - 2440587.5)*86400000 AS INTEGER))
  );

  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nama TEXT NOT NULL,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL,
    usaha_id INTEGER REFERENCES usaha(id),
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at INTEGER NOT NULL DEFAULT (CAST((julianday('now') - 2440587.5)*86400000 AS INTEGER))
  );

  CREATE TABLE IF NOT EXISTS pelanggan (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    usaha_id INTEGER NOT NULL REFERENCES usaha(id),
    nama TEXT NOT NULL,
    telepon TEXT,
    alamat TEXT,
    catatan TEXT,
    created_at INTEGER NOT NULL DEFAULT (CAST((julianday('now') - 2440587.5)*86400000 AS INTEGER))
  );

  CREATE TABLE IF NOT EXISTS hutang (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    usaha_id INTEGER NOT NULL REFERENCES usaha(id),
    pelanggan_id INTEGER NOT NULL REFERENCES pelanggan(id),
    tanggal_hutang TEXT NOT NULL,
    keterangan TEXT,
    nominal_hutang TEXT NOT NULL,
    total_dibayar TEXT NOT NULL DEFAULT '0',
    sisa_hutang TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'aktif',
    created_at INTEGER NOT NULL DEFAULT (CAST((julianday('now') - 2440587.5)*86400000 AS INTEGER)),
    updated_at INTEGER NOT NULL DEFAULT (CAST((julianday('now') - 2440587.5)*86400000 AS INTEGER))
  );

  CREATE TABLE IF NOT EXISTS pembayaran (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    usaha_id INTEGER NOT NULL REFERENCES usaha(id),
    hutang_id INTEGER NOT NULL REFERENCES hutang(id),
    pelanggan_id INTEGER NOT NULL REFERENCES pelanggan(id),
    tanggal_bayar TEXT NOT NULL,
    nominal_bayar TEXT NOT NULL,
    catatan TEXT,
    created_at INTEGER NOT NULL DEFAULT (CAST((julianday('now') - 2440587.5)*86400000 AS INTEGER))
  );

  CREATE TABLE IF NOT EXISTS license_keys (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key TEXT NOT NULL UNIQUE,
    tipe TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    is_used INTEGER NOT NULL DEFAULT 0,
    used_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

try { sqlite.exec(`ALTER TABLE usaha ADD COLUMN license_expires_at TEXT`); } catch { /* column already exists */ }


export const db = drizzle(sqlite, { schema });

export * from "./schema";
