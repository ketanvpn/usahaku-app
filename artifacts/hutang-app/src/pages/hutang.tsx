import { useState } from "react";
import { Link } from "wouter";
import {
  useGetHutangList, useCreateHutang, useUpdateHutang, useDeleteHutang, useGetPelangganList,
  getGetHutangListQueryKey, getGetPembayaranListQueryKey, getGetOwnerDashboardQueryKey, Hutang, GetHutangListStatus
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CurrencyInput } from "@/components/ui/currency-input";
import { CurrencyQuickAdd } from "@/components/ui/currency-quick-add";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PelangganCombobox } from "@/components/pelanggan-combobox";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { formatRupiah, formatDate, getErrorMessage } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { TableSkeleton } from "@/components/ui/table-skeleton";
import { Loader2, Plus, Edit, Trash2, Eye, Filter, Search, FileText, CalendarClock } from "lucide-react";
import { useLicense } from "@/context/license-context";

const hutangSchema = z.object({
  pelanggan_id: z.coerce.number().min(1, { message: "Pilih pelanggan" }),
  tanggal_hutang: z.string().min(1, { message: "Tanggal wajib diisi" }),
  tanggal_jatuh_tempo: z.string().optional().nullable(),
  keterangan: z.string().optional(),
  nominal_hutang: z.coerce.number().min(1, { message: "Nominal harus lebih dari 0" }),
});

const updateHutangSchema = z.object({
  tanggal_hutang: z.string().min(1, { message: "Tanggal wajib diisi" }),
  tanggal_jatuh_tempo: z.string().optional().nullable(),
  keterangan: z.string().optional(),
  nominal_hutang: z.coerce.number().min(1, { message: "Nominal harus lebih dari 0" }),
});

