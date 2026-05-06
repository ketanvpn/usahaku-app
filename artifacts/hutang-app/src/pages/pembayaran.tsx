import { useState, useMemo, useEffect } from "react";
import { Link } from "wouter";
import {
  useGetPembayaranList, useDeletePembayaran, useGetPelangganList, useGetHutangList,
  getGetPembayaranListQueryKey, getGetHutangListQueryKey, Pembayaran, Hutang
} from "@workspace/api-client-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { PelangganCombobox } from "@/components/pelanggan-combobox";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { formatRupiah, formatDate } from "@/lib/format";
import { Loader2, Plus, Trash2, Filter, Printer, ArrowRight, CheckCircle2, Clock } from "lucide-react";
import { TableSkeleton } from "@/components/ui/table-skeleton";
import { useLicense } from "@/context/license-context";

type PembayaranFull = Pembayaran & {
  nomor_kwitansi?: string;
  nama_usaha?: string;
  hutang_keterangan?: string;
  hutang_nominal?: number;
  sisa_hutang_setelah?: number;
};

type BatchResult = {
  pembayaran_list: Array<{
    id: number;
    hutang_id: number;
    hutang_tanggal: string;
    hutang_keterangan: string | null;
    hutang_nominal: number;
    nominal_bayar: number;
    sisa_hutang_setelah: number;
    nomor_kwitansi: string;
    status_baru: "lunas" | "aktif";
  }>;
  pelanggan_nama: string;
  pelanggan_id: number;
  nama_usaha: string;
  total_dibayar: number;
  tanggal_bayar: string;
  catatan: string | null;
};

type DistribusiItem = {
  hutang: Hutang;
  bayar: number;
  sisaSetelah: number;
  statusBaru: "lunas" | "aktif";
};

function hitungDistribusiFIFO(hutangs: Hutang[], nominalTotal: number): DistribusiItem[] {
  const sorted = [...hutangs].sort((a, b) => a.tanggal_hutang.localeCompare(b.tanggal_hutang));
  let remaining = nominalTotal;
  const result: DistribusiItem[] = [];
  for (const h of sorted) {
    if (remaining <= 0.001) break;
    const sisa = h.sisa_hutang;
    const bayar = Math.min(sisa, remaining);
    if (bayar > 0) {
      result.push({
        hutang: h,
        bayar,
        sisaSetelah: Math.max(0, sisa - bayar),
        statusBaru: sisa - bayar <= 0 ? "lunas" : "aktif",
      });
      remaining -= bayar;
    }
  }
  return result;
}

function fmtRupiah(n: number) {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(n);
}
function fmtDate(iso: string) {
  return new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "long", year: "numeric" }).format(new Date(iso));
}

