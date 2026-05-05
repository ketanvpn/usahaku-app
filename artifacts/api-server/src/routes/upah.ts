import { Router, type IRouter } from "express";
import { db, upahPekerjaTable, bayarUpahTable, pekerjaTable, keuanganTable, hutangTable, pembayaranTable } from "@workspace/db";
import { eq, and, desc, asc, inArray, ne } from "drizzle-orm";
import {
  CreateUpahBody,
  GetUpahParams,
  UpdateUpahParams,
  UpdateUpahBody,
  DeleteUpahParams,
  GetUpahListQueryParams,
  CreateBayarUpahBody,
  DeleteBayarUpahParams,
} from "@workspace/api-zod";
import { requireAuth, requireLicense } from "../middlewares/auth";

const router: IRouter = Router();

function formatUpah(
  u: typeof upahPekerjaTable.$inferSelect,
  pekerjaNama: string,
  pekerjaJabatan: string | null,
) {
  return {
    id: u.id,
    usaha_id: u.usahaId,
    pekerja_id: u.pekerjaid,
    pekerja_nama: pekerjaNama,
    pekerja_jabatan: pekerjaJabatan ?? null,
    keterangan: u.keterangan,
    jumlah_total: parseFloat(u.jumlahTotal),
    total_dibayar: parseFloat(u.totalDibayar),
    sisa_upah: parseFloat(u.sisaUpah),
    tanggal_kerja: u.tanggalKerja,
    status: u.status,
    catatan: u.catatan ?? null,
    created_at: u.createdAt.toISOString(),
    updated_at: u.updatedAt.toISOString(),
  };
}

function formatBayar(b: typeof bayarUpahTable.$inferSelect) {
  return {
    id: b.id,
    upah_id: b.upahId,
    jumlah: parseFloat(b.jumlah),
    tanggal_bayar: b.tanggalBayar,
    catatan: b.catatan ?? null,
    pembayaran_id: b.pembayaranId ?? null,
    created_at: b.createdAt.toISOString(),
  };
}

// ── GET /upah ────────────────────────────────────────────────────────────────
router.get("/upah", requireAuth, async (req, res): Promise<void> => {
  const usahaId = req.session.usahaId;
  if (!usahaId) {
    res.status(403).json({ error: "Akses ditolak." });
    return;
  }

  const queryParams = GetUpahListQueryParams.safeParse(req.query);
  const conditions = [eq(upahPekerjaTable.usahaId, usahaId)];

  if (queryParams.success) {
    if (queryParams.data.pekerja_id) {
      conditions.push(eq(upahPekerjaTable.pekerjaid, queryParams.data.pekerja_id));
    }
    if (queryParams.data.status) {
      conditions.push(eq(upahPekerjaTable.status, queryParams.data.status));
    }
  }

  const rows = await db.select({
    upah: upahPekerjaTable,
    pekerja: pekerjaTable,
  })
    .from(upahPekerjaTable)
    .leftJoin(pekerjaTable, eq(upahPekerjaTable.pekerjaid, pekerjaTable.id))
    .where(and(...conditions))
    .orderBy(desc(upahPekerjaTable.tanggalKerja), desc(upahPekerjaTable.id));

  res.json(rows.map(({ upah, pekerja }) =>
    formatUpah(upah, pekerja?.nama ?? "", pekerja?.jabatan ?? null),
  ));
});

// ── POST /upah ───────────────────────────────────────────────────────────────
router.post("/upah", requireAuth, requireLicense, async (req, res): Promise<void> => {
  const usahaId = req.session.usahaId;
  if (!usahaId) {
    res.status(403).json({ error: "Akses ditolak." });
    return;
  }

  const parsed = CreateUpahBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [pekerja] = await db.select().from(pekerjaTable)
    .where(and(eq(pekerjaTable.id, parsed.data.pekerja_id), eq(pekerjaTable.usahaId, usahaId)));

  if (!pekerja) {
    res.status(404).json({ error: "Pekerja tidak ditemukan." });
    return;
  }

  const jumlahStr = parsed.data.jumlah_total.toString();
  const [upah] = await db.insert(upahPekerjaTable).values({
    usahaId,
    pekerjaid: parsed.data.pekerja_id,
    keterangan: parsed.data.keterangan,
    jumlahTotal: jumlahStr,
    totalDibayar: "0",
    sisaUpah: jumlahStr,
    tanggalKerja: parsed.data.tanggal_kerja,
    status: "belum_lunas",
    catatan: parsed.data.catatan ?? null,
  }).returning();

  res.status(201).json(formatUpah(upah, pekerja.nama, pekerja.jabatan ?? null));
});

