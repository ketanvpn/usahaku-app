import { Router, type IRouter } from "express";
import { db, licenseKeysTable, usahaTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { requireAuth, requireSuperAdmin, requireOwner } from "../middlewares/auth";
import { generateLicenseKey, verifyLicenseKey, type LicenseTipe } from "../utils/license-crypto";

const router: IRouter = Router();

const VALID_TIPE = ["harian", "bulanan", "tahunan"] as const;

router.post("/lisensi/generate", requireSuperAdmin, async (req, res): Promise<void> => {
  const { tipe } = req.body ?? {};
  if (!tipe || !VALID_TIPE.includes(tipe)) {
    res.status(400).json({ error: "Tipe lisensi tidak valid. Pilih: harian, bulanan, atau tahunan." });
    return;
  }
  const { key, expiresAt } = generateLicenseKey(tipe as LicenseTipe);

  const [row] = await db.insert(licenseKeysTable).values({
    key,
    tipe,
    expiresAt: expiresAt.toISOString(),
    isUsed: false,
  }).returning();

  res.status(201).json({
    id: row.id,
    key: row.key,
    tipe: row.tipe,
    expires_at: row.expiresAt,
    is_used: row.isUsed,
    used_at: row.usedAt ?? null,
    created_at: row.createdAt,
  });
});

router.get("/lisensi", requireSuperAdmin, async (_req, res): Promise<void> => {
  const list = await db.select().from(licenseKeysTable).orderBy(desc(licenseKeysTable.id));

  res.json(list.map((r) => ({
    id: r.id,
    key: r.key,
    tipe: r.tipe,
    expires_at: r.expiresAt,
    is_used: r.isUsed,
    used_at: r.usedAt ?? null,
    created_at: r.createdAt,
  })));
});

router.delete("/lisensi/:id", requireSuperAdmin, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: "ID tidak valid." });
    return;
  }

  const [existing] = await db.select().from(licenseKeysTable).where(eq(licenseKeysTable.id, id));
  if (!existing) {
    res.status(404).json({ error: "Key tidak ditemukan." });
    return;
  }
  if (existing.isUsed) {
    res.status(400).json({ error: "Key yang sudah digunakan tidak dapat dihapus." });
    return;
  }

  await db.delete(licenseKeysTable).where(eq(licenseKeysTable.id, id));
  res.json({ message: "Key berhasil dihapus." });
});

router.post("/lisensi/aktivasi", requireOwner, async (req, res): Promise<void> => {
  const usahaId = req.session.usahaId;
  if (!usahaId) {
    res.status(403).json({ error: "Akses ditolak." });
    return;
  }

  const key: string | undefined = req.body?.key;
  if (!key || typeof key !== "string" || !key.trim()) {
    res.status(400).json({ error: "Key tidak boleh kosong." });
    return;
  }

  const existing = await db.select().from(licenseKeysTable).where(eq(licenseKeysTable.key, key.trim().toUpperCase()));
  if (existing.length > 0 && existing[0].isUsed) {
    res.status(400).json({ error: "Key ini sudah pernah digunakan di komputer ini." });
    return;
  }

  const result = verifyLicenseKey(key);
  if (!result.valid) {
    res.status(400).json({ error: result.error });
    return;
  }

  const now = new Date().toISOString();
  const normalizedKey = key.trim().toUpperCase();

  if (existing.length > 0) {
    await db.update(licenseKeysTable).set({ isUsed: true, usedAt: now }).where(eq(licenseKeysTable.key, normalizedKey));
  } else {
    await db.insert(licenseKeysTable).values({
      key: normalizedKey,
      tipe: result.tipe!,
      expiresAt: result.expiresAt!.toISOString(),
      isUsed: true,
      usedAt: now,
    });
  }

  await db.update(usahaTable).set({ licenseExpiresAt: result.expiresAt!.toISOString() }).where(eq(usahaTable.id, usahaId));

  res.json({
    message: "Lisensi berhasil diaktifkan!",
    tipe: result.tipe,
    expires_at: result.expiresAt!.toISOString(),
  });
});

router.get("/lisensi/status", requireAuth, async (req, res): Promise<void> => {
  const usahaId = req.session.usahaId;
  if (!usahaId) {
    res.json({ aktif: false, expires_at: null, sisa_hari: 0 });
    return;
  }

  const [usaha] = await db.select().from(usahaTable).where(eq(usahaTable.id, usahaId));
  if (!usaha?.licenseExpiresAt) {
    res.json({ aktif: false, expires_at: null, sisa_hari: 0 });
    return;
  }

  const expiresAt = new Date(usaha.licenseExpiresAt);
  const now = new Date();
  const aktif = expiresAt > now;
  const sisaMs = expiresAt.getTime() - now.getTime();
  const sisaHari = Math.ceil(sisaMs / (1000 * 60 * 60 * 24));

  res.json({
    aktif,
    expires_at: usaha.licenseExpiresAt,
    sisa_hari: aktif ? sisaHari : 0,
  });
});

export default router;
