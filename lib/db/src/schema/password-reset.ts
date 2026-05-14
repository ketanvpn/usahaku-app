import { sqliteTable, text, integer, uniqueIndex } from "drizzle-orm/sqlite-core";

export const passwordResetUsesTable = sqliteTable(
  "password_reset_uses",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    username: text("username").notNull(),
    expiryTs: integer("expiry_ts").notNull(),
    usedAt: text("used_at").notNull(),
  },
  (table) => ({
    uniqUsernameExpiry: uniqueIndex("password_reset_uses_username_expiry").on(
      table.username,
      table.expiryTs,
    ),
  }),
);

export type PasswordResetUse = typeof passwordResetUsesTable.$inferSelect;
