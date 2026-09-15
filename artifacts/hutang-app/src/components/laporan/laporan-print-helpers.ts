import { escapeHtml, formatRupiah, formatDate } from "@/lib/format";
import type { LaporanItem } from "@workspace/api-client-react";

// ─── Shared print CSS ─────────────────────────────────────────────────────────
export const PRINT_CSS = `
@page { size: A4 landscape; margin: 15mm 14mm; }
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: Arial, Helvetica, sans-serif; font-size: 10pt; color: #111; background: white; }
.header { border-bottom: 2px solid #222; padding-bottom: 8px; margin-bottom: 8px; }
.header-usaha { font-size: 14pt; font-weight: bold; }
.header-judul { font-size: 12pt; font-weight: bold; margin-top: 2px; }
.fi-table { border-collapse: collapse; font-size: 9pt; margin-bottom: 8px; }
.fi-label { font-weight: 600; padding-right: 8px; white-space: nowrap; }
.fi-colon { padding-right: 4px; }
.summary-box { border: 1px solid #bbb; border-radius: 3px; padding: 6px 10px; margin-bottom: 10px; background: #fafafa; font-size: 9pt; display: inline-block; }
.summary-title { font-weight: bold; margin-bottom: 4px; }
.sum-tbl { border-collapse: collapse; }
.sum-tbl td { padding: 1px 8px 1px 0; }
.data-table { width: 100%; border-collapse: collapse; table-layout: fixed; font-size: 9pt; margin-top: 4px; }
.data-table th { background: #eaeaea; font-weight: bold; border: 1px solid #bbb; padding: 5px 6px; text-align: left; }
.data-table th.right, .data-table td.right { text-align: right; }
.data-table td { border: 1px solid #ccc; padding: 4px 6px; vertical-align: top; word-break: break-word; }
.data-table tfoot td { background: #eaeaea; font-weight: bold; border: 1px solid #bbb; padding: 5px 6px; }
.nowrap { white-space: nowrap; } .bold { font-weight: bold; } .muted { color: #555; }
.green { color: #1a7a4a; } .orange { color: #b45309; } .red { color: #b91c1c; } .right { text-align: right; }
.badge { display: inline-block; padding: 1px 6px; border-radius: 4px; font-size: 8pt; font-weight: 600; border: 1px solid; }
.badge-aktif { color: #92400e; border-color: #d97706; }
.badge-lunas { color: #065f46; border-color: #059669; }
.badge-masuk { color: #065f46; border-color: #059669; }
.badge-keluar { color: #b91c1c; border-color: #dc2626; }
.badge-aman { color: #065f46; border-color: #059669; }
.badge-habis { color: #92400e; border-color: #d97706; }
tr { page-break-inside: avoid; }
`;

// ─── Shared helpers ───────────────────────────────────────────────────────────
export function printHead(judul: string) {
  return `<!DOCTYPE html><html lang="id"><head><meta charset="UTF-8"/><title>${escapeHtml(judul)}</title>
<style>${PRINT_CSS}</style>
<script>window.addEventListener('load',function(){setTimeout(function(){window.print();},600);});<\/script>
</head><body>`;
}

export function printFoot() {
  return `</body></html>`;
}

export function filterTableHtml(lines: { label: string; value: string }[]) {
  return `<table class="fi-table"><tbody>${lines.map(f =>
    `<tr><td class="fi-label">${escapeHtml(f.label)}</td><td class="fi-colon">:</td><td>${escapeHtml(f.value)}</td></tr>`
  ).join("")}</tbody></table>`;
}

