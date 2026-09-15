import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { formatRupiah } from "@/lib/format";
import { openPrintWindow } from "@/lib/print";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, Download, Printer, ShoppingBag, BarChart2, Receipt, TrendingUp, Package, FileSpreadsheet } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import {
  NAMA_BULAN, buildPrintKasir,
  type KasirRingkasan, type KasirHarian, type KasirBulanan, type KasirTopProduk, type KasirKeuntungan,
} from "./laporan-print-helpers";
import { exportKasirCsv, exportKasirXlsx } from "./laporan-export-helpers";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

interface Props {
  namaUsaha: string;
  tanggalCetak: string;
}

export default function LaporanKasirTab({ namaUsaha, tanggalCetak }: Props) {
  const now = new Date();
  const [kasirBulan, setKasirBulan] = useState(now.getMonth() + 1);
  const [kasirTahun, setKasirTahun] = useState(now.getFullYear());
  const [kasirView, setKasirView] = useState<"harian" | "bulanan">("harian");

  const { data: kasirRingkasan, isLoading: kasirRingkasanLoading } = useQuery<KasirRingkasan>({
    queryKey: ["laporan-kasir-ringkasan", kasirBulan, kasirTahun],
    queryFn: async () => {
      const r = await fetch(`${BASE}/api/laporan/kasir/ringkasan?bulan=${kasirBulan}&tahun=${kasirTahun}`, { credentials: "include" });
      return r.ok ? r.json() : { total_penjualan: 0, jumlah_transaksi: 0, rata_rata: 0 };
    },
  });
  const { data: kasirHarian = [], isLoading: kasirHarianLoading } = useQuery<KasirHarian[]>({
    queryKey: ["laporan-kasir-harian", kasirBulan, kasirTahun],
    queryFn: async () => {
      const r = await fetch(`${BASE}/api/laporan/kasir/harian?bulan=${kasirBulan}&tahun=${kasirTahun}`, { credentials: "include" });
      return r.ok ? r.json() : [];
    },
  });
  const { data: kasirBulanan = [], isLoading: kasirBulananLoading } = useQuery<KasirBulanan[]>({
    queryKey: ["laporan-kasir-bulanan", kasirTahun],
    queryFn: async () => {
      const r = await fetch(`${BASE}/api/laporan/kasir/bulanan?tahun=${kasirTahun}`, { credentials: "include" });
      return r.ok ? r.json() : [];
    },
  });
  const { data: kasirTopProduk = [], isLoading: kasirTopLoading } = useQuery<KasirTopProduk[]>({
    queryKey: ["laporan-kasir-top", kasirBulan, kasirTahun],
    queryFn: async () => {
      const r = await fetch(`${BASE}/api/laporan/kasir/top-produk?bulan=${kasirBulan}&tahun=${kasirTahun}`, { credentials: "include" });
      return r.ok ? r.json() : [];
    },
  });
  const { data: kasirKeuntungan, isLoading: kasirKeuntunganLoading } = useQuery<KasirKeuntungan>({
    queryKey: ["laporan-kasir-keuntungan", kasirBulan, kasirTahun],
    queryFn: async () => {
      const r = await fetch(`${BASE}/api/laporan/kasir/keuntungan?bulan=${kasirBulan}&tahun=${kasirTahun}`, { credentials: "include" });
      return r.ok ? r.json() : { total_omset: 0, total_modal: 0, total_keuntungan: 0, margin_persen: 0, per_produk: [] };
    },
  });

  const handlePrint = () => {
    if (!kasirRingkasan) return;
    openPrintWindow(buildPrintKasir({
      namaUsaha, tanggalCetak, bulanNama: NAMA_BULAN[kasirBulan], tahun: kasirTahun,
      ringkasan: kasirRingkasan, harian: kasirHarian, topProduk: kasirTopProduk,
    }));
  };

  return (
    <div className="space-y-4">
      {/* Header + actions */}
      <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
        <p className="text-sm text-muted-foreground">Rekap penjualan kasir per bulan dengan grafik dan top produk.</p>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => exportKasirCsv(kasirHarian, kasirTahun, kasirBulan)} disabled={!kasirHarian.length}>
            <Download className="mr-2 h-4 w-4" /> Unduh CSV
          </Button>
          <Button variant="outline" onClick={() => exportKasirXlsx(namaUsaha, tanggalCetak, kasirBulan, kasirTahun, kasirRingkasan, kasirHarian, kasirTopProduk)} disabled={!kasirHarian.length} className="text-emerald-700 border-emerald-300 hover:bg-emerald-50">
            <FileSpreadsheet className="mr-2 h-4 w-4" /> Unduh Excel
          </Button>
          <Button onClick={handlePrint} disabled={!kasirRingkasan || !kasirHarian.length}>
            <Printer className="mr-2 h-4 w-4" /> Cetak / PDF
          </Button>
        </div>
      </div>

      {/* Filter bulan & tahun */}
      <Card className="toolbar-card">
        <CardContent className="p-5">
          <div className="flex items-center gap-2 text-sm font-semibold text-primary mb-4">
            <BarChart2 className="h-4 w-4" /> Filter Periode
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label>Bulan</Label>
              <Select value={String(kasirBulan)} onValueChange={v => setKasirBulan(parseInt(v))}>
                <SelectTrigger className="bg-background"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {NAMA_BULAN.slice(1).map((nama, i) => (
                    <SelectItem key={i + 1} value={String(i + 1)}>{nama}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Tahun</Label>
              <Select value={String(kasirTahun)} onValueChange={v => setKasirTahun(parseInt(v))}>
                <SelectTrigger className="bg-background"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[kasirTahun - 1, kasirTahun, kasirTahun + 1].map(y => (
                    <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="data-card border-l-4 border-l-emerald-500 shadow-sm">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Penjualan</CardTitle>
            <div className="h-9 w-9 rounded-full bg-emerald-100 flex items-center justify-center">
              <ShoppingBag className="h-4 w-4 text-emerald-600" />
            </div>
          </CardHeader>
          <CardContent>
            {kasirRingkasanLoading
              ? <div className="h-8 bg-muted animate-pulse rounded" />
              : <p className="text-2xl font-bold text-emerald-600">{formatRupiah(kasirRingkasan?.total_penjualan ?? 0)}</p>}
            <p className="text-xs text-muted-foreground mt-1">{NAMA_BULAN[kasirBulan]} {kasirTahun}</p>
          </CardContent>
        </Card>
        <Card className="data-card border-l-4 border-l-blue-500 shadow-sm">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium text-muted-foreground">Jumlah Transaksi</CardTitle>
            <div className="h-9 w-9 rounded-full bg-blue-100 flex items-center justify-center">
              <Receipt className="h-4 w-4 text-blue-600" />
            </div>
          </CardHeader>
          <CardContent>
            {kasirRingkasanLoading
              ? <div className="h-8 bg-muted animate-pulse rounded" />
              : <p className="text-2xl font-bold text-blue-600">{kasirRingkasan?.jumlah_transaksi ?? 0}</p>}
            <p className="text-xs text-muted-foreground mt-1">transaksi tercatat</p>
          </CardContent>
        </Card>
        <Card className="data-card border-l-4 border-l-primary shadow-sm">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium text-muted-foreground">Rata-rata/Transaksi</CardTitle>
            <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center">
              <TrendingUp className="h-4 w-4 text-primary" />
            </div>
          </CardHeader>
          <CardContent>
            {kasirRingkasanLoading
              ? <div className="h-8 bg-muted animate-pulse rounded" />
              : <p className="text-2xl font-bold text-primary">{formatRupiah(kasirRingkasan?.rata_rata ?? 0)}</p>}
            <p className="text-xs text-muted-foreground mt-1">per transaksi</p>
          </CardContent>
        </Card>
        <Card className="data-card border-l-4 border-l-amber-500 shadow-sm">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium text-muted-foreground">Keuntungan</CardTitle>
            <div className="h-9 w-9 rounded-full bg-amber-100 flex items-center justify-center">
              <TrendingUp className="h-4 w-4 text-amber-600" />
            </div>
          </CardHeader>
          <CardContent>
            {kasirKeuntunganLoading
              ? <div className="h-8 bg-muted animate-pulse rounded" />
              : <p className={`text-2xl font-bold ${(kasirKeuntungan?.total_keuntungan ?? 0) >= 0 ? "text-amber-600" : "text-red-600"}`}>{formatRupiah(kasirKeuntungan?.total_keuntungan ?? 0)}</p>}
            <p className="text-xs text-muted-foreground mt-1">margin {kasirKeuntungan?.margin_persen ?? 0}%</p>
          </CardContent>
        </Card>
      </div>

      {/* Chart */}
      <Card className="data-card shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2">
                <BarChart2 className="h-5 w-5 text-primary" />
                Grafik Penjualan
              </CardTitle>
              <CardDescription>
                {kasirView === "harian"
                  ? `Penjualan harian — ${NAMA_BULAN[kasirBulan]} ${kasirTahun}`
                  : `Penjualan bulanan — ${kasirTahun}`}
              </CardDescription>
            </div>
            <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
              <Button size="sm" variant={kasirView === "harian" ? "default" : "ghost"} className="h-7 text-xs px-3" onClick={() => setKasirView("harian")}>Harian</Button>
              <Button size="sm" variant={kasirView === "bulanan" ? "default" : "ghost"} className="h-7 text-xs px-3" onClick={() => setKasirView("bulanan")}>Bulanan</Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {(kasirView === "harian" ? kasirHarianLoading : kasirBulananLoading)
            ? <div className="flex justify-center items-center h-48"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
            : kasirView === "harian" ? (
              kasirHarian.length === 0
                ? <div className="flex flex-col items-center justify-center h-48 text-muted-foreground gap-2">
                    <BarChart2 className="h-10 w-10 opacity-30" />
                    <p className="text-sm">Belum ada penjualan di {NAMA_BULAN[kasirBulan]} {kasirTahun}.</p>
                  </div>
                : <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={kasirHarian.map(d => ({ label: d.tanggal.slice(8), total: d.total, jumlah: d.jumlah }))} margin={{ top: 4, right: 8, left: 0, bottom: 0 }} barCategoryGap="30%">
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(38 18% 87%)" />
                      <XAxis dataKey="label" tick={{ fontSize: 11, fill: "hsl(215 15% 48%)" }} tickLine={false} axisLine={{ stroke: "hsl(38 18% 87%)" }} />
                      <YAxis tickFormatter={(v) => v >= 1_000_000 ? `${(v/1_000_000).toFixed(0)}jt` : v >= 1_000 ? `${(v/1_000).toFixed(0)}rb` : String(v)} tick={{ fontSize: 11, fill: "hsl(215 15% 48%)" }} tickLine={false} axisLine={false} width={52} />
                      <Tooltip formatter={(v: number) => [formatRupiah(v), "Total Penjualan"]} labelFormatter={(l) => `Tgl ${l}`} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                      <Bar dataKey="total" fill="hsl(158 55% 28%)" radius={[4, 4, 0, 0]} maxBarSize={56} />
                    </BarChart>
                  </ResponsiveContainer>
            ) : (
              kasirBulanan.length === 0
                ? <div className="flex flex-col items-center justify-center h-48 text-muted-foreground gap-2">
                    <BarChart2 className="h-10 w-10 opacity-30" />
                    <p className="text-sm">Belum ada penjualan di tahun {kasirTahun}.</p>
                  </div>
                : <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={kasirBulanan.map(d => ({ label: NAMA_BULAN[d.bulan].slice(0, 3), total: d.total }))} margin={{ top: 4, right: 8, left: 0, bottom: 0 }} barCategoryGap="30%">
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(38 18% 87%)" />
                      <XAxis dataKey="label" tick={{ fontSize: 11, fill: "hsl(215 15% 48%)" }} tickLine={false} axisLine={{ stroke: "hsl(38 18% 87%)" }} />
                      <YAxis tickFormatter={(v) => v >= 1_000_000 ? `${(v/1_000_000).toFixed(0)}jt` : v >= 1_000 ? `${(v/1_000).toFixed(0)}rb` : String(v)} tick={{ fontSize: 11, fill: "hsl(215 15% 48%)" }} tickLine={false} axisLine={false} width={52} />
                      <Tooltip formatter={(v: number) => [formatRupiah(v), "Total Penjualan"]} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                      <Bar dataKey="total" radius={[4, 4, 0, 0]} maxBarSize={56}>
                        {kasirBulanan.map((_, i) => <Cell key={i} fill={i === kasirBulan - 1 ? "hsl(158 55% 28%)" : "hsl(158 45% 55%)"} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
            )}
        </CardContent>
      </Card>

      {/* Top Produk */}
      <Card className="shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Package className="h-4 w-4 text-primary" />
            Top Produk Terlaris — {NAMA_BULAN[kasirBulan]} {kasirTahun}
          </CardTitle>
          <CardDescription>Diurutkan berdasarkan total omset tertinggi</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {kasirTopLoading
            ? <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
            : <div className="overflow-x-auto">
                <Table className="table-premium">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-8">#</TableHead>
                      <TableHead>Nama Produk</TableHead>
                      <TableHead className="text-right">Jumlah Terjual</TableHead>
                      <TableHead className="text-right">Total Omset</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {kasirTopProduk.length === 0
                      ? <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">Belum ada data penjualan.</TableCell></TableRow>
                      : kasirTopProduk.map((p, i) => (
                        <TableRow key={i}>
                          <TableCell className="text-muted-foreground font-medium">{i + 1}</TableCell>
                          <TableCell className="font-medium">{p.nama_barang}</TableCell>
                          <TableCell className="text-right">{p.total_qty} {p.satuan}</TableCell>
                          <TableCell className="text-right font-bold text-emerald-600">{formatRupiah(p.total_omset)}</TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </div>}
        </CardContent>
      </Card>

      {/* Keuntungan per Produk */}
      <Card className="data-card shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-amber-600" />
            Keuntungan per Produk
          </CardTitle>
          <CardDescription>Analisis keuntungan per item — {NAMA_BULAN[kasirBulan]} {kasirTahun}</CardDescription>
        </CardHeader>
        <CardContent>
          {kasirKeuntunganLoading ? (
            <div className="flex justify-center items-center h-24"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : !kasirKeuntungan?.per_produk.length ? (
            <p className="text-center text-muted-foreground py-6">Belum ada data penjualan.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Produk</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Omset</TableHead>
                  <TableHead className="text-right">Modal</TableHead>
                  <TableHead className="text-right">Keuntungan</TableHead>
                  <TableHead className="text-right">Margin</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {kasirKeuntungan.per_produk.map((p, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium">{p.nama} <span className="text-muted-foreground text-xs">({p.satuan})</span></TableCell>
                    <TableCell className="text-right">{p.qty}</TableCell>
                    <TableCell className="text-right">{formatRupiah(p.omset)}</TableCell>
                    <TableCell className="text-right">{formatRupiah(p.modal)}</TableCell>
                    <TableCell className={`text-right font-semibold ${p.keuntungan >= 0 ? "text-emerald-600" : "text-red-600"}`}>{formatRupiah(p.keuntungan)}</TableCell>
                    <TableCell className="text-right">{p.margin}%</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
