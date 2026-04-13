import { Router, type IRouter } from "express";
import bcrypt from "bcryptjs";
import { createHmac } from "crypto";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { LoginBody } from "@workspace/api-zod";
import { requireAuth } from "../middlewares/auth";

const RESET_SECRET = process.env.LICENSE_SECRET ?? "BUKUHUTANG_LICENSE_SECRET_V1_2024_OFFLINE";

const router: IRouter = Router();

const MAX_FAILED_ATTEMPTS = 5;
const LOCK_DURATION_MS = 15 * 60 * 1000;

type MemEntry = { attempts: number; lockedUntil: number | null };
const memStore = new Map<string, MemEntry>();

function getMemEntry(username: string): MemEntry {
  if (!memStore.has(username)) {
    memStore.set(username, { attempts: 0, lockedUntil: null });
  }
  return memStore.get(username)!;
}

router.post("/auth/login", async (req, res): Promise<void> => {
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Username dan password wajib diisi." });
    return;
  }

  const { username, password } = parsed.data;
  const now = Date.now();

  const [user] = await db.select().from(usersTable).where(eq(usersTable.username, username));

  if (!user) {
    const mem = getMemEntry(username);

    if (mem.lockedUntil && now < mem.lockedUntil) {
      const sisaMenit = Math.ceil((mem.lockedUntil - now) / 60000);
      res.status(429).json({
        error: `Terlalu banyak percobaan login yang gagal. Coba lagi dalam ${sisaMenit} menit.`,
        locked: true,
        sisa_menit: sisaMenit,
      });
      return;
    }

    if (mem.lockedUntil && now >= mem.lockedUntil) {
      mem.attempts = 0;
      mem.lockedUntil = null;
    }

    mem.attempts += 1;

    if (mem.attempts >= MAX_FAILED_ATTEMPTS) {
      mem.lockedUntil = now + LOCK_DURATION_MS;
      res.status(429).json({
        error: `Terlalu banyak percobaan login yang gagal. Akun dikunci selama 15 menit.`,
        locked: true,
        sisa_menit: 15,
      });
    } else {
      const sisaCoba = MAX_FAILED_ATTEMPTS - mem.attempts;
      res.status(401).json({
        error: `Username atau password salah. Sisa percobaan: ${sisaCoba}.`,
        sisa_percobaan: sisaCoba,
      });
    }
    return;
  }

  if (!user.isActive) {
    res.status(401).json({ error: "Akun Anda tidak aktif. Hubungi administrator." });
    return;
  }

  if (user.lockedUntil) {
    const lockedUntilMs = new Date(user.lockedUntil).getTime();
    if (now < lockedUntilMs) {
      const sisaMenit = Math.ceil((lockedUntilMs - now) / 60000);
      res.status(429).json({
        error: `Akun dikunci sementara karena terlalu banyak percobaan login yang gagal. Coba lagi dalam ${sisaMenit} menit.`,
        locked: true,
        sisa_menit: sisaMenit,
      });
      return;
    }
    await db.update(usersTable)
      .set({ failedAttempts: 0, lockedUntil: null })
      .where(eq(usersTable.id, user.id));
    user.failedAttempts = 0;
    user.lockedUntil = null;
  }

  const passwordMatch = await bcrypt.compare(password, user.passwordHash);
  if (!passwordMatch) {
    const newAttempts = (user.failedAttempts ?? 0) + 1;
    if (newAttempts >= MAX_FAILED_ATTEMPTS) {
      const lockedUntil = new Date(now + LOCK_DURATION_MS).toISOString();
      await db.update(usersTable)
        .set({ failedAttempts: newAttempts, lockedUntil })
        .where(eq(usersTable.id, user.id));
      res.status(429).json({
        error: `Terlalu banyak percobaan login yang gagal. Akun dikunci selama 15 menit.`,
        locked: true,
        sisa_menit: 15,
      });
    } else {
      await db.update(usersTable)
        .set({ failedAttempts: newAttempts })
        .where(eq(usersTable.id, user.id));
      const sisaCoba = MAX_FAILED_ATTEMPTS - newAttempts;
      res.status(401).json({
        error: `Username atau password salah. Sisa percobaan: ${sisaCoba}.`,
        sisa_percobaan: sisaCoba,
      });
    }
    return;
  }

  await db.update(usersTable)
    .set({ failedAttempts: 0, lockedUntil: null })
    .where(eq(usersTable.id, user.id));

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

router.get("/auth/usernames", async (req, res): Promise<void> => {
  const users = await db
    .select({ username: usersTable.username, nama: usersTable.nama })
    .from(usersTable)
    .where(eq(usersTable.role, "owner"));

  res.json(users.filter((u) => u.username !== "admin"));
});

router.post("/auth/reset-with-code", async (req, res): Promise<void> => {
  const { username, reset_code, new_password } = req.body;

  if (!username || !reset_code || !new_password) {
    res.status(400).json({ error: "Username, kode reset, dan password baru wajib diisi." });
    return;
  }

  if (typeof new_password !== "string" || new_password.length < 6) {
    res.status(400).json({ error: "Password baru minimal 6 karakter." });
    return;
  }

  const clean = String(reset_code).trim().toUpperCase().replace(/^RST-/, "").replace(/-/g, "");
  if (clean.length !== 16) {
    res.status(400).json({ error: "Format kode reset tidak valid." });
    return;
  }

  let buf: Buffer;
  try {
    buf = Buffer.from(clean, "hex");
  } catch {
    res.status(400).json({ error: "Format kode reset tidak valid." });
    return;
  }

  if (buf.length !== 8) {
    res.status(400).json({ error: "Format kode reset tidak valid." });
    return;
  }

  const expiryTs = buf.readUInt32BE(0);
  const sig = buf.subarray(4, 8);

  if (expiryTs < Math.floor(Date.now() / 1000)) {
    res.status(400).json({ error: "Kode reset sudah kadaluarsa. Minta kode baru dari administrator." });
    return;
  }

  const payload = `PWRESET:${String(username).toLowerCase().trim()}:${expiryTs}`;
  const hmac = createHmac("sha256", RESET_SECRET).update(payload).digest();
  const expectedSig = hmac.subarray(0, 4);

  if (!sig.equals(expectedSig)) {
    res.status(400).json({ error: "Kode reset tidak valid. Pastikan kode diketik dengan benar." });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.username, String(username).trim()));
  if (!user) {
    res.status(404).json({ error: "Username tidak ditemukan." });
    return;
  }

  const passwordHash = await bcrypt.hash(new_password, 10);
  await db.update(usersTable).set({ passwordHash }).where(eq(usersTable.id, user.id));

  res.json({ message: "Password berhasil direset. Silakan login dengan password baru." });
});

export default router;
