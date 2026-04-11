import { Router, type IRouter } from "express";
import { db, usahaTable, pelangganTable, hutangTable, pembayaranTable, keuanganTable, barangTable, transaksiStokTable } from "@workspace/db";
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

  const pelangganList     = await db.select().from(pelangganTable).where(eq(pelangganTable.usahaId, usahaId));
  const hutangList        = await db.select().from(hutangTable).where(eq(hutangTable.usahaId, usahaId));
  const pembayaranList    = await db.select().from(pembayaranTable).where(eq(pembayaranTable.usahaId, usahaId));
  const keuanganList      = await db.select().from(keuanganTable).where(eq(keuanganTable.usahaId, usahaId));
  const barangList        = await db.select().from(barangTable).where(eq(barangTable.usahaId, usahaId));
  const transaksiStokList = await db.select().from(transaksiStokTable).where(eq(transaksiStokTable.usahaId, usahaId));

  const backup = {
    version: "1.1",
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
      tanggal_bayar: p.tanggalBayar,
      nominal_bayar: parseFloat(p.nominalBayar),
      catatan: p.catatan ?? null,
      nomor_kwitansi: p.nomorKwitansi ?? null,
      sisa_hutang_setelah: p.sisaHutangSetelah ? parseFloat(p.sisaHutangSetelah) : null,
      keuangan_id: p.keuanganId ?? null,
      created_at: p.createdAt.toISOString(),
    })),
    keuangan: keuanganList.map((k) => ({
      id: k.id,
      usaha_id: k.usahaId,
      tanggal: k.tanggal,
      tipe: k.tipe,
      kategori: k.kategori ?? null,
      keterangan: k.keterangan,
      jumlah: parseFloat(k.jumlah),
      created_at: k.createdAt.toISOString(),
    })),
    barang: barangList.map((b) => ({
      id: b.id,
      usaha_id: b.usahaId,
      nama: b.nama,
      satuan: b.satuan,
      harga_beli: parseFloat(b.hargaBeli),
      harga_jual: parseFloat(b.hargaJual),
      stok: parseFloat(b.stok),
      stok_minimum: parseFloat(b.stokMinimum),
      created_at: b.createdAt.toISOString(),
    })),
    transaksi_stok: transaksiStokList.map((t) => ({
      id: t.id,
      usaha_id: t.usahaId,
      barang_id: t.barangId,
      tanggal: t.tanggal,
      tipe: t.tipe,
      jumlah: parseFloat(t.jumlah),
      harga_satuan: parseFloat(t.hargaSatuan),
      keterangan: t.keterangan ?? null,
      keuangan_id: t.keuanganId ?? null,
      created_at: t.createdAt.toISOString(),
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

  // Hapus semua data lama (urutan penting karena foreign key)
  await db.delete(transaksiStokTable).where(eq(transaksiStokTable.usahaId, usahaId));
  await db.delete(pembayaranTable).where(eq(pembayaranTable.usahaId, usahaId));
  await db.delete(hutangTable).where(eq(hutangTable.usahaId, usahaId));
  await db.delete(barangTable).where(eq(barangTable.usahaId, usahaId));
  await db.delete(pelangganTable).where(eq(pelangganTable.usahaId, usahaId));
  await db.delete(keuanganTable).where(eq(keuanganTable.usahaId, usahaId));

  // 1. Restore keuangan — bangun peta ID lama → baru
  const keuanganIdMap = new Map<number, number>();
  if (Array.isArray(backup.keuangan)) {
    for (const k of backup.keuangan) {
      const [inserted] = await db.insert(keuanganTable).values({
        usahaId,
        tanggal: k.tanggal,
        tipe: k.tipe,
        kategori: k.kategori ?? null,
        keterangan: k.keterangan,
        jumlah: k.jumlah.toString(),
      }).returning();
      keuanganIdMap.set(k.id, inserted.id);
    }
  }

  // 2. Restore pelanggan — bangun peta ID lama → baru
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

  // 3. Restore barang — bangun peta ID lama → baru
  const barangIdMap = new Map<number, number>();
  if (Array.isArray(backup.barang)) {
    for (const b of backup.barang) {
      const [inserted] = await db.insert(barangTable).values({
        usahaId,
        nama: b.nama,
        satuan: b.satuan,
        hargaBeli: b.harga_beli.toString(),
        hargaJual: b.harga_jual.toString(),
        stok: b.stok.toString(),
        stokMinimum: b.stok_minimum.toString(),
      }).returning();
      barangIdMap.set(b.id, inserted.id);
    }
  }

  // 4. Restore hutang — bangun peta ID lama → baru
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

  // 5. Restore pembayaran (dengan nomor kwitansi & link ke keuangan baru)
  for (const p of backup.pembayaran) {
    const newHutangId    = hutangIdMap.get(p.hutang_id) ?? p.hutang_id;
    const newPelangganId = pelangganIdMap.get(p.pelanggan_id) ?? p.pelanggan_id;
    const newKeuanganId  = p.keuangan_id != null ? (keuanganIdMap.get(p.keuangan_id) ?? null) : null;
    await db.insert(pembayaranTable).values({
      usahaId,
      hutangId: newHutangId,
      pelangganId: newPelangganId,
      tanggalBayar: p.tanggal_bayar,
      nominalBayar: p.nominal_bayar.toString(),
      catatan: p.catatan ?? null,
      nomorKwitansi: p.nomor_kwitansi ?? null,
      sisaHutangSetelah: p.sisa_hutang_setelah != null ? p.sisa_hutang_setelah.toString() : null,
      keuanganId: newKeuanganId,
    });
  }

  // 6. Restore transaksi stok (dengan link ke barang & keuangan baru)
  if (Array.isArray(backup.transaksi_stok)) {
    for (const t of backup.transaksi_stok) {
      const newBarangId   = barangIdMap.get(t.barang_id) ?? t.barang_id;
      const newKeuanganId = t.keuangan_id != null ? (keuanganIdMap.get(t.keuangan_id) ?? null) : null;
      await db.insert(transaksiStokTable).values({
        usahaId,
        barangId: newBarangId,
        tanggal: t.tanggal,
        tipe: t.tipe,
        jumlah: t.jumlah.toString(),
        hargaSatuan: t.harga_satuan.toString(),
        keterangan: t.keterangan ?? null,
        keuanganId: newKeuanganId,
      });
    }
  }

  res.json({ message: "Restore data berhasil." });
});

export default router;
