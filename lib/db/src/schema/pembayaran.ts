import { pgTable, text, serial, timestamp, integer, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usahaTable } from "./usaha";
import { hutangTable } from "./hutang";
import { pelangganTable } from "./pelanggan";

export const pembayaranTable = pgTable("pembayaran", {
  id: serial("id").primaryKey(),
  usahaId: integer("usaha_id").notNull().references(() => usahaTable.id),
  hutangId: integer("hutang_id").notNull().references(() => hutangTable.id),
  pelangganId: integer("pelanggan_id").notNull().references(() => pelangganTable.id),
  tanggalBayar: text("tanggal_bayar").notNull(),
  nominalBayar: numeric("nominal_bayar", { precision: 15, scale: 2 }).notNull(),
  catatan: text("catatan"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertPembayaranSchema = createInsertSchema(pembayaranTable).omit({ id: true, createdAt: true });
export type InsertPembayaran = z.infer<typeof insertPembayaranSchema>;
export type Pembayaran = typeof pembayaranTable.$inferSelect;
