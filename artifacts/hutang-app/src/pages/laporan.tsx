import { useState } from "react";
import {
  useGetLaporan,
  useGetPelangganList,
  useGetUsaha,
  GetLaporanStatus,
  LaporanItem,
} from "@workspace/api-client-react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { formatRupiah, formatDate } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Loader2, Download, Printer, Filter, X, TrendingUp, TrendingDown, Wallet, Package,
} from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

// ─── helpers ──────────────────────────────────────────────────────────────────
function fmtRupiah(n: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency", currency: "IDR", minimumFractionDigits: 0,
  }).format(n);
}
function fmtDate(iso: string) {
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric", month: "long", year: "numeric",
  }).format(new Date(iso));
}

// ─── Print via @media print overlay ──────────────────────────────────────────
// In Electron: uses ipcRenderer → webContents.print() (100% reliable).
// In browser: uses window.print() (synchronous, works everywhere).
declare global {
  interface Window {
    electronApp?: {
      platform: string;
      isElectron: boolean;
      print: () => Promise<void>;
    };
  }
}

function openPrintWindow(html: string) {
  // Clean up any leftover from previous calls
  document.getElementById("__print_overlay__")?.remove();
  document.getElementById("__print_style__")?.remove();

  // Extract body content and styles from the generated HTML
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  const bodyContent = bodyMatch ? bodyMatch[1] : html;
  const styleMatch = html.match(/<style[^>]*>([\s\S]*?)<\/style>/i);
  const printStyles = styleMatch ? styleMatch[1] : "";

  // Inject print-only overlay (hidden on screen, visible during print)
  const overlay = document.createElement("div");
  overlay.id = "__print_overlay__";
  overlay.innerHTML = bodyContent;
  document.body.appendChild(overlay);

  // Inject styles — printStyles placed OUTSIDE @media print so @page rule stays valid
  const style = document.createElement("style");
  style.id = "__print_style__";
  style.textContent = `
    @media screen { #__print_overlay__ { display: none !important; } }
    @media print {
      body > *:not(#__print_overlay__) { display: none !important; visibility: hidden; }
      #__print_overlay__ { display: block !important; visibility: visible; }
    }
    ${printStyles}
  `;
  document.head.appendChild(style);

  // Trigger print
  if (window.electronApp?.isElectron && typeof window.electronApp.print === "function") {
    // Electron: use IPC → webContents.print() which is always available
    window.electronApp.print().finally(() => {
      overlay.remove();
      style.remove();
    });
  } else {
    // Browser: window.print() is synchronous, blocks until dialog closed
    window.print();
    overlay.remove();
    style.remove();
  }
}

// ─── Shared print CSS ─────────────────────────────────────────────────────────
const PRINT_CSS = `
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

function printHead(judul: string) {
  return `<!DOCTYPE html><html lang="id"><head><meta charset="UTF-8"/><title>${judul}</title>
<style>${PRINT_CSS}</style></head><body>`;
}
function printFoot() {
  return `</body></html>`;
}
function filterTableHtml(lines: { label: string; value: string }[]) {
  return `<table class="fi-table"><tbody>${lines.map(f =>
    `<tr><td class="fi-label">${f.label}</td><td class="fi-colon">:</td><td>${f.value}</td></tr>`
  ).join("")}</tbody></table>`;
}

// ─── Print builders ───────────────────────────────────────────────────────────
interface KeuanganItem {
  id: number; tanggal: string; tipe: "masuk" | "keluar";
  kategori: string; jumlah: number; keterangan: string | null;
}
interface BarangItem {
  id: number; nama: string; satuan: string; stok: number; stok_minimum: number;
  harga_beli: string; harga_jual: string;
}

function buildPrintHutang(opts: {
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
    ? `<div class="summary-box"><div class="summary-title">Ringkasan: ${pelangganNama}</div>
       <table class="sum-tbl">
         <tr><td>Total Hutang</td><td>:</td><td>${fmtRupiah(totalHutang)}</td></tr>
         <tr><td>Total Dibayar</td><td>:</td><td class="green">${fmtRupiah(totalDibayar)}</td></tr>
         <tr><td>Sisa Hutang</td><td>:</td><td class="orange"><b>${fmtRupiah(totalSisa)}</b></td></tr>
       </table></div>` : "";
  const dataRows = rows.length === 0
    ? `<tr><td colspan="7" style="text-align:center;padding:20px;color:#666">Tidak ada data.</td></tr>`
    : rows.map(r => `<tr>
        <td class="nowrap">${fmtDate(r.tanggal_hutang)}</td>
        <td class="bold">${r.nama_pelanggan}</td>
        <td class="muted">${r.keterangan || "—"}</td>
        <td><span class="badge ${r.status === "aktif" ? "badge-aktif" : "badge-lunas"}">${r.status === "aktif" ? "Aktif" : "Lunas"}</span></td>
        <td class="right">${fmtRupiah(r.nominal_hutang)}</td>
        <td class="right green">${fmtRupiah(r.total_dibayar)}</td>
        <td class="right orange bold">${fmtRupiah(r.sisa_hutang)}</td>
      </tr>`).join("");

  return printHead(judul) + `
