import { Router, type IRouter } from "express";
import { db, keuanganTable } from "@workspace/db";
import { eq, and, desc, sql } from "drizzle-orm";
import { requireAuth, requireLicense } from "../middlewares/auth";
import { z } from "zod";

const router: IRouter = Router();

// ─── Zod Schemas ──────────────────────────────────────────────────────────────

const KeuanganBodySchema = z.object({
  tanggal: z.string().min(1, "Tanggal wajib diisi").regex(/^\d{4}-\d{2}-\d{2}$/, "Format tanggal tidak valid (YYYY-MM-DD)"),
  tipe: z.enum(["masuk", "keluar"], { invalid_type_error: "Tipe harus 'masuk' atau 'keluar'", required_error: "Tipe wajib diisi" }),
  kategori: z.string().trim().optional(),
  keterangan: z.string().min(1, "Keterangan wajib diisi").trim(),
  jumlah: z.coerce.number({ invalid_type_error: "Jumlah harus berupa angka" }).positive("Jumlah harus lebih dari 0"),
});

// ─── Helper ───────────────────────────────────────────────────────────────────

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

// ─── Routes ───────────────────────────────────────────────────────────────────

// GET /api/keuangan/rekap-kategori?bulan=4&tahun=2026
router.get("/keuangan/rekap-kategori", requireAuth, async (req, res): Promise<void> => {
  const usahaId = req.session.usahaId;
  if (!usahaId) { res.status(403).json({ error: "Forbidden" }); return; }

  const { bulan, tahun } = req.query as { bulan?: string; tahun?: string };
  const conditions = [eq(keuanganTable.usahaId, usahaId)];
  if (tahun) conditions.push(sql`strftime('%Y', ${keuanganTable.tanggal}) = ${tahun}`);
  if (bulan) conditions.push(sql`strftime('%m', ${keuanganTable.tanggal}) = ${bulan.padStart(2, "0")}`);

  const rows = await db.select().from(keuanganTable).where(and(...conditions));

  const map: Record<string, { tipe: string; total: number; jumlah_transaksi: number }> = {};
  for (const r of rows) {
    const key = `${r.tipe}__${r.kategori ?? "Lainnya"}`;
    if (!map[key]) map[key] = { tipe: r.tipe, total: 0, jumlah_transaksi: 0 };
    map[key].total += parseFloat(r.jumlah) || 0;
    map[key].jumlah_transaksi += 1;
  }

  const result = Object.entries(map).map(([key, val]) => ({
    kategori: key.split("__")[1],
    tipe: val.tipe,
    total: val.total,
    jumlah_transaksi: val.jumlah_transaksi,
  })).sort((a, b) => b.total - a.total);

  res.json(result);
});

// GET /api/keuangan/rekap-bulanan?tahun=2026
router.get("/keuangan/rekap-bulanan", requireAuth, async (req, res): Promise<void> => {
  const usahaId = req.session.usahaId;
  if (!usahaId) { res.status(403).json({ error: "Forbidden" }); return; }

  const tahun = (req.query.tahun as string) || String(new Date().getFullYear());
  const rows = await db.select().from(keuanganTable)
    .where(and(eq(keuanganTable.usahaId, usahaId), sql`strftime('%Y', ${keuanganTable.tanggal}) = ${tahun}`));

  const bulanMap: Record<number, { masuk: number; keluar: number }> = {};
  for (let i = 1; i <= 12; i++) bulanMap[i] = { masuk: 0, keluar: 0 };
  for (const r of rows) {
    const bulan = parseInt(r.tanggal.split("-")[1]);
    const nominal = parseFloat(r.jumlah) || 0;
    if (r.tipe === "masuk") bulanMap[bulan].masuk += nominal;
    else bulanMap[bulan].keluar += nominal;
  }

  const NAMA_BULAN = ["Jan","Feb","Mar","Apr","Mei","Jun","Jul","Agu","Sep","Okt","Nov","Des"];
  res.json(Object.entries(bulanMap).map(([bulan, val]) => ({
    bulan: parseInt(bulan),
    nama: NAMA_BULAN[parseInt(bulan) - 1],
    masuk: val.masuk,
    keluar: val.keluar,
  })));
});

