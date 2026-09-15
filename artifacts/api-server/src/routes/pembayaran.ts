import { Router, type IRouter } from "express";
import { db, pembayaranTable, hutangTable, pelangganTable, usahaTable, keuanganTable, transaksiStokTable, barangTable } from "@workspace/db";
import { eq, and, desc, inArray } from "drizzle-orm";
import {
  CreatePembayaranBody,
  GetPembayaranListQueryParams,
  DeletePembayaranParams,
} from "@workspace/api-zod";
import { z } from "zod";
import { requireAuth, requireLicense } from "../middlewares/auth";
import { toNum, toStr, generateKwitansiNumber } from "../utils/money";

const router: IRouter = Router();

router.get("/pembayaran", requireAuth, async (req, res): Promise<void> => {
  const usahaId = req.session.usahaId;
  if (!usahaId) {
    res.status(403).json({ error: "Akses ditolak." });
    return;
  }

  const queryParams = GetPembayaranListQueryParams.safeParse(req.query);
  const conditions = [eq(pembayaranTable.usahaId, usahaId)];

  if (queryParams.success) {
    if (queryParams.data.hutang_id) {
      conditions.push(eq(pembayaranTable.hutangId, queryParams.data.hutang_id));
    }
    if (queryParams.data.pelanggan_id) {
      conditions.push(eq(pembayaranTable.pelangganId, queryParams.data.pelanggan_id));
    }
  }

  const list = await db.select({
    pembayaran: pembayaranTable,
    pelangganNama: pelangganTable.nama,
    hutangKeterangan: hutangTable.keterangan,
    hutangNominal: hutangTable.nominalHutang,
    namaUsaha: usahaTable.namaUsaha,
  })
    .from(pembayaranTable)
    .leftJoin(pelangganTable, eq(pembayaranTable.pelangganId, pelangganTable.id))
    .leftJoin(hutangTable, eq(pembayaranTable.hutangId, hutangTable.id))
    .leftJoin(usahaTable, eq(pembayaranTable.usahaId, usahaTable.id))
    .where(and(...conditions))
    .orderBy(desc(pembayaranTable.tanggalBayar), desc(pembayaranTable.id));

  res.json(list.map(({ pembayaran: p, pelangganNama, hutangKeterangan, hutangNominal, namaUsaha }) => ({
    id: p.id,
    usaha_id: p.usahaId,
    hutang_id: p.hutangId,
    pelanggan_id: p.pelangganId,
    pelanggan_nama: pelangganNama ?? "",
    tanggal_bayar: p.tanggalBayar,
    nominal_bayar: toNum(p.nominalBayar),
    catatan: p.catatan ?? null,
    nomor_kwitansi: p.nomorKwitansi ?? null,
    hutang_keterangan: hutangKeterangan ?? null,
    hutang_nominal: hutangNominal ? toNum(hutangNominal) : 0,
    sisa_hutang_setelah: p.sisaHutangSetelah ? toNum(p.sisaHutangSetelah) : null,
    nama_usaha: namaUsaha ?? "",
    created_at: p.createdAt.toISOString(),
  })));
});

