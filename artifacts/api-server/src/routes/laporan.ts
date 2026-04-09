import { Router, type IRouter } from "express";
import { db, hutangTable, pelangganTable } from "@workspace/db";
import { eq, and, gte, lte } from "drizzle-orm";
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

export default router;
