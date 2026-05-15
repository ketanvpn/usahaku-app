import { Router, type IRouter } from "express";
import { db, barangTable, transaksiStokTable, keuanganTable, suppliersTable } from "@workspace/db";
import { eq, and, desc, sql } from "drizzle-orm";
import { requireAuth, requireLicense } from "../middlewares/auth";
import { z } from "zod";

const router: IRouter = Router();

// ─── Zod Schemas ──────────────────────────────────────────────────────────────

const BarangBodySchema = z.object({
  nama: z.string().min(1, "Nama barang wajib diisi").trim(),
  satuan: z.string().min(1, "Satuan wajib diisi").trim(),
  kategori: z.string().trim().optional(),
  harga_beli: z.coerce.number({ invalid_type_error: "Harga beli harus berupa angka" }).min(0, "Harga beli tidak boleh negatif").default(0),
  harga_jual: z.coerce.number({ invalid_type_error: "Harga jual harus berupa angka" }).min(0, "Harga jual tidak boleh negatif").default(0),
  stok_minimum: z.coerce.number({ invalid_type_error: "Stok minimum harus berupa angka" }).min(0, "Stok minimum tidak boleh negatif").default(0),
});

const BarangCreateSchema = BarangBodySchema.extend({
  stok_awal: z.coerce.number({ invalid_type_error: "Stok awal harus berupa angka" }).min(0, "Stok awal tidak boleh negatif").default(0),
});

const StokMasukSchema = z.object({
  barang_id: z.coerce.number({ invalid_type_error: "barang_id harus berupa angka" }).int().positive("barang_id tidak valid"),
  tanggal: z.string().min(1, "Tanggal wajib diisi").regex(/^\d{4}-\d{2}-\d{2}$/, "Format tanggal tidak valid (YYYY-MM-DD)"),
  jumlah: z.coerce.number({ invalid_type_error: "Jumlah harus berupa angka" }).positive("Jumlah harus lebih dari 0"),
  harga_satuan: z.coerce.number({ invalid_type_error: "Harga satuan harus berupa angka" }).min(0).optional(),
  keterangan: z.string().trim().optional(),
  // v1.1.0: opsional pilih supplier untuk barang masuk. null/undefined = tanpa supplier (mis. retur, opname).
  supplier_id: z.union([
    z.coerce.number().int().positive(),
    z.literal(null),
    z.literal(""),
  ]).optional().transform((v) => (v === null || v === "" || v === undefined ? null : v)),
});

