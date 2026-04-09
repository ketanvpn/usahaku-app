import { type Request, type Response, type NextFunction } from "express";

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
