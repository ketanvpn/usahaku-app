import { useGetAdminDashboard } from "@workspace/api-client-react";
import { formatRupiah } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Building2, Users, Wallet, CreditCard, LayoutDashboard } from "lucide-react";
import { Link } from "wouter";

export default function AdminDashboard() {
  const { data, isLoading } = useGetAdminDashboard();

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
      <div>
        <h2 className="text-3xl font-bold tracking-tight text-primary">Dashboard Global</h2>
        <p className="text-muted-foreground">Ringkasan sistem aplikasi manajemen hutang.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="border-l-4 border-l-blue-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Usaha</CardTitle>
            <Building2 className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{data.jumlah_usaha}</div>
          </CardContent>
        </Card>
        
        <Card className="border-l-4 border-l-indigo-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Owner Aktif</CardTitle>
            <Users className="h-4 w-4 text-indigo-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-indigo-600">{data.jumlah_owner_aktif}</div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-orange-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Sisa Hutang</CardTitle>
            <Wallet className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{formatRupiah(data.total_sisa_hutang)}</div>
            <p className="text-xs text-muted-foreground mt-1">Keseluruhan sistem</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-emerald-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Pembayaran</CardTitle>
            <CreditCard className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">{formatRupiah(data.total_dibayar)}</div>
            <p className="text-xs text-muted-foreground mt-1">Keseluruhan sistem</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Usaha Terbaru</CardTitle>
            <CardDescription>5 pendaftaran usaha terakhir</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nama Usaha</TableHead>
                    <TableHead>Telepon</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.usaha_terbaru.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={2} className="text-center text-muted-foreground py-6">
                        Belum ada usaha.
                      </TableCell>
                    </TableRow>
                  ) : (
                    data.usaha_terbaru.map((u) => (
                      <TableRow key={u.id}>
                        <TableCell className="font-medium">{u.nama_usaha}</TableCell>
                        <TableCell>{u.telepon || "-"}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Usaha dengan Hutang Terbesar</CardTitle>
            <CardDescription>5 usaha dengan sisa hutang terbanyak</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nama Usaha</TableHead>
                    <TableHead>Pelanggan</TableHead>
                    <TableHead className="text-right">Total Sisa</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.usaha_hutang_terbesar.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center text-muted-foreground py-6">
                        Tidak ada data.
                      </TableCell>
                    </TableRow>
                  ) : (
                    data.usaha_hutang_terbesar.map((u) => (
                      <TableRow key={u.id}>
                        <TableCell className="font-medium">{u.nama_usaha}</TableCell>
                        <TableCell>{u.jumlah_pelanggan}</TableCell>
                        <TableCell className="text-right font-semibold text-orange-600">
                          {formatRupiah(u.sisa_hutang)}
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
