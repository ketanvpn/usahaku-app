import { Router, type IRouter } from "express";
import { db, licenseKeysTable, usahaTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { requireAuth, requireSuperAdmin, requireOwner } from "../middlewares/auth";
import { generateLicenseKey, verifyLicenseKey, DURASI_HARI, type LicenseTipe } from "../utils/license-crypto";

const router: IRouter = Router();

const VALID_TIPE = ["1bulan", "3bulan", "6bulan", "1tahun"] as const;

function hitungSisaHari(expiresAt: Date): number {
  const hariIni = new Date();
  hariIni.setHours(0, 0, 0, 0);
  const hariExpiry = new Date(expiresAt);
  hariExpiry.setHours(0, 0, 0, 0);
  return Math.max(0, Math.round((hariExpiry.getTime() - hariIni.getTime()) / (1000 * 60 * 60 * 24)));
}

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

  const now = new Date();
  const nowIso = now.toISOString();
  const normalizedKey = key.trim().toUpperCase();

  // Hitung tanggal expired baru:
  // - Jika masih punya lisensi aktif → tambah durasi dari tanggal expired yang ada
  // - Jika tidak aktif / belum pernah → pakai tanggal dari key (sejak key dibuat)
  const [usaha] = await db.select({ licenseExpiresAt: usahaTable.licenseExpiresAt }).from(usahaTable).where(eq(usahaTable.id, usahaId));
  const currentExpiry = usaha?.licenseExpiresAt ? new Date(usaha.licenseExpiresAt) : null;
  const isStillActive = currentExpiry !== null && currentExpiry > now;

  let newExpiresAt: Date;
  if (isStillActive) {
    // Perpanjang dari tanggal expired yang ada
    newExpiresAt = new Date(currentExpiry!);
    newExpiresAt.setDate(newExpiresAt.getDate() + DURASI_HARI[result.tipe!]);
  } else {
    // Aktivasi baru — gunakan tanggal yang sudah tertanam di dalam key
    newExpiresAt = result.expiresAt!;
  }

  if (existing.length > 0) {
    await db.update(licenseKeysTable).set({ isUsed: true, usedAt: nowIso }).where(eq(licenseKeysTable.key, normalizedKey));
  } else {
    await db.insert(licenseKeysTable).values({
      key: normalizedKey,
      tipe: result.tipe!,
      expiresAt: result.expiresAt!.toISOString(),
      isUsed: true,
      usedAt: nowIso,
    });
  }

  await db.update(usahaTable).set({ licenseExpiresAt: newExpiresAt.toISOString() }).where(eq(usahaTable.id, usahaId));

  const sisaHari = hitungSisaHari(newExpiresAt);
  const pesan = isStillActive
    ? `Lisensi diperpanjang! Sekarang aktif sampai ${newExpiresAt.toLocaleDateString("id-ID")} (${sisaHari} hari).`
    : "Lisensi berhasil diaktifkan!";

  res.json({
    message: pesan,
    tipe: result.tipe,
    expires_at: newExpiresAt.toISOString(),
    diperpanjang: isStillActive,
    sisa_hari: sisaHari,
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

  const hariIniStr = new Date().toISOString().slice(0, 10);

  if (usaha.lastSeenDate) {
    const lastSeenMs = new Date(usaha.lastSeenDate + "T12:00:00Z").getTime();
    const todayMs = new Date(hariIniStr + "T12:00:00Z").getTime();
    const selisihHari = (lastSeenMs - todayMs) / (24 * 60 * 60 * 1000);
    // Flag manipulasi hanya jika mundur LEBIH DARI 1 hari
    // Toleransi 1 hari untuk mencegah false positive (timezone, koreksi jam, dll)
    if (selisihHari > 1) {
      res.json({
        aktif: false,
        expires_at: usaha.licenseExpiresAt,
        sisa_hari: 0,
        jam_dimanipulasi: true,
      });
      return;
    }
  }

  await db.update(usahaTable)
    .set({ lastSeenDate: hariIniStr })
    .where(eq(usahaTable.id, usahaId));

  const expiresAt = new Date(usaha.licenseExpiresAt);
  const now = new Date();
  const aktif = expiresAt > now;
  const sisaHari = hitungSisaHari(expiresAt);

  res.json({
    aktif,
    expires_at: usaha.licenseExpiresAt,
    sisa_hari: aktif ? sisaHari : 0,
    jam_dimanipulasi: false,
  });
});

export default router;
