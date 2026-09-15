import { useQuery } from "@tanstack/react-query";
import { formatRupiah } from "@/lib/format";
import { openPrintWindow } from "@/lib/print";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Download, Printer, Package, FileSpreadsheet } from "lucide-react";
import { buildPrintStok, type BarangItem } from "./laporan-print-helpers";
import { exportStokCsv, exportStokXlsx } from "./laporan-export-helpers";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

interface Props {
  namaUsaha: string;
  tanggalCetak: string;
}

export default function LaporanStokTab({ namaUsaha, tanggalCetak }: Props) {
  const { data: barangData = [], isLoading: barangLoading } = useQuery<BarangItem[]>({
    queryKey: ["laporan-barang"],
    queryFn: async () => {
      const r = await fetch(`${BASE}/api/barang`, { credentials: "include" });
      return r.ok ? r.json() : [];
    },
  });

  const handlePrint = () => {
    if (!barangData.length) return;
    openPrintWindow(buildPrintStok({ namaUsaha, tanggalCetak, rows: barangData }));
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
        <p className="text-sm text-muted-foreground">Laporan stok barang saat ini beserta status ketersediaan.</p>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => exportStokCsv(barangData)} disabled={!barangData.length}>
            <Download className="mr-2 h-4 w-4" /> Unduh CSV
          </Button>
          <Button variant="outline" onClick={() => exportStokXlsx(namaUsaha, tanggalCetak, barangData)} disabled={!barangData.length} className="text-emerald-700 border-emerald-300 hover:bg-emerald-50">
            <FileSpreadsheet className="mr-2 h-4 w-4" /> Unduh Excel
          </Button>
          <Button onClick={handlePrint} disabled={!barangData.length}>
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

      <Card className="data-card">
        <CardContent className="p-0">
          {barangLoading
            ? <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
            : (
              <div className="overflow-x-auto">
                <Table className="table-premium">
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
    </div>
  );
}
