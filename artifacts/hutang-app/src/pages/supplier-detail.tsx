import { useParams, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Truck, Package, ShoppingCart, Phone, MapPin, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { formatRupiah, formatDate } from "@/lib/format";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

interface BarangTerbeli {
  barang_id: number;
  nama: string;
  satuan: string;
  total_jumlah: number;
  total_nilai: number;
}

interface TransaksiTerakhir {
  id: number;
  tanggal: string;
  barang_id: number;
  nama_barang: string;
  satuan: string;
  jumlah: number;
  harga_satuan: number;
  total: number;
  keterangan: string | null;
}

interface SupplierDetail {
  id: number;
  usaha_id: number;
  nama: string;
  telepon: string | null;
  alamat: string | null;
  catatan: string | null;
  created_at: string;
  total_transaksi: number;
  total_pembelian: number;
  barang_terbeli: BarangTerbeli[];
  transaksi_terakhir: TransaksiTerakhir[];
}

async function fetchSupplier(id: string): Promise<SupplierDetail> {
  const r = await fetch(`${BASE}/api/suppliers/${id}`, { credentials: "include" });
  if (!r.ok) {
    const e = await r.json().catch(() => ({}));
    throw new Error(e.error || "Gagal memuat supplier");
  }
  return r.json();
}

export default function SupplierDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;

  const { data, isLoading, isError, error } = useQuery<SupplierDetail>({
    queryKey: ["supplier", id],
    queryFn: () => fetchSupplier(id),
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-1/3" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="space-y-4">
        <Link href="/supplier">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" /> Kembali ke Daftar Supplier
          </Button>
        </Link>
        <Card>
          <CardContent className="py-8 text-center text-destructive">
            {(error as Error)?.message ?? "Supplier tidak ditemukan."}
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Link href="/supplier">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" /> Kembali ke Daftar Supplier
          </Button>
        </Link>
      </div>

      {/* Identitas + ringkasan */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Truck className="h-5 w-5 text-primary" />
              {data.nama}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Phone className="h-4 w-4" />
              <span>{data.telepon || "Telepon belum diisi"}</span>
            </div>
            <div className="flex items-start gap-2 text-muted-foreground">
              <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <span>{data.alamat || "Alamat belum diisi"}</span>
            </div>
            {data.catatan && (
              <div className="flex items-start gap-2 text-muted-foreground">
                <FileText className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <span className="whitespace-pre-line">{data.catatan}</span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground font-normal">
              Ringkasan Pembelian
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <p className="text-xs text-muted-foreground">Total Transaksi</p>
              <p className="text-2xl font-bold flex items-center gap-1.5">
                <ShoppingCart className="h-5 w-5 text-blue-500" />
                {data.total_transaksi}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total Nilai Pembelian</p>
              <p className="text-xl font-bold text-emerald-700">
                {formatRupiah(data.total_pembelian)}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Barang yang pernah dibeli dari supplier ini */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Package className="h-4 w-4" />
            Barang dari Supplier Ini
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {data.barang_terbeli.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              Belum ada transaksi pembelian dari supplier ini.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nama Barang</TableHead>
                  <TableHead className="text-right">Total Pembelian</TableHead>
                  <TableHead className="text-right">Total Nilai</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.barang_terbeli.map((b) => (
                  <TableRow key={b.barang_id}>
                    <TableCell className="font-medium">{b.nama}</TableCell>
                    <TableCell className="text-right">
                      {b.total_jumlah} {b.satuan}
                    </TableCell>
                    <TableCell className="text-right text-emerald-700 font-medium">
                      {formatRupiah(b.total_nilai)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* 10 transaksi terakhir */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Transaksi Terakhir</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {data.transaksi_terakhir.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              Belum ada transaksi.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tanggal</TableHead>
                  <TableHead>Barang</TableHead>
                  <TableHead className="text-right">Jumlah</TableHead>
                  <TableHead className="text-right">Harga</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Keterangan</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.transaksi_terakhir.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="text-sm">{formatDate(t.tanggal)}</TableCell>
                    <TableCell className="font-medium">{t.nama_barang}</TableCell>
                    <TableCell className="text-right">
                      {t.jumlah} {t.satuan}
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      {formatRupiah(t.harga_satuan)}
                    </TableCell>
                    <TableCell className="text-right font-medium text-emerald-700">
                      {formatRupiah(t.total)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {t.keterangan ?? "-"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
