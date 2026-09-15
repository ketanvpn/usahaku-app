import express from "express";
import { sqliteRaw } from "@workspace/db";
import type { Request, Response } from "express";
import { mapOptionalId, mapRequiredId, validateRefs } from "./backup-id-mapper";
import { BackupSchema } from "./backup-schemas";
import type { z } from "zod";

// ── Types ────────────────────────────────────────────────────────────────────
type BackupData = z.infer<typeof BackupSchema>;
type DB = typeof sqliteRaw;

/** Running counter per table — returned in success response. */
interface RestoreStats {
  keuangan: number;
  pelanggan: number;
  barang: number;
  hutang: number;
  pembayaran: number;
  suppliers: number;
  transaksi_stok: number;
  transaksi_kasir: number;
  transaksi_kasir_item: number;
  pekerja: number;
  upah_pekerja: number;
  bayar_upah: number;
  pengaturan: number;
}

// Restore JSON bisa besar (data ribuan transaksi). Override body limit 10 MB
// hanya di route ini supaya endpoint lain tetap dibatasi 1 MB di app.ts.
export const restoreBodyParser = express.json({ limit: "10mb" });

// ── Pre-validation ───────────────────────────────────────────────────────────
// Checks referential integrity BEFORE any destructive DELETE.
// If backup data has broken references (e.g. hutang pointing to non-existent
// pelanggan), we reject early with a clear error listing all problems.

function preValidateBackup(data: BackupData): string[] {
  const keuanganIds = new Set(data.keuangan.map((k) => k.id));
  const pelangganIds = new Set(data.pelanggan.map((p) => p.id));
  const barangIds = new Set(data.barang.map((b) => b.id));
  const hutangIds = new Set(data.hutang.map((h) => h.id));
  const pembayaranIds = new Set(data.pembayaran.map((p) => p.id));
  const supplierIds = new Set(data.suppliers.map((s) => s.id));
  const kasirIds = new Set(data.transaksi_kasir.map((k) => k.id));
  const pekerjaIds = new Set(data.pekerja.map((p) => p.id));
  const upahIds = new Set(data.upah_pekerja.map((u) => u.id));

  const errors = validateRefs([
    // hutang → pelanggan (required), keuangan (optional)
    { table: "hutang", field: "pelanggan_id", validIds: pelangganIds, rows: data.hutang, required: true },
    { table: "hutang", field: "keuangan_id", validIds: keuanganIds, rows: data.hutang, required: false },
    // pembayaran → hutang (required), pelanggan (required), keuangan (optional)
    { table: "pembayaran", field: "hutang_id", validIds: hutangIds, rows: data.pembayaran, required: true },
    { table: "pembayaran", field: "pelanggan_id", validIds: pelangganIds, rows: data.pembayaran, required: true },
    { table: "pembayaran", field: "keuangan_id", validIds: keuanganIds, rows: data.pembayaran, required: false },
    // transaksi_stok → barang (required), keuangan (optional), supplier (optional)
    { table: "transaksi_stok", field: "barang_id", validIds: barangIds, rows: data.transaksi_stok, required: true },
    { table: "transaksi_stok", field: "keuangan_id", validIds: keuanganIds, rows: data.transaksi_stok, required: false },
    { table: "transaksi_stok", field: "supplier_id", validIds: supplierIds, rows: data.transaksi_stok, required: false },
    // transaksi_kasir → keuangan (optional)
    { table: "transaksi_kasir", field: "keuangan_id", validIds: keuanganIds, rows: data.transaksi_kasir, required: false },
    // transaksi_kasir_item → transaksi_kasir (required), barang (required)
    { table: "transaksi_kasir_item", field: "transaksi_kasir_id", validIds: kasirIds, rows: data.transaksi_kasir_item, required: true },
    { table: "transaksi_kasir_item", field: "barang_id", validIds: barangIds, rows: data.transaksi_kasir_item, required: true },
    // pekerja → pelanggan (optional)
    { table: "pekerja", field: "pelanggan_id", validIds: pelangganIds, rows: data.pekerja, required: false },
    // upah_pekerja → pekerja (required)
    { table: "upah_pekerja", field: "pekerja_id", validIds: pekerjaIds, rows: data.upah_pekerja, required: true },
    // bayar_upah → upah (required), keuangan (optional), pembayaran (optional)
    { table: "bayar_upah", field: "upah_id", validIds: upahIds, rows: data.bayar_upah, required: true },
    { table: "bayar_upah", field: "keuangan_id", validIds: keuanganIds, rows: data.bayar_upah, required: false },
    { table: "bayar_upah", field: "pembayaran_id", validIds: pembayaranIds, rows: data.bayar_upah, required: false },
  ]);

  return errors.map((e) => e.message);
}

