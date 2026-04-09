import { Router, type IRouter } from "express";
import { db, hutangTable, pelangganTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import {
  CreateHutangBody,
  GetHutangListQueryParams,
  GetHutangParams,
  UpdateHutangParams,
  UpdateHutangBody,
  DeleteHutangParams,
} from "@workspace/api-zod";
import { pembayaranTable } from "@workspace/db";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

function formatHutang(h: typeof hutangTable.$inferSelect, pelangganNama: string) {
  return {
    id: h.id,
    usaha_id: h.usahaId,
    pelanggan_id: h.pelangganId,
    pelanggan_nama: pelangganNama,
    tanggal_hutang: h.tanggalHutang,
    keterangan: h.keterangan ?? null,
    nominal_hutang: parseFloat(h.nominalHutang),
    total_dibayar: parseFloat(h.totalDibayar),
    sisa_hutang: parseFloat(h.sisaHutang),
    status: h.status,
    created_at: h.createdAt.toISOString(),
    updated_at: h.updatedAt.toISOString(),
  };
}

router.get("/hutang", requireAuth, async (req, res): Promise<void> => {
  const usahaId = req.session.usahaId;
  if (!usahaId) {
    res.status(403).json({ error: "Akses ditolak." });
    return;
  }

  const queryParams = GetHutangListQueryParams.safeParse(req.query);

  const conditions = [eq(hutangTable.usahaId, usahaId)];

  if (queryParams.success) {
    if (queryParams.data.pelanggan_id) {
      conditions.push(eq(hutangTable.pelangganId, queryParams.data.pelanggan_id));
    }
    if (queryParams.data.status) {
      conditions.push(eq(hutangTable.status, queryParams.data.status));
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

  res.json(hutangList.map(({ hutang: h, pelangganNama }) => formatHutang(h, pelangganNama ?? "")));
});

router.post("/hutang", requireAuth, async (req, res): Promise<void> => {
  const usahaId = req.session.usahaId;
  if (!usahaId) {
    res.status(403).json({ error: "Akses ditolak." });
    return;
  }

  const parsed = CreateHutangBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  if (parsed.data.nominal_hutang <= 0) {
    res.status(400).json({ error: "Nominal hutang harus lebih dari 0." });
    return;
  }

  const [pelanggan] = await db.select().from(pelangganTable)
    .where(and(eq(pelangganTable.id, parsed.data.pelanggan_id), eq(pelangganTable.usahaId, usahaId)));

  if (!pelanggan) {
    res.status(404).json({ error: "Pelanggan tidak ditemukan." });
    return;
  }

  const nominalStr = parsed.data.nominal_hutang.toString();
  const [hutang] = await db.insert(hutangTable).values({
    usahaId,
    pelangganId: parsed.data.pelanggan_id,
    tanggalHutang: parsed.data.tanggal_hutang,
    keterangan: parsed.data.keterangan ?? null,
    nominalHutang: nominalStr,
    totalDibayar: "0",
    sisaHutang: nominalStr,
    status: "aktif",
  }).returning();

  res.status(201).json(formatHutang(hutang, pelanggan.nama));
});

router.get("/hutang/:id", requireAuth, async (req, res): Promise<void> => {
  const usahaId = req.session.usahaId;
  if (!usahaId) {
    res.status(403).json({ error: "Akses ditolak." });
    return;
  }

  const params = GetHutangParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "ID tidak valid." });
    return;
  }

  const [row] = await db.select({
    hutang: hutangTable,
    pelangganNama: pelangganTable.nama,
  })
    .from(hutangTable)
    .leftJoin(pelangganTable, eq(hutangTable.pelangganId, pelangganTable.id))
    .where(and(eq(hutangTable.id, params.data.id), eq(hutangTable.usahaId, usahaId)));

  if (!row) {
    res.status(404).json({ error: "Hutang tidak ditemukan." });
    return;
  }

  const pembayaranList = await db.select().from(pembayaranTable)
    .where(and(eq(pembayaranTable.hutangId, params.data.id), eq(pembayaranTable.usahaId, usahaId)))
    .orderBy(pembayaranTable.tanggalBayar);

  const formatted = formatHutang(row.hutang, row.pelangganNama ?? "");

  res.json({
    ...formatted,
    pembayaran_list: pembayaranList.map((p) => ({
      id: p.id,
      usaha_id: p.usahaId,
      hutang_id: p.hutangId,
      pelanggan_id: p.pelangganId,
      pelanggan_nama: row.pelangganNama ?? "",
      tanggal_bayar: p.tanggalBayar,
      nominal_bayar: parseFloat(p.nominalBayar),
      catatan: p.catatan ?? null,
      created_at: p.createdAt.toISOString(),
    })),
  });
});

