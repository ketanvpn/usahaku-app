import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usahaTable } from "./usaha";

export const pelangganTable = sqliteTable("pelanggan", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  usahaId: integer("usaha_id").notNull().references(() => usahaTable.id),
  nama: text("nama").notNull(),
  telepon: text("telepon"),
  alamat: text("alamat"),
  catatan: text("catatan"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
});

export const insertPelangganSchema = createInsertSchema(pelangganTable).omit({ id: true, createdAt: true });
export type InsertPelanggan = z.infer<typeof insertPelangganSchema>;
export type Pelanggan = typeof pelangganTable.$inferSelect;
