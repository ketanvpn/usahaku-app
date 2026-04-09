import { Router, type IRouter } from "express";
import bcrypt from "bcrypt";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { LoginBody } from "@workspace/api-zod";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

router.post("/auth/login", async (req, res): Promise<void> => {
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Username dan password wajib diisi." });
    return;
  }

  const { username, password } = parsed.data;

  const [user] = await db.select().from(usersTable).where(eq(usersTable.username, username));

  if (!user) {
    res.status(401).json({ error: "Username atau password salah." });
    return;
  }

  if (!user.isActive) {
    res.status(401).json({ error: "Akun Anda tidak aktif. Hubungi administrator." });
    return;
  }

  const passwordMatch = await bcrypt.compare(password, user.passwordHash);
  if (!passwordMatch) {
    res.status(401).json({ error: "Username atau password salah." });
    return;
  }

  req.session.userId = user.id;
  req.session.role = user.role;
  req.session.usahaId = user.usahaId ?? null;

  res.json({
    message: "Login berhasil.",
    user: {
      id: user.id,
      nama: user.nama,
      username: user.username,
      role: user.role,
      usaha_id: user.usahaId ?? null,
      is_active: user.isActive,
      created_at: user.createdAt.toISOString(),
    },
  });
});

router.post("/auth/logout", (req, res): void => {
  req.session.destroy(() => {
    res.json({ message: "Logout berhasil." });
  });
});

router.post("/auth/change-password", requireAuth, async (req, res): Promise<void> => {
  const userId = req.session.userId;
  if (!userId) {
    res.status(401).json({ error: "Tidak terautentikasi." });
    return;
  }

  const { current_password, new_password } = req.body;

  if (!current_password || !new_password) {
    res.status(400).json({ error: "Password lama dan password baru wajib diisi." });
    return;
  }

  if (typeof new_password !== "string" || new_password.length < 6) {
    res.status(400).json({ error: "Password baru minimal 6 karakter." });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  if (!user) {
    res.status(404).json({ error: "User tidak ditemukan." });
    return;
  }

  const match = await bcrypt.compare(current_password, user.passwordHash);
  if (!match) {
    res.status(400).json({ error: "Password lama salah." });
    return;
  }

  const passwordHash = await bcrypt.hash(new_password, 10);
  await db.update(usersTable).set({ passwordHash }).where(eq(usersTable.id, userId));

  res.json({ message: "Password berhasil diubah." });
});

router.get("/auth/me", requireAuth, async (req, res): Promise<void> => {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.session.userId!));

  if (!user) {
    res.status(404).json({ error: "User tidak ditemukan." });
    return;
  }

  res.json({
    id: user.id,
    nama: user.nama,
    username: user.username,
    role: user.role,
    usaha_id: user.usahaId ?? null,
    is_active: user.isActive,
    created_at: user.createdAt.toISOString(),
  });
});

export default router;
