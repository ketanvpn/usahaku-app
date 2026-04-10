import { Router, type IRouter } from "express";
import { db, hutangTable, pelangganTable, pembayaranTable, usahaTable, usersTable } from "@workspace/db";
import { eq, and, count, sum, desc, sql } from "drizzle-orm";
import { requireAuth, requireSuperAdmin } from "../middlewares/auth";

const router: IRouter = Router();

router.get("/dashboard/owner", requireAuth, async (req, res): Promise<void> => {
  const usahaId = req.session.usahaId;
  if (!usahaId) {
    res.status(403).json({ error: "Akses ditolak." });
    return;
  }

  const hutangList = await db.select().from(hutangTable).where(eq(hutangTable.usahaId, usahaId));

  const totalHutang = hutangList.reduce((s, h) => s + parseFloat(h.nominalHutang), 0);
  const totalDibayar = hutangList.reduce((s, h) => s + parseFloat(h.totalDibayar), 0);
  const sisaHutang = totalHutang - totalDibayar;
  const aktif = hutangList.filter((h) => h.status === "aktif");
  const lunas = hutangList.filter((h) => h.status === "lunas");

  const pelangganBerhutang = new Set(aktif.map((h) => h.pelangganId)).size;

  const pembayaranTerbaru = await db.select({
    pembayaran: pembayaranTable,
    pelangganNama: pelangganTable.nama,
  })
    .from(pembayaranTable)
    .leftJoin(pelangganTable, eq(pembayaranTable.pelangganId, pelangganTable.id))
    .where(eq(pembayaranTable.usahaId, usahaId))
    .orderBy(desc(pembayaranTable.createdAt))
    .limit(5);

  const hutangTerbesar = await db.select({
    hutang: hutangTable,
    pelangganNama: pelangganTable.nama,
  })
    .from(hutangTable)
    .leftJoin(pelangganTable, eq(hutangTable.pelangganId, pelangganTable.id))
    .where(and(eq(hutangTable.usahaId, usahaId), eq(hutangTable.status, "aktif")))
    .orderBy(desc(sql`CAST(${hutangTable.sisaHutang} AS REAL)`))
    .limit(5);

  res.json({
    total_hutang: totalHutang,
    total_dibayar: totalDibayar,
    sisa_hutang: sisaHutang,
    jumlah_pelanggan_berhutang: pelangganBerhutang,
    jumlah_hutang_aktif: aktif.length,
    jumlah_hutang_lunas: lunas.length,
    pembayaran_terbaru: pembayaranTerbaru.map(({ pembayaran: p, pelangganNama }) => ({
      id: p.id,
      usaha_id: p.usahaId,
      hutang_id: p.hutangId,
      pelanggan_id: p.pelangganId,
      pelanggan_nama: pelangganNama ?? "",
      tanggal_bayar: p.tanggalBayar,
      nominal_bayar: parseFloat(p.nominalBayar),
      catatan: p.catatan ?? null,
      created_at: p.createdAt.toISOString(),
    })),
    hutang_terbesar: hutangTerbesar.map(({ hutang: h, pelangganNama }) => ({
      id: h.id,
      usaha_id: h.usahaId,
      pelanggan_id: h.pelangganId,
      pelanggan_nama: pelangganNama ?? "",
      tanggal_hutang: h.tanggalHutang,
      keterangan: h.keterangan ?? null,
      nominal_hutang: parseFloat(h.nominalHutang),
      total_dibayar: parseFloat(h.totalDibayar),
      sisa_hutang: parseFloat(h.sisaHutang),
      status: h.status,
      created_at: h.createdAt.toISOString(),
      updated_at: h.updatedAt.toISOString(),
    })),
  });
});

router.get("/dashboard/admin", requireSuperAdmin, async (_req, res): Promise<void> => {
  const allUsaha = await db.select().from(usahaTable).orderBy(desc(usahaTable.createdAt));
  const allOwners = await db.select().from(usersTable).where(eq(usersTable.role, "owner"));
  const activeOwners = allOwners.filter((u) => u.isActive);
  const allPelanggan = await db.select().from(pelangganTable);
  const allHutang = await db.select().from(hutangTable);

  const totalHutang = allHutang.reduce((s, h) => s + parseFloat(h.nominalHutang), 0);
  const totalDibayar = allHutang.reduce((s, h) => s + parseFloat(h.totalDibayar), 0);
  const totalSisaHutang = totalHutang - totalDibayar;

  const usahaHutangMap = new Map<number, { sisa: number; pelangganCount: number }>();
  for (const h of allHutang) {
    const curr = usahaHutangMap.get(h.usahaId) ?? { sisa: 0, pelangganCount: 0 };
    curr.sisa += parseFloat(h.sisaHutang);
    usahaHutangMap.set(h.usahaId, curr);
  }
  for (const p of allPelanggan) {
    const curr = usahaHutangMap.get(p.usahaId) ?? { sisa: 0, pelangganCount: 0 };
    curr.pelangganCount += 1;
    usahaHutangMap.set(p.usahaId, curr);
  }

  const usahaHutangTerbesar = allUsaha
    .map((u) => {
      const data = usahaHutangMap.get(u.id) ?? { sisa: 0, pelangganCount: 0 };
      return {
        id: u.id,
        nama_usaha: u.namaUsaha,
        sisa_hutang: data.sisa,
        jumlah_pelanggan: data.pelangganCount,
      };
    })
    .sort((a, b) => b.sisa_hutang - a.sisa_hutang)
    .slice(0, 5);

  res.json({
    jumlah_usaha: allUsaha.length,
    jumlah_owner_aktif: activeOwners.length,
    total_pelanggan: allPelanggan.length,
    total_hutang: totalHutang,
    total_dibayar: totalDibayar,
    total_sisa_hutang: totalSisaHutang,
    usaha_terbaru: allUsaha.slice(0, 5).map((u) => ({
      id: u.id,
      nama_usaha: u.namaUsaha,
      alamat: u.alamat ?? null,
      telepon: u.telepon ?? null,
      catatan: u.catatan ?? null,
      created_at: u.createdAt.toISOString(),
    })),
    usaha_hutang_terbesar: usahaHutangTerbesar,
  });
});

export default router;
