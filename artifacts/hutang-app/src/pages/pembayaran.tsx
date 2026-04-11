import { useState } from "react";
import { Link } from "wouter";
import { 
  useGetPembayaranList, useCreatePembayaran, useDeletePembayaran, useGetPelangganList, useGetHutangList,
  getGetPembayaranListQueryKey, getGetHutangListQueryKey, Pembayaran
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { formatRupiah, formatDate } from "@/lib/format";
import { Loader2, Plus, Trash2, Filter, Printer } from "lucide-react";
import { TableSkeleton } from "@/components/ui/table-skeleton";

declare global {
  interface Window {
    electronApp?: {
      platform: string;
      isElectron: boolean;
      openInBrowser: (html: string) => Promise<string>;
    };
  }
}

// ─── Format helpers (untuk HTML string, bukan React) ──────────────────────────
function fmtRupiah(n: number) {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(n);
}
function fmtDate(iso: string) {
  return new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "long", year: "numeric" }).format(new Date(iso));
}

// ─── Kwitansi HTML builder (A5 Portrait) ──────────────────────────────────────
function buildKwitansiHtml(p: Pembayaran): string {
  const nomorKwitansi = p.nomor_kwitansi || `KWT-${p.id}`;
  const namaUsaha     = p.nama_usaha || "Usaha";
  const pelangganNama = p.pelanggan_nama;
  const tanggal       = fmtDate(p.tanggal_bayar);
  const keterangan    = p.hutang_keterangan || "—";
  const nominalBayar  = p.nominal_bayar;
  const hutangNominal = p.hutang_nominal ?? 0;
  const sisaHutang    = p.sisa_hutang_setelah ?? 0;
  const catatan       = p.catatan || "";

  return `<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="UTF-8"/>
<title>Kwitansi ${nomorKwitansi}</title>
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
.detail-tbl td { padding: 3px 6px; border-bottom: 1px solid #eee; }
.detail-tbl .right { text-align: right; }
.detail-tbl .total-row td { font-weight: bold; border-top: 2px solid #999; border-bottom: none; padding-top: 5px; }
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
    <div class="nomor-kwt">No: ${nomorKwitansi} &nbsp;&bull;&nbsp; Tanggal: ${tanggal}</div>
  </div>

  <table class="info-tbl">
    <tr><td class="lbl">Diterima dari</td><td class="sep">:</td><td><strong>${pelangganNama}</strong></td></tr>
    <tr><td class="lbl">Keterangan Hutang</td><td class="sep">:</td><td>${keterangan}</td></tr>
  </table>

  <div class="nominal-box">
    <div class="nominal-label">Jumlah Dibayar</div>
    <div class="nominal-nilai">${fmtRupiah(nominalBayar)}</div>
  </div>

  <table class="detail-tbl">
    <tr><td>Hutang Awal</td><td class="right">${fmtRupiah(hutangNominal)}</td></tr>
    <tr><td>Dibayar Kali Ini</td><td class="right green">+ ${fmtRupiah(nominalBayar)}</td></tr>
    <tr class="total-row">
      <td>Sisa Hutang</td>
      <td class="right ${sisaHutang <= 0 ? "green" : "orange"}">${sisaHutang <= 0 ? "✓ LUNAS" : fmtRupiah(sisaHutang)}</td>
    </tr>
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

// ─── Open kwitansi in browser / Electron ──────────────────────────────────────
function openKwitansi(p: Pembayaran) {
  const html = buildKwitansiHtml(p);
  if (window.electronApp?.isElectron && typeof window.electronApp.openInBrowser === "function") {
    window.electronApp.openInBrowser(html);
  } else {
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const tab = window.open(url, "_blank");
    if (tab) tab.addEventListener("load", () => setTimeout(() => URL.revokeObjectURL(url), 2000));
  }
}

// ─── Page Component ───────────────────────────────────────────────────────────
export default function PembayaranPage() {
  const [filterPelanggan, setFilterPelanggan] = useState<number | undefined>(undefined);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedPembayaran, setSelectedPembayaran] = useState<Pembayaran | null>(null);
  const [kwitansiSetelahBayar, setKwitansiSetelahBayar] = useState<Pembayaran | null>(null);
  const [formPelangganId, setFormPelangganId] = useState<number | null>(null);

  const { data: pembayaranList, isLoading } = useGetPembayaranList({ pelanggan_id: filterPelanggan });
  const { data: pelangganList } = useGetPelangganList();
  const { data: hutangAktifList } = useGetHutangList(
    { pelanggan_id: formPelangganId || undefined, status: "aktif" },
    { query: { enabled: !!formPelangganId } }
  );

  const { toast } = useToast();
  const queryClient = useQueryClient();
  const createMutation = useCreatePembayaran();
  const deleteMutation = useDeletePembayaran();

  const pembayaranSchema = z.object({
    hutang_id: z.coerce.number().min(1, { message: "Pilih nota hutang" }),
    tanggal_bayar: z.string().min(1, { message: "Tanggal wajib diisi" }),
    nominal_bayar: z.coerce.number().min(1, { message: "Nominal harus lebih dari 0" }),
    catatan: z.string().optional(),
  });

  const form = useForm<z.infer<typeof pembayaranSchema>>({
    resolver: zodResolver(pembayaranSchema),
    defaultValues: { hutang_id: 0, tanggal_bayar: new Date().toISOString().split("T")[0], nominal_bayar: 0, catatan: "" },
  });

  const selectedHutangId = form.watch("hutang_id");
  const selectedHutang = hutangAktifList?.find(h => h.id === selectedHutangId);

  const handleOpenDialog = () => {
    setFormPelangganId(null);
    form.reset({ hutang_id: 0, tanggal_bayar: new Date().toISOString().split("T")[0], nominal_bayar: 0, catatan: "" });
    setIsDialogOpen(true);
  };

  const onSubmit = (values: z.infer<typeof pembayaranSchema>) => {
    if (selectedHutang && values.nominal_bayar > selectedHutang.sisa_hutang) {
      form.setError("nominal_bayar", { type: "manual", message: "Nominal melebihi sisa hutang!" });
      return;
    }
    createMutation.mutate(
      { data: values },
      {
        onSuccess: (data) => {
          toast({ title: "Pembayaran berhasil dicatat" });
          queryClient.invalidateQueries({ queryKey: getGetPembayaranListQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetHutangListQueryKey() });
          queryClient.invalidateQueries({ queryKey: ["keuangan"] });
          queryClient.invalidateQueries({ queryKey: ["keuangan-rekap"] });
          setIsDialogOpen(false);
          setKwitansiSetelahBayar(data as unknown as Pembayaran);
        },
        onError: (err: any) =>
          toast({ variant: "destructive", title: "Gagal", description: err?.data?.error || err?.message || "Terjadi kesalahan" }),
      }
    );
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

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-primary">Pembayaran</h2>
          <p className="text-muted-foreground">Catat penerimaan pembayaran hutang.</p>
        </div>
        <Button onClick={handleOpenDialog}>
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

      {/* Form Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Terima Pembayaran</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2 border-b pb-4 border-border">
              <label className="text-sm font-medium">1. Pilih Pelanggan</label>
              <Select
                onValueChange={(v) => { setFormPelangganId(parseInt(v)); form.setValue("hutang_id", 0); }}
                value={formPelangganId?.toString() || ""}
              >
                <SelectTrigger><SelectValue placeholder="Pilih pelanggan..." /></SelectTrigger>
                <SelectContent>
                  {pelangganList?.map(p => (
                    <SelectItem key={p.id} value={p.id.toString()}>{p.nama}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {formPelangganId && (
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField control={form.control} name="hutang_id" render={({ field }) => (
                    <FormItem>
                      <FormLabel>2. Pilih Nota Hutang Aktif</FormLabel>
                      <Select
                        onValueChange={(v) => {
                          const hId = parseInt(v);
                          field.onChange(hId);
                          const h = hutangAktifList?.find(x => x.id === hId);
                          if (h) form.setValue("nominal_bayar", h.sisa_hutang);
                        }}
                        value={field.value ? field.value.toString() : ""}
                      >
                        <FormControl>
                          <SelectTrigger><SelectValue placeholder="Pilih nota hutang..." /></SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {!hutangAktifList || hutangAktifList.length === 0 ? (
                            <SelectItem value="0" disabled>Tidak ada hutang aktif</SelectItem>
                          ) : (
                            hutangAktifList.map(h => (
                              <SelectItem key={h.id} value={h.id.toString()}>
                                {formatDate(h.tanggal_hutang)} — Sisa: {formatRupiah(h.sisa_hutang)}
                              </SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />

                  {selectedHutang && (
                    <>
                      <FormField control={form.control} name="tanggal_bayar" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Tanggal Bayar</FormLabel>
                          <FormControl><Input type="date" {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="nominal_bayar" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Nominal Pembayaran (Rp)</FormLabel>
                          <FormControl>
                            <Input type="number" min="1" max={selectedHutang.sisa_hutang} {...field} />
                          </FormControl>
                          <FormDescription>Sisa hutang: {formatRupiah(selectedHutang.sisa_hutang)}</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="catatan" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Catatan (Opsional)</FormLabel>
                          <FormControl><Textarea placeholder="Contoh: Transfer BCA" {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <Button type="submit" className="w-full" disabled={createMutation.isPending || !selectedHutang}>
                        {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Simpan Pembayaran
                      </Button>
                    </>
                  )}
                </form>
              </Form>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog: Cetak kwitansi setelah bayar */}
      <Dialog open={!!kwitansiSetelahBayar} onOpenChange={(open) => { if (!open) setKwitansiSetelahBayar(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Printer className="h-5 w-5 text-primary" />
              Pembayaran Berhasil!
            </DialogTitle>
          </DialogHeader>
          {kwitansiSetelahBayar && (
            <div className="space-y-3 py-2">
              <div className="text-sm text-muted-foreground">
                <p>No. Kwitansi: <span className="font-semibold text-foreground">{kwitansiSetelahBayar.nomor_kwitansi}</span></p>
                <p>Pelanggan: <span className="font-semibold text-foreground">{kwitansiSetelahBayar.pelanggan_nama}</span></p>
                <p>Dibayar: <span className="font-semibold text-emerald-600">{formatRupiah(kwitansiSetelahBayar.nominal_bayar)}</span></p>
              </div>
              <p className="text-sm">Cetak kwitansi pembayaran untuk diberikan ke pelanggan?</p>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setKwitansiSetelahBayar(null)}>Nanti Saja</Button>
            <Button
              onClick={() => {
                if (kwitansiSetelahBayar) openKwitansi(kwitansiSetelahBayar);
                setKwitansiSetelahBayar(null);
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
            <AlertDialogTitle>Batal Pembayaran?</AlertDialogTitle>
            <AlertDialogDescription>
              Menghapus pembayaran ini akan mengembalikan sisa hutang ke nominal sebelumnya. Lanjutkan?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Kembali</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              {deleteMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
              Hapus & Batalkan
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
                  pembayaranList.map((p) => (
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
                            onClick={() => openKwitansi(p)}
                            title="Cetak Kwitansi"
                            className="text-primary"
                          >
                            <Printer className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost" size="icon"
                            onClick={() => { setSelectedPembayaran(p); setIsDeleteDialogOpen(true); }}
                            title="Hapus/Batal"
                            className="text-destructive"
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