router.post("/pembayaran", requireAuth, requireLicense, async (req, res): Promise<void> => {
  const usahaId = req.session.usahaId;
  if (!usahaId) {
    res.status(403).json({ error: "Akses ditolak." });
    return;
  }

  const parsed = CreatePembayaranBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  if (parsed.data.nominal_bayar <= 0) {
    res.status(400).json({ error: "Nominal bayar harus lebih dari 0." });
    return;
  }

  const [hutang] = await db.select().from(hutangTable)
    .where(and(eq(hutangTable.id, parsed.data.hutang_id), eq(hutangTable.usahaId, usahaId)));

  if (!hutang) {
    res.status(404).json({ error: "Hutang tidak ditemukan." });
    return;
  }

  if (hutang.status === "lunas") {
    res.status(400).json({ error: "Hutang ini sudah lunas. Tidak dapat menambah pembayaran." });
    return;
  }

  const sisaHutang = toNum(hutang.sisaHutang);
  if (parsed.data.nominal_bayar > sisaHutang) {
    res.status(400).json({
      error: `Nominal bayar (${parsed.data.nominal_bayar}) melebihi sisa hutang (${sisaHutang}). Masukkan jumlah yang sesuai.`,
    });
    return;
  }

  const [pelanggan] = await db.select().from(pelangganTable).where(eq(pelangganTable.id, hutang.pelangganId));
  const [usaha] = await db.select().from(usahaTable).where(eq(usahaTable.id, usahaId));

  const newTotalDibayar = toNum(hutang.totalDibayar) + parsed.data.nominal_bayar;
  const newSisaHutang = toNum(hutang.nominalHutang) - newTotalDibayar;
  const sisaSetelah = Math.max(0, newSisaHutang);
  const newStatus = newSisaHutang <= 0 ? "lunas" : "aktif";

  const { pembayaran, nomorKwitansi } = db.transaction((tx) => {
    const nomorKwitansi = generateKwitansiNumber(usahaId, undefined, tx);

    const [keuangan] = tx.insert(keuanganTable).values({
      usahaId,
      tanggal: parsed.data.tanggal_bayar,
      tipe: "masuk",
      kategori: "Pelunasan Hutang",
      keterangan: `Bayar hutang: ${pelanggan?.nama ?? ""}${hutang.keterangan ? ` (${hutang.keterangan})` : ""}`,
      jumlah: toStr(parsed.data.nominal_bayar),
    }).returning().all();

    const [pembayaran] = tx.insert(pembayaranTable).values({
      usahaId,
      hutangId: parsed.data.hutang_id,
      pelangganId: hutang.pelangganId,
      tanggalBayar: parsed.data.tanggal_bayar,
      nominalBayar: toStr(parsed.data.nominal_bayar),
      catatan: parsed.data.catatan ?? null,
      nomorKwitansi,
      sisaHutangSetelah: toStr(sisaSetelah),
      keuanganId: keuangan.id,
    }).returning().all();

    tx.update(hutangTable).set({
      totalDibayar: toStr(newTotalDibayar),
      sisaHutang: toStr(sisaSetelah),
      status: newStatus,
      updatedAt: new Date(),
    }).where(eq(hutangTable.id, parsed.data.hutang_id)).run();

    return { pembayaran, nomorKwitansi };
  });

  res.status(201).json({
    id: pembayaran.id,
    usaha_id: pembayaran.usahaId,
    hutang_id: pembayaran.hutangId,
    pelanggan_id: pembayaran.pelangganId,
    pelanggan_nama: pelanggan?.nama ?? "",
    tanggal_bayar: pembayaran.tanggalBayar,
    nominal_bayar: toNum(pembayaran.nominalBayar),
    catatan: pembayaran.catatan ?? null,
    nomor_kwitansi: nomorKwitansi,
    hutang_keterangan: hutang.keterangan ?? null,
    hutang_nominal: toNum(hutang.nominalHutang),
    sisa_hutang_setelah: sisaSetelah,
    nama_usaha: usaha?.namaUsaha ?? "",
    created_at: pembayaran.createdAt.toISOString(),
  });
});

const BatchPembayaranBody = z.object({
  hutang_ids: z.array(z.number().int().positive()).min(1, "Pilih minimal 1 nota hutang"),
  tanggal_bayar: z.string().min(1, "Tanggal wajib diisi"),
  nominal_total: z.number().positive("Nominal harus lebih dari 0"),
  catatan: z.string().optional(),
  barter: z.object({
    barang_id: z.number().int().positive(),
    kuantitas: z.number().positive(),
    harga_satuan: z.number().positive(),
  }).optional(),
});

