import bcrypt from "bcryptjs";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "./lib/logger";

async function seed() {
  logger.info("Starting seed...");

  const existingAdmin = await db.select().from(usersTable).where(eq(usersTable.username, "admin"));
  if (existingAdmin.length > 0) {
    logger.info("Seed data already exists. Skipping.");
    return;
  }

  const adminHash = await bcrypt.hash("maduTJ150", 10);
  await db.insert(usersTable).values({
    nama: "Super Admin",
    username: "admin",
    passwordHash: adminHash,
    role: "super_admin",
    usahaId: null,
    isActive: true,
  });

  logger.info("Seed completed: Super Admin created.");
}

export { seed };
