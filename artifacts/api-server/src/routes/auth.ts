import { Router, type IRouter } from "express";
import bcrypt from "bcryptjs";
import { createHmac, timingSafeEqual } from "crypto";
import { db, usersTable, passwordResetUsesTable } from "@workspace/db";
import { and, eq } from "drizzle-orm";
import { LoginBody } from "@workspace/api-zod";
import { requireAuth } from "../middlewares/auth";
import { resolveSecret } from "../lib/security-secrets";

// Reset code HMAC dipisahkan dari LICENSE_SECRET supaya rotasi salah satu
// tidak menginvalidkan license key yang sudah aktif di banyak instalasi.
// Untuk transisi, jika RESET_SECRET tidak diset, fallback ke LICENSE_SECRET
// agar reset code yang sudah dibuat dengan tooling lama tetap diverifikasi
// sampai admin merotasi.
const RESET_SECRET_PRIMARY = resolveSecret({
  key: "RESET_SECRET",
  value: process.env.RESET_SECRET,
  fallback: "BUKUHUTANG_RESET_SECRET_V1_2026",
  reason: "dipakai untuk HMAC kode reset password",
});

const RESET_SECRET_LEGACY = resolveSecret({
  key: "LICENSE_SECRET",
  value: process.env.LICENSE_SECRET,
  fallback: "BUKUHUTANG_LICENSE_SECRET_V1_2024_OFFLINE",
  reason: "fallback verifikasi reset code lama",
});

function verifyResetSignature(payload: string, expected: Buffer): boolean {
  const candidates = [RESET_SECRET_PRIMARY, RESET_SECRET_LEGACY];
  for (const secret of candidates) {
    const sig = createHmac("sha256", secret).update(payload).digest().subarray(0, 4);
    if (sig.length === expected.length && timingSafeEqual(sig, expected)) {
      return true;
    }
  }
  return false;
}

const router: IRouter = Router();

const MAX_FAILED_ATTEMPTS = 5;
const LOCK_DURATION_MS = 15 * 60 * 1000;

type MemEntry = { attempts: number; lockedUntil: number | null };

// Device-wide lockout: semua percobaan gagal (username apapun) dihitung bersama
// Karena Electron app berjalan lokal, satu perangkat = satu "device key"
const deviceStore = new Map<string, MemEntry>();

// Counter terpisah untuk endpoint reset-with-code agar tidak
// mengkanibal lockout login. Reset code valid hanya 24 jam, jadi cukup
// pakai counter in-memory dengan window 15 menit.
const resetAttemptStore = new Map<string, MemEntry>();
const RESET_MAX_ATTEMPTS = 10;
const RESET_LOCK_MS = 15 * 60 * 1000;

function getDeviceKey(req: import("express").Request): string {
  const forwarded = req.headers["x-forwarded-for"];
  const ip = (Array.isArray(forwarded) ? forwarded[0] : forwarded)?.split(",")[0]?.trim()
    || req.socket?.remoteAddress
    || "local";
  return ip;
}

function getDeviceEntry(key: string): MemEntry {
  if (!deviceStore.has(key)) {
    deviceStore.set(key, { attempts: 0, lockedUntil: null });
  }
  return deviceStore.get(key)!;
}

function getResetEntry(key: string): MemEntry {
  if (!resetAttemptStore.has(key)) {
    resetAttemptStore.set(key, { attempts: 0, lockedUntil: null });
  }
  return resetAttemptStore.get(key)!;
}

router.post("/auth/login", async (req, res): Promise<void> => {
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Username dan password wajib diisi." });
    return;
  }

  const { username, password } = parsed.data;
  const now = Date.now();

  // Cek device-wide lockout sebelum apapun
  const deviceKey = getDeviceKey(req);
  const device = getDeviceEntry(deviceKey);

  if (device.lockedUntil && now < device.lockedUntil) {
    const sisaMenit = Math.ceil((device.lockedUntil - now) / 60000);
    res.status(429).json({
      error: `Terlalu banyak percobaan login yang gagal. Coba lagi dalam ${sisaMenit} menit.`,
      locked: true,
      sisa_menit: sisaMenit,
    });
    return;
  }

  if (device.lockedUntil && now >= device.lockedUntil) {
    device.attempts = 0;
    device.lockedUntil = null;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.username, username));

  if (!user) {
    device.attempts += 1;
    if (device.attempts >= MAX_FAILED_ATTEMPTS) {
      device.lockedUntil = now + LOCK_DURATION_MS;
      res.status(429).json({
        error: `Terlalu banyak percobaan login yang gagal. Coba lagi dalam 15 menit.`,
        locked: true,
        sisa_menit: 15,
      });
    } else {
      const sisaCoba = MAX_FAILED_ATTEMPTS - device.attempts;
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
    // Hitung di device store (device-wide) DAN per-user di DB
    device.attempts += 1;
    if (device.attempts >= MAX_FAILED_ATTEMPTS) {
      device.lockedUntil = now + LOCK_DURATION_MS;
    }

    const newAttempts = (user.failedAttempts ?? 0) + 1;
    if (newAttempts >= MAX_FAILED_ATTEMPTS) {
      const lockedUntil = new Date(now + LOCK_DURATION_MS).toISOString();
      await db.update(usersTable)
        .set({ failedAttempts: newAttempts, lockedUntil })
        .where(eq(usersTable.id, user.id));
      res.status(429).json({
        error: `Terlalu banyak percobaan login yang gagal. Coba lagi dalam 15 menit.`,
        locked: true,
        sisa_menit: 15,
      });
    } else {
      await db.update(usersTable)
        .set({ failedAttempts: newAttempts })
        .where(eq(usersTable.id, user.id));
      const sisaCoba = MAX_FAILED_ATTEMPTS - Math.max(newAttempts, device.attempts);
      res.status(401).json({
        error: `Username atau password salah. Sisa percobaan: ${Math.max(sisaCoba, 0)}.`,
        sisa_percobaan: Math.max(sisaCoba, 0),
      });
    }
    return;
  }

  // Login berhasil — reset device counter dan per-user counter
  device.attempts = 0;
  device.lockedUntil = null;
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
      must_change_password: user.mustChangePassword ?? false,
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
  await db.update(usersTable)
    .set({ passwordHash, mustChangePassword: false })
    .where(eq(usersTable.id, userId));

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
    must_change_password: user.mustChangePassword ?? false,
    created_at: user.createdAt.toISOString(),
  });
});

