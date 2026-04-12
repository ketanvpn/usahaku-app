import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { useGetUsaha, getGetUsahaQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, Edit, Trash2, TrendingUp, TrendingDown, Wallet, Download, Printer, BarChart3 } from "lucide-react";
import { TableSkeleton } from "@/components/ui/table-skeleton";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import * as z from "zod";
import { formatRupiah, formatDate } from "@/lib/format";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

function openPrintWindow(html: string) {
  if (window.electronApp?.isElectron && typeof window.electronApp.openInBrowser === "function") {
    window.electronApp.openInBrowser(html);
  } else {
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const tab = window.open(url, "_blank");
    if (tab) {
      tab.addEventListener("load", () => setTimeout(() => URL.revokeObjectURL(url), 2000));
    }
  }
}

interface KeuanganItem {
  id: number;
  tanggal: string;
  tipe: "masuk" | "keluar";
  kategori: string | null;
  keterangan: string;
  jumlah: number;
}

interface Rekap {
  total_masuk: number;
  total_keluar: number;
  saldo: number;
  jumlah_transaksi: number;
}

interface RekapKategori {
  kategori: string;
  tipe: string;
  total: number;
  jumlah_transaksi: number;
}

interface RekapBulanan {
  bulan: number;
  nama: string;
  masuk: number;
  keluar: number;
}

async function fetchKeuangan(params: { bulan: string; tahun: string; tipe: string }): Promise<KeuanganItem[]> {
  const q = new URLSearchParams();
  if (params.bulan) q.set("bulan", params.bulan);
  if (params.tahun) q.set("tahun", params.tahun);
  if (params.tipe && params.tipe !== "semua") q.set("tipe", params.tipe);
  const r = await fetch(`${BASE}/api/keuangan?${q}`, { credentials: "include" });
  if (!r.ok) throw new Error("Gagal memuat data keuangan");
  return r.json();
}

async function fetchRekap(params: { bulan: string; tahun: string }): Promise<Rekap> {
  const q = new URLSearchParams({ bulan: params.bulan, tahun: params.tahun });
  const r = await fetch(`${BASE}/api/keuangan/rekap?${q}`, { credentials: "include" });
  if (!r.ok) throw new Error("Gagal memuat rekap");
  return r.json();
}

async function fetchRekapKategori(params: { bulan: string; tahun: string }): Promise<RekapKategori[]> {
  const q = new URLSearchParams({ bulan: params.bulan, tahun: params.tahun });
  const r = await fetch(`${BASE}/api/keuangan/rekap-kategori?${q}`, { credentials: "include" });
  if (!r.ok) throw new Error("Gagal memuat rekap kategori");
  return r.json();
}

async function fetchRekapBulanan(tahun: string): Promise<RekapBulanan[]> {
  const r = await fetch(`${BASE}/api/keuangan/rekap-bulanan?tahun=${tahun}`, { credentials: "include" });
  if (!r.ok) throw new Error("Gagal memuat rekap bulanan");
  return r.json();
}

function fmtRp(n: number) {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(n);
}

function fmtTgl(s: string) {
  return new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "long", year: "numeric" }).format(new Date(s));
}

