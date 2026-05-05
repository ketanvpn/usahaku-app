import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usahaTable } from "./usaha";
import { pelangganTable } from "./pelanggan";

export const pekerjaTable = sqliteTable("pekerja", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  usahaId: integer("usaha_id").notNull().references(() => usahaTable.id),
  pelangganId: integer("pelanggan_id").references(() => pelangganTable.id, { onDelete: "set null" }),
  nama: text("nama").notNull(),
  telepon: text("telepon"),
  jabatan: text("jabatan"),
  catatan: text("catatan"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
});

export const insertPekerjaSchema = createInsertSchema(pekerjaTable).omit({ id: true, createdAt: true });
export type InsertPekerja = z.infer<typeof insertPekerjaSchema>;
export type Pekerja = typeof pekerjaTable.$inferSelect;