function getJatuhTempoBadge(tanggalJatuhTempo: string | null | undefined, status: string) {
  if (!tanggalJatuhTempo || status === "lunas") return null;
  const today = new Date().toISOString().split("T")[0];
  const sevenDaysLater = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
  if (today > tanggalJatuhTempo) {
    return (
      <Badge className="flex w-fit items-center gap-1 rounded-full border-red-200 bg-red-100 px-1.5 py-0.5 text-[10px] text-red-800">
        <CalendarClock className="h-3 w-3" /> Terlambat
      </Badge>
    );
  }
  if (tanggalJatuhTempo <= sevenDaysLater) {
    return (
      <Badge className="flex w-fit items-center gap-1 rounded-full border-yellow-200 bg-yellow-100 px-1.5 py-0.5 text-[10px] text-yellow-800">
        <CalendarClock className="h-3 w-3" /> Segera jatuh tempo
      </Badge>
    );
  }
  return null;
}

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
  const { lisensiAktif } = useLicense();

  const form = useForm<z.infer<typeof hutangSchema>>({
    resolver: zodResolver(hutangSchema),
    defaultValues: { pelanggan_id: 0, tanggal_hutang: new Date().toISOString().split("T")[0], tanggal_jatuh_tempo: "", keterangan: "", nominal_hutang: 0 },
  });

  const updateForm = useForm<z.infer<typeof updateHutangSchema>>({
    resolver: zodResolver(updateHutangSchema),
    defaultValues: { tanggal_hutang: "", tanggal_jatuh_tempo: "", keterangan: "", nominal_hutang: 0 },
  });

  const handleOpenDialog = (hutang?: Hutang) => {
    if (hutang) {
      setEditingHutang(hutang);
      updateForm.reset({
        tanggal_hutang: hutang.tanggal_hutang.split("T")[0],
        tanggal_jatuh_tempo: hutang.tanggal_jatuh_tempo ?? "",
        keterangan: hutang.keterangan || "",
        nominal_hutang: hutang.nominal_hutang,
      });
    } else {
      setEditingHutang(null);
      form.reset({
        pelanggan_id: undefined,
        tanggal_hutang: new Date().toISOString().split("T")[0],
        tanggal_jatuh_tempo: "",
        keterangan: "",
        nominal_hutang: 0
      });
    }
    setIsDialogOpen(true);
  };

  const onCreateSubmit = (values: z.infer<typeof hutangSchema>) => {
    createMutation.mutate(
      { data: { ...values, tanggal_jatuh_tempo: values.tanggal_jatuh_tempo || null } },
      {
        onSuccess: () => {
          toast({ title: "Hutang berhasil dicatat" });
          queryClient.invalidateQueries({ queryKey: getGetHutangListQueryKey() });
          setIsDialogOpen(false);
        },
        onError: (err: unknown) => toast({ variant: "destructive", title: "Gagal", description: getErrorMessage(err) })
      }
    );
  };

  const onUpdateSubmit = (values: z.infer<typeof updateHutangSchema>) => {
    if (!editingHutang) return;
    updateMutation.mutate(
      { id: editingHutang.id, data: { ...values, tanggal_jatuh_tempo: values.tanggal_jatuh_tempo || null } },
      {
        onSuccess: () => {
          toast({ title: "Hutang berhasil diperbarui" });
          queryClient.invalidateQueries({ queryKey: getGetHutangListQueryKey() });
          setIsDialogOpen(false);
        },
        onError: (err: unknown) => toast({ variant: "destructive", title: "Gagal", description: getErrorMessage(err) })
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
          queryClient.invalidateQueries({ queryKey: getGetOwnerDashboardQueryKey() });
          queryClient.invalidateQueries({ queryKey: ["keuangan"] });
          queryClient.invalidateQueries({ queryKey: ["keuangan-rekap"] });
          setIsDeleteDialogOpen(false);
        },
        onError: (err: unknown) => toast({ variant: "destructive", title: "Gagal", description: getErrorMessage(err) })
      }
    );
  };

  return (
    <div className="space-y-6">
      <div className="page-hero flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h2 className="page-hero-title">Data Hutang</h2>
          <p className="page-hero-description">Catat, pantau jatuh tempo, dan kelola sisa hutang pelanggan dengan lebih rapi.</p>
        </div>
        <Button onClick={() => handleOpenDialog()} disabled={!lisensiAktif} className="shadow-lg shadow-primary/15">
          <Plus className="mr-2 h-4 w-4" />
          Catat Hutang Baru
        </Button>
      </div>

      <div className="toolbar-card flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Cari nama pelanggan atau keterangan..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-11 w-full rounded-xl bg-white/80 pl-9"
          />
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
            <Filter className="h-4 w-4" /> Filter
          </div>
          <Select
            value={filterStatus || "semua"}
            onValueChange={(v) => setFilterStatus(v === "semua" ? undefined : v as GetHutangListStatus)}
          >
            <SelectTrigger className="h-11 w-[180px] rounded-xl bg-white/80">
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
            <SelectTrigger className="h-11 w-[210px] rounded-xl bg-white/80">
              <SelectValue placeholder="Semua Pelanggan" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="semua">Semua Pelanggan</SelectItem>
              {pelangganList?.map(p => (
                <SelectItem key={p.id} value={p.id.toString()}>{p.nama}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent aria-describedby={undefined} className="rounded-2xl border bg-card/95 shadow-2xl sm:max-w-lg">
          <DialogHeader className="space-y-1">
            <DialogTitle className="text-xl font-extrabold tracking-tight">{editingHutang ? "Edit Hutang" : "Catat Hutang Baru"}</DialogTitle>
          </DialogHeader>

          {editingHutang ? (
            <Form {...updateForm}>
              <form onSubmit={updateForm.handleSubmit(onUpdateSubmit)} className="space-y-4">
                <div className="mb-4 rounded-2xl border bg-muted/55 p-3 text-sm">
                  Pelanggan: <span className="font-semibold">{editingHutang.pelanggan_nama}</span>
                </div>
                <FormField control={updateForm.control} name="tanggal_hutang" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tanggal Hutang</FormLabel>
                    <FormControl><Input type="date" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={updateForm.control} name="tanggal_jatuh_tempo" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Jatuh Tempo <span className="text-muted-foreground font-normal">(Opsional, untuk pengingat)</span></FormLabel>
                    <FormControl>
                      <Input type="date" {...field} value={field.value ?? ""} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={updateForm.control} name="nominal_hutang" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nominal Hutang (Rp)</FormLabel>
                    <FormControl>
                      <CurrencyInput
                        minValue={1}
                        value={field.value}
                        onValueChange={field.onChange}
                        placeholder="0"
                      />
                    </FormControl>
                    <CurrencyQuickAdd onAdd={(nominal) => field.onChange((Number(field.value) || 0) + nominal)} />
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
                <Button type="submit" className="w-full shadow-lg shadow-primary/15" disabled={updateMutation.isPending}>
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
                    <FormControl>
                      <PelangganCombobox
                        value={field.value || null}
                        onValueChange={(id) => field.onChange(id ?? 0)}
                        pelangganList={pelangganList}
                        placeholder="Cari atau pilih pelanggan..."
                      />
                    </FormControl>
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
                <FormField control={form.control} name="tanggal_jatuh_tempo" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Jatuh Tempo <span className="text-muted-foreground font-normal">(Opsional)</span></FormLabel>
                    <FormControl>
                      <Input type="date" {...field} value={field.value ?? ""} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="nominal_hutang" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nominal Hutang (Rp)</FormLabel>
                    <FormControl>
                      <CurrencyInput
                        minValue={1}
                        value={field.value}
                        onValueChange={field.onChange}
                        placeholder="0"
                      />
                    </FormControl>
                    <CurrencyQuickAdd onAdd={(nominal) => field.onChange((Number(field.value) || 0) + nominal)} />
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
                <Button type="submit" className="w-full shadow-lg shadow-primary/15" disabled={createMutation.isPending}>
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
            <AlertDialogTitle>Hapus Catatan Hutang?</AlertDialogTitle>
            <AlertDialogDescription>
              Catatan hutang ini beserta semua riwayat pembayarannya akan dihapus. Data tidak dapat dikembalikan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              {deleteMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
              Hapus Catatan
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Card className="data-card">
        <CardContent className="p-0">
          <Table className="table-premium">
            <TableHeader>
              <TableRow>
                <TableHead>Tanggal</TableHead>
                <TableHead>Pelanggan</TableHead>
                <TableHead>Keterangan</TableHead>
                <TableHead>Jatuh Tempo</TableHead>
                <TableHead className="text-right">Nominal</TableHead>
                <TableHead className="text-right">Sisa Hutang</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            {isLoading ? (
              <TableSkeleton cols={8} />
            ) : (() => {
              const filtered = (hutangList ?? []).filter(h =>
                h.pelanggan_nama.toLowerCase().includes(search.toLowerCase()) ||
                (h.keterangan ?? "").toLowerCase().includes(search.toLowerCase())
              );
              return filtered.length === 0 ? (
                <TableBody>
                  <TableRow>
                    <TableCell colSpan={8}>
                      <div className="empty-state">
                        <FileText className="h-10 w-10 opacity-25" />
                        <p className="text-sm font-semibold">
                          {search ? `Tidak ditemukan hasil untuk "${search}"` : "Belum ada data hutang."}
                        </p>
                        {!search && (
                          <Button variant="outline" size="sm" className="mt-1 rounded-xl" onClick={() => handleOpenDialog()} disabled={!lisensiAktif}>
                            <Plus className="h-3 w-3 mr-1" /> Catat Hutang Pertama
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                </TableBody>
              ) : (
                <TableBody>
                  {filtered.map((h) => {
                    const jatuhTempoBadge = getJatuhTempoBadge(h.tanggal_jatuh_tempo, h.status);
                    return (
                      <TableRow key={h.id}>
                        <TableCell className="whitespace-nowrap text-muted-foreground">{formatDate(h.tanggal_hutang)}</TableCell>
                        <TableCell className="font-semibold">
                          <Link href={`/pelanggan/${h.pelanggan_id}`} className="hover:underline text-primary">
                            {h.pelanggan_nama}
                          </Link>
                        </TableCell>
                        <TableCell className="truncate max-w-[220px] text-muted-foreground">{h.keterangan || "-"}</TableCell>
                        <TableCell>
                          {h.tanggal_jatuh_tempo ? (
                            <div className="flex flex-col gap-1">
                              <span className="text-xs whitespace-nowrap text-muted-foreground">{formatDate(h.tanggal_jatuh_tempo)}</span>
                              {jatuhTempoBadge}
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-xs">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">{formatRupiah(h.nominal_hutang)}</TableCell>
                        <TableCell className="text-right font-bold text-orange-600">{formatRupiah(h.sisa_hutang)}</TableCell>
                        <TableCell>
                          <Badge variant={h.status === "lunas" ? "outline" : "default"}
                                className={h.status === "aktif" ? "rounded-full bg-amber-100 text-amber-800 border-amber-200" : "rounded-full bg-emerald-100 text-emerald-800 border-emerald-200"}>
                            {h.status === "aktif" ? "Belum lunas" : "Lunas"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Link href={`/hutang/${h.id}`}>
                              <Button variant="ghost" size="icon" className="action-icon-btn" title="Detail">
                                <Eye className="h-4 w-4" />
                              </Button>
                            </Link>
                            <Button variant="ghost" size="icon" className="action-icon-btn" onClick={() => handleOpenDialog(h)} title="Edit" disabled={!lisensiAktif}>
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => { setSelectedHutang(h); setIsDeleteDialogOpen(true); }} title="Hapus" className="action-icon-btn text-destructive hover:bg-destructive/10 hover:text-destructive" disabled={!lisensiAktif}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              );
            })()}
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