const StokKeluarSchema = z.object({
  barang_id: z.coerce.number({ invalid_type_error: "barang_id harus berupa angka" }).int().positive("barang_id tidak valid"),
  tanggal: z.string().min(1, "Tanggal wajib diisi").regex(/^\d{4}-\d{2}-\d{2}$/, "Format tanggal tidak valid (YYYY-MM-DD)"),
  jumlah: z.coerce.number({ invalid_type_error: "Jumlah harus berupa angka" }).positive("Jumlah harus lebih dari 0"),
  harga_satuan: z.coerce.number({ invalid_type_error: "Harga satuan harus berupa angka" }).min(0).optional(),
  keterangan: z.string().trim().optional(),
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtBarang(b: typeof barangTable.$inferSelect) {
  const stok = parseFloat(b.stok);
  const stokMin = parseFloat(b.stokMinimum);
  return {
    id: b.id,
    usaha_id: b.usahaId,
    nama: b.nama,
    satuan: b.satuan,
    kategori: b.kategori ?? "",
    harga_beli: parseFloat(b.hargaBeli),
    harga_jual: parseFloat(b.hargaJual),
    stok,
    stok_minimum: stokMin,
    peringatan: stok <= stokMin && stokMin > 0,
    created_at: b.createdAt instanceof Date ? b.createdAt.toISOString() : new Date(b.createdAt).toISOString(),
  };
}

function fmtTransaksi(
  t: typeof transaksiStokTable.$inferSelect,
  namaBahan: string,
  satuan: string,
  supplierNama: string | null = null,
) {
  return {
    id: t.id,
    barang_id: t.barangId,
    nama_barang: namaBahan,
    satuan,
    tanggal: t.tanggal,
    tipe: t.tipe,
    jumlah: parseFloat(t.jumlah),
    harga_satuan: parseFloat(t.hargaSatuan),
    total: parseFloat(t.jumlah) * parseFloat(t.hargaSatuan),
    keterangan: t.keterangan ?? null,
    keuangan_id: t.keuanganId ?? null,
    supplier_id: t.supplierId ?? null,
    supplier_nama: supplierNama,
    created_at: t.createdAt instanceof Date ? t.createdAt.toISOString() : new Date(t.createdAt).toISOString(),
  };
}

// ─── Routes ───────────────────────────────────────────────────────────────────

// GET /api/barang
router.get("/barang", requireAuth, async (req, res): Promise<void> => {
  const usahaId = req.session.usahaId;
  if (!usahaId) { res.status(403).json({ error: "Forbidden" }); return; }
  const rows = await db.select().from(barangTable)
    .where(eq(barangTable.usahaId, usahaId))
    .orderBy(barangTable.nama);
  res.json(rows.map(fmtBarang));
});

// GET /api/barang/peringatan — stok <= stok_minimum
router.get("/barang/peringatan", requireAuth, async (req, res): Promise<void> => {
  const usahaId = req.session.usahaId;
  if (!usahaId) { res.status(403).json({ error: "Forbidden" }); return; }
  const rows = await db.select().from(barangTable)
    .where(and(
      eq(barangTable.usahaId, usahaId),
      sql`CAST(${barangTable.stok} AS REAL) <= CAST(${barangTable.stokMinimum} AS REAL)`,
      sql`CAST(${barangTable.stokMinimum} AS REAL) > 0`
    ))
    .orderBy(barangTable.nama);
  res.json(rows.map(fmtBarang));
});

// POST /api/barang
router.post("/barang", requireAuth, requireLicense, async (req, res): Promise<void> => {
  const usahaId = req.session.usahaId;
  if (!usahaId) { res.status(403).json({ error: "Forbidden" }); return; }

  const parsed = BarangCreateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Data tidak valid" });
    return;
  }

  const { nama, satuan, kategori, harga_beli, harga_jual, stok_awal, stok_minimum } = parsed.data;

  const [inserted] = await db.insert(barangTable).values({
    usahaId,
    nama,
    satuan,
    kategori: kategori ?? "",
    hargaBeli: String(harga_beli),
    hargaJual: String(harga_jual),
    stok: String(stok_awal),
    stokMinimum: String(stok_minimum),
  }).returning();

  res.status(201).json(fmtBarang(inserted));
});

// PUT /api/barang/:id
router.put("/barang/:id", requireAuth, requireLicense, async (req, res): Promise<void> => {
  const usahaId = req.session.usahaId;
  if (!usahaId) { res.status(403).json({ error: "Forbidden" }); return; }

  const idParam = typeof req.params.id === "string" ? req.params.id : "";
  const id = parseInt(idParam, 10);
  if (isNaN(id)) { res.status(400).json({ error: "ID tidak valid" }); return; }

  const [existing] = await db.select().from(barangTable)
    .where(and(eq(barangTable.id, id), eq(barangTable.usahaId, usahaId)));
  if (!existing) { res.status(404).json({ error: "Barang tidak ditemukan" }); return; }

  const parsed = BarangBodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Data tidak valid" });
    return;
  }

  const { nama, satuan, kategori, harga_beli, harga_jual, stok_minimum } = parsed.data;

  const [updated] = await db.update(barangTable).set({
    nama,
    satuan,
    kategori: kategori ?? "",
    hargaBeli: String(harga_beli),
    hargaJual: String(harga_jual),
    stokMinimum: String(stok_minimum),
  }).where(and(eq(barangTable.id, id), eq(barangTable.usahaId, usahaId))).returning();

  res.json(fmtBarang(updated));
});

