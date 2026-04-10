import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { usahaTable } from "./usaha";

export const keuanganTable = sqliteTable("keuangan", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  usahaId: integer("usaha_id").notNull().references(() => usahaTable.id),
  tanggal: text("tanggal").notNull(),
  tipe: text("tipe", { enum: ["masuk", "keluar"] }).notNull(),
  kategori: text("kategori"),
  keterangan: text("keterangan").notNull(),
  jumlah: text("jumlah").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
});

export type Keuangan = typeof keuanganTable.$inferSelect;
