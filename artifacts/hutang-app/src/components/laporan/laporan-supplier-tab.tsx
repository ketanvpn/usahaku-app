import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Truck, Loader2, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatRupiah, escapeHtml } from "@/lib/format";
import { useAuth } from "@/hooks/use-auth";
import { usePrintContext, loadLogoForPrint } from "@/hooks/use-print-context";
import { buildPrintHeaderHtml, getDefaultPrintHeaderCss } from "@/lib/struk";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

interface SupplierRow {
  supplier_id: number;
  supplier_nama: string;
  total_transaksi: number;
  total_jumlah: number;
  total_nilai: number;
}

interface LaporanResponse {
  periode: string;
  ringkasan_per_supplier: SupplierRow[];
  tanpa_supplier: { total_transaksi: number; total_nilai: number };
  total_keseluruhan: { total_transaksi: number; total_nilai: number };
}

const BULAN_NAMES = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
];

async function fetchLaporan(
  bulan: string,
  tahun: string,
): Promise<LaporanResponse> {
  const params = new URLSearchParams();
  if (bulan && bulan !== "__all__") params.set("bulan", bulan);
  if (tahun) params.set("tahun", tahun);
  const r = await fetch(
    `${BASE}/api/laporan/pembelian-supplier?${params.toString()}`,
    { credentials: "include" },
  );
  if (!r.ok) {
    const e = await r.json().catch(() => ({}));
    throw new Error(e.error || "Gagal memuat laporan");
  }
  return r.json();
}

