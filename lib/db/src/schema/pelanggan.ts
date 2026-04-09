import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usahaTable } from "./usaha";

export const pelangganTable = pgTable("pelanggan", {
  id: serial("id").primaryKey(),
  usahaId: integer("usaha_id").notNull().references(() => usahaTable.id),
  nama: text("nama").notNull(),
  telepon: text("telepon"),
  alamat: text("alamat"),
  catatan: text("catatan"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertPelangganSchema = createInsertSchema(pelangganTable).omit({ id: true, createdAt: true });
export type InsertPelanggan = z.infer<typeof insertPelangganSchema>;
export type Pelanggan = typeof pelangganTable.$inferSelect;
