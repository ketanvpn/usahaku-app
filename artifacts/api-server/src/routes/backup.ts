import { Router, type IRouter } from "express";
import { db, sqliteRaw, usahaTable, pelangganTable, hutangTable, pembayaranTable, keuanganTable, barangTable, transaksiStokTable, transaksiKasirTable, transaksiKasirItemTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

router.get("/backup/export", requireAuth, async (req, res): Promise<void> => {
  const usahaId = req.session.usahaId;
  if (!usahaId) {
    res.status(403).json({ error: "Akses ditolak." });
    return;
  }

  const [usaha] = await db.select().from(usahaTable).where(eq(usahaTable.id, usahaId));
  if (!usaha) {
    res.status(404).json({ error: "Usaha tidak ditemukan." });
    return;
  }

  const pelangganList       = await db.select().from(pelangganTable).where(eq(pelangganTable.usahaId, usahaId));
  const hutangList          = await db.select().from(hutangTable).where(eq(hutangTable.usahaId, usahaId));
  const pembayaranList      = await db.select().from(pembayaranTable).where(eq(pembayaranTable.usahaId, usahaId));
  const keuanganList        = await db.select().from(keuanganTable).where(eq(keuanganTable.usahaId, usahaId));
  const barangList          = await db.select().from(barangTable).where(eq(barangTable.usahaId, usahaId));
  const transaksiStokList   = await db.select().from(transaksiStokTable).where(eq(transaksiStokTable.usahaId, usahaId));
  const transaksiKasirList  = await db.select().from(transaksiKasirTable).where(eq(transaksiKasirTable.usahaId, usahaId));

  // Ambil semua item kasir sekaligus
  const allKasirItems = transaksiKasirList.length > 0
    ? await Promise.all(transaksiKasirList.map(k =>
        db.select().from(transaksiKasirItemTable).where(eq(transaksiKasirItemTable.transaksiKasirId, k.id))
      ))
    : [];
  const transaksiKasirItemList = allKasirItems.flat();

  const backup = {
    version: "1.2",
    exported_at: new Date().toISOString(),
    usaha_id: usahaId,
    usaha: {
      id: usaha.id,
      nama_usaha: usaha.namaUsaha,
      alamat: usaha.alamat ?? null,
      telepon: usaha.telepon ?? null,
      catatan: usaha.catatan ?? null,
      created_at: usaha.createdAt.toISOString(),
    },
    pelanggan: pelangganList.map((p) => ({
      id: p.id,
      usaha_id: p.usahaId,
      nama: p.nama,
      telepon: p.telepon ?? null,
      alamat: p.alamat ?? null,
      catatan: p.catatan ?? null,
      created_at: p.createdAt.toISOString(),
    })),
    hutang: hutangList.map((h) => ({
      id: h.id,
      usaha_id: h.usahaId,
      pelanggan_id: h.pelangganId,
      tanggal_hutang: h.tanggalHutang,
      keterangan: h.keterangan ?? null,
      nominal_hutang: parseFloat(h.nominalHutang),
      total_dibayar: parseFloat(h.totalDibayar),
      sisa_hutang: parseFloat(h.sisaHutang),
      status: h.status,
      created_at: h.createdAt.toISOString(),
      updated_at: h.updatedAt.toISOString(),
    })),
    pembayaran: pembayaranList.map((p) => ({
      id: p.id,
      usaha_id: p.usahaId,
      hutang_id: p.hutangId,
      pelanggan_id: p.pelangganId,
      tanggal_bayar: p.tanggalBayar,
      nominal_bayar: parseFloat(p.nominalBayar),
      catatan: p.catatan ?? null,
      nomor_kwitansi: p.nomorKwitansi ?? null,
      sisa_hutang_setelah: p.sisaHutangSetelah ? parseFloat(p.sisaHutangSetelah) : null,
      keuangan_id: p.keuanganId ?? null,
      created_at: p.createdAt.toISOString(),
    })),
    keuangan: keuanganList.map((k) => ({
      id: k.id,
      usaha_id: k.usahaId,
      tanggal: k.tanggal,
      tipe: k.tipe,
      kategori: k.kategori ?? null,
      keterangan: k.keterangan,
      jumlah: parseFloat(k.jumlah),
      created_at: k.createdAt.toISOString(),
    })),
    barang: barangList.map((b) => ({
      id: b.id,
      usaha_id: b.usahaId,
      nama: b.nama,
      satuan: b.satuan,
      harga_beli: parseFloat(b.hargaBeli),
      harga_jual: parseFloat(b.hargaJual),
      stok: parseFloat(b.stok),
      stok_minimum: parseFloat(b.stokMinimum),
      created_at: b.createdAt.toISOString(),
    })),
    transaksi_stok: transaksiStokList.map((t) => ({
      id: t.id,
      usaha_id: t.usahaId,
      barang_id: t.barangId,
      tanggal: t.tanggal,
      tipe: t.tipe,
      jumlah: parseFloat(t.jumlah),
      harga_satuan: parseFloat(t.hargaSatuan),
      keterangan: t.keterangan ?? null,
      keuangan_id: t.keuanganId ?? null,
      created_at: t.createdAt.toISOString(),
    })),
    transaksi_kasir: transaksiKasirList.map((k) => ({
      id: k.id,
      usaha_id: k.usahaId,
      tanggal: k.tanggal,
      total: parseFloat(k.total),
      uang_bayar: parseFloat(k.uangBayar),
      kembalian: parseFloat(k.kembalian),
      catatan: k.catatan ?? null,
      created_at: k.createdAt instanceof Date ? k.createdAt.toISOString() : new Date(k.createdAt).toISOString(),
    })),
    transaksi_kasir_item: transaksiKasirItemList.map((i) => ({
      id: i.id,
      transaksi_kasir_id: i.transaksiKasirId,
      barang_id: i.barangId,
      nama_barang: i.namaBarang,
      satuan: i.satuan,
      jumlah: parseFloat(i.jumlah),
      harga_satuan: parseFloat(i.hargaSatuan),
      subtotal: parseFloat(i.subtotal),
    })),
  };

  res.json(backup);
});

router.post("/backup/restore", requireAuth, async (req, res): Promise<void> => {
  const usahaId = req.session.usahaId;
  if (!usahaId) {
    res.status(403).json({ error: "Akses ditolak." });
    return;
  }

  const backup = req.body;

  if (!backup.version || !Array.isArray(backup.pelanggan) || !Array.isArray(backup.hutang) || !Array.isArray(backup.pembayaran)) {
    res.status(400).json({ error: "Format file backup tidak valid. Pastikan file yang diunggah benar." });
    return;
  }

  // usaha_id di dalam file backup tidak harus sama dengan usaha aktif —
  // semua data akan di-map ke usaha yang sedang login (mendukung pindah PC / install baru)

  // PENTING: Drizzle + better-sqlite3 bersifat SINKRON.
  // db.transaction(async ...) tidak didukung — akan throw "Transaction function cannot return a promise".
  // Solusi: gunakan sqliteRaw.transaction() (better-sqlite3 native) dengan callback sinkron.

  try {
    const transact = sqliteRaw.transaction(() => {
      // ── Hapus semua data lama (urutan penting karena foreign key) ───────────

      // Hapus item kasir dulu (child dari transaksi_kasir)
      const kasirIds = (sqliteRaw.prepare(
        "SELECT id FROM transaksi_kasir WHERE usaha_id = ?"
      ).all(usahaId) as Array<{ id: number }>);
      const stmtDelKasirItem = sqliteRaw.prepare(
        "DELETE FROM transaksi_kasir_item WHERE transaksi_kasir_id = ?"
      );
      for (const k of kasirIds) stmtDelKasirItem.run(k.id);

      sqliteRaw.prepare("DELETE FROM transaksi_kasir  WHERE usaha_id = ?").run(usahaId);
      sqliteRaw.prepare("DELETE FROM transaksi_stok   WHERE usaha_id = ?").run(usahaId);
      sqliteRaw.prepare("DELETE FROM pembayaran        WHERE usaha_id = ?").run(usahaId);
      sqliteRaw.prepare("DELETE FROM hutang            WHERE usaha_id = ?").run(usahaId);
      sqliteRaw.prepare("DELETE FROM barang            WHERE usaha_id = ?").run(usahaId);
      sqliteRaw.prepare("DELETE FROM pelanggan         WHERE usaha_id = ?").run(usahaId);
      sqliteRaw.prepare("DELETE FROM keuangan          WHERE usaha_id = ?").run(usahaId);

      // ── 1. Restore keuangan — bangun peta ID lama → baru ──────────────────
      const keuanganIdMap = new Map<number, number>();
      if (Array.isArray(backup.keuangan)) {
        const stmtKeu = sqliteRaw.prepare(
          "INSERT INTO keuangan (usaha_id, tanggal, tipe, kategori, keterangan, jumlah) VALUES (?, ?, ?, ?, ?, ?)"
        );
        for (const k of backup.keuangan) {
          const r = stmtKeu.run(
            usahaId, k.tanggal, k.tipe, k.kategori ?? null, k.keterangan ?? "", String(k.jumlah)
          );
          keuanganIdMap.set(k.id, Number(r.lastInsertRowid));
        }
      }

      // ── 2. Restore pelanggan — bangun peta ID lama → baru ─────────────────
      const pelangganIdMap = new Map<number, number>();
      const stmtPel = sqliteRaw.prepare(
        "INSERT INTO pelanggan (usaha_id, nama, telepon, alamat, catatan) VALUES (?, ?, ?, ?, ?)"
      );
      for (const p of backup.pelanggan) {
        const r = stmtPel.run(
          usahaId, p.nama, p.telepon ?? null, p.alamat ?? null, p.catatan ?? null
        );
        pelangganIdMap.set(p.id, Number(r.lastInsertRowid));
      }

      // ── 3. Restore barang — bangun peta ID lama → baru ────────────────────
      const barangIdMap = new Map<number, number>();
      if (Array.isArray(backup.barang)) {
        const stmtBar = sqliteRaw.prepare(
          "INSERT INTO barang (usaha_id, nama, satuan, harga_beli, harga_jual, stok, stok_minimum, kategori) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
        );
        for (const b of backup.barang) {
          const r = stmtBar.run(
            usahaId, b.nama, b.satuan,
            String(b.harga_beli), String(b.harga_jual),
            String(b.stok), String(b.stok_minimum),
            b.kategori ?? ""
          );
          barangIdMap.set(b.id, Number(r.lastInsertRowid));
        }
      }

      // ── 4. Restore hutang — bangun peta ID lama → baru ────────────────────
      const hutangIdMap = new Map<number, number>();
      const stmtHutang = sqliteRaw.prepare(
        "INSERT INTO hutang (usaha_id, pelanggan_id, tanggal_hutang, keterangan, nominal_hutang, total_dibayar, sisa_hutang, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
      );
      for (const h of backup.hutang) {
        const newPelangganId = pelangganIdMap.get(h.pelanggan_id) ?? h.pelanggan_id;
        const r = stmtHutang.run(
          usahaId, newPelangganId,
          h.tanggal_hutang, h.keterangan ?? null,
          String(h.nominal_hutang), String(h.total_dibayar ?? 0),
          String(h.sisa_hutang), h.status ?? "aktif"
        );
        hutangIdMap.set(h.id, Number(r.lastInsertRowid));
      }

      // ── 5. Restore pembayaran ──────────────────────────────────────────────
      const stmtBayar = sqliteRaw.prepare(
        "INSERT INTO pembayaran (usaha_id, hutang_id, pelanggan_id, tanggal_bayar, nominal_bayar, catatan, nomor_kwitansi, sisa_hutang_setelah, keuangan_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
      );
      for (const p of backup.pembayaran) {
        const newHutangId    = hutangIdMap.get(p.hutang_id) ?? p.hutang_id;
        const newPelangganId = pelangganIdMap.get(p.pelanggan_id) ?? p.pelanggan_id;
        const newKeuanganId  = p.keuangan_id != null ? (keuanganIdMap.get(p.keuangan_id) ?? null) : null;
        stmtBayar.run(
          usahaId, newHutangId, newPelangganId,
          p.tanggal_bayar, String(p.nominal_bayar),
          p.catatan ?? null, p.nomor_kwitansi ?? null,
          p.sisa_hutang_setelah != null ? String(p.sisa_hutang_setelah) : null,
          newKeuanganId ?? null
        );
      }

      // ── 6. Restore transaksi stok ──────────────────────────────────────────
      if (Array.isArray(backup.transaksi_stok)) {
        const stmtStok = sqliteRaw.prepare(
          "INSERT INTO transaksi_stok (usaha_id, barang_id, tanggal, tipe, jumlah, harga_satuan, keterangan, keuangan_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
        );
        for (const t of backup.transaksi_stok) {
          const newBarangId   = barangIdMap.get(t.barang_id) ?? t.barang_id;
          const newKeuanganId = t.keuangan_id != null ? (keuanganIdMap.get(t.keuangan_id) ?? null) : null;
          stmtStok.run(
            usahaId, newBarangId, t.tanggal, t.tipe,
            String(t.jumlah), String(t.harga_satuan),
            t.keterangan ?? null, newKeuanganId ?? null
          );
        }
      }

      // ── 7. Restore transaksi kasir — bangun peta ID lama → baru ───────────
      const kasirIdMap = new Map<number, number>();
      if (Array.isArray(backup.transaksi_kasir)) {
        const stmtKasir = sqliteRaw.prepare(
          "INSERT INTO transaksi_kasir (usaha_id, tanggal, total, uang_bayar, kembalian, catatan) VALUES (?, ?, ?, ?, ?, ?)"
        );
        for (const k of backup.transaksi_kasir) {
          const r = stmtKasir.run(
            usahaId, k.tanggal,
            String(k.total), String(k.uang_bayar), String(k.kembalian),
            k.catatan ?? null
          );
          kasirIdMap.set(k.id, Number(r.lastInsertRowid));
        }
      }

      // ── 8. Restore item kasir ──────────────────────────────────────────────
      if (Array.isArray(backup.transaksi_kasir_item)) {
        const stmtKasirItem = sqliteRaw.prepare(
          "INSERT INTO transaksi_kasir_item (transaksi_kasir_id, barang_id, nama_barang, satuan, jumlah, harga_satuan, subtotal) VALUES (?, ?, ?, ?, ?, ?, ?)"
        );
        for (const i of backup.transaksi_kasir_item) {
          const newKasirId  = kasirIdMap.get(i.transaksi_kasir_id) ?? i.transaksi_kasir_id;
          const newBarangId = barangIdMap.get(i.barang_id) ?? i.barang_id;
          stmtKasirItem.run(
            newKasirId, newBarangId,
            i.nama_barang, i.satuan,
            String(i.jumlah), String(i.harga_satuan), String(i.subtotal)
          );
        }
      }

      // ── 9. Perbarui info usaha dari backup ────────────────────────────────
      if (backup.usaha && typeof backup.usaha === "object") {
        sqliteRaw.prepare(
          "UPDATE usaha SET nama_usaha = COALESCE(?, nama_usaha), alamat = ?, telepon = ?, catatan = ? WHERE id = ?"
        ).run(
          backup.usaha.nama_usaha ?? null,
          backup.usaha.alamat    ?? null,
          backup.usaha.telepon   ?? null,
          backup.usaha.catatan   ?? null,
          usahaId
        );
      }
    });

    transact(); // jalankan seluruh transaksi secara sinkron
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[backup/restore] Error dalam transaksi restore:", message, err instanceof Error ? err.stack : "");
    res.status(500).json({ error: `Restore gagal, semua perubahan dibatalkan: ${message}` });
    return;
  }

  res.json({ message: "Restore data berhasil." });
});

export default router;