// ── GET /upah/:id ────────────────────────────────────────────────────────────
router.get("/upah/:id", requireAuth, async (req, res): Promise<void> => {
  const usahaId = req.session.usahaId;
  if (!usahaId) {
    res.status(403).json({ error: "Akses ditolak." });
    return;
  }

  const params = GetUpahParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "ID tidak valid." });
    return;
  }

  const [row] = await db.select({
    upah: upahPekerjaTable,
    pekerja: pekerjaTable,
  })
    .from(upahPekerjaTable)
    .leftJoin(pekerjaTable, eq(upahPekerjaTable.pekerjaid, pekerjaTable.id))
    .where(and(eq(upahPekerjaTable.id, params.data.id), eq(upahPekerjaTable.usahaId, usahaId)));

  if (!row) {
    res.status(404).json({ error: "Catatan upah tidak ditemukan." });
    return;
  }

  const bayarList = await db.select().from(bayarUpahTable)
    .where(eq(bayarUpahTable.upahId, params.data.id))
    .orderBy(asc(bayarUpahTable.tanggalBayar), asc(bayarUpahTable.id));

  res.json({
    ...formatUpah(row.upah, row.pekerja?.nama ?? "", row.pekerja?.jabatan ?? null),
    bayar_list: bayarList.map(formatBayar),
  });
});

// ── PUT /upah/:id ────────────────────────────────────────────────────────────
router.put("/upah/:id", requireAuth, requireLicense, async (req, res): Promise<void> => {
  const usahaId = req.session.usahaId;
  if (!usahaId) {
    res.status(403).json({ error: "Akses ditolak." });
    return;
  }

  const params = UpdateUpahParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "ID tidak valid." });
    return;
  }

  const parsed = UpdateUpahBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [existing] = await db.select().from(upahPekerjaTable)
    .where(and(eq(upahPekerjaTable.id, params.data.id), eq(upahPekerjaTable.usahaId, usahaId)));

  if (!existing) {
    res.status(404).json({ error: "Catatan upah tidak ditemukan." });
    return;
  }

  const updateData: Partial<typeof upahPekerjaTable.$inferInsert> = {};
  if (parsed.data.keterangan !== undefined) updateData.keterangan = parsed.data.keterangan;
  if (parsed.data.tanggal_kerja !== undefined) updateData.tanggalKerja = parsed.data.tanggal_kerja;
  if (parsed.data.catatan !== undefined) updateData.catatan = parsed.data.catatan ?? null;
  if (parsed.data.jumlah_total !== undefined) {
    const jumlah = parsed.data.jumlah_total;
    const totalDibayar = parseFloat(existing.totalDibayar);
    const sisa = jumlah - totalDibayar;
    updateData.jumlahTotal = jumlah.toString();
    updateData.sisaUpah = Math.max(0, sisa).toString();
    updateData.status = sisa <= 0 ? "lunas" : "belum_lunas";
  }
  updateData.updatedAt = new Date();

  await db.update(upahPekerjaTable).set(updateData).where(eq(upahPekerjaTable.id, params.data.id));

  const [updated] = await db.select({
    upah: upahPekerjaTable,
    pekerja: pekerjaTable,
  })
    .from(upahPekerjaTable)
    .leftJoin(pekerjaTable, eq(upahPekerjaTable.pekerjaid, pekerjaTable.id))
    .where(eq(upahPekerjaTable.id, params.data.id));

  res.json(formatUpah(updated.upah, updated.pekerja?.nama ?? "", updated.pekerja?.jabatan ?? null));
});