router.post("/pembayaran/batch", requireAuth, requireLicense, async (req, res): Promise<void> => {
  const usahaId = req.session.usahaId;
  if (!usahaId) {
    res.status(403).json({ error: "Akses ditolak." });
    return;
  }

  const parsed = BatchPembayaranBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { hutang_ids, tanggal_bayar, nominal_total, catatan, barter } = parsed.data;

  // Validate Barter
  if (barter) {
    const [barang] = await db.select().from(barangTable)
      .where(and(eq(barangTable.id, barter.barang_id), eq(barangTable.usahaId, usahaId)));
    if (!barang) {
      res.status(404).json({ error: "Barang komoditas untuk barter tidak ditemukan." });
      return;
    }
  }

  // Ambil semua hutang yang dipilih, pastikan milik usaha ini
  const hutangs = await db.select().from(hutangTable)
    .where(and(eq(hutangTable.usahaId, usahaId), inArray(hutangTable.id, hutang_ids)));

  if (hutangs.length !== hutang_ids.length) {
    res.status(404).json({ error: "Satu atau lebih nota hutang tidak ditemukan." });
    return;
  }

  const hutangLunas = hutangs.filter(h => h.status === "lunas");
  if (hutangLunas.length > 0) {
    res.status(400).json({ error: "Satu atau lebih nota hutang sudah lunas." });
    return;
  }

  // Validasi semua hutang milik pelanggan yang sama
  const uniquePelangganIds = new Set(hutangs.map(h => h.pelangganId));
  if (uniquePelangganIds.size > 1) {
    res.status(400).json({ error: "Semua nota hutang harus milik pelanggan yang sama." });
    return;
  }

  // Urutkan dari tanggal terlama (FIFO)
  hutangs.sort((a, b) => a.tanggalHutang.localeCompare(b.tanggalHutang));

  const totalSisa = hutangs.reduce((sum, h) => sum + toNum(h.sisaHutang), 0);
  if (nominal_total > totalSisa) {
    res.status(400).json({ error: `Nominal melebihi total sisa hutang (${totalSisa}).` });
    return;
  }

  const pelangganId = hutangs[0]!.pelangganId;
  const [pelanggan] = await db.select().from(pelangganTable).where(eq(pelangganTable.id, pelangganId));
  const [usaha] = await db.select().from(usahaTable).where(eq(usahaTable.id, usahaId));

  const tahun = new Date().getFullYear();

  let remaining = nominal_total;
  const distributions: Array<{ hutang: typeof hutangs[0]; bayar: number }> = [];
  for (const hutang of hutangs) {
    if (remaining <= 0) break;
    const sisa = toNum(hutang.sisaHutang);
    const bayar = Math.min(sisa, remaining);
    if (bayar > 0) {
      distributions.push({ hutang, bayar });
      remaining -= bayar;
    }
  }

  const pembayaranList = db.transaction((tx) => {
    const results = [];
    for (let i = 0; i < distributions.length; i++) {
      const { hutang, bayar } = distributions[i]!;
      const nomorKwitansi = generateKwitansiNumber(usahaId, tahun, tx);
      const sisaSetelah = Math.max(0, toNum(hutang.sisaHutang) - bayar);
      const newTotalDibayar = toNum(hutang.totalDibayar) + bayar;
      const newSisaHutang = toNum(hutang.nominalHutang) - newTotalDibayar;
      const newStatus: "lunas" | "aktif" = newSisaHutang <= 0 ? "lunas" : "aktif";

      let keuanganKeterangan = `Bayar hutang: ${pelanggan?.nama ?? ""}${hutang.keterangan ? ` (${hutang.keterangan})` : ""}`;
      if (barter) {
        keuanganKeterangan += ` — [Barter Panen] ${barter.kuantitas} x Rp${barter.harga_satuan}`;
      }

      const [keuangan] = tx.insert(keuanganTable).values({
        usahaId,
        tanggal: tanggal_bayar,
        tipe: "masuk",
        kategori: "Pelunasan Hutang",
        keterangan: keuanganKeterangan,
        jumlah: toStr(bayar),
      }).returning().all();

      const [pembayaran] = tx.insert(pembayaranTable).values({
        usahaId,
        hutangId: hutang.id,
        pelangganId: hutang.pelangganId,
        tanggalBayar: tanggal_bayar,
        nominalBayar: toStr(bayar),
        catatan: catatan ?? null,
        nomorKwitansi,
        sisaHutangSetelah: toStr(sisaSetelah),
        keuanganId: keuangan!.id,
      }).returning().all();

      tx.update(hutangTable).set({
        totalDibayar: toStr(newTotalDibayar),
        sisaHutang: toStr(Math.max(0, newSisaHutang)),
        status: newStatus,
        updatedAt: new Date(),
      }).where(eq(hutangTable.id, hutang.id)).run();

      results.push({
        id: pembayaran!.id,
        hutang_id: hutang.id,
        hutang_tanggal: hutang.tanggalHutang,
        hutang_keterangan: hutang.keterangan ?? null,
        hutang_nominal: toNum(hutang.nominalHutang),
        nominal_bayar: bayar,
        sisa_hutang_setelah: sisaSetelah,
        nomor_kwitansi: nomorKwitansi,
        status_baru: newStatus,
      });
    }

    if (barter) {
      const rows = tx.select().from(barangTable)
        .where(and(eq(barangTable.id, barter.barang_id), eq(barangTable.usahaId, usahaId))).all();
      const barang = rows[0];

      if (barang) {
        const stokBaru = toNum(barang.stok) + barter.kuantitas;

        tx.update(barangTable).set({
          stok: toStr(stokBaru),
        }).where(eq(barangTable.id, barter.barang_id)).run();

        tx.insert(transaksiStokTable).values({
          usahaId,
          barangId: barter.barang_id,
          tanggal: tanggal_bayar,
          tipe: "masuk",
          jumlah: toStr(barter.kuantitas),
          hargaSatuan: toStr(barter.harga_satuan),
          keterangan: `Barter dari pelunasan hutang: ${pelanggan?.nama ?? ""}`,
        }).run();
      }
    }

    return results;
  });

  res.status(201).json({
    pembayaran_list: pembayaranList,
    pelanggan_nama: pelanggan?.nama ?? "",
    pelanggan_id: pelangganId,
    nama_usaha: usaha?.namaUsaha ?? "",
    total_dibayar: nominal_total,
    tanggal_bayar,
    catatan: catatan ?? null,
  });
});

