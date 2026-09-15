import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { formatRupiah, formatDate } from "@/lib/format";
import { openPrintWindow } from "@/lib/print";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, Download, Printer, Filter, X, TrendingUp, TrendingDown, Wallet, FileSpreadsheet, Copy } from "lucide-react";
import { buildPrintKeuangan, type KeuanganItem } from "./laporan-print-helpers";
import { exportKeuanganCsv, exportKeuanganXlsx } from "./laporan-export-helpers";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

type KeuTipe = "semua" | "masuk" | "keluar";
type DatePreset = "today" | "week" | "7d" | "30d" | "month";

function toYmd(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function computePresetDates(preset: DatePreset): { from: string; to: string } {
  const now = new Date();
  const end = toYmd(now);
  if (preset === "today") return { from: end, to: end };
  if (preset === "week") {
    const day = now.getDay();
    const diff = day === 0 ? 6 : day - 1;
    const start = new Date(now);
    start.setDate(start.getDate() - diff);
    return { from: toYmd(start), to: end };
  }
  if (preset === "month") {
    return { from: toYmd(new Date(now.getFullYear(), now.getMonth(), 1)), to: end };
  }
  const days = preset === "7d" ? 6 : 29;
  const start = new Date(now);
  start.setDate(start.getDate() - days);
  return { from: toYmd(start), to: end };
}

interface Props {
  namaUsaha: string;
  tanggalCetak: string;
}

export default function LaporanKeuanganTab({ namaUsaha, tanggalCetak }: Props) {
  const [keuDari, setKeuDari] = useState("");
  const [keuSampai, setKeuSampai] = useState("");
  const [keuTipe, setKeuTipe] = useState<KeuTipe>("semua");
  const [keuPreset, setKeuPreset] = useState<DatePreset | null>(null);
  const [copyState, setCopyState] = useState<"idle" | "done" | "error">("idle");

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

  const totalMasuk = keuanganData.filter(k => k.tipe === "masuk").reduce((s, k) => s + k.jumlah, 0);
  const totalKeluar = keuanganData.filter(k => k.tipe === "keluar").reduce((s, k) => s + k.jumlah, 0);
  const saldo = totalMasuk - totalKeluar;
  const hasActiveFilter = !!keuDari || !!keuSampai || keuTipe !== "semua";

  const keuFilterLines: { label: string; value: string }[] = [];
  if (keuTipe !== "semua") keuFilterLines.push({ label: "Tipe", value: keuTipe === "masuk" ? "Masuk" : "Keluar" });
  if (keuDari || keuSampai) {
    const fmt = (d: string) => new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "long", year: "numeric" }).format(new Date(d));
    keuFilterLines.push({ label: "Periode", value: `${keuDari ? fmt(keuDari) : "awal"} – ${keuSampai ? fmt(keuSampai) : "sekarang"}` });
  }

  const applyPreset = (preset: DatePreset) => {
    const { from, to } = computePresetDates(preset);
    setKeuDari(from);
    setKeuSampai(to);
    setKeuPreset(preset);
  };

  const copyRingkasan = async () => {
    const lines = [
      `Ringkasan Keuangan - ${namaUsaha}`,
      `Tanggal cetak: ${tanggalCetak}`,
      ...(keuFilterLines.length > 0 ? keuFilterLines.map(f => `${f.label}: ${f.value}`) : ["Filter: Semua data"]),
      `Total Masuk: ${formatRupiah(totalMasuk)}`,
      `Total Keluar: ${formatRupiah(totalKeluar)}`,
      `Saldo Bersih: ${formatRupiah(saldo)}`,
      `Jumlah Transaksi: ${keuanganData.length}`,
    ];
    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      setCopyState("done");
      setTimeout(() => setCopyState("idle"), 1500);
    } catch {
      setCopyState("error");
      setTimeout(() => setCopyState("idle"), 1500);
    }
  };

  const handlePrint = () => {
    if (!keuanganData.length) return;
    openPrintWindow(buildPrintKeuangan({
      namaUsaha, tanggalCetak, filterLines: keuFilterLines,
      totalMasuk, totalKeluar, saldo, rows: keuanganData,
    }));
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
        <p className="text-sm text-muted-foreground">Rekap pemasukan dan pengeluaran keuangan usaha.</p>
        <div className="flex gap-2">
          <Button variant="outline" onClick={copyRingkasan}>
            <Copy className="mr-2 h-4 w-4" />
            {copyState === "done" ? "Tersalin" : copyState === "error" ? "Gagal Salin" : "Salin Ringkasan"}
          </Button>
          <Button variant="outline" onClick={() => exportKeuanganCsv(keuanganData)} disabled={!keuanganData.length}>
            <Download className="mr-2 h-4 w-4" /> Unduh CSV
          </Button>
          <Button variant="outline" onClick={() => exportKeuanganXlsx(namaUsaha, tanggalCetak, keuanganData, totalMasuk, totalKeluar, saldo)} disabled={!keuanganData.length} className="text-emerald-700 border-emerald-300 hover:bg-emerald-50">
            <FileSpreadsheet className="mr-2 h-4 w-4" /> Unduh Excel
          </Button>
          <Button onClick={handlePrint} disabled={!keuanganData.length}>
            <Printer className="mr-2 h-4 w-4" /> Cetak / PDF
          </Button>
        </div>
      </div>

      <Card className="toolbar-card">
        <CardContent className="p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-primary">
              <Filter className="h-4 w-4" /> Filter
            </div>
            {hasActiveFilter && (
              <Button variant="ghost" size="sm" onClick={() => { setKeuDari(""); setKeuSampai(""); setKeuTipe("semua"); setKeuPreset(null); }}
                className="text-muted-foreground h-7 px-2">
                <X className="h-3 w-3 mr-1" /> Reset
              </Button>
            )}
          </div>
          <div className="mb-4 flex flex-wrap gap-2">
            {(["today", "week", "7d", "30d", "month"] as const).map(preset => (
              <Button key={preset} variant={keuPreset === preset ? "default" : "outline"} size="sm" onClick={() => applyPreset(preset)}>
                {preset === "today" ? "Hari ini" : preset === "week" ? "Minggu ini" : preset === "7d" ? "7 hari" : preset === "30d" ? "30 hari" : "Bulan ini"}
              </Button>
            ))}
            {(keuDari || keuSampai) && keuPreset === null && (
              <Badge variant="secondary" className="text-xs">Mode: Custom</Badge>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Tipe</Label>
              <Select value={keuTipe} onValueChange={v => setKeuTipe(v as KeuTipe)}>
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
              <Input type="date" value={keuDari} onChange={e => { setKeuDari(e.target.value); setKeuPreset(null); }} className="bg-background" />
            </div>
            <div className="space-y-2">
              <Label>Sampai Tanggal</Label>
              <Input type="date" value={keuSampai} onChange={e => { setKeuSampai(e.target.value); setKeuPreset(null); }} className="bg-background" />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard
          title="Total Masuk"
          value={keuLoading ? "..." : formatRupiah(totalMasuk)}
          variant="success"
          icon={<TrendingUp className="h-5 w-5" />}
        />
        <StatCard
          title="Total Keluar"
          value={keuLoading ? "..." : formatRupiah(totalKeluar)}
          variant="danger"
          icon={<TrendingDown className="h-5 w-5" />}
        />
        <StatCard
          title="Saldo Bersih"
          value={keuLoading ? "..." : formatRupiah(saldo)}
          variant={saldo >= 0 ? "info" : "warning"}
          icon={<Wallet className="h-5 w-5" />}
        />
      </div>

      <Card className="data-card">
        <CardContent className="p-0">
          {keuLoading
            ? <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
            : (
              <div className="overflow-x-auto">
                <Table className="table-premium">
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
    </div>
  );
}