const BULAN_NAMES = ["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];

const keuanganSchema = z.object({
  tanggal: z.string().min(1, "Tanggal wajib diisi"),
  tipe: z.enum(["masuk", "keluar"], { required_error: "Pilih tipe transaksi" }),
  kategori: z.string().optional(),
  keterangan: z.string().min(1, "Keterangan wajib diisi"),
  jumlah: z.coerce.number().min(1, "Jumlah harus lebih dari 0"),
});

type KeuanganFormValues = z.infer<typeof keuanganSchema>;

const KATEGORI_MASUK = ["Penjualan", "Pelunasan Hutang", "Lain-lain"];
const KATEGORI_KELUAR = ["Pembelian Bahan", "Gaji", "Listrik & Air", "Sewa", "Transport", "Lain-lain"];

function handleExportCSV(items: KeuanganItem[], bulan: string, tahun: string) {
  const headers = ["Tanggal", "Tipe", "Kategori", "Keterangan", "Jumlah"];
  const rows = items.map((i) => [
    i.tanggal,
    i.tipe === "masuk" ? "Masuk" : "Keluar",
    i.kategori ?? "-",
    `"${i.keterangan.replace(/"/g, '""')}"`,
    i.jumlah,
  ]);
  const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `keuangan_${bulan.padStart(2,"0")}_${tahun}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function handlePrint(items: KeuanganItem[], rekap: Rekap | undefined, bulan: string, tahun: string, namaUsaha: string) {
  const namaBulan = BULAN_NAMES[parseInt(bulan) - 1];
  const tanggalCetak = new Intl.DateTimeFormat("id-ID", { day:"numeric", month:"long", year:"numeric" }).format(new Date());

  const rows = items.map((i) => `
    <tr>
      <td>${fmtTgl(i.tanggal)}</td>
      <td><span class="badge ${i.tipe === "masuk" ? "badge-masuk" : "badge-keluar"}">${i.tipe === "masuk" ? "Masuk" : "Keluar"}</span></td>
      <td>${i.kategori ?? "-"}</td>
      <td>${i.keterangan}</td>
      <td class="right">${fmtRp(i.jumlah)}</td>
    </tr>`).join("");

  const html = `<!DOCTYPE html><html lang="id"><head><meta charset="UTF-8">
  <title>Laporan Keuangan ${namaBulan} ${tahun}</title>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body { font-family: Arial, sans-serif; font-size: 10pt; color: #222; padding: 20px; }
    .header { border-bottom: 2px solid #222; padding-bottom: 8px; margin-bottom: 12px; }
    .header-usaha { font-size: 14pt; font-weight: bold; }
    .header-judul { font-size: 12pt; font-weight: bold; margin-top: 2px; }
    .header-meta { font-size: 9pt; color: #555; margin-top: 2px; }
    .summary { display: flex; gap: 20px; margin-bottom: 14px; }
    .summary-box { border: 1px solid #ccc; border-radius: 4px; padding: 8px 14px; background: #fafafa; }
    .summary-box .label { font-size: 8pt; color: #555; }
    .summary-box .value { font-size: 12pt; font-weight: bold; }
    .masuk-val { color: #1a7a4a; }
    .keluar-val { color: #b91c1c; }
    .saldo-val { color: #1d4ed8; }
    table { width: 100%; border-collapse: collapse; font-size: 9pt; }
    th { background: #eaeaea; font-weight: bold; border: 1px solid #bbb; padding: 5px 8px; text-align: left; }
    td { border: 1px solid #ccc; padding: 4px 8px; }
    .right { text-align: right; }
    .badge { display:inline-block; padding:1px 6px; border-radius:3px; font-size:8pt; font-weight:600; }
    .badge-masuk { color:#065f46; background:#d1fae5; }
    .badge-keluar { color:#991b1b; background:#fee2e2; }
    @media print { body { padding: 10px; } }
  </style>
  </head><body>
  <div class="header">
    <div class="header-usaha">${namaUsaha}</div>
    <div class="header-judul">Laporan Keuangan — ${namaBulan} ${tahun}</div>
    <div class="header-meta">Dicetak: ${tanggalCetak}</div>
  </div>
  <div class="summary">
    <div class="summary-box"><div class="label">Total Masuk</div><div class="value masuk-val">${fmtRp(rekap?.total_masuk ?? 0)}</div></div>
    <div class="summary-box"><div class="label">Total Keluar</div><div class="value keluar-val">${fmtRp(rekap?.total_keluar ?? 0)}</div></div>
    <div class="summary-box"><div class="label">Saldo</div><div class="value saldo-val">${fmtRp(rekap?.saldo ?? 0)}</div></div>
  </div>
  <table>
    <thead><tr><th>Tanggal</th><th>Tipe</th><th>Kategori</th><th>Keterangan</th><th class="right">Jumlah</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
  </body></html>`;

  openPrintWindow(html);
}

export default function KeuanganPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const now = new Date();

  const [filterBulan, setFilterBulan] = useState(String(now.getMonth() + 1));
  const [filterTahun, setFilterTahun] = useState(String(now.getFullYear()));
  const [filterTipe, setFilterTipe] = useState("semua");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editData, setEditData] = useState<KeuanganItem | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const { user } = useAuth();
  const { data: usahaData } = useGetUsaha(user?.usaha_id ?? 0, { query: { enabled: !!user?.usaha_id, queryKey: getGetUsahaQueryKey(user?.usaha_id ?? 0) } });
  const namaUsaha = usahaData?.nama_usaha ?? "Usahaku";

  const filterParams = { bulan: filterBulan, tahun: filterTahun, tipe: filterTipe };
  const rekapParams = { bulan: filterBulan, tahun: filterTahun };

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["keuangan", filterParams],
    queryFn: () => fetchKeuangan(filterParams),
  });

  const { data: rekap } = useQuery({
    queryKey: ["keuangan-rekap", rekapParams],
    queryFn: () => fetchRekap(rekapParams),
  });

  const { data: rekapKategori = [] } = useQuery({
    queryKey: ["keuangan-rekap-kategori", rekapParams],
    queryFn: () => fetchRekapKategori(rekapParams),
  });

  const { data: rekapBulanan = [] } = useQuery({
    queryKey: ["keuangan-rekap-bulanan", filterTahun],
    queryFn: () => fetchRekapBulanan(filterTahun),
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["keuangan"] });
    qc.invalidateQueries({ queryKey: ["keuangan-rekap"] });
    qc.invalidateQueries({ queryKey: ["keuangan-rekap-kategori"] });
    qc.invalidateQueries({ queryKey: ["keuangan-rekap-bulanan"] });
  };

  const form = useForm<KeuanganFormValues>({
    resolver: zodResolver(keuanganSchema),
    defaultValues: { tanggal: "", tipe: "masuk", kategori: "", keterangan: "", jumlah: 0 },
  });

  const watchTipe = form.watch("tipe");

  const openCreate = () => {
    setEditData(null);
    form.reset({ tanggal: new Date().toISOString().split("T")[0], tipe: "masuk", kategori: "", keterangan: "", jumlah: 0 });
    setDialogOpen(true);
  };

  const openEdit = (item: KeuanganItem) => {
    setEditData(item);
    form.reset({ tanggal: item.tanggal, tipe: item.tipe, kategori: item.kategori ?? "", keterangan: item.keterangan, jumlah: item.jumlah });
    setDialogOpen(true);
  };

  const saveMutation = useMutation({
    mutationFn: async (values: KeuanganFormValues) => {
      const url = editData ? `${BASE}/api/keuangan/${editData.id}` : `${BASE}/api/keuangan`;
      const r = await fetch(url, {
        method: editData ? "PUT" : "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.error || "Gagal menyimpan"); }
      return r.json();
    },
    onSuccess: () => { toast({ title: editData ? "Transaksi diperbarui" : "Transaksi ditambahkan" }); setDialogOpen(false); invalidate(); },
    onError: (e: Error) => toast({ title: "Gagal", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const r = await fetch(`${BASE}/api/keuangan/${id}`, { method: "DELETE", credentials: "include" });
      if (!r.ok) throw new Error("Gagal menghapus");
    },
    onSuccess: () => { toast({ title: "Transaksi dihapus" }); setDeleteId(null); invalidate(); },
    onError: (e: Error) => toast({ title: "Gagal", description: e.message, variant: "destructive" }),
  });

  const tahunOptions = Array.from({ length: 5 }, (_, i) => String(now.getFullYear() - i));
  const masukKategori = rekapKategori.filter(k => k.tipe === "masuk");
  const keluarKategori = rekapKategori.filter(k => k.tipe === "keluar");

  const chartData = rekapBulanan;

  const tooltipFormatter = (value: number) => fmtRp(value);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Pencatatan Keuangan</h1>
          <p className="text-muted-foreground text-sm mt-1">Catat uang masuk dan keluar usaha Anda</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={() => handleExportCSV(items, filterBulan, filterTahun)} disabled={items.length === 0}>
            <Download className="h-4 w-4 mr-2" /> Export CSV
          </Button>
          <Button variant="outline" size="sm" onClick={() => handlePrint(items, rekap, filterBulan, filterTahun, namaUsaha)} disabled={items.length === 0}>
            <Printer className="h-4 w-4 mr-2" /> Cetak
          </Button>
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4 mr-2" /> Tambah Transaksi
          </Button>
        </div>
      </div>

      {/* Kartu Rekap */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-green-200 bg-green-50 dark:bg-green-950/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-green-700 dark:text-green-400 flex items-center gap-2">
              <TrendingUp className="h-4 w-4" /> Total Masuk
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-700 dark:text-green-400">{formatRupiah(rekap?.total_masuk ?? 0)}</p>
            <p className="text-xs text-muted-foreground mt-1">{BULAN_NAMES[parseInt(filterBulan) - 1]} {filterTahun}</p>
          </CardContent>
        </Card>

        <Card className="border-red-200 bg-red-50 dark:bg-red-950/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-red-700 dark:text-red-400 flex items-center gap-2">
              <TrendingDown className="h-4 w-4" /> Total Keluar
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-red-700 dark:text-red-400">{formatRupiah(rekap?.total_keluar ?? 0)}</p>
            <p className="text-xs text-muted-foreground mt-1">{BULAN_NAMES[parseInt(filterBulan) - 1]} {filterTahun}</p>
          </CardContent>
        </Card>

        <Card className={`border-2 ${(rekap?.saldo ?? 0) >= 0 ? "border-blue-200 bg-blue-50 dark:bg-blue-950/20" : "border-orange-200 bg-orange-50 dark:bg-orange-950/20"}`}>
          <CardHeader className="pb-2">
            <CardTitle className={`text-sm font-medium flex items-center gap-2 ${(rekap?.saldo ?? 0) >= 0 ? "text-blue-700 dark:text-blue-400" : "text-orange-700 dark:text-orange-400"}`}>
              <Wallet className="h-4 w-4" /> Saldo
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className={`text-2xl font-bold ${(rekap?.saldo ?? 0) >= 0 ? "text-blue-700 dark:text-blue-400" : "text-orange-700 dark:text-orange-400"}`}>
              {formatRupiah(rekap?.saldo ?? 0)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">{rekap?.jumlah_transaksi ?? 0} transaksi</p>
          </CardContent>
        </Card>
      </div>

      {/* Grafik Bulanan */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <BarChart3 className="h-4 w-4" /> Grafik Keuangan {filterTahun}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="nama" tick={{ fontSize: 11 }} />
              <YAxis tickFormatter={(v) => v >= 1_000_000 ? `${(v/1_000_000).toFixed(1)}jt` : v >= 1000 ? `${(v/1000).toFixed(0)}rb` : String(v)} tick={{ fontSize: 10 }} />
              <Tooltip formatter={tooltipFormatter} />
              <Legend />
              <Bar dataKey="masuk" name="Masuk" fill="#16a34a" radius={[3, 3, 0, 0]} />
              <Bar dataKey="keluar" name="Keluar" fill="#dc2626" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Breakdown Kategori */}
      {rekapKategori.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {masukKategori.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-green-700 dark:text-green-400 flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" /> Rincian Masuk per Kategori
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {masukKategori.map((k) => (
                  <div key={k.kategori} className="flex justify-between items-center text-sm">
                    <div>
                      <span className="font-medium">{k.kategori}</span>
                      <span className="text-muted-foreground text-xs ml-2">({k.jumlah_transaksi}x)</span>
                    </div>
                    <span className="font-semibold text-green-700 dark:text-green-400">{formatRupiah(k.total)}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {keluarKategori.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-red-700 dark:text-red-400 flex items-center gap-2">
                  <TrendingDown className="h-4 w-4" /> Rincian Keluar per Kategori
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {keluarKategori.map((k) => (
                  <div key={k.kategori} className="flex justify-between items-center text-sm">
                    <div>
                      <span className="font-medium">{k.kategori}</span>
                      <span className="text-muted-foreground text-xs ml-2">({k.jumlah_transaksi}x)</span>
                    </div>
                    <span className="font-semibold text-red-700 dark:text-red-400">{formatRupiah(k.total)}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Filter */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-wrap gap-3">
            <Select value={filterBulan} onValueChange={setFilterBulan}>
              <SelectTrigger className="w-36"><SelectValue placeholder="Bulan" /></SelectTrigger>
              <SelectContent>
                {BULAN_NAMES.map((nama, i) => (
                  <SelectItem key={i + 1} value={String(i + 1)}>{nama}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filterTahun} onValueChange={setFilterTahun}>
              <SelectTrigger className="w-28"><SelectValue placeholder="Tahun" /></SelectTrigger>
              <SelectContent>
                {tahunOptions.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>

            <Select value={filterTipe} onValueChange={setFilterTipe}>
              <SelectTrigger className="w-36"><SelectValue placeholder="Semua Tipe" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="semua">Semua Tipe</SelectItem>
                <SelectItem value="masuk">Uang Masuk</SelectItem>
                <SelectItem value="keluar">Uang Keluar</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Tabel */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tanggal</TableHead>
                  <TableHead>Tipe</TableHead>
                  <TableHead>Kategori</TableHead>
                  <TableHead>Keterangan</TableHead>
                  <TableHead className="text-right">Jumlah</TableHead>
                  <TableHead className="text-center w-24">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableSkeleton cols={6} />
            </Table>
          ) : items.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Wallet className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p>Belum ada transaksi untuk periode ini</p>
              <Button variant="outline" size="sm" className="mt-3" onClick={openCreate}>Tambah Transaksi</Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tanggal</TableHead>
                  <TableHead>Tipe</TableHead>
                  <TableHead>Kategori</TableHead>
                  <TableHead>Keterangan</TableHead>
                  <TableHead className="text-right">Jumlah</TableHead>
                  <TableHead className="text-center w-24">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="text-sm">{formatDate(item.tanggal)}</TableCell>
                    <TableCell>
                      <Badge className={item.tipe === "masuk"
                        ? "bg-green-100 text-green-800 hover:bg-green-100 dark:bg-green-900 dark:text-green-200"
                        : "bg-red-100 text-red-800 hover:bg-red-100 dark:bg-red-900 dark:text-red-200"}>
                        {item.tipe === "masuk" ? "Masuk" : "Keluar"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{item.kategori ?? "-"}</TableCell>
                    <TableCell className="text-sm">{item.keterangan}</TableCell>
                    <TableCell className={`text-right font-medium ${item.tipe === "masuk" ? "text-green-700 dark:text-green-400" : "text-red-700 dark:text-red-400"}`}>
                      {item.tipe === "keluar" ? "-" : "+"}{formatRupiah(item.jumlah)}
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-center gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(item)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setDeleteId(item.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Dialog Form */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editData ? "Edit Transaksi" : "Tambah Transaksi"}</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit((v) => saveMutation.mutate(v))} className="space-y-4">
              <FormField control={form.control} name="tanggal" render={({ field }) => (
                <FormItem>
                  <FormLabel>Tanggal</FormLabel>
                  <FormControl><Input type="date" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="tipe" render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipe Transaksi</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Pilih tipe" /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="masuk">Uang Masuk</SelectItem>
                      <SelectItem value="keluar">Uang Keluar</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="kategori" render={({ field }) => (
                <FormItem>
                  <FormLabel>Kategori <span className="text-muted-foreground text-xs">(opsional)</span></FormLabel>
                  <Select onValueChange={field.onChange} value={field.value ?? ""}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Pilih kategori" /></SelectTrigger></FormControl>
                    <SelectContent>
                      {(watchTipe === "masuk" ? KATEGORI_MASUK : KATEGORI_KELUAR).map(k => (
                        <SelectItem key={k} value={k}>{k}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="keterangan" render={({ field }) => (
                <FormItem>
                  <FormLabel>Keterangan</FormLabel>
                  <FormControl><Textarea placeholder="Contoh: Penjualan nasi goreng" {...field} rows={2} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="jumlah" render={({ field }) => (
                <FormItem>
                  <FormLabel>Jumlah (Rp)</FormLabel>
                  <FormControl><Input type="number" min={1} placeholder="50000" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Batal</Button>
                <Button type="submit" disabled={saveMutation.isPending}>
                  {saveMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Simpan
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Konfirmasi Hapus */}
      <AlertDialog open={deleteId !== null} onOpenChange={(open) => { if (!open) setDeleteId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Transaksi?</AlertDialogTitle>
            <AlertDialogDescription>Data transaksi ini akan dihapus permanen.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={() => deleteId !== null && deleteMutation.mutate(deleteId)}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
