import { Router, type IRouter } from "express";
import { db, pekerjaTable, upahPekerjaTable, bayarUpahTable, keuanganTable, pelangganTable, hutangTable, pembayaranTable } from "@workspace/db";
import { eq, and, asc, inArray } from "drizzle-orm";
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
    pelanggan_id: p.pelangganId ?? null,
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

  if (parsed.data.pelanggan_id !== undefined && parsed.data.pelanggan_id !== null) {
    const [pelanggan] = await db.select().from(pelangganTable)
      .where(and(eq(pelangganTable.id, parsed.data.pelanggan_id), eq(pelangganTable.usahaId, usahaId)));

    if (!pelanggan) {
      res.status(404).json({ error: "Pelanggan tidak ditemukan." });
      return;
    }
  }

  const [pekerja] = await db.insert(pekerjaTable).values({
    usahaId,
    pelangganId: parsed.data.pelanggan_id ?? null,
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
  if (parsed.data.pelanggan_id !== undefined) {
    if (parsed.data.pelanggan_id === null) {
      updateData.pelangganId = null;
    } else {
      const [pelanggan] = await db.select().from(pelangganTable)
        .where(and(eq(pelangganTable.id, parsed.data.pelanggan_id), eq(pelangganTable.usahaId, usahaId)));

      if (!pelanggan) {
        res.status(404).json({ error: "Pelanggan tidak ditemukan." });
        return;
      }

      updateData.pelangganId = parsed.data.pelanggan_id;
    }
  }
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
  const potongHutang = Math.max(0, parsed.data.potong_hutang ?? 0);

  if (jumlahBayar <= 0) {
    res.status(400).json({ error: "Jumlah bayar harus lebih dari 0." });
    return;
  }

  if (jumlahBayar > totalSisa + 0.01) {
    res.status(400).json({ error: `Jumlah bayar melebihi total sisa upah (Rp ${totalSisa.toLocaleString("id")}).` });
    return;
  }

  if (potongHutang > jumlahBayar) {
    res.status(400).json({ error: "Potongan hutang tidak boleh melebihi jumlah bayar." });
    return;
  }

  let targetHutangs: typeof hutangTable.$inferSelect[] = [];
  if (potongHutang > 0) {
    if (!pekerja.pelangganId) {
      res.status(400).json({ error: "Pekerja belum dihubungkan ke pelanggan. Hubungkan dulu di Gaji & Tenaga." });
      return;
    }

    const selectedHutangIds = Array.from(new Set((parsed.data.hutang_ids ?? []).filter((id) => Number.isInteger(id) && id > 0)));

    if (selectedHutangIds.length > 0) {
      targetHutangs = await db.select().from(hutangTable)
        .where(and(
          eq(hutangTable.pelangganId, pekerja.pelangganId),
          eq(hutangTable.usahaId, usahaId),
          eq(hutangTable.status, "aktif"),
          inArray(hutangTable.id, selectedHutangIds),
        ))
        .orderBy(asc(hutangTable.tanggalHutang), asc(hutangTable.id));

      if (targetHutangs.length !== selectedHutangIds.length) {
        res.status(400).json({ error: "Satu atau lebih hutang terpilih tidak valid atau sudah lunas." });
        return;
      }
    } else {
      const [hutang] = await db.select().from(hutangTable)
        .where(and(eq(hutangTable.pelangganId, pekerja.pelangganId), eq(hutangTable.usahaId, usahaId), eq(hutangTable.status, "aktif")))
        .orderBy(asc(hutangTable.tanggalHutang), asc(hutangTable.id));

      if (!hutang) {
        res.status(400).json({ error: "Pelanggan ini tidak punya hutang aktif untuk dipotong." });
        return;
      }

      targetHutangs = [hutang];
    }

    const totalSisaHutang = targetHutangs.reduce((sum, hutang) => sum + parseFloat(hutang.sisaHutang), 0);
    if (potongHutang > totalSisaHutang) {
      res.status(400).json({ error: `Potongan hutang (${potongHutang}) melebihi sisa hutang terpilih (${totalSisaHutang}).` });
      return;
    }
  }

  type Distribusi = { upah: typeof upahPekerjaTable.$inferSelect; alokasi: number; statusBaru: "lunas" | "belum_lunas" };
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
    ? `Bayar upah batch - ${pekerja.nama} (${parsed.data.catatan})${potongHutang > 0 ? ` | potong hutang Rp ${potongHutang.toLocaleString("id")}` : ""}`
    : `Bayar upah batch - ${pekerja.nama}${potongHutang > 0 ? ` | potong hutang Rp ${potongHutang.toLocaleString("id")}` : ""}`;

  const jumlahKeuangan = Math.max(0, jumlahBayar - potongHutang);

  let jumlahUpahLunas = 0;

  db.transaction((tx) => {
    let keuanganId: number | null = null;

    if (jumlahKeuangan > 0) {
      const [keuangan] = tx.insert(keuanganTable).values({
        usahaId,
        tanggal: parsed.data.tanggal_bayar,
        tipe: "keluar",
        kategori: "Gaji & Upah",
        keterangan: keteranganKeuangan,
        jumlah: jumlahKeuangan.toString(),
      }).returning().all();
      keuanganId = keuangan.id;
    }

    const groupKey = keuanganId ?? -(Date.now() + Math.floor(Math.random() * 1000));
    let pembayaranId: number | null = null;

    if (potongHutang > 0 && targetHutangs.length > 0) {
      let sisaPotong = potongHutang;

      for (const hutang of targetHutangs) {
        if (sisaPotong <= 0) break;

        const sisaHutang = parseFloat(hutang.sisaHutang);
        const nominalBayar = Math.min(sisaPotong, sisaHutang);
        if (nominalBayar <= 0) continue;

        const sisaHutangSetelah = Math.max(0, sisaHutang - nominalBayar);
        const totalDibayarHutangBaru = parseFloat(hutang.totalDibayar) + nominalBayar;
        const statusHutangBaru = sisaHutangSetelah <= 0 ? "lunas" : "aktif";

        const [pembayaran] = tx.insert(pembayaranTable).values({
          usahaId,
          hutangId: hutang.id,
          pelangganId: hutang.pelangganId,
          tanggalBayar: parsed.data.tanggal_bayar,
          nominalBayar: nominalBayar.toString(),
          catatan: `Potong gaji batch ${pekerja.nama}${parsed.data.catatan ? ` - ${parsed.data.catatan}` : ""}`,
          nomorKwitansi: null,
          sisaHutangSetelah: sisaHutangSetelah.toString(),
          keuanganId: groupKey,
        }).returning().all();

        if (pembayaranId === null) {
          pembayaranId = pembayaran.id;
        }

        tx.update(hutangTable).set({
          totalDibayar: totalDibayarHutangBaru.toString(),
          sisaHutang: sisaHutangSetelah.toString(),
          status: statusHutangBaru,
          updatedAt: new Date(),
        }).where(eq(hutangTable.id, hutang.id)).run();

        sisaPotong -= nominalBayar;
      }
    }

    for (const d of distribusi) {
      tx.insert(bayarUpahTable).values({
        usahaId,
        upahId: d.upah.id,
        jumlah: d.alokasi.toString(),
        tanggalBayar: parsed.data.tanggal_bayar,
        keuanganId: groupKey,
        pembayaranId,
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
