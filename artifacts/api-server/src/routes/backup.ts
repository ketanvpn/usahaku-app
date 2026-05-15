import { Router, type IRouter } from "express";
import express from "express";
import { db, sqliteRaw, usahaTable, pelangganTable, hutangTable, pembayaranTable, keuanganTable, barangTable, transaksiStokTable, transaksiKasirTable, transaksiKasirItemTable, pekerjaTable, upahPekerjaTable, bayarUpahTable, pengaturanTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

// Restore JSON bisa besar (data ribuan transaksi). Override body limit 50 MB
// hanya di route ini supaya endpoint lain tetap dibatasi 1 MB di app.ts.
const restoreBodyParser = express.json({ limit: "50mb" });

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
  const pekerjaList         = await db.select().from(pekerjaTable).where(eq(pekerjaTable.usahaId, usahaId));
  const upahList            = await db.select().from(upahPekerjaTable).where(eq(upahPekerjaTable.usahaId, usahaId));
  const bayarUpahList       = await db.select().from(bayarUpahTable).where(eq(bayarUpahTable.usahaId, usahaId));
  const pengaturanList      = await db.select().from(pengaturanTable).where(eq(pengaturanTable.usahaId, usahaId));

  // Ambil semua item kasir sekaligus
  const allKasirItems = transaksiKasirList.length > 0
    ? await Promise.all(transaksiKasirList.map(k =>
        db.select().from(transaksiKasirItemTable).where(eq(transaksiKasirItemTable.transaksiKasirId, k.id))
      ))
    : [];
  const transaksiKasirItemList = allKasirItems.flat();

  // Server menghasilkan payload v1.8 (data + pengaturan key/value, tanpa logo).
  // Client (Electron) akan baca file logo via IPC `pengaturan.getLogoData`
  // setelah menerima response, lalu inject `logo_base64` + `logo_ext` dan
  // bump version ke "1.9" sebelum disimpan ke disk. Lihat
  // `artifacts/hutang-app/src/pages/backup.tsx` (handleExport).
  const backup = {
    version: "1.8",
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
      tanggal_jatuh_tempo: h.tanggalJatuhTempo ?? null,
      keterangan: h.keterangan ?? null,
      nominal_hutang: parseFloat(h.nominalHutang),
      total_dibayar: parseFloat(h.totalDibayar),
      sisa_hutang: parseFloat(h.sisaHutang),
      status: h.status,
      keuangan_id: h.keuanganId ?? null,
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
      diskon: parseFloat(k.diskon ?? "0"),
      uang_bayar: parseFloat(k.uangBayar),
      kembalian: parseFloat(k.kembalian),
      catatan: k.catatan ?? null,
      keuangan_id: k.keuanganId ?? null,
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
    pekerja: pekerjaList.map((p) => ({
      id: p.id,
      usaha_id: p.usahaId,
      pelanggan_id: p.pelangganId ?? null,
      nama: p.nama,
      telepon: p.telepon ?? null,
      jabatan: p.jabatan ?? null,
      catatan: p.catatan ?? null,
      created_at: p.createdAt.toISOString(),
    })),
    upah_pekerja: upahList.map((u) => ({
      id: u.id,
      usaha_id: u.usahaId,
      pekerja_id: u.pekerjaid,
      keterangan: u.keterangan,
      jumlah_total: parseFloat(u.jumlahTotal),
      total_dibayar: parseFloat(u.totalDibayar),
      sisa_upah: parseFloat(u.sisaUpah),
      tanggal_kerja: u.tanggalKerja,
      status: u.status,
      catatan: u.catatan ?? null,
      created_at: u.createdAt.toISOString(),
      updated_at: u.updatedAt.toISOString(),
    })),
    bayar_upah: bayarUpahList.map((b) => ({
      id: b.id,
      usaha_id: b.usahaId,
      upah_id: b.upahId,
      jumlah: parseFloat(b.jumlah),
      tanggal_bayar: b.tanggalBayar,
      keuangan_id: b.keuanganId ?? null,
      pembayaran_id: b.pembayaranId ?? null,
      catatan: b.catatan ?? null,
      created_at: b.createdAt.toISOString(),
    })),
    // v1.8: backup pengaturan (key-value per usaha). File logo TIDAK di-include
    // di sini karena server tidak punya akses ke userData/logos/. Client yang
    // bertugas menempel logo (lihat handleExport di backup.tsx) dan bump versi
    // ke v1.9 saat ada logo. Backup tanpa logo (mis. user belum upload logo)
    // tetap di v1.8.
    pengaturan: pengaturanList.map((p) => ({
      key: p.key,
      value: p.value,
      updated_at: p.updatedAt instanceof Date ? p.updatedAt.toISOString() : new Date(p.updatedAt).toISOString(),
    })),
  };

  res.json(backup);
});

