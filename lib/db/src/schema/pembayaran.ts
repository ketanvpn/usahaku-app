import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usahaTable } from "./usaha";
import { hutangTable } from "./hutang";
import { pelangganTable } from "./pelanggan";

export const pembayaranTable = sqliteTable("pembayaran", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  usahaId: integer("usaha_id").notNull().references(() => usahaTable.id),
  hutangId: integer("hutang_id").notNull().references(() => hutangTable.id),
  pelangganId: integer("pelanggan_id").notNull().references(() => pelangganTable.id),
  tanggalBayar: text("tanggal_bayar").notNull(),
  nominalBayar: text("nominal_bayar").notNull(),
  catatan: text("catatan"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
});

export const insertPembayaranSchema = createInsertSchema(pembayaranTable).omit({ id: true, createdAt: true });
export type InsertPembayaran = z.infer<typeof insertPembayaranSchema>;
export type Pembayaran = typeof pembayaranTable.$inferSelect;
