import express from "express";
import { sqliteRaw } from "@workspace/db";
import type { Request, Response } from "express";
import { mapOptionalId, mapRequiredId } from "./backup-id-mapper";
import { BackupSchema } from "./backup-schemas";

// Restore JSON bisa besar (data ribuan transaksi). Override body limit 10 MB
// hanya di route ini supaya endpoint lain tetap dibatasi 1 MB di app.ts.
export const restoreBodyParser = express.json({ limit: "10mb" });

export async function handleRestore(req: Request, res: Response): Promise<void> {
  const usahaId = req.session.usahaId;
  if (!usahaId) {
    res.status(403).json({ error: "Akses ditolak." });
    return;
  }

  const parseResult = BackupSchema.safeParse(req.body);
  if (!parseResult.success) {
    const errors = parseResult.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`);
    res.status(400).json({ error: "Data backup tidak valid. Periksa format file.", details: errors.slice(0, 20) });
    return;
  }
  const validatedBackup = parseResult.data;

  // usaha_id di dalam file backup tidak harus sama dengan usaha aktif —
  // semua data akan di-map ke usaha yang sedang login (mendukung pindah PC / install baru)
  // PENTING: Drizzle + better-sqlite3 bersifat SINKRON.
  // db.transaction(async ...) tidak didukung — akan throw "Transaction function cannot return a promise".
  // Solusi: gunakan sqliteRaw.transaction() (better-sqlite3 native) dengan callback sinkron.
  let currentTable = "persiapan restore";
  try {
    const transact = sqliteRaw.transaction(() => {
      currentTable = "penghapusan data lama";
      // ── Hapus semua data lama (urutan penting karena foreign key) ───────────
      // Hapus item kasir dulu (child dari transaksi_kasir)
      const kasirIds = (sqliteRaw.prepare("SELECT id FROM transaksi_kasir WHERE usaha_id = ?").all(usahaId) as Array<{ id: number }>);
      const stmtDelKasirItem = sqliteRaw.prepare("DELETE FROM transaksi_kasir_item WHERE transaksi_kasir_id = ?");
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
      // v1.10: hapus suppliers juga (dependent: transaksi_stok.supplier_id sudah dihapus di atas)
      sqliteRaw.prepare("DELETE FROM suppliers         WHERE usaha_id = ?").run(usahaId);

      // ── 1. Restore keuangan — bangun peta ID lama → baru ──────────────────
      currentTable = "keuangan";
      const keuanganIdMap = new Map<number, number>();
      if (Array.isArray(validatedBackup.keuangan)) {
        const stmtKeu = sqliteRaw.prepare("INSERT INTO keuangan (usaha_id, tanggal, tipe, kategori, keterangan, jumlah) VALUES (?, ?, ?, ?, ?, ?)");
        for (const k of validatedBackup.keuangan) {
          const r = stmtKeu.run(usahaId, k.tanggal, k.tipe, k.kategori ?? null, k.keterangan ?? "", String(k.jumlah));
          keuanganIdMap.set(k.id, Number(r.lastInsertRowid));
        }
      }
      // ── 2. Restore pelanggan — bangun peta ID lama → baru ─────────────────
      currentTable = "pelanggan";
      const pelangganIdMap = new Map<number, number>();
      const stmtPel = sqliteRaw.prepare("INSERT INTO pelanggan (usaha_id, nama, telepon, alamat, catatan) VALUES (?, ?, ?, ?, ?)");
      for (const p of validatedBackup.pelanggan) {
        const r = stmtPel.run(usahaId, p.nama, p.telepon ?? null, p.alamat ?? null, p.catatan ?? null);
        pelangganIdMap.set(p.id, Number(r.lastInsertRowid));
      }
      // ── 3. Restore barang — bangun peta ID lama → baru ────────────────────
      currentTable = "barang";
      const barangIdMap = new Map<number, number>();
      if (Array.isArray(validatedBackup.barang)) {
        const stmtBar = sqliteRaw.prepare("INSERT INTO barang (usaha_id, nama, satuan, harga_beli, harga_jual, stok, stok_minimum, kategori) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
        for (const b of validatedBackup.barang) {
          const r = stmtBar.run(usahaId, b.nama, b.satuan, String(b.harga_beli), String(b.harga_jual), String(b.stok), String(b.stok_minimum), b.kategori ?? "");
          barangIdMap.set(b.id, Number(r.lastInsertRowid));
        }
      }
      // ── 4. Restore hutang — bangun peta ID lama → baru ────────────────────
      currentTable = "hutang";
      const hutangIdMap = new Map<number, number>();
      const stmtHutang = sqliteRaw.prepare("INSERT INTO hutang (usaha_id, pelanggan_id, tanggal_hutang, tanggal_jatuh_tempo, keterangan, nominal_hutang, total_dibayar, sisa_hutang, status, keuangan_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
      for (const h of validatedBackup.hutang) {
        const newPelangganId = mapRequiredId(pelangganIdMap, h.pelanggan_id, "hutang", "pelanggan_id");
        const newKeuanganId = mapOptionalId(keuanganIdMap, h.keuangan_id);
        const r = stmtHutang.run(usahaId, newPelangganId, h.tanggal_hutang, h.tanggal_jatuh_tempo ?? null, h.keterangan ?? null, String(h.nominal_hutang), String(h.total_dibayar ?? 0), String(h.sisa_hutang), h.status ?? "aktif", newKeuanganId ?? null);
        hutangIdMap.set(h.id, Number(r.lastInsertRowid));
      }
      // ── 5. Restore pembayaran ──────────────────────────────────────────────
      currentTable = "pembayaran";
      const pembayaranIdMap = new Map<number, number>();
      const stmtBayar = sqliteRaw.prepare("INSERT INTO pembayaran (usaha_id, hutang_id, pelanggan_id, tanggal_bayar, nominal_bayar, catatan, nomor_kwitansi, sisa_hutang_setelah, keuangan_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)");
      if (Array.isArray(validatedBackup.pembayaran)) {
        for (const p of validatedBackup.pembayaran) {
          const newHutangId = mapRequiredId(hutangIdMap, p.hutang_id, "pembayaran", "hutang_id");
          const newPelangganId = mapRequiredId(pelangganIdMap, p.pelanggan_id, "pembayaran", "pelanggan_id");
          const newKeuanganId = mapOptionalId(keuanganIdMap, p.keuangan_id);
          const r = stmtBayar.run(usahaId, newHutangId, newPelangganId, p.tanggal_bayar, String(p.nominal_bayar), p.catatan ?? null, p.nomor_kwitansi ?? null, p.sisa_hutang_setelah != null ? String(p.sisa_hutang_setelah) : null, newKeuanganId ?? null);
          pembayaranIdMap.set(p.id, Number(r.lastInsertRowid));
        }
      }
      // ── 5b. Restore suppliers (v1.10+) — bangun peta ID lama → baru ────────
      currentTable = "suppliers";
      // Backup v1.7-v1.9 tidak punya field ini → dilewati, transaksi_stok
      // baru tidak akan punya supplier (default null).
      const supplierIdMap = new Map<number, number>();
      if (Array.isArray(validatedBackup.suppliers)) {
        const stmtSup = sqliteRaw.prepare("INSERT INTO suppliers (usaha_id, nama, telepon, alamat, catatan) VALUES (?, ?, ?, ?, ?)");
        for (const s of validatedBackup.suppliers) {
          if (typeof s?.nama !== "string" || s.nama.length === 0) continue;
          const r = stmtSup.run(usahaId, s.nama, s.telepon ?? null, s.alamat ?? null, s.catatan ?? null);
          supplierIdMap.set(s.id, Number(r.lastInsertRowid));
        }
      }
      // ── 6. Restore transaksi stok ──────────────────────────────────────────
      currentTable = "transaksi_stok";
      if (Array.isArray(validatedBackup.transaksi_stok)) {
        const stmtStok = sqliteRaw.prepare("INSERT INTO transaksi_stok (usaha_id, barang_id, tanggal, tipe, jumlah, harga_satuan, keterangan, keuangan_id, supplier_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)");
        for (const t of validatedBackup.transaksi_stok) {
          const newBarangId = mapRequiredId(barangIdMap, t.barang_id, "transaksi_stok", "barang_id");
          const newKeuanganId = mapOptionalId(keuanganIdMap, t.keuangan_id);
          // v1.10+: map supplier_id lama → baru. Kalau backup lama (tanpa supplier)
          // atau ID tidak ada di peta (kasus aneh), pakai null.
          const newSupplierId = mapOptionalId(supplierIdMap, t.supplier_id);
          stmtStok.run(usahaId, newBarangId, t.tanggal, t.tipe, String(t.jumlah), String(t.harga_satuan), t.keterangan ?? null, newKeuanganId ?? null, newSupplierId ?? null);
        }
      }
      // ── 7. Restore transaksi kasir — bangun peta ID lama → baru ───────────
      currentTable = "transaksi_kasir";
      const kasirIdMap = new Map<number, number>();
      if (Array.isArray(validatedBackup.transaksi_kasir)) {
        const stmtKasir = sqliteRaw.prepare("INSERT INTO transaksi_kasir (usaha_id, tanggal, total, diskon, uang_bayar, kembalian, catatan, keuangan_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
        for (const k of validatedBackup.transaksi_kasir) {
          const newKeuanganId = mapOptionalId(keuanganIdMap, k.keuangan_id);
          const r = stmtKasir.run(usahaId, k.tanggal, String(k.total), String(k.diskon ?? 0), String(k.uang_bayar), String(k.kembalian), k.catatan ?? null, newKeuanganId ?? null);
          kasirIdMap.set(k.id, Number(r.lastInsertRowid));
        }
      }
      // ── 8. Restore item kasir ──────────────────────────────────────────────
      currentTable = "transaksi_kasir_item";
      if (Array.isArray(validatedBackup.transaksi_kasir_item)) {
        const stmtKasirItem = sqliteRaw.prepare("INSERT INTO transaksi_kasir_item (transaksi_kasir_id, barang_id, nama_barang, satuan, jumlah, harga_satuan, harga_beli, subtotal) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
        for (const i of validatedBackup.transaksi_kasir_item) {
          const newKasirId = mapRequiredId(kasirIdMap, i.transaksi_kasir_id, "transaksi_kasir_item", "transaksi_kasir_id");
          const newBarangId = mapRequiredId(barangIdMap, i.barang_id, "transaksi_kasir_item", "barang_id");
          stmtKasirItem.run(newKasirId, newBarangId, i.nama_barang, i.satuan, String(i.jumlah), String(i.harga_satuan), i.harga_beli != null ? String(i.harga_beli) : null, String(i.subtotal));
        }
      }
      // ── 9. Restore pekerja — bangun peta ID lama → baru ──────────────────
      currentTable = "pekerja";
      const pekerjaIdMap = new Map<number, number>();
      if (Array.isArray(validatedBackup.pekerja)) {
        const stmtPekerja = sqliteRaw.prepare("INSERT INTO pekerja (usaha_id, pelanggan_id, nama, telepon, jabatan, catatan) VALUES (?, ?, ?, ?, ?, ?)");
        for (const p of validatedBackup.pekerja) {
          const newPelangganId = mapOptionalId(pelangganIdMap, p.pelanggan_id);
          const r = stmtPekerja.run(usahaId, newPelangganId, p.nama, p.telepon ?? null, p.jabatan ?? null, p.catatan ?? null);
          pekerjaIdMap.set(p.id, Number(r.lastInsertRowid));
        }
      }
      // ── 10. Restore upah_pekerja — bangun peta ID lama → baru ─────────────
      currentTable = "upah_pekerja";
      const upahIdMap = new Map<number, number>();
      if (Array.isArray(validatedBackup.upah_pekerja)) {
        const stmtUpah = sqliteRaw.prepare("INSERT INTO upah_pekerja (usaha_id, pekerja_id, keterangan, jumlah_total, total_dibayar, sisa_upah, tanggal_kerja, status, catatan) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)");
        for (const u of validatedBackup.upah_pekerja) {
          const newPekerjaId = mapRequiredId(pekerjaIdMap, u.pekerja_id, "upah_pekerja", "pekerja_id");
          const r = stmtUpah.run(usahaId, newPekerjaId, u.keterangan, String(u.jumlah_total), String(u.total_dibayar ?? 0), String(u.sisa_upah), u.tanggal_kerja, u.status ?? "belum_lunas", u.catatan ?? null);
          upahIdMap.set(u.id, Number(r.lastInsertRowid));
        }
      }
      // ── 11. Restore bayar_upah ────────────────────────────────────────────
      currentTable = "bayar_upah";
      if (Array.isArray(validatedBackup.bayar_upah)) {
        const stmtBayarUpah = sqliteRaw.prepare("INSERT INTO bayar_upah (usaha_id, upah_id, jumlah, tanggal_bayar, keuangan_id, pembayaran_id, catatan) VALUES (?, ?, ?, ?, ?, ?, ?)");
        for (const b of validatedBackup.bayar_upah) {
          const newUpahId = mapRequiredId(upahIdMap, b.upah_id, "bayar_upah", "upah_id");
          const newKeuanganId = mapOptionalId(keuanganIdMap, b.keuangan_id);
          const newPembayaranId = mapOptionalId(pembayaranIdMap, b.pembayaran_id);
          stmtBayarUpah.run(usahaId, newUpahId, String(b.jumlah), b.tanggal_bayar, newKeuanganId ?? null, newPembayaranId ?? null, b.catatan ?? null);
        }
      }
      // ── 12. Perbarui info usaha dari backup ───────────────────────────────
      currentTable = "usaha";
      if (validatedBackup.usaha) {
        sqliteRaw.prepare("UPDATE usaha SET nama_usaha = COALESCE(?, nama_usaha), alamat = ?, telepon = ?, catatan = ? WHERE id = ?").run(validatedBackup.usaha.nama_usaha ?? null, validatedBackup.usaha.alamat ?? null, validatedBackup.usaha.telepon ?? null, validatedBackup.usaha.catatan ?? null, usahaId);
      }
      // ── 13. Restore pengaturan (v1.8+) ────────────────────────────────────
      currentTable = "pengaturan";
      // Backup lama (v1.7) tidak punya field ini — dilewati. Backup v1.8 akan
      // mengganti semua pengaturan untuk usaha ini.
      if (Array.isArray(validatedBackup.pengaturan)) {
        sqliteRaw.prepare("DELETE FROM pengaturan WHERE usaha_id = ?").run(usahaId);
        const stmtPengaturan = sqliteRaw.prepare("INSERT INTO pengaturan (usaha_id, key, value) VALUES (?, ?, ?)");
        // Whitelist key di sini juga, mirroring routes/pengaturan.ts. Kalau backup
        // dari versi yang lebih baru bawa key tambahan, kita simpan apa adanya
        // (forward-compat). Hanya validasi tipe.
        for (const p of validatedBackup.pengaturan) {
          if (typeof p?.key !== "string" || p.key.length === 0 || p.key.length > 64) continue;
          if (p.value !== null && typeof p.value !== "string") continue;
          stmtPengaturan.run(usahaId, p.key, p.value ?? null);
        }
      }
    });
    transact(); // jalankan seluruh transaksi secara sinkron
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[backup/restore] Error saat restore tabel ${currentTable}:`, message, err instanceof Error ? err.stack : "");
    res.status(500).json({ error: `Restore gagal pada tabel ${currentTable}, semua perubahan dibatalkan: ${message}` });
    return;
  }
  res.json({ message: "Restore data berhasil." });
}
