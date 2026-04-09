import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const usahaTable = sqliteTable("usaha", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  namaUsaha: text("nama_usaha").notNull(),
  alamat: text("alamat"),
  telepon: text("telepon"),
  catatan: text("catatan"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
});

export const insertUsahaSchema = createInsertSchema(usahaTable).omit({ id: true, createdAt: true });
export type InsertUsaha = z.infer<typeof insertUsahaSchema>;
export type Usaha = typeof usahaTable.$inferSelect;
