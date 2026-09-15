import * as XLSX from "xlsx";
import type { LaporanItem } from "@workspace/api-client-react";
import { formatRupiah } from "@/lib/format";
import { downloadCsv, NAMA_BULAN } from "./laporan-print-helpers";
import type { KeuanganItem, BarangItem, KasirHarian, KasirTopProduk, KasirRingkasan } from "./laporan-print-helpers";

// ─── XLSX helper ──────────────────────────────────────────────────────────────
function downloadXlsx(wb: XLSX.WorkBook, filename: string) {
  XLSX.writeFile(wb, filename);
}

function todayIso() {
  return new Date().toISOString().split("T")[0];
}

// ─── Hutang ───────────────────────────────────────────────────────────────────
export function exportHutangCsv(laporanData: LaporanItem[], totalHutang: number, totalDibayar: number, totalSisa: number) {
  const h = ["Tanggal Hutang","Pelanggan","Keterangan","Status","Nominal Hutang","Total Dibayar","Sisa Hutang"];
  const rows = laporanData.map(r => [r.tanggal_hutang.split("T")[0], `"${r.nama_pelanggan}"`,
    `"${r.keterangan||""}"`, r.status, r.nominal_hutang, r.total_dibayar, r.sisa_hutang]);
  const totalRow = ["TOTAL","","","", totalHutang, totalDibayar, totalSisa];
  downloadCsv([h.join(","), ...rows.map(r => r.join(",")), totalRow.join(",")].join("\n"),
    `laporan_hutang_${todayIso()}.csv`);
}

export function exportHutangXlsx(
  namaUsaha: string, tanggalCetak: string, laporanData: LaporanItem[],
  totalHutang: number, totalDibayar: number, totalSisa: number,
  isSinglePelanggan: boolean, pelangganNama: string,
) {
  const wb = XLSX.utils.book_new();
  const title = isSinglePelanggan ? `Riwayat Hutang: ${pelangganNama}` : "Laporan Hutang & Pembayaran";
  const rows: (string | number)[][] = [
    [namaUsaha], [title], [`Tanggal Cetak: ${tanggalCetak}`], [],
    ["Tanggal Hutang","Pelanggan","Keterangan","Status","Nominal Hutang","Total Dibayar","Sisa Hutang"],
    ...laporanData.map(r => [
      r.tanggal_hutang.split("T")[0], r.nama_pelanggan, r.keterangan || "",
      r.status === "aktif" ? "Belum lunas" : "Lunas",
      r.nominal_hutang, r.total_dibayar, r.sisa_hutang,
    ]),
    ["","","","TOTAL", totalHutang, totalDibayar, totalSisa],
  ];
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws["!cols"] = [14,18,22,8,16,16,14].map(w => ({ wch: w }));
  XLSX.utils.book_append_sheet(wb, ws, "Laporan Hutang");
  downloadXlsx(wb, `laporan_hutang_${todayIso()}.xlsx`);
}

// ─── Keuangan ─────────────────────────────────────────────────────────────────
export function exportKeuanganCsv(keuanganData: KeuanganItem[]) {
  const h = ["Tanggal","Tipe","Kategori","Nominal","Keterangan"];
  const rows = keuanganData.map(k => [k.tanggal, k.tipe, `"${k.kategori}"`, k.jumlah, `"${k.keterangan||""}"`]);
  downloadCsv([h.join(","), ...rows.map(r => r.join(","))].join("\n"),
    `laporan_keuangan_${todayIso()}.csv`);
}

export function exportKeuanganXlsx(
  namaUsaha: string, tanggalCetak: string, keuanganData: KeuanganItem[],
  totalMasuk: number, totalKeluar: number, saldo: number,
) {
  const wb = XLSX.utils.book_new();
  const rows: (string | number)[][] = [
    [namaUsaha], ["Laporan Keuangan"], [`Tanggal Cetak: ${tanggalCetak}`], [],
    ["Ringkasan"], ["Total Masuk", totalMasuk], ["Total Keluar", totalKeluar], ["Saldo Bersih", saldo], [],
    ["Tanggal","Tipe","Kategori","Keterangan","Nominal"],
    ...keuanganData.map(k => [
      k.tanggal, k.tipe === "masuk" ? "Masuk" : "Keluar",
      k.kategori, k.keterangan || "", k.tipe === "masuk" ? k.jumlah : -k.jumlah,
    ]),
  ];
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws["!cols"] = [14,10,20,36,18].map(w => ({ wch: w }));
  XLSX.utils.book_append_sheet(wb, ws, "Laporan Keuangan");
  downloadXlsx(wb, `laporan_keuangan_${todayIso()}.xlsx`);
}

// ─── Stok ─────────────────────────────────────────────────────────────────────
export function exportStokCsv(barangData: BarangItem[]) {
  const h = ["Nama Barang","Satuan","Stok Saat Ini","Stok Minimum","Status","Harga Beli","Harga Jual"];
  const rows = barangData.map(b => [`"${b.nama}"`, b.satuan, b.stok, b.stok_minimum,
    b.stok <= b.stok_minimum ? "Hampir Habis" : "Aman", b.harga_beli, b.harga_jual]);
  downloadCsv([h.join(","), ...rows.map(r => r.join(","))].join("\n"),
    `laporan_stok_${todayIso()}.csv`);
}

