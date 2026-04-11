import { Router, type IRouter } from "express";
import { db, barangTable, transaksiStokTable, keuanganTable } from "@workspace/db";
import { eq, and, desc, lte, sql } from "drizzle-orm";
import { requireAuth, requireLicense } from "../middlewares/auth";

const router: IRouter = Router();

function fmtBarang(b: typeof barangTable.$inferSelect) {
  const stok = parseFloat(b.stok);
  const stokMin = parseFloat(b.stokMinimum);
  return {
    id: b.id,
    usaha_id: b.usahaId,
    nama: b.nama,
    satuan: b.satuan,
    harga_beli: parseFloat(b.hargaBeli),
    harga_jual: parseFloat(b.hargaJual),
    stok,
    stok_minimum: stokMin,
    peringatan: stok <= stokMin && stokMin > 0,
    created_at: b.createdAt instanceof Date ? b.createdAt.toISOString() : new Date(b.createdAt).toISOString(),
  };
}

function fmtTransaksi(t: typeof transaksiStokTable.$inferSelect, namaBahan: string, satuan: string) {
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
    created_at: t.createdAt instanceof Date ? t.createdAt.toISOString() : new Date(t.createdAt).toISOString(),
  };
}

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

  const { nama, satuan, harga_beli, harga_jual, stok_awal, stok_minimum } = req.body;
  if (!nama || !satuan) { res.status(400).json({ error: "nama dan satuan wajib diisi" }); return; }

  const [inserted] = await db.insert(barangTable).values({
    usahaId,
    nama: String(nama).trim(),
    satuan: String(satuan).trim(),
    hargaBeli: String(parseFloat(harga_beli ?? "0") || 0),
    hargaJual: String(parseFloat(harga_jual ?? "0") || 0),
    stok: String(parseFloat(stok_awal ?? "0") || 0),
    stokMinimum: String(parseFloat(stok_minimum ?? "0") || 0),
  }).returning();
  res.status(201).json(fmtBarang(inserted));
});

// PUT /api/barang/:id
router.put("/barang/:id", requireAuth, requireLicense, async (req, res): Promise<void> => {
  const usahaId = req.session.usahaId;
  if (!usahaId) { res.status(403).json({ error: "Forbidden" }); return; }

  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "ID tidak valid" }); return; }

  const [existing] = await db.select().from(barangTable).where(and(eq(barangTable.id, id), eq(barangTable.usahaId, usahaId)));
  if (!existing) { res.status(404).json({ error: "Barang tidak ditemukan" }); return; }

  const { nama, satuan, harga_beli, harga_jual, stok_minimum } = req.body;
  if (!nama || !satuan) { res.status(400).json({ error: "nama dan satuan wajib diisi" }); return; }

  const [updated] = await db.update(barangTable).set({
    nama: String(nama).trim(),
    satuan: String(satuan).trim(),
    hargaBeli: String(parseFloat(harga_beli ?? "0") || 0),
    hargaJual: String(parseFloat(harga_jual ?? "0") || 0),
    stokMinimum: String(parseFloat(stok_minimum ?? "0") || 0),
  }).where(and(eq(barangTable.id, id), eq(barangTable.usahaId, usahaId))).returning();

  res.json(fmtBarang(updated));
});

// DELETE /api/barang/:id
router.delete("/barang/:id", requireAuth, requireLicense, async (req, res): Promise<void> => {
  const usahaId = req.session.usahaId;
  if (!usahaId) { res.status(403).json({ error: "Forbidden" }); return; }

  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "ID tidak valid" }); return; }

  const [existing] = await db.select().from(barangTable).where(and(eq(barangTable.id, id), eq(barangTable.usahaId, usahaId)));
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

  res.json(rows.map(t => fmtTransaksi(t, barangMap[t.barangId]?.nama ?? "-", barangMap[t.barangId]?.satuan ?? "")));
});

// POST /api/stok/masuk — barang masuk (beli), otomatis keuangan keluar
router.post("/stok/masuk", requireAuth, requireLicense, async (req, res): Promise<void> => {
  const usahaId = req.session.usahaId;
  if (!usahaId) { res.status(403).json({ error: "Forbidden" }); return; }

  const { barang_id, tanggal, jumlah, harga_satuan, keterangan } = req.body;
  if (!barang_id || !tanggal || !jumlah) {
    res.status(400).json({ error: "barang_id, tanggal, dan jumlah wajib diisi" }); return;
  }

  const [barang] = await db.select().from(barangTable).where(and(eq(barangTable.id, parseInt(barang_id)), eq(barangTable.usahaId, usahaId)));
  if (!barang) { res.status(404).json({ error: "Barang tidak ditemukan" }); return; }

  const jml = parseFloat(String(jumlah));
  const harga = parseFloat(String(harga_satuan ?? barang.hargaBeli));
  if (isNaN(jml) || jml <= 0) { res.status(400).json({ error: "Jumlah harus lebih dari 0" }); return; }

  const total = jml * harga;
  const stokBaru = parseFloat(barang.stok) + jml;

  // Insert keuangan keluar otomatis
  let keuanganId: number | null = null;
  if (total > 0) {
    const [k] = await db.insert(keuanganTable).values({
      usahaId,
      tanggal: String(tanggal),
      tipe: "keluar",
      kategori: "Pembelian Bahan",
      keterangan: keterangan ? String(keterangan).trim() : `Beli ${barang.nama} ${jml} ${barang.satuan}`,
      jumlah: String(total),
    }).returning();
    keuanganId = k.id;
  }

  // Insert transaksi stok
  const [transaksi] = await db.insert(transaksiStokTable).values({
    usahaId,
    barangId: barang.id,
    tanggal: String(tanggal),
    tipe: "masuk",
    jumlah: String(jml),
    hargaSatuan: String(harga),
    keterangan: keterangan ? String(keterangan).trim() : null,
    keuanganId,
  }).returning();

  // Update stok barang
  await db.update(barangTable).set({ stok: String(stokBaru) }).where(eq(barangTable.id, barang.id));

  res.status(201).json({
    transaksi: fmtTransaksi(transaksi, barang.nama, barang.satuan),
    stok_baru: stokBaru,
    keuangan_otomatis: keuanganId !== null,
  });
});

