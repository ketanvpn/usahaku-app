import { useRoute } from "wouter";
import { useGetPelanggan, useGetUsaha, getGetPelangganQueryKey, getGetUsahaQueryKey } from "@workspace/api-client-react";
import { useAuth } from "@/hooks/use-auth";
import { formatRupiah, formatDate } from "@/lib/format";
import { buildWhatsAppReminderUrl } from "@/lib/whatsapp";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2, ArrowLeft, User, Phone, MapPin, AlignLeft, TrendingUp, CheckCircle2, MessageCircle } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";

export default function PelangganDetail() {
  const { user } = useAuth();
  const [, params] = useRoute("/pelanggan/:id");
  const id = parseInt(params?.id || "0");

  const { data, isLoading } = useGetPelanggan(id, {
    query: { enabled: !!id, queryKey: getGetPelangganQueryKey(id) },
  });

  const { data: usahaData } = useGetUsaha(user?.usaha_id ?? 0, {
    query: { enabled: !!user?.usaha_id, queryKey: getGetUsahaQueryKey(user?.usaha_id ?? 0) },
  });
  const namaUsaha = usahaData?.nama_usaha ?? "Usahaku";

  if (isLoading) {
    return (
      <div className="flex justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!data) return <div className="p-8 text-muted-foreground">Pelanggan tidak ditemukan.</div>;

  const hutangAktif = data.hutang_list.filter((h) => h.status === "aktif");
  const hutangLunas = data.hutang_list.filter((h) => h.status === "lunas");
  const sisaAktif = hutangAktif.reduce((s, h) => s + h.sisa_hutang, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Link href="/pelanggan">
            <Button variant="outline" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h2 className="text-3xl font-bold tracking-tight text-primary">{data.nama}</h2>
            <p className="text-muted-foreground">Profil pelanggan dan riwayat hutangnya.</p>
          </div>
        </div>
        {sisaAktif > 0 && (
          <a
            href={buildWhatsAppReminderUrl({
              telepon: data.telepon,
              namaPelanggan: data.nama,
              namaUsaha,
              nominalHutang: data.total_hutang,
              sisaHutang: sisaAktif,
            })}
            target="_blank"
            rel="noreferrer"
          >
            <Button
              className="rounded-xl border border-emerald-600/30 bg-emerald-600 text-white shadow-lg shadow-emerald-600/20 hover:bg-emerald-700"
            >
              <MessageCircle className="mr-2 h-4 w-4" />
              Kirim Rincian Tagihan WA
            </Button>
          </a>
        )}
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
          <CardContent className="space-y-3">
            <div className="flex justify-between items-center p-3 bg-blue-50/50 rounded-lg border border-blue-100">
                <div className="text-sm font-medium text-blue-800">Total Hutang</div>
              <div className="font-bold text-blue-700">{formatRupiah(data.total_hutang)}</div>
            </div>
            <div className="flex justify-between items-center p-3 bg-emerald-50/50 rounded-lg border border-emerald-100">
                <div className="text-sm font-medium text-emerald-800">Total Sudah Dibayar</div>
              <div className="font-bold text-emerald-700">{formatRupiah(data.total_dibayar)}</div>
            </div>
            <div className="flex justify-between items-center p-4 bg-orange-50/50 rounded-lg border border-orange-100">
                <div className="text-sm font-medium text-orange-800">Total Sisa Hutang</div>
              <div className="text-xl font-bold text-orange-700">{formatRupiah(sisaAktif)}</div>
            </div>
            <div className="grid grid-cols-2 gap-2 pt-1">
              <div className="text-center p-2 bg-amber-50 rounded border border-amber-100">
                <div className="text-lg font-bold text-amber-700">{hutangAktif.length}</div>
                <div className="text-xs text-amber-600">Belum lunas</div>
              </div>
              <div className="text-center p-2 bg-emerald-50 rounded border border-emerald-100">
                <div className="text-lg font-bold text-emerald-700">{hutangLunas.length}</div>
                <div className="text-xs text-emerald-600">Lunas</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {hutangAktif.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-amber-600" />
              <CardTitle>Hutang Belum Lunas</CardTitle>
            </div>
            <CardDescription>{hutangAktif.length} hutang masih terbuka</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tanggal</TableHead>
                    <TableHead>Keterangan</TableHead>
                    <TableHead className="text-right">Nominal</TableHead>
                    <TableHead className="text-right">Sisa</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {hutangAktif.map((h) => (
                    <TableRow key={h.id}>
                      <TableCell className="whitespace-nowrap">{formatDate(h.tanggal_hutang)}</TableCell>
                      <TableCell className="text-muted-foreground max-w-[180px] truncate">{h.keterangan || "-"}</TableCell>
                      <TableCell className="text-right">{formatRupiah(h.nominal_hutang)}</TableCell>
                      <TableCell className="text-right font-bold text-orange-600">{formatRupiah(h.sisa_hutang)}</TableCell>
                      <TableCell className="text-right">
                        <Link href={`/hutang/${h.id}`}>
                          <Button variant="ghost" size="sm">Detail</Button>
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {hutangLunas.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              <CardTitle>Hutang Lunas</CardTitle>
            </div>
            <CardDescription>{hutangLunas.length} hutang sudah dilunasi</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tanggal</TableHead>
                    <TableHead>Keterangan</TableHead>
                    <TableHead className="text-right">Nominal</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {hutangLunas.map((h) => (
                    <TableRow key={h.id} className="text-muted-foreground">
                      <TableCell className="whitespace-nowrap">{formatDate(h.tanggal_hutang)}</TableCell>
                      <TableCell className="max-w-[180px] truncate">{h.keterangan || "-"}</TableCell>
                      <TableCell className="text-right">{formatRupiah(h.nominal_hutang)}</TableCell>
                      <TableCell className="text-right">
                        <Link href={`/hutang/${h.id}`}>
                          <Button variant="ghost" size="sm">Detail</Button>
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {data.hutang_list.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Pelanggan ini belum memiliki catatan hutang.
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Riwayat Pembayaran Terbaru</CardTitle>
          <CardDescription>Semua pembayaran dari pelanggan ini (terbaru di atas)</CardDescription>
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
                  <TableRow>
                    <TableCell colSpan={3} className="text-center py-6 text-muted-foreground">
                      Tidak ada riwayat pembayaran.
                    </TableCell>
                  </TableRow>
                ) : (
                  data.pembayaran_list.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="whitespace-nowrap">{formatDate(p.tanggal_bayar)}</TableCell>
                      <TableCell className="truncate max-w-[200px] text-muted-foreground">{p.catatan || "-"}</TableCell>
                      <TableCell className="text-right font-medium text-emerald-600">
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
    </div>
  );
}
