import type { Request, Response } from "express";
import { db, usahaTable, pelangganTable, hutangTable, pembayaranTable, keuanganTable, barangTable, transaksiStokTable, transaksiKasirTable, transaksiKasirItemTable, pekerjaTable, upahPekerjaTable, bayarUpahTable, pengaturanTable, suppliersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { toNum } from "../../utils/money";

export async function handleExport(req: Request, res: Response): Promise<void> {
  const usahaId = req.session.usahaId;
  if (!usahaId) { res.status(403).json({ error: "Akses ditolak." }); return; }
  const [usaha] = await db.select().from(usahaTable).where(eq(usahaTable.id, usahaId));
  if (!usaha) { res.status(404).json({ error: "Usaha tidak ditemukan." }); return; }
  const pelangganList = await db.select().from(pelangganTable).where(eq(pelangganTable.usahaId, usahaId));
  const hutangList = await db.select().from(hutangTable).where(eq(hutangTable.usahaId, usahaId));
  const pembayaranList = await db.select().from(pembayaranTable).where(eq(pembayaranTable.usahaId, usahaId));
  const keuanganList = await db.select().from(keuanganTable).where(eq(keuanganTable.usahaId, usahaId));
  const barangList = await db.select().from(barangTable).where(eq(barangTable.usahaId, usahaId));
  const transaksiStokList = await db.select().from(transaksiStokTable).where(eq(transaksiStokTable.usahaId, usahaId));
  const transaksiKasirList = await db.select().from(transaksiKasirTable).where(eq(transaksiKasirTable.usahaId, usahaId));
  const pekerjaList = await db.select().from(pekerjaTable).where(eq(pekerjaTable.usahaId, usahaId));
  const upahList = await db.select().from(upahPekerjaTable).where(eq(upahPekerjaTable.usahaId, usahaId));
  const bayarUpahList = await db.select().from(bayarUpahTable).where(eq(bayarUpahTable.usahaId, usahaId));
  const pengaturanList = await db.select().from(pengaturanTable).where(eq(pengaturanTable.usahaId, usahaId));
  const suppliersList = await db.select().from(suppliersTable).where(eq(suppliersTable.usahaId, usahaId));
  // Ambil semua item kasir sekaligus
  const allKasirItems = transaksiKasirList.length > 0 ? await Promise.all(transaksiKasirList.map(k => db.select().from(transaksiKasirItemTable).where(eq(transaksiKasirItemTable.transaksiKasirId, k.id)))) : [];
  const transaksiKasirItemList = allKasirItems.flat();
  // Server menghasilkan payload v1.10 (data + pengaturan key/value + suppliers,
  // tanpa logo). Client (Electron) akan baca file logo via IPC
  // `pengaturan.getLogoData` setelah menerima response, lalu inject
  // `logo_base64` + `logo_ext` dan bump version ke "1.11" sebelum disimpan ke
  // disk. Lihat `artifacts/hutang-app/src/pages/backup.tsx` (handleExport).
  //
  // Riwayat format:
  //   v1.7  — sebelum pengaturan
  //   v1.8  — + pengaturan key/value (tanpa logo)
  //   v1.9  — + logo_base64 (client-injected, bukan server)
  //   v1.10 — + suppliers (server)
  //   v1.11 — + logo_base64 (client-injected, di-atas v1.10)
  res.json({ version: "1.10", exported_at: new Date().toISOString(), usaha_id: usahaId,
    usaha: { id: usaha.id, nama_usaha: usaha.namaUsaha, alamat: usaha.alamat ?? null, telepon: usaha.telepon ?? null, catatan: usaha.catatan ?? null, created_at: usaha.createdAt.toISOString() },
    pelanggan: pelangganList.map(p => ({ id: p.id, usaha_id: p.usahaId, nama: p.nama, telepon: p.telepon ?? null, alamat: p.alamat ?? null, catatan: p.catatan ?? null, created_at: p.createdAt.toISOString() })),
    hutang: hutangList.map(h => ({ id: h.id, usaha_id: h.usahaId, pelanggan_id: h.pelangganId, tanggal_hutang: h.tanggalHutang, tanggal_jatuh_tempo: h.tanggalJatuhTempo ?? null, keterangan: h.keterangan ?? null, nominal_hutang: toNum(h.nominalHutang), total_dibayar: toNum(h.totalDibayar), sisa_hutang: toNum(h.sisaHutang), status: h.status, keuangan_id: h.keuanganId ?? null, created_at: h.createdAt.toISOString(), updated_at: h.updatedAt.toISOString() })),
    pembayaran: pembayaranList.map(p => ({ id: p.id, usaha_id: p.usahaId, hutang_id: p.hutangId, pelanggan_id: p.pelangganId, tanggal_bayar: p.tanggalBayar, nominal_bayar: toNum(p.nominalBayar), catatan: p.catatan ?? null, nomor_kwitansi: p.nomorKwitansi ?? null, sisa_hutang_setelah: p.sisaHutangSetelah ? toNum(p.sisaHutangSetelah) : null, keuangan_id: p.keuanganId ?? null, created_at: p.createdAt.toISOString() })),
    keuangan: keuanganList.map(k => ({ id: k.id, usaha_id: k.usahaId, tanggal: k.tanggal, tipe: k.tipe, kategori: k.kategori ?? null, keterangan: k.keterangan, jumlah: toNum(k.jumlah), created_at: k.createdAt.toISOString() })),
    barang: barangList.map(b => ({ id: b.id, usaha_id: b.usahaId, nama: b.nama, satuan: b.satuan, harga_beli: toNum(b.hargaBeli), harga_jual: toNum(b.hargaJual), stok: toNum(b.stok), stok_minimum: toNum(b.stokMinimum), kategori: b.kategori ?? null, created_at: b.createdAt.toISOString() })),
    transaksi_stok: transaksiStokList.map(t => ({ id: t.id, usaha_id: t.usahaId, barang_id: t.barangId, tanggal: t.tanggal, tipe: t.tipe, jumlah: toNum(t.jumlah), harga_satuan: toNum(t.hargaSatuan), keterangan: t.keterangan ?? null, keuangan_id: t.keuanganId ?? null, supplier_id: t.supplierId ?? null, created_at: t.createdAt.toISOString() })),
    transaksi_kasir: transaksiKasirList.map(k => ({ id: k.id, usaha_id: k.usahaId, tanggal: k.tanggal, total: toNum(k.total), diskon: toNum(k.diskon ?? "0"), uang_bayar: toNum(k.uangBayar), kembalian: toNum(k.kembalian), catatan: k.catatan ?? null, keuangan_id: k.keuanganId ?? null, created_at: k.createdAt instanceof Date ? k.createdAt.toISOString() : new Date(k.createdAt).toISOString() })),
    transaksi_kasir_item: transaksiKasirItemList.map(i => ({ id: i.id, transaksi_kasir_id: i.transaksiKasirId, barang_id: i.barangId, nama_barang: i.namaBarang, satuan: i.satuan, jumlah: toNum(i.jumlah), harga_satuan: toNum(i.hargaSatuan), harga_beli: i.hargaBeli ? toNum(i.hargaBeli) : null, subtotal: toNum(i.subtotal) })),
    pekerja: pekerjaList.map(p => ({ id: p.id, usaha_id: p.usahaId, pelanggan_id: p.pelangganId ?? null, nama: p.nama, telepon: p.telepon ?? null, jabatan: p.jabatan ?? null, catatan: p.catatan ?? null, created_at: p.createdAt.toISOString() })),
    upah_pekerja: upahList.map(u => ({ id: u.id, usaha_id: u.usahaId, pekerja_id: u.pekerjaid, keterangan: u.keterangan, jumlah_total: toNum(u.jumlahTotal), total_dibayar: toNum(u.totalDibayar), sisa_upah: toNum(u.sisaUpah), tanggal_kerja: u.tanggalKerja, status: u.status, catatan: u.catatan ?? null, created_at: u.createdAt.toISOString(), updated_at: u.updatedAt.toISOString() })),
    bayar_upah: bayarUpahList.map(b => ({ id: b.id, usaha_id: b.usahaId, upah_id: b.upahId, jumlah: toNum(b.jumlah), tanggal_bayar: b.tanggalBayar, keuangan_id: b.keuanganId ?? null, pembayaran_id: b.pembayaranId ?? null, catatan: b.catatan ?? null, created_at: b.createdAt.toISOString() })),
    // v1.8: backup pengaturan (key-value per usaha). File logo TIDAK di-include
    // di sini karena server tidak punya akses ke userData/logos/. Client yang
    // bertugas menempel logo (lihat handleExport di backup.tsx) dan bump versi
    // ke v1.11 saat ada logo. Backup tanpa logo (mis. user belum upload logo)
    // tetap di v1.10.
    pengaturan: pengaturanList.map(p => ({ key: p.key, value: p.value, updated_at: p.updatedAt instanceof Date ? p.updatedAt.toISOString() : new Date(p.updatedAt).toISOString() })),
    // v1.10: master Supplier per usaha
    suppliers: suppliersList.map(s => ({ id: s.id, usaha_id: s.usahaId, nama: s.nama, telepon: s.telepon ?? null, alamat: s.alamat ?? null, catatan: s.catatan ?? null, created_at: s.createdAt instanceof Date ? s.createdAt.toISOString() : new Date(s.createdAt).toISOString() })),
  });
}
