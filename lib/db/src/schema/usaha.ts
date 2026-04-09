import { pgTable, text, serial, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const usahaTable = pgTable("usaha", {
  id: serial("id").primaryKey(),
  namaUsaha: text("nama_usaha").notNull(),
  alamat: text("alamat"),
  telepon: text("telepon"),
  catatan: text("catatan"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertUsahaSchema = createInsertSchema(usahaTable).omit({ id: true, createdAt: true });
export type InsertUsaha = z.infer<typeof insertUsahaSchema>;
export type Usaha = typeof usahaTable.$inferSelect;
