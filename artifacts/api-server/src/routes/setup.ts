import { Router, type IRouter } from "express";
import bcrypt from "bcryptjs";
import { db, usahaTable, usersTable, licenseKeysTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { verifyLicenseKey } from "../utils/license-crypto";

const router: IRouter = Router();

router.get("/setup/status", async (_req, res): Promise<void> => {
  const owners = await db.select().from(usersTable).where(eq(usersTable.role, "owner"));
  res.json({ needsSetup: owners.length === 0 });
});

router.post("/setup", async (req, res): Promise<void> => {
  const owners = await db.select().from(usersTable).where(eq(usersTable.role, "owner"));
  if (owners.length > 0) {
    res.status(400).json({ error: "Aplikasi sudah terkonfigurasi sebelumnya." });
    return;
  }

  const { licenseKey, namaUsaha, alamat, telepon, catatan, namaPemilik, username, password } = req.body ?? {};

  if (!licenseKey || !namaUsaha || !namaPemilik || !username || !password) {
    res.status(400).json({ error: "Semua kolom wajib diisi." });
    return;
  }

  if (password.length < 6) {
    res.status(400).json({ error: "Password minimal 6 karakter." });
    return;
  }

  const licenseResult = verifyLicenseKey(licenseKey);
  if (!licenseResult.valid) {
    res.status(400).json({ error: licenseResult.error });
    return;
  }

  const normalizedKey = licenseKey.trim().toUpperCase();
  const existingKey = await db.select().from(licenseKeysTable).where(eq(licenseKeysTable.key, normalizedKey));
  if (existingKey.length > 0 && existingKey[0].isUsed) {
    res.status(400).json({ error: "License key sudah pernah digunakan." });
    return;
  }

  const now = new Date();
  const nowIso = now.toISOString();

  const [usaha] = await db.insert(usahaTable).values({
    namaUsaha: namaUsaha.trim(),
    alamat: alamat?.trim() || null,
    telepon: telepon?.trim() || null,
    catatan: catatan?.trim() || null,
    licenseExpiresAt: licenseResult.expiresAt!.toISOString(),
  }).returning();

  const passwordHash = await bcrypt.hash(password, 10);
  await db.insert(usersTable).values({
    nama: namaPemilik.trim(),
    username: username.trim().toLowerCase(),
    passwordHash,
    role: "owner",
    usahaId: usaha.id,
    isActive: true,
  });

  if (existingKey.length > 0) {
    await db.update(licenseKeysTable)
      .set({ isUsed: true, usedAt: nowIso })
      .where(eq(licenseKeysTable.key, normalizedKey));
  } else {
    await db.insert(licenseKeysTable).values({
      key: normalizedKey,
      tipe: licenseResult.tipe!,
      expiresAt: licenseResult.expiresAt!.toISOString(),
      isUsed: true,
      usedAt: nowIso,
    });
  }

  const hariIni = new Date(); hariIni.setHours(0, 0, 0, 0);
  const hariExpiry = new Date(licenseResult.expiresAt!); hariExpiry.setHours(0, 0, 0, 0);
  const sisaHari = Math.max(0, Math.round((hariExpiry.getTime() - hariIni.getTime()) / (1000 * 60 * 60 * 24)));

  res.status(201).json({
    message: "Setup berhasil! Silakan login dengan akun yang telah dibuat.",
    tipe: licenseResult.tipe,
    expires_at: licenseResult.expiresAt!.toISOString(),
    sisa_hari: sisaHari,
  });
});

export default router;
