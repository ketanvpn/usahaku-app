import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { usahaTable } from "./usaha";

export const suppliersTable = sqliteTable("suppliers", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  usahaId: integer("usaha_id").notNull().references(() => usahaTable.id),
  nama: text("nama").notNull(),
  telepon: text("telepon"),
  alamat: text("alamat"),
  catatan: text("catatan"),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export type Supplier = typeof suppliersTable.$inferSelect;
export type InsertSupplier = typeof suppliersTable.$inferInsert;
