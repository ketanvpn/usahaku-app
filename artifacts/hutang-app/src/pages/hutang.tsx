import { useState } from "react";
import { Link } from "wouter";
import { 
  useGetHutangList, useCreateHutang, useUpdateHutang, useDeleteHutang, useGetPelangganList,
  getGetHutangListQueryKey, getGetPembayaranListQueryKey, Hutang, GetHutangListStatus 
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { formatRupiah, formatDate } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { TableSkeleton } from "@/components/ui/table-skeleton";
import { Loader2, Plus, Edit, Trash2, Eye, Filter, Search, FileText } from "lucide-react";

const hutangSchema = z.object({
  pelanggan_id: z.coerce.number().min(1, { message: "Pilih pelanggan" }),
  tanggal_hutang: z.string().min(1, { message: "Tanggal wajib diisi" }),
  keterangan: z.string().optional(),
  nominal_hutang: z.coerce.number().min(1, { message: "Nominal harus lebih dari 0" }),
});

const updateHutangSchema = z.object({
  tanggal_hutang: z.string().min(1, { message: "Tanggal wajib diisi" }),
  keterangan: z.string().optional(),
  nominal_hutang: z.coerce.number().min(1, { message: "Nominal harus lebih dari 0" }),
});

export default function HutangPage() {
  const [filterStatus, setFilterStatus] = useState<GetHutangListStatus | undefined>(undefined);
  const [filterPelanggan, setFilterPelanggan] = useState<number | undefined>(undefined);
  const [search, setSearch] = useState("");

  const { data: hutangList, isLoading } = useGetHutangList({
    status: filterStatus,
    pelanggan_id: filterPelanggan
  });
  
  const { data: pelangganList } = useGetPelangganList();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [editingHutang, setEditingHutang] = useState<Hutang | null>(null);
  const [selectedHutang, setSelectedHutang] = useState<Hutang | null>(null);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const createMutation = useCreateHutang();
  const updateMutation = useUpdateHutang();
  const deleteMutation = useDeleteHutang();

  const form = useForm<z.infer<typeof hutangSchema>>({
    resolver: zodResolver(hutangSchema),
    defaultValues: { pelanggan_id: 0, tanggal_hutang: new Date().toISOString().split('T')[0], keterangan: "", nominal_hutang: 0 },
  });

  const updateForm = useForm<z.infer<typeof updateHutangSchema>>({
    resolver: zodResolver(updateHutangSchema),
    defaultValues: { tanggal_hutang: "", keterangan: "", nominal_hutang: 0 },
  });

  const handleOpenDialog = (hutang?: Hutang) => {
    if (hutang) {
      setEditingHutang(hutang);
      updateForm.reset({
        tanggal_hutang: hutang.tanggal_hutang.split('T')[0],
        keterangan: hutang.keterangan || "",
        nominal_hutang: hutang.nominal_hutang,
      });
    } else {
      setEditingHutang(null);
      form.reset({ 
        pelanggan_id: undefined, 
        tanggal_hutang: new Date().toISOString().split('T')[0], 
        keterangan: "", 
        nominal_hutang: 0 
      });
    }
    setIsDialogOpen(true);
  };

  const onCreateSubmit = (values: z.infer<typeof hutangSchema>) => {
    createMutation.mutate(
      { data: values },
      {
        onSuccess: () => {
          toast({ title: "Hutang berhasil dicatat" });
          queryClient.invalidateQueries({ queryKey: getGetHutangListQueryKey() });
          setIsDialogOpen(false);
        },
        onError: (err: any) => toast({ variant: "destructive", title: "Gagal", description: err?.data?.error || err?.message || "Terjadi kesalahan" })
      }
    );
  };

  const onUpdateSubmit = (values: z.infer<typeof updateHutangSchema>) => {
    if (!editingHutang) return;
    updateMutation.mutate(
      { id: editingHutang.id, data: values },
      {
        onSuccess: () => {
          toast({ title: "Hutang berhasil diperbarui" });
          queryClient.invalidateQueries({ queryKey: getGetHutangListQueryKey() });
          setIsDialogOpen(false);
        },
        onError: (err: any) => toast({ variant: "destructive", title: "Gagal", description: err?.data?.error || err?.message || "Terjadi kesalahan" })
      }
    );
  };

  const handleDelete = () => {
    if (!selectedHutang) return;
    deleteMutation.mutate(
      { id: selectedHutang.id },
      {
        onSuccess: () => {
          toast({ title: "Hutang berhasil dihapus" });
          queryClient.invalidateQueries({ queryKey: getGetHutangListQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetPembayaranListQueryKey() });
          setIsDeleteDialogOpen(false);
        },
        onError: (err: any) => toast({ variant: "destructive", title: "Gagal", description: err?.data?.error || err?.message || "Terjadi kesalahan" })
      }
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-primary">Data Hutang</h2>
          <p className="text-muted-foreground">Catat dan pantau hutang pelanggan.</p>
        </div>
        <Button onClick={() => handleOpenDialog()}>
          <Plus className="mr-2 h-4 w-4" />
          Catat Hutang Baru
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Cari nama pelanggan atau keterangan..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2 text-sm border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      <Card className="bg-muted/30">
        <CardContent className="p-4 flex flex-wrap gap-4 items-center">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Filter className="h-4 w-4" /> Filter:
          </div>
          <Select 
            value={filterStatus || "semua"} 
            onValueChange={(v) => setFilterStatus(v === "semua" ? undefined : v as GetHutangListStatus)}
          >
            <SelectTrigger className="w-[180px] bg-background">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="semua">Semua Status</SelectItem>
              <SelectItem value="aktif">Hanya Aktif</SelectItem>
              <SelectItem value="lunas">Hanya Lunas</SelectItem>
            </SelectContent>
          </Select>

          <Select 
            value={filterPelanggan?.toString() || "semua"} 
            onValueChange={(v) => setFilterPelanggan(v === "semua" ? undefined : parseInt(v))}
          >
            <SelectTrigger className="w-[200px] bg-background">
              <SelectValue placeholder="Semua Pelanggan" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="semua">Semua Pelanggan</SelectItem>
              {pelangganList?.map(p => (
                <SelectItem key={p.id} value={p.id.toString()}>{p.nama}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingHutang ? "Edit Hutang" : "Catat Hutang Baru"}</DialogTitle>
          </DialogHeader>
          
          {editingHutang ? (
            <Form {...updateForm}>
              <form onSubmit={updateForm.handleSubmit(onUpdateSubmit)} className="space-y-4">
                <div className="p-3 bg-muted rounded-md text-sm mb-4">
                  Pelanggan: <span className="font-semibold">{editingHutang.pelanggan_nama}</span>
                </div>
                <FormField control={updateForm.control} name="tanggal_hutang" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tanggal Hutang</FormLabel>
                    <FormControl><Input type="date" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={updateForm.control} name="nominal_hutang" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nominal Hutang (Rp)</FormLabel>
                    <FormControl><Input type="number" min="0" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={updateForm.control} name="keterangan" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Keterangan (Opsional)</FormLabel>
                    <FormControl><Textarea placeholder="Contoh: Ambil barang dulu" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <Button type="submit" className="w-full" disabled={updateMutation.isPending}>
                  {updateMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Simpan Perubahan
                </Button>
              </form>
            </Form>
          ) : (
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onCreateSubmit)} className="space-y-4">
                <FormField control={form.control} name="pelanggan_id" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Pelanggan</FormLabel>
                    <Select onValueChange={(v) => field.onChange(parseInt(v))} value={field.value?.toString()}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Pilih pelanggan..." /></SelectTrigger></FormControl>
                      <SelectContent>
                        {pelangganList?.map(p => (
                          <SelectItem key={p.id} value={p.id.toString()}>{p.nama}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="tanggal_hutang" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tanggal Hutang</FormLabel>
                    <FormControl><Input type="date" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="nominal_hutang" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nominal Hutang (Rp)</FormLabel>
                    <FormControl><Input type="number" min="0" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="keterangan" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Keterangan (Opsional)</FormLabel>
                    <FormControl><Textarea placeholder="Contoh: Ambil barang dulu" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <Button type="submit" className="w-full" disabled={createMutation.isPending}>
                  {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Simpan Hutang
                </Button>
              </form>
            </Form>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Hutang?</AlertDialogTitle>
            <AlertDialogDescription>
              Tindakan ini juga akan menghapus semua riwayat pembayaran untuk hutang ini. Data tidak dapat dikembalikan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              {deleteMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tanggal</TableHead>
                <TableHead>Pelanggan</TableHead>
                <TableHead>Keterangan</TableHead>
                <TableHead className="text-right">Nominal</TableHead>
                <TableHead className="text-right">Sisa Hutang</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            {isLoading ? (
              <TableSkeleton cols={7} />
            ) : (() => {
              const filtered = (hutangList ?? []).filter(h =>
                h.pelanggan_nama.toLowerCase().includes(search.toLowerCase()) ||
                (h.keterangan ?? "").toLowerCase().includes(search.toLowerCase())
              );
              return filtered.length === 0 ? (
                <TableBody>
                  <TableRow>
                    <TableCell colSpan={7} className="py-16">
                      <div className="flex flex-col items-center gap-2 text-muted-foreground">
                        <FileText className="h-10 w-10 opacity-25" />
                        <p className="text-sm font-medium">
                          {search ? `Tidak ditemukan hasil untuk "${search}"` : "Belum ada data hutang."}
                        </p>
                        {!search && (
                          <Button variant="outline" size="sm" className="mt-1" onClick={() => handleOpenDialog()}>
                            <Plus className="h-3 w-3 mr-1" /> Catat Hutang Pertama
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                </TableBody>
              ) : (
                <TableBody>
                  {filtered.map((h) => (
                    <TableRow key={h.id}>
                      <TableCell className="whitespace-nowrap">{formatDate(h.tanggal_hutang)}</TableCell>
                      <TableCell className="font-medium">
                        <Link href={`/pelanggan/${h.pelanggan_id}`} className="hover:underline text-primary">
                          {h.pelanggan_nama}
                        </Link>
                      </TableCell>
                      <TableCell className="truncate max-w-[200px] text-muted-foreground">{h.keterangan || "-"}</TableCell>
                      <TableCell className="text-right">{formatRupiah(h.nominal_hutang)}</TableCell>
                      <TableCell className="text-right font-semibold text-orange-600">{formatRupiah(h.sisa_hutang)}</TableCell>
                      <TableCell>
                        <Badge variant={h.status === "lunas" ? "outline" : "default"} 
                              className={h.status === "aktif" ? "bg-amber-100 text-amber-800 border-amber-200" : "bg-emerald-100 text-emerald-800 border-emerald-200"}>
                          {h.status === "aktif" ? "Aktif" : "Lunas"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Link href={`/hutang/${h.id}`}>
                            <Button variant="ghost" size="icon" title="Detail">
                              <Eye className="h-4 w-4" />
                            </Button>
                          </Link>
                          <Button variant="ghost" size="icon" onClick={() => handleOpenDialog(h)} title="Edit">
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => { setSelectedHutang(h); setIsDeleteDialogOpen(true); }} title="Hapus" className="text-destructive">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              );
            })()}
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