// ── DELETE /upah/:id ─────────────────────────────────────────────────────────
router.delete("/upah/:id", requireAuth, requireLicense, async (req, res): Promise<void> => {
  const usahaId = req.session.usahaId;
  if (!usahaId) {
    res.status(403).json({ error: "Akses ditolak." });
    return;
  }

  const params = DeleteUpahParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "ID tidak valid." });
    return;
  }

  const [existing] = await db.select().from(upahPekerjaTable)
    .where(and(eq(upahPekerjaTable.id, params.data.id), eq(upahPekerjaTable.usahaId, usahaId)));

  if (!existing) {
    res.status(404).json({ error: "Catatan upah tidak ditemukan." });
    return;
  }

  const bayarTerkait = await db.select({ id: bayarUpahTable.id, keuanganId: bayarUpahTable.keuanganId })
    .from(bayarUpahTable)
    .where(eq(bayarUpahTable.upahId, params.data.id));

  const keuanganIds = bayarTerkait
    .map((b) => b.keuanganId)
    .filter((id): id is number => id !== null && id !== undefined);

  db.transaction((tx) => {
    if (keuanganIds.length > 0) {
      tx.delete(keuanganTable).where(inArray(keuanganTable.id, keuanganIds)).run();
    }
    tx.delete(bayarUpahTable).where(eq(bayarUpahTable.upahId, params.data.id)).run();
    tx.delete(upahPekerjaTable).where(eq(upahPekerjaTable.id, params.data.id)).run();
  });

  res.json({ message: "Catatan upah berhasil dihapus." });
});

