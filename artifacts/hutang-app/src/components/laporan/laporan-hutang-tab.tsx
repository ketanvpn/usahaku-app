import { useState } from "react";
import {
  useGetLaporan, useGetPelangganList,
  type GetLaporanStatus, type LaporanItem,
} from "@workspace/api-client-react";
import { formatRupiah, formatDate } from "@/lib/format";
import { openPrintWindow } from "@/lib/print";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, Download, Printer, Filter, X, FileSpreadsheet } from "lucide-react";
import { buildPrintHutang } from "./laporan-print-helpers";
import { exportHutangCsv, exportHutangXlsx } from "./laporan-export-helpers";

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

export default function LaporanHutangTab({ namaUsaha, tanggalCetak }: Props) {
  const [filterPelanggan, setFilterPelanggan] = useState<number | undefined>();
  const [filterStatus, setFilterStatus] = useState<GetLaporanStatus | undefined>();
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [hutangPreset, setHutangPreset] = useState<DatePreset | null>(null);

  const { data: pelangganList } = useGetPelangganList();
  const { data: laporanData, isLoading: laporanLoading } = useGetLaporan({
    pelanggan_id: filterPelanggan, status: filterStatus,
    tanggal_dari: dateFrom || undefined, tanggal_sampai: dateTo || undefined,
  });

  const selectedPelanggan = filterPelanggan ? pelangganList?.find(p => p.id === filterPelanggan) : undefined;
  const isSinglePelanggan = !!selectedPelanggan;
  const totalHutang = laporanData?.reduce((s, r) => s + r.nominal_hutang, 0) ?? 0;
  const totalDibayar = laporanData?.reduce((s, r) => s + r.total_dibayar, 0) ?? 0;
  const totalSisa = laporanData?.reduce((s, r) => s + r.sisa_hutang, 0) ?? 0;
  const hasActiveFilter = !!filterPelanggan || !!filterStatus || !!dateFrom || !!dateTo;

  const hutangFilterLines: { label: string; value: string }[] = [];
  if (selectedPelanggan) hutangFilterLines.push({ label: "Pelanggan", value: selectedPelanggan.nama });
  if (filterStatus) hutangFilterLines.push({ label: "Status", value: filterStatus === "aktif" ? "Belum lunas" : "Lunas" });
  if (dateFrom || dateTo) {
    const fmt = (d: string) => new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "long", year: "numeric" }).format(new Date(d));
    hutangFilterLines.push({ label: "Periode", value: `${dateFrom ? fmt(dateFrom) : "awal"} – ${dateTo ? fmt(dateTo) : "sekarang"}` });
  }

  const applyPreset = (preset: DatePreset) => {
    const { from, to } = computePresetDates(preset);
    setDateFrom(from);
    setDateTo(to);
    setHutangPreset(preset);
  };

  const handlePrint = () => {
    if (!laporanData?.length) return;
    openPrintWindow(buildPrintHutang({
      namaUsaha, tanggalCetak, filterLines: hutangFilterLines,
      isSinglePelanggan, pelangganNama: selectedPelanggan?.nama ?? "",
      totalHutang, totalDibayar, totalSisa, rows: laporanData,
    }));
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
        <p className="text-sm text-muted-foreground">Data hutang dan pembayaran pelanggan.</p>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => laporanData && exportHutangCsv(laporanData, totalHutang, totalDibayar, totalSisa)} disabled={!laporanData?.length}>
            <Download className="mr-2 h-4 w-4" /> Unduh CSV
          </Button>
          <Button variant="outline" onClick={() => laporanData && exportHutangXlsx(namaUsaha, tanggalCetak, laporanData, totalHutang, totalDibayar, totalSisa, isSinglePelanggan, selectedPelanggan?.nama ?? "")} disabled={!laporanData?.length} className="text-emerald-700 border-emerald-300 hover:bg-emerald-50">
            <FileSpreadsheet className="mr-2 h-4 w-4" /> Unduh Excel
          </Button>
          <Button onClick={handlePrint} disabled={!laporanData?.length}>
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
              <Button variant="ghost" size="sm" onClick={() => { setFilterPelanggan(undefined); setFilterStatus(undefined); setDateFrom(""); setDateTo(""); setHutangPreset(null); }}
                className="text-muted-foreground h-7 px-2">
                <X className="h-3 w-3 mr-1" /> Reset
              </Button>
            )}
          </div>
          <div className="mb-4 flex flex-wrap gap-2">
            {(["today", "week", "7d", "30d", "month"] as const).map(preset => (
              <Button key={preset} variant={hutangPreset === preset ? "default" : "outline"} size="sm" onClick={() => applyPreset(preset)}>
                {preset === "today" ? "Hari ini" : preset === "week" ? "Minggu ini" : preset === "7d" ? "7 hari" : preset === "30d" ? "30 hari" : "Bulan ini"}
              </Button>
            ))}
            {(dateFrom || dateTo) && hutangPreset === null && (
              <Badge variant="secondary" className="text-xs">Mode: Custom</Badge>
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
                  <SelectItem value="aktif">Belum lunas</SelectItem>
                  <SelectItem value="lunas">Lunas</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Dari Tanggal</Label>
              <Input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setHutangPreset(null); }} className="bg-background" />
            </div>
            <div className="space-y-2">
              <Label>Sampai Tanggal</Label>
              <Input type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setHutangPreset(null); }} className="bg-background" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="data-card">
        <CardContent className="p-0">
          {laporanLoading
            ? <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
            : (
              <div className="overflow-x-auto">
                <Table className="table-premium">
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
                              {row.status === "aktif" ? "Belum lunas" : "Lunas"}
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
    </div>
  );
}