function buildKwitansiGabunganHtml(batch: BatchResult): string {
  const namaUsaha = batch.nama_usaha || "Usaha";
  const pelangganNama = batch.pelanggan_nama;
  const tanggal = fmtDate(batch.tanggal_bayar);
  const totalDibayar = batch.total_dibayar;
  const catatan = batch.catatan || "";
  const nomorPertama = batch.pembayaran_list[0]?.nomor_kwitansi || "KWT-?";
  const nomorLabel = batch.pembayaran_list.length === 1
    ? nomorPertama
    : `${nomorPertama} s/d ${batch.pembayaran_list[batch.pembayaran_list.length - 1]?.nomor_kwitansi}`;

  const rowsHtml = batch.pembayaran_list.map(p => {
    const label = p.hutang_keterangan
      ? `${fmtDate(p.hutang_tanggal)} — ${p.hutang_keterangan}`
      : fmtDate(p.hutang_tanggal);
    const statusHtml = p.status_baru === "lunas"
      ? `<span class="green">✓ LUNAS</span>`
      : `Sisa ${fmtRupiah(p.sisa_hutang_setelah)}`;
    return `
      <tr>
        <td>${label}</td>
        <td class="right">${fmtRupiah(p.nominal_bayar)}</td>
        <td class="right">${statusHtml}</td>
      </tr>`;
  }).join("");

  return `<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="UTF-8"/>
<title>Kwitansi ${nomorLabel}</title>
<style>
@page { size: A5 portrait; margin: 12mm; }
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: Arial, Helvetica, sans-serif; font-size: 10pt; color: #111; }
.kwt { border: 2px solid #333; padding: 12px; }
.header { text-align: center; border-bottom: 1px dashed #888; padding-bottom: 8px; margin-bottom: 10px; }
.nama-usaha { font-size: 14pt; font-weight: bold; }
.judul-kwt { font-size: 11pt; font-weight: bold; letter-spacing: 1px; margin-top: 3px; }
.nomor-kwt { font-size: 8.5pt; color: #555; margin-top: 2px; }
.info-tbl { width: 100%; border-collapse: collapse; margin: 8px 0; font-size: 9.5pt; }
.info-tbl td { padding: 2px 4px; vertical-align: top; }
.info-tbl .lbl { width: 40%; font-weight: 600; }
.info-tbl .sep { width: 6px; }
.nominal-box { background: #f5f5f5; border: 1px solid #999; border-radius: 3px; padding: 8px 10px; margin: 10px 0; text-align: center; }
.nominal-label { font-size: 8pt; font-weight: 600; color: #555; letter-spacing: 1.5px; text-transform: uppercase; }
.nominal-nilai { font-size: 20pt; font-weight: bold; color: #1a5c2a; margin-top: 2px; }
.detail-tbl { width: 100%; border-collapse: collapse; font-size: 9pt; margin: 8px 0; }
.detail-tbl th { padding: 4px 6px; border-bottom: 2px solid #999; text-align: left; font-size: 8.5pt; }
.detail-tbl th.right { text-align: right; }
.detail-tbl td { padding: 3px 6px; border-bottom: 1px solid #eee; }
.detail-tbl td.right { text-align: right; }
.total-row td { font-weight: bold; border-top: 2px solid #999; border-bottom: none; padding-top: 5px; }
.green { color: #1a7a4a; } .orange { color: #b45309; }
.catatan-box { font-size: 9pt; color: #555; font-style: italic; margin: 6px 4px; }
.ttd-area { display: flex; justify-content: flex-end; margin-top: 14px; }
.ttd-box { text-align: center; width: 110px; font-size: 9pt; }
.ttd-space { height: 38px; }
.ttd-line { border-top: 1px solid #333; padding-top: 3px; font-size: 8pt; }
.footer-kwt { text-align: center; font-size: 7.5pt; color: #888; border-top: 1px dashed #ccc; padding-top: 6px; margin-top: 10px; }
</style>
<script>window.addEventListener('load',function(){setTimeout(function(){window.print();},600);});<\/script>
</head>
<body>
<div class="kwt">
  <div class="header">
    <div class="nama-usaha">${namaUsaha}</div>
    <div class="judul-kwt">KWITANSI PEMBAYARAN HUTANG</div>
    <div class="nomor-kwt">No: ${nomorLabel} &nbsp;&bull;&nbsp; Tanggal: ${tanggal}</div>
  </div>

  <table class="info-tbl">
    <tr><td class="lbl">Diterima dari</td><td class="sep">:</td><td><strong>${pelangganNama}</strong></td></tr>
  </table>

  <div class="nominal-box">
    <div class="nominal-label">Total Dibayar</div>
    <div class="nominal-nilai">${fmtRupiah(totalDibayar)}</div>
  </div>

  <table class="detail-tbl">
    <thead>
      <tr>
        <th>Nota Hutang</th>
        <th class="right">Dibayar</th>
        <th class="right">Status</th>
      </tr>
    </thead>
    <tbody>
      ${rowsHtml}
    </tbody>
    <tfoot>
      <tr class="total-row">
        <td>Total</td>
        <td class="right green">${fmtRupiah(totalDibayar)}</td>
        <td></td>
      </tr>
    </tfoot>
  </table>

  ${catatan ? `<div class="catatan-box">Catatan: ${catatan}</div>` : ""}

  <div class="ttd-area">
    <div class="ttd-box">
      <div>Penerima,</div>
      <div class="ttd-space"></div>
      <div class="ttd-line">(________________)</div>
    </div>
  </div>

  <div class="footer-kwt">Terima kasih atas pembayarannya &bull; Simpan kwitansi ini sebagai bukti pembayaran</div>
</div>
</body>
</html>`;
}