router.put("/hutang/:id", requireAuth, async (req, res): Promise<void> => {
  const usahaId = req.session.usahaId;
  if (!usahaId) {
    res.status(403).json({ error: "Akses ditolak." });
    return;
  }

  const params = UpdateHutangParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "ID tidak valid." });
    return;
  }

  const parsed = UpdateHutangBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [existing] = await db.select().from(hutangTable)
    .where(and(eq(hutangTable.id, params.data.id), eq(hutangTable.usahaId, usahaId)));

  if (!existing) {
    res.status(404).json({ error: "Hutang tidak ditemukan." });
    return;
  }

  const updateData: Partial<typeof hutangTable.$inferInsert> = {};
  if (parsed.data.tanggal_hutang) updateData.tanggalHutang = parsed.data.tanggal_hutang;
  if (parsed.data.keterangan !== undefined) updateData.keterangan = parsed.data.keterangan ?? null;
  if (parsed.data.nominal_hutang !== undefined) {
    if (parsed.data.nominal_hutang <= 0) {
      res.status(400).json({ error: "Nominal hutang harus lebih dari 0." });
      return;
    }
    const nominal = parsed.data.nominal_hutang;
    const totalDibayar = parseFloat(existing.totalDibayar);
    const sisa = nominal - totalDibayar;
    updateData.nominalHutang = nominal.toString();
    updateData.sisaHutang = Math.max(0, sisa).toString();
    updateData.status = sisa <= 0 ? "lunas" : "aktif";
  }
  updateData.updatedAt = new Date();

  const [row] = await db.select({
    hutang: hutangTable,
    pelangganNama: pelangganTable.nama,
  })
    .from(hutangTable)
    .leftJoin(pelangganTable, eq(hutangTable.pelangganId, pelangganTable.id))
    .where(and(eq(hutangTable.id, params.data.id), eq(hutangTable.usahaId, usahaId)));

  await db.update(hutangTable).set(updateData).where(eq(hutangTable.id, params.data.id));

  const [updated] = await db.select({
    hutang: hutangTable,
    pelangganNama: pelangganTable.nama,
  })
    .from(hutangTable)
    .leftJoin(pelangganTable, eq(hutangTable.pelangganId, pelangganTable.id))
    .where(eq(hutangTable.id, params.data.id));

  res.json(formatHutang(updated.hutang, updated.pelangganNama ?? ""));
});

router.delete("/hutang/:id", requireAuth, async (req, res): Promise<void> => {
  const usahaId = req.session.usahaId;
  if (!usahaId) {
    res.status(403).json({ error: "Akses ditolak." });
    return;
  }

  const params = DeleteHutangParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "ID tidak valid." });
    return;
  }

  const [hutang] = await db.delete(hutangTable)
    .where(and(eq(hutangTable.id, params.data.id), eq(hutangTable.usahaId, usahaId)))
    .returning();

  if (!hutang) {
    res.status(404).json({ error: "Hutang tidak ditemukan." });
    return;
  }

  res.json({ message: "Hutang berhasil dihapus." });
});

export default router;