router.delete("/pembayaran/:id", requireAuth, requireLicense, async (req, res): Promise<void> => {
  const usahaId = req.session.usahaId;
  if (!usahaId) {
    res.status(403).json({ error: "Akses ditolak." });
    return;
  }

  const params = DeletePembayaranParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "ID tidak valid." });
    return;
  }

  const [pembayaran] = await db.select().from(pembayaranTable)
    .where(and(eq(pembayaranTable.id, params.data.id), eq(pembayaranTable.usahaId, usahaId)));

  if (!pembayaran) {
    res.status(404).json({ error: "Pembayaran tidak ditemukan." });
    return;
  }

  const [hutang] = await db.select().from(hutangTable)
    .where(and(eq(hutangTable.id, pembayaran.hutangId), eq(hutangTable.usahaId, usahaId)));

  let keuanganIdToDelete: number | null = null;

  if (pembayaran.keuanganId) {
    const [keuanganTerkait] = await db.select().from(keuanganTable)
      .where(and(eq(keuanganTable.id, pembayaran.keuanganId), eq(keuanganTable.usahaId, usahaId)));
    keuanganIdToDelete = keuanganTerkait?.id ?? null;
  }

  if (!keuanganIdToDelete) {
    // Legacy fallback: records created before keuanganId FK was added.
    // Only delete if EXACTLY one match found — ambiguous matches are skipped to prevent data loss.
    const matched = await db.select({ id: keuanganTable.id })
      .from(keuanganTable)
      .where(and(
        eq(keuanganTable.usahaId, usahaId),
        eq(keuanganTable.tanggal, pembayaran.tanggalBayar),
        eq(keuanganTable.jumlah, pembayaran.nominalBayar),
        eq(keuanganTable.kategori, "Pelunasan Hutang"),
        eq(keuanganTable.tipe, "masuk"),
      ));
    if (matched.length === 1) {
      keuanganIdToDelete = matched[0]!.id;
      console.warn(
        `[pembayaran] DELETE id=${params.data.id}: using legacy keuangan fallback match (keuangan_id=${keuanganIdToDelete}). ` +
        `This record was created before keuanganId FK was stored.`,
      );
    } else if (matched.length > 1) {
      console.warn(
        `[pembayaran] DELETE id=${params.data.id}: ${matched.length} ambiguous keuangan matches found, skipping keuangan deletion to prevent data loss.`,
      );
    }
  }

  db.transaction((tx) => {
    if (hutang) {
      const newTotalDibayar = Math.max(0, toNum(hutang.totalDibayar) - toNum(pembayaran.nominalBayar));
      const newSisaHutang = toNum(hutang.nominalHutang) - newTotalDibayar;
      tx.update(hutangTable).set({
        totalDibayar: toStr(newTotalDibayar),
        sisaHutang: toStr(Math.max(0, newSisaHutang)),
        status: newSisaHutang > 0 ? "aktif" : "lunas",
        updatedAt: new Date(),
      }).where(eq(hutangTable.id, hutang.id)).run();
    }

    if (keuanganIdToDelete) {
      tx.delete(keuanganTable).where(eq(keuanganTable.id, keuanganIdToDelete)).run();
    }

    tx.delete(pembayaranTable).where(eq(pembayaranTable.id, params.data.id)).run();
  });

  res.json({ message: "Pembayaran berhasil dihapus." });
});

export default router;
