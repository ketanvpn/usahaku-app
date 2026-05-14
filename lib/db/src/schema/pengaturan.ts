import { sqliteTable, text, integer, uniqueIndex } from "drizzle-orm/sqlite-core";
import { usahaTable } from "./usaha";

export const pengaturanTable = sqliteTable(
  "pengaturan",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    usahaId: integer("usaha_id")
      .notNull()
      .references(() => usahaTable.id),
    key: text("key").notNull(),
    value: text("value"),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => ({
    uniqUsahaKey: uniqueIndex("pengaturan_usaha_key").on(
      table.usahaId,
      table.key,
    ),
  }),
);

export type Pengaturan = typeof pengaturanTable.$inferSelect;
export type InsertPengaturan = typeof pengaturanTable.$inferInsert;