// ── POST /upah/:id/bayar ─────────────────────────────────────────────────────
router.post("/upah/:id/bayar", requireAuth, requireLicense, async (req, res): Promise<void> => {
  const usahaId = req.session.usahaId;
  if (!usahaId) {
    res.status(403).json({ error: "Akses ditolak." });
    return;
  }

  const params = GetUpahParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "ID tidak valid." });
    return;
  }

  const parsed = CreateBayarUpahBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [row] = await db.select({
    upah: upahPekerjaTable,
    pekerja: pekerjaTable,
  })
    .from(upahPekerjaTable)
    .leftJoin(pekerjaTable, eq(upahPekerjaTable.pekerjaid, pekerjaTable.id))
    .where(and(eq(upahPekerjaTable.id, params.data.id), eq(upahPekerjaTable.usahaId, usahaId)));

  if (!row) {
    res.status(404).json({ error: "Catatan upah tidak ditemukan." });
    return;
  }

  const upah = row.upah;
  const pekerja = row.pekerja;
  const jumlahBayar = parsed.data.jumlah;
  const potongHutang = Math.max(0, parsed.data.potong_hutang ?? 0);
  const sisaSekarang = parseFloat(upah.sisaUpah);

  if (jumlahBayar <= 0) {
    res.status(400).json({ error: "Jumlah bayar harus lebih dari 0." });
    return;
  }

  if (jumlahBayar > sisaSekarang) {
    res.status(400).json({ error: `Jumlah bayar (${jumlahBayar}) melebihi sisa upah (${sisaSekarang}).` });
    return;
  }

  if (potongHutang > jumlahBayar) {
    res.status(400).json({ error: "Potongan hutang tidak boleh melebihi jumlah bayar." });
    return;
  }

  let targetHutang: typeof hutangTable.$inferSelect | null = null;
  if (potongHutang > 0) {
    if (!pekerja?.pelangganId) {
      res.status(400).json({ error: "Pekerja belum dihubungkan ke pelanggan. Hubungkan dulu di Gaji & Tenaga." });
      return;
    }

    const [hutang] = await db.select().from(hutangTable)
      .where(and(eq(hutangTable.pelangganId, pekerja.pelangganId), eq(hutangTable.usahaId, usahaId), eq(hutangTable.status, "aktif")))
      .orderBy(asc(hutangTable.tanggalHutang), asc(hutangTable.id));

    if (!hutang) {
      res.status(400).json({ error: "Pelanggan ini tidak punya hutang aktif untuk dipotong." });
      return;
    }

    const sisaHutang = parseFloat(hutang.sisaHutang);
    if (potongHutang > sisaHutang) {
      res.status(400).json({ error: `Potongan hutang (${potongHutang}) melebihi sisa hutang (${sisaHutang}).` });
      return;
    }

    targetHutang = hutang;
  }

  const totalDibayarBaru = parseFloat(upah.totalDibayar) + jumlahBayar;
  const sisaBaru = parseFloat(upah.jumlahTotal) - totalDibayarBaru;
  const statusBaru = sisaBaru <= 0 ? "lunas" : "belum_lunas";

  const keteranganKeuangan = potongHutang > 0
    ? `Upah ${pekerja?.nama ?? "Pekerja"} - ${upah.keterangan} (potong hutang Rp ${potongHutang.toLocaleString("id")})`
    : `Upah ${pekerja?.nama ?? "Pekerja"} - ${upah.keterangan}`;

  const jumlahKeuangan = Math.max(0, jumlahBayar - potongHutang);

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

    let pembayaranId: number | null = null;

    if (potongHutang > 0 && targetHutang) {
      const sisaHutangSetelah = Math.max(0, parseFloat(targetHutang.sisaHutang) - potongHutang);
      const totalDibayarHutangBaru = parseFloat(targetHutang.totalDibayar) + potongHutang;
      const statusHutangBaru = sisaHutangSetelah <= 0 ? "lunas" : "aktif";

      const [pembayaran] = tx.insert(pembayaranTable).values({
        usahaId,
        hutangId: targetHutang.id,
        pelangganId: targetHutang.pelangganId,
        tanggalBayar: parsed.data.tanggal_bayar,
        nominalBayar: potongHutang.toString(),
        catatan: `Potong gaji ${pekerja?.nama ?? "Pekerja"}${parsed.data.catatan ? ` - ${parsed.data.catatan}` : ""}`,
        nomorKwitansi: null,
        sisaHutangSetelah: sisaHutangSetelah.toString(),
        keuanganId: null,
      }).returning().all();

      pembayaranId = pembayaran.id;

      tx.update(hutangTable).set({
        totalDibayar: totalDibayarHutangBaru.toString(),
        sisaHutang: sisaHutangSetelah.toString(),
        status: statusHutangBaru,
        updatedAt: new Date(),
      }).where(eq(hutangTable.id, targetHutang.id)).run();
    }

    tx.insert(bayarUpahTable).values({
      usahaId,
      upahId: params.data.id,
      jumlah: jumlahBayar.toString(),
      tanggalBayar: parsed.data.tanggal_bayar,
      keuanganId,
      pembayaranId,
      catatan: parsed.data.catatan ?? null,
    }).run();

    tx.update(upahPekerjaTable).set({
      totalDibayar: totalDibayarBaru.toString(),
      sisaUpah: Math.max(0, sisaBaru).toString(),
      status: statusBaru,
      updatedAt: new Date(),
    }).where(eq(upahPekerjaTable.id, params.data.id)).run();
  });

  const [updatedUpah] = await db.select({
    upah: upahPekerjaTable,
    pekerja: pekerjaTable,
  })
    .from(upahPekerjaTable)
    .leftJoin(pekerjaTable, eq(upahPekerjaTable.pekerjaid, pekerjaTable.id))
    .where(eq(upahPekerjaTable.id, params.data.id));

  const bayarList = await db.select().from(bayarUpahTable)
    .where(eq(bayarUpahTable.upahId, params.data.id))
    .orderBy(asc(bayarUpahTable.tanggalBayar), asc(bayarUpahTable.id));

  res.status(201).json({
    ...formatUpah(updatedUpah.upah, updatedUpah.pekerja?.nama ?? "", updatedUpah.pekerja?.jabatan ?? null),
    bayar_list: bayarList.map(formatBayar),
  });
});

