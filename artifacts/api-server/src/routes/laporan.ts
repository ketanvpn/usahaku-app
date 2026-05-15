import { Router, type IRouter } from "express";
import { db, hutangTable, pelangganTable, transaksiKasirTable, transaksiKasirItemTable, transaksiStokTable, suppliersTable, barangTable } from "@workspace/db";
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

// ── Laporan Pembelian per Supplier (v1.1.1) ─────────────────────────────────
// Query params:
//   - bulan: 1-12 (opsional)
//   - tahun: YYYY (opsional, default tahun ini)
//   - supplier_id: int (opsional — kalau diisi, breakdown per barang dari 1 supplier)
// Response:
//   {
//     periode: "Mei 2026" | "Tahun 2026",
//     ringkasan_per_supplier: [{ supplier_id, supplier_nama, total_transaksi, total_jumlah, total_nilai }],
//     tanpa_supplier: { total_transaksi, total_nilai }, // transaksi masuk yang supplier_id = NULL
//     total_keseluruhan: { total_transaksi, total_nilai },
//     // kalau supplier_id ada di query:
//     breakdown_barang?: [{ barang_id, nama_barang, satuan, total_jumlah, total_nilai }],
//   }
router.get("/laporan/pembelian-supplier", requireAuth, async (req, res): Promise<void> => {
  const usahaId = req.session.usahaId;
  if (!usahaId) { res.status(403).json({ error: "Akses ditolak." }); return; }

  const now = new Date();
  const tahun = parseInt((req.query.tahun as string) || String(now.getFullYear()));
  const bulanRaw = req.query.bulan as string | undefined;
  const bulan = bulanRaw ? parseInt(bulanRaw) : null;
  const supplierIdRaw = req.query.supplier_id as string | undefined;
  const filterSupplierId = supplierIdRaw ? parseInt(supplierIdRaw) : null;

  if (isNaN(tahun) || tahun < 2000 || tahun > 2100) {
    res.status(400).json({ error: "Tahun tidak valid." });
    return;
  }
  if (bulan !== null && (isNaN(bulan) || bulan < 1 || bulan > 12)) {
    res.status(400).json({ error: "Bulan tidak valid (1-12)." });
    return;
  }
  if (filterSupplierId !== null && (isNaN(filterSupplierId) || filterSupplierId <= 0)) {
    res.status(400).json({ error: "supplier_id tidak valid." });
    return;
  }

  // Filter periode pakai LIKE pada string tanggal "YYYY-MM-DD".
  // Bulan kosong → "YYYY-%", bulan ada → "YYYY-MM-%".
  const prefix = bulan !== null
    ? `${tahun}-${String(bulan).padStart(2, "0")}-%`
    : `${tahun}-%`;

  const conditions = [
    eq(transaksiStokTable.usahaId, usahaId),
    eq(transaksiStokTable.tipe, "masuk"),
    sql`${transaksiStokTable.tanggal} LIKE ${prefix}`,
  ];

  const transaksiList = await db
    .select()
    .from(transaksiStokTable)
    .where(and(...conditions));

  const supplierList = await db
    .select()
    .from(suppliersTable)
    .where(eq(suppliersTable.usahaId, usahaId));
  const supplierMap = new Map(supplierList.map((s) => [s.id, s.nama]));

  type SupplierAgg = {
    supplier_id: number;
    supplier_nama: string;
    total_transaksi: number;
    total_jumlah: number;
    total_nilai: number;
  };
  const perSupplier = new Map<number, SupplierAgg>();
  let tanpaSupplierTransaksi = 0;
  let tanpaSupplierNilai = 0;
  let totalTransaksi = 0;
  let totalNilai = 0;

  for (const t of transaksiList) {
    const jumlah = parseFloat(t.jumlah);
    const harga = parseFloat(t.hargaSatuan);
    const sub = jumlah * harga;
    totalTransaksi += 1;
    totalNilai += sub;

    if (t.supplierId == null) {
      tanpaSupplierTransaksi += 1;
      tanpaSupplierNilai += sub;
      continue;
    }

    const exist = perSupplier.get(t.supplierId);
    if (exist) {
      exist.total_transaksi += 1;
      exist.total_jumlah += jumlah;
      exist.total_nilai += sub;
    } else {
      perSupplier.set(t.supplierId, {
        supplier_id: t.supplierId,
        supplier_nama: supplierMap.get(t.supplierId) ?? `(supplier #${t.supplierId} terhapus)`,
        total_transaksi: 1,
        total_jumlah: jumlah,
        total_nilai: sub,
      });
    }
  }

  const ringkasanPerSupplier = Array.from(perSupplier.values()).sort(
    (a, b) => b.total_nilai - a.total_nilai,
  );

  const periodeLabel = bulan !== null
    ? `${["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"][bulan - 1]} ${tahun}`
    : `Tahun ${tahun}`;

  // Optional: breakdown per barang kalau filter supplier_id ada
  let breakdownBarang: Array<{ barang_id: number; nama_barang: string; satuan: string; total_jumlah: number; total_nilai: number }> | undefined;
  if (filterSupplierId !== null) {
    const barangList = await db
      .select()
      .from(barangTable)
      .where(eq(barangTable.usahaId, usahaId));
    const barangMap = new Map(barangList.map((b) => [b.id, b]));

    type BarangAgg = { barang_id: number; nama_barang: string; satuan: string; total_jumlah: number; total_nilai: number };
    const perBarang = new Map<number, BarangAgg>();
    for (const t of transaksiList) {
      if (t.supplierId !== filterSupplierId) continue;
      const jumlah = parseFloat(t.jumlah);
      const harga = parseFloat(t.hargaSatuan);
      const sub = jumlah * harga;
      const b = barangMap.get(t.barangId);
      const exist = perBarang.get(t.barangId);
      if (exist) {
        exist.total_jumlah += jumlah;
        exist.total_nilai += sub;
      } else {
        perBarang.set(t.barangId, {
          barang_id: t.barangId,
          nama_barang: b?.nama ?? `(barang #${t.barangId})`,
          satuan: b?.satuan ?? "",
          total_jumlah: jumlah,
          total_nilai: sub,
        });
      }
    }
    breakdownBarang = Array.from(perBarang.values()).sort(
      (a, b) => b.total_nilai - a.total_nilai,
    );
  }

  res.json({
    periode: periodeLabel,
    ringkasan_per_supplier: ringkasanPerSupplier,
    tanpa_supplier: {
      total_transaksi: tanpaSupplierTransaksi,
      total_nilai: tanpaSupplierNilai,
    },
    total_keseluruhan: {
      total_transaksi: totalTransaksi,
      total_nilai: totalNilai,
    },
    ...(breakdownBarang ? { breakdown_barang: breakdownBarang } : {}),
  });
});

export default router;
