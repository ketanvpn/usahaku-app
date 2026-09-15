import { useGetUpahList, useGetPekerjaList } from "@workspace/api-client-react";
import { formatRupiah } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Download, TrendingUp, TrendingDown, Wallet } from "lucide-react";
import { exportUpahCsv } from "./laporan-export-helpers";

export default function LaporanGajiTab() {
  const { data: allUpahLaporan = [], isLoading: upahLoading } = useGetUpahList({});
  const { data: pekerjaLaporan = [] } = useGetPekerjaList();

  const totalUpahDicatat = allUpahLaporan.reduce((s, u) => s + u.jumlah_total, 0);
  const totalUpahDibayar = allUpahLaporan.reduce((s, u) => s + u.total_dibayar, 0);
  const totalUpahBelumDibayar = allUpahLaporan.reduce((s, u) => s + u.sisa_upah, 0);

  const upahPerPekerja = pekerjaLaporan.map(p => {
    const list = allUpahLaporan.filter(u => u.pekerja_id === p.id);
    return {
      id: p.id,
      nama: p.nama,
      jabatan: p.jabatan ?? "",
      jumlah_catatan: list.length,
      total_upah: list.reduce((s, u) => s + u.jumlah_total, 0),
      total_dibayar: list.reduce((s, u) => s + u.total_dibayar, 0),
      sisa: list.reduce((s, u) => s + u.sisa_upah, 0),
    };
  }).filter(p => p.jumlah_catatan > 0).sort((a, b) => b.sisa - a.sisa);

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
        <p className="text-sm text-muted-foreground">Rekap gaji seluruh tenaga kerja dan status pembayaran.</p>
        <Button variant="outline" onClick={() => exportUpahCsv(allUpahLaporan)} disabled={!allUpahLaporan.length}>
          <Download className="mr-2 h-4 w-4" /> Unduh CSV
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-l-4 border-l-primary">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium">Total Gaji Dicatat</CardTitle>
            <Wallet className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent><p className="text-2xl font-bold">{formatRupiah(totalUpahDicatat)}</p></CardContent>
        </Card>
        <Card className="border-l-4 border-l-emerald-500">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium">Total Sudah Dibayar</CardTitle>
            <TrendingUp className="h-4 w-4 text-emerald-600" />
          </CardHeader>
          <CardContent><p className="text-2xl font-bold text-emerald-600">{formatRupiah(totalUpahDibayar)}</p></CardContent>
        </Card>
        <Card className="border-l-4 border-l-red-500">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium">Sisa Gaji</CardTitle>
            <TrendingDown className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent><p className="text-2xl font-bold text-red-700">{formatRupiah(totalUpahBelumDibayar)}</p></CardContent>
        </Card>
      </div>

      {upahPerPekerja.length > 0 && (
        <Card className="data-card">
          <CardHeader><CardTitle className="text-sm font-medium">Rekap Per Pekerja</CardTitle></CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table className="table-premium">
                <TableHeader>
                  <TableRow>
                    <TableHead>Nama</TableHead>
                    <TableHead>Jabatan</TableHead>
                    <TableHead className="text-right">Jumlah Catatan</TableHead>
                    <TableHead className="text-right">Total Gaji</TableHead>
                    <TableHead className="text-right">Dibayar</TableHead>
                    <TableHead className="text-right">Sisa</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {upahPerPekerja.map(p => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">{p.nama}</TableCell>
                      <TableCell className="text-muted-foreground">{p.jabatan || "—"}</TableCell>
                      <TableCell className="text-right">{p.jumlah_catatan}</TableCell>
                      <TableCell className="text-right">{formatRupiah(p.total_upah)}</TableCell>
                      <TableCell className="text-right text-emerald-700">{formatRupiah(p.total_dibayar)}</TableCell>
                      <TableCell className={`text-right font-bold ${p.sisa > 0 ? "text-red-700" : "text-muted-foreground"}`}>{formatRupiah(p.sisa)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="data-card">
        <CardHeader><CardTitle className="text-sm font-medium">Semua Catatan Gaji</CardTitle></CardHeader>
        <CardContent className="p-0">
          {upahLoading
            ? <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
            : (
              <div className="overflow-x-auto">
                <Table className="table-premium">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Pekerja</TableHead>
                      <TableHead>Keterangan</TableHead>
                      <TableHead>Tanggal Kerja</TableHead>
                      <TableHead className="text-right">Total Gaji</TableHead>
                      <TableHead className="text-right">Dibayar</TableHead>
                      <TableHead className="text-right">Sisa</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {!allUpahLaporan.length
                      ? <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Tidak ada data catatan gaji.</TableCell></TableRow>
                      : allUpahLaporan.map(u => (
                        <TableRow key={u.id}>
                          <TableCell className="font-medium">{u.pekerja_nama}</TableCell>
                          <TableCell>{u.keterangan}</TableCell>
                          <TableCell className="text-muted-foreground">{u.tanggal_kerja}</TableCell>
                          <TableCell className="text-right">{formatRupiah(u.jumlah_total)}</TableCell>
                          <TableCell className="text-right text-emerald-700">{formatRupiah(u.total_dibayar)}</TableCell>
                          <TableCell className={`text-right font-bold ${u.sisa_upah > 0 ? "text-red-700" : "text-muted-foreground"}`}>{formatRupiah(u.sisa_upah)}</TableCell>
                          <TableCell>
                            {u.status === "lunas"
                              ? <Badge variant="outline" className="border-emerald-400 text-emerald-700 bg-emerald-50">Lunas</Badge>
                              : <Badge variant="outline" className="border-orange-400 text-orange-700 bg-orange-50">Belum lunas</Badge>}
                          </TableCell>
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
