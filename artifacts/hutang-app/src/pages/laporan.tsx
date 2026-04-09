import { useState } from "react";
import {
  useGetLaporan,
  useGetPelangganList,
  useGetUsaha,
  GetLaporanStatus,
} from "@workspace/api-client-react";
import { useAuth } from "@/hooks/use-auth";
import { formatRupiah, formatDate } from "@/lib/format";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Loader2, Download, Printer, Filter } from "lucide-react";

export default function LaporanPage() {
  const { user } = useAuth();
  const [filterPelanggan, setFilterPelanggan] = useState<number | undefined>(undefined);
  const [filterStatus, setFilterStatus] = useState<GetLaporanStatus | undefined>(undefined);
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");

  const { data: pelangganList } = useGetPelangganList();
  const { data: usahaData } = useGetUsaha(user?.usaha_id ?? 0, {
    query: { enabled: !!user?.usaha_id },
  });

  const { data: laporanData, isLoading } = useGetLaporan({
    pelanggan_id: filterPelanggan,
    status: filterStatus,
    tanggal_dari: dateFrom || undefined,
    tanggal_sampai: dateTo || undefined,
  });

  const namaUsaha = usahaData?.nama_usaha ?? "—";
  const selectedPelanggan = filterPelanggan
    ? pelangganList?.find((p) => p.id === filterPelanggan)
    : undefined;
  const isSinglePelanggan = !!selectedPelanggan;

  const judulLaporan = isSinglePelanggan
    ? `Riwayat Hutang Pelanggan: ${selectedPelanggan.nama}`
    : "Laporan Buku Hutang";

  const totalHutang = laporanData?.reduce((sum, r) => sum + r.nominal_hutang, 0) ?? 0;
  const totalDibayar = laporanData?.reduce((sum, r) => sum + r.total_dibayar, 0) ?? 0;
  const totalSisa = laporanData?.reduce((sum, r) => sum + r.sisa_hutang, 0) ?? 0;

  const handlePrint = () => {
    window.print();
  };

  const handleExportCsv = () => {
    if (!laporanData || laporanData.length === 0) return;

    const headers = [
      "Tanggal Hutang",
      "Pelanggan",
      "Keterangan",
      "Status",
      "Nominal Hutang",
      "Total Dibayar",
      "Sisa Hutang",
    ];

    const rows = laporanData.map((row) => [
      row.tanggal_hutang.split("T")[0],
      `"${row.nama_pelanggan}"`,
      `"${row.keterangan || ""}"`,
      row.status,
      row.nominal_hutang,
      row.total_dibayar,
      row.sisa_hutang,
    ]);

    rows.push([
      "TOTAL",
      "",
      "",
      "",
      totalHutang.toString(),
      totalDibayar.toString(),
      totalSisa.toString(),
    ]);

    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `laporan_hutang_${new Date().toISOString().split("T")[0]}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const tanggalCetak = new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date());

  const filterLines: { label: string; value: string }[] = [];
  if (selectedPelanggan) filterLines.push({ label: "Pelanggan", value: selectedPelanggan.nama });
  if (filterStatus)
    filterLines.push({
      label: "Status",
      value: filterStatus === "aktif" ? "Aktif" : "Lunas",
    });
  if (dateFrom || dateTo) {
    const periode = [
      dateFrom
        ? new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "long", year: "numeric" }).format(
            new Date(dateFrom)
          )
        : "awal",
      dateTo
        ? new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "long", year: "numeric" }).format(
            new Date(dateTo)
          )
        : "sekarang",
    ].join(" – ");
    filterLines.push({ label: "Periode", value: periode });
  }

  return (
    <div className="space-y-6">
      {/* Screen header */}
      <div className="flex flex-col md:flex-row justify-between md:items-center gap-4 no-print">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-primary">Laporan</h2>
          <p className="text-muted-foreground">Laporan data hutang dengan filter lengkap.</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleExportCsv}
            disabled={!laporanData || laporanData.length === 0}
          >
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
          <Button onClick={handlePrint} disabled={!laporanData || laporanData.length === 0}>
            <Printer className="mr-2 h-4 w-4" />
            Cetak
          </Button>
        </div>
      </div>

      {/* Filter panel — screen only */}
      <Card className="bg-muted/30 no-print border-primary/20 shadow-sm">
        <CardContent className="p-5">
          <div className="flex items-center gap-2 text-sm font-semibold text-primary mb-4">
            <Filter className="h-4 w-4" /> Filter Laporan
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label>Pelanggan</Label>
              <Select
                value={filterPelanggan?.toString() || "semua"}
                onValueChange={(v) =>
                  setFilterPelanggan(v === "semua" ? undefined : parseInt(v))
                }
              >
                <SelectTrigger className="bg-background">
                  <SelectValue placeholder="Semua Pelanggan" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="semua">Semua Pelanggan</SelectItem>
                  {pelangganList?.map((p) => (
                    <SelectItem key={p.id} value={p.id.toString()}>
                      {p.nama}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Status Hutang</Label>
              <Select
                value={filterStatus || "semua"}
                onValueChange={(v) =>
                  setFilterStatus(v === "semua" ? undefined : (v as GetLaporanStatus))
                }
              >
                <SelectTrigger className="bg-background">
                  <SelectValue placeholder="Semua Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="semua">Semua Status</SelectItem>
                  <SelectItem value="aktif">Hanya Aktif</SelectItem>
                  <SelectItem value="lunas">Hanya Lunas</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Dari Tanggal</Label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="bg-background"
              />
            </div>
            <div className="space-y-2">
              <Label>Sampai Tanggal</Label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="bg-background"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── PRINT HEADER — hidden on screen, visible only when printing ── */}
      <div className="print-header hidden">
        <div style={{ borderBottom: "2px solid #333", paddingBottom: "8px", marginBottom: "10px" }}>
          <div style={{ fontSize: "14pt", fontWeight: "bold" }}>
            {namaUsaha}
          </div>
          <div style={{ fontSize: "13pt", fontWeight: "bold", marginTop: "2px" }}>
            {judulLaporan}
          </div>
        </div>

        <table
          style={{
            borderCollapse: "collapse",
            fontSize: "9pt",
            marginBottom: "6px",
            width: "auto",
            tableLayout: "auto",
          }}
        >
          <tbody>
            <tr>
              <td style={{ paddingRight: "12px", verticalAlign: "top", fontWeight: "600" }}>
                Tanggal Cetak
              </td>
              <td style={{ verticalAlign: "top" }}>: {tanggalCetak}</td>
            </tr>
            {filterLines.map((fl) => (
              <tr key={fl.label}>
                <td style={{ paddingRight: "12px", verticalAlign: "top", fontWeight: "600" }}>
                  {fl.label}
                </td>
                <td style={{ verticalAlign: "top" }}>: {fl.value}</td>
              </tr>
            ))}
            {filterLines.length === 0 && (
              <tr>
                <td style={{ paddingRight: "12px", fontWeight: "600" }}>Filter</td>
                <td>: Semua data</td>
              </tr>
            )}
          </tbody>
        </table>

        {/* Per-customer summary block */}
        {isSinglePelanggan && laporanData && laporanData.length > 0 && (
          <div
            style={{
              border: "1px solid #ccc",
              borderRadius: "3px",
              padding: "6px 10px",
              marginTop: "8px",
              marginBottom: "10px",
              fontSize: "9pt",
              background: "#fafafa",
            }}
          >
            <div style={{ fontWeight: "bold", marginBottom: "4px" }}>
              Ringkasan: {selectedPelanggan.nama}
            </div>
            <table style={{ borderCollapse: "collapse", width: "auto", tableLayout: "auto" }}>
              <tbody>
                <tr>
                  <td style={{ paddingRight: "16px" }}>Total Hutang</td>
                  <td style={{ fontWeight: "600" }}>: {formatRupiah(totalHutang)}</td>
                </tr>
                <tr>
                  <td style={{ paddingRight: "16px" }}>Total Dibayar</td>
                  <td style={{ fontWeight: "600", color: "#1a7a4a" }}>
                    : {formatRupiah(totalDibayar)}
                  </td>
                </tr>
                <tr>
                  <td style={{ paddingRight: "16px" }}>Sisa Hutang</td>
                  <td style={{ fontWeight: "700", color: "#b45309" }}>
                    : {formatRupiah(totalSisa)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>
      {/* ── END PRINT HEADER ── */}

      {/* Data table */}
      <Card className="print-clean">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center p-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tanggal</TableHead>
                    <TableHead>Pelanggan</TableHead>
                    <TableHead>Keterangan</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Nominal Hutang</TableHead>
                    <TableHead className="text-right">Total Dibayar</TableHead>
                    <TableHead className="text-right text-primary">Sisa Hutang</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {!laporanData || laporanData.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={7}
                        className="text-center py-8 text-muted-foreground"
                      >
                        Tidak ada data sesuai filter.
                      </TableCell>
                    </TableRow>
                  ) : (
                    laporanData.map((row, idx) => (
                      <TableRow key={idx}>
                        <TableCell className="whitespace-nowrap">
                          {formatDate(row.tanggal_hutang)}
                        </TableCell>
                        <TableCell className="font-medium">{row.nama_pelanggan}</TableCell>
                        <TableCell className="truncate max-w-[200px] text-muted-foreground">
                          {row.keterangan || "—"}
                        </TableCell>
                        <TableCell>
                          {/* Use semantic span classes for print-friendly badges */}
                          <span
                            className={
                              row.status === "aktif"
                                ? "print-badge-aktif inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-amber-100 text-amber-800"
                                : "print-badge-lunas inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-emerald-100 text-emerald-800"
                            }
                          >
                            {row.status === "aktif" ? "Aktif" : "Lunas"}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          {formatRupiah(row.nominal_hutang)}
                        </TableCell>
                        <TableCell className="text-right text-emerald-600">
                          {formatRupiah(row.total_dibayar)}
                        </TableCell>
                        <TableCell className="text-right font-bold text-orange-600">
                          {formatRupiah(row.sisa_hutang)}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
                {laporanData && laporanData.length > 0 && (
                  <TableFooter>
                    <TableRow className="bg-primary/5">
                      <TableCell colSpan={4} className="font-bold text-right">
                        TOTAL KESELURUHAN
                      </TableCell>
                      <TableCell className="text-right font-bold">
                        {formatRupiah(totalHutang)}
                      </TableCell>
                      <TableCell className="text-right font-bold text-emerald-700">
                        {formatRupiah(totalDibayar)}
                      </TableCell>
                      <TableCell className="text-right font-bold text-orange-700 text-lg">
                        {formatRupiah(totalSisa)}
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
