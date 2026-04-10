import { Router, type IRouter } from "express";
import { db, pembayaranTable, hutangTable, pelangganTable, usahaTable } from "@workspace/db";
import { eq, and, desc, count } from "drizzle-orm";
import {
  CreatePembayaranBody,
  GetPembayaranListQueryParams,
  DeletePembayaranParams,
} from "@workspace/api-zod";
import { requireAuth, requireLicense } from "../middlewares/auth";

const router: IRouter = Router();

router.get("/pembayaran", requireAuth, async (req, res): Promise<void> => {
  const usahaId = req.session.usahaId;
  if (!usahaId) {
    res.status(403).json({ error: "Akses ditolak." });
    return;
  }

  const queryParams = GetPembayaranListQueryParams.safeParse(req.query);
  const conditions = [eq(pembayaranTable.usahaId, usahaId)];

  if (queryParams.success) {
    if (queryParams.data.hutang_id) {
      conditions.push(eq(pembayaranTable.hutangId, queryParams.data.hutang_id));
    }
    if (queryParams.data.pelanggan_id) {
      conditions.push(eq(pembayaranTable.pelangganId, queryParams.data.pelanggan_id));
    }
  }

  const list = await db.select({
    pembayaran: pembayaranTable,
    pelangganNama: pelangganTable.nama,
    hutangKeterangan: hutangTable.keterangan,
    hutangNominal: hutangTable.nominalHutang,
    namaUsaha: usahaTable.namaUsaha,
  })
    .from(pembayaranTable)
    .leftJoin(pelangganTable, eq(pembayaranTable.pelangganId, pelangganTable.id))
    .leftJoin(hutangTable, eq(pembayaranTable.hutangId, hutangTable.id))
    .leftJoin(usahaTable, eq(pembayaranTable.usahaId, usahaTable.id))
    .where(and(...conditions))
    .orderBy(desc(pembayaranTable.tanggalBayar), desc(pembayaranTable.id));

  res.json(list.map(({ pembayaran: p, pelangganNama, hutangKeterangan, hutangNominal, namaUsaha }) => ({
    id: p.id,
    usaha_id: p.usahaId,
    hutang_id: p.hutangId,
    pelanggan_id: p.pelangganId,
    pelanggan_nama: pelangganNama ?? "",
    tanggal_bayar: p.tanggalBayar,
    nominal_bayar: parseFloat(p.nominalBayar),
    catatan: p.catatan ?? null,
    nomor_kwitansi: p.nomorKwitansi ?? null,
    hutang_keterangan: hutangKeterangan ?? null,
    hutang_nominal: hutangNominal ? parseFloat(hutangNominal) : 0,
    sisa_hutang_setelah: p.sisaHutangSetelah ? parseFloat(p.sisaHutangSetelah) : null,
    nama_usaha: namaUsaha ?? "",
    created_at: p.createdAt.toISOString(),
  })));
});

