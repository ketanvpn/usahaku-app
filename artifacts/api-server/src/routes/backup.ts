import { Router, type IRouter } from "express";
import { db, usahaTable, pelangganTable, hutangTable, pembayaranTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

router.get("/backup/export", requireAuth, async (req, res): Promise<void> => {
  const usahaId = req.session.usahaId;
  if (!usahaId) {
    res.status(403).json({ error: "Akses ditolak." });
    return;
  }

  const [usaha] = await db.select().from(usahaTable).where(eq(usahaTable.id, usahaId));
  if (!usaha) {
    res.status(404).json({ error: "Usaha tidak ditemukan." });
    return;
  }

  const pelangganList = await db.select().from(pelangganTable).where(eq(pelangganTable.usahaId, usahaId));
  const hutangList = await db.select().from(hutangTable).where(eq(hutangTable.usahaId, usahaId));
  const pembayaranList = await db.select().from(pembayaranTable).where(eq(pembayaranTable.usahaId, usahaId));

  const backup = {
    version: "1.0",
    exported_at: new Date().toISOString(),
    usaha_id: usahaId,
    usaha: {
      id: usaha.id,
      nama_usaha: usaha.namaUsaha,
      alamat: usaha.alamat ?? null,
      telepon: usaha.telepon ?? null,
      catatan: usaha.catatan ?? null,
      created_at: usaha.createdAt.toISOString(),
    },
    pelanggan: pelangganList.map((p) => ({
      id: p.id,
      usaha_id: p.usahaId,
      nama: p.nama,
      telepon: p.telepon ?? null,
      alamat: p.alamat ?? null,
      catatan: p.catatan ?? null,
      created_at: p.createdAt.toISOString(),
    })),
    hutang: hutangList.map((h) => ({
      id: h.id,
      usaha_id: h.usahaId,
      pelanggan_id: h.pelangganId,
      pelanggan_nama: "",
      tanggal_hutang: h.tanggalHutang,
      keterangan: h.keterangan ?? null,
      nominal_hutang: parseFloat(h.nominalHutang),
      total_dibayar: parseFloat(h.totalDibayar),
      sisa_hutang: parseFloat(h.sisaHutang),
      status: h.status,
      created_at: h.createdAt.toISOString(),
      updated_at: h.updatedAt.toISOString(),
    })),
    pembayaran: pembayaranList.map((p) => ({
      id: p.id,
      usaha_id: p.usahaId,
      hutang_id: p.hutangId,
      pelanggan_id: p.pelangganId,
      pelanggan_nama: "",
      tanggal_bayar: p.tanggalBayar,
      nominal_bayar: parseFloat(p.nominalBayar),
      catatan: p.catatan ?? null,
      created_at: p.createdAt.toISOString(),
    })),
  };

  res.json(backup);
});

router.post("/backup/restore", requireAuth, async (req, res): Promise<void> => {
  const usahaId = req.session.usahaId;
  if (!usahaId) {
    res.status(403).json({ error: "Akses ditolak." });
    return;
  }

  const backup = req.body;

  if (!backup.version || !backup.usaha_id || !backup.pelanggan || !backup.hutang || !backup.pembayaran) {
    res.status(400).json({ error: "Format file backup tidak valid. Pastikan file yang diunggah benar." });
    return;
  }

  if (backup.usaha_id !== usahaId) {
    res.status(400).json({ error: "File backup tidak sesuai dengan usaha Anda." });
    return;
  }

  await db.delete(pembayaranTable).where(eq(pembayaranTable.usahaId, usahaId));
  await db.delete(hutangTable).where(eq(hutangTable.usahaId, usahaId));
  await db.delete(pelangganTable).where(eq(pelangganTable.usahaId, usahaId));

  const pelangganIdMap = new Map<number, number>();
  for (const p of backup.pelanggan) {
    const [inserted] = await db.insert(pelangganTable).values({
      usahaId,
      nama: p.nama,
      telepon: p.telepon ?? null,
      alamat: p.alamat ?? null,
      catatan: p.catatan ?? null,
    }).returning();
    pelangganIdMap.set(p.id, inserted.id);
  }

  const hutangIdMap = new Map<number, number>();
  for (const h of backup.hutang) {
    const newPelangganId = pelangganIdMap.get(h.pelanggan_id) ?? h.pelanggan_id;
    const [inserted] = await db.insert(hutangTable).values({
      usahaId,
      pelangganId: newPelangganId,
      tanggalHutang: h.tanggal_hutang,
      keterangan: h.keterangan ?? null,
      nominalHutang: h.nominal_hutang.toString(),
      totalDibayar: h.total_dibayar.toString(),
      sisaHutang: h.sisa_hutang.toString(),
      status: h.status,
    }).returning();
    hutangIdMap.set(h.id, inserted.id);
  }

  for (const p of backup.pembayaran) {
    const newHutangId = hutangIdMap.get(p.hutang_id) ?? p.hutang_id;
    const newPelangganId = pelangganIdMap.get(p.pelanggan_id) ?? p.pelanggan_id;
    await db.insert(pembayaranTable).values({
      usahaId,
      hutangId: newHutangId,
      pelangganId: newPelangganId,
      tanggalBayar: p.tanggal_bayar,
      nominalBayar: p.nominal_bayar.toString(),
      catatan: p.catatan ?? null,
    });
  }

  res.json({ message: "Restore data berhasil." });
});

export default router;
