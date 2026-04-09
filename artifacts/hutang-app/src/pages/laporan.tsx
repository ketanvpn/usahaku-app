import { useState } from "react";
import {
  useGetLaporan,
  useGetPelangganList,
  useGetUsaha,
  GetLaporanStatus,
  LaporanItem,
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

// ─── helpers (used inside the print HTML generator — no external imports) ─────

function fmtRupiah(n: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(n);
}

function fmtDate(iso: string): string {
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(iso));
}

// ─── Print window builder ─────────────────────────────────────────────────────

function buildPrintHtml(opts: {
  namaUsaha: string;
  judulLaporan: string;
  tanggalCetak: string;
  filterLines: { label: string; value: string }[];
  isSinglePelanggan: boolean;
  pelangganNama: string;
  totalHutang: number;
  totalDibayar: number;
  totalSisa: number;
  rows: LaporanItem[];
}): string {
  const {
    namaUsaha,
    judulLaporan,
    tanggalCetak,
    filterLines,
    isSinglePelanggan,
    pelangganNama,
    totalHutang,
    totalDibayar,
    totalSisa,
    rows,
  } = opts;

  const filterInfoRows = [
    { label: "Tanggal Cetak", value: tanggalCetak },
    ...filterLines,
    ...(filterLines.length === 0 ? [{ label: "Filter", value: "Semua data" }] : []),
  ]
    .map(
      (f) => `
      <tr>
        <td class="fi-label">${f.label}</td>
        <td class="fi-colon">:</td>
        <td>${f.value}</td>
      </tr>`
    )
    .join("");

  const summaryBlock = isSinglePelanggan
    ? `<div class="summary-box">
        <div class="summary-title">Ringkasan: ${pelangganNama}</div>
        <table class="summary-table">
          <tr><td>Total Hutang</td><td>:</td><td>${fmtRupiah(totalHutang)}</td></tr>
          <tr><td>Total Dibayar</td><td>:</td><td class="green">${fmtRupiah(totalDibayar)}</td></tr>
          <tr><td>Sisa Hutang</td><td>:</td><td class="orange"><strong>${fmtRupiah(totalSisa)}</strong></td></tr>
        </table>
      </div>`
    : "";

  const dataRows =
    rows.length === 0
      ? `<tr><td colspan="7" style="text-align:center;padding:20px;color:#666;">Tidak ada data.</td></tr>`
      : rows
          .map((r) => {
            const badge =
              r.status === "aktif"
                ? `<span class="badge badge-aktif">Aktif</span>`
                : `<span class="badge badge-lunas">Lunas</span>`;
            return `<tr>
              <td class="nowrap">${fmtDate(r.tanggal_hutang)}</td>
              <td class="bold">${r.nama_pelanggan}</td>
              <td class="muted">${r.keterangan || "—"}</td>
              <td>${badge}</td>
              <td class="right">${fmtRupiah(r.nominal_hutang)}</td>
              <td class="right green">${fmtRupiah(r.total_dibayar)}</td>
              <td class="right orange bold">${fmtRupiah(r.sisa_hutang)}</td>
            </tr>`;
          })
          .join("");

  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8" />
  <title>${judulLaporan}</title>
  <style>
    @page {
      size: A4 landscape;
      margin: 15mm 14mm 15mm 14mm;
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: Arial, Helvetica, sans-serif;
      font-size: 10pt;
      color: #111;
      background: white;
    }

    .report-wrapper {
      width: 100%;
    }

    /* ── Header ── */
    .header {
      border-bottom: 2px solid #222;
      padding-bottom: 8px;
      margin-bottom: 8px;
    }
    .header-usaha {
      font-size: 14pt;
      font-weight: bold;
    }
    .header-judul {
      font-size: 12pt;
      font-weight: bold;
      margin-top: 2px;
    }

    /* ── Filter info ── */
    .filter-table {
      border-collapse: collapse;
      font-size: 9pt;
      margin-bottom: 8px;
    }
    .fi-label { font-weight: 600; padding-right: 8px; white-space: nowrap; }
    .fi-colon { padding-right: 4px; }

    /* ── Summary box ── */
    .summary-box {
      border: 1px solid #bbb;
      border-radius: 3px;
      padding: 6px 10px;
      margin-bottom: 10px;
      background: #fafafa;
      font-size: 9pt;
      display: inline-block;
    }
    .summary-title { font-weight: bold; margin-bottom: 4px; }
    .summary-table { border-collapse: collapse; }
    .summary-table td { padding: 1px 8px 1px 0; }

    /* ── Data table ── */
    .data-table {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
      font-size: 9pt;
      margin-top: 4px;
    }
    .data-table th {
      background: #eaeaea;
      font-weight: bold;
      border: 1px solid #bbb;
      padding: 5px 6px;
      text-align: left;
    }
    .data-table th.right,
    .data-table td.right { text-align: right; }
    .data-table td {
      border: 1px solid #ccc;
      padding: 4px 6px;
      vertical-align: top;
      word-break: break-word;
    }
    .data-table tfoot tr td {
      background: #eaeaea;
      font-weight: bold;
      border: 1px solid #bbb;
      padding: 5px 6px;
    }

    /* Column widths (landscape A4 ≈ 267mm printable) */
    .col-tanggal  { width: 13%; }
    .col-pelanggan{ width: 16%; }
    .col-keterangan{ width: 20%; }
    .col-status   { width: 8%; }
    .col-nominal  { width: 15%; }
    .col-dibayar  { width: 15%; }
    .col-sisa     { width: 13%; }

    /* helpers */
    .nowrap { white-space: nowrap; }
    .bold   { font-weight: bold; }
    .muted  { color: #555; }
    .green  { color: #1a7a4a; }
    .orange { color: #b45309; }
    .right  { text-align: right; }

    .badge {
      display: inline-block;
      padding: 1px 6px;
      border-radius: 4px;
      font-size: 8pt;
      font-weight: 600;
      border: 1px solid;
    }
    .badge-aktif { color: #92400e; border-color: #d97706; background: transparent; }
    .badge-lunas { color: #065f46; border-color: #059669; background: transparent; }

    /* avoid page breaks mid-row */
    tr { page-break-inside: avoid; }
  </style>
</head>
<body>
  <div class="report-wrapper">

    <div class="header">
      <div class="header-usaha">${namaUsaha}</div>
      <div class="header-judul">${judulLaporan}</div>
    </div>

    <table class="filter-table">
      <tbody>${filterInfoRows}</tbody>
    </table>

    ${summaryBlock}

    <table class="data-table">
      <colgroup>
        <col class="col-tanggal" />
        <col class="col-pelanggan" />
        <col class="col-keterangan" />
        <col class="col-status" />
        <col class="col-nominal" />
        <col class="col-dibayar" />
        <col class="col-sisa" />
      </colgroup>
      <thead>
        <tr>
          <th>Tanggal</th>
          <th>Pelanggan</th>
          <th>Keterangan</th>
          <th>Status</th>
          <th class="right">Nominal Hutang</th>
          <th class="right">Total Dibayar</th>
          <th class="right">Sisa Hutang</th>
        </tr>
      </thead>
      <tbody>${dataRows}</tbody>
      ${
        rows.length > 0
          ? `<tfoot>
          <tr>
            <td colspan="4" class="right">TOTAL KESELURUHAN</td>
            <td class="right">${fmtRupiah(totalHutang)}</td>
            <td class="right green">${fmtRupiah(totalDibayar)}</td>
            <td class="right orange">${fmtRupiah(totalSisa)}</td>
          </tr>
        </tfoot>`
          : ""
      }
    </table>

  </div>
</body>
</html>`;
}

// ─── Page component ───────────────────────────────────────────────────────────

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

  const namaUsaha = usahaData?.nama_usaha ?? "Buku Hutang";
  const selectedPelanggan = filterPelanggan
    ? pelangganList?.find((p) => p.id === filterPelanggan)
    : undefined;
  const isSinglePelanggan = !!selectedPelanggan;

  const judulLaporan = isSinglePelanggan
    ? `Riwayat Hutang Pelanggan: ${selectedPelanggan.nama}`
    : "Laporan Buku Hutang";

  const totalHutang = laporanData?.reduce((s, r) => s + r.nominal_hutang, 0) ?? 0;
  const totalDibayar = laporanData?.reduce((s, r) => s + r.total_dibayar, 0) ?? 0;
  const totalSisa = laporanData?.reduce((s, r) => s + r.sisa_hutang, 0) ?? 0;

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
    const fmt = (d: string) =>
      new Intl.DateTimeFormat("id-ID", {
        day: "numeric",
        month: "long",
        year: "numeric",
      }).format(new Date(d));
    filterLines.push({
      label: "Periode",
      value: `${dateFrom ? fmt(dateFrom) : "awal"} – ${dateTo ? fmt(dateTo) : "sekarang"}`,
    });
  }

  // ── Print: open isolated window ──
  const handlePrint = () => {
    if (!laporanData || laporanData.length === 0) return;

    const html = buildPrintHtml({
      namaUsaha,
      judulLaporan,
      tanggalCetak,
      filterLines,
      isSinglePelanggan,
      pelangganNama: selectedPelanggan?.nama ?? "",
      totalHutang,
      totalDibayar,
      totalSisa,
      rows: laporanData,
    });

    const win = window.open("", "_blank", "width=1100,height=700");
    if (!win) return;
    win.document.open();
    win.document.write(html);
    win.document.close();
    // Wait for fonts/layout, then print
    win.onload = () => {
      win.focus();
      win.print();
    };
  };

  // ── CSV export ──
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
    const rows = laporanData.map((r) => [
      r.tanggal_hutang.split("T")[0],
      `"${r.nama_pelanggan}"`,
      `"${r.keterangan || ""}"`,
      r.status,
      r.nominal_hutang,
      r.total_dibayar,
      r.sisa_hutang,
    ]);
    rows.push(["TOTAL", "", "", "", totalHutang, totalDibayar, totalSisa]);

    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `laporan_hutang_${new Date().toISOString().split("T")[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
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
            Cetak / PDF
          </Button>
        </div>
      </div>

      {/* Filter panel */}
      <Card className="bg-muted/30 border-primary/20 shadow-sm">
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

      {/* Data table (screen view) */}
      <Card>
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
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
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
                          <span
                            className={
                              row.status === "aktif"
                                ? "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-amber-100 text-amber-800"
                                : "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-emerald-100 text-emerald-800"
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
