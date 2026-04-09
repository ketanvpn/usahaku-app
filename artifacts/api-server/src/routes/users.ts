import { Router, type IRouter } from "express";
import bcrypt from "bcryptjs";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import {
  CreateUserBody,
  UpdateUserParams,
  UpdateUserBody,
  DeleteUserParams,
  ResetUserPasswordParams,
  ResetUserPasswordBody,
  ToggleUserActiveParams,
} from "@workspace/api-zod";
import { requireSuperAdmin } from "../middlewares/auth";

const router: IRouter = Router();

function formatUser(u: typeof usersTable.$inferSelect) {
  return {
    id: u.id,
    nama: u.nama,
    username: u.username,
    role: u.role,
    usaha_id: u.usahaId ?? null,
    is_active: u.isActive,
    created_at: u.createdAt.toISOString(),
  };
}

router.get("/users", requireSuperAdmin, async (_req, res): Promise<void> => {
  const list = await db.select().from(usersTable).orderBy(usersTable.createdAt);
  res.json(list.map(formatUser));
});

router.post("/users", requireSuperAdmin, async (req, res): Promise<void> => {
  const parsed = CreateUserBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const existing = await db.select().from(usersTable).where(eq(usersTable.username, parsed.data.username));
  if (existing.length > 0) {
    res.status(400).json({ error: "Username sudah digunakan. Pilih username lain." });
    return;
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 10);

  const [user] = await db.insert(usersTable).values({
    nama: parsed.data.nama,
    username: parsed.data.username,
    passwordHash,
    role: parsed.data.role,
    usahaId: parsed.data.usaha_id ?? null,
    isActive: true,
  }).returning();

  res.status(201).json(formatUser(user));
});

router.put("/users/:id", requireSuperAdmin, async (req, res): Promise<void> => {
  const params = UpdateUserParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "ID tidak valid." });
    return;
  }

  const parsed = UpdateUserBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  if (parsed.data.username) {
    const existing = await db.select().from(usersTable).where(eq(usersTable.username, parsed.data.username));
    if (existing.length > 0 && existing[0].id !== params.data.id) {
      res.status(400).json({ error: "Username sudah digunakan." });
      return;
    }
  }

  const updateData: Partial<typeof usersTable.$inferInsert> = {};
  if (parsed.data.nama !== undefined) updateData.nama = parsed.data.nama;
  if (parsed.data.username !== undefined) updateData.username = parsed.data.username;
  if (parsed.data.role !== undefined) updateData.role = parsed.data.role;
  if (parsed.data.usaha_id !== undefined) updateData.usahaId = parsed.data.usaha_id ?? null;
  if (parsed.data.is_active !== undefined) updateData.isActive = parsed.data.is_active;

  const [user] = await db.update(usersTable).set(updateData).where(eq(usersTable.id, params.data.id)).returning();
  if (!user) {
    res.status(404).json({ error: "User tidak ditemukan." });
    return;
  }

  res.json(formatUser(user));
});

router.delete("/users/:id", requireSuperAdmin, async (req, res): Promise<void> => {
  const params = DeleteUserParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "ID tidak valid." });
    return;
  }

  const [user] = await db.delete(usersTable).where(eq(usersTable.id, params.data.id)).returning();
  if (!user) {
    res.status(404).json({ error: "User tidak ditemukan." });
    return;
  }

  res.json({ message: "User berhasil dihapus." });
});

router.post("/users/:id/reset-password", requireSuperAdmin, async (req, res): Promise<void> => {
  const params = ResetUserPasswordParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "ID tidak valid." });
    return;
  }

  const parsed = ResetUserPasswordBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Password baru wajib diisi." });
    return;
  }

  const passwordHash = await bcrypt.hash(parsed.data.new_password, 10);
  const [user] = await db.update(usersTable).set({ passwordHash }).where(eq(usersTable.id, params.data.id)).returning();

  if (!user) {
    res.status(404).json({ error: "User tidak ditemukan." });
    return;
  }

  res.json({ message: "Password berhasil direset." });
});

router.post("/users/:id/toggle-active", requireSuperAdmin, async (req, res): Promise<void> => {
  const params = ToggleUserActiveParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "ID tidak valid." });
    return;
  }

  const [existing] = await db.select().from(usersTable).where(eq(usersTable.id, params.data.id));
  if (!existing) {
    res.status(404).json({ error: "User tidak ditemukan." });
    return;
  }

  const [user] = await db.update(usersTable).set({ isActive: !existing.isActive }).where(eq(usersTable.id, params.data.id)).returning();

  res.json(formatUser(user));
});

export default router;
