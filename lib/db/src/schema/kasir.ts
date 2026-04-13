import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { usahaTable } from "./usaha";

export const transaksiKasirTable = sqliteTable("transaksi_kasir", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  usahaId: integer("usaha_id").notNull().references(() => usahaTable.id),
  tanggal: text("tanggal").notNull(),
  total: text("total").notNull().default("0"),
  diskon: text("diskon").notNull().default("0"),
  uangBayar: text("uang_bayar").notNull().default("0"),
  kembalian: text("kembalian").notNull().default("0"),
  catatan: text("catatan"),
  keuanganId: integer("keuangan_id"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
});

export const transaksiKasirItemTable = sqliteTable("transaksi_kasir_item", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  transaksiKasirId: integer("transaksi_kasir_id").notNull().references(() => transaksiKasirTable.id),
  barangId: integer("barang_id").notNull(),
  namaBarang: text("nama_barang").notNull(),
  satuan: text("satuan").notNull(),
  jumlah: text("jumlah").notNull(),
  hargaSatuan: text("harga_satuan").notNull(),
  subtotal: text("subtotal").notNull(),
});

export type TransaksiKasir = typeof transaksiKasirTable.$inferSelect;
export type TransaksiKasirItem = typeof transaksiKasirItemTable.$inferSelect;