// POST /api/stok/keluar — barang keluar (jual), otomatis keuangan masuk
router.post("/stok/keluar", requireAuth, requireLicense, async (req, res): Promise<void> => {
  const usahaId = req.session.usahaId;
  if (!usahaId) { res.status(403).json({ error: "Forbidden" }); return; }

  const { barang_id, tanggal, jumlah, harga_satuan, keterangan } = req.body;
  if (!barang_id || !tanggal || !jumlah) {
    res.status(400).json({ error: "barang_id, tanggal, dan jumlah wajib diisi" }); return;
  }

  const [barang] = await db.select().from(barangTable).where(and(eq(barangTable.id, parseInt(barang_id)), eq(barangTable.usahaId, usahaId)));
  if (!barang) { res.status(404).json({ error: "Barang tidak ditemukan" }); return; }

  const jml = parseFloat(String(jumlah));
  const harga = parseFloat(String(harga_satuan ?? barang.hargaJual));
  if (isNaN(jml) || jml <= 0) { res.status(400).json({ error: "Jumlah harus lebih dari 0" }); return; }

  const stokSaat = parseFloat(barang.stok);
  if (jml > stokSaat) {
    res.status(400).json({ error: `Stok tidak cukup. Stok saat ini: ${stokSaat} ${barang.satuan}` }); return;
  }

  const total = jml * harga;
  const stokBaru = stokSaat - jml;

  // Insert keuangan masuk otomatis
  let keuanganId: number | null = null;
  if (total > 0) {
    const [k] = await db.insert(keuanganTable).values({
      usahaId,
      tanggal: String(tanggal),
      tipe: "masuk",
      kategori: "Penjualan",
      keterangan: keterangan ? String(keterangan).trim() : `Jual ${barang.nama} ${jml} ${barang.satuan}`,
      jumlah: String(total),
    }).returning();
    keuanganId = k.id;
  }

  // Insert transaksi stok
  const [transaksi] = await db.insert(transaksiStokTable).values({
    usahaId,
    barangId: barang.id,
    tanggal: String(tanggal),
    tipe: "keluar",
    jumlah: String(jml),
    hargaSatuan: String(harga),
    keterangan: keterangan ? String(keterangan).trim() : null,
    keuanganId,
  }).returning();

  // Update stok barang
  await db.update(barangTable).set({ stok: String(stokBaru) }).where(eq(barangTable.id, barang.id));

  res.status(201).json({
    transaksi: fmtTransaksi(transaksi, barang.nama, barang.satuan),
    stok_baru: stokBaru,
    peringatan_stok: stokBaru <= parseFloat(barang.stokMinimum) && parseFloat(barang.stokMinimum) > 0,
    keuangan_otomatis: keuanganId !== null,
  });
});

// DELETE /api/stok/transaksi/:id — hapus riwayat, balik stok, hapus keuangan terkait
router.delete("/stok/transaksi/:id", requireAuth, requireLicense, async (req, res): Promise<void> => {
  const usahaId = req.session.usahaId;
  if (!usahaId) { res.status(403).json({ error: "Forbidden" }); return; }

  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "ID tidak valid" }); return; }

  const [transaksi] = await db.select().from(transaksiStokTable)
    .where(and(eq(transaksiStokTable.id, id), eq(transaksiStokTable.usahaId, usahaId)));
  if (!transaksi) { res.status(404).json({ error: "Riwayat transaksi tidak ditemukan" }); return; }

  const [barang] = await db.select().from(barangTable)
    .where(and(eq(barangTable.id, transaksi.barangId), eq(barangTable.usahaId, usahaId)));
  if (!barang) { res.status(404).json({ error: "Barang tidak ditemukan" }); return; }

  const jumlah = parseFloat(transaksi.jumlah);
  const stokSaat = parseFloat(barang.stok);

  // Balik stok: jika transaksi masuk → kurangi stok, jika keluar → tambah stok
  const stokBaru = transaksi.tipe === "masuk" ? stokSaat - jumlah : stokSaat + jumlah;

  // Hapus keuangan terkait (jika ada)
  if (transaksi.keuanganId) {
    await db.delete(keuanganTable).where(eq(keuanganTable.id, transaksi.keuanganId));
  }

  // Hapus transaksi stok
  await db.delete(transaksiStokTable)
    .where(and(eq(transaksiStokTable.id, id), eq(transaksiStokTable.usahaId, usahaId)));

  // Update stok barang
  await db.update(barangTable).set({ stok: String(stokBaru) }).where(eq(barangTable.id, barang.id));

  res.json({ message: "Riwayat transaksi berhasil dihapus", stok_baru: stokBaru });
});

export default router;
