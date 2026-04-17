import { Router, type IRouter } from "express";
import { db, pekerjaTable, upahPekerjaTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import {
  CreatePekerjaBody,
  UpdatePekerjaParams,
  UpdatePekerjaBody,
  DeletePekerjaParams,
  GetPekerjaParams,
} from "@workspace/api-zod";
import { requireAuth, requireLicense } from "../middlewares/auth";

const router: IRouter = Router();

function formatPekerja(p: typeof pekerjaTable.$inferSelect) {
  return {
    id: p.id,
    usaha_id: p.usahaId,
    nama: p.nama,
    telepon: p.telepon ?? null,
    jabatan: p.jabatan ?? null,
    catatan: p.catatan ?? null,
    created_at: p.createdAt.toISOString(),
  };
}

router.get("/pekerja", requireAuth, async (req, res): Promise<void> => {
  const usahaId = req.session.usahaId;
  if (!usahaId) {
    res.status(403).json({ error: "Akses ditolak." });
    return;
  }

  const list = await db.select().from(pekerjaTable)
    .where(eq(pekerjaTable.usahaId, usahaId))
    .orderBy(pekerjaTable.nama);

  res.json(list.map(formatPekerja));
});

router.post("/pekerja", requireAuth, requireLicense, async (req, res): Promise<void> => {
  const usahaId = req.session.usahaId;
  if (!usahaId) {
    res.status(403).json({ error: "Akses ditolak." });
    return;
  }

  const parsed = CreatePekerjaBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [pekerja] = await db.insert(pekerjaTable).values({
    usahaId,
    nama: parsed.data.nama,
    telepon: parsed.data.telepon ?? null,
    jabatan: parsed.data.jabatan ?? null,
    catatan: parsed.data.catatan ?? null,
  }).returning();

  res.status(201).json(formatPekerja(pekerja));
});

router.get("/pekerja/:id", requireAuth, async (req, res): Promise<void> => {
  const usahaId = req.session.usahaId;
  if (!usahaId) {
    res.status(403).json({ error: "Akses ditolak." });
    return;
  }

  const params = GetPekerjaParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "ID tidak valid." });
    return;
  }

  const [pekerja] = await db.select().from(pekerjaTable)
    .where(and(eq(pekerjaTable.id, params.data.id), eq(pekerjaTable.usahaId, usahaId)));

  if (!pekerja) {
    res.status(404).json({ error: "Pekerja tidak ditemukan." });
    return;
  }

  res.json(formatPekerja(pekerja));
});

router.put("/pekerja/:id", requireAuth, requireLicense, async (req, res): Promise<void> => {
  const usahaId = req.session.usahaId;
  if (!usahaId) {
    res.status(403).json({ error: "Akses ditolak." });
    return;
  }

  const params = UpdatePekerjaParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "ID tidak valid." });
    return;
  }

  const parsed = UpdatePekerjaBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [existing] = await db.select().from(pekerjaTable)
    .where(and(eq(pekerjaTable.id, params.data.id), eq(pekerjaTable.usahaId, usahaId)));

  if (!existing) {
    res.status(404).json({ error: "Pekerja tidak ditemukan." });
    return;
  }

  const updateData: Partial<typeof pekerjaTable.$inferInsert> = {};
  if (parsed.data.nama !== undefined) updateData.nama = parsed.data.nama;
  if (parsed.data.telepon !== undefined) updateData.telepon = parsed.data.telepon ?? null;
  if (parsed.data.jabatan !== undefined) updateData.jabatan = parsed.data.jabatan ?? null;
  if (parsed.data.catatan !== undefined) updateData.catatan = parsed.data.catatan ?? null;

  await db.update(pekerjaTable).set(updateData).where(eq(pekerjaTable.id, params.data.id));

  const [updated] = await db.select().from(pekerjaTable).where(eq(pekerjaTable.id, params.data.id));

  res.json(formatPekerja(updated));
});

router.delete("/pekerja/:id", requireAuth, requireLicense, async (req, res): Promise<void> => {
  const usahaId = req.session.usahaId;
  if (!usahaId) {
    res.status(403).json({ error: "Akses ditolak." });
    return;
  }

  const params = DeletePekerjaParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "ID tidak valid." });
    return;
  }

  const [existing] = await db.select().from(pekerjaTable)
    .where(and(eq(pekerjaTable.id, params.data.id), eq(pekerjaTable.usahaId, usahaId)));

  if (!existing) {
    res.status(404).json({ error: "Pekerja tidak ditemukan." });
    return;
  }

  const upahList = await db.select({ id: upahPekerjaTable.id }).from(upahPekerjaTable)
    .where(eq(upahPekerjaTable.pekerjaid, params.data.id));

  if (upahList.length > 0) {
    res.status(400).json({ error: "Pekerja tidak bisa dihapus karena masih memiliki catatan upah. Hapus catatan upah terlebih dahulu." });
    return;
  }

  await db.delete(pekerjaTable).where(eq(pekerjaTable.id, params.data.id));

  res.json({ message: "Pekerja berhasil dihapus." });
});

export default router;
