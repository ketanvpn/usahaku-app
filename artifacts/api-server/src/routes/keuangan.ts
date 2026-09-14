import { Router, type IRouter } from "express";
import { db, keuanganTable } from "@workspace/db";
import { eq, and, desc, sql } from "drizzle-orm";
import { requireAuth, requireLicense } from "../middlewares/auth";
import { toNum } from "../utils/money";
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
    jumlah: toNum(k.jumlah),
    created_at: k.createdAt instanceof Date ? k.createdAt.toISOString() : new Date(k.createdAt).toISOString(),
  };
}

// ─── Routes ───────────────────────────────────────────────────────────────────

// GET /api/keuangan/rekap-kategori?bulan=4&tahun=2026
router.get("/keuangan/rekap-kategori", requireAuth, async (req, res): Promise<void> => {
  const usahaId = req.session.usahaId;
  if (!usahaId) { res.status(403).json({ error: "Forbidden" }); return; }

  const { bulan, tahun } = req.query as { bulan?: string; tahun?: string };
  if (tahun && !/^\d{4}$/.test(tahun)) { res.status(400).json({ error: "Format tahun tidak valid" }); return; }
  if (bulan && !/^\d{1,2}$/.test(bulan)) { res.status(400).json({ error: "Format bulan tidak valid" }); return; }

  const conditions = [eq(keuanganTable.usahaId, usahaId)];
  if (tahun) conditions.push(sql`strftime('%Y', ${keuanganTable.tanggal}) = ${tahun}`);
  if (bulan) conditions.push(sql`strftime('%m', ${keuanganTable.tanggal}) = ${bulan.padStart(2, "0")}`);

  const rows = await db.select({
    tipe: keuanganTable.tipe,
    kategori: sql<string>`COALESCE(${keuanganTable.kategori}, 'Lainnya')`,
    total: sql<number>`COALESCE(SUM(CAST(${keuanganTable.jumlah} AS INTEGER)), 0)`,
    jumlah_transaksi: sql<number>`COUNT(*)`,
  }).from(keuanganTable)
    .where(and(...conditions))
    .groupBy(keuanganTable.tipe, keuanganTable.kategori)
    .orderBy(sql`SUM(CAST(${keuanganTable.jumlah} AS INTEGER)) DESC`);

  res.json(rows.map(r => ({
    kategori: String(r.kategori),
    tipe: r.tipe,
    total: Number(r.total),
    jumlah_transaksi: Number(r.jumlah_transaksi),
  })));
});

// GET /api/keuangan/rekap-bulanan?tahun=2026
router.get("/keuangan/rekap-bulanan", requireAuth, async (req, res): Promise<void> => {
  const usahaId = req.session.usahaId;
  if (!usahaId) { res.status(403).json({ error: "Forbidden" }); return; }

  const tahun = (req.query.tahun as string) || String(new Date().getFullYear());
  if (!/^\d{4}$/.test(tahun)) { res.status(400).json({ error: "Format tahun tidak valid" }); return; }

  const rows = await db.select({
    bulan: sql<number>`CAST(strftime('%m', ${keuanganTable.tanggal}) AS INTEGER)`,
    tipe: keuanganTable.tipe,
    total: sql<number>`COALESCE(SUM(CAST(${keuanganTable.jumlah} AS INTEGER)), 0)`,
  }).from(keuanganTable)
    .where(and(eq(keuanganTable.usahaId, usahaId), sql`strftime('%Y', ${keuanganTable.tanggal}) = ${tahun}`))
    .groupBy(sql`strftime('%m', ${keuanganTable.tanggal})`, keuanganTable.tipe);

  const NAMA_BULAN = ["Jan","Feb","Mar","Apr","Mei","Jun","Jul","Agu","Sep","Okt","Nov","Des"];
  const bulanMap: Record<number, { masuk: number; keluar: number }> = {};
  for (let i = 1; i <= 12; i++) bulanMap[i] = { masuk: 0, keluar: 0 };
  for (const r of rows) {
    const b = Number(r.bulan);
    if (b >= 1 && b <= 12) {
      if (r.tipe === "masuk") bulanMap[b].masuk = Number(r.total);
      else bulanMap[b].keluar = Number(r.total);
    }
  }

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
  if (tahun && !/^\d{4}$/.test(tahun)) { res.status(400).json({ error: "Format tahun tidak valid" }); return; }
  if (bulan && !/^\d{1,2}$/.test(bulan)) { res.status(400).json({ error: "Format bulan tidak valid" }); return; }
  if (dari && !/^\d{4}-\d{2}-\d{2}$/.test(dari)) { res.status(400).json({ error: "Format tanggal 'dari' tidak valid" }); return; }
  if (sampai && !/^\d{4}-\d{2}-\d{2}$/.test(sampai)) { res.status(400).json({ error: "Format tanggal 'sampai' tidak valid" }); return; }

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
  if (tahun && !/^\d{4}$/.test(tahun)) { res.status(400).json({ error: "Format tahun tidak valid" }); return; }
  if (bulan && !/^\d{1,2}$/.test(bulan)) { res.status(400).json({ error: "Format bulan tidak valid" }); return; }

  const conditions = [eq(keuanganTable.usahaId, usahaId)];
  if (tahun) conditions.push(sql`strftime('%Y', ${keuanganTable.tanggal}) = ${tahun}`);
  if (bulan) conditions.push(sql`strftime('%m', ${keuanganTable.tanggal}) = ${bulan.padStart(2, "0")}`);

  const rows = await db.select({
    tipe: keuanganTable.tipe,
    total: sql<number>`COALESCE(SUM(CAST(${keuanganTable.jumlah} AS INTEGER)), 0)`,
    count: sql<number>`COUNT(*)`,
  }).from(keuanganTable).where(and(...conditions)).groupBy(keuanganTable.tipe);

  let totalMasuk = 0;
  let totalKeluar = 0;
  let jumlahTransaksi = 0;
  for (const r of rows) {
    if (r.tipe === "masuk") totalMasuk = Number(r.total);
    else totalKeluar = Number(r.total);
    jumlahTransaksi += Number(r.count);
  }

  res.json({
    total_masuk: totalMasuk,
    total_keluar: totalKeluar,
    saldo: totalMasuk - totalKeluar,
    jumlah_transaksi: jumlahTransaksi,
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