function openKwitansiGabungan(batch: BatchResult) {
  const html = buildKwitansiGabunganHtml(batch);
  if (window.electronApp?.isElectron && typeof window.electronApp.openInBrowser === "function") {
    window.electronApp.openInBrowser(html);
  } else {
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const tab = window.open(url, "_blank");
    if (tab) tab.addEventListener("load", () => setTimeout(() => URL.revokeObjectURL(url), 2000));
  }
}

function openKwitansiLama(p: PembayaranFull) {
  const nomorKwitansi = p.nomor_kwitansi || `KWT-${p.id}`;
  const namaUsaha = p.nama_usaha || "Usaha";
  const tanggal = fmtDate(p.tanggal_bayar);
  const nominalBayar = p.nominal_bayar;
  const hutangNominal = p.hutang_nominal ?? 0;
  const sisaHutang = p.sisa_hutang_setelah ?? 0;
  const catatan = p.catatan || "";
  const keterangan = p.hutang_keterangan || "—";

  const html = `<!DOCTYPE html>
<html lang="id"><head><meta charset="UTF-8"/>
<title>Kwitansi ${nomorKwitansi}</title>
<style>
@page{size:A5 portrait;margin:12mm}*{box-sizing:border-box;margin:0;padding:0}body{font-family:Arial,sans-serif;font-size:10pt;color:#111}
.kwt{border:2px solid #333;padding:12px}.header{text-align:center;border-bottom:1px dashed #888;padding-bottom:8px;margin-bottom:10px}
.nama-usaha{font-size:14pt;font-weight:bold}.judul-kwt{font-size:11pt;font-weight:bold;letter-spacing:1px;margin-top:3px}
.nomor-kwt{font-size:8.5pt;color:#555;margin-top:2px}.info-tbl{width:100%;border-collapse:collapse;margin:8px 0;font-size:9.5pt}
.info-tbl td{padding:2px 4px;vertical-align:top}.info-tbl .lbl{width:40%;font-weight:600}.info-tbl .sep{width:6px}
.nominal-box{background:#f5f5f5;border:1px solid #999;border-radius:3px;padding:8px 10px;margin:10px 0;text-align:center}
.nominal-label{font-size:8pt;font-weight:600;color:#555;letter-spacing:1.5px;text-transform:uppercase}
.nominal-nilai{font-size:20pt;font-weight:bold;color:#1a5c2a;margin-top:2px}
.detail-tbl{width:100%;border-collapse:collapse;font-size:9pt;margin:8px 0}
.detail-tbl td{padding:3px 6px;border-bottom:1px solid #eee}.detail-tbl .right{text-align:right}
.detail-tbl .total-row td{font-weight:bold;border-top:2px solid #999;border-bottom:none;padding-top:5px}
.green{color:#1a7a4a}.orange{color:#b45309}
.ttd-area{display:flex;justify-content:flex-end;margin-top:14px}.ttd-box{text-align:center;width:110px;font-size:9pt}
.ttd-space{height:38px}.ttd-line{border-top:1px solid #333;padding-top:3px;font-size:8pt}
.footer-kwt{text-align:center;font-size:7.5pt;color:#888;border-top:1px dashed #ccc;padding-top:6px;margin-top:10px}
</style>
<script>window.addEventListener('load',function(){setTimeout(function(){window.print();},600);});<\/script>
</head><body><div class="kwt">
<div class="header"><div class="nama-usaha">${namaUsaha}</div>
<div class="judul-kwt">KWITANSI PEMBAYARAN HUTANG</div>
<div class="nomor-kwt">No: ${nomorKwitansi} &bull; Tanggal: ${tanggal}</div></div>
<table class="info-tbl">
<tr><td class="lbl">Diterima dari</td><td class="sep">:</td><td><strong>${p.pelanggan_nama}</strong></td></tr>
<tr><td class="lbl">Keterangan Hutang</td><td class="sep">:</td><td>${keterangan}</td></tr>
</table>
<div class="nominal-box"><div class="nominal-label">Jumlah Dibayar</div><div class="nominal-nilai">${fmtRupiah(nominalBayar)}</div></div>
<table class="detail-tbl">
<tr><td>Hutang Awal</td><td class="right">${fmtRupiah(hutangNominal)}</td></tr>
<tr><td>Dibayar Kali Ini</td><td class="right green">+ ${fmtRupiah(nominalBayar)}</td></tr>
<tr class="total-row"><td>Sisa Hutang</td><td class="right ${sisaHutang<=0?"green":"orange"}">${sisaHutang<=0?"✓ LUNAS":fmtRupiah(sisaHutang)}</td></tr>
</table>
${catatan?`<div style="font-size:9pt;color:#555;font-style:italic;margin:6px 4px">Catatan: ${catatan}</div>`:""}
<div class="ttd-area"><div class="ttd-box"><div>Penerima,</div><div class="ttd-space"></div><div class="ttd-line">(________________)</div></div></div>
<div class="footer-kwt">Terima kasih atas pembayarannya &bull; Simpan kwitansi ini sebagai bukti pembayaran</div>
</div></body></html>`;

  if (window.electronApp?.isElectron && typeof window.electronApp.openInBrowser === "function") {
    window.electronApp.openInBrowser(html);
  } else {
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const tab = window.open(url, "_blank");
    if (tab) tab.addEventListener("load", () => setTimeout(() => URL.revokeObjectURL(url), 2000));
  }
}

