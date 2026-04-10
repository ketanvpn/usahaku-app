import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, Edit, Trash2, TrendingUp, TrendingDown, Wallet } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import * as z from "zod";
import { formatRupiah, formatDate } from "@/lib/format";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

interface KeuanganItem {
  id: number;
  tanggal: string;
  tipe: "masuk" | "keluar";
  kategori: string | null;
  keterangan: string;
  jumlah: number;
}

interface Rekap {
  total_masuk: number;
  total_keluar: number;
  saldo: number;
  jumlah_transaksi: number;
}

async function fetchKeuangan(params: { bulan: string; tahun: string; tipe: string }): Promise<KeuanganItem[]> {
  const q = new URLSearchParams();
  if (params.bulan) q.set("bulan", params.bulan);
  if (params.tahun) q.set("tahun", params.tahun);
  if (params.tipe && params.tipe !== "semua") q.set("tipe", params.tipe);
  const r = await fetch(`${BASE}/api/keuangan?${q}`, { credentials: "include" });
  if (!r.ok) throw new Error("Gagal memuat data keuangan");
  return r.json();
}

async function fetchRekap(params: { bulan: string; tahun: string }): Promise<Rekap> {
  const q = new URLSearchParams();
  if (params.bulan) q.set("bulan", params.bulan);
  if (params.tahun) q.set("tahun", params.tahun);
  const r = await fetch(`${BASE}/api/keuangan/rekap?${q}`, { credentials: "include" });
  if (!r.ok) throw new Error("Gagal memuat rekap");
  return r.json();
}

const keuanganSchema = z.object({
  tanggal: z.string().min(1, "Tanggal wajib diisi"),
  tipe: z.enum(["masuk", "keluar"], { required_error: "Pilih tipe transaksi" }),
  kategori: z.string().optional(),
  keterangan: z.string().min(1, "Keterangan wajib diisi"),
  jumlah: z.coerce.number().min(1, "Jumlah harus lebih dari 0"),
});

type KeuanganFormValues = z.infer<typeof keuanganSchema>;

const KATEGORI_MASUK = ["Penjualan", "Pelunasan Hutang", "Lain-lain"];
const KATEGORI_KELUAR = ["Pembelian Bahan", "Gaji", "Listrik & Air", "Sewa", "Transport", "Lain-lain"];

const BULAN_NAMES = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember"
];

