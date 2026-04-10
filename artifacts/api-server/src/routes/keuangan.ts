import { Router, type IRouter } from "express";
import { db, keuanganTable } from "@workspace/db";
import { eq, and, desc, sql } from "drizzle-orm";
import { requireAuth, requireLicense } from "../middlewares/auth";

const router: IRouter = Router();

function formatKeuangan(k: typeof keuanganTable.$inferSelect) {
  return {
    id: k.id,
    usaha_id: k.usahaId,
    tanggal: k.tanggal,
    tipe: k.tipe,
    kategori: k.kategori ?? null,
    keterangan: k.keterangan,
    jumlah: parseFloat(k.jumlah),
    created_at: k.createdAt instanceof Date ? k.createdAt.toISOString() : new Date(k.createdAt).toISOString(),
  };
}

// GET /api/keuangan?bulan=4&tahun=2026&tipe=masuk
router.get("/keuangan", requireAuth, async (req, res): Promise<void> => {
  const usahaId = req.session.usahaId;
  if (!usahaId) { res.status(403).json({ error: "Forbidden" }); return; }

  const { bulan, tahun, tipe } = req.query as { bulan?: string; tahun?: string; tipe?: string };

  const conditions = [eq(keuanganTable.usahaId, usahaId)];

  if (tahun) {
    conditions.push(sql`strftime('%Y', ${keuanganTable.tanggal}) = ${tahun}`);
  }
  if (bulan) {
    const bulanPadded = bulan.padStart(2, "0");
    conditions.push(sql`strftime('%m', ${keuanganTable.tanggal}) = ${bulanPadded}`);
  }
  if (tipe === "masuk" || tipe === "keluar") {
    conditions.push(eq(keuanganTable.tipe, tipe));
  }

  const rows = await db
    .select()
    .from(keuanganTable)
    .where(and(...conditions))
    .orderBy(desc(keuanganTable.tanggal), desc(keuanganTable.id));

  res.json(rows.map(formatKeuangan));
});

// GET /api/keuangan/rekap?bulan=4&tahun=2026
router.get("/keuangan/rekap", requireAuth, async (req, res): Promise<void> => {
  const usahaId = req.session.usahaId;
  if (!usahaId) { res.status(403).json({ error: "Forbidden" }); return; }

  const { bulan, tahun } = req.query as { bulan?: string; tahun?: string };

  const conditions = [eq(keuanganTable.usahaId, usahaId)];
  if (tahun) {
    conditions.push(sql`strftime('%Y', ${keuanganTable.tanggal}) = ${tahun}`);
  }
  if (bulan) {
    const bulanPadded = bulan.padStart(2, "0");
    conditions.push(sql`strftime('%m', ${keuanganTable.tanggal}) = ${bulanPadded}`);
  }

  const rows = await db
    .select()
    .from(keuanganTable)
    .where(and(...conditions));

  let totalMasuk = 0;
  let totalKeluar = 0;
  for (const r of rows) {
    const nominal = parseFloat(r.jumlah) || 0;
    if (r.tipe === "masuk") totalMasuk += nominal;
    else totalKeluar += nominal;
  }

  res.json({
    total_masuk: totalMasuk,
    total_keluar: totalKeluar,
    saldo: totalMasuk - totalKeluar,
    jumlah_transaksi: rows.length,
  });
});

// POST /api/keuangan
router.post("/keuangan", requireAuth, requireLicense, async (req, res): Promise<void> => {
  const usahaId = req.session.usahaId;
  if (!usahaId) { res.status(403).json({ error: "Forbidden" }); return; }

  const { tanggal, tipe, kategori, keterangan, jumlah } = req.body;

  if (!tanggal || !tipe || !keterangan || jumlah === undefined) {
    res.status(400).json({ error: "tanggal, tipe, keterangan, dan jumlah wajib diisi" });
    return;
  }
  if (tipe !== "masuk" && tipe !== "keluar") {
    res.status(400).json({ error: "tipe harus 'masuk' atau 'keluar'" });
    return;
  }
  const nominalParsed = parseFloat(String(jumlah));
  if (isNaN(nominalParsed) || nominalParsed <= 0) {
    res.status(400).json({ error: "jumlah harus berupa angka positif" });
    return;
  }

  const [inserted] = await db.insert(keuanganTable).values({
    usahaId,
    tanggal: String(tanggal),
    tipe,
    kategori: kategori ? String(kategori).trim() : null,
    keterangan: String(keterangan).trim(),
    jumlah: String(nominalParsed),
  }).returning();

  res.status(201).json(formatKeuangan(inserted));
});

// PUT /api/keuangan/:id
router.put("/keuangan/:id", requireAuth, requireLicense, async (req, res): Promise<void> => {
  const usahaId = req.session.usahaId;
  if (!usahaId) { res.status(403).json({ error: "Forbidden" }); return; }

  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "ID tidak valid" }); return; }

  const [existing] = await db.select().from(keuanganTable).where(and(eq(keuanganTable.id, id), eq(keuanganTable.usahaId, usahaId)));
  if (!existing) { res.status(404).json({ error: "Data tidak ditemukan" }); return; }

  const { tanggal, tipe, kategori, keterangan, jumlah } = req.body;

  if (!tanggal || !tipe || !keterangan || jumlah === undefined) {
    res.status(400).json({ error: "tanggal, tipe, keterangan, dan jumlah wajib diisi" });
    return;
  }
  if (tipe !== "masuk" && tipe !== "keluar") {
    res.status(400).json({ error: "tipe harus 'masuk' atau 'keluar'" });
    return;
  }
  const nominalParsed = parseFloat(String(jumlah));
  if (isNaN(nominalParsed) || nominalParsed <= 0) {
    res.status(400).json({ error: "jumlah harus berupa angka positif" });
    return;
  }

  const [updated] = await db.update(keuanganTable).set({
    tanggal: String(tanggal),
    tipe,
    kategori: kategori ? String(kategori).trim() : null,
    keterangan: String(keterangan).trim(),
    jumlah: String(nominalParsed),
  }).where(and(eq(keuanganTable.id, id), eq(keuanganTable.usahaId, usahaId))).returning();

  res.json(formatKeuangan(updated));
});

// DELETE /api/keuangan/:id
router.delete("/keuangan/:id", requireAuth, requireLicense, async (req, res): Promise<void> => {
  const usahaId = req.session.usahaId;
  if (!usahaId) { res.status(403).json({ error: "Forbidden" }); return; }

  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "ID tidak valid" }); return; }

  const [existing] = await db.select().from(keuanganTable).where(and(eq(keuanganTable.id, id), eq(keuanganTable.usahaId, usahaId)));
  if (!existing) { res.status(404).json({ error: "Data tidak ditemukan" }); return; }

  await db.delete(keuanganTable).where(and(eq(keuanganTable.id, id), eq(keuanganTable.usahaId, usahaId)));
  res.json({ message: "Data berhasil dihapus" });
});

export default router;
