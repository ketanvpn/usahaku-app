import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const licenseKeysTable = sqliteTable("license_keys", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  key: text("key").notNull().unique(),
  tipe: text("tipe", { enum: ["harian", "bulanan", "tahunan"] }).notNull(),
  expiresAt: text("expires_at").notNull(),
  isUsed: integer("is_used", { mode: "boolean" }).notNull().default(false),
  usedAt: text("used_at"),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
});

export type LicenseKey = typeof licenseKeysTable.$inferSelect;