<div class="header"><div class="header-usaha">${namaUsaha}</div><div class="header-judul">${judul}</div></div>
${filterTableHtml(fiLines)}
${summaryBlock}
<table class="data-table">
<colgroup><col style="width:13%"/><col style="width:16%"/><col style="width:20%"/><col style="width:8%"/><col style="width:15%"/><col style="width:15%"/><col style="width:13%"/></colgroup>
<thead><tr><th>Tanggal</th><th>Pelanggan</th><th>Keterangan</th><th>Status</th>
<th class="right">Nominal Hutang</th><th class="right">Total Dibayar</th><th class="right">Sisa Hutang</th></tr></thead>
<tbody>${dataRows}</tbody>
${rows.length > 0 ? `<tfoot><tr><td colspan="4" class="right">TOTAL</td>
<td class="right">${fmtRupiah(totalHutang)}</td><td class="right green">${fmtRupiah(totalDibayar)}</td>
<td class="right orange">${fmtRupiah(totalSisa)}</td></tr></tfoot>` : ""}
</table>` + printFoot();
}

function buildPrintKeuangan(opts: {
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
        <td class="nowrap">${fmtDate(r.tanggal)}</td>
        <td><span class="badge ${r.tipe === "masuk" ? "badge-masuk" : "badge-keluar"}">${r.tipe === "masuk" ? "Masuk" : "Keluar"}</span></td>
        <td>${r.kategori}</td>
        <td class="muted">${r.keterangan || "—"}</td>
        <td class="right ${r.tipe === "masuk" ? "green" : "red"}">${r.tipe === "masuk" ? "+" : "-"}${fmtRupiah(r.jumlah)}</td>
      </tr>`).join("");

  return printHead(judul) + `
<div class="header"><div class="header-usaha">${namaUsaha}</div><div class="header-judul">${judul}</div></div>
${filterTableHtml(fiLines)}
<div class="summary-box">
  <div class="summary-title">Ringkasan Keuangan</div>
  <table class="sum-tbl">
    <tr><td>Total Masuk</td><td>:</td><td class="green">${fmtRupiah(totalMasuk)}</td></tr>
    <tr><td>Total Keluar</td><td>:</td><td class="red">${fmtRupiah(totalKeluar)}</td></tr>
    <tr><td>Saldo Bersih</td><td>:</td><td class="${saldo >= 0 ? "green" : "red"}"><b>${fmtRupiah(saldo)}</b></td></tr>
  </table>
</div>
<table class="data-table">
<colgroup><col style="width:13%"/><col style="width:10%"/><col style="width:18%"/><col style="width:34%"/><col style="width:25%"/></colgroup>
<thead><tr><th>Tanggal</th><th>Tipe</th><th>Kategori</th><th>Keterangan</th><th class="right">Nominal</th></tr></thead>
<tbody>${dataRows}</tbody>
${rows.length > 0 ? `<tfoot><tr><td colspan="4" class="right">SALDO BERSIH (${rows.length} transaksi)</td>
<td class="right ${saldo >= 0 ? "green" : "red"}">${fmtRupiah(saldo)}</td></tr></tfoot>` : ""}
</table>` + printFoot();
}