export function downloadCsv(content: string, filename: string) {
  const blob = new Blob(["\uFEFF" + content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ─── Shared types ─────────────────────────────────────────────────────────────
export interface KeuanganItem {
  id: number; tanggal: string; tipe: "masuk" | "keluar";
  kategori: string; jumlah: number; keterangan: string | null;
}
export interface BarangItem {
  id: number; nama: string; satuan: string; stok: number; stok_minimum: number;
  harga_beli: string; harga_jual: string;
}
export interface KasirRingkasan { total_penjualan: number; jumlah_transaksi: number; rata_rata: number; }
export interface KasirHarian { tanggal: string; total: number; jumlah: number; }
export interface KasirBulanan { bulan: number; total: number; jumlah: number; }
export interface KasirTopProduk { nama_barang: string; satuan: string; total_qty: number; total_omset: number; }
export interface KasirKeuntungan {
  total_omset: number;
  total_modal: number;
  total_keuntungan: number;
  margin_persen: number;
  per_produk: { nama: string; satuan: string; qty: number; omset: number; modal: number; keuntungan: number; margin: number }[];
}

export const NAMA_BULAN = ["", "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

// ─── Print builders ───────────────────────────────────────────────────────────
export function buildPrintHutang(opts: {
  namaUsaha: string; tanggalCetak: string; filterLines: { label: string; value: string }[];
  isSinglePelanggan: boolean; pelangganNama: string;
  totalHutang: number; totalDibayar: number; totalSisa: number; rows: LaporanItem[];
}): string {
  const { namaUsaha, tanggalCetak, filterLines, isSinglePelanggan,
    pelangganNama, totalHutang, totalDibayar, totalSisa, rows } = opts;
  const judul = isSinglePelanggan ? `Riwayat Hutang: ${pelangganNama}` : "Laporan Hutang & Pembayaran";
  const fiLines = [{ label: "Tanggal Cetak", value: tanggalCetak }, ...filterLines,
    ...(filterLines.length === 0 ? [{ label: "Filter", value: "Semua data" }] : [])];
  const summaryBlock = isSinglePelanggan
    ? `<div class="summary-box"><div class="summary-title">Ringkasan: ${escapeHtml(pelangganNama)}</div>
       <table class="sum-tbl">
         <tr><td>Total Hutang</td><td>:</td><td>${formatRupiah(totalHutang)}</td></tr>
         <tr><td>Total Dibayar</td><td>:</td><td class="green">${formatRupiah(totalDibayar)}</td></tr>
         <tr><td>Sisa Hutang</td><td>:</td><td class="orange"><b>${formatRupiah(totalSisa)}</b></td></tr>
       </table></div>` : "";
  const dataRows = rows.length === 0
    ? `<tr><td colspan="7" style="text-align:center;padding:20px;color:#666">Tidak ada data.</td></tr>`
    : rows.map(r => `<tr>
        <td class="nowrap">${formatDate(r.tanggal_hutang)}</td>
        <td class="bold">${escapeHtml(r.nama_pelanggan)}</td>
        <td class="muted">${escapeHtml(r.keterangan || "—")}</td>
        <td><span class="badge ${r.status === "aktif" ? "badge-aktif" : "badge-lunas"}">${r.status === "aktif" ? "Belum lunas" : "Lunas"}</span></td>
        <td class="right">${formatRupiah(r.nominal_hutang)}</td>
        <td class="right green">${formatRupiah(r.total_dibayar)}</td>
        <td class="right orange bold">${formatRupiah(r.sisa_hutang)}</td>
      </tr>`).join("");

  return printHead(judul) + `
<div class="header"><div class="header-usaha">${escapeHtml(namaUsaha)}</div><div class="header-judul">${escapeHtml(judul)}</div></div>
${filterTableHtml(fiLines)}
${summaryBlock}
<table class="data-table">
<colgroup><col style="width:13%"/><col style="width:16%"/><col style="width:20%"/><col style="width:8%"/><col style="width:15%"/><col style="width:15%"/><col style="width:13%"/></colgroup>
<thead><tr><th>Tanggal</th><th>Pelanggan</th><th>Keterangan</th><th>Status</th>
<th class="right">Nominal Hutang</th><th class="right">Total Dibayar</th><th class="right">Sisa Hutang</th></tr></thead>
<tbody>${dataRows}</tbody>
${rows.length > 0 ? `<tfoot><tr><td colspan="4" class="right">TOTAL</td>
<td class="right">${formatRupiah(totalHutang)}</td><td class="right green">${formatRupiah(totalDibayar)}</td>
<td class="right orange">${formatRupiah(totalSisa)}</td></tr></tfoot>` : ""}
</table>` + printFoot();
}

export function buildPrintKeuangan(opts: {
  namaUsaha: string; tanggalCetak: string; filterLines: { label: string; value: string }[];
  totalMasuk: number; totalKeluar: number; saldo: number; rows: KeuanganItem[];
}): string {
  const { namaUsaha, tanggalCetak, filterLines, totalMasuk, totalKeluar, saldo, rows } = opts;
  const judul = "Laporan Keuangan";
  const fiLines = [{ label: "Tanggal Cetak", value: tanggalCetak }, ...filterLines,
    ...(filterLines.length === 0 ? [{ label: "Filter", value: "Semua data" }] : [])];
  const dataRows = rows.length === 0
    ? `<tr><td colspan="5" style="text-align:center;padding:20px;color:#666">Tidak ada data.</td></tr>`
    : rows.map(r => `<tr>
        <td class="nowrap">${formatDate(r.tanggal)}</td>
        <td><span class="badge ${r.tipe === "masuk" ? "badge-masuk" : "badge-keluar"}">${r.tipe === "masuk" ? "Masuk" : "Keluar"}</span></td>
        <td>${escapeHtml(r.kategori)}</td>
        <td class="muted">${escapeHtml(r.keterangan || "—")}</td>
        <td class="right ${r.tipe === "masuk" ? "green" : "red"}">${r.tipe === "masuk" ? "+" : "-"}${formatRupiah(r.jumlah)}</td>
      </tr>`).join("");

  return printHead(judul) + `
<div class="header"><div class="header-usaha">${escapeHtml(namaUsaha)}</div><div class="header-judul">${escapeHtml(judul)}</div></div>
${filterTableHtml(fiLines)}
<div class="summary-box">
  <div class="summary-title">Ringkasan Keuangan</div>
  <table class="sum-tbl">
    <tr><td>Total Masuk</td><td>:</td><td class="green">${formatRupiah(totalMasuk)}</td></tr>
    <tr><td>Total Keluar</td><td>:</td><td class="red">${formatRupiah(totalKeluar)}</td></tr>
    <tr><td>Saldo Bersih</td><td>:</td><td class="${saldo >= 0 ? "green" : "red"}"><b>${formatRupiah(saldo)}</b></td></tr>
  </table>
</div>
<table class="data-table">
<colgroup><col style="width:13%"/><col style="width:10%"/><col style="width:18%"/><col style="width:34%"/><col style="width:25%"/></colgroup>
<thead><tr><th>Tanggal</th><th>Tipe</th><th>Kategori</th><th>Keterangan</th><th class="right">Nominal</th></tr></thead>
<tbody>${dataRows}</tbody>
${rows.length > 0 ? `<tfoot><tr><td colspan="4" class="right">SALDO BERSIH (${rows.length} transaksi)</td>
<td class="right ${saldo >= 0 ? "green" : "red"}">${formatRupiah(saldo)}</td></tr></tfoot>` : ""}
</table>` + printFoot();
}

export function buildPrintStok(opts: {
  namaUsaha: string; tanggalCetak: string; rows: BarangItem[];
}): string {
  const { namaUsaha, tanggalCetak, rows } = opts;
  const judul = "Laporan Stok Barang";
  const aman = rows.filter(b => b.stok > b.stok_minimum).length;
  const habis = rows.filter(b => b.stok <= b.stok_minimum).length;
  const dataRows = rows.length === 0
    ? `<tr><td colspan="7" style="text-align:center;padding:20px;color:#666">Tidak ada data.</td></tr>`
    : rows.map(b => `<tr>
        <td class="bold">${escapeHtml(b.nama)}</td>
        <td>${escapeHtml(b.satuan)}</td>
        <td class="right bold ${b.stok <= b.stok_minimum ? "orange" : "green"}">${b.stok}</td>
        <td class="right muted">${b.stok_minimum}</td>
        <td><span class="badge ${b.stok <= b.stok_minimum ? "badge-habis" : "badge-aman"}">${b.stok <= b.stok_minimum ? "Hampir Habis" : "Aman"}</span></td>
        <td class="right">${formatRupiah(parseFloat(b.harga_beli))}</td>
        <td class="right">${formatRupiah(parseFloat(b.harga_jual))}</td>
      </tr>`).join("");

  return printHead(judul) + `
<div class="header"><div class="header-usaha">${escapeHtml(namaUsaha)}</div><div class="header-judul">${escapeHtml(judul)}</div></div>
${filterTableHtml([
  { label: "Tanggal Cetak", value: tanggalCetak },
  { label: "Total Barang", value: `${rows.length} jenis` },
  { label: "Stok Aman", value: `${aman} barang` },
  { label: "Hampir Habis", value: `${habis} barang` },
])}
<table class="data-table">
<colgroup><col style="width:25%"/><col style="width:9%"/><col style="width:12%"/><col style="width:12%"/><col style="width:14%"/><col style="width:14%"/><col style="width:14%"/></colgroup>
<thead><tr><th>Nama Barang</th><th>Satuan</th><th class="right">Stok Saat Ini</th><th class="right">Stok Minimum</th>
<th>Status</th><th class="right">Harga Beli</th><th class="right">Harga Jual</th></tr></thead>
<tbody>${dataRows}</tbody>
</table>` + printFoot();
}

export function buildPrintKasir(opts: {
  namaUsaha: string; tanggalCetak: string; bulanNama: string; tahun: number;
  ringkasan: KasirRingkasan; harian: KasirHarian[]; topProduk: KasirTopProduk[];
}): string {
  const { namaUsaha, tanggalCetak, bulanNama, tahun, ringkasan, harian, topProduk } = opts;
  const judul = `Laporan Penjualan Kasir — ${bulanNama} ${tahun}`;
  const harianRows = harian.length === 0
    ? `<tr><td colspan="3" style="text-align:center;padding:16px;color:#666">Tidak ada data.</td></tr>`
    : harian.map(r => `<tr>
        <td class="nowrap">${formatDate(r.tanggal)}</td>
        <td class="right">${r.jumlah} transaksi</td>
        <td class="right green bold">${formatRupiah(r.total)}</td>
      </tr>`).join("");
  const topRows = topProduk.length === 0
    ? `<tr><td colspan="3" style="text-align:center;padding:16px;color:#666">Tidak ada data.</td></tr>`
    : topProduk.map((r, i) => `<tr>
        <td>${i + 1}. ${escapeHtml(r.nama_barang)}</td>
        <td class="right">${r.total_qty} ${escapeHtml(r.satuan)}</td>
        <td class="right green bold">${formatRupiah(r.total_omset)}</td>
      </tr>`).join("");

  return printHead(judul) + `
<div class="header"><div class="header-usaha">${escapeHtml(namaUsaha)}</div><div class="header-judul">${escapeHtml(judul)}</div></div>
${filterTableHtml([
  { label: "Tanggal Cetak", value: tanggalCetak },
  { label: "Periode", value: `${bulanNama} ${tahun}` },
])}
<div class="summary-box">
  <div class="summary-title">Ringkasan Penjualan</div>
  <table class="sum-tbl">
    <tr><td>Total Penjualan</td><td>:</td><td class="green bold">${formatRupiah(ringkasan.total_penjualan)}</td></tr>
    <tr><td>Jumlah Transaksi</td><td>:</td><td>${ringkasan.jumlah_transaksi} transaksi</td></tr>
    <tr><td>Rata-rata/Transaksi</td><td>:</td><td>${formatRupiah(ringkasan.rata_rata)}</td></tr>
  </table>
</div>
<p style="font-weight:bold;margin:12px 0 4px">Detail Penjualan Harian</p>
<table class="data-table" style="width:60%">
<colgroup><col style="width:40%"/><col style="width:30%"/><col style="width:30%"/></colgroup>
<thead><tr><th>Tanggal</th><th class="right">Transaksi</th><th class="right">Total Penjualan</th></tr></thead>
<tbody>${harianRows}</tbody>
</table>
<p style="font-weight:bold;margin:14px 0 4px">Top Produk Terlaris</p>
<table class="data-table" style="width:60%">
<colgroup><col style="width:50%"/><col style="width:25%"/><col style="width:25%"/></colgroup>
<thead><tr><th>Nama Produk</th><th class="right">Jumlah Terjual</th><th class="right">Total Omset</th></tr></thead>
<tbody>${topRows}</tbody>
</table>` + printFoot();
}