router.post("/backup/restore", restoreBodyParser, requireAuth, async (req, res): Promise<void> => {
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
      sqliteRaw.prepare("DELETE FROM bayar_upah        WHERE usaha_id = ?").run(usahaId);
      sqliteRaw.prepare("DELETE FROM upah_pekerja      WHERE usaha_id = ?").run(usahaId);
      sqliteRaw.prepare("DELETE FROM pekerja           WHERE usaha_id = ?").run(usahaId);
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
        "INSERT INTO hutang (usaha_id, pelanggan_id, tanggal_hutang, tanggal_jatuh_tempo, keterangan, nominal_hutang, total_dibayar, sisa_hutang, status, keuangan_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
      );
      for (const h of backup.hutang) {
        const newPelangganId = pelangganIdMap.get(h.pelanggan_id) ?? h.pelanggan_id;
        const newKeuanganId  = h.keuangan_id != null ? (keuanganIdMap.get(h.keuangan_id) ?? null) : null;
        const r = stmtHutang.run(
          usahaId, newPelangganId,
          h.tanggal_hutang, h.tanggal_jatuh_tempo ?? null,
          h.keterangan ?? null,
          String(h.nominal_hutang), String(h.total_dibayar ?? 0),
          String(h.sisa_hutang), h.status ?? "aktif",
          newKeuanganId ?? null
        );
        hutangIdMap.set(h.id, Number(r.lastInsertRowid));
      }

      // ── 5. Restore pembayaran ──────────────────────────────────────────────
      const pembayaranIdMap = new Map<number, number>();
      const stmtBayar = sqliteRaw.prepare(
        "INSERT INTO pembayaran (usaha_id, hutang_id, pelanggan_id, tanggal_bayar, nominal_bayar, catatan, nomor_kwitansi, sisa_hutang_setelah, keuangan_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
      );
      if (Array.isArray(backup.pembayaran)) {
        for (const p of backup.pembayaran) {
          const newHutangId    = hutangIdMap.get(p.hutang_id) ?? p.hutang_id;
          const newPelangganId = pelangganIdMap.get(p.pelanggan_id) ?? p.pelanggan_id;
          const newKeuanganId  = p.keuangan_id != null ? (keuanganIdMap.get(p.keuangan_id) ?? null) : null;
          const r = stmtBayar.run(
            usahaId, newHutangId, newPelangganId,
            p.tanggal_bayar, String(p.nominal_bayar),
            p.catatan ?? null, p.nomor_kwitansi ?? null,
            p.sisa_hutang_setelah != null ? String(p.sisa_hutang_setelah) : null,
            newKeuanganId ?? null
          );
          pembayaranIdMap.set(p.id, Number(r.lastInsertRowid));
        }
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
          "INSERT INTO transaksi_kasir (usaha_id, tanggal, total, diskon, uang_bayar, kembalian, catatan, keuangan_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
        );
        for (const k of backup.transaksi_kasir) {
          const newKeuanganId = k.keuangan_id != null ? (keuanganIdMap.get(k.keuangan_id) ?? null) : null;
          const r = stmtKasir.run(
            usahaId, k.tanggal,
            String(k.total), String(k.diskon ?? 0),
            String(k.uang_bayar), String(k.kembalian),
            k.catatan ?? null, newKeuanganId ?? null
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

      // ── 9. Restore pekerja — bangun peta ID lama → baru ──────────────────
      const pekerjaIdMap = new Map<number, number>();
      if (Array.isArray(backup.pekerja)) {
        const stmtPekerja = sqliteRaw.prepare(
          "INSERT INTO pekerja (usaha_id, pelanggan_id, nama, telepon, jabatan, catatan) VALUES (?, ?, ?, ?, ?, ?)"
        );
        for (const p of backup.pekerja) {
          const newPelangganId = p.pelanggan_id != null ? (pelangganIdMap.get(p.pelanggan_id) ?? null) : null;
          const r = stmtPekerja.run(
            usahaId, newPelangganId, p.nama, p.telepon ?? null, p.jabatan ?? null, p.catatan ?? null
          );
          pekerjaIdMap.set(p.id, Number(r.lastInsertRowid));
        }
      }

      // ── 10. Restore upah_pekerja — bangun peta ID lama → baru ─────────────
      const upahIdMap = new Map<number, number>();
      if (Array.isArray(backup.upah_pekerja)) {
        const stmtUpah = sqliteRaw.prepare(
          "INSERT INTO upah_pekerja (usaha_id, pekerja_id, keterangan, jumlah_total, total_dibayar, sisa_upah, tanggal_kerja, status, catatan) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
        );
        for (const u of backup.upah_pekerja) {
          const newPekerjaId = pekerjaIdMap.get(u.pekerja_id) ?? u.pekerja_id;
          const r = stmtUpah.run(
            usahaId, newPekerjaId, u.keterangan,
            String(u.jumlah_total), String(u.total_dibayar ?? 0),
            String(u.sisa_upah), u.tanggal_kerja,
            u.status ?? "belum_lunas", u.catatan ?? null
          );
          upahIdMap.set(u.id, Number(r.lastInsertRowid));
        }
      }

      // ── 11. Restore bayar_upah ────────────────────────────────────────────
      if (Array.isArray(backup.bayar_upah)) {
        const stmtBayarUpah = sqliteRaw.prepare(
          "INSERT INTO bayar_upah (usaha_id, upah_id, jumlah, tanggal_bayar, keuangan_id, pembayaran_id, catatan) VALUES (?, ?, ?, ?, ?, ?, ?)"
        );
        for (const b of backup.bayar_upah) {
          const newUpahId     = upahIdMap.get(b.upah_id) ?? b.upah_id;
          const newKeuanganId = b.keuangan_id != null ? (keuanganIdMap.get(b.keuangan_id) ?? null) : null;
          const newPembayaranId = b.pembayaran_id != null ? (pembayaranIdMap.get(b.pembayaran_id) ?? null) : null;
          stmtBayarUpah.run(
            usahaId, newUpahId, String(b.jumlah),
            b.tanggal_bayar, newKeuanganId ?? null, newPembayaranId ?? null, b.catatan ?? null
          );
        }
      }

      // ── 12. Perbarui info usaha dari backup ───────────────────────────────
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

      // ── 13. Restore pengaturan (v1.8+) ────────────────────────────────────
      // Backup lama (v1.7) tidak punya field ini — dilewati. Backup v1.8 akan
      // mengganti semua pengaturan untuk usaha ini.
      if (Array.isArray(backup.pengaturan)) {
        sqliteRaw.prepare("DELETE FROM pengaturan WHERE usaha_id = ?").run(usahaId);
        const stmtPengaturan = sqliteRaw.prepare(
          "INSERT INTO pengaturan (usaha_id, key, value) VALUES (?, ?, ?)"
        );
        // Whitelist key di sini juga, mirroring routes/pengaturan.ts. Kalau backup
        // dari versi yang lebih baru bawa key tambahan, kita simpan apa adanya
        // (forward-compat). Hanya validasi tipe.
        for (const p of backup.pengaturan) {
          if (typeof p?.key !== "string" || p.key.length === 0 || p.key.length > 64) continue;
          if (p.value !== null && typeof p.value !== "string") continue;
          stmtPengaturan.run(usahaId, p.key, p.value ?? null);
        }
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
