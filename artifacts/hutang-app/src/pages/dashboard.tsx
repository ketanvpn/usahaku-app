import { useGetOwnerDashboard } from "@workspace/api-client-react";
import { formatRupiah, formatDate } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2, TrendingDown, TrendingUp, Users, Wallet, CreditCard, Activity } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";

export default function OwnerDashboard() {
  const { data, isLoading } = useGetOwnerDashboard();

  if (isLoading) {
    return (
      <div className="flex h-[50vh] w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-primary">Dashboard</h2>
          <p className="text-muted-foreground">Ringkasan hutang dan pembayaran pelanggan Anda.</p>
        </div>
        <div className="flex gap-2">
          <Link href="/hutang" className="block">
            <Button variant="outline">Lihat Semua Hutang</Button>
          </Link>
          <Link href="/pembayaran" className="block">
            <Button>Catat Pembayaran</Button>
          </Link>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="border-l-4 border-l-orange-500 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Sisa Hutang</CardTitle>
            <TrendingDown className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{formatRupiah(data.sisa_hutang)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Dari {data.jumlah_hutang_aktif} hutang aktif
            </p>
          </CardContent>
        </Card>
        
        <Card className="border-l-4 border-l-emerald-500 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Dibayar</CardTitle>
            <TrendingUp className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">{formatRupiah(data.total_dibayar)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {data.jumlah_hutang_lunas} hutang telah lunas
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-blue-500 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Hutang</CardTitle>
            <Wallet className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{formatRupiah(data.total_hutang)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Keseluruhan tercatat
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-indigo-500 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pelanggan Berhutang</CardTitle>
            <Users className="h-4 w-4 text-indigo-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-indigo-600">{data.jumlah_pelanggan_berhutang}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Pelanggan aktif
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-emerald-500" />
              Pembayaran Terbaru
            </CardTitle>
            <CardDescription>5 transaksi pembayaran terakhir</CardDescription>
          </CardHeader>
          <CardContent className="px-0 md:px-6">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Pelanggan</TableHead>
                    <TableHead>Tanggal</TableHead>
                    <TableHead className="text-right">Nominal</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.pembayaran_terbaru.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center text-muted-foreground py-6">
                        Belum ada pembayaran.
                      </TableCell>
                    </TableRow>
                  ) : (
                    data.pembayaran_terbaru.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell className="font-medium">
                          <Link href={`/pelanggan/${p.pelanggan_id}`} className="hover:underline text-primary">
                            {p.pelanggan_nama}
                          </Link>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{formatDate(p.tanggal_bayar)}</TableCell>
                        <TableCell className="text-right font-semibold text-emerald-600">
                          +{formatRupiah(p.nominal_bayar)}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-orange-500" />
              Hutang Terbesar
            </CardTitle>
            <CardDescription>5 sisa hutang aktif terbesar</CardDescription>
          </CardHeader>
          <CardContent className="px-0 md:px-6">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Pelanggan</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Sisa Hutang</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.hutang_terbesar.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center text-muted-foreground py-6">
                        Tidak ada hutang aktif.
                      </TableCell>
                    </TableRow>
                  ) : (
                    data.hutang_terbesar.map((h) => (
                      <TableRow key={h.id}>
                        <TableCell className="font-medium">
                          <Link href={`/hutang/${h.id}`} className="hover:underline text-primary">
                            {h.pelanggan_nama}
                          </Link>
                        </TableCell>
                        <TableCell>
                          <Badge variant={h.status === "lunas" ? "outline" : "default"} 
                                className={h.status === "aktif" ? "bg-amber-100 text-amber-800 hover:bg-amber-200 border-amber-200" : "bg-emerald-100 text-emerald-800 border-emerald-200"}>
                            {h.status === "aktif" ? "Aktif" : "Lunas"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-semibold text-orange-600">
                          {formatRupiah(h.sisa_hutang)}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