// GET /api/keuangan?bulan=4&tahun=2026&tipe=masuk&dari=2026-05-01&sampai=2026-05-31
router.get("/keuangan", requireAuth, async (req, res): Promise<void> => {
  const usahaId = req.session.usahaId;
  if (!usahaId) { res.status(403).json({ error: "Forbidden" }); return; }

  const { bulan, tahun, tipe, dari, sampai } = req.query as {
    bulan?: string;
    tahun?: string;
    tipe?: string;
    dari?: string;
    sampai?: string;
  };
  const conditions = [eq(keuanganTable.usahaId, usahaId)];

  if (tahun) conditions.push(sql`strftime('%Y', ${keuanganTable.tanggal}) = ${tahun}`);
  if (bulan) conditions.push(sql`strftime('%m', ${keuanganTable.tanggal}) = ${bulan.padStart(2, "0")}`);
  if (dari) conditions.push(sql`${keuanganTable.tanggal} >= ${dari}`);
  if (sampai) conditions.push(sql`${keuanganTable.tanggal} <= ${sampai}`);
  if (tipe === "masuk" || tipe === "keluar") conditions.push(eq(keuanganTable.tipe, tipe));

  const rows = await db.select().from(keuanganTable)
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
  if (tahun) conditions.push(sql`strftime('%Y', ${keuanganTable.tanggal}) = ${tahun}`);
  if (bulan) conditions.push(sql`strftime('%m', ${keuanganTable.tanggal}) = ${bulan.padStart(2, "0")}`);

  const rows = await db.select().from(keuanganTable).where(and(...conditions));

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

  const parsed = KeuanganBodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Data tidak valid" });
    return;
  }

  const { tanggal, tipe, kategori, keterangan, jumlah } = parsed.data;

  const [inserted] = await db.insert(keuanganTable).values({
    usahaId,
    tanggal,
    tipe,
    kategori: kategori || null,
    keterangan,
    jumlah: String(jumlah),
  }).returning();

  res.status(201).json(formatKeuangan(inserted));
});

// PUT /api/keuangan/:id
router.put("/keuangan/:id", requireAuth, requireLicense, async (req, res): Promise<void> => {
  const usahaId = req.session.usahaId;
  if (!usahaId) { res.status(403).json({ error: "Forbidden" }); return; }

  const idParam = typeof req.params.id === "string" ? req.params.id : "";
  const id = parseInt(idParam, 10);
  if (isNaN(id)) { res.status(400).json({ error: "ID tidak valid" }); return; }

  const [existing] = await db.select().from(keuanganTable)
    .where(and(eq(keuanganTable.id, id), eq(keuanganTable.usahaId, usahaId)));
  if (!existing) { res.status(404).json({ error: "Data tidak ditemukan" }); return; }

  const parsed = KeuanganBodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Data tidak valid" });
    return;
  }

  const { tanggal, tipe, kategori, keterangan, jumlah } = parsed.data;

  const [updated] = await db.update(keuanganTable).set({
    tanggal,
    tipe,
    kategori: kategori || null,
    keterangan,
    jumlah: String(jumlah),
  }).where(and(eq(keuanganTable.id, id), eq(keuanganTable.usahaId, usahaId))).returning();

  res.json(formatKeuangan(updated));
});

// DELETE /api/keuangan/:id
router.delete("/keuangan/:id", requireAuth, requireLicense, async (req, res): Promise<void> => {
  const usahaId = req.session.usahaId;
  if (!usahaId) { res.status(403).json({ error: "Forbidden" }); return; }

  const idParam = typeof req.params.id === "string" ? req.params.id : "";
  const id = parseInt(idParam, 10);
  if (isNaN(id)) { res.status(400).json({ error: "ID tidak valid" }); return; }

  const [existing] = await db.select().from(keuanganTable)
    .where(and(eq(keuanganTable.id, id), eq(keuanganTable.usahaId, usahaId)));
  if (!existing) { res.status(404).json({ error: "Data tidak ditemukan" }); return; }

  await db.delete(keuanganTable).where(and(eq(keuanganTable.id, id), eq(keuanganTable.usahaId, usahaId)));
  res.json({ message: "Data berhasil dihapus" });
});

export default router;