// ── Step helpers ─────────────────────────────────────────────────────────────
// Each function restores one table and returns the old→new ID map (if needed).

function deleteOldData(db: DB, usahaId: number): void {
  // Urutan penting: child tables dulu karena FK constraints.
  const kasirIds = db.prepare("SELECT id FROM transaksi_kasir WHERE usaha_id = ?").all(usahaId) as Array<{ id: number }>;
  const stmtDelKasirItem = db.prepare("DELETE FROM transaksi_kasir_item WHERE transaksi_kasir_id = ?");
  for (const k of kasirIds) stmtDelKasirItem.run(k.id);

  const tables = [
    "transaksi_kasir", "transaksi_stok", "bayar_upah", "upah_pekerja",
    "pekerja", "pembayaran", "hutang", "barang", "pelanggan", "keuangan", "suppliers",
  ];
  for (const table of tables) {
    db.prepare(`DELETE FROM ${table} WHERE usaha_id = ?`).run(usahaId);
  }
}

function restoreKeuangan(db: DB, usahaId: number, rows: BackupData["keuangan"]): Map<number, number> {
  const idMap = new Map<number, number>();
  const stmt = db.prepare("INSERT INTO keuangan (usaha_id, tanggal, tipe, kategori, keterangan, jumlah) VALUES (?, ?, ?, ?, ?, ?)");
  for (const k of rows) {
    const r = stmt.run(usahaId, k.tanggal, k.tipe, k.kategori ?? null, k.keterangan ?? "", String(k.jumlah));
    idMap.set(k.id, Number(r.lastInsertRowid));
  }
  return idMap;
}

function restorePelanggan(db: DB, usahaId: number, rows: BackupData["pelanggan"]): Map<number, number> {
  const idMap = new Map<number, number>();
  const stmt = db.prepare("INSERT INTO pelanggan (usaha_id, nama, telepon, alamat, catatan) VALUES (?, ?, ?, ?, ?)");
  for (const p of rows) {
    const r = stmt.run(usahaId, p.nama, p.telepon ?? null, p.alamat ?? null, p.catatan ?? null);
    idMap.set(p.id, Number(r.lastInsertRowid));
  }
  return idMap;
}

