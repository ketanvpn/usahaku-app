import { Router, type IRouter } from "express";
import { db, hutangTable, pelangganTable, transaksiKasirTable, transaksiKasirItemTable } from "@workspace/db";
import { eq, and, gte, lte, sql, desc } from "drizzle-orm";
import { GetLaporanQueryParams } from "@workspace/api-zod";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

router.get("/laporan", requireAuth, async (req, res): Promise<void> => {
  const usahaId = req.session.usahaId;
  if (!usahaId) {
    res.status(403).json({ error: "Akses ditolak." });
    return;
  }

  const queryParams = GetLaporanQueryParams.safeParse(req.query);
  const conditions = [eq(hutangTable.usahaId, usahaId)];

  if (queryParams.success) {
    if (queryParams.data.pelanggan_id) {
      conditions.push(eq(hutangTable.pelangganId, queryParams.data.pelanggan_id));
    }
    if (queryParams.data.status) {
      conditions.push(eq(hutangTable.status, queryParams.data.status));
    }
    if (queryParams.data.tanggal_dari) {
      conditions.push(gte(hutangTable.tanggalHutang, queryParams.data.tanggal_dari));
    }
    if (queryParams.data.tanggal_sampai) {
      conditions.push(lte(hutangTable.tanggalHutang, queryParams.data.tanggal_sampai));
    }
  }

  const hutangList = await db.select({
    hutang: hutangTable,
    pelangganNama: pelangganTable.nama,
  })
    .from(hutangTable)
    .leftJoin(pelangganTable, eq(hutangTable.pelangganId, pelangganTable.id))
    .where(and(...conditions))
    .orderBy(hutangTable.tanggalHutang);

  res.json(hutangList.map(({ hutang: h, pelangganNama }) => ({
    tanggal_hutang: h.tanggalHutang,
    nama_pelanggan: pelangganNama ?? "",
    keterangan: h.keterangan ?? null,
    nominal_hutang: parseFloat(h.nominalHutang),
    total_dibayar: parseFloat(h.totalDibayar),
    sisa_hutang: parseFloat(h.sisaHutang),
    status: h.status,
  })));
});


// ── Laporan Kasir: Ringkasan ────────────────────────────────────────────────
router.get("/laporan/kasir/ringkasan", requireAuth, async (req, res): Promise<void> => {
  const usahaId = req.session.usahaId;
  if (!usahaId) { res.status(403).json({ error: "Akses ditolak." }); return; }

  const bulan = parseInt((req.query.bulan as string) || String(new Date().getMonth() + 1));
  const tahun = parseInt((req.query.tahun as string) || String(new Date().getFullYear()));
  const bulanStr = String(bulan).padStart(2, "0");
  const prefix = `${tahun}-${bulanStr}`;

  const rows = await db.select().from(transaksiKasirTable)
    .where(and(
      eq(transaksiKasirTable.usahaId, usahaId),
      gte(transaksiKasirTable.tanggal, `${prefix}-01`),
      lte(transaksiKasirTable.tanggal, `${prefix}-31`)
    ));

  const totalPenjualan = rows.reduce((s, r) => s + parseFloat(r.total), 0);
  const jumlahTransaksi = rows.length;
  const rataRata = jumlahTransaksi > 0 ? totalPenjualan / jumlahTransaksi : 0;

  res.json({ total_penjualan: totalPenjualan, jumlah_transaksi: jumlahTransaksi, rata_rata: rataRata, bulan, tahun });
});