// ── DELETE /bayar-upah/:id ───────────────────────────────────────────────────
router.delete("/bayar-upah/:id", requireAuth, requireLicense, async (req, res): Promise<void> => {
  const usahaId = req.session.usahaId;
  if (!usahaId) {
    res.status(403).json({ error: "Akses ditolak." });
    return;
  }

  const params = DeleteBayarUpahParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "ID tidak valid." });
    return;
  }

  const [bayar] = await db.select().from(bayarUpahTable)
    .where(and(eq(bayarUpahTable.id, params.data.id), eq(bayarUpahTable.usahaId, usahaId)));

  if (!bayar) {
    res.status(404).json({ error: "Pembayaran tidak ditemukan." });
    return;
  }

  const [upah] = await db.select().from(upahPekerjaTable)
    .where(eq(upahPekerjaTable.id, bayar.upahId));

  if (!upah) {
    res.status(404).json({ error: "Catatan upah tidak ditemukan." });
    return;
  }

  let pembayaranTerkait: typeof pembayaranTable.$inferSelect | null = null;
  if (bayar.pembayaranId) {
    const [pembayaran] = await db.select().from(pembayaranTable)
      .where(and(eq(pembayaranTable.id, bayar.pembayaranId), eq(pembayaranTable.usahaId, usahaId)));
    pembayaranTerkait = pembayaran ?? null;
  }

  const hutangTerkait = pembayaranTerkait
    ? (await db.select().from(hutangTable)
      .where(and(eq(hutangTable.id, pembayaranTerkait.hutangId), eq(hutangTable.usahaId, usahaId))))[0] ?? null
    : null;

  const jumlahBayar = parseFloat(bayar.jumlah);
  const totalDibayarBaru = Math.max(0, parseFloat(upah.totalDibayar) - jumlahBayar);
  const sisaBaru = parseFloat(upah.jumlahTotal) - totalDibayarBaru;
  const statusBaru = sisaBaru <= 0 ? "lunas" : "belum_lunas";

  const potongHutang = pembayaranTerkait ? parseFloat(pembayaranTerkait.nominalBayar) : 0;

  // Cek apakah keuangan_id ini dipakai oleh bayar_upah lain (artinya ini bagian dari batch payment)
  let sisaBayarBatch: { jumlah: string }[] = [];
  if (bayar.keuanganId) {
    sisaBayarBatch = await db.select({ jumlah: bayarUpahTable.jumlah })
      .from(bayarUpahTable)
      .where(and(
        eq(bayarUpahTable.keuanganId, bayar.keuanganId),
        ne(bayarUpahTable.id, params.data.id),
      ));
  }

  db.transaction((tx) => {
    if (bayar.keuanganId) {
      if (sisaBayarBatch.length > 0) {
        // Batch payment: kurangi jumlah keuangan saja, jangan hapus
        const jumlahSisa = sisaBayarBatch.reduce((acc, b) => acc + parseFloat(b.jumlah), 0);
        if (jumlahSisa <= 0) {
          tx.delete(keuanganTable).where(eq(keuanganTable.id, bayar.keuanganId)).run();
        } else {
          tx.update(keuanganTable).set({ jumlah: jumlahSisa.toString() })
            .where(eq(keuanganTable.id, bayar.keuanganId)).run();
        }
      } else {
        // Individual payment: hapus keuangan sepenuhnya
        tx.delete(keuanganTable).where(eq(keuanganTable.id, bayar.keuanganId)).run();
      }
    }

    if (bayar.pembayaranId && pembayaranTerkait) {
      if (hutangTerkait) {
        const totalDibayarHutangBaru = Math.max(0, parseFloat(hutangTerkait.totalDibayar) - potongHutang);
        const sisaHutangBaru = parseFloat(hutangTerkait.nominalHutang) - totalDibayarHutangBaru;
        tx.update(hutangTable).set({
          totalDibayar: totalDibayarHutangBaru.toString(),
          sisaHutang: Math.max(0, sisaHutangBaru).toString(),
          status: sisaHutangBaru <= 0 ? "lunas" : "aktif",
          updatedAt: new Date(),
        }).where(eq(hutangTable.id, hutangTerkait.id)).run();
      }
      tx.delete(pembayaranTable).where(eq(pembayaranTable.id, pembayaranTerkait.id)).run();
    }

    tx.delete(bayarUpahTable).where(eq(bayarUpahTable.id, params.data.id)).run();
    tx.update(upahPekerjaTable).set({
      totalDibayar: totalDibayarBaru.toString(),
      sisaUpah: Math.max(0, sisaBaru).toString(),
      status: statusBaru,
      updatedAt: new Date(),
    }).where(eq(upahPekerjaTable.id, bayar.upahId)).run();
  });

  res.json({ message: "Pembayaran berhasil dihapus." });
});

export default router;
