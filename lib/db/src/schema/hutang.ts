import { pgTable, text, serial, timestamp, integer, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usahaTable } from "./usaha";
import { pelangganTable } from "./pelanggan";

export const hutangTable = pgTable("hutang", {
  id: serial("id").primaryKey(),
  usahaId: integer("usaha_id").notNull().references(() => usahaTable.id),
  pelangganId: integer("pelanggan_id").notNull().references(() => pelangganTable.id),
  tanggalHutang: text("tanggal_hutang").notNull(),
  keterangan: text("keterangan"),
  nominalHutang: numeric("nominal_hutang", { precision: 15, scale: 2 }).notNull(),
  totalDibayar: numeric("total_dibayar", { precision: 15, scale: 2 }).notNull().default("0"),
  sisaHutang: numeric("sisa_hutang", { precision: 15, scale: 2 }).notNull(),
  status: text("status").notNull().default("aktif").$type<"aktif" | "lunas">(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertHutangSchema = createInsertSchema(hutangTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertHutang = z.infer<typeof insertHutangSchema>;
export type Hutang = typeof hutangTable.$inferSelect;
