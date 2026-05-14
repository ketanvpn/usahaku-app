import { type Request, type Response, type NextFunction } from "express";
import { db, usahaTable, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

declare module "express-session" {
  interface SessionData {
    userId: number;
    role: "super_admin" | "owner";
    usahaId: number | null;
  }
}

// Endpoint yang tetap boleh diakses walau user belum mengganti password default.
// Tujuannya: user harus bisa lihat profil sendiri, ganti password, dan logout —
// tanpa bisa mengakses fitur bisnis lain.
const PASSWORD_CHANGE_ALLOWLIST = new Set<string>([
  "/api/auth/me",
  "/api/auth/change-password",
  "/api/auth/logout",
  "/api/healthz",
]);

export async function enforcePasswordChange(req: Request, res: Response, next: NextFunction): Promise<void> {
  // Skip bila belum login — endpoint yang butuh auth akan ditangani oleh
  // requireAuth/requireSuperAdmin/requireOwner masing-masing.
  if (!req.session.userId) {
    next();
    return;
  }

  // Path Express sudah include "/api" karena middleware ini dipasang di level app.
  const path = req.path;
  if (PASSWORD_CHANGE_ALLOWLIST.has(path)) {
    next();
    return;
  }

  try {
    const [user] = await db
      .select({ mustChangePassword: usersTable.mustChangePassword })
      .from(usersTable)
      .where(eq(usersTable.id, req.session.userId));

    if (user?.mustChangePassword) {
      res.status(403).json({
        error: "PASSWORD_CHANGE_REQUIRED",
        message: "Password default wajib diganti sebelum mengakses fitur lain. Buka menu Profil → Ganti Password.",
      });
      return;
    }
  } catch {
    // Jika DB tidak bisa diakses, jangan blokir — biarkan request lanjut dan
    // gagal di handler masing-masing dengan error yang lebih informatif.
  }

  next();
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!req.session.userId) {
    res.status(401).json({ error: "Tidak terautentikasi. Silakan login terlebih dahulu." });
    return;
  }
  next();
}

export function requireSuperAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!req.session.userId) {
    res.status(401).json({ error: "Tidak terautentikasi." });
    return;
  }
  if (req.session.role !== "super_admin") {
    res.status(403).json({ error: "Akses ditolak. Hanya Super Admin yang dapat mengakses ini." });
    return;
  }
  next();
}

export function requireOwner(req: Request, res: Response, next: NextFunction): void {
  if (!req.session.userId) {
    res.status(401).json({ error: "Tidak terautentikasi." });
    return;
  }
  if (req.session.role !== "owner") {
    res.status(403).json({ error: "Akses ditolak. Hanya Owner yang dapat mengakses ini." });
    return;
  }
  next();
}

// Endpoint internal hanya boleh dipanggil dari Electron main process di mesin
// yang sama. Tolak request yang remote-address-nya bukan loopback.
const LOOPBACK_ADDRESSES = new Set([
  "127.0.0.1",
  "::1",
  "::ffff:127.0.0.1",
]);

export function requireLoopback(req: Request, res: Response, next: NextFunction): void {
  const remote = req.socket?.remoteAddress ?? "";
  if (!LOOPBACK_ADDRESSES.has(remote)) {
    res.status(403).json({ error: "Endpoint internal hanya dapat diakses dari aplikasi Usahaku." });
    return;
  }
  next();
}

export async function requireLicense(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (req.session.role === "super_admin") {
    next();
    return;
  }

  const usahaId = req.session.usahaId;
  if (!usahaId) {
    res.status(403).json({ error: "LISENSI_TIDAK_AKTIF", message: "Lisensi tidak aktif. Silakan aktivasi lisensi terlebih dahulu." });
    return;
  }

  const [usaha] = await db
    .select({ licenseExpiresAt: usahaTable.licenseExpiresAt, lastSeenDate: usahaTable.lastSeenDate })
    .from(usahaTable)
    .where(eq(usahaTable.id, usahaId));

  if (!usaha?.licenseExpiresAt) {
    res.status(403).json({ error: "LISENSI_TIDAK_AKTIF", message: "Lisensi tidak aktif. Silakan aktivasi lisensi terlebih dahulu." });
    return;
  }

  if (usaha.lastSeenDate) {
    const todayStr = new Date().toISOString().slice(0, 10);
    const lastSeenMs = new Date(usaha.lastSeenDate + "T12:00:00Z").getTime();
    const todayMs = new Date(todayStr + "T12:00:00Z").getTime();
    const selisihHari = (lastSeenMs - todayMs) / (24 * 60 * 60 * 1000);
    // Flag manipulasi hanya jika mundur LEBIH DARI 1 hari (toleransi 1 hari)
    if (selisihHari > 1) {
      res.status(403).json({
        error: "JAM_DIMANIPULASI",
        message: "Tanggal sistem terdeteksi dimundurkan. Betulkan tanggal dan waktu ke tanggal yang benar, lalu buka ulang aplikasi.",
      });
      return;
    }
  }

  const expiresAt = new Date(usaha.licenseExpiresAt);
  if (expiresAt < new Date()) {
    res.status(403).json({ error: "LISENSI_HABIS", message: `Lisensi habis sejak ${expiresAt.toLocaleDateString("id-ID")}. Silakan aktivasi ulang.` });
    return;
  }

  next();
}
