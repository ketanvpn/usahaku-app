import { type Request, type Response, type NextFunction } from "express";
import { db, usahaTable } from "@workspace/db";
import { eq } from "drizzle-orm";

declare module "express-session" {
  interface SessionData {
    userId: number;
    role: "super_admin" | "owner";
    usahaId: number | null;
  }
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
    if (todayStr < usaha.lastSeenDate) {
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
