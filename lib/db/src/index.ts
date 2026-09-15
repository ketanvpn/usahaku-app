import { createRequire } from "module";
import type BetterSqlite3 from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { mkdirSync } from "fs";
import path from "path";
import * as schema from "./schema";

// ---------------------------------------------------------------------------
// 1. Bootstrap SQLite connection
// ---------------------------------------------------------------------------

const _require = createRequire(import.meta.url);

const _bsPath = process.env.BETTER_SQLITE3_PATH;
const Database = (_bsPath ? _require(_bsPath) : _require("better-sqlite3")) as typeof BetterSqlite3;

const DB_PATH = process.env.DATABASE_PATH || path.join(process.cwd(), "data", "app.db");

mkdirSync(path.dirname(DB_PATH), { recursive: true });

const sqlite: BetterSqlite3.Database = new Database(DB_PATH);

sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

// ---------------------------------------------------------------------------
// 2. Core tables (CREATE TABLE IF NOT EXISTS — idempotent, always safe)
// ---------------------------------------------------------------------------

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

  CREATE TABLE IF NOT EXISTS suppliers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    usaha_id INTEGER NOT NULL REFERENCES usaha(id),
    nama TEXT NOT NULL,
    telepon TEXT,
    alamat TEXT,
    catatan TEXT,
    created_at INTEGER NOT NULL DEFAULT (CAST((julianday('now') - 2440587.5)*86400000 AS INTEGER))
  );

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

  CREATE TABLE IF NOT EXISTS password_reset_uses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL,
    expiry_ts INTEGER NOT NULL,
    used_at TEXT NOT NULL
  );
  CREATE UNIQUE INDEX IF NOT EXISTS password_reset_uses_username_expiry
    ON password_reset_uses (username, expiry_ts);

  CREATE TABLE IF NOT EXISTS pengaturan (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    usaha_id INTEGER NOT NULL REFERENCES usaha(id),
    key TEXT NOT NULL,
    value TEXT,
    updated_at INTEGER NOT NULL DEFAULT (CAST((julianday('now') - 2440587.5)*86400000 AS INTEGER))
  );
  CREATE UNIQUE INDEX IF NOT EXISTS pengaturan_usaha_key
    ON pengaturan (usaha_id, key);