export function exportStokXlsx(namaUsaha: string, tanggalCetak: string, barangData: BarangItem[]) {
  const wb = XLSX.utils.book_new();
  const rows: (string | number)[][] = [
    [namaUsaha], ["Laporan Stok Barang"], [`Tanggal Cetak: ${tanggalCetak}`], [],
    ["Nama Barang","Satuan","Stok Saat Ini","Stok Minimum","Status","Harga Beli","Harga Jual"],
    ...barangData.map(b => [
      b.nama, b.satuan, b.stok, b.stok_minimum,
      b.stok <= b.stok_minimum ? "Hampir Habis" : "Aman",
      parseFloat(b.harga_beli), parseFloat(b.harga_jual),
    ]),
  ];
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws["!cols"] = [28,10,14,14,14,14,14].map(w => ({ wch: w }));
  XLSX.utils.book_append_sheet(wb, ws, "Laporan Stok");
  downloadXlsx(wb, `laporan_stok_${todayIso()}.xlsx`);
}

// ─── Kasir ────────────────────────────────────────────────────────────────────
export function exportKasirCsv(kasirHarian: KasirHarian[], kasirTahun: number, kasirBulan: number) {
  const h = ["Tanggal","Jumlah Transaksi","Total Penjualan"];
  const rows = kasirHarian.map(r => [r.tanggal, r.jumlah, r.total]);
  downloadCsv([h.join(","), ...rows.map(r => r.join(","))].join("\n"),
    `laporan_kasir_${kasirTahun}_${String(kasirBulan).padStart(2,"0")}.csv`);
}

export function exportKasirXlsx(
  namaUsaha: string, tanggalCetak: string,
  kasirBulan: number, kasirTahun: number,
  kasirRingkasan: KasirRingkasan | undefined,
  kasirHarian: KasirHarian[], kasirTopProduk: KasirTopProduk[],
) {
  const wb = XLSX.utils.book_new();
  const bulanNama = NAMA_BULAN[kasirBulan];

  const rowsHarian: (string | number)[][] = [
    [namaUsaha], [`Laporan Penjualan Kasir — ${bulanNama} ${kasirTahun}`],
    [`Tanggal Cetak: ${tanggalCetak}`], [],
    ["Ringkasan"],
    ["Total Penjualan", kasirRingkasan?.total_penjualan ?? 0],
    ["Jumlah Transaksi", kasirRingkasan?.jumlah_transaksi ?? 0],
    ["Rata-rata/Transaksi", kasirRingkasan?.rata_rata ?? 0], [],
    ["Penjualan Harian"],
    ["Tanggal","Jumlah Transaksi","Total Penjualan"],
    ...kasirHarian.map(r => [r.tanggal, r.jumlah, r.total]),
  ];
  const wsHarian = XLSX.utils.aoa_to_sheet(rowsHarian);
  wsHarian["!cols"] = [16,18,18].map(w => ({ wch: w }));
  XLSX.utils.book_append_sheet(wb, wsHarian, "Penjualan Harian");

  if (kasirTopProduk.length) {
    const rowsTop: (string | number)[][] = [
      [`Top Produk Terlaris — ${bulanNama} ${kasirTahun}`], [],
      ["Nama Produk","Satuan","Jumlah Terjual","Total Omset"],
      ...kasirTopProduk.map(r => [r.nama_barang, r.satuan, r.total_qty, r.total_omset]),
    ];
    const wsTop = XLSX.utils.aoa_to_sheet(rowsTop);
    wsTop["!cols"] = [30,10,14,16].map(w => ({ wch: w }));
    XLSX.utils.book_append_sheet(wb, wsTop, "Top Produk");
  }

  downloadXlsx(wb, `laporan_kasir_${kasirTahun}_${String(kasirBulan).padStart(2,"0")}.xlsx`);
}

// ─── Upah / Gaji ──────────────────────────────────────────────────────────────
interface UpahLaporanItem {
  pekerja_nama: string;
  pekerja_jabatan?: string | null;
  keterangan: string;
  tanggal_kerja: string;
  jumlah_total: number;
  total_dibayar: number;
  sisa_upah: number;
  status: string;
  catatan: string | null;
}

export function exportUpahCsv(allUpahLaporan: UpahLaporanItem[]) {
  const header = ["No","Pekerja","Jabatan","Keterangan","Tanggal Kerja","Total Gaji","Sudah Dibayar","Sisa","Status","Catatan"];
  const rows = allUpahLaporan.map((u, i) => [
    i + 1, u.pekerja_nama, u.pekerja_jabatan ?? "", u.keterangan,
    u.tanggal_kerja, u.jumlah_total, u.total_dibayar, u.sisa_upah,
    u.status === "lunas" ? "Lunas" : "Belum lunas", u.catatan ?? "",
  ]);
  const csv = [header, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(",")).join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = `laporan_gaji_${todayIso()}.csv`;
  a.click(); URL.revokeObjectURL(url);
}
