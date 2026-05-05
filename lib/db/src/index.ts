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
try { sqlite.exec(`ALTER TABLE usaha ADD COLUMN last_seen_date TEXT`); } catch { /* column already exists */ }
try { sqlite.exec(`ALTER TABLE users ADD COLUMN failed_attempts INTEGER NOT NULL DEFAULT 0`); } catch { /* column already exists */ }
try { sqlite.exec(`ALTER TABLE users ADD COLUMN locked_until TEXT`); } catch { /* column already exists */ }
try { sqlite.exec(`ALTER TABLE barang ADD COLUMN kategori TEXT NOT NULL DEFAULT ''`); } catch { /* column already exists */ }
try { sqlite.exec(`ALTER TABLE pembayaran ADD COLUMN nomor_kwitansi TEXT`); } catch { /* column already exists */ }
try { sqlite.exec(`ALTER TABLE pembayaran ADD COLUMN sisa_hutang_setelah TEXT`); } catch { /* column already exists */ }
try { sqlite.exec(`ALTER TABLE pembayaran ADD COLUMN keuangan_id INTEGER`); } catch { /* column already exists */ }
try { sqlite.exec(`ALTER TABLE hutang ADD COLUMN tanggal_jatuh_tempo TEXT`); } catch { /* column already exists */ }
try { sqlite.exec(`ALTER TABLE hutang ADD COLUMN keuangan_id INTEGER`); } catch { /* column already exists */ }
try { sqlite.exec(`ALTER TABLE transaksi_kasir ADD COLUMN diskon TEXT NOT NULL DEFAULT '0'`); } catch { /* column already exists */ }
try { sqlite.exec(`ALTER TABLE transaksi_kasir ADD COLUMN keuangan_id INTEGER`); } catch { /* column already exists */ }
try { sqlite.exec(`ALTER TABLE pekerja ADD COLUMN pelanggan_id INTEGER REFERENCES pelanggan(id) ON DELETE SET NULL`); } catch { /* column already exists */ }
try { sqlite.exec(`ALTER TABLE bayar_upah ADD COLUMN pembayaran_id INTEGER REFERENCES pembayaran(id) ON DELETE SET NULL`); } catch { /* column already exists */ }

sqlite.exec(`
  CREATE TABLE IF NOT EXISTS barang (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    usaha_id INTEGER NOT NULL REFERENCES usaha(id),
    nama TEXT NOT NULL,
    satuan TEXT NOT NULL,
    harga_beli TEXT NOT NULL DEFAULT '0',
    harga_jual TEXT NOT NULL DEFAULT '0',
    stok TEXT NOT NULL DEFAULT '0',
    stok_minimum TEXT NOT NULL DEFAULT '0',
    created_at INTEGER NOT NULL DEFAULT (CAST((julianday('now') - 2440587.5)*86400000 AS INTEGER))
  );

  CREATE TABLE IF NOT EXISTS transaksi_stok (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    usaha_id INTEGER NOT NULL REFERENCES usaha(id),
    barang_id INTEGER NOT NULL REFERENCES barang(id),
    tanggal TEXT NOT NULL,
    tipe TEXT NOT NULL,
    jumlah TEXT NOT NULL,
    harga_satuan TEXT NOT NULL,
    keterangan TEXT,
    keuangan_id INTEGER,
    created_at INTEGER NOT NULL DEFAULT (CAST((julianday('now') - 2440587.5)*86400000 AS INTEGER))
  );
`);

sqlite.exec(`
  CREATE TABLE IF NOT EXISTS keuangan (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    usaha_id INTEGER NOT NULL REFERENCES usaha(id),
    tanggal TEXT NOT NULL,
    tipe TEXT NOT NULL,
    kategori TEXT,
    keterangan TEXT NOT NULL,
    jumlah TEXT NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (CAST((julianday('now') - 2440587.5)*86400000 AS INTEGER))
  );
`);


sqlite.exec(`
  CREATE TABLE IF NOT EXISTS transaksi_kasir (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    usaha_id INTEGER NOT NULL REFERENCES usaha(id),
    tanggal TEXT NOT NULL,
    total TEXT NOT NULL DEFAULT '0',
    uang_bayar TEXT NOT NULL DEFAULT '0',
    kembalian TEXT NOT NULL DEFAULT '0',
    catatan TEXT,
    created_at INTEGER NOT NULL DEFAULT (CAST((julianday('now') - 2440587.5)*86400000 AS INTEGER))
  );

  CREATE TABLE IF NOT EXISTS transaksi_kasir_item (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    transaksi_kasir_id INTEGER NOT NULL REFERENCES transaksi_kasir(id),
    barang_id INTEGER NOT NULL,
    nama_barang TEXT NOT NULL,
    satuan TEXT NOT NULL,
    jumlah TEXT NOT NULL,
    harga_satuan TEXT NOT NULL,
    subtotal TEXT NOT NULL
  );
`);

sqlite.exec(`
  CREATE TABLE IF NOT EXISTS pekerja (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    usaha_id INTEGER NOT NULL REFERENCES usaha(id),
    pelanggan_id INTEGER REFERENCES pelanggan(id) ON DELETE SET NULL,
    nama TEXT NOT NULL,
    telepon TEXT,
    jabatan TEXT,
    catatan TEXT,
    created_at INTEGER NOT NULL DEFAULT (CAST((julianday('now') - 2440587.5)*86400000 AS INTEGER))
  );

  CREATE TABLE IF NOT EXISTS upah_pekerja (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    usaha_id INTEGER NOT NULL REFERENCES usaha(id),
    pekerja_id INTEGER NOT NULL REFERENCES pekerja(id),
    keterangan TEXT NOT NULL,
    jumlah_total TEXT NOT NULL,
    total_dibayar TEXT NOT NULL DEFAULT '0',
    sisa_upah TEXT NOT NULL,
    tanggal_kerja TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'belum_lunas',
    catatan TEXT,
    created_at INTEGER NOT NULL DEFAULT (CAST((julianday('now') - 2440587.5)*86400000 AS INTEGER)),
    updated_at INTEGER NOT NULL DEFAULT (CAST((julianday('now') - 2440587.5)*86400000 AS INTEGER))
  );

  CREATE TABLE IF NOT EXISTS bayar_upah (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    usaha_id INTEGER NOT NULL REFERENCES usaha(id),
    upah_id INTEGER NOT NULL REFERENCES upah_pekerja(id),
    jumlah TEXT NOT NULL,
    tanggal_bayar TEXT NOT NULL,
    keuangan_id INTEGER,
    pembayaran_id INTEGER REFERENCES pembayaran(id) ON DELETE SET NULL,
    catatan TEXT,
    created_at INTEGER NOT NULL DEFAULT (CAST((julianday('now') - 2440587.5)*86400000 AS INTEGER))
  );
`);

export const db = drizzle(sqlite, { schema });

export const sqliteRaw: any = sqlite;

export * from "./schema";