export default function PembayaranPage() {
  const [filterPelanggan, setFilterPelanggan] = useState<number | undefined>(undefined);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedPembayaran, setSelectedPembayaran] = useState<Pembayaran | null>(null);
  const [batchResult, setBatchResult] = useState<BatchResult | null>(null);

  const [formPelangganId, setFormPelangganId] = useState<number | null>(null);
  const [selectedHutangIds, setSelectedHutangIds] = useState<Set<number>>(new Set());
  const [nominalTotal, setNominalTotal] = useState<string>("");
  const [tanggalBayar, setTanggalBayar] = useState(new Date().toISOString().split("T")[0]!);
  const [catatan, setCatatan] = useState("");

  const { data: pembayaranList, isLoading } = useGetPembayaranList({ pelanggan_id: filterPelanggan });
  const { data: pelangganList } = useGetPelangganList();
  const { data: hutangAktifList } = useGetHutangList(
    { pelanggan_id: formPelangganId || undefined, status: "aktif" },
    { query: { enabled: !!formPelangganId, queryKey: getGetHutangListQueryKey({ pelanggan_id: formPelangganId || undefined, status: "aktif" }) } }
  );

  const { toast } = useToast();
  const queryClient = useQueryClient();
  const deleteMutation = useDeletePembayaran();
  const { lisensiAktif } = useLicense();

  const hutangDipilih = useMemo(() => {
    if (!hutangAktifList) return [];
    return hutangAktifList.filter(h => selectedHutangIds.has(h.id));
  }, [hutangAktifList, selectedHutangIds]);

  const selectedPelanggan = useMemo(() => {
    if (!formPelangganId || !pelangganList) return null;
    return pelangganList.find((p) => p.id === formPelangganId) ?? null;
  }, [formPelangganId, pelangganList]);

  const totalSisaDipilih = useMemo(() => {
    return hutangDipilih.reduce((sum, h) => sum + h.sisa_hutang, 0);
  }, [hutangDipilih]);

  const nominalAngka = useMemo(() => {
    const n = parseFloat(nominalTotal);
    return isNaN(n) ? 0 : n;
  }, [nominalTotal]);

  const distribusiPreview = useMemo(() => {
    if (hutangDipilih.length === 0 || nominalAngka <= 0) return [];
    return hitungDistribusiFIFO(hutangDipilih, nominalAngka);
  }, [hutangDipilih, nominalAngka]);

  useEffect(() => {
    if (selectedHutangIds.size === 0) return;
    if (totalSisaDipilih <= 0) {
      setNominalTotal("");
      return;
    }
    if (nominalAngka > totalSisaDipilih) {
      setNominalTotal(totalSisaDipilih.toString());
    }
  }, [nominalAngka, selectedHutangIds.size, totalSisaDipilih]);

  const batchMutation = useMutation({
    mutationFn: async (body: { hutang_ids: number[]; tanggal_bayar: string; nominal_total: number; catatan?: string }) => {
      const res = await fetch("/api/pembayaran/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Terjadi kesalahan");
      return data as BatchResult;
    },
    onSuccess: (data) => {
      toast({ title: "Pembayaran berhasil dicatat" });
      queryClient.invalidateQueries({ queryKey: getGetPembayaranListQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetHutangListQueryKey() });
      queryClient.invalidateQueries({ queryKey: ["keuangan"] });
      queryClient.invalidateQueries({ queryKey: ["keuangan-rekap"] });
      setIsDialogOpen(false);
      setBatchResult(data);
    },
    onError: (err: Error) => {
      toast({ variant: "destructive", title: "Gagal", description: err.message });
    },
  });

  const handleOpenDialog = () => {
    setFormPelangganId(null);
    setSelectedHutangIds(new Set());
    setNominalTotal("");
    setTanggalBayar(new Date().toISOString().split("T")[0]!);
    setCatatan("");
    setIsDialogOpen(true);
  };

  const toggleHutang = (id: number) => {
    setSelectedHutangIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      const newHutangs = hutangAktifList?.filter(h => next.has(h.id)) ?? [];
      const newTotal = newHutangs.reduce((s, h) => s + h.sisa_hutang, 0);
      setNominalTotal(newTotal > 0 ? newTotal.toString() : "");
      return next;
    });
  };

  const handleSelectAll = () => {
    if (!hutangAktifList) return;
    if (selectedHutangIds.size === hutangAktifList.length) {
      setSelectedHutangIds(new Set());
      setNominalTotal("");
    } else {
      const allIds = new Set(hutangAktifList.map(h => h.id));
      setSelectedHutangIds(allIds);
      const total = hutangAktifList.reduce((s, h) => s + h.sisa_hutang, 0);
      setNominalTotal(total.toString());
    }
  };

  const handleSubmit = () => {
    if (selectedHutangIds.size === 0) {
      toast({ variant: "destructive", title: "Pilih minimal 1 nota hutang" });
      return;
    }
    if (nominalAngka <= 0) {
      toast({ variant: "destructive", title: "Nominal harus lebih dari 0" });
      return;
    }
    if (nominalAngka > totalSisaDipilih + 0.01) {
      toast({ variant: "destructive", title: "Nominal melebihi total sisa hutang yang dipilih" });
      return;
    }
    batchMutation.mutate({
      hutang_ids: Array.from(selectedHutangIds),
      tanggal_bayar: tanggalBayar,
      nominal_total: nominalAngka,
      catatan: catatan || undefined,
    });
  };

  const handleDelete = () => {
    if (!selectedPembayaran) return;
    deleteMutation.mutate(
      { id: selectedPembayaran.id },
      {
        onSuccess: () => {
          toast({ title: "Pembayaran berhasil dibatalkan/dihapus" });
          queryClient.invalidateQueries({ queryKey: getGetPembayaranListQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetHutangListQueryKey() });
          queryClient.invalidateQueries({ queryKey: ["keuangan"] });
          queryClient.invalidateQueries({ queryKey: ["keuangan-rekap"] });
          setIsDeleteDialogOpen(false);
        },
        onError: (err: any) =>
          toast({ variant: "destructive", title: "Gagal", description: err?.data?.error || err?.message || "Terjadi kesalahan" }),
      }
    );
  };

  const isAllSelected = !!hutangAktifList && hutangAktifList.length > 0 && selectedHutangIds.size === hutangAktifList.length;
  const isFormValid = selectedHutangIds.size > 0 && nominalAngka > 0 && nominalAngka <= totalSisaDipilih + 0.01;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-primary">Pembayaran</h2>
          <p className="text-muted-foreground">Catat pembayaran hutang dari pelanggan.</p>
        </div>
        <Button onClick={handleOpenDialog} disabled={!lisensiAktif}>
          <Plus className="mr-2 h-4 w-4" />
          Terima Pembayaran
        </Button>
      </div>

      {/* Filter */}
      <Card className="bg-muted/30">
        <CardContent className="p-4 flex items-center gap-4">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Filter className="h-4 w-4" /> Filter:
          </div>
          <Select
            value={filterPelanggan?.toString() || "semua"}
            onValueChange={(v) => setFilterPelanggan(v === "semua" ? undefined : parseInt(v))}
          >
            <SelectTrigger className="w-[250px] bg-background">
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

      {/* Dialog Terima Pembayaran */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent aria-describedby={undefined} className="max-w-lg w-full max-h-[90vh] !overflow-hidden !flex !flex-col">
          <DialogHeader>
            <DialogTitle>Terima Pembayaran</DialogTitle>
          </DialogHeader>

          <div className="flex-1 min-h-0 overflow-y-auto pr-1 space-y-5 pt-1">
            {/* Step 1: Pilih Pelanggan */}
            <div className="space-y-2">
              <label className="text-sm font-semibold">1. Pilih Pelanggan</label>
              <PelangganCombobox
                value={formPelangganId}
                onValueChange={(id) => {
                  setFormPelangganId(id);
                  setSelectedHutangIds(new Set());
                  setNominalTotal("");
                }}
                pelangganList={pelangganList}
                placeholder="Cari atau pilih pelanggan..."
              />
              {selectedPelanggan && (
                <div className="rounded-md border bg-blue-50/60 px-3 py-2 text-xs">
                  <span className="text-muted-foreground">Pelanggan terpilih:</span>{" "}
                  <span className="font-semibold text-foreground">{selectedPelanggan.nama}</span>
                </div>
              )}
            </div>

            {/* Step 2: Pilih Nota Hutang */}
            {formPelangganId && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-semibold">2. Pilih Nota yang Akan Dibayar</label>
                  {hutangAktifList && hutangAktifList.length > 1 && (
                    <button
                      type="button"
                      onClick={handleSelectAll}
                      className="text-xs text-primary hover:underline"
                    >
                      {isAllSelected ? "Batalkan semua pilihan" : "Pilih semua nota"}
                    </button>
                  )}
                </div>

                {!hutangAktifList || hutangAktifList.length === 0 ? (
                  <div className="text-sm text-muted-foreground py-3 text-center border rounded-md">
                    Pelanggan ini belum punya nota aktif.
                  </div>
                ) : (
                  <div className="border rounded-md divide-y max-h-[180px] overflow-y-auto">
                    {hutangAktifList.map(h => (
                      <label
                        key={h.id}
                        className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-muted/50 transition-colors"
                      >
                        <Checkbox
                          checked={selectedHutangIds.has(h.id)}
                          onCheckedChange={() => toggleHutang(h.id)}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium">{formatDate(h.tanggal_hutang)}</div>
                          {h.keterangan && (
                            <div className="text-xs text-muted-foreground truncate">{h.keterangan}</div>
                          )}
                        </div>
                        <div className="text-sm font-semibold text-orange-600 shrink-0">
                          {formatRupiah(h.sisa_hutang)}
                        </div>
                      </label>
                    ))}
                  </div>
                )}

                {selectedHutangIds.size > 0 && (
                  <div className="flex items-center justify-between text-sm px-1">
                    <span className="text-muted-foreground">{selectedHutangIds.size} nota dipilih</span>
                    <span className="font-semibold">Total sisa: {formatRupiah(totalSisaDipilih)}</span>
                  </div>
                )}
              </div>
            )}

            {/* Step 3: Nominal Bayar */}
            {selectedHutangIds.size > 0 && (
              <div className="space-y-2">
                <label className="text-sm font-semibold">3. Nominal yang Dibayar (Rp)</label>
                <Input
                  type="number"
                  min={1}
                  max={totalSisaDipilih}
                  value={nominalTotal}
                  onChange={e => setNominalTotal(e.target.value)}
                  placeholder="Masukkan jumlah yang dibayar..."
                />
                <p className="text-xs text-muted-foreground">
                  Maksimal: {formatRupiah(totalSisaDipilih)} — boleh dikurangi, sistem akan otomatis bayar dari nota terlama.
                </p>
                {nominalAngka > totalSisaDipilih + 0.01 && (
                  <p className="text-xs text-destructive font-medium">
                    Nominal melebihi total sisa hutang yang dipilih!
                  </p>
                )}
              </div>
            )}

            {/* Preview Distribusi Realtime */}
            {distribusiPreview.length > 0 && (
              <div className="space-y-2">
                <label className="text-sm font-semibold flex items-center gap-1.5">
                  <ArrowRight className="h-3.5 w-3.5 text-primary" />
                  Distribusi Otomatis (dari hutang terlama):
                </label>
                <div className="border rounded-md divide-y bg-muted/20">
                  {distribusiPreview.map(d => (
                    <div key={d.hutang.id} className="flex items-center gap-3 px-3 py-2">
                      {d.statusBaru === "lunas" ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                      ) : (
                        <Clock className="h-4 w-4 text-orange-400 shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="text-sm">{formatDate(d.hutang.tanggal_hutang)}{d.hutang.keterangan ? ` — ${d.hutang.keterangan}` : ""}</div>
                        <div className="text-xs text-muted-foreground">
                          Dibayar: <span className="text-emerald-600 font-medium">{formatRupiah(d.bayar)}</span>
                          {d.statusBaru === "aktif" && (
                            <> &bull; Sisa: <span className="text-orange-500">{formatRupiah(d.sisaSetelah)}</span></>
                          )}
                        </div>
                      </div>
                      <Badge variant={d.statusBaru === "lunas" ? "default" : "secondary"} className="shrink-0 text-xs">
                        {d.statusBaru === "lunas" ? "LUNAS" : "Sebagian"}
                      </Badge>
                    </div>
                  ))}
                  {/* Hutang yang tidak terkena */}
                  {hutangDipilih
                    .filter(h => !distribusiPreview.find(d => d.hutang.id === h.id))
                    .map(h => (
                      <div key={h.id} className="flex items-center gap-3 px-3 py-2 opacity-40">
                        <Clock className="h-4 w-4 shrink-0" />
                        <div className="flex-1 text-sm">{formatDate(h.tanggal_hutang)}{h.keterangan ? ` — ${h.keterangan}` : ""}</div>
                  <Badge variant="outline" className="shrink-0 text-xs">Belum dibayar</Badge>
                      </div>
                    ))
                  }
                </div>
              </div>
            )}

            {/* Tanggal & Catatan */}
            {selectedHutangIds.size > 0 && (
              <>
                <div className="space-y-2">
                  <label className="text-sm font-semibold">Tanggal Bayar</label>
                  <Input
                    type="date"
                    value={tanggalBayar}
                    onChange={e => setTanggalBayar(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold">Catatan (Opsional)</label>
                  <Textarea
                    value={catatan}
                    onChange={e => setCatatan(e.target.value)}
                    placeholder="Contoh: Transfer BCA, Tunai, dll."
                  />
                </div>
                  <p className="text-xs text-muted-foreground">
                    Tekan tombol di bawah untuk menyimpan pembayaran.
                  </p>
                </>
              )}

          </div>

          <DialogFooter className="sticky bottom-0 z-10 -mx-6 px-6 pb-1 pt-3 border-t shrink-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/85">
            <Button
              className="w-full sm:w-auto"
              onClick={handleSubmit}
              disabled={!isFormValid || batchMutation.isPending}
            >
              {batchMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Bayar Sekarang
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Cetak kwitansi gabungan setelah bayar */}
      <Dialog open={!!batchResult} onOpenChange={(open) => { if (!open) setBatchResult(null); }}>
        <DialogContent aria-describedby={undefined} className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Printer className="h-5 w-5 text-primary" />
              Pembayaran Berhasil!
            </DialogTitle>
          </DialogHeader>
          {batchResult && (
            <div className="space-y-3 py-2">
              <div className="text-sm text-muted-foreground space-y-1">
                <p>Pelanggan: <span className="font-semibold text-foreground">{batchResult.pelanggan_nama}</span></p>
                <p>Total Dibayar: <span className="font-semibold text-emerald-600">{formatRupiah(batchResult.total_dibayar)}</span></p>
                <p>{batchResult.pembayaran_list.length} nota hutang diproses</p>
              </div>
              <p className="text-sm">Cetak kwitansi pembayaran untuk diberikan ke pelanggan?</p>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setBatchResult(null)}>Nanti dulu</Button>
            <Button
              onClick={() => {
                if (batchResult) openKwitansiGabungan(batchResult);
                setBatchResult(null);
              }}
            >
              <Printer className="mr-2 h-4 w-4" />
              Cetak Kwitansi
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Batalkan Pembayaran?</AlertDialogTitle>
            <AlertDialogDescription>
              Pembayaran ini akan dihapus dan sisa hutang dikembalikan seperti semula. Lanjutkan?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Kembali</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              {deleteMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
              Batalkan Pembayaran
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>No. Kwitansi</TableHead>
                <TableHead>Tanggal Bayar</TableHead>
                <TableHead>Pelanggan</TableHead>
                <TableHead>Catatan</TableHead>
                <TableHead className="text-right">Nominal</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            {isLoading ? (
              <TableSkeleton cols={6} />
            ) : (
              <TableBody>
                {!pembayaranList || pembayaranList.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      Belum ada data pembayaran.
                    </TableCell>
                  </TableRow>
                ) : (
                  (pembayaranList as PembayaranFull[]).map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="text-xs font-mono text-muted-foreground whitespace-nowrap">
                        {p.nomor_kwitansi || `#${p.id}`}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">{formatDate(p.tanggal_bayar)}</TableCell>
                      <TableCell className="font-medium">
                        <Link href={`/pelanggan/${p.pelanggan_id}`} className="hover:underline text-primary">
                          {p.pelanggan_nama}
                        </Link>
                      </TableCell>
                      <TableCell className="truncate max-w-[160px] text-muted-foreground">{p.catatan || "—"}</TableCell>
                      <TableCell className="text-right font-semibold text-emerald-600">{formatRupiah(p.nominal_bayar)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost" size="icon"
                            onClick={() => openKwitansiLama(p)}
                            title="Cetak Kwitansi"
                            className="text-primary"
                          >
                            <Printer className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost" size="icon"
                            onClick={() => { setSelectedPembayaran(p); setIsDeleteDialogOpen(true); }}
                            title="Batalkan Pembayaran"
                            className="text-destructive"
                            disabled={!lisensiAktif}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            )}
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