function restoreBarang(db: DB, usahaId: number, rows: BackupData["barang"]): Map<number, number> {
  const idMap = new Map<number, number>();
  const stmt = db.prepare("INSERT INTO barang (usaha_id, nama, satuan, harga_beli, harga_jual, stok, stok_minimum, kategori) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
  for (const b of rows) {
    const r = stmt.run(usahaId, b.nama, b.satuan, String(b.harga_beli), String(b.harga_jual), String(b.stok), String(b.stok_minimum), b.kategori ?? "");
    idMap.set(b.id, Number(r.lastInsertRowid));
  }
  return idMap;
}

function restoreHutang(
  db: DB, usahaId: number, rows: BackupData["hutang"],
  pelangganIdMap: Map<number, number>, keuanganIdMap: Map<number, number>,
): Map<number, number> {
  const idMap = new Map<number, number>();
  const stmt = db.prepare("INSERT INTO hutang (usaha_id, pelanggan_id, tanggal_hutang, tanggal_jatuh_tempo, keterangan, nominal_hutang, total_dibayar, sisa_hutang, status, keuangan_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
  for (const h of rows) {
    const newPelangganId = mapRequiredId(pelangganIdMap, h.pelanggan_id, "hutang", "pelanggan_id");
    const newKeuanganId = mapOptionalId(keuanganIdMap, h.keuangan_id);
    const r = stmt.run(usahaId, newPelangganId, h.tanggal_hutang, h.tanggal_jatuh_tempo ?? null, h.keterangan ?? null, String(h.nominal_hutang), String(h.total_dibayar ?? 0), String(h.sisa_hutang), h.status ?? "aktif", newKeuanganId ?? null);
    idMap.set(h.id, Number(r.lastInsertRowid));
  }
  return idMap;
}

function restorePembayaran(
  db: DB, usahaId: number, rows: BackupData["pembayaran"],
  hutangIdMap: Map<number, number>, pelangganIdMap: Map<number, number>, keuanganIdMap: Map<number, number>,
): Map<number, number> {
  const idMap = new Map<number, number>();
  const stmt = db.prepare("INSERT INTO pembayaran (usaha_id, hutang_id, pelanggan_id, tanggal_bayar, nominal_bayar, catatan, nomor_kwitansi, sisa_hutang_setelah, keuangan_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)");
  for (const p of rows) {
    const newHutangId = mapRequiredId(hutangIdMap, p.hutang_id, "pembayaran", "hutang_id");
    const newPelangganId = mapRequiredId(pelangganIdMap, p.pelanggan_id, "pembayaran", "pelanggan_id");
    const newKeuanganId = mapOptionalId(keuanganIdMap, p.keuangan_id);
    const r = stmt.run(usahaId, newHutangId, newPelangganId, p.tanggal_bayar, String(p.nominal_bayar), p.catatan ?? null, p.nomor_kwitansi ?? null, p.sisa_hutang_setelah != null ? String(p.sisa_hutang_setelah) : null, newKeuanganId ?? null);
    idMap.set(p.id, Number(r.lastInsertRowid));
  }
  return idMap;
}

function restoreSuppliers(db: DB, usahaId: number, rows: BackupData["suppliers"]): Map<number, number> {
  const idMap = new Map<number, number>();
  const stmt = db.prepare("INSERT INTO suppliers (usaha_id, nama, telepon, alamat, catatan) VALUES (?, ?, ?, ?, ?)");
  for (const s of rows) {
    if (typeof s?.nama !== "string" || s.nama.length === 0) continue;
    const r = stmt.run(usahaId, s.nama, s.telepon ?? null, s.alamat ?? null, s.catatan ?? null);
    idMap.set(s.id, Number(r.lastInsertRowid));
  }
  return idMap;
}

function restoreTransaksiStok(
  db: DB, usahaId: number, rows: BackupData["transaksi_stok"],
  barangIdMap: Map<number, number>, keuanganIdMap: Map<number, number>, supplierIdMap: Map<number, number>,
): number {
  const stmt = db.prepare("INSERT INTO transaksi_stok (usaha_id, barang_id, tanggal, tipe, jumlah, harga_satuan, keterangan, keuangan_id, supplier_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)");
  let count = 0;
  for (const t of rows) {
    const newBarangId = mapRequiredId(barangIdMap, t.barang_id, "transaksi_stok", "barang_id");
    const newKeuanganId = mapOptionalId(keuanganIdMap, t.keuangan_id);
    const newSupplierId = mapOptionalId(supplierIdMap, t.supplier_id);
    stmt.run(usahaId, newBarangId, t.tanggal, t.tipe, String(t.jumlah), String(t.harga_satuan), t.keterangan ?? null, newKeuanganId ?? null, newSupplierId ?? null);
    count++;
  }
  return count;
}

function restoreTransaksiKasir(
  db: DB, usahaId: number, rows: BackupData["transaksi_kasir"],
  keuanganIdMap: Map<number, number>,
): Map<number, number> {
  const idMap = new Map<number, number>();
  const stmt = db.prepare("INSERT INTO transaksi_kasir (usaha_id, tanggal, total, diskon, uang_bayar, kembalian, catatan, keuangan_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
  for (const k of rows) {
    const newKeuanganId = mapOptionalId(keuanganIdMap, k.keuangan_id);
    const r = stmt.run(usahaId, k.tanggal, String(k.total), String(k.diskon ?? 0), String(k.uang_bayar), String(k.kembalian), k.catatan ?? null, newKeuanganId ?? null);
    idMap.set(k.id, Number(r.lastInsertRowid));
  }
  return idMap;
}

function restoreTransaksiKasirItem(
  db: DB, rows: BackupData["transaksi_kasir_item"],
  kasirIdMap: Map<number, number>, barangIdMap: Map<number, number>,
): number {
  const stmt = db.prepare("INSERT INTO transaksi_kasir_item (transaksi_kasir_id, barang_id, nama_barang, satuan, jumlah, harga_satuan, harga_beli, subtotal) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
  let count = 0;
  for (const i of rows) {
    const newKasirId = mapRequiredId(kasirIdMap, i.transaksi_kasir_id, "transaksi_kasir_item", "transaksi_kasir_id");
    const newBarangId = mapRequiredId(barangIdMap, i.barang_id, "transaksi_kasir_item", "barang_id");
    stmt.run(newKasirId, newBarangId, i.nama_barang, i.satuan, String(i.jumlah), String(i.harga_satuan), i.harga_beli != null ? String(i.harga_beli) : null, String(i.subtotal));
    count++;
  }
  return count;
}

function restorePekerja(
  db: DB, usahaId: number, rows: BackupData["pekerja"],
  pelangganIdMap: Map<number, number>,
): Map<number, number> {
  const idMap = new Map<number, number>();
  const stmt = db.prepare("INSERT INTO pekerja (usaha_id, pelanggan_id, nama, telepon, jabatan, catatan) VALUES (?, ?, ?, ?, ?, ?)");
  for (const p of rows) {
    const newPelangganId = mapOptionalId(pelangganIdMap, p.pelanggan_id);
    const r = stmt.run(usahaId, newPelangganId, p.nama, p.telepon ?? null, p.jabatan ?? null, p.catatan ?? null);
    idMap.set(p.id, Number(r.lastInsertRowid));
  }
  return idMap;
}

function restoreUpahPekerja(
  db: DB, usahaId: number, rows: BackupData["upah_pekerja"],
  pekerjaIdMap: Map<number, number>,
): Map<number, number> {
  const idMap = new Map<number, number>();
  const stmt = db.prepare("INSERT INTO upah_pekerja (usaha_id, pekerja_id, keterangan, jumlah_total, total_dibayar, sisa_upah, tanggal_kerja, status, catatan) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)");
  for (const u of rows) {
    const newPekerjaId = mapRequiredId(pekerjaIdMap, u.pekerja_id, "upah_pekerja", "pekerja_id");
    const r = stmt.run(usahaId, newPekerjaId, u.keterangan, String(u.jumlah_total), String(u.total_dibayar ?? 0), String(u.sisa_upah), u.tanggal_kerja, u.status ?? "belum_lunas", u.catatan ?? null);
    idMap.set(u.id, Number(r.lastInsertRowid));
  }
  return idMap;
}

function restoreBayarUpah(
  db: DB, usahaId: number, rows: BackupData["bayar_upah"],
  upahIdMap: Map<number, number>, keuanganIdMap: Map<number, number>, pembayaranIdMap: Map<number, number>,
): number {
  const stmt = db.prepare("INSERT INTO bayar_upah (usaha_id, upah_id, jumlah, tanggal_bayar, keuangan_id, pembayaran_id, catatan) VALUES (?, ?, ?, ?, ?, ?, ?)");
  let count = 0;
  for (const b of rows) {
    const newUpahId = mapRequiredId(upahIdMap, b.upah_id, "bayar_upah", "upah_id");
    const newKeuanganId = mapOptionalId(keuanganIdMap, b.keuangan_id);
    const newPembayaranId = mapOptionalId(pembayaranIdMap, b.pembayaran_id);
    stmt.run(usahaId, newUpahId, String(b.jumlah), b.tanggal_bayar, newKeuanganId ?? null, newPembayaranId ?? null, b.catatan ?? null);
    count++;
  }
  return count;
}

function restoreUsaha(db: DB, usahaId: number, usaha: BackupData["usaha"]): void {
  if (!usaha) return;
  db.prepare("UPDATE usaha SET nama_usaha = COALESCE(?, nama_usaha), alamat = ?, telepon = ?, catatan = ? WHERE id = ?")
    .run(usaha.nama_usaha ?? null, usaha.alamat ?? null, usaha.telepon ?? null, usaha.catatan ?? null, usahaId);
}

function restorePengaturan(db: DB, usahaId: number, rows: BackupData["pengaturan"]): number {
  db.prepare("DELETE FROM pengaturan WHERE usaha_id = ?").run(usahaId);
  const stmt = db.prepare("INSERT INTO pengaturan (usaha_id, key, value) VALUES (?, ?, ?)");
  let count = 0;
  for (const p of rows) {
    if (typeof p?.key !== "string" || p.key.length === 0 || p.key.length > 64) continue;
    if (p.value !== null && typeof p.value !== "string") continue;
    stmt.run(usahaId, p.key, p.value ?? null);
    count++;
  }
  return count;
}

// ── Main handler ─────────────────────────────────────────────────────────────

export async function handleRestore(req: Request, res: Response): Promise<void> {
  const usahaId = req.session.usahaId;
  if (!usahaId) {
    res.status(403).json({ error: "Akses ditolak." });
    return;
  }

  // ── 1. Parse & validate structure (Zod) ──────────────────────────────────
  const parseResult = BackupSchema.safeParse(req.body);
  if (!parseResult.success) {
    const errors = parseResult.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`);
    res.status(400).json({ error: "Data backup tidak valid. Periksa format file.", details: errors.slice(0, 20) });
    return;
  }
  const backup = parseResult.data;

  // ── 2. Pre-validate referential integrity BEFORE any destructive op ──────
  const refErrors = preValidateBackup(backup);
  if (refErrors.length > 0) {
    console.error("[backup/restore] Pre-validation gagal:", refErrors);
    res.status(400).json({
      error: "Data backup memiliki referensi yang tidak valid. Tidak ada data yang diubah.",
      details: refErrors.slice(0, 30),
    });
    return;
  }

  // ── 3. Execute atomic restore inside a single transaction ────────────────
  // PENTING: Drizzle + better-sqlite3 bersifat SINKRON.
  // db.transaction(async ...) tidak didukung — akan throw
  // "Transaction function cannot return a promise".
  // Solusi: gunakan sqliteRaw.transaction() (better-sqlite3 native) dengan
  // callback sinkron.
  let currentStep = "persiapan restore";
  const stats: RestoreStats = {
    keuangan: 0, pelanggan: 0, barang: 0, hutang: 0, pembayaran: 0,
    suppliers: 0, transaksi_stok: 0, transaksi_kasir: 0,
    transaksi_kasir_item: 0, pekerja: 0, upah_pekerja: 0,
    bayar_upah: 0, pengaturan: 0,
  };

  try {
    const transact = sqliteRaw.transaction(() => {
      // ── Hapus data lama (urutan: child → parent karena FK) ──────────────
      currentStep = "penghapusan data lama";
      deleteOldData(sqliteRaw, usahaId);

      // ── Insert baru (urutan: parent → child untuk ID mapping) ──────────
      currentStep = "keuangan";
      const keuanganIdMap = restoreKeuangan(sqliteRaw, usahaId, backup.keuangan);
      stats.keuangan = keuanganIdMap.size;

      currentStep = "pelanggan";
      const pelangganIdMap = restorePelanggan(sqliteRaw, usahaId, backup.pelanggan);
      stats.pelanggan = pelangganIdMap.size;

      currentStep = "barang";
      const barangIdMap = restoreBarang(sqliteRaw, usahaId, backup.barang);
      stats.barang = barangIdMap.size;

      currentStep = "hutang";
      const hutangIdMap = restoreHutang(sqliteRaw, usahaId, backup.hutang, pelangganIdMap, keuanganIdMap);
      stats.hutang = hutangIdMap.size;

      currentStep = "pembayaran";
      const pembayaranIdMap = restorePembayaran(sqliteRaw, usahaId, backup.pembayaran, hutangIdMap, pelangganIdMap, keuanganIdMap);
      stats.pembayaran = pembayaranIdMap.size;

      currentStep = "suppliers";
      const supplierIdMap = restoreSuppliers(sqliteRaw, usahaId, backup.suppliers);
      stats.suppliers = supplierIdMap.size;

      currentStep = "transaksi_stok";
      stats.transaksi_stok = restoreTransaksiStok(sqliteRaw, usahaId, backup.transaksi_stok, barangIdMap, keuanganIdMap, supplierIdMap);

      currentStep = "transaksi_kasir";
      const kasirIdMap = restoreTransaksiKasir(sqliteRaw, usahaId, backup.transaksi_kasir, keuanganIdMap);
      stats.transaksi_kasir = kasirIdMap.size;

      currentStep = "transaksi_kasir_item";
      stats.transaksi_kasir_item = restoreTransaksiKasirItem(sqliteRaw, backup.transaksi_kasir_item, kasirIdMap, barangIdMap);

      currentStep = "pekerja";
      const pekerjaIdMap = restorePekerja(sqliteRaw, usahaId, backup.pekerja, pelangganIdMap);
      stats.pekerja = pekerjaIdMap.size;

      currentStep = "upah_pekerja";
      const upahIdMap = restoreUpahPekerja(sqliteRaw, usahaId, backup.upah_pekerja, pekerjaIdMap);
      stats.upah_pekerja = upahIdMap.size;

      currentStep = "bayar_upah";
      stats.bayar_upah = restoreBayarUpah(sqliteRaw, usahaId, backup.bayar_upah, upahIdMap, keuanganIdMap, pembayaranIdMap);

      currentStep = "usaha";
      restoreUsaha(sqliteRaw, usahaId, backup.usaha);

      currentStep = "pengaturan";
      stats.pengaturan = restorePengaturan(sqliteRaw, usahaId, backup.pengaturan);
    });

    transact(); // jalankan seluruh transaksi secara sinkron
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[backup/restore] Error saat restore step "${currentStep}":`, message, err instanceof Error ? err.stack : "");
    res.status(500).json({ error: `Restore gagal pada tahap "${currentStep}", semua perubahan dibatalkan: ${message}` });
    return;
  }

  console.log("[backup/restore] Restore berhasil:", stats);
  res.json({ message: "Restore data berhasil.", stats });
}