// DELETE /api/barang/:id
router.delete("/barang/:id", requireAuth, requireLicense, async (req, res): Promise<void> => {
  const usahaId = req.session.usahaId;
  if (!usahaId) { res.status(403).json({ error: "Forbidden" }); return; }

  const idParam = typeof req.params.id === "string" ? req.params.id : "";
  const id = parseInt(idParam, 10);
  if (isNaN(id)) { res.status(400).json({ error: "ID tidak valid" }); return; }

  const [existing] = await db.select().from(barangTable)
    .where(and(eq(barangTable.id, id), eq(barangTable.usahaId, usahaId)));
  if (!existing) { res.status(404).json({ error: "Barang tidak ditemukan" }); return; }

  const transaksi = await db.select().from(transaksiStokTable).where(eq(transaksiStokTable.barangId, id));
  if (transaksi.length > 0) {
    res.status(400).json({ error: "Barang tidak bisa dihapus karena sudah punya riwayat transaksi" });
    return;
  }

  await db.delete(barangTable).where(and(eq(barangTable.id, id), eq(barangTable.usahaId, usahaId)));
  res.json({ message: "Barang berhasil dihapus" });
});

// GET /api/stok/transaksi?barang_id=&tipe=&bulan=&tahun=
router.get("/stok/transaksi", requireAuth, async (req, res): Promise<void> => {
  const usahaId = req.session.usahaId;
  if (!usahaId) { res.status(403).json({ error: "Forbidden" }); return; }

  const { barang_id, tipe, bulan, tahun } = req.query as Record<string, string>;
  const conditions = [eq(transaksiStokTable.usahaId, usahaId)];
  if (barang_id) conditions.push(eq(transaksiStokTable.barangId, parseInt(barang_id)));
  if (tipe === "masuk" || tipe === "keluar") conditions.push(eq(transaksiStokTable.tipe, tipe));
  if (tahun) conditions.push(sql`strftime('%Y', ${transaksiStokTable.tanggal}) = ${tahun}`);
  if (bulan) conditions.push(sql`strftime('%m', ${transaksiStokTable.tanggal}) = ${bulan.padStart(2, "0")}`);

  const rows = await db.select().from(transaksiStokTable)
    .where(and(...conditions))
    .orderBy(desc(transaksiStokTable.tanggal), desc(transaksiStokTable.id));

  const barangList = await db.select().from(barangTable).where(eq(barangTable.usahaId, usahaId));
  const barangMap = Object.fromEntries(barangList.map(b => [b.id, b]));

  const supplierList = await db.select().from(suppliersTable).where(eq(suppliersTable.usahaId, usahaId));
  const supplierMap = Object.fromEntries(supplierList.map(s => [s.id, s.nama]));

  res.json(rows.map(t => fmtTransaksi(
    t,
    barangMap[t.barangId]?.nama ?? "-",
    barangMap[t.barangId]?.satuan ?? "",
    t.supplierId != null ? (supplierMap[t.supplierId] ?? null) : null,
  )));
});

