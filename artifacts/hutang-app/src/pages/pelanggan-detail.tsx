import { useRoute } from "wouter";
import { useGetPelanggan, getGetPelangganQueryKey } from "@workspace/api-client-react";
import { formatRupiah, formatDate } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2, ArrowLeft, User, Phone, MapPin, AlignLeft } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";

export default function PelangganDetail() {
  const [, params] = useRoute("/pelanggan/:id");
  const id = parseInt(params?.id || "0");

  const { data, isLoading } = useGetPelanggan(id, {
    query: { enabled: !!id }
  });

  if (isLoading) {
    return <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  if (!data) return <div>Pelanggan tidak ditemukan.</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/pelanggan">
          <Button variant="outline" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-primary">{data.nama}</h2>
          <p className="text-muted-foreground">Profil dan riwayat hutang pelanggan.</p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Profil Pelanggan</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start gap-3">
              <User className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <div className="font-medium">Nama</div>
                <div className="text-sm text-muted-foreground">{data.nama}</div>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Phone className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <div className="font-medium">Telepon</div>
                <div className="text-sm text-muted-foreground">{data.telepon || "-"}</div>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <MapPin className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <div className="font-medium">Alamat</div>
                <div className="text-sm text-muted-foreground">{data.alamat || "-"}</div>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <AlignLeft className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <div className="font-medium">Catatan</div>
                <div className="text-sm text-muted-foreground">{data.catatan || "-"}</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Ringkasan Hutang</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center p-3 bg-blue-50/50 rounded-lg border border-blue-100">
              <div className="text-sm font-medium text-blue-800">Total Hutang Tercatat</div>
              <div className="font-bold text-blue-700">{formatRupiah(data.total_hutang)}</div>
            </div>
            <div className="flex justify-between items-center p-3 bg-emerald-50/50 rounded-lg border border-emerald-100">
              <div className="text-sm font-medium text-emerald-800">Total Dibayar</div>
              <div className="font-bold text-emerald-700">{formatRupiah(data.total_dibayar)}</div>
            </div>
            <div className="flex justify-between items-center p-4 bg-orange-50/50 rounded-lg border border-orange-100">
              <div className="text-sm font-medium text-orange-800">Total Sisa Hutang Aktif</div>
              <div className="text-xl font-bold text-orange-700">{formatRupiah(data.sisa_hutang)}</div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Riwayat Hutang</CardTitle>
            <CardDescription>Semua catatan hutang pelanggan ini</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tanggal</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Sisa</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.hutang_list.length === 0 ? (
                    <TableRow><TableCell colSpan={4} className="text-center py-4 text-muted-foreground">Tidak ada hutang</TableCell></TableRow>
                  ) : (
                    data.hutang_list.map(h => (
                      <TableRow key={h.id}>
                        <TableCell>{formatDate(h.tanggal_hutang)}</TableCell>
                        <TableCell>
                          <Badge variant={h.status === "lunas" ? "outline" : "default"} 
                                className={h.status === "aktif" ? "bg-amber-100 text-amber-800 border-amber-200" : "bg-emerald-100 text-emerald-800 border-emerald-200"}>
                            {h.status === "aktif" ? "Aktif" : "Lunas"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-medium">{formatRupiah(h.sisa_hutang)}</TableCell>
                        <TableCell className="text-right">
                          <Link href={`/hutang/${h.id}`}>
                            <Button variant="ghost" size="sm">Detail</Button>
                          </Link>
                        </TableCell>
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
            <CardTitle>Riwayat Pembayaran</CardTitle>
            <CardDescription>Semua pembayaran dari pelanggan ini</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tanggal</TableHead>
                    <TableHead>Catatan</TableHead>
                    <TableHead className="text-right">Nominal</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.pembayaran_list.length === 0 ? (
                    <TableRow><TableCell colSpan={3} className="text-center py-4 text-muted-foreground">Tidak ada pembayaran</TableCell></TableRow>
                  ) : (
                    data.pembayaran_list.map(p => (
                      <TableRow key={p.id}>
                        <TableCell>{formatDate(p.tanggal_bayar)}</TableCell>
                        <TableCell className="truncate max-w-[150px]">{p.catatan || "-"}</TableCell>
                        <TableCell className="text-right font-medium text-emerald-600">+{formatRupiah(p.nominal_bayar)}</TableCell>
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