`);

// ---------------------------------------------------------------------------
// 3. Versioned migrations — each runs exactly once, tracked in schema_migrations
// ---------------------------------------------------------------------------

sqlite.exec(`
  CREATE TABLE IF NOT EXISTS schema_migrations (
    version INTEGER PRIMARY KEY,
    description TEXT NOT NULL,
    applied_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

interface Migration {
  version: number;
  description: string;
  up: string;
}

const migrations: Migration[] = [
  {
    version: 1,
    description: "usaha: add license_expires_at, last_seen_date",
    up: `
      ALTER TABLE usaha ADD COLUMN license_expires_at TEXT;
      ALTER TABLE usaha ADD COLUMN last_seen_date TEXT;
    `,
  },
  {
    version: 2,
    description: "users: add failed_attempts, locked_until, must_change_password",
    up: `
      ALTER TABLE users ADD COLUMN failed_attempts INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE users ADD COLUMN locked_until TEXT;
      ALTER TABLE users ADD COLUMN must_change_password INTEGER NOT NULL DEFAULT 0;
    `,
  },
  {
    version: 3,
    description: "barang: add kategori column",
    up: `ALTER TABLE barang ADD COLUMN kategori TEXT NOT NULL DEFAULT '';`,
  },
  {
    version: 4,
    description: "pembayaran: add nomor_kwitansi, sisa_hutang_setelah, keuangan_id",
    up: `
      ALTER TABLE pembayaran ADD COLUMN nomor_kwitansi TEXT;
      ALTER TABLE pembayaran ADD COLUMN sisa_hutang_setelah TEXT;
      ALTER TABLE pembayaran ADD COLUMN keuangan_id INTEGER;
    `,
  },
  {
    version: 5,
    description: "hutang: add tanggal_jatuh_tempo, keuangan_id",
    up: `
      ALTER TABLE hutang ADD COLUMN tanggal_jatuh_tempo TEXT;
      ALTER TABLE hutang ADD COLUMN keuangan_id INTEGER;
    `,
  },
  {
    version: 6,
    description: "transaksi_kasir: add diskon, keuangan_id",
    up: `
      ALTER TABLE transaksi_kasir ADD COLUMN diskon TEXT NOT NULL DEFAULT '0';
      ALTER TABLE transaksi_kasir ADD COLUMN keuangan_id INTEGER;
    `,
  },
  {
    version: 7,
    description: "pekerja: add pelanggan_id FK",
    up: `ALTER TABLE pekerja ADD COLUMN pelanggan_id INTEGER REFERENCES pelanggan(id) ON DELETE SET NULL;`,
  },
  {
    version: 8,
    description: "bayar_upah: add pembayaran_id FK",
    up: `ALTER TABLE bayar_upah ADD COLUMN pembayaran_id INTEGER REFERENCES pembayaran(id) ON DELETE SET NULL;`,
  },
  {
    version: 9,
    description: "transaksi_stok: add supplier_id",
    up: `ALTER TABLE transaksi_stok ADD COLUMN supplier_id INTEGER;`,
  },
  {
    version: 10,
    description: "transaksi_kasir_item: add harga_beli snapshot",
    up: `ALTER TABLE transaksi_kasir_item ADD COLUMN harga_beli TEXT;`,
  },
  {
    version: 11,
    description: "Add FK indexes for query performance",
    up: `
      CREATE INDEX IF NOT EXISTS idx_pelanggan_usaha_id ON pelanggan(usaha_id);
      CREATE INDEX IF NOT EXISTS idx_hutang_usaha_id ON hutang(usaha_id);
      CREATE INDEX IF NOT EXISTS idx_hutang_pelanggan_id ON hutang(pelanggan_id);
      CREATE INDEX IF NOT EXISTS idx_pembayaran_usaha_id ON pembayaran(usaha_id);
      CREATE INDEX IF NOT EXISTS idx_pembayaran_hutang_id ON pembayaran(hutang_id);
      CREATE INDEX IF NOT EXISTS idx_pembayaran_pelanggan_id ON pembayaran(pelanggan_id);
      CREATE INDEX IF NOT EXISTS idx_keuangan_usaha_id ON keuangan(usaha_id);
      CREATE INDEX IF NOT EXISTS idx_barang_usaha_id ON barang(usaha_id);
      CREATE INDEX IF NOT EXISTS idx_transaksi_stok_usaha_id ON transaksi_stok(usaha_id);
      CREATE INDEX IF NOT EXISTS idx_transaksi_stok_barang_id ON transaksi_stok(barang_id);
      CREATE INDEX IF NOT EXISTS idx_transaksi_kasir_usaha_id ON transaksi_kasir(usaha_id);
      CREATE INDEX IF NOT EXISTS idx_transaksi_kasir_item_kasir_id ON transaksi_kasir_item(transaksi_kasir_id);
      CREATE INDEX IF NOT EXISTS idx_transaksi_kasir_item_barang_id ON transaksi_kasir_item(barang_id);
      CREATE INDEX IF NOT EXISTS idx_pekerja_usaha_id ON pekerja(usaha_id);
      CREATE INDEX IF NOT EXISTS idx_upah_pekerja_usaha_id ON upah_pekerja(usaha_id);
      CREATE INDEX IF NOT EXISTS idx_upah_pekerja_pekerja_id ON upah_pekerja(pekerja_id);
      CREATE INDEX IF NOT EXISTS idx_bayar_upah_usaha_id ON bayar_upah(usaha_id);
      CREATE INDEX IF NOT EXISTS idx_bayar_upah_upah_id ON bayar_upah(upah_id);
      CREATE INDEX IF NOT EXISTS idx_suppliers_usaha_id ON suppliers(usaha_id);
      CREATE INDEX IF NOT EXISTS idx_users_usaha_id ON users(usaha_id);
    `,
  },
];

/**
 * Run pending migrations inside a single transaction.
 * Existing databases (pre-migration-system) will have columns already
 * added by the old try/catch approach — SQLite's "duplicate column" error
 * is caught per-statement so we skip already-applied ALTERs gracefully.
 */
function runMigrations(db: BetterSqlite3.Database): void {
  const applied = new Set(
    (db.prepare("SELECT version FROM schema_migrations").all() as Array<{ version: number }>)
      .map((r) => r.version),
  );

  const pending = migrations.filter((m) => !applied.has(m.version));
  if (pending.length === 0) return;

  const insertMigration = db.prepare(
    "INSERT INTO schema_migrations (version, description) VALUES (?, ?)",
  );

  const runAll = db.transaction(() => {
    for (const migration of pending) {
      // Split multi-statement SQL and run each independently.
      // ALTER TABLE will throw "duplicate column" on existing DBs — that's expected.
      const statements = migration.up
        .split(";")
        .map((s) => s.trim())
        .filter((s) => s.length > 0);

      for (const stmt of statements) {
        try {
          db.exec(stmt);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          // "duplicate column name" = column already exists from old try/catch approach
          // "already exists" = index already exists
          if (msg.includes("duplicate column") || msg.includes("already exists")) {
            continue;
          }
          throw err; // Unexpected error — abort transaction
        }
      }

      insertMigration.run(migration.version, migration.description);
    }
  });

  runAll();

  console.log(`[db] Applied ${pending.length} migration(s): ${pending.map((m) => `v${m.version}`).join(", ")}`);
}

runMigrations(sqlite);

// ---------------------------------------------------------------------------
// 4. Exports
// ---------------------------------------------------------------------------

export const db = drizzle(sqlite, { schema });

export const sqliteRaw: BetterSqlite3.Database = sqlite;

export * from "./schema";
