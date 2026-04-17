import { useState, useMemo, useRef } from "react";
import {
  useGetPekerjaList, useCreatePekerja, useUpdatePekerja, useDeletePekerja,
  useGetUpahList, useCreateUpah, useUpdateUpah, useDeleteUpah,
  useGetUpah, useBayarUpah, useDeleteBayarUpah, useBayarBatchUpah,
  useGetUsaha, getGetUsahaQueryKey,
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
import { Loader2, Plus, Edit, Trash2, Search, HardHat, Banknote, Users, TrendingDown, Clock, Download, Printer } from "lucide-react";
import { useLicense } from "@/context/license-context";
import { useAuth } from "@/hooks/use-auth";

// ── Helpers ───────────────────────────────────────────────────────────────────

function toTitleCase(str: string): string {
  return str.replace(/\b\w/g, (c) => c.toUpperCase());
}

function capitalizeFirst(str: string): string {
  if (!str) return str;
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// ── Kwitansi helpers ──────────────────────────────────────────────────────────

interface KwitansiUpahData {
  type: "single" | "batch";
  pekerja_nama: string;
  pekerja_jabatan: string;
  keterangan: string;
  tanggal_bayar: string;
  jumlah: number;
  catatan: string;
  namaUsaha: string;
}

function openPrintWindow(html: string) {
  if (window.electronApp?.isElectron && typeof window.electronApp.openInBrowser === "function") {
    window.electronApp.openInBrowser(html);
  } else {
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const tab = window.open(url, "_blank");
    if (tab) tab.addEventListener("load", () => setTimeout(() => URL.revokeObjectURL(url), 2000));
  }
}

function buildKwitansiUpahHtml(d: KwitansiUpahData): string {
  const noKwitansi = `KWT-UPAH-${Date.now().toString().slice(-8)}`;
  const fmtRp = (n: number) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(n);
  const fmtTgl = (s: string) => new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "long", year: "numeric" }).format(new Date(s));
  const judulKet = d.type === "batch" ? "Pembayaran seluruh upah tertunggak" : d.keterangan;

  return `<!DOCTYPE html><html lang="id"><head><meta charset="UTF-8"/>
<title>Kwitansi ${noKwitansi}</title>
<style>
@page { size: A5 landscape; margin: 12mm 14mm; }
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: Arial, Helvetica, sans-serif; font-size: 10pt; color: #111; background: white; }
.wrap { border: 2px solid #333; border-radius: 4px; padding: 16px 20px; }
.header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 1.5px solid #333; padding-bottom: 10px; margin-bottom: 10px; }
.usaha-nama { font-size: 14pt; font-weight: bold; }
.judul-kwt { font-size: 11pt; font-weight: bold; text-align: right; }
.nomor-kwt { font-size: 8.5pt; color: #555; text-align: right; margin-top: 2px; }
table.detail { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 10pt; }
table.detail td { padding: 3px 6px; vertical-align: top; }
table.detail td:first-child { font-weight: 600; width: 130px; white-space: nowrap; }
table.detail td.colon { width: 12px; }
.nominal-box { margin-top: 14px; background: #f5f5f5; border: 1px solid #bbb; border-radius: 3px; padding: 8px 14px; display: flex; justify-content: space-between; align-items: center; }
.nominal-label { font-size: 9pt; color: #555; }
.nominal-value { font-size: 16pt; font-weight: bold; color: #1a1a1a; }
.footer-kwt { margin-top: 14px; display: flex; justify-content: flex-end; align-items: flex-end; }
.ttd-box { text-align: center; width: 160px; }
.ttd-space { height: 48px; border-bottom: 1px solid #999; margin-bottom: 4px; }
.ttd-label { font-size: 8.5pt; color: #555; }
.bottom-note { margin-top: 10px; border-top: 1px dashed #bbb; padding-top: 8px; text-align: center; font-size: 8pt; color: #777; }
</style>
<script>window.addEventListener('load',function(){setTimeout(function(){window.print();},600);});<\/script>
</head><body>
<div class="wrap">
  <div class="header">
    <div><div class="usaha-nama">${d.namaUsaha}</div></div>
    <div><div class="judul-kwt">KWITANSI PEMBAYARAN UPAH</div>
    <div class="nomor-kwt">No: ${noKwitansi} &bull; Tgl: ${fmtTgl(d.tanggal_bayar)}</div></div>
  </div>
  <table class="detail">
    <tr><td>Nama Pekerja</td><td class="colon">:</td><td><strong>${d.pekerja_nama}</strong></td></tr>
    ${d.pekerja_jabatan ? `<tr><td>Jabatan</td><td class="colon">:</td><td>${d.pekerja_jabatan}</td></tr>` : ""}
    <tr><td>Keterangan</td><td class="colon">:</td><td>${judulKet}</td></tr>
    <tr><td>Tanggal Bayar</td><td class="colon">:</td><td>${fmtTgl(d.tanggal_bayar)}</td></tr>
    ${d.catatan ? `<tr><td>Catatan</td><td class="colon">:</td><td>${d.catatan}</td></tr>` : ""}
  </table>
  <div class="nominal-box">
    <span class="nominal-label">Jumlah Diterima</span>
    <span class="nominal-value">${fmtRp(d.jumlah)}</span>
  </div>
  <div class="footer-kwt">
    <div class="ttd-box">
      <div class="ttd-space"></div>
      <div class="ttd-label">Tanda Tangan Pekerja</div>
    </div>
  </div>
  <div class="bottom-note">Simpan kwitansi ini sebagai bukti pembayaran upah.</div>
</div>
</body></html>`;
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
  const { user } = useAuth();

  // ── Kwitansi state ──────────────────────────────────────────────────────────
  const [isKwitansiOpen, setIsKwitansiOpen] = useState(false);
  const [kwitansiData, setKwitansiData] = useState<KwitansiUpahData | null>(null);
  const pendingKwitansiRef = useRef<KwitansiUpahData | null>(null);

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
  const { data: usahaData } = useGetUsaha(user?.usaha_id ?? 0, {
    query: { enabled: !!user?.usaha_id, queryKey: getGetUsahaQueryKey(user?.usaha_id ?? 0) },
  });
  const namaUsaha = usahaData?.nama_usaha ?? "Usahaku";

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
      onSuccess: () => {
        invalidateUpah();
        toast({ title: "Pembayaran berhasil dicatat" });
        bayarForm.reset();
        if (pendingKwitansiRef.current) {
          setKwitansiData(pendingKwitansiRef.current);
          setIsKwitansiOpen(true);
          pendingKwitansiRef.current = null;
        }
      },
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
        if (pendingKwitansiRef.current) {
          setKwitansiData(pendingKwitansiRef.current);
          setIsKwitansiOpen(true);
          pendingKwitansiRef.current = null;
        }
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

  // ── Summary cards ────────────────────────────────────────────────────────────
  const totalSisaUpah = useMemo(() =>
    (allUpahList ?? []).reduce((sum, u) => sum + u.sisa_upah, 0),
  [allUpahList]);

  const catatanBelumLunas = useMemo(() =>
    (allUpahList ?? []).filter(u => u.status === "belum_lunas").length,
  [allUpahList]);

  // ── Export CSV catatan upah ──────────────────────────────────────────────────
  const exportUpahCSV = () => {
    const header = ["No", "Pekerja", "Jabatan", "Keterangan", "Tgl. Kerja", "Total Upah", "Sudah Dibayar", "Sisa", "Status", "Catatan"];
    const rows = filteredUpah.map((u, i) => [
      i + 1,
      u.pekerja_nama,
      u.pekerja_jabatan ?? "",
      u.keterangan,
      u.tanggal_kerja,
      u.jumlah_total,
      u.total_dibayar,
      u.sisa_upah,
      u.status === "lunas" ? "Lunas" : "Belum Lunas",
      u.catatan ?? "",
    ]);
    const csv = [header, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `catatan-upah-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

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
    pendingKwitansiRef.current = {
      type: "batch",
      pekerja_nama: batchPekerja.nama,
      pekerja_jabatan: batchPekerja.jabatan ?? "",
      keterangan: "Pembayaran seluruh upah tertunggak",
      tanggal_bayar: data.tanggal_bayar,
      jumlah: data.jumlah_total,
      catatan: data.catatan ?? "",
      namaUsaha,
    };
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
    if (!selectedUpahId || !upahDetail) return;
    pendingKwitansiRef.current = {
      type: "single",
      pekerja_nama: upahDetail.pekerja_nama,
      pekerja_jabatan: upahDetail.pekerja_jabatan ?? "",
      keterangan: upahDetail.keterangan,
      tanggal_bayar: data.tanggal_bayar,
      jumlah: data.jumlah,
      catatan: data.catatan ?? "",
      namaUsaha,
    };
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

      {/* ── Summary Cards ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-50 rounded-lg shrink-0">
                <TrendingDown className="h-5 w-5 text-red-600" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Total Sisa Upah</p>
                <p className="text-lg font-bold text-red-700 truncate">{formatRupiah(totalSisaUpah)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-50 rounded-lg shrink-0">
                <Users className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Jumlah Pekerja</p>
                <p className="text-lg font-bold">{pekerjaList?.length ?? 0} orang</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-50 rounded-lg shrink-0">
                <Clock className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Catatan Belum Lunas</p>
                <p className="text-lg font-bold text-orange-700">{catatanBelumLunas} catatan</p>
              </div>
            </div>
          </CardContent>
        </Card>
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
            <Button variant="outline" onClick={exportUpahCSV} disabled={filteredUpah.length === 0} title="Export CSV">
              <Download className="h-4 w-4 mr-1" /> CSV
            </Button>
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
        <DialogContent aria-describedby={undefined} className="max-w-md">
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
        <DialogContent aria-describedby={undefined} className="max-w-lg">
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
        <DialogContent aria-describedby={undefined} className="max-w-md">
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
        <DialogContent aria-describedby={undefined} className="max-w-lg">
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

      {/* ── Dialog Kwitansi Upah ─────────────────────────────────────────────── */}
      <Dialog open={isKwitansiOpen} onOpenChange={setIsKwitansiOpen}>
        <DialogContent aria-describedby={undefined} className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Printer className="h-5 w-5 text-primary" />
              Cetak Kwitansi
            </DialogTitle>
          </DialogHeader>
          {kwitansiData && (
            <div className="space-y-4">
              <div className="bg-muted/50 rounded-lg p-3 space-y-1.5 text-sm">
                <div className="font-semibold">{kwitansiData.pekerja_nama}</div>
                {kwitansiData.pekerja_jabatan && (
                  <div className="text-muted-foreground text-xs">{kwitansiData.pekerja_jabatan}</div>
                )}
                <div className="text-muted-foreground">{kwitansiData.keterangan}</div>
                <div className="pt-1 font-bold text-base text-primary">{formatRupiah(kwitansiData.jumlah)}</div>
              </div>
              <p className="text-sm text-muted-foreground">Cetak kwitansi pembayaran upah untuk diberikan kepada pekerja?</p>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setIsKwitansiOpen(false)}>Lewati</Button>
                <Button onClick={() => { openPrintWindow(buildKwitansiUpahHtml(kwitansiData)); setIsKwitansiOpen(false); }}>
                  <Printer className="h-4 w-4 mr-2" />
                  Cetak Kwitansi
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