// POST /api/stok/masuk — barang masuk (beli), otomatis keuangan keluar
router.post("/stok/masuk", requireAuth, requireLicense, async (req, res): Promise<void> => {
  const usahaId = req.session.usahaId;
  if (!usahaId) { res.status(403).json({ error: "Forbidden" }); return; }

  const parsed = StokMasukSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Data tidak valid" });
    return;
  }

  const { barang_id, tanggal, jumlah, harga_satuan, keterangan, supplier_id } = parsed.data;

  const [barang] = await db.select().from(barangTable)
    .where(and(eq(barangTable.id, barang_id), eq(barangTable.usahaId, usahaId)));
  if (!barang) { res.status(404).json({ error: "Barang tidak ditemukan" }); return; }

  // v1.1.0: validasi supplier_id (kalau ada) — pastikan punya usaha yang sama
  let supplier: typeof suppliersTable.$inferSelect | null = null;
  if (supplier_id != null) {
    const [s] = await db.select().from(suppliersTable)
      .where(and(eq(suppliersTable.id, supplier_id), eq(suppliersTable.usahaId, usahaId)));
    if (!s) { res.status(400).json({ error: "Supplier tidak ditemukan." }); return; }
    supplier = s;
  }

  const harga = harga_satuan ?? parseFloat(barang.hargaBeli);
  const total = jumlah * harga;
  const stokBaru = parseFloat(barang.stok) + jumlah;

  const { transaksi } = db.transaction((tx) => {
    let keuanganId: number | null = null;
    if (total > 0) {
      const ketDefault = supplier
        ? `Beli ${barang.nama} ${jumlah} ${barang.satuan} dari ${supplier.nama}`
        : `Beli ${barang.nama} ${jumlah} ${barang.satuan}`;
      const [k] = tx.insert(keuanganTable).values({
        usahaId,
        tanggal,
        tipe: "keluar",
        kategori: "Pembelian Bahan",
        keterangan: keterangan || ketDefault,
        jumlah: String(total),
      }).returning().all();
      keuanganId = k.id;
    }

    const [transaksi] = tx.insert(transaksiStokTable).values({
      usahaId,
      barangId: barang.id,
      tanggal,
      tipe: "masuk",
      jumlah: String(jumlah),
      hargaSatuan: String(harga),
      keterangan: keterangan || null,
      keuanganId,
      supplierId: supplier ? supplier.id : null,
    }).returning().all();

    tx.update(barangTable).set({ stok: String(stokBaru) }).where(eq(barangTable.id, barang.id)).run();

    return { transaksi };
  });

  res.status(201).json({
    transaksi: fmtTransaksi(transaksi, barang.nama, barang.satuan, supplier?.nama ?? null),
    stok_baru: stokBaru,
    keuangan_otomatis: transaksi.keuanganId !== null,
  });
});

// POST /api/stok/keluar — barang keluar (jual), otomatis keuangan masuk
router.post("/stok/keluar", requireAuth, requireLicense, async (req, res): Promise<void> => {
  const usahaId = req.session.usahaId;
  if (!usahaId) { res.status(403).json({ error: "Forbidden" }); return; }

  const parsed = StokKeluarSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Data tidak valid" });
    return;
  }

  const { barang_id, tanggal, jumlah, harga_satuan, keterangan } = parsed.data;

  const [barang] = await db.select().from(barangTable)
    .where(and(eq(barangTable.id, barang_id), eq(barangTable.usahaId, usahaId)));
  if (!barang) { res.status(404).json({ error: "Barang tidak ditemukan" }); return; }

  const stokSaat = parseFloat(barang.stok);
  if (jumlah > stokSaat) {
    res.status(400).json({ error: `Stok tidak cukup. Stok saat ini: ${stokSaat} ${barang.satuan}` });
    return;
  }

  const harga = harga_satuan ?? parseFloat(barang.hargaJual);
  const total = jumlah * harga;
  const stokBaru = stokSaat - jumlah;

  const { transaksi } = db.transaction((tx) => {
    let keuanganId: number | null = null;
    if (total > 0) {
      const [k] = tx.insert(keuanganTable).values({
        usahaId,
        tanggal,
        tipe: "masuk",
        kategori: "Penjualan",
        keterangan: keterangan || `Jual ${barang.nama} ${jumlah} ${barang.satuan}`,
        jumlah: String(total),
      }).returning().all();
      keuanganId = k.id;
    }

    const [transaksi] = tx.insert(transaksiStokTable).values({
      usahaId,
      barangId: barang.id,
      tanggal,
      tipe: "keluar",
      jumlah: String(jumlah),
      hargaSatuan: String(harga),
      keterangan: keterangan || null,
      keuanganId,
    }).returning().all();

    tx.update(barangTable).set({ stok: String(stokBaru) }).where(eq(barangTable.id, barang.id)).run();

    return { transaksi };
  });

  res.status(201).json({
    transaksi: fmtTransaksi(transaksi, barang.nama, barang.satuan),
    stok_baru: stokBaru,
    peringatan_stok: stokBaru <= parseFloat(barang.stokMinimum) && parseFloat(barang.stokMinimum) > 0,
    keuangan_otomatis: transaksi.keuanganId !== null,
  });
});

