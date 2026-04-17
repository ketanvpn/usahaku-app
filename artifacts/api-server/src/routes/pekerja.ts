import { Router, type IRouter } from "express";
import { db, pekerjaTable, upahPekerjaTable, bayarUpahTable, keuanganTable } from "@workspace/db";
import { eq, and, asc } from "drizzle-orm";
import {
  CreatePekerjaBody,
  UpdatePekerjaParams,
  UpdatePekerjaBody,
  DeletePekerjaParams,
  GetPekerjaParams,
  BayarBatchUpahParams,
  BayarBatchUpahBody,
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

// ── POST /pekerja/:id/bayar-batch ────────────────────────────────────────────
router.post("/pekerja/:id/bayar-batch", requireAuth, requireLicense, async (req, res): Promise<void> => {
  const usahaId = req.session.usahaId;
  if (!usahaId) {
    res.status(403).json({ error: "Akses ditolak." });
    return;
  }

  const params = BayarBatchUpahParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "ID tidak valid." });
    return;
  }

  const parsed = BayarBatchUpahBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [pekerja] = await db.select().from(pekerjaTable)
    .where(and(eq(pekerjaTable.id, params.data.id), eq(pekerjaTable.usahaId, usahaId)));

  if (!pekerja) {
    res.status(404).json({ error: "Pekerja tidak ditemukan." });
    return;
  }

  const upahBelumLunas = await db.select().from(upahPekerjaTable)
    .where(and(
      eq(upahPekerjaTable.pekerjaid, params.data.id),
      eq(upahPekerjaTable.status, "belum_lunas"),
      eq(upahPekerjaTable.usahaId, usahaId),
    ))
    .orderBy(asc(upahPekerjaTable.tanggalKerja), asc(upahPekerjaTable.id));

  if (upahBelumLunas.length === 0) {
    res.status(400).json({ error: "Tidak ada catatan upah yang belum lunas." });
    return;
  }

  const totalSisa = upahBelumLunas.reduce((acc, u) => acc + parseFloat(u.sisaUpah), 0);
  const jumlahBayar = parsed.data.jumlah_total;

  if (jumlahBayar <= 0) {
    res.status(400).json({ error: "Jumlah bayar harus lebih dari 0." });
    return;
  }

  if (jumlahBayar > totalSisa + 0.01) {
    res.status(400).json({ error: `Jumlah bayar melebihi total sisa upah (Rp ${totalSisa.toLocaleString("id")}).` });
    return;
  }

  type Distribusi = { upah: typeof upahPekerjaTable.$inferSelect; alokasi: number; statusBaru: string };
  const distribusi: Distribusi[] = [];
  let sisa = jumlahBayar;

  for (const u of upahBelumLunas) {
    if (sisa <= 0) break;
    const alokasi = Math.min(sisa, parseFloat(u.sisaUpah));
    sisa -= alokasi;
    const totalDibayarBaru = parseFloat(u.totalDibayar) + alokasi;
    const sisaBaru = parseFloat(u.jumlahTotal) - totalDibayarBaru;
    const statusBaru = sisaBaru <= 0.01 ? "lunas" : "belum_lunas";
    distribusi.push({ upah: u, alokasi, statusBaru });
  }

  const keteranganKeuangan = parsed.data.catatan
    ? `Bayar upah batch - ${pekerja.nama} (${parsed.data.catatan})`
    : `Bayar upah batch - ${pekerja.nama}`;

  let jumlahUpahLunas = 0;

  db.transaction((tx) => {
    const [keuangan] = tx.insert(keuanganTable).values({
      usahaId,
      tanggal: parsed.data.tanggal_bayar,
      tipe: "keluar",
      kategori: "Gaji & Upah",
      keterangan: keteranganKeuangan,
      jumlah: jumlahBayar.toString(),
    }).returning().all();

    for (const d of distribusi) {
      tx.insert(bayarUpahTable).values({
        usahaId,
        upahId: d.upah.id,
        jumlah: d.alokasi.toString(),
        tanggalBayar: parsed.data.tanggal_bayar,
        keuanganId: keuangan.id,
        catatan: parsed.data.catatan ?? null,
      }).run();

      const totalDibayarBaru = parseFloat(d.upah.totalDibayar) + d.alokasi;
      const sisaBaru = parseFloat(d.upah.jumlahTotal) - totalDibayarBaru;

      tx.update(upahPekerjaTable).set({
        totalDibayar: totalDibayarBaru.toString(),
        sisaUpah: Math.max(0, sisaBaru).toString(),
        status: d.statusBaru,
        updatedAt: new Date(),
      }).where(eq(upahPekerjaTable.id, d.upah.id)).run();

      if (d.statusBaru === "lunas") jumlahUpahLunas++;
    }
  });

  res.status(201).json({
    message: `Berhasil membayar untuk ${pekerja.nama}. ${jumlahUpahLunas} catatan upah lunas.`,
    jumlah_dibayar: jumlahBayar,
    jumlah_upah_lunas: jumlahUpahLunas,
  });
});

export default router;