// GET /auth/usernames — public by design (no requireAuth).
// Dipakai oleh halaman Login untuk menampilkan daftar akun owner ketika user
// lupa username. Tidak mengembalikan password hash, hanya username + nama.
// Aman untuk Electron desktop karena backend hanya listen di loopback (127.0.0.1).
// Kalau backend pernah di-host di network publik/LAN, endpoint ini perlu
// dikunci ke loopback-only (requireLoopback) atau dihapus.
router.get("/auth/usernames", async (_req, res): Promise<void> => {
  const users = await db
    .select({ username: usersTable.username, nama: usersTable.nama })
    .from(usersTable)
    .where(eq(usersTable.role, "owner"));

  res.json(users.filter((u) => u.username !== "admin"));
});

router.post("/auth/reset-with-code", async (req, res): Promise<void> => {
  const now = Date.now();

  // Rate-limit per device: cegah brute-force tag HMAC 4 byte
  const deviceKey = getDeviceKey(req);
  const resetEntry = getResetEntry(deviceKey);
  if (resetEntry.lockedUntil && now < resetEntry.lockedUntil) {
    const sisaMenit = Math.ceil((resetEntry.lockedUntil - now) / 60000);
    res.status(429).json({
      error: `Terlalu banyak percobaan reset password. Coba lagi dalam ${sisaMenit} menit.`,
      locked: true,
      sisa_menit: sisaMenit,
    });
    return;
  }
  if (resetEntry.lockedUntil && now >= resetEntry.lockedUntil) {
    resetEntry.attempts = 0;
    resetEntry.lockedUntil = null;
  }

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
    bumpResetFailure(resetEntry, now);
    res.status(400).json({ error: "Format kode reset tidak valid." });
    return;
  }

  let buf: Buffer;
  try {
    buf = Buffer.from(clean, "hex");
  } catch {
    bumpResetFailure(resetEntry, now);
    res.status(400).json({ error: "Format kode reset tidak valid." });
    return;
  }

  if (buf.length !== 8) {
    bumpResetFailure(resetEntry, now);
    res.status(400).json({ error: "Format kode reset tidak valid." });
    return;
  }

  const expiryTs = buf.readUInt32BE(0);
  const sig = buf.subarray(4, 8);

  if (expiryTs < Math.floor(Date.now() / 1000)) {
    res.status(400).json({ error: "Kode reset sudah kadaluarsa. Minta kode baru dari administrator." });
    return;
  }

  const normalizedUsername = String(username).toLowerCase().trim();
  const payload = `PWRESET:${normalizedUsername}:${expiryTs}`;
  if (!verifyResetSignature(payload, sig)) {
    bumpResetFailure(resetEntry, now);
    res.status(400).json({ error: "Kode reset tidak valid. Pastikan kode diketik dengan benar." });
    return;
  }

  // Anti-replay: tolak jika kode untuk username + expiry yang sama sudah dipakai
  const [alreadyUsed] = await db
    .select({ id: passwordResetUsesTable.id })
    .from(passwordResetUsesTable)
    .where(
      and(
        eq(passwordResetUsesTable.username, normalizedUsername),
        eq(passwordResetUsesTable.expiryTs, expiryTs),
      ),
    );
  if (alreadyUsed) {
    res.status(400).json({ error: "Kode reset ini sudah pernah dipakai. Minta kode baru dari administrator." });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.username, String(username).trim()));
  if (!user) {
    bumpResetFailure(resetEntry, now);
    res.status(404).json({ error: "Username tidak ditemukan." });
    return;
  }

  const passwordHash = await bcrypt.hash(new_password, 10);
  await db.update(usersTable)
    .set({ passwordHash, mustChangePassword: false })
    .where(eq(usersTable.id, user.id));

  // Catat pemakaian kode untuk mencegah replay (idempotent via UNIQUE index)
  try {
    await db.insert(passwordResetUsesTable).values({
      username: normalizedUsername,
      expiryTs,
      usedAt: new Date().toISOString(),
    });
  } catch {
    // Abaikan jika race condition menyebabkan duplikat — toh password sudah diganti.
  }

  // Reset counter setelah sukses
  resetEntry.attempts = 0;
  resetEntry.lockedUntil = null;

  res.json({ message: "Password berhasil direset. Silakan login dengan password baru." });
});

function bumpResetFailure(entry: MemEntry, now: number): void {
  entry.attempts += 1;
  if (entry.attempts >= RESET_MAX_ATTEMPTS) {
    entry.lockedUntil = now + RESET_LOCK_MS;
  }
}

export default router;
