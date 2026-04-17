import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usahaTable } from "./usaha";
import { pekerjaTable } from "./pekerja";

export const upahPekerjaTable = sqliteTable("upah_pekerja", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  usahaId: integer("usaha_id").notNull().references(() => usahaTable.id),
  pekerjaid: integer("pekerja_id").notNull().references(() => pekerjaTable.id),
  keterangan: text("keterangan").notNull(),
  jumlahTotal: text("jumlah_total").notNull(),
  totalDibayar: text("total_dibayar").notNull().default("0"),
  sisaUpah: text("sisa_upah").notNull(),
  tanggalKerja: text("tanggal_kerja").notNull(),
  status: text("status").notNull().default("belum_lunas").$type<"belum_lunas" | "lunas">(),
  catatan: text("catatan"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
});

export const bayarUpahTable = sqliteTable("bayar_upah", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  usahaId: integer("usaha_id").notNull().references(() => usahaTable.id),
  upahId: integer("upah_id").notNull().references(() => upahPekerjaTable.id),
  jumlah: text("jumlah").notNull(),
  tanggalBayar: text("tanggal_bayar").notNull(),
  keuanganId: integer("keuangan_id"),
  catatan: text("catatan"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
});

export const insertUpahPekerjaSchema = createInsertSchema(upahPekerjaTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertUpahPekerja = z.infer<typeof insertUpahPekerjaSchema>;
export type UpahPekerja = typeof upahPekerjaTable.$inferSelect;

export const insertBayarUpahSchema = createInsertSchema(bayarUpahTable).omit({ id: true, createdAt: true });
export type InsertBayarUpah = z.infer<typeof insertBayarUpahSchema>;
export type BayarUpah = typeof bayarUpahTable.$inferSelect;
