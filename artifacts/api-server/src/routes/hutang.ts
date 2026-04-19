import { Router, type IRouter } from "express";
import { db, hutangTable, pelangganTable, pembayaranTable, keuanganTable } from "@workspace/db";
import { eq, and, desc, asc, inArray } from "drizzle-orm";
import {
  CreateHutangBody,
  GetHutangListQueryParams,
  GetHutangParams,
  UpdateHutangParams,
  UpdateHutangBody,
  DeleteHutangParams,
} from "@workspace/api-zod";
import { requireAuth, requireLicense } from "../middlewares/auth";

const router: IRouter = Router();

function formatHutang(h: typeof hutangTable.$inferSelect, pelangganNama: string) {
  return {
    id: h.id,
    usaha_id: h.usahaId,
    pelanggan_id: h.pelangganId,
    pelanggan_nama: pelangganNama,
    tanggal_hutang: h.tanggalHutang,
    tanggal_jatuh_tempo: h.tanggalJatuhTempo ?? null,
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
    .orderBy(desc(hutangTable.tanggalHutang), desc(hutangTable.id));

  res.json(hutangList.map(({ hutang: h, pelangganNama }) => formatHutang(h, pelangganNama ?? "")));
});

router.post("/hutang", requireAuth, requireLicense, async (req, res): Promise<void> => {
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
  const keterangan = parsed.data.keterangan
    ? `Hutang - ${pelanggan.nama} - ${parsed.data.keterangan}`
    : `Hutang - ${pelanggan.nama}`;

  const hutang = db.transaction((tx) => {
    const [keuangan] = tx.insert(keuanganTable).values({
      usahaId,
      tanggal: parsed.data.tanggal_hutang,
      tipe: "keluar",
      kategori: "Hutang",
      keterangan,
      jumlah: nominalStr,
    }).returning();

    const [h] = tx.insert(hutangTable).values({
      usahaId,
      pelangganId: parsed.data.pelanggan_id,
      tanggalHutang: parsed.data.tanggal_hutang,
      tanggalJatuhTempo: parsed.data.tanggal_jatuh_tempo ?? null,
      keterangan: parsed.data.keterangan ?? null,
      nominalHutang: nominalStr,
      totalDibayar: "0",
      sisaHutang: nominalStr,
      status: "aktif",
      keuanganId: keuangan.id,
    }).returning();

    return h;
  });

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
    .orderBy(asc(pembayaranTable.tanggalBayar), asc(pembayaranTable.id));

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

router.put("/hutang/:id", requireAuth, requireLicense, async (req, res): Promise<void> => {
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
  if (parsed.data.tanggal_jatuh_tempo !== undefined) updateData.tanggalJatuhTempo = parsed.data.tanggal_jatuh_tempo ?? null;
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

  const [pelangganRow] = await db.select({ nama: pelangganTable.nama })
    .from(pelangganTable)
    .where(eq(pelangganTable.id, existing.pelangganId));

  const pelangganNama = pelangganRow?.nama ?? "";

  db.transaction((tx) => {
    tx.update(hutangTable).set(updateData).where(eq(hutangTable.id, params.data.id)).run();

    if (existing.keuanganId) {
      const keuanganUpdateData: Record<string, unknown> = {};
      if (updateData.tanggalHutang) keuanganUpdateData.tanggal = updateData.tanggalHutang;
      if (updateData.nominalHutang) keuanganUpdateData.jumlah = updateData.nominalHutang;
      if (updateData.keterangan !== undefined || updateData.nominalHutang) {
        const ket = updateData.keterangan ?? existing.keterangan;
        keuanganUpdateData.keterangan = ket
          ? `Hutang - ${pelangganNama} - ${ket}`
          : `Hutang - ${pelangganNama}`;
      }
      if (Object.keys(keuanganUpdateData).length > 0) {
        tx.update(keuanganTable).set(keuanganUpdateData).where(eq(keuanganTable.id, existing.keuanganId)).run();
      }
    }
  });

  const [updated] = await db.select({
    hutang: hutangTable,
    pelangganNama: pelangganTable.nama,
  })
    .from(hutangTable)
    .leftJoin(pelangganTable, eq(hutangTable.pelangganId, pelangganTable.id))
    .where(eq(hutangTable.id, params.data.id));

  res.json(formatHutang(updated.hutang, updated.pelangganNama ?? ""));
});

router.delete("/hutang/:id", requireAuth, requireLicense, async (req, res): Promise<void> => {
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

  const [existing] = await db.select().from(hutangTable)
    .where(and(eq(hutangTable.id, params.data.id), eq(hutangTable.usahaId, usahaId)));

  if (!existing) {
    res.status(404).json({ error: "Hutang tidak ditemukan." });
    return;
  }

  // Ambil semua pembayaran terkait untuk cari keuangan yang harus ikut dihapus
  const pembayaranTerkait = await db.select({ id: pembayaranTable.id, keuanganId: pembayaranTable.keuanganId })
    .from(pembayaranTable)
    .where(eq(pembayaranTable.hutangId, params.data.id));

  const keuanganIds = pembayaranTerkait
    .map((p) => p.keuanganId)
    .filter((id): id is number => id !== null && id !== undefined);

  // Tambahkan keuangan_id dari hutang itu sendiri (entri uang keluar saat hutang dibuat)
  if (existing.keuanganId) {
    keuanganIds.push(existing.keuanganId);
  }

  // Hapus keuangan, pembayaran, dan hutang dalam satu transaction
  db.transaction((tx) => {
    if (keuanganIds.length > 0) {
      tx.delete(keuanganTable).where(inArray(keuanganTable.id, keuanganIds)).run();
    }
    tx.delete(pembayaranTable).where(eq(pembayaranTable.hutangId, params.data.id)).run();
    tx.delete(hutangTable).where(eq(hutangTable.id, params.data.id)).run();
  });

  res.json({ message: "Hutang berhasil dihapus." });
});

export default router;
