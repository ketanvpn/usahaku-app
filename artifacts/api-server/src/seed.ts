import bcrypt from "bcryptjs";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "./lib/logger";
import { resolveSecret } from "./lib/security-secrets";

async function seed() {
  logger.info("Starting seed...");

  const existingAdmin = await db.select().from(usersTable).where(eq(usersTable.username, "admin"));
  if (existingAdmin.length > 0) {
    logger.info("Seed data already exists. Skipping.");
    return;
  }

  // Password admin awal bisa di-override lewat env SUPER_ADMIN_PASSWORD.
  // Jika tidak diset, fallback ke nilai default — tapi user akan dipaksa
  // mengganti password setelah login pertama (mustChangePassword = true).
  const initialPassword =
    process.env.SUPER_ADMIN_PASSWORD && process.env.SUPER_ADMIN_PASSWORD.trim().length > 0
      ? process.env.SUPER_ADMIN_PASSWORD
      : "maduTJ150";

  const adminHash = await bcrypt.hash(initialPassword, 10);
  await db.insert(usersTable).values({
    nama: "Super Admin",
    username: "admin",
    passwordHash: adminHash,
    role: "super_admin",
    usahaId: null,
    isActive: true,
    mustChangePassword: true,
  });

  logger.info("Seed completed: Super Admin created. Password wajib diganti setelah login pertama.");
}

export { seed };
