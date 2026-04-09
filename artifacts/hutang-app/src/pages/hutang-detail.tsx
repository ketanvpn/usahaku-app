import { useState } from "react";
import { useRoute } from "wouter";
import { 
  useGetHutang, useDeletePembayaran,
  getGetHutangQueryKey, getGetHutangListQueryKey, getGetPembayaranListQueryKey, getGetOwnerDashboardQueryKey
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { formatRupiah, formatDate } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Loader2, ArrowLeft, Calendar, FileText, User, Trash2 } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";

export default function HutangDetail() {
  const [, params] = useRoute("/hutang/:id");
  const id = parseInt(params?.id || "0");

  const { data, isLoading } = useGetHutang(id, {
    query: { enabled: !!id }
  });

  const [isDeletePayDialogOpen, setIsDeletePayDialogOpen] = useState(false);
  const [selectedPayId, setSelectedPayId] = useState<number | null>(null);
  const [selectedPayNominal, setSelectedPayNominal] = useState<number>(0);

  const { toast } = useToast();
  const queryClient = useQueryClient();
  const deletePayMutation = useDeletePembayaran();

  const handleDeletePayment = () => {
    if (!selectedPayId) return;
    deletePayMutation.mutate(
      { id: selectedPayId },
      {
        onSuccess: () => {
          toast({ title: "Pembayaran berhasil dihapus" });
          queryClient.invalidateQueries({ queryKey: getGetHutangQueryKey(id) });
          queryClient.invalidateQueries({ queryKey: getGetHutangListQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetPembayaranListQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetOwnerDashboardQueryKey() });
          setIsDeletePayDialogOpen(false);
        },
        onError: (err: any) => toast({ variant: "destructive", title: "Gagal", description: err?.data?.error || err?.message || "Terjadi kesalahan" })
      }
    );
  };

  if (isLoading) {
    return <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  if (!data) return <div>Data hutang tidak ditemukan.</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/hutang">
          <Button variant="outline" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-primary">Detail Hutang</h2>
          <p className="text-muted-foreground">Informasi lengkap hutang dan riwayat pembayaran.</p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle>Informasi Hutang</CardTitle>
            <Badge variant={data.status === "lunas" ? "outline" : "default"} 
                  className={data.status === "aktif" ? "bg-amber-100 text-amber-800 border-amber-200" : "bg-emerald-100 text-emerald-800 border-emerald-200"}>
              {data.status === "aktif" ? "Aktif" : "Lunas"}
            </Badge>
          </CardHeader>
          <CardContent className="space-y-4 pt-4">
            <div className="flex items-start gap-3">
              <User className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <div className="font-medium text-sm text-muted-foreground">Pelanggan</div>
                <Link href={`/pelanggan/${data.pelanggan_id}`} className="font-semibold text-primary hover:underline">
                  {data.pelanggan_nama}
                </Link>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Calendar className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <div className="font-medium text-sm text-muted-foreground">Tanggal Hutang</div>
                <div>{formatDate(data.tanggal_hutang)}</div>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <FileText className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <div className="font-medium text-sm text-muted-foreground">Keterangan</div>
                <div>{data.keterangan || "-"}</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Rincian Nominal</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-border">
              <span className="text-muted-foreground">Nominal Hutang Awal</span>
              <span className="font-medium">{formatRupiah(data.nominal_hutang)}</span>
            </div>
            <div className="flex justify-between items-center pb-2 border-b border-border">
              <span className="text-muted-foreground">Total Telah Dibayar</span>
              <span className="font-medium text-emerald-600">-{formatRupiah(data.total_dibayar)}</span>
            </div>
            <div className="flex justify-between items-center pt-2">
              <span className="font-bold">Sisa Hutang</span>
              <span className="text-xl font-bold text-orange-600">{formatRupiah(data.sisa_hutang)}</span>
            </div>
            {data.status === "aktif" && (
              <div className="pt-4">
                <Link href="/pembayaran" className="block">
                  <Button className="w-full">Catat Pembayaran</Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Riwayat Pembayaran</CardTitle>
          <CardDescription>Pembayaran spesifik untuk catatan hutang ini.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tanggal Bayar</TableHead>
                  <TableHead>Catatan</TableHead>
                  <TableHead className="text-right">Nominal Bayar</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.pembayaran_list.length === 0 ? (
                  <TableRow><TableCell colSpan={4} className="text-center py-6 text-muted-foreground">Belum ada riwayat pembayaran.</TableCell></TableRow>
                ) : (
                  data.pembayaran_list.map(p => (
                    <TableRow key={p.id}>
                      <TableCell>{formatDate(p.tanggal_bayar)}</TableCell>
                      <TableCell className="text-muted-foreground">{p.catatan || "-"}</TableCell>
                      <TableCell className="text-right font-semibold text-emerald-600">+{formatRupiah(p.nominal_bayar)}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive"
                          title="Hapus Pembayaran"
                          onClick={() => {
                            setSelectedPayId(p.id);
                            setSelectedPayNominal(p.nominal_bayar);
                            setIsDeletePayDialogOpen(true);
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={isDeletePayDialogOpen} onOpenChange={setIsDeletePayDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Pembayaran?</AlertDialogTitle>
            <AlertDialogDescription>
              Menghapus pembayaran {formatRupiah(selectedPayNominal)} ini akan mengembalikan sisa hutang ke nominal sebelumnya. Tindakan ini tidak dapat dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeletePayment} className="bg-destructive text-destructive-foreground">
              {deletePayMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
              Hapus Pembayaran
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
