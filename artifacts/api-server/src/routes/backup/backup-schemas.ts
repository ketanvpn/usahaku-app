import { z } from "zod";

const nullableString = z.string().nullable().optional();
const nullableId = z.number().int().nullable().optional();
const money = z.coerce.number();

export const BackupUsahaSchema = z.object({
  id: z.number().int(),
  nama_usaha: z.string(),
  alamat: nullableString,
  telepon: nullableString,
  catatan: nullableString,
  created_at: z.string(),
});

export const BackupPelangganSchema = z.object({
  id: z.number().int(),
  usaha_id: z.number().int(),
  nama: z.string(),
  telepon: nullableString,
  alamat: nullableString,
  catatan: nullableString,
  created_at: z.string(),
});

export const BackupHutangSchema = z.object({
  id: z.number().int(),
  usaha_id: z.number().int(),
  pelanggan_id: z.number().int(),
  tanggal_hutang: z.string(),
  tanggal_jatuh_tempo: nullableString,
  keterangan: nullableString,
  nominal_hutang: money,
  total_dibayar: money,
  sisa_hutang: money,
  status: z.string(),
  keuangan_id: nullableId,
  created_at: z.string(),
  updated_at: z.string(),
});

export const BackupPembayaranSchema = z.object({
  id: z.number().int(),
  usaha_id: z.number().int(),
  hutang_id: z.number().int(),
  pelanggan_id: z.number().int(),
  tanggal_bayar: z.string(),
  nominal_bayar: money,
  catatan: nullableString,
  nomor_kwitansi: nullableString,
  sisa_hutang_setelah: money.nullable().optional(),
  keuangan_id: nullableId,
  created_at: z.string(),
});

export const BackupKeuanganSchema = z.object({
  id: z.number().int(),
  usaha_id: z.number().int(),
  tanggal: z.string(),
  tipe: z.string(),
  kategori: nullableString,
  keterangan: z.string(),
  jumlah: money,
  created_at: z.string(),
});

export const BackupBarangSchema = z.object({
  id: z.number().int(),
  usaha_id: z.number().int(),
  nama: z.string(),
  satuan: z.string(),
  harga_beli: money,
  harga_jual: money,
  stok: money,
  stok_minimum: money,
  kategori: nullableString,
  created_at: z.string(),
});

export const BackupTransaksiStokSchema = z.object({
  id: z.number().int(),
  usaha_id: z.number().int(),
  barang_id: z.number().int(),
  tanggal: z.string(),
  tipe: z.string(),
  jumlah: money,
  harga_satuan: money,
  keterangan: nullableString,
  keuangan_id: nullableId,
  supplier_id: nullableId,
  created_at: z.string(),
});

export const BackupTransaksiKasirSchema = z.object({
  id: z.number().int(),
  usaha_id: z.number().int(),
  tanggal: z.string(),
  total: money,
  diskon: money,
  uang_bayar: money,
  kembalian: money,
  catatan: nullableString,
  keuangan_id: nullableId,
  created_at: z.string(),
});

export const BackupTransaksiKasirItemSchema = z.object({
  id: z.number().int(),
  transaksi_kasir_id: z.number().int(),
  barang_id: z.number().int(),
  nama_barang: z.string(),
  satuan: z.string(),
  jumlah: money,
  harga_satuan: money,
  harga_beli: money.nullable().optional(),
  subtotal: money,
});

export const BackupPekerjaSchema = z.object({
  id: z.number().int(),
  usaha_id: z.number().int(),
  pelanggan_id: nullableId,
  nama: z.string(),
  telepon: nullableString,
  jabatan: nullableString,
  catatan: nullableString,
  created_at: z.string(),
});

export const BackupUpahPekerjaSchema = z.object({
  id: z.number().int(),
  usaha_id: z.number().int(),
  pekerja_id: z.number().int(),
  keterangan: z.string(),
  jumlah_total: money,
  total_dibayar: money,
  sisa_upah: money,
  tanggal_kerja: z.string(),
  status: z.string(),
  catatan: nullableString,
  created_at: z.string(),
  updated_at: z.string(),
});

export const BackupBayarUpahSchema = z.object({
  id: z.number().int(),
  usaha_id: z.number().int(),
  upah_id: z.number().int(),
  jumlah: money,
  tanggal_bayar: z.string(),
  keuangan_id: nullableId,
  pembayaran_id: nullableId,
  catatan: nullableString,
  created_at: z.string(),
});

export const BackupPengaturanSchema = z.object({
  key: z.string(),
  value: nullableString,
  updated_at: z.string(),
});

export const BackupSupplierSchema = z.object({
  id: z.number().int(),
  usaha_id: z.number().int(),
  nama: z.string(),
  telepon: nullableString,
  alamat: nullableString,
  catatan: nullableString,
  created_at: z.string(),
});

export const BackupSchema = z.object({
  version: z.string(),
  exported_at: z.string(),
  usaha_id: z.number().int(),
  usaha: BackupUsahaSchema,
  pelanggan: z.array(BackupPelangganSchema),
  hutang: z.array(BackupHutangSchema),
  pembayaran: z.array(BackupPembayaranSchema),
  keuangan: z.array(BackupKeuanganSchema).default([]),
  barang: z.array(BackupBarangSchema).default([]),
  transaksi_stok: z.array(BackupTransaksiStokSchema).default([]),
  transaksi_kasir: z.array(BackupTransaksiKasirSchema).default([]),
  transaksi_kasir_item: z.array(BackupTransaksiKasirItemSchema).default([]),
  pekerja: z.array(BackupPekerjaSchema).default([]),
  upah_pekerja: z.array(BackupUpahPekerjaSchema).default([]),
  bayar_upah: z.array(BackupBayarUpahSchema).default([]),
  pengaturan: z.array(BackupPengaturanSchema).default([]),
  suppliers: z.array(BackupSupplierSchema).default([]),
});
