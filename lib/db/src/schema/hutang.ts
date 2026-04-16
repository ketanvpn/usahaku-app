import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usahaTable } from "./usaha";
import { pelangganTable } from "./pelanggan";

export const hutangTable = sqliteTable("hutang", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  usahaId: integer("usaha_id").notNull().references(() => usahaTable.id),
  pelangganId: integer("pelanggan_id").notNull().references(() => pelangganTable.id),
  tanggalHutang: text("tanggal_hutang").notNull(),
  tanggalJatuhTempo: text("tanggal_jatuh_tempo"),
  keterangan: text("keterangan"),
  nominalHutang: text("nominal_hutang").notNull(),
  totalDibayar: text("total_dibayar").notNull().default("0"),
  sisaHutang: text("sisa_hutang").notNull(),
  status: text("status").notNull().default("aktif").$type<"aktif" | "lunas">(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
});

export const insertHutangSchema = createInsertSchema(hutangTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertHutang = z.infer<typeof insertHutangSchema>;
export type Hutang = typeof hutangTable.$inferSelect;