router.post("/pembayaran", requireAuth, requireLicense, async (req, res): Promise<void> => {
  const usahaId = req.session.usahaId;
  if (!usahaId) {
    res.status(403).json({ error: "Akses ditolak." });
    return;
  }

  const parsed = CreatePembayaranBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  if (parsed.data.nominal_bayar <= 0) {
    res.status(400).json({ error: "Nominal bayar harus lebih dari 0." });
    return;
  }

  const [hutang] = await db.select().from(hutangTable)
    .where(and(eq(hutangTable.id, parsed.data.hutang_id), eq(hutangTable.usahaId, usahaId)));

  if (!hutang) {
    res.status(404).json({ error: "Hutang tidak ditemukan." });
    return;
  }

  if (hutang.status === "lunas") {
    res.status(400).json({ error: "Hutang ini sudah lunas. Tidak dapat menambah pembayaran." });
    return;
  }

  const sisaHutang = parseFloat(hutang.sisaHutang);
  if (parsed.data.nominal_bayar > sisaHutang) {
    res.status(400).json({
      error: `Nominal bayar (${parsed.data.nominal_bayar}) melebihi sisa hutang (${sisaHutang}). Masukkan jumlah yang sesuai.`,
    });
    return;
  }

  const [pelanggan] = await db.select().from(pelangganTable).where(eq(pelangganTable.id, hutang.pelangganId));
  const [usaha] = await db.select().from(usahaTable).where(eq(usahaTable.id, usahaId));

  // Auto-generate nomor kwitansi: KWT-YYYY-NNNN (sequential per usaha)
  const tahun = new Date().getFullYear();
  const [{ jumlah }] = await db.select({ jumlah: count() }).from(pembayaranTable).where(eq(pembayaranTable.usahaId, usahaId));
  const nomorUrut = String(jumlah + 1).padStart(4, "0");
  const nomorKwitansi = `KWT-${tahun}-${nomorUrut}`;

  const sisaSetelah = Math.max(0, parseFloat(hutang.nominalHutang) - (parseFloat(hutang.totalDibayar) + parsed.data.nominal_bayar));

  const [pembayaran] = await db.insert(pembayaranTable).values({
    usahaId,
    hutangId: parsed.data.hutang_id,
    pelangganId: hutang.pelangganId,
    tanggalBayar: parsed.data.tanggal_bayar,
    nominalBayar: parsed.data.nominal_bayar.toString(),
    catatan: parsed.data.catatan ?? null,
    nomorKwitansi,
    sisaHutangSetelah: sisaSetelah.toString(),
  }).returning();

  const newTotalDibayar = parseFloat(hutang.totalDibayar) + parsed.data.nominal_bayar;
  const newSisaHutang = parseFloat(hutang.nominalHutang) - newTotalDibayar;
  const newStatus = newSisaHutang <= 0 ? "lunas" : "aktif";

  await db.update(hutangTable).set({
    totalDibayar: newTotalDibayar.toString(),
    sisaHutang: Math.max(0, newSisaHutang).toString(),
    status: newStatus,
    updatedAt: new Date(),
  }).where(eq(hutangTable.id, parsed.data.hutang_id));

  res.status(201).json({
    id: pembayaran.id,
    usaha_id: pembayaran.usahaId,
    hutang_id: pembayaran.hutangId,
    pelanggan_id: pembayaran.pelangganId,
    pelanggan_nama: pelanggan?.nama ?? "",
    tanggal_bayar: pembayaran.tanggalBayar,
    nominal_bayar: parseFloat(pembayaran.nominalBayar),
    catatan: pembayaran.catatan ?? null,
    nomor_kwitansi: nomorKwitansi,
    hutang_keterangan: hutang.keterangan ?? null,
    hutang_nominal: parseFloat(hutang.nominalHutang),
    sisa_hutang_setelah: sisaSetelah,
    nama_usaha: usaha?.namaUsaha ?? "",
    created_at: pembayaran.createdAt.toISOString(),
  });
});

router.delete("/pembayaran/:id", requireAuth, requireLicense, async (req, res): Promise<void> => {
  const usahaId = req.session.usahaId;
  if (!usahaId) {
    res.status(403).json({ error: "Akses ditolak." });
    return;
  }

  const params = DeletePembayaranParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "ID tidak valid." });
    return;
  }

  const [pembayaran] = await db.select().from(pembayaranTable)
    .where(and(eq(pembayaranTable.id, params.data.id), eq(pembayaranTable.usahaId, usahaId)));

  if (!pembayaran) {
    res.status(404).json({ error: "Pembayaran tidak ditemukan." });
    return;
  }

  const [hutang] = await db.select().from(hutangTable).where(eq(hutangTable.id, pembayaran.hutangId));
  if (hutang) {
    const newTotalDibayar = Math.max(0, parseFloat(hutang.totalDibayar) - parseFloat(pembayaran.nominalBayar));
    const newSisaHutang = parseFloat(hutang.nominalHutang) - newTotalDibayar;
    await db.update(hutangTable).set({
      totalDibayar: newTotalDibayar.toString(),
      sisaHutang: newSisaHutang.toString(),
      status: newSisaHutang > 0 ? "aktif" : "lunas",
      updatedAt: new Date(),
    }).where(eq(hutangTable.id, hutang.id));
  }

  await db.delete(pembayaranTable).where(eq(pembayaranTable.id, params.data.id));

  res.json({ message: "Pembayaran berhasil dihapus." });
});

export default router;
