import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { usahaTable } from "./usaha";

export const barangTable = sqliteTable("barang", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  usahaId: integer("usaha_id").notNull().references(() => usahaTable.id),
  nama: text("nama").notNull(),
  satuan: text("satuan").notNull(),
  hargaBeli: text("harga_beli").notNull().default("0"),
  hargaJual: text("harga_jual").notNull().default("0"),
  stok: text("stok").notNull().default("0"),
  stokMinimum: text("stok_minimum").notNull().default("0"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
});

export const transaksiStokTable = sqliteTable("transaksi_stok", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  usahaId: integer("usaha_id").notNull().references(() => usahaTable.id),
  barangId: integer("barang_id").notNull().references(() => barangTable.id),
  tanggal: text("tanggal").notNull(),
  tipe: text("tipe", { enum: ["masuk", "keluar"] }).notNull(),
  jumlah: text("jumlah").notNull(),
  hargaSatuan: text("harga_satuan").notNull(),
  keterangan: text("keterangan"),
  keuanganId: integer("keuangan_id"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
});

export type Barang = typeof barangTable.$inferSelect;
export type TransaksiStok = typeof transaksiStokTable.$inferSelect;