export default function KeuanganPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const now = new Date();

  const [filterBulan, setFilterBulan] = useState(String(now.getMonth() + 1));
  const [filterTahun, setFilterTahun] = useState(String(now.getFullYear()));
  const [filterTipe, setFilterTipe] = useState("semua");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editData, setEditData] = useState<KeuanganItem | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const filterParams = { bulan: filterBulan, tahun: filterTahun, tipe: filterTipe };
  const rekapParams = { bulan: filterBulan, tahun: filterTahun };

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["keuangan", filterParams],
    queryFn: () => fetchKeuangan(filterParams),
  });

  const { data: rekap } = useQuery({
    queryKey: ["keuangan-rekap", rekapParams],
    queryFn: () => fetchRekap(rekapParams),
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["keuangan"] });
    qc.invalidateQueries({ queryKey: ["keuangan-rekap"] });
  };

  const form = useForm<KeuanganFormValues>({
    resolver: zodResolver(keuanganSchema),
    defaultValues: { tanggal: "", tipe: "masuk", kategori: "", keterangan: "", jumlah: 0 },
  });

  const watchTipe = form.watch("tipe");

  const openCreate = () => {
    setEditData(null);
    form.reset({
      tanggal: new Date().toISOString().split("T")[0],
      tipe: "masuk",
      kategori: "",
      keterangan: "",
      jumlah: 0,
    });
    setDialogOpen(true);
  };

  const openEdit = (item: KeuanganItem) => {
    setEditData(item);
    form.reset({
      tanggal: item.tanggal,
      tipe: item.tipe,
      kategori: item.kategori ?? "",
      keterangan: item.keterangan,
      jumlah: item.jumlah,
    });
    setDialogOpen(true);
  };

  const saveMutation = useMutation({
    mutationFn: async (values: KeuanganFormValues) => {
      const url = editData ? `${BASE}/api/keuangan/${editData.id}` : `${BASE}/api/keuangan`;
      const method = editData ? "PUT" : "POST";
      const r = await fetch(url, {
        method,
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        throw new Error(err.error || "Gagal menyimpan data");
      }
      return r.json();
    },
    onSuccess: () => {
      toast({ title: editData ? "Transaksi diperbarui" : "Transaksi ditambahkan" });
      setDialogOpen(false);
      invalidate();
    },
    onError: (err: Error) => {
      toast({ title: "Gagal", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const r = await fetch(`${BASE}/api/keuangan/${id}`, { method: "DELETE", credentials: "include" });
      if (!r.ok) throw new Error("Gagal menghapus data");
    },
    onSuccess: () => {
      toast({ title: "Transaksi dihapus" });
      setDeleteId(null);
      invalidate();
    },
    onError: (err: Error) => {
      toast({ title: "Gagal", description: err.message, variant: "destructive" });
    },
  });

  const tahunOptions = Array.from({ length: 5 }, (_, i) => String(now.getFullYear() - i));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Pencatatan Keuangan</h1>
          <p className="text-muted-foreground text-sm mt-1">Catat uang masuk dan keluar usaha Anda</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-2" />
          Tambah Transaksi
        </Button>
      </div>

      {/* Kartu Rekap */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-green-200 bg-green-50 dark:bg-green-950/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-green-700 dark:text-green-400 flex items-center gap-2">
              <TrendingUp className="h-4 w-4" /> Total Masuk
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-700 dark:text-green-400">
              {formatRupiah(rekap?.total_masuk ?? 0)}
            </p>
          </CardContent>
        </Card>

        <Card className="border-red-200 bg-red-50 dark:bg-red-950/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-red-700 dark:text-red-400 flex items-center gap-2">
              <TrendingDown className="h-4 w-4" /> Total Keluar
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-red-700 dark:text-red-400">
              {formatRupiah(rekap?.total_keluar ?? 0)}
            </p>
          </CardContent>
        </Card>

        <Card className={`border-2 ${(rekap?.saldo ?? 0) >= 0 ? "border-blue-200 bg-blue-50 dark:bg-blue-950/20" : "border-orange-200 bg-orange-50 dark:bg-orange-950/20"}`}>
          <CardHeader className="pb-2">
            <CardTitle className={`text-sm font-medium flex items-center gap-2 ${(rekap?.saldo ?? 0) >= 0 ? "text-blue-700 dark:text-blue-400" : "text-orange-700 dark:text-orange-400"}`}>
              <Wallet className="h-4 w-4" /> Saldo
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className={`text-2xl font-bold ${(rekap?.saldo ?? 0) >= 0 ? "text-blue-700 dark:text-blue-400" : "text-orange-700 dark:text-orange-400"}`}>
              {formatRupiah(rekap?.saldo ?? 0)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filter */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-wrap gap-3">
            <Select value={filterBulan} onValueChange={setFilterBulan}>
              <SelectTrigger className="w-36">
                <SelectValue placeholder="Bulan" />
              </SelectTrigger>
              <SelectContent>
                {BULAN_NAMES.map((nama, i) => (
                  <SelectItem key={i + 1} value={String(i + 1)}>{nama}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filterTahun} onValueChange={setFilterTahun}>
              <SelectTrigger className="w-28">
                <SelectValue placeholder="Tahun" />
              </SelectTrigger>
              <SelectContent>
                {tahunOptions.map(t => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filterTipe} onValueChange={setFilterTipe}>
              <SelectTrigger className="w-36">
                <SelectValue placeholder="Semua Tipe" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="semua">Semua Tipe</SelectItem>
                <SelectItem value="masuk">Uang Masuk</SelectItem>
                <SelectItem value="keluar">Uang Keluar</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Tabel */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : items.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Wallet className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p>Belum ada transaksi untuk periode ini</p>
              <Button variant="outline" size="sm" className="mt-3" onClick={openCreate}>
                Tambah Transaksi
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tanggal</TableHead>
                  <TableHead>Tipe</TableHead>
                  <TableHead>Kategori</TableHead>
                  <TableHead>Keterangan</TableHead>
                  <TableHead className="text-right">Jumlah</TableHead>
                  <TableHead className="text-center w-24">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="text-sm">{formatDate(item.tanggal)}</TableCell>
                    <TableCell>
                      <Badge variant={item.tipe === "masuk" ? "default" : "destructive"}
                        className={item.tipe === "masuk" ? "bg-green-100 text-green-800 hover:bg-green-100 dark:bg-green-900 dark:text-green-200" : ""}>
                        {item.tipe === "masuk" ? "Masuk" : "Keluar"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{item.kategori ?? "-"}</TableCell>
                    <TableCell className="text-sm">{item.keterangan}</TableCell>
                    <TableCell className={`text-right font-medium ${item.tipe === "masuk" ? "text-green-700 dark:text-green-400" : "text-red-700 dark:text-red-400"}`}>
                      {item.tipe === "keluar" ? "-" : "+"}{formatRupiah(item.jumlah)}
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-center gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(item)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setDeleteId(item.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Dialog Form */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editData ? "Edit Transaksi" : "Tambah Transaksi"}</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit((v) => saveMutation.mutate(v))} className="space-y-4">
              <FormField control={form.control} name="tanggal" render={({ field }) => (
                <FormItem>
                  <FormLabel>Tanggal</FormLabel>
                  <FormControl><Input type="date" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="tipe" render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipe Transaksi</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Pilih tipe" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="masuk">Uang Masuk</SelectItem>
                      <SelectItem value="keluar">Uang Keluar</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="kategori" render={({ field }) => (
                <FormItem>
                  <FormLabel>Kategori <span className="text-muted-foreground text-xs">(opsional)</span></FormLabel>
                  <Select onValueChange={field.onChange} value={field.value ?? ""}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Pilih kategori" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {(watchTipe === "masuk" ? KATEGORI_MASUK : KATEGORI_KELUAR).map(k => (
                        <SelectItem key={k} value={k}>{k}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="keterangan" render={({ field }) => (
                <FormItem>
                  <FormLabel>Keterangan</FormLabel>
                  <FormControl><Textarea placeholder="Contoh: Penjualan nasi goreng" {...field} rows={2} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="jumlah" render={({ field }) => (
                <FormItem>
                  <FormLabel>Jumlah (Rp)</FormLabel>
                  <FormControl><Input type="number" min={1} placeholder="50000" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Batal</Button>
                <Button type="submit" disabled={saveMutation.isPending}>
                  {saveMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Simpan
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Konfirmasi Hapus */}
      <AlertDialog open={deleteId !== null} onOpenChange={(open) => { if (!open) setDeleteId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Transaksi?</AlertDialogTitle>
            <AlertDialogDescription>Data transaksi ini akan dihapus permanen dan tidak dapat dikembalikan.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={() => deleteId !== null && deleteMutation.mutate(deleteId)}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
