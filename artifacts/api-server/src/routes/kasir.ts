import { Router, type IRouter } from "express";
import { db, barangTable, transaksiStokTable, keuanganTable, transaksiKasirTable, transaksiKasirItemTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { requireAuth, requireLicense } from "../middlewares/auth";

const router: IRouter = Router();

// POST /api/kasir/transaksi — selesaikan transaksi kasir (multi-item)
router.post("/kasir/transaksi", requireAuth, requireLicense, async (req, res): Promise<void> => {
  const usahaId = req.session.usahaId;
  if (!usahaId) { res.status(403).json({ error: "Forbidden" }); return; }

  const { tanggal, items, uang_bayar, catatan } = req.body;

  if (!tanggal || !Array.isArray(items) || items.length === 0) {
    res.status(400).json({ error: "tanggal dan items wajib diisi" }); return;
  }
  if (!uang_bayar || isNaN(parseFloat(uang_bayar))) {
    res.status(400).json({ error: "uang_bayar wajib diisi" }); return;
  }

  // Validasi semua barang dan cek stok (di luar transaksi — hanya baca)
  const barangList: Array<typeof barangTable.$inferSelect> = [];
  for (const item of items) {
    const { barang_id, jumlah } = item;
    if (!barang_id || !jumlah || isNaN(parseFloat(jumlah)) || parseFloat(jumlah) <= 0) {
      res.status(400).json({ error: "Setiap item harus punya barang_id dan jumlah yang valid" }); return;
    }
    const [barang] = await db.select().from(barangTable)
      .where(and(eq(barangTable.id, parseInt(barang_id)), eq(barangTable.usahaId, usahaId)));
    if (!barang) {
      res.status(404).json({ error: `Barang ID ${barang_id} tidak ditemukan` }); return;
    }
    const stokSaat = parseFloat(barang.stok);
    const jml = parseFloat(String(jumlah));
    if (jml > stokSaat) {
      res.status(400).json({ error: `Stok ${barang.nama} tidak cukup. Stok: ${stokSaat} ${barang.satuan}` }); return;
    }
    barangList.push(barang);
  }

  // Hitung total
  let total = 0;
  const itemsCalc = items.map((item: Record<string, string | number>, i: number) => {
    const barang = barangList[i];
    const jml = parseFloat(String(item.jumlah));
    const harga = parseFloat(String(item.harga_satuan ?? barang.hargaJual));
    const subtotal = jml * harga;
    total += subtotal;
    return { barang, jml, harga, subtotal };
  });

  const uangBayarNum = parseFloat(String(uang_bayar));
  if (uangBayarNum < total) {
    res.status(400).json({ error: `Uang bayar kurang. Total: ${total}, Uang bayar: ${uangBayarNum}` }); return;
  }
  const kembalian = uangBayarNum - total;
  const namaBarangList = itemsCalc.map(i => i.barang.nama).join(", ");

  // Semua operasi tulis dalam satu database transaction agar atomik
  const { kasir, kasirItems } = db.transaction((tx) => {
    const [keuangan] = tx.insert(keuanganTable).values({
      usahaId,
      tanggal: String(tanggal),
      tipe: "masuk",
      kategori: "Penjualan Kasir",
      keterangan: catatan ? String(catatan).trim() : `Kasir: ${namaBarangList.slice(0, 100)}`,
      jumlah: String(total),
    }).returning().all();

    for (const { barang, jml, harga } of itemsCalc) {
      const stokBaru = parseFloat(barang.stok) - jml;
      tx.update(barangTable).set({ stok: String(stokBaru) }).where(eq(barangTable.id, barang.id)).run();
      tx.insert(transaksiStokTable).values({
        usahaId,
        barangId: barang.id,
        tanggal: String(tanggal),
        tipe: "keluar",
        jumlah: String(jml),
        hargaSatuan: String(harga),
        keterangan: catatan ? String(catatan).trim() : `Kasir`,
        keuanganId: keuangan.id,
      }).run();
    }

    const [kasir] = tx.insert(transaksiKasirTable).values({
      usahaId,
      tanggal: String(tanggal),
      total: String(total),
      uangBayar: String(uangBayarNum),
      kembalian: String(kembalian),
      catatan: catatan ? String(catatan).trim() : null,
    }).returning().all();

    const kasirItems: Array<typeof transaksiKasirItemTable.$inferSelect> = [];
    for (const { barang, jml, harga, subtotal } of itemsCalc) {
      const [ki] = tx.insert(transaksiKasirItemTable).values({
        transaksiKasirId: kasir.id,
        barangId: barang.id,
        namaBarang: barang.nama,
        satuan: barang.satuan,
        jumlah: String(jml),
        hargaSatuan: String(harga),
        subtotal: String(subtotal),
      }).returning().all();
      kasirItems.push(ki);
    }

    return { kasir, kasirItems };
  });

  res.status(201).json({
    id: kasir.id,
    tanggal: kasir.tanggal,
    total,
    uang_bayar: uangBayarNum,
    kembalian,
    catatan: kasir.catatan ?? null,
    items: kasirItems.map(ki => ({
      id: ki.id,
      barang_id: ki.barangId,
      nama_barang: ki.namaBarang,
      satuan: ki.satuan,
      jumlah: parseFloat(ki.jumlah),
      harga_satuan: parseFloat(ki.hargaSatuan),
      subtotal: parseFloat(ki.subtotal),
    })),
  });
});

// GET /api/kasir/transaksi — riwayat transaksi kasir
router.get("/kasir/transaksi", requireAuth, async (req, res): Promise<void> => {
  const usahaId = req.session.usahaId;
  if (!usahaId) { res.status(403).json({ error: "Forbidden" }); return; }

  const rows = await db.select().from(transaksiKasirTable)
    .where(eq(transaksiKasirTable.usahaId, usahaId))
    .orderBy(desc(transaksiKasirTable.createdAt))
    .limit(50);

  const result = await Promise.all(rows.map(async (k) => {
    const items = await db.select().from(transaksiKasirItemTable)
      .where(eq(transaksiKasirItemTable.transaksiKasirId, k.id));
    return {
      id: k.id,
      tanggal: k.tanggal,
      total: parseFloat(k.total),
      uang_bayar: parseFloat(k.uangBayar),
      kembalian: parseFloat(k.kembalian),
      catatan: k.catatan ?? null,
      created_at: k.createdAt instanceof Date ? k.createdAt.toISOString() : new Date(k.createdAt).toISOString(),
      items: items.map(i => ({
        id: i.id,
        barang_id: i.barangId,
        nama_barang: i.namaBarang,
        satuan: i.satuan,
        jumlah: parseFloat(i.jumlah),
        harga_satuan: parseFloat(i.hargaSatuan),
        subtotal: parseFloat(i.subtotal),
      })),
    };
  }));

  res.json(result);
});

export default router;
