import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

// Enum tipe lisensi: nilai aktual yang disimpan di DB. Harus sinkron dengan
// `LicenseTipe` di artifacts/api-server/src/utils/license-crypto.ts.
export const licenseTipeValues = ["1bulan", "3bulan", "6bulan", "1tahun"] as const;
export type LicenseTipeValue = (typeof licenseTipeValues)[number];

export const licenseKeysTable = sqliteTable("license_keys", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  key: text("key").notNull().unique(),
  tipe: text("tipe", { enum: licenseTipeValues }).notNull(),
  expiresAt: text("expires_at").notNull(),
  isUsed: integer("is_used", { mode: "boolean" }).notNull().default(false),
  usedAt: text("used_at"),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
});

export type LicenseKey = typeof licenseKeysTable.$inferSelect;