export default function LaporanSupplierTab() {
  const now = new Date();
  const [bulan, setBulan] = useState(String(now.getMonth() + 1));
  const [tahun, setTahun] = useState(String(now.getFullYear()));
  const [printing, setPrinting] = useState(false);

  const { user } = useAuth();
  const printCtx = usePrintContext();

  const tahunOptions = useMemo(
    () => Array.from({ length: 5 }, (_, i) => String(now.getFullYear() - i)),
    [now],
  );

  const { data, isLoading, isError, error } = useQuery<LaporanResponse>({
    queryKey: ["laporan-pembelian-supplier", bulan, tahun],
    queryFn: () => fetchLaporan(bulan, tahun),
  });

  const handlePrint = async () => {
    if (!data || !printCtx) return;
    setPrinting(true);
    let logoBase64: string | null = null;
    try {
      logoBase64 = await loadLogoForPrint(printCtx, user?.usaha_id ?? null);
    } catch {
      // Logo gagal load tidak boleh blok print, lanjut saja tanpa logo.
    }
    const headerHtml = buildPrintHeaderHtml({
      namaUsaha: printCtx.namaUsaha,
      alamat: printCtx.alamat,
      telepon: printCtx.telepon,
      headerExtra: printCtx.headerExtra,
      logoBase64,
      logoFilename: printCtx.pengaturan?.logo_filename ?? null,
      judul: `Laporan Pembelian per Supplier`,
      meta: data.periode,
    });

    const rows = data.ringkasan_per_supplier
      .map(
        (r, i) => `
        <tr>
          <td style="text-align:center">${i + 1}</td>
          <td>${escapeHtml(r.supplier_nama)}</td>
          <td style="text-align:right">${r.total_transaksi}</td>
          <td style="text-align:right">${formatRupiah(r.total_nilai)}</td>
        </tr>`,
      )
      .join("");

    const tanpaSupplierRow = data.tanpa_supplier.total_transaksi > 0
      ? `<tr style="font-style:italic;color:#666">
          <td style="text-align:center">—</td>
          <td>Tanpa Supplier</td>
          <td style="text-align:right">${data.tanpa_supplier.total_transaksi}</td>
          <td style="text-align:right">${formatRupiah(data.tanpa_supplier.total_nilai)}</td>
        </tr>`
      : "";

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Laporan Pembelian Supplier</title>
  <style>
    @page { size: A4 landscape; margin: 12mm; }
    body { font-family: Arial, sans-serif; font-size: 11pt; }
    ${getDefaultPrintHeaderCss()}
    table { width: 100%; border-collapse: collapse; margin-top: 12px; }
    th, td { border: 1px solid #999; padding: 6px 8px; }
    th { background: #f3f4f6; text-align: left; }
    tfoot td { font-weight: bold; background: #f3f4f6; }
  </style>
</head>
<body>
  ${headerHtml}
  <table>
    <thead>
      <tr>
        <th style="width:40px; text-align:center">#</th>
        <th>Supplier</th>
        <th style="width:120px; text-align:right">Jumlah Transaksi</th>
        <th style="width:160px; text-align:right">Total Pembelian (Rp)</th>
      </tr>
    </thead>
    <tbody>
      ${rows || `<tr><td colspan="4" style="text-align:center; padding:20px; color:#999">Tidak ada transaksi pembelian dengan supplier di periode ini.</td></tr>`}
      ${tanpaSupplierRow}
    </tbody>
    <tfoot>
      <tr>
        <td colspan="2" style="text-align:right">TOTAL KESELURUHAN</td>
        <td style="text-align:right">${data.total_keseluruhan.total_transaksi}</td>
        <td style="text-align:right">${formatRupiah(data.total_keseluruhan.total_nilai)}</td>
      </tr>
    </tfoot>
  </table>
  <script>window.print();</script>
</body>
</html>`;

    const w = window.open("", "_blank", "width=900,height=700");
    if (w) {
      w.document.write(html);
      w.document.close();
    }
    setPrinting(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row justify-between md:items-center gap-3">
        <p className="text-sm text-muted-foreground">
          Rekap pembelian stok dikelompokkan per supplier dalam periode terpilih.
        </p>
        <div className="flex flex-wrap gap-2 items-center">
          <Select value={bulan} onValueChange={setBulan}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Sepanjang Tahun</SelectItem>
              {BULAN_NAMES.map((n, i) => (
                <SelectItem key={i + 1} value={String(i + 1)}>
                  {n}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={tahun} onValueChange={setTahun}>
            <SelectTrigger className="w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {tahunOptions.map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            onClick={handlePrint}
            disabled={!data || data.total_keseluruhan.total_transaksi === 0 || printing}
          >
            {printing ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Printer className="mr-2 h-4 w-4" />
            )}
            Cetak A4
          </Button>
        </div>
      </div>

      {isLoading && (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground text-sm">
            <Loader2 className="h-5 w-5 mx-auto mb-2 animate-spin" />
            Memuat laporan...
          </CardContent>
        </Card>
      )}

      {isError && (
        <Card>
          <CardContent className="py-8 text-center text-destructive text-sm">
            {(error as Error)?.message ?? "Gagal memuat laporan."}
          </CardContent>
        </Card>
      )}

      {data && !isLoading && (
        <>
          <div className="grid gap-3 md:grid-cols-3">
            <Card>
              <CardHeader className="pb-1.5">
                <CardTitle className="text-xs text-muted-foreground font-normal">
                  Periode
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-base font-semibold">{data.periode}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-1.5">
                <CardTitle className="text-xs text-muted-foreground font-normal">
                  Total Transaksi
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">
                  {data.total_keseluruhan.total_transaksi}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-1.5">
                <CardTitle className="text-xs text-muted-foreground font-normal">
                  Total Pembelian
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-emerald-700">
                  {formatRupiah(data.total_keseluruhan.total_nilai)}
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Truck className="h-4 w-4" /> Ringkasan per Supplier
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {data.ringkasan_per_supplier.length === 0 &&
              data.tanpa_supplier.total_transaksi === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  Belum ada transaksi pembelian di periode ini.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Supplier</TableHead>
                      <TableHead className="text-right">Jumlah Transaksi</TableHead>
                      <TableHead className="text-right">Total Nilai (Rp)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.ringkasan_per_supplier.map((r) => (
                      <TableRow key={r.supplier_id}>
                        <TableCell className="font-medium">
                          {r.supplier_nama}
                        </TableCell>
                        <TableCell className="text-right">
                          {r.total_transaksi}
                        </TableCell>
                        <TableCell className="text-right text-emerald-700 font-medium">
                          {formatRupiah(r.total_nilai)}
                        </TableCell>
                      </TableRow>
                    ))}
                    {data.tanpa_supplier.total_transaksi > 0 && (
                      <TableRow className="text-muted-foreground italic">
                        <TableCell>Tanpa Supplier</TableCell>
                        <TableCell className="text-right">
                          {data.tanpa_supplier.total_transaksi}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatRupiah(data.tanpa_supplier.total_nilai)}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
