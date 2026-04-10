import { Router, type IRouter } from "express";
import { db, pelangganTable, hutangTable, pembayaranTable } from "@workspace/db";
import { eq, and, desc, asc } from "drizzle-orm";
import {
  CreatePelangganBody,
  GetPelangganParams,
  UpdatePelangganParams,
  UpdatePelangganBody,
  DeletePelangganParams,
} from "@workspace/api-zod";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

function toTitleCase(str: string): string {
  return str.trim().split(/\s+/).map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(" ");
}

function formatPelanggan(p: typeof pelangganTable.$inferSelect) {
  return {
    id: p.id,
    usaha_id: p.usahaId,
    nama: p.nama,
    telepon: p.telepon ?? null,
    alamat: p.alamat ?? null,
    catatan: p.catatan ?? null,
    created_at: p.createdAt.toISOString(),
  };
}

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

function formatPembayaran(p: typeof pembayaranTable.$inferSelect, pelangganNama: string) {
  return {
    id: p.id,
    usaha_id: p.usahaId,
    hutang_id: p.hutangId,
    pelanggan_id: p.pelangganId,
    pelanggan_nama: pelangganNama,
    tanggal_bayar: p.tanggalBayar,
    nominal_bayar: parseFloat(p.nominalBayar),
    catatan: p.catatan ?? null,
    created_at: p.createdAt.toISOString(),
  };
}

router.get("/pelanggan", requireAuth, async (req, res): Promise<void> => {
  const usahaId = req.session.usahaId;
  if (!usahaId) {
    res.status(403).json({ error: "Akses ditolak." });
    return;
  }

  const list = await db.select().from(pelangganTable).where(eq(pelangganTable.usahaId, usahaId)).orderBy(asc(pelangganTable.nama), asc(pelangganTable.id));
  res.json(list.map(formatPelanggan));
});

router.post("/pelanggan", requireAuth, async (req, res): Promise<void> => {
  const usahaId = req.session.usahaId;
  if (!usahaId) {
    res.status(403).json({ error: "Akses ditolak." });
    return;
  }

  const parsed = CreatePelangganBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [pelanggan] = await db.insert(pelangganTable).values({
    usahaId,
    nama: toTitleCase(parsed.data.nama),
    telepon: parsed.data.telepon ?? null,
    alamat: parsed.data.alamat ?? null,
    catatan: parsed.data.catatan ?? null,
  }).returning();

  res.status(201).json(formatPelanggan(pelanggan));
});

router.get("/pelanggan/:id", requireAuth, async (req, res): Promise<void> => {
  const usahaId = req.session.usahaId;
  if (!usahaId) {
    res.status(403).json({ error: "Akses ditolak." });
    return;
  }

  const params = GetPelangganParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "ID tidak valid." });
    return;
  }

  const [pelanggan] = await db.select().from(pelangganTable)
    .where(and(eq(pelangganTable.id, params.data.id), eq(pelangganTable.usahaId, usahaId)));

  if (!pelanggan) {
    res.status(404).json({ error: "Pelanggan tidak ditemukan." });
    return;
  }

  const hutangList = await db.select().from(hutangTable)
    .where(and(eq(hutangTable.pelangganId, params.data.id), eq(hutangTable.usahaId, usahaId)))
    .orderBy(desc(hutangTable.tanggalHutang), desc(hutangTable.id));

  const pembayaranList = await db.select().from(pembayaranTable)
    .where(and(eq(pembayaranTable.pelangganId, params.data.id), eq(pembayaranTable.usahaId, usahaId)))
    .orderBy(desc(pembayaranTable.tanggalBayar), desc(pembayaranTable.id));

  const totalHutang = hutangList.reduce((sum, h) => sum + parseFloat(h.nominalHutang), 0);
  const totalDibayar = hutangList.reduce((sum, h) => sum + parseFloat(h.totalDibayar), 0);
  const sisaHutang = totalHutang - totalDibayar;

  res.json({
    ...formatPelanggan(pelanggan),
    hutang_list: hutangList.map((h) => formatHutang(h, pelanggan.nama)),
    pembayaran_list: pembayaranList.map((p) => formatPembayaran(p, pelanggan.nama)),
    total_hutang: totalHutang,
    total_dibayar: totalDibayar,
    sisa_hutang: sisaHutang,
  });
});

router.put("/pelanggan/:id", requireAuth, async (req, res): Promise<void> => {
  const usahaId = req.session.usahaId;
  if (!usahaId) {
    res.status(403).json({ error: "Akses ditolak." });
    return;
  }

  const params = UpdatePelangganParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "ID tidak valid." });
    return;
  }

  const parsed = UpdatePelangganBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [pelanggan] = await db.update(pelangganTable)
    .set({
      nama: toTitleCase(parsed.data.nama),
      telepon: parsed.data.telepon ?? null,
      alamat: parsed.data.alamat ?? null,
      catatan: parsed.data.catatan ?? null,
    })
    .where(and(eq(pelangganTable.id, params.data.id), eq(pelangganTable.usahaId, usahaId)))
    .returning();

  if (!pelanggan) {
    res.status(404).json({ error: "Pelanggan tidak ditemukan." });
    return;
  }

  res.json(formatPelanggan(pelanggan));
});

router.delete("/pelanggan/:id", requireAuth, async (req, res): Promise<void> => {
  const usahaId = req.session.usahaId;
  if (!usahaId) {
    res.status(403).json({ error: "Akses ditolak." });
    return;
  }

  const params = DeletePelangganParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "ID tidak valid." });
    return;
  }

  const [existing] = await db.select().from(pelangganTable)
    .where(and(eq(pelangganTable.id, params.data.id), eq(pelangganTable.usahaId, usahaId)));

  if (!existing) {
    res.status(404).json({ error: "Pelanggan tidak ditemukan." });
    return;
  }

  const hutangCheck = await db.select({ id: hutangTable.id, status: hutangTable.status })
    .from(hutangTable)
    .where(and(eq(hutangTable.pelangganId, params.data.id), eq(hutangTable.usahaId, usahaId)));

  if (hutangCheck.length > 0) {
    const aktif = hutangCheck.filter((h) => h.status === "aktif").length;
    if (aktif > 0) {
      res.status(400).json({
        error: `Pelanggan ini masih memiliki ${aktif} hutang aktif. Selesaikan atau hapus semua hutang terlebih dahulu.`,
      });
    } else {
      res.status(400).json({
        error: `Pelanggan ini memiliki ${hutangCheck.length} riwayat hutang yang sudah lunas. Hapus semua hutang terlebih dahulu sebelum menghapus pelanggan.`,
      });
    }
    return;
  }

  await db.delete(pelangganTable)
    .where(and(eq(pelangganTable.id, params.data.id), eq(pelangganTable.usahaId, usahaId)));

  res.json({ message: "Pelanggan berhasil dihapus." });
});

export default router;
