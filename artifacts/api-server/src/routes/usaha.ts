import { Router, type IRouter } from "express";
import { db, usahaTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { CreateUsahaBody, GetUsahaParams, UpdateUsahaParams, UpdateUsahaBody } from "@workspace/api-zod";
import { requireSuperAdmin } from "../middlewares/auth";

const router: IRouter = Router();

router.get("/usaha", requireSuperAdmin, async (_req, res): Promise<void> => {
  const list = await db.select().from(usahaTable).orderBy(usahaTable.createdAt);
  const result = list.map((u) => ({
    id: u.id,
    nama_usaha: u.namaUsaha,
    alamat: u.alamat ?? null,
    telepon: u.telepon ?? null,
    catatan: u.catatan ?? null,
    created_at: u.createdAt.toISOString(),
  }));
  res.json(result);
});

router.post("/usaha", requireSuperAdmin, async (req, res): Promise<void> => {
  const parsed = CreateUsahaBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [usaha] = await db.insert(usahaTable).values({
    namaUsaha: parsed.data.nama_usaha,
    alamat: parsed.data.alamat ?? null,
    telepon: parsed.data.telepon ?? null,
    catatan: parsed.data.catatan ?? null,
  }).returning();

  res.status(201).json({
    id: usaha.id,
    nama_usaha: usaha.namaUsaha,
    alamat: usaha.alamat ?? null,
    telepon: usaha.telepon ?? null,
    catatan: usaha.catatan ?? null,
    created_at: usaha.createdAt.toISOString(),
  });
});

router.get("/usaha/:id", requireSuperAdmin, async (req, res): Promise<void> => {
  const params = GetUsahaParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "ID tidak valid." });
    return;
  }

  const [usaha] = await db.select().from(usahaTable).where(eq(usahaTable.id, params.data.id));
  if (!usaha) {
    res.status(404).json({ error: "Usaha tidak ditemukan." });
    return;
  }

  res.json({
    id: usaha.id,
    nama_usaha: usaha.namaUsaha,
    alamat: usaha.alamat ?? null,
    telepon: usaha.telepon ?? null,
    catatan: usaha.catatan ?? null,
    created_at: usaha.createdAt.toISOString(),
  });
});

router.put("/usaha/:id", requireSuperAdmin, async (req, res): Promise<void> => {
  const params = UpdateUsahaParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "ID tidak valid." });
    return;
  }

  const parsed = UpdateUsahaBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [usaha] = await db.update(usahaTable)
    .set({
      namaUsaha: parsed.data.nama_usaha,
      alamat: parsed.data.alamat ?? null,
      telepon: parsed.data.telepon ?? null,
      catatan: parsed.data.catatan ?? null,
    })
    .where(eq(usahaTable.id, params.data.id))
    .returning();

  if (!usaha) {
    res.status(404).json({ error: "Usaha tidak ditemukan." });
    return;
  }

  res.json({
    id: usaha.id,
    nama_usaha: usaha.namaUsaha,
    alamat: usaha.alamat ?? null,
    telepon: usaha.telepon ?? null,
    catatan: usaha.catatan ?? null,
    created_at: usaha.createdAt.toISOString(),
  });
});

export default router;
