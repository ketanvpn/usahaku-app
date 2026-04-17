import { useState, useMemo } from "react";
import {
  useGetPekerjaList, useCreatePekerja, useUpdatePekerja, useDeletePekerja,
  useGetUpahList, useCreateUpah, useUpdateUpah, useDeleteUpah,
  useGetUpah, useBayarUpah, useDeleteBayarUpah, useBayarBatchUpah,
  getGetPekerjaListQueryKey, getGetUpahListQueryKey, getGetUpahQueryKey,
  Pekerja, UpahPekerja, GetUpahListParams, UpahStatus,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { formatRupiah, formatDate } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { TableSkeleton } from "@/components/ui/table-skeleton";
import { Loader2, Plus, Edit, Trash2, Search, HardHat, Banknote, Users } from "lucide-react";
import { useLicense } from "@/context/license-context";

// ── Helpers ───────────────────────────────────────────────────────────────────

function toTitleCase(str: string): string {
  return str.replace(/\b\w/g, (c) => c.toUpperCase());
}

function capitalizeFirst(str: string): string {
  if (!str) return str;
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// ── Schemas ───────────────────────────────────────────────────────────────────

const pekerjaSchema = z.object({
  nama: z.string().min(1, { message: "Nama wajib diisi" }),
  telepon: z.string().optional(),
  jabatan: z.string().optional(),
  catatan: z.string().optional(),
});

const upahSchema = z.object({
  pekerja_id: z.coerce.number().min(1, { message: "Pilih pekerja" }),
  keterangan: z.string().min(1, { message: "Keterangan wajib diisi" }),
  jumlah_total: z.coerce.number().min(1, { message: "Jumlah harus lebih dari 0" }),
  tanggal_kerja: z.string().min(1, { message: "Tanggal kerja wajib diisi" }),
  catatan: z.string().optional(),
});

const bayarSchema = z.object({
  jumlah: z.coerce.number().min(1, { message: "Jumlah bayar harus lebih dari 0" }),
  tanggal_bayar: z.string().min(1, { message: "Tanggal bayar wajib diisi" }),
  catatan: z.string().optional(),
});

const batchSchema = z.object({
  jumlah_total: z.coerce.number().min(1, { message: "Jumlah harus lebih dari 0" }),
  tanggal_bayar: z.string().min(1, { message: "Tanggal bayar wajib diisi" }),
  catatan: z.string().optional(),
});

type PekerjaForm = z.infer<typeof pekerjaSchema>;
type UpahForm = z.infer<typeof upahSchema>;
type BayarForm = z.infer<typeof bayarSchema>;
type BatchForm = z.infer<typeof batchSchema>;

function StatusBadge({ status }: { status: string }) {
  if (status === "lunas") {
    return <Badge className="bg-green-100 text-green-800 border-green-200 text-xs">Lunas</Badge>;
  }
  return <Badge className="bg-red-100 text-red-800 border-red-200 text-xs">Belum Lunas</Badge>;
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function GajiTenagaPage() {
  const { lisensiAktif } = useLicense();
  const { toast } = useToast();
  const qc = useQueryClient();

  // ── Upah state ──────────────────────────────────────────────────────────────
  const [filterStatus, setFilterStatus] = useState<UpahStatus | undefined>(undefined);
  const [filterPekerja, setFilterPekerja] = useState<number | undefined>(undefined);
  const [searchUpah, setSearchUpah] = useState("");
  const [isUpahDialogOpen, setIsUpahDialogOpen] = useState(false);
  const [isDeleteUpahOpen, setIsDeleteUpahOpen] = useState(false);
  const [editingUpah, setEditingUpah] = useState<UpahPekerja | null>(null);
  const [selectedUpahId, setSelectedUpahId] = useState<number | null>(null);
  const [isBayarDialogOpen, setIsBayarDialogOpen] = useState(false);
  const [deletingUpahId, setDeletingUpahId] = useState<number | null>(null);

  // ── Pekerja state ───────────────────────────────────────────────────────────
  const [searchPekerja, setSearchPekerja] = useState("");
  const [isPekerjaDialogOpen, setIsPekerjaDialogOpen] = useState(false);
  const [isDeletePekerjaOpen, setIsDeletePekerjaOpen] = useState(false);
  const [editingPekerja, setEditingPekerja] = useState<Pekerja | null>(null);
  const [deletingPekerjaId, setDeletingPekerjaId] = useState<number | null>(null);
  const [deletingBayarId, setDeletingBayarId] = useState<number | null>(null);

  // ── Batch state ─────────────────────────────────────────────────────────────
  const [batchPekerja, setBatchPekerja] = useState<Pekerja | null>(null);
  const [isBatchDialogOpen, setIsBatchDialogOpen] = useState(false);

  // ── Queries ─────────────────────────────────────────────────────────────────
  const params: GetUpahListParams = {};
  if (filterStatus) params.status = filterStatus;
  if (filterPekerja) params.pekerja_id = filterPekerja;

  const { data: upahList, isLoading: loadingUpah } = useGetUpahList(params);
  const { data: allUpahList } = useGetUpahList({});
  const { data: pekerjaList, isLoading: loadingPekerja } = useGetPekerjaList();
  const { data: upahDetail, isLoading: loadingDetail } = useGetUpah(selectedUpahId ?? 0, {
    query: { enabled: !!selectedUpahId },
  });

  // ── Mutations ────────────────────────────────────────────────────────────────
  const invalidateUpah = () => {
    qc.invalidateQueries({ queryKey: getGetUpahListQueryKey() });
    if (selectedUpahId) qc.invalidateQueries({ queryKey: getGetUpahQueryKey(selectedUpahId) });
  };
  const invalidatePekerja = () => {
    qc.invalidateQueries({ queryKey: getGetPekerjaListQueryKey() });
  };

  const createUpah = useCreateUpah({
    mutation: {
      onSuccess: () => { invalidateUpah(); toast({ title: "Catatan upah berhasil ditambah" }); setIsUpahDialogOpen(false); },
      onError: (e: unknown) => toast({ title: "Gagal", description: (e as Error)?.message, variant: "destructive" }),
    },
  });
  const updateUpah = useUpdateUpah({
    mutation: {
      onSuccess: () => { invalidateUpah(); toast({ title: "Catatan upah berhasil diperbarui" }); setIsUpahDialogOpen(false); setEditingUpah(null); },
      onError: (e: unknown) => toast({ title: "Gagal", description: (e as Error)?.message, variant: "destructive" }),
    },
  });
  const deleteUpah = useDeleteUpah({
    mutation: {
      onSuccess: () => { invalidateUpah(); toast({ title: "Catatan upah berhasil dihapus" }); setIsDeleteUpahOpen(false); setDeletingUpahId(null); },
      onError: (e: unknown) => toast({ title: "Gagal", description: (e as Error)?.message, variant: "destructive" }),
    },
  });
  const bayarUpah = useBayarUpah({
    mutation: {
      onSuccess: () => { invalidateUpah(); toast({ title: "Pembayaran berhasil dicatat" }); bayarForm.reset(); },
      onError: (e: unknown) => toast({ title: "Gagal", description: (e as Error)?.message, variant: "destructive" }),
    },
  });
  const deleteBayar = useDeleteBayarUpah({
    mutation: {
      onSuccess: () => { invalidateUpah(); toast({ title: "Pembayaran berhasil dihapus" }); setDeletingBayarId(null); },
      onError: (e: unknown) => toast({ title: "Gagal", description: (e as Error)?.message, variant: "destructive" }),
    },
  });

  const bayarBatch = useBayarBatchUpah({
    mutation: {
      onSuccess: (data) => {
        invalidateUpah();
        qc.invalidateQueries({ queryKey: getGetUpahListQueryKey({}) });
        toast({ title: "Pembayaran batch berhasil", description: data.message });
        setIsBatchDialogOpen(false);
        setBatchPekerja(null);
      },
      onError: (e: unknown) => toast({ title: "Gagal", description: (e as Error)?.message, variant: "destructive" }),
    },
  });

  const createPekerja = useCreatePekerja({
    mutation: {
      onSuccess: () => { invalidatePekerja(); toast({ title: "Pekerja berhasil ditambah" }); setIsPekerjaDialogOpen(false); },
      onError: (e: unknown) => toast({ title: "Gagal", description: (e as Error)?.message, variant: "destructive" }),
    },
  });
  const updatePekerja = useUpdatePekerja({
    mutation: {
      onSuccess: () => { invalidatePekerja(); toast({ title: "Pekerja berhasil diperbarui" }); setIsPekerjaDialogOpen(false); setEditingPekerja(null); },
      onError: (e: unknown) => toast({ title: "Gagal", description: (e as Error)?.message, variant: "destructive" }),
    },
  });
  const deletePekerja = useDeletePekerja({
    mutation: {
      onSuccess: () => { invalidatePekerja(); invalidateUpah(); toast({ title: "Pekerja berhasil dihapus" }); setIsDeletePekerjaOpen(false); setDeletingPekerjaId(null); },
      onError: (e: unknown) => toast({ title: "Gagal", description: (e as Error)?.message, variant: "destructive" }),
    },
  });

  // ── Computed: sisa upah per pekerja & batch list ────────────────────────────
  const sisaPerPekerja = useMemo(() => {
    const map = new Map<number, number>();
    (allUpahList ?? []).filter(u => u.status === "belum_lunas").forEach(u => {
      map.set(u.pekerja_id, (map.get(u.pekerja_id) ?? 0) + u.sisa_upah);
    });
    return map;
  }, [allUpahList]);

  const batchUpahList = useMemo(() => {
    if (!batchPekerja) return [];
    return (allUpahList ?? [])
      .filter(u => u.pekerja_id === batchPekerja.id && u.status === "belum_lunas")
      .slice()
      .sort((a, b) => a.tanggal_kerja.localeCompare(b.tanggal_kerja) || a.id - b.id);
  }, [allUpahList, batchPekerja]);

  const totalSisaBatch = batchUpahList.reduce((acc, u) => acc + u.sisa_upah, 0);

  // ── Forms ────────────────────────────────────────────────────────────────────
  const today = new Date().toISOString().split("T")[0];

  const upahForm = useForm<UpahForm>({
    resolver: zodResolver(upahSchema),
    defaultValues: { pekerja_id: 0, keterangan: "", jumlah_total: 0, tanggal_kerja: today, catatan: "" },
  });

  const pekerjaForm = useForm<PekerjaForm>({
    resolver: zodResolver(pekerjaSchema),
    defaultValues: { nama: "", telepon: "", jabatan: "", catatan: "" },
  });

  const bayarForm = useForm<BayarForm>({
    resolver: zodResolver(bayarSchema),
    defaultValues: { jumlah: 0, tanggal_bayar: today, catatan: "" },
  });

  const batchForm = useForm<BatchForm>({
    resolver: zodResolver(batchSchema),
    defaultValues: { jumlah_total: 0, tanggal_bayar: today, catatan: "" },
  });

  // ── Handlers ─────────────────────────────────────────────────────────────────
  const openTambahUpah = () => {
    setEditingUpah(null);
    upahForm.reset({ pekerja_id: 0, keterangan: "", jumlah_total: 0, tanggal_kerja: today, catatan: "" });
    setIsUpahDialogOpen(true);
  };

  const openEditUpah = (u: UpahPekerja) => {
    setEditingUpah(u);
    upahForm.reset({
      pekerja_id: u.pekerja_id,
      keterangan: u.keterangan,
      jumlah_total: u.jumlah_total,
      tanggal_kerja: u.tanggal_kerja,
      catatan: u.catatan ?? "",
    });
    setIsUpahDialogOpen(true);
  };

  const openBayar = (u: UpahPekerja) => {
    setSelectedUpahId(u.id);
    bayarForm.reset({ jumlah: u.sisa_upah, tanggal_bayar: today, catatan: "" });
    setIsBayarDialogOpen(true);
  };

  const openBatch = (p: Pekerja) => {
    setBatchPekerja(p);
    const sisaBatch = (allUpahList ?? [])
      .filter(u => u.pekerja_id === p.id && u.status === "belum_lunas")
      .reduce((acc, u) => acc + u.sisa_upah, 0);
    batchForm.reset({ jumlah_total: sisaBatch, tanggal_bayar: today, catatan: "" });
    setIsBatchDialogOpen(true);
  };

  const submitBatch = (data: BatchForm) => {
    if (!batchPekerja) return;
    bayarBatch.mutate({ id: batchPekerja.id, data: { jumlah_total: data.jumlah_total, tanggal_bayar: data.tanggal_bayar, catatan: data.catatan || undefined } });
  };

  const submitUpah = (data: UpahForm) => {
    if (editingUpah) {
      updateUpah.mutate({ id: editingUpah.id, data: { keterangan: data.keterangan, jumlah_total: data.jumlah_total, tanggal_kerja: data.tanggal_kerja, catatan: data.catatan || null } });
    } else {
      createUpah.mutate({ data: { pekerja_id: data.pekerja_id, keterangan: data.keterangan, jumlah_total: data.jumlah_total, tanggal_kerja: data.tanggal_kerja, catatan: data.catatan || null } });
    }
  };

  const submitBayar = (data: BayarForm) => {
    if (!selectedUpahId) return;
    bayarUpah.mutate({ id: selectedUpahId, data: { upah_id: selectedUpahId, jumlah: data.jumlah, tanggal_bayar: data.tanggal_bayar, catatan: data.catatan || null } });
  };

  const openTambahPekerja = () => {
    setEditingPekerja(null);
    pekerjaForm.reset({ nama: "", telepon: "", jabatan: "", catatan: "" });
    setIsPekerjaDialogOpen(true);
  };

  const openEditPekerja = (p: Pekerja) => {
    setEditingPekerja(p);
    pekerjaForm.reset({ nama: p.nama, telepon: p.telepon ?? "", jabatan: p.jabatan ?? "", catatan: p.catatan ?? "" });
    setIsPekerjaDialogOpen(true);
  };

  const submitPekerja = (data: PekerjaForm) => {
    if (editingPekerja) {
      updatePekerja.mutate({ id: editingPekerja.id, data: { nama: data.nama, telepon: data.telepon || null, jabatan: data.jabatan || null, catatan: data.catatan || null } });
    } else {
      createPekerja.mutate({ data: { nama: data.nama, telepon: data.telepon || null, jabatan: data.jabatan || null, catatan: data.catatan || null } });
    }
  };

  // ── Filtered & sorted lists ──────────────────────────────────────────────────
  const filteredUpah = (upahList ?? [])
    .filter((u) =>
      !searchUpah ||
      u.pekerja_nama.toLowerCase().includes(searchUpah.toLowerCase()) ||
      u.keterangan.toLowerCase().includes(searchUpah.toLowerCase())
    )
    .sort((a, b) => {
      const namaSort = a.pekerja_nama.localeCompare(b.pekerja_nama, "id");
      if (namaSort !== 0) return namaSort;
      if (a.tanggal_kerja < b.tanggal_kerja) return 1;
      if (a.tanggal_kerja > b.tanggal_kerja) return -1;
      return b.id - a.id;
    });

  const filteredPekerja = (pekerjaList ?? [])
    .filter((p) =>
      !searchPekerja ||
      p.nama.toLowerCase().includes(searchPekerja.toLowerCase()) ||
      (p.jabatan ?? "").toLowerCase().includes(searchPekerja.toLowerCase())
    )
    .sort((a, b) => a.nama.localeCompare(b.nama, "id"));

  const isPending = createUpah.isPending || updateUpah.isPending;
  const isPekerjaFormPending = createPekerja.isPending || updatePekerja.isPending;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <HardHat className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Gaji & Tenaga</h1>
          <p className="text-sm text-muted-foreground">Kelola upah dan pembayaran tenaga kerja</p>
        </div>
      </div>

      <Tabs defaultValue="upah">
        <TabsList>
          <TabsTrigger value="upah" className="gap-2"><Banknote className="h-4 w-4" />Catatan Upah</TabsTrigger>
          <TabsTrigger value="pekerja" className="gap-2"><Users className="h-4 w-4" />Daftar Pekerja</TabsTrigger>
        </TabsList>

        {/* ── TAB CATATAN UPAH ─────────────────────────────────────────────────── */}
        <TabsContent value="upah" className="space-y-4 mt-4">
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Cari nama pekerja atau keterangan..." className="pl-9" value={searchUpah} onChange={(e) => setSearchUpah(e.target.value)} />
            </div>
            <Select value={filterStatus ?? "semua"} onValueChange={(v) => setFilterStatus(v === "semua" ? undefined : v as UpahStatus)}>
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue placeholder="Semua Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="semua">Semua Status</SelectItem>
                <SelectItem value="belum_lunas">Belum Lunas</SelectItem>
                <SelectItem value="lunas">Lunas</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterPekerja?.toString() ?? "semua"} onValueChange={(v) => setFilterPekerja(v === "semua" ? undefined : Number(v))}>
              <SelectTrigger className="w-full sm:w-44">
                <SelectValue placeholder="Semua Pekerja" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="semua">Semua Pekerja</SelectItem>
                {(pekerjaList ?? [])
                  .slice()
                  .sort((a, b) => a.nama.localeCompare(b.nama, "id"))
                  .map((p) => (
                    <SelectItem key={p.id} value={p.id.toString()}>{p.nama}</SelectItem>
                  ))}
              </SelectContent>
            </Select>
            <Button onClick={openTambahUpah} disabled={!lisensiAktif}>
              <Plus className="h-4 w-4 mr-1" /> Tambah Upah
            </Button>
          </div>

          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Pekerja</TableHead>
                      <TableHead>Keterangan</TableHead>
                      <TableHead className="text-right">Total Upah</TableHead>
                      <TableHead className="text-right">Sudah Dibayar</TableHead>
                      <TableHead className="text-right">Sisa</TableHead>
                      <TableHead>Tgl. Kerja</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  {loadingUpah ? (
                    <TableSkeleton cols={8} />
                  ) : filteredUpah.length === 0 ? (
                    <TableBody>
                      <TableRow>
                        <TableCell colSpan={8} className="py-12 text-center text-muted-foreground">
                          <HardHat className="h-10 w-10 mx-auto mb-3 opacity-20" />
                          <p>Belum ada catatan upah</p>
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  ) : (
                    <TableBody>
                      {filteredUpah.map((u) => (
                        <TableRow key={u.id}>
                          <TableCell>
                            <div className="font-medium">{u.pekerja_nama}</div>
                            {u.pekerja_jabatan && <div className="text-xs text-muted-foreground">{u.pekerja_jabatan}</div>}
                          </TableCell>
                          <TableCell className="max-w-[160px] truncate" title={u.keterangan}>{u.keterangan}</TableCell>
                          <TableCell className="text-right font-medium">{formatRupiah(u.jumlah_total)}</TableCell>
                          <TableCell className="text-right text-green-700">{formatRupiah(u.total_dibayar)}</TableCell>
                          <TableCell className="text-right font-semibold text-red-700">{formatRupiah(u.sisa_upah)}</TableCell>
                          <TableCell className="whitespace-nowrap">{formatDate(u.tanggal_kerja)}</TableCell>
                          <TableCell><StatusBadge status={u.status} /></TableCell>
                          <TableCell>
                            <div className="flex justify-end gap-1">
                              {u.status !== "lunas" && (
                                <Button size="sm" variant="default" className="h-7 text-xs" onClick={() => openBayar(u)} disabled={!lisensiAktif}>
                                  <Banknote className="h-3 w-3 mr-1" /> Bayar
                                </Button>
                              )}
                              <Button size="sm" variant="outline" className="h-7 w-7 p-0" onClick={() => openEditUpah(u)} disabled={!lisensiAktif}>
                                <Edit className="h-3.5 w-3.5" />
                              </Button>
                              <Button size="sm" variant="outline" className="h-7 w-7 p-0 text-destructive hover:text-destructive" onClick={() => { setDeletingUpahId(u.id); setIsDeleteUpahOpen(true); }} disabled={!lisensiAktif}>
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  )}
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── TAB DAFTAR PEKERJA ──────────────────────────────────────────────── */}
        <TabsContent value="pekerja" className="space-y-4 mt-4">
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Cari nama atau jabatan..." className="pl-9" value={searchPekerja} onChange={(e) => setSearchPekerja(e.target.value)} />
            </div>
            <Button onClick={openTambahPekerja} disabled={!lisensiAktif}>
              <Plus className="h-4 w-4 mr-1" /> Tambah Pekerja
            </Button>
          </div>

          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nama</TableHead>
                      <TableHead>Jabatan</TableHead>
                      <TableHead>Telepon</TableHead>
                      <TableHead>Catatan</TableHead>
                      <TableHead className="text-right">Sisa Upah</TableHead>
                      <TableHead className="text-right">Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  {loadingPekerja ? (
                    <TableSkeleton cols={6} />
                  ) : filteredPekerja.length === 0 ? (
                    <TableBody>
                      <TableRow>
                        <TableCell colSpan={6} className="py-12 text-center text-muted-foreground">
                          <Users className="h-10 w-10 mx-auto mb-3 opacity-20" />
                          <p>Belum ada data pekerja</p>
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  ) : (
                    <TableBody>
                      {filteredPekerja.map((p) => {
                        const sisaUpah = sisaPerPekerja.get(p.id) ?? 0;
                        return (
                          <TableRow key={p.id}>
                            <TableCell className="font-medium">{p.nama}</TableCell>
                            <TableCell className="text-muted-foreground">{p.jabatan ?? "-"}</TableCell>
                            <TableCell className="text-muted-foreground">{p.telepon ?? "-"}</TableCell>
                            <TableCell className="text-muted-foreground max-w-[180px] truncate">{p.catatan ?? "-"}</TableCell>
                            <TableCell className="text-right">
                              {sisaUpah > 0
                                ? <span className="font-semibold text-red-700">{formatRupiah(sisaUpah)}</span>
                                : <span className="text-muted-foreground text-xs">Lunas</span>
                              }
                            </TableCell>
                            <TableCell>
                              <div className="flex justify-end gap-1">
                                <Button size="sm" variant="default" className="h-7 text-xs" onClick={() => openBatch(p)} disabled={!lisensiAktif || sisaUpah === 0} title={sisaUpah === 0 ? "Semua upah sudah lunas" : "Bayar upah batch"}>
                                  <Banknote className="h-3 w-3 mr-1" /> Bayar
                                </Button>
                                <Button size="sm" variant="outline" className="h-7 w-7 p-0" onClick={() => openEditPekerja(p)} disabled={!lisensiAktif}>
                                  <Edit className="h-3.5 w-3.5" />
                                </Button>
                                <Button size="sm" variant="outline" className="h-7 w-7 p-0 text-destructive hover:text-destructive" onClick={() => { setDeletingPekerjaId(p.id); setIsDeletePekerjaOpen(true); }} disabled={!lisensiAktif}>
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  )}
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ── Dialog Tambah/Edit Upah ──────────────────────────────────────────── */}
      <Dialog open={isUpahDialogOpen} onOpenChange={(open) => { setIsUpahDialogOpen(open); if (!open) { setEditingUpah(null); upahForm.clearErrors(); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingUpah ? "Edit Catatan Upah" : "Tambah Catatan Upah"}</DialogTitle>
          </DialogHeader>
          <Form {...upahForm}>
            <form onSubmit={upahForm.handleSubmit(submitUpah)} className="space-y-4">
              {!editingUpah && (
                <FormField control={upahForm.control} name="pekerja_id" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Pekerja <span className="text-destructive">*</span></FormLabel>
                    <Select value={field.value ? field.value.toString() : ""} onValueChange={(v) => field.onChange(Number(v))}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Pilih pekerja..." />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {(pekerjaList ?? [])
                          .slice()
                          .sort((a, b) => a.nama.localeCompare(b.nama, "id"))
                          .map((p) => (
                            <SelectItem key={p.id} value={p.id.toString()}>
                              {p.nama}{p.jabatan ? ` — ${p.jabatan}` : ""}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
              )}
              <FormField control={upahForm.control} name="keterangan" render={({ field }) => (
                <FormItem>
                  <FormLabel>Keterangan Pekerjaan <span className="text-destructive">*</span></FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Contoh: Angkut gabah 3 ton"
                      autoCapitalize="sentences"
                      {...field}
                      onChange={(e) => field.onChange(capitalizeFirst(e.target.value))}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={upahForm.control} name="jumlah_total" render={({ field }) => (
                <FormItem>
                  <FormLabel>Total Upah <span className="text-destructive">*</span></FormLabel>
                  <FormControl><Input type="number" min={1} placeholder="0" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={upahForm.control} name="tanggal_kerja" render={({ field }) => (
                <FormItem>
                  <FormLabel>Tanggal Kerja <span className="text-destructive">*</span></FormLabel>
                  <FormControl><Input type="date" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={upahForm.control} name="catatan" render={({ field }) => (
                <FormItem>
                  <FormLabel>Catatan</FormLabel>
                  <FormControl><Textarea placeholder="Opsional..." rows={2} {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setIsUpahDialogOpen(false)}>Batal</Button>
                <Button type="submit" disabled={isPending}>
                  {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  {editingUpah ? "Simpan Perubahan" : "Tambah Catatan"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* ── Dialog Bayar Upah ────────────────────────────────────────────────── */}
      <Dialog open={isBayarDialogOpen} onOpenChange={(open) => { setIsBayarDialogOpen(open); if (!open) { setSelectedUpahId(null); bayarForm.clearErrors(); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Bayar Upah</DialogTitle>
          </DialogHeader>
          {loadingDetail ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : upahDetail && (
            <div className="space-y-4">
              <div className="bg-muted/50 rounded-lg p-3 space-y-1 text-sm">
                <div className="font-semibold text-base">{upahDetail.pekerja_nama}</div>
                <div className="text-muted-foreground">{upahDetail.keterangan}</div>
                <div className="flex gap-6 pt-1 text-xs">
                  <span>Total: <strong>{formatRupiah(upahDetail.jumlah_total)}</strong></span>
                  <span>Dibayar: <strong className="text-green-700">{formatRupiah(upahDetail.total_dibayar)}</strong></span>
                  <span>Sisa: <strong className="text-red-700">{formatRupiah(upahDetail.sisa_upah)}</strong></span>
                </div>
              </div>

              {upahDetail.bayar_list.length > 0 && (
                <div>
                  <p className="text-sm font-medium mb-2">Riwayat Pembayaran</p>
                  <div className="space-y-1.5 max-h-32 overflow-y-auto">
                    {upahDetail.bayar_list.map((b) => (
                      <div key={b.id} className="flex items-center justify-between text-sm bg-green-50 border border-green-100 rounded px-3 py-1.5">
                        <div>
                          <span className="font-medium text-green-800">{formatRupiah(b.jumlah)}</span>
                          <span className="text-muted-foreground ml-2 text-xs">— {formatDate(b.tanggal_bayar)}</span>
                          {b.catatan && <span className="text-muted-foreground ml-1 text-xs">({b.catatan})</span>}
                        </div>
                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-destructive hover:text-destructive hover:bg-red-50" onClick={() => setDeletingBayarId(b.id)} disabled={!lisensiAktif}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {upahDetail.status !== "lunas" && (
                <Form {...bayarForm}>
                  <form onSubmit={bayarForm.handleSubmit(submitBayar)} className="space-y-3 border-t pt-3">
                    <p className="text-sm font-medium">Tambah Pembayaran</p>
                    <div className="grid grid-cols-2 gap-3">
                      <FormField control={bayarForm.control} name="jumlah" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Jumlah Bayar <span className="text-destructive">*</span></FormLabel>
                          <FormControl><Input type="number" min={1} max={upahDetail.sisa_upah} placeholder="0" {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={bayarForm.control} name="tanggal_bayar" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Tanggal Bayar <span className="text-destructive">*</span></FormLabel>
                          <FormControl><Input type="date" {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                    </div>
                    <FormField control={bayarForm.control} name="catatan" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Catatan</FormLabel>
                        <FormControl><Input placeholder="Opsional..." {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <div className="flex justify-end gap-2">
                      <Button type="button" variant="outline" onClick={() => setIsBayarDialogOpen(false)}>Tutup</Button>
                      <Button type="submit" disabled={bayarUpah.isPending}>
                        {bayarUpah.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                        Bayar
                      </Button>
                    </div>
                  </form>
                </Form>
              )}

              {upahDetail.status === "lunas" && (
                <div className="flex justify-between items-center border-t pt-3">
                  <span className="text-sm text-green-700 font-medium">Upah ini sudah lunas.</span>
                  <Button variant="outline" onClick={() => setIsBayarDialogOpen(false)}>Tutup</Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Dialog Tambah/Edit Pekerja ───────────────────────────────────────── */}
      <Dialog open={isPekerjaDialogOpen} onOpenChange={(open) => { setIsPekerjaDialogOpen(open); if (!open) { setEditingPekerja(null); pekerjaForm.clearErrors(); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingPekerja ? "Edit Data Pekerja" : "Tambah Pekerja"}</DialogTitle>
          </DialogHeader>
          <Form {...pekerjaForm}>
            <form onSubmit={pekerjaForm.handleSubmit(submitPekerja)} className="space-y-4">
              <FormField control={pekerjaForm.control} name="nama" render={({ field }) => (
                <FormItem>
                  <FormLabel>Nama <span className="text-destructive">*</span></FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Nama pekerja"
                      autoCapitalize="words"
                      {...field}
                      onChange={(e) => field.onChange(toTitleCase(e.target.value))}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={pekerjaForm.control} name="jabatan" render={({ field }) => (
                <FormItem>
                  <FormLabel>Jabatan / Jenis Pekerjaan</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Contoh: Kuli, Sopir, Kasir"
                      autoCapitalize="words"
                      {...field}
                      onChange={(e) => field.onChange(toTitleCase(e.target.value))}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={pekerjaForm.control} name="telepon" render={({ field }) => (
                <FormItem>
                  <FormLabel>Telepon</FormLabel>
                  <FormControl><Input placeholder="Opsional" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={pekerjaForm.control} name="catatan" render={({ field }) => (
                <FormItem>
                  <FormLabel>Catatan</FormLabel>
                  <FormControl><Textarea placeholder="Opsional..." rows={2} {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setIsPekerjaDialogOpen(false)}>Batal</Button>
                <Button type="submit" disabled={isPekerjaFormPending}>
                  {isPekerjaFormPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  {editingPekerja ? "Simpan Perubahan" : "Tambah Pekerja"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* ── Alert: Hapus Upah ────────────────────────────────────────────────── */}
      <AlertDialog open={isDeleteUpahOpen} onOpenChange={setIsDeleteUpahOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Catatan Upah?</AlertDialogTitle>
            <AlertDialogDescription>Semua riwayat pembayaran terkait juga akan dihapus. Tindakan ini tidak dapat dibatalkan.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeletingUpahId(null)}>Batal</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={() => { if (deletingUpahId) deleteUpah.mutate({ id: deletingUpahId }); }}
              disabled={deleteUpah.isPending}
            >
              {deleteUpah.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Alert: Hapus Pekerja ─────────────────────────────────────────────── */}
      <AlertDialog open={isDeletePekerjaOpen} onOpenChange={setIsDeletePekerjaOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Pekerja?</AlertDialogTitle>
            <AlertDialogDescription>Pekerja hanya bisa dihapus jika tidak memiliki catatan upah. Tindakan ini tidak dapat dibatalkan.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeletingPekerjaId(null)}>Batal</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={() => { if (deletingPekerjaId) deletePekerja.mutate({ id: deletingPekerjaId }); }}
              disabled={deletePekerja.isPending}
            >
              {deletePekerja.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Alert: Hapus Bayar ───────────────────────────────────────────────── */}
      <AlertDialog open={!!deletingBayarId} onOpenChange={(open) => { if (!open) setDeletingBayarId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Pembayaran Ini?</AlertDialogTitle>
            <AlertDialogDescription>Entri pengeluaran terkait di Keuangan juga akan dihapus. Tindakan ini tidak dapat dibatalkan.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={() => { if (deletingBayarId) deleteBayar.mutate({ id: deletingBayarId }); }}
              disabled={deleteBayar.isPending}
            >
              {deleteBayar.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {/* ── Dialog Bayar Batch ───────────────────────────────────────────────── */}
      <Dialog open={isBatchDialogOpen} onOpenChange={(open) => { setIsBatchDialogOpen(open); if (!open) { setBatchPekerja(null); batchForm.clearErrors(); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Bayar Upah Batch — {batchPekerja?.nama}</DialogTitle>
          </DialogHeader>
          {batchPekerja && (
            <Form {...batchForm}>
              <form onSubmit={batchForm.handleSubmit(submitBatch)} className="space-y-4">
                <div className="rounded-md border bg-muted/40 p-3 space-y-1.5 max-h-48 overflow-y-auto">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Distribusi FIFO (terlama dulu)</p>
                  {(() => {
                    const jumlahInput = Number(batchForm.watch("jumlah_total")) || 0;
                    let sisa = jumlahInput;
                    return batchUpahList.map((u) => {
                      const alokasi = Math.min(sisa, u.sisa_upah);
                      sisa -= alokasi;
                      const akanLunas = alokasi >= u.sisa_upah;
                      return (
                        <div key={u.id} className="flex items-center justify-between text-sm">
                          <div className="flex-1 min-w-0">
                            <span className="font-medium truncate block">{u.keterangan}</span>
                            <span className="text-xs text-muted-foreground">{formatDate(u.tanggal_kerja)} · sisa {formatRupiah(u.sisa_upah)}</span>
                          </div>
                          <div className="text-right ml-3 shrink-0">
                            {alokasi > 0 ? (
                              <>
                                <span className="font-semibold text-green-700">{formatRupiah(alokasi)}</span>
                                {akanLunas && <span className="ml-1 text-xs bg-green-100 text-green-800 rounded px-1">Lunas</span>}
                              </>
                            ) : (
                              <span className="text-muted-foreground text-xs">—</span>
                            )}
                          </div>
                        </div>
                      );
                    });
                  })()}
                  <div className="flex justify-between pt-1.5 border-t text-sm font-semibold">
                    <span>Total Sisa</span>
                    <span>{formatRupiah(totalSisaBatch)}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <FormField control={batchForm.control} name="jumlah_total" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Jumlah Bayar <span className="text-destructive">*</span></FormLabel>
                      <FormControl><Input type="number" min={1} max={totalSisaBatch} placeholder="0" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={batchForm.control} name="tanggal_bayar" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tanggal Bayar <span className="text-destructive">*</span></FormLabel>
                      <FormControl><Input type="date" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
                <FormField control={batchForm.control} name="catatan" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Catatan</FormLabel>
                    <FormControl><Input placeholder="Opsional" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <div className="flex justify-end gap-2 pt-1">
                  <Button type="button" variant="outline" onClick={() => setIsBatchDialogOpen(false)}>Batal</Button>
                  <Button type="submit" disabled={bayarBatch.isPending}>
                    {bayarBatch.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Bayar Sekarang
                  </Button>
                </div>
              </form>
            </Form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
