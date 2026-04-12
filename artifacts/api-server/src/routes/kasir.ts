import { Router, type IRouter } from "express";
import { db, barangTable, transaksiStokTable, keuanganTable, transaksiKasirTable, transaksiKasirItemTable, usahaTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { requireAuth, requireLicense } from "../middlewares/auth";
import { z } from "zod";

const router: IRouter = Router();

// ─── Zod Schemas ──────────────────────────────────────────────────────────────

const KasirItemSchema = z.object({
  barang_id: z.coerce.number({ error: "barang_id harus berupa angka" }).int().positive("barang_id tidak valid"),
  jumlah: z.coerce.number({ error: "Jumlah harus berupa angka" }).positive("Jumlah harus lebih dari 0"),
  harga_satuan: z.coerce.number({ error: "Harga satuan harus berupa angka" }).min(0).optional(),
});

const KasirTransaksiSchema = z.object({
  tanggal: z.string().min(1, "Tanggal wajib diisi").regex(/^\d{4}-\d{2}-\d{2}$/, "Format tanggal tidak valid (YYYY-MM-DD)"),
  uang_bayar: z.coerce.number({ error: "Uang bayar harus berupa angka" }).positive("Uang bayar harus lebih dari 0"),
  diskon: z.coerce.number({ error: "Diskon harus berupa angka" }).min(0).default(0),
  catatan: z.string().trim().optional(),
  items: z.array(KasirItemSchema).min(1, "Minimal 1 item harus dimasukkan"),
});

// ─── Routes ───────────────────────────────────────────────────────────────────

// POST /api/kasir/transaksi — selesaikan transaksi kasir (multi-item)
router.post("/kasir/transaksi", requireAuth, requireLicense, async (req, res): Promise<void> => {
  const usahaId = req.session.usahaId;
  if (!usahaId) { res.status(403).json({ error: "Forbidden" }); return; }

  const parsed = KasirTransaksiSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Data tidak valid" });
    return;
  }

  const { tanggal, uang_bayar, diskon, catatan, items } = parsed.data;

  // Ambil nama usaha untuk struk
  const [usaha] = await db.select().from(usahaTable).where(eq(usahaTable.id, usahaId));

  // Validasi stok semua barang (di luar transaksi — hanya baca)
  const barangList: Array<typeof barangTable.$inferSelect> = [];
  for (const item of items) {
    const [barang] = await db.select().from(barangTable)
      .where(and(eq(barangTable.id, item.barang_id), eq(barangTable.usahaId, usahaId)));
    if (!barang) {
      res.status(404).json({ error: `Barang ID ${item.barang_id} tidak ditemukan` });
      return;
    }
    const stokSaat = parseFloat(barang.stok);
    if (item.jumlah > stokSaat) {
      res.status(400).json({ error: `Stok ${barang.nama} tidak cukup. Stok: ${stokSaat} ${barang.satuan}` });
      return;
    }
    barangList.push(barang);
  }

  // Hitung subtotal item
  let subtotalItems = 0;
  const itemsCalc = items.map((item, i) => {
    const barang = barangList[i];
    const harga = item.harga_satuan ?? parseFloat(barang.hargaJual);
    const subtotal = item.jumlah * harga;
    subtotalItems += subtotal;
    return { barang, jml: item.jumlah, harga, subtotal };
  });

  // Terapkan diskon
  const nominalDiskon = Math.min(diskon, subtotalItems);
  const total = subtotalItems - nominalDiskon;

  if (uang_bayar < total) {
    res.status(400).json({ error: `Uang bayar kurang. Total: ${total}, Uang bayar: ${uang_bayar}` });
    return;
  }

  const kembalian = uang_bayar - total;
  const namaBarangList = itemsCalc.map(i => i.barang.nama).join(", ");

  // Semua operasi tulis dalam satu database transaction agar atomik
  const { kasir, kasirItems } = db.transaction((tx) => {
    const [keuangan] = tx.insert(keuanganTable).values({
      usahaId,
      tanggal,
      tipe: "masuk",
      kategori: "Penjualan Kasir",
      keterangan: catatan || `Kasir: ${namaBarangList.slice(0, 100)}`,
      jumlah: String(total),
    }).returning().all();

    for (const { barang, jml, harga } of itemsCalc) {
      const stokBaru = parseFloat(barang.stok) - jml;
      tx.update(barangTable).set({ stok: String(stokBaru) }).where(eq(barangTable.id, barang.id)).run();
      tx.insert(transaksiStokTable).values({
        usahaId,
        barangId: barang.id,
        tanggal,
        tipe: "keluar",
        jumlah: String(jml),
        hargaSatuan: String(harga),
        keterangan: catatan || `Kasir`,
        keuanganId: keuangan.id,
      }).run();
    }

    const [kasir] = tx.insert(transaksiKasirTable).values({
      usahaId,
      tanggal,
      total: String(total),
      diskon: String(nominalDiskon),
      uangBayar: String(uang_bayar),
      kembalian: String(kembalian),
      catatan: catatan || null,
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
    nama_usaha: usaha?.namaUsaha ?? "Usahaku",
    subtotal: subtotalItems,
    diskon: nominalDiskon,
    total,
    uang_bayar,
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
      diskon: parseFloat(k.diskon ?? "0"),
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