// ── Laporan Kasir: Penjualan Harian ────────────────────────────────────────
router.get("/laporan/kasir/harian", requireAuth, async (req, res): Promise<void> => {
  const usahaId = req.session.usahaId;
  if (!usahaId) { res.status(403).json({ error: "Akses ditolak." }); return; }

  const bulan = parseInt((req.query.bulan as string) || String(new Date().getMonth() + 1));
  const tahun = parseInt((req.query.tahun as string) || String(new Date().getFullYear()));
  const bulanStr = String(bulan).padStart(2, "0");
  const prefix = `${tahun}-${bulanStr}`;

  const rows = await db
    .select({
      tanggal: transaksiKasirTable.tanggal,
      total: sql<string>`SUM(CAST(${transaksiKasirTable.total} AS REAL))`,
      jumlah: sql<number>`COUNT(*)`,
    })
    .from(transaksiKasirTable)
    .where(and(
      eq(transaksiKasirTable.usahaId, usahaId),
      gte(transaksiKasirTable.tanggal, `${prefix}-01`),
      lte(transaksiKasirTable.tanggal, `${prefix}-31`)
    ))
    .groupBy(transaksiKasirTable.tanggal)
    .orderBy(transaksiKasirTable.tanggal);

  res.json(rows.map(r => ({
    tanggal: r.tanggal,
    total: parseFloat(r.total ?? "0"),
    jumlah: Number(r.jumlah),
  })));
});

// ── Laporan Kasir: Penjualan Bulanan ───────────────────────────────────────
router.get("/laporan/kasir/bulanan", requireAuth, async (req, res): Promise<void> => {
  const usahaId = req.session.usahaId;
  if (!usahaId) { res.status(403).json({ error: "Akses ditolak." }); return; }

  const tahun = parseInt((req.query.tahun as string) || String(new Date().getFullYear()));

  const rows = await db
    .select({
      bulan: sql<string>`strftime('%m', ${transaksiKasirTable.tanggal})`,
      total: sql<string>`SUM(CAST(${transaksiKasirTable.total} AS REAL))`,
      jumlah: sql<number>`COUNT(*)`,
    })
    .from(transaksiKasirTable)
    .where(and(
      eq(transaksiKasirTable.usahaId, usahaId),
      gte(transaksiKasirTable.tanggal, `${tahun}-01-01`),
      lte(transaksiKasirTable.tanggal, `${tahun}-12-31`)
    ))
    .groupBy(sql`strftime('%m', ${transaksiKasirTable.tanggal})`)
    .orderBy(sql`strftime('%m', ${transaksiKasirTable.tanggal})`);

  res.json(rows.map(r => ({
    bulan: parseInt(r.bulan),
    total: parseFloat(r.total ?? "0"),
    jumlah: Number(r.jumlah),
  })));
});

// ── Laporan Kasir: Top Produk ───────────────────────────────────────────────
router.get("/laporan/kasir/top-produk", requireAuth, async (req, res): Promise<void> => {
  const usahaId = req.session.usahaId;
  if (!usahaId) { res.status(403).json({ error: "Akses ditolak." }); return; }

  const bulan = parseInt((req.query.bulan as string) || String(new Date().getMonth() + 1));
  const tahun = parseInt((req.query.tahun as string) || String(new Date().getFullYear()));
  const bulanStr = String(bulan).padStart(2, "0");
  const prefix = `${tahun}-${bulanStr}`;
  const limit = Math.min(parseInt((req.query.limit as string) || "10"), 20);

  const rows = await db
    .select({
      nama_barang: transaksiKasirItemTable.namaBarang,
      satuan: transaksiKasirItemTable.satuan,
      total_qty: sql<string>`SUM(CAST(${transaksiKasirItemTable.jumlah} AS REAL))`,
      total_omset: sql<string>`SUM(CAST(${transaksiKasirItemTable.subtotal} AS REAL))`,
    })
    .from(transaksiKasirItemTable)
    .innerJoin(transaksiKasirTable, eq(transaksiKasirItemTable.transaksiKasirId, transaksiKasirTable.id))
    .where(and(
      eq(transaksiKasirTable.usahaId, usahaId),
      gte(transaksiKasirTable.tanggal, `${prefix}-01`),
      lte(transaksiKasirTable.tanggal, `${prefix}-31`)
    ))
    .groupBy(transaksiKasirItemTable.namaBarang, transaksiKasirItemTable.satuan)
    .orderBy(desc(sql`SUM(CAST(${transaksiKasirItemTable.subtotal} AS REAL))`))
    .limit(limit);

  res.json(rows.map(r => ({
    nama_barang: r.nama_barang,
    satuan: r.satuan,
    total_qty: parseFloat(r.total_qty ?? "0"),
    total_omset: parseFloat(r.total_omset ?? "0"),
  })));
});

export default router;