// DELETE /api/stok/transaksi/:id — hapus riwayat, balik stok, hapus keuangan terkait
router.delete("/stok/transaksi/:id", requireAuth, requireLicense, async (req, res): Promise<void> => {
  const usahaId = req.session.usahaId;
  if (!usahaId) { res.status(403).json({ error: "Forbidden" }); return; }

  const idParam = typeof req.params.id === "string" ? req.params.id : "";
  const id = parseInt(idParam, 10);
  if (isNaN(id)) { res.status(400).json({ error: "ID tidak valid" }); return; }

  const [transaksi] = await db.select().from(transaksiStokTable)
    .where(and(eq(transaksiStokTable.id, id), eq(transaksiStokTable.usahaId, usahaId)));
  if (!transaksi) { res.status(404).json({ error: "Riwayat transaksi tidak ditemukan" }); return; }

  const [barang] = await db.select().from(barangTable)
    .where(and(eq(barangTable.id, transaksi.barangId), eq(barangTable.usahaId, usahaId)));
  if (!barang) { res.status(404).json({ error: "Barang tidak ditemukan" }); return; }

  const jumlah = parseFloat(transaksi.jumlah);
  const stokSaat = parseFloat(barang.stok);
  const stokBaru = transaksi.tipe === "masuk" ? stokSaat - jumlah : stokSaat + jumlah;

  db.transaction((tx) => {
    if (transaksi.keuanganId) {
      tx.delete(keuanganTable).where(eq(keuanganTable.id, transaksi.keuanganId)).run();
    }
    tx.delete(transaksiStokTable)
      .where(and(eq(transaksiStokTable.id, id), eq(transaksiStokTable.usahaId, usahaId))).run();
    tx.update(barangTable).set({ stok: String(stokBaru) }).where(eq(barangTable.id, barang.id)).run();
  });

  res.json({ message: "Riwayat transaksi berhasil dihapus", stok_baru: stokBaru });
});

// ─── Import Barang via Excel/CSV ──────────────────────────────────────────────

const ImportBarangItemSchema = z.object({
  nama: z.string().min(1, "Nama wajib diisi").trim(),
  satuan: z.string().min(1, "Satuan wajib diisi").trim(),
  kategori: z.string().trim().optional(),
  harga_beli: z.coerce.number().min(0).default(0),
  harga_jual: z.coerce.number().min(0).default(0),
  stok_awal: z.coerce.number().min(0).default(0),
  stok_minimum: z.coerce.number().min(0).default(0),
});

const ImportBarangSchema = z.object({
  items: z.array(ImportBarangItemSchema).min(1, "Minimal 1 barang harus diimport"),
});

// POST /api/barang/import — import banyak barang sekaligus
router.post("/barang/import", requireAuth, requireLicense, async (req, res): Promise<void> => {
  const usahaId = req.session.usahaId;
  if (!usahaId) { res.status(403).json({ error: "Forbidden" }); return; }

  const parsed = ImportBarangSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Data tidak valid" });
    return;
  }

  const { items } = parsed.data;
  let berhasil = 0;
  let dilewati = 0;

  for (const item of items) {
    const stokAwal = item.stok_awal ?? 0;
    try {
      db.transaction((tx) => {
        const [barang] = tx.insert(barangTable).values({
          usahaId,
          nama: item.nama,
          satuan: item.satuan,
          kategori: item.kategori ?? "",
          hargaBeli: String(item.harga_beli),
          hargaJual: String(item.harga_jual),
          stok: String(stokAwal),
          stokMinimum: String(item.stok_minimum),
        }).returning().all();

        if (stokAwal > 0) {
          tx.insert(transaksiStokTable).values({
            usahaId,
            barangId: barang.id,
            tanggal: new Date().toISOString().slice(0, 10),
            tipe: "masuk",
            jumlah: String(stokAwal),
            hargaSatuan: String(item.harga_beli),
            keterangan: "Stok awal (import)",
          }).run();
        }
      });
      berhasil++;
    } catch {
      dilewati++;
    }
  }

  res.status(201).json({
    message: `Import selesai: ${berhasil} barang ditambahkan, ${dilewati} dilewati`,
    berhasil,
    dilewati,
  });
});

export default router;