function buildPrintStok(opts: {
  namaUsaha: string; tanggalCetak: string; rows: BarangItem[];
}): string {
  const { namaUsaha, tanggalCetak, rows } = opts;
  const judul = "Laporan Stok Barang";
  const aman = rows.filter(b => b.stok > b.stok_minimum).length;
  const habis = rows.filter(b => b.stok <= b.stok_minimum).length;
  const dataRows = rows.length === 0
    ? `<tr><td colspan="7" style="text-align:center;padding:20px;color:#666">Tidak ada data.</td></tr>`
    : rows.map(b => `<tr>
        <td class="bold">${b.nama}</td>
        <td>${b.satuan}</td>
        <td class="right bold ${b.stok <= b.stok_minimum ? "orange" : "green"}">${b.stok}</td>
        <td class="right muted">${b.stok_minimum}</td>
        <td><span class="badge ${b.stok <= b.stok_minimum ? "badge-habis" : "badge-aman"}">${b.stok <= b.stok_minimum ? "Hampir Habis" : "Aman"}</span></td>
        <td class="right">${fmtRupiah(parseFloat(b.harga_beli))}</td>
        <td class="right">${fmtRupiah(parseFloat(b.harga_jual))}</td>
      </tr>`).join("");

  return printHead(judul) + `
<div class="header"><div class="header-usaha">${namaUsaha}</div><div class="header-judul">${judul}</div></div>
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

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function LaporanPage() {
  const { user } = useAuth();

  const [filterPelanggan, setFilterPelanggan] = useState<number | undefined>();
  const [filterStatus, setFilterStatus] = useState<GetLaporanStatus | undefined>();
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const [keuDari, setKeuDari] = useState("");
  const [keuSampai, setKeuSampai] = useState("");
  const [keuTipe, setKeuTipe] = useState<"semua" | "masuk" | "keluar">("semua");

  const { data: pelangganList } = useGetPelangganList();
  const { data: usahaData } = useGetUsaha(user?.usaha_id ?? 0, {
    query: { enabled: !!user?.usaha_id },
  });
  const { data: laporanData, isLoading: laporanLoading } = useGetLaporan({
    pelanggan_id: filterPelanggan, status: filterStatus,
    tanggal_dari: dateFrom || undefined, tanggal_sampai: dateTo || undefined,
  });
  const { data: keuanganData = [], isLoading: keuLoading } = useQuery<KeuanganItem[]>({
    queryKey: ["laporan-keuangan", keuDari, keuSampai, keuTipe],
    queryFn: async () => {
      const p = new URLSearchParams();
      if (keuDari) p.set("dari", keuDari);
      if (keuSampai) p.set("sampai", keuSampai);
      if (keuTipe !== "semua") p.set("tipe", keuTipe);
      const r = await fetch(`${BASE}/api/keuangan?${p}`, { credentials: "include" });
      return r.ok ? r.json() : [];
    },
  });
  const { data: barangData = [], isLoading: barangLoading } = useQuery<BarangItem[]>({
    queryKey: ["laporan-barang"],
    queryFn: async () => {
      const r = await fetch(`${BASE}/api/barang`, { credentials: "include" });
      return r.ok ? r.json() : [];
    },
  });

  const namaUsaha = usahaData?.nama_usaha ?? "Usahaku";
  const selectedPelanggan = filterPelanggan ? pelangganList?.find(p => p.id === filterPelanggan) : undefined;
  const isSinglePelanggan = !!selectedPelanggan;
  const totalHutang = laporanData?.reduce((s, r) => s + r.nominal_hutang, 0) ?? 0;
  const totalDibayar = laporanData?.reduce((s, r) => s + r.total_dibayar, 0) ?? 0;
  const totalSisa = laporanData?.reduce((s, r) => s + r.sisa_hutang, 0) ?? 0;
  const totalMasuk = keuanganData.filter(k => k.tipe === "masuk").reduce((s, k) => s + k.jumlah, 0);
  const totalKeluar = keuanganData.filter(k => k.tipe === "keluar").reduce((s, k) => s + k.jumlah, 0);
  const saldo = totalMasuk - totalKeluar;
  const tanggalCetak = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "long", year: "numeric" }).format(new Date());
  const hasActiveFilterHutang = !!filterPelanggan || !!filterStatus || !!dateFrom || !!dateTo;
  const hasActiveFilterKeu = !!keuDari || !!keuSampai || keuTipe !== "semua";

  const hutangFilterLines: { label: string; value: string }[] = [];
  if (selectedPelanggan) hutangFilterLines.push({ label: "Pelanggan", value: selectedPelanggan.nama });
  if (filterStatus) hutangFilterLines.push({ label: "Status", value: filterStatus === "aktif" ? "Aktif" : "Lunas" });
  if (dateFrom || dateTo) {
    const fmt = (d: string) => new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "long", year: "numeric" }).format(new Date(d));
    hutangFilterLines.push({ label: "Periode", value: `${dateFrom ? fmt(dateFrom) : "awal"} – ${dateTo ? fmt(dateTo) : "sekarang"}` });
  }

  const keuFilterLines: { label: string; value: string }[] = [];
  if (keuTipe !== "semua") keuFilterLines.push({ label: "Tipe", value: keuTipe === "masuk" ? "Masuk" : "Keluar" });
  if (keuDari || keuSampai) {
    const fmt = (d: string) => new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "long", year: "numeric" }).format(new Date(d));
    keuFilterLines.push({ label: "Periode", value: `${keuDari ? fmt(keuDari) : "awal"} – ${keuSampai ? fmt(keuSampai) : "sekarang"}` });
  }

  // ── Print handlers ──
  const handlePrintHutang = () => {
    if (!laporanData?.length) return;
    openPrintWindow(buildPrintHutang({
      namaUsaha, tanggalCetak, filterLines: hutangFilterLines,
      isSinglePelanggan, pelangganNama: selectedPelanggan?.nama ?? "",
      totalHutang, totalDibayar, totalSisa, rows: laporanData,
    }));
  };
  const handlePrintKeuangan = () => {
    if (!keuanganData.length) return;
    openPrintWindow(buildPrintKeuangan({
      namaUsaha, tanggalCetak, filterLines: keuFilterLines,
      totalMasuk, totalKeluar, saldo, rows: keuanganData,
    }));
  };
  const handlePrintStok = () => {
    if (!barangData.length) return;
    openPrintWindow(buildPrintStok({ namaUsaha, tanggalCetak, rows: barangData }));
  };

  // ── CSV handlers ──
  function downloadCsv(content: string, filename: string) {
    const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
  const handleExportHutangCsv = () => {
    if (!laporanData?.length) return;
    const h = ["Tanggal Hutang","Pelanggan","Keterangan","Status","Nominal Hutang","Total Dibayar","Sisa Hutang"];
    const rows = laporanData.map(r => [r.tanggal_hutang.split("T")[0], `"${r.nama_pelanggan}"`,
      `"${r.keterangan||""}"`, r.status, r.nominal_hutang, r.total_dibayar, r.sisa_hutang]);
    rows.push(["TOTAL","","","", totalHutang, totalDibayar, totalSisa] as any);
    downloadCsv([h.join(","), ...rows.map(r => r.join(","))].join("\n"),
      `laporan_hutang_${new Date().toISOString().split("T")[0]}.csv`);
  };
  const handleExportKeuanganCsv = () => {
    if (!keuanganData.length) return;
    const h = ["Tanggal","Tipe","Kategori","Nominal","Keterangan"];
    const rows = keuanganData.map(k => [k.tanggal, k.tipe, `"${k.kategori}"`, k.jumlah, `"${k.keterangan||""}"`]);
    downloadCsv([h.join(","), ...rows.map(r => r.join(","))].join("\n"),
      `laporan_keuangan_${new Date().toISOString().split("T")[0]}.csv`);
  };
  const handleExportStokCsv = () => {
    if (!barangData.length) return;
    const h = ["Nama Barang","Satuan","Stok Saat Ini","Stok Minimum","Status","Harga Beli","Harga Jual"];
    const rows = barangData.map(b => [`"${b.nama}"`, b.satuan, b.stok, b.stok_minimum,
      b.stok <= b.stok_minimum ? "Hampir Habis" : "Aman", b.harga_beli, b.harga_jual]);
    downloadCsv([h.join(","), ...rows.map(r => r.join(","))].join("\n"),
      `laporan_stok_${new Date().toISOString().split("T")[0]}.csv`);
  };

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight text-primary">Laporan</h2>
        <p className="text-muted-foreground">Laporan lengkap hutang, keuangan, dan stok barang.</p>
      </div>

      <Tabs defaultValue="hutang">
        <TabsList className="w-full md:w-auto">
          <TabsTrigger value="hutang">Hutang & Pembayaran</TabsTrigger>
          <TabsTrigger value="keuangan">Keuangan</TabsTrigger>
          <TabsTrigger value="stok">Stok Barang</TabsTrigger>
        </TabsList>

        {/* ── Tab Hutang ─────────────────────────────────────────────────────── */}
        <TabsContent value="hutang" className="space-y-4 mt-4">
          <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
            <p className="text-sm text-muted-foreground">Data hutang dan pembayaran pelanggan.</p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleExportHutangCsv} disabled={!laporanData?.length}>
                <Download className="mr-2 h-4 w-4" /> Export CSV
              </Button>
              <Button onClick={handlePrintHutang} disabled={!laporanData?.length}>
                <Printer className="mr-2 h-4 w-4" /> Cetak / PDF
              </Button>
            </div>
          </div>

          <Card className="bg-muted/30 border-primary/20 shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-primary">
                  <Filter className="h-4 w-4" /> Filter
                </div>
                {hasActiveFilterHutang && (
                  <Button variant="ghost" size="sm" onClick={() => { setFilterPelanggan(undefined); setFilterStatus(undefined); setDateFrom(""); setDateTo(""); }}
                    className="text-muted-foreground h-7 px-2">
                    <X className="h-3 w-3 mr-1" /> Reset
                  </Button>
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label>Pelanggan</Label>
                  <Select value={filterPelanggan?.toString() || "semua"} onValueChange={v => setFilterPelanggan(v === "semua" ? undefined : parseInt(v))}>
                    <SelectTrigger className="bg-background"><SelectValue placeholder="Semua" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="semua">Semua Pelanggan</SelectItem>
                      {pelangganList?.map(p => <SelectItem key={p.id} value={p.id.toString()}>{p.nama}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select value={filterStatus || "semua"} onValueChange={v => setFilterStatus(v === "semua" ? undefined : v as GetLaporanStatus)}>
                    <SelectTrigger className="bg-background"><SelectValue placeholder="Semua" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="semua">Semua Status</SelectItem>
                      <SelectItem value="aktif">Aktif</SelectItem>
                      <SelectItem value="lunas">Lunas</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Dari Tanggal</Label>
                  <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="bg-background" />
                </div>
                <div className="space-y-2">
                  <Label>Sampai Tanggal</Label>
                  <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="bg-background" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-0">
              {laporanLoading
                ? <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
                : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Tanggal</TableHead>
                          <TableHead>Pelanggan</TableHead>
                          <TableHead>Keterangan</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Nominal</TableHead>
                          <TableHead className="text-right">Dibayar</TableHead>
                          <TableHead className="text-right text-primary">Sisa</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {!laporanData?.length
                          ? <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Tidak ada data.</TableCell></TableRow>
                          : laporanData.map((row, idx) => (
                            <TableRow key={idx}>
                              <TableCell className="whitespace-nowrap">{formatDate(row.tanggal_hutang)}</TableCell>
                              <TableCell className="font-medium">{row.nama_pelanggan}</TableCell>
                              <TableCell className="truncate max-w-[200px] text-muted-foreground">{row.keterangan || "—"}</TableCell>
                              <TableCell>
                                <span className={row.status === "aktif"
                                  ? "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-amber-100 text-amber-800"
                                  : "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-emerald-100 text-emerald-800"}>
                                  {row.status === "aktif" ? "Aktif" : "Lunas"}
                                </span>
                              </TableCell>
                              <TableCell className="text-right">{formatRupiah(row.nominal_hutang)}</TableCell>
                              <TableCell className="text-right text-emerald-600">{formatRupiah(row.total_dibayar)}</TableCell>
                              <TableCell className="text-right font-bold text-orange-600">{formatRupiah(row.sisa_hutang)}</TableCell>
                            </TableRow>
                          ))}
                      </TableBody>
                      {laporanData && laporanData.length > 0 && (
                        <TableFooter>
                          <TableRow className="bg-primary/5">
                            <TableCell colSpan={4} className="font-bold text-right">TOTAL</TableCell>
                            <TableCell className="text-right font-bold">{formatRupiah(totalHutang)}</TableCell>
                            <TableCell className="text-right font-bold text-emerald-700">{formatRupiah(totalDibayar)}</TableCell>
                            <TableCell className="text-right font-bold text-orange-700 text-lg">{formatRupiah(totalSisa)}</TableCell>
                          </TableRow>
                        </TableFooter>
                      )}
                    </Table>
                  </div>
                )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Tab Keuangan ───────────────────────────────────────────────────── */}
        <TabsContent value="keuangan" className="space-y-4 mt-4">
          <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
            <p className="text-sm text-muted-foreground">Rekap pemasukan dan pengeluaran keuangan usaha.</p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleExportKeuanganCsv} disabled={!keuanganData.length}>
                <Download className="mr-2 h-4 w-4" /> Export CSV
              </Button>
              <Button onClick={handlePrintKeuangan} disabled={!keuanganData.length}>
                <Printer className="mr-2 h-4 w-4" /> Cetak / PDF
              </Button>
            </div>
          </div>

          <Card className="bg-muted/30 border-primary/20 shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-primary">
                  <Filter className="h-4 w-4" /> Filter
                </div>
                {hasActiveFilterKeu && (
                  <Button variant="ghost" size="sm" onClick={() => { setKeuDari(""); setKeuSampai(""); setKeuTipe("semua"); }}
                    className="text-muted-foreground h-7 px-2">
                    <X className="h-3 w-3 mr-1" /> Reset
                  </Button>
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Tipe</Label>
                  <Select value={keuTipe} onValueChange={v => setKeuTipe(v as any)}>
                    <SelectTrigger className="bg-background"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="semua">Semua</SelectItem>
                      <SelectItem value="masuk">Masuk</SelectItem>
                      <SelectItem value="keluar">Keluar</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Dari Tanggal</Label>
                  <Input type="date" value={keuDari} onChange={e => setKeuDari(e.target.value)} className="bg-background" />
                </div>
                <div className="space-y-2">
                  <Label>Sampai Tanggal</Label>
                  <Input type="date" value={keuSampai} onChange={e => setKeuSampai(e.target.value)} className="bg-background" />
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="border-l-4 border-l-emerald-500">
              <CardHeader className="pb-2 flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-medium">Total Masuk</CardTitle>
                <TrendingUp className="h-4 w-4 text-emerald-500" />
              </CardHeader>
              <CardContent><p className="text-2xl font-bold text-emerald-600">{formatRupiah(totalMasuk)}</p></CardContent>
            </Card>
            <Card className="border-l-4 border-l-red-500">
              <CardHeader className="pb-2 flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-medium">Total Keluar</CardTitle>
                <TrendingDown className="h-4 w-4 text-red-500" />
              </CardHeader>
              <CardContent><p className="text-2xl font-bold text-red-600">{formatRupiah(totalKeluar)}</p></CardContent>
            </Card>
            <Card className={`border-l-4 ${saldo >= 0 ? "border-l-blue-500" : "border-l-orange-500"}`}>
              <CardHeader className="pb-2 flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-medium">Saldo Bersih</CardTitle>
                <Wallet className="h-4 w-4 text-blue-500" />
              </CardHeader>
              <CardContent><p className={`text-2xl font-bold ${saldo >= 0 ? "text-blue-600" : "text-orange-600"}`}>{formatRupiah(saldo)}</p></CardContent>
            </Card>
          </div>

          <Card>
            <CardContent className="p-0">
              {keuLoading
                ? <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
                : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Tanggal</TableHead>
                          <TableHead>Tipe</TableHead>
                          <TableHead>Kategori</TableHead>
                          <TableHead>Keterangan</TableHead>
                          <TableHead className="text-right">Nominal</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {!keuanganData.length
                          ? <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Tidak ada data.</TableCell></TableRow>
                          : keuanganData.map(k => (
                            <TableRow key={k.id}>
                              <TableCell className="whitespace-nowrap">{formatDate(k.tanggal)}</TableCell>
                              <TableCell>
                                <Badge className={k.tipe === "masuk"
                                  ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-100 border-0"
                                  : "bg-red-100 text-red-800 hover:bg-red-100 border-0"}>
                                  {k.tipe === "masuk" ? "Masuk" : "Keluar"}
                                </Badge>
                              </TableCell>
                              <TableCell>{k.kategori}</TableCell>
                              <TableCell className="text-muted-foreground max-w-[200px] truncate">{k.keterangan || "—"}</TableCell>
                              <TableCell className={`text-right font-medium ${k.tipe === "masuk" ? "text-emerald-600" : "text-red-600"}`}>
                                {k.tipe === "masuk" ? "+" : "-"}{formatRupiah(k.jumlah)}
                              </TableCell>
                            </TableRow>
                          ))}
                      </TableBody>
                      {keuanganData.length > 0 && (
                        <TableFooter>
                          <TableRow className="bg-primary/5">
                            <TableCell colSpan={4} className="font-bold text-right">
                              SALDO BERSIH ({keuanganData.length} transaksi)
                            </TableCell>
                            <TableCell className={`text-right font-bold text-lg ${saldo >= 0 ? "text-blue-700" : "text-orange-700"}`}>
                              {formatRupiah(saldo)}
                            </TableCell>
                          </TableRow>
                        </TableFooter>
                      )}
                    </Table>
                  </div>
                )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Tab Stok ───────────────────────────────────────────────────────── */}
        <TabsContent value="stok" className="space-y-4 mt-4">
          <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
            <p className="text-sm text-muted-foreground">Laporan stok barang saat ini beserta status ketersediaan.</p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleExportStokCsv} disabled={!barangData.length}>
                <Download className="mr-2 h-4 w-4" /> Export CSV
              </Button>
              <Button onClick={handlePrintStok} disabled={!barangData.length}>
                <Printer className="mr-2 h-4 w-4" /> Cetak / PDF
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="border-l-4 border-l-primary">
              <CardHeader className="pb-2 flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-medium">Total Jenis Barang</CardTitle>
                <Package className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent><p className="text-2xl font-bold">{barangData.length}</p></CardContent>
            </Card>
            <Card className="border-l-4 border-l-emerald-500">
              <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Stok Aman</CardTitle></CardHeader>
              <CardContent><p className="text-2xl font-bold text-emerald-600">{barangData.filter(b => b.stok > b.stok_minimum).length}</p></CardContent>
            </Card>
            <Card className="border-l-4 border-l-orange-500">
              <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Hampir Habis</CardTitle></CardHeader>
              <CardContent><p className="text-2xl font-bold text-orange-600">{barangData.filter(b => b.stok <= b.stok_minimum).length}</p></CardContent>
            </Card>
          </div>

          <Card>
            <CardContent className="p-0">
              {barangLoading
                ? <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
                : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Nama Barang</TableHead>
                          <TableHead>Satuan</TableHead>
                          <TableHead className="text-right">Stok Saat Ini</TableHead>
                          <TableHead className="text-right">Stok Minimum</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Harga Beli</TableHead>
                          <TableHead className="text-right">Harga Jual</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {!barangData.length
                          ? <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Tidak ada data barang.</TableCell></TableRow>
                          : barangData.map(b => (
                            <TableRow key={b.id}>
                              <TableCell className="font-medium">{b.nama}</TableCell>
                              <TableCell>{b.satuan}</TableCell>
                              <TableCell className={`text-right font-bold ${b.stok <= b.stok_minimum ? "text-orange-600" : "text-emerald-600"}`}>
                                {b.stok}
                              </TableCell>
                              <TableCell className="text-right text-muted-foreground">{b.stok_minimum}</TableCell>
                              <TableCell>
                                {b.stok <= b.stok_minimum
                                  ? <Badge variant="outline" className="border-orange-400 text-orange-700 bg-orange-50">Hampir Habis</Badge>
                                  : <Badge variant="outline" className="border-emerald-400 text-emerald-700 bg-emerald-50">Aman</Badge>}
                              </TableCell>
                              <TableCell className="text-right">{formatRupiah(parseFloat(b.harga_beli))}</TableCell>
                              <TableCell className="text-right">{formatRupiah(parseFloat(b.harga_jual))}</TableCell>
                            </TableRow>
                          ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
