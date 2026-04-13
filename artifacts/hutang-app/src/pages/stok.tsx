import { useState, useRef } from "react";
import * as XLSX from "xlsx";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Loader2, Plus, Edit, Trash2, Package, AlertTriangle, ArrowDownCircle, ArrowUpCircle, RefreshCw, Upload, FileSpreadsheet, CheckCircle2 } from "lucide-react";
import { TableSkeleton } from "@/components/ui/table-skeleton";
import { useLicense } from "@/context/license-context";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { formatRupiah, formatDate } from "@/lib/format";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

interface Barang {
  id: number;
  nama: string;
  satuan: string;
  kategori: string;
  harga_beli: number;
  harga_jual: number;
  stok: number;
  stok_minimum: number;
  peringatan: boolean;
}

interface TransaksiStok {
  id: number;
  barang_id: number;
  nama_barang: string;
  satuan: string;
  tanggal: string;
  tipe: "masuk" | "keluar";
  jumlah: number;
  harga_satuan: number;
  total: number;
  keterangan: string | null;
}

const KATEGORI_OPTIONS = ["Minuman", "Makanan & Snack", "Sembako", "Rokok", "Sabun & Kebersihan", "Obat-obatan", "Lain-lain"];

const barangSchema = z.object({
  nama: z.string().min(1, "Nama wajib diisi"),
  satuan: z.string().min(1, "Satuan wajib diisi"),
  kategori: z.string().optional(),
  harga_beli: z.coerce.number().min(0, "Harga tidak boleh negatif"),
  harga_jual: z.coerce.number().min(0, "Harga tidak boleh negatif"),
  stok_awal: z.coerce.number().min(0),
  stok_minimum: z.coerce.number().min(0),
});

const transaksiSchema = z.object({
  barang_id: z.coerce.number().min(1, "Pilih barang"),
  tanggal: z.string().min(1, "Tanggal wajib diisi"),
  jumlah: z.coerce.number().min(0.01, "Jumlah harus lebih dari 0"),
  harga_satuan: z.coerce.number().min(0),
  keterangan: z.string().optional(),
});

type BarangForm = z.infer<typeof barangSchema>;
type TransaksiForm = z.infer<typeof transaksiSchema>;

const BULAN_NAMES = ["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];

interface ImportRow {
  nama: string;
  satuan: string;
  kategori?: string;
  harga_beli: number;
  harga_jual: number;
  stok_awal: number;
  stok_minimum: number;
  _valid: boolean;
  _error?: string;
}

async function apiFetch(path: string, options?: RequestInit) {
  const r = await fetch(`${BASE}${path}`, { credentials: "include", ...options });
  if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.error || "Terjadi kesalahan"); }
  return r.json();
}

export default function StokPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { lisensiAktif } = useLicense();
  const now = new Date();

  const [barangDialog, setBarangDialog] = useState(false);
  const [editBarang, setEditBarang] = useState<Barang | null>(null);
  const [deleteBarangId, setDeleteBarangId] = useState<number | null>(null);
  const [deleteTransaksiId, setDeleteTransaksiId] = useState<number | null>(null);
  const [transaksiDialog, setTransaksiDialog] = useState<"masuk" | "keluar" | null>(null);
  const [filterBulan, setFilterBulan] = useState(String(now.getMonth() + 1));
  const [filterTahun, setFilterTahun] = useState(String(now.getFullYear()));
  const [filterNama, setFilterNama] = useState("");
  const [filterKategori, setFilterKategori] = useState("__all__");

  // Import barang
  const [importDialog, setImportDialog] = useState(false);
  const [importRows, setImportRows] = useState<ImportRow[]>([]);
  const [importError, setImportError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: barangList = [], isLoading: loadingBarang } = useQuery<Barang[]>({
    queryKey: ["barang"],
    queryFn: () => apiFetch("/api/barang"),
  });

  const { data: transaksiList = [], isLoading: loadingTransaksi } = useQuery<TransaksiStok[]>({
    queryKey: ["stok-transaksi", filterBulan, filterTahun],
    queryFn: () => apiFetch(`/api/stok/transaksi?bulan=${filterBulan}&tahun=${filterTahun}`),
  });

  const peringatan = barangList.filter(b => b.peringatan);
  const kategoriList = Array.from(new Set(barangList.map(b => b.kategori).filter(Boolean))).sort();
  const barangFiltered = filterKategori !== "__all__"
    ? barangList.filter(b => b.kategori === filterKategori)
    : barangList;
  const tahunOptions = Array.from({ length: 5 }, (_, i) => String(now.getFullYear() - i));

  const transaksiFiltered = filterNama.trim()
    ? transaksiList.filter(t => t.nama_barang.toLowerCase().includes(filterNama.toLowerCase()))
    : transaksiList;

  const totalMasukJumlah = transaksiFiltered.filter(t => t.tipe === "masuk").reduce((s, t) => s + t.jumlah, 0);
  const totalKeluarJumlah = transaksiFiltered.filter(t => t.tipe === "keluar").reduce((s, t) => s + t.jumlah, 0);
  const totalNilai = transaksiFiltered.reduce((s, t) => s + t.total, 0);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["barang"] });
    qc.invalidateQueries({ queryKey: ["stok-transaksi"] });
    qc.invalidateQueries({ queryKey: ["keuangan"] });
    qc.invalidateQueries({ queryKey: ["keuangan-rekap"] });
    qc.invalidateQueries({ queryKey: ["keuangan-rekap-kategori"] });
    qc.invalidateQueries({ queryKey: ["keuangan-rekap-bulanan"] });
  };

  // Import barang
  const importMutation = useMutation({
    mutationFn: (items: ImportRow[]) => apiFetch("/api/barang/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items }),
    }),
    onSuccess: (data) => {
      toast({ title: "Import selesai", description: data.message });
      setImportDialog(false);
      setImportRows([]);
      if (fileInputRef.current) fileInputRef.current.value = "";
      invalidate();
    },
    onError: (e: Error) => toast({ title: "Import gagal", description: e.message, variant: "destructive" }),
  });

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    setImportError("");
    setImportRows([]);
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = ev.target?.result;
        const wb = XLSX.read(data, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" });

        if (raw.length === 0) { setImportError("File kosong atau format tidak sesuai"); return; }

        const rows: ImportRow[] = raw.map((r) => {
          const nama = String(r["Nama"] ?? r["nama"] ?? "").trim();
          const satuan = String(r["Satuan"] ?? r["satuan"] ?? "").trim();
          const harga_beli = Number(r["Harga Beli"] ?? r["harga_beli"] ?? 0);
          const harga_jual = Number(r["Harga Jual"] ?? r["harga_jual"] ?? 0);
          const stok_awal = Number(r["Stok Awal"] ?? r["stok_awal"] ?? 0);
          const stok_minimum = Number(r["Stok Minimum"] ?? r["stok_minimum"] ?? 0);
          const kategori = String(r["Kategori"] ?? r["kategori"] ?? "").trim();

          const valid = !!nama && !!satuan;
          return { nama, satuan, kategori, harga_beli, harga_jual, stok_awal, stok_minimum, _valid: valid, _error: !valid ? "Nama / Satuan kosong" : undefined };
        });

        setImportRows(rows);
      } catch {
        setImportError("Gagal membaca file. Pastikan format Excel/CSV benar.");
      }
    };
    reader.readAsArrayBuffer(file);
  }

  function downloadTemplate() {
    const ws = XLSX.utils.json_to_sheet([
      { Nama: "Contoh Barang", Satuan: "pcs", Kategori: "Minuman", "Harga Beli": 5000, "Harga Jual": 7000, "Stok Awal": 10, "Stok Minimum": 2 },
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Barang");
    XLSX.writeFile(wb, "template_import_barang.xlsx");
  }

  // Form barang
  const barangForm = useForm<BarangForm>({
    resolver: zodResolver(barangSchema),
    defaultValues: { nama: "", satuan: "", kategori: "", harga_beli: 0, harga_jual: 0, stok_awal: 0, stok_minimum: 0 },
  });

  const openTambahBarang = () => {
    setEditBarang(null);
    barangForm.reset({ nama: "", satuan: "", kategori: "", harga_beli: 0, harga_jual: 0, stok_awal: 0, stok_minimum: 0 });
    setBarangDialog(true);
  };

  const openEditBarang = (b: Barang) => {
    setEditBarang(b);
    barangForm.reset({ nama: b.nama, satuan: b.satuan, kategori: b.kategori ?? "", harga_beli: b.harga_beli, harga_jual: b.harga_jual, stok_awal: 0, stok_minimum: b.stok_minimum });
    setBarangDialog(true);
  };

  const simpanBarangMutation = useMutation({
    mutationFn: (values: BarangForm) => apiFetch(
      editBarang ? `/api/barang/${editBarang.id}` : "/api/barang",
      { method: editBarang ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(values) }
    ),
    onSuccess: () => { toast({ title: editBarang ? "Barang diperbarui" : "Barang ditambahkan" }); setBarangDialog(false); invalidate(); },
    onError: (e: Error) => toast({ title: "Gagal", description: e.message, variant: "destructive" }),
  });

  const hapusBarangMutation = useMutation({
    mutationFn: (id: number) => apiFetch(`/api/barang/${id}`, { method: "DELETE" }),
    onSuccess: () => { toast({ title: "Barang dihapus" }); setDeleteBarangId(null); invalidate(); },
    onError: (e: Error) => toast({ title: "Gagal", description: e.message, variant: "destructive" }),
  });

  const hapusTransaksiMutation = useMutation({
    mutationFn: (id: number) => apiFetch(`/api/stok/transaksi/${id}`, { method: "DELETE" }),
    onSuccess: (data) => {
      toast({ title: "Riwayat dihapus", description: `Stok diperbarui menjadi ${data.stok_baru}` });
      setDeleteTransaksiId(null);
      invalidate();
    },
    onError: (e: Error) => toast({ title: "Gagal menghapus", description: e.message, variant: "destructive" }),
  });

  // Form transaksi
  const transaksiForm = useForm<TransaksiForm>({
    resolver: zodResolver(transaksiSchema),
    defaultValues: { barang_id: 0, tanggal: new Date().toISOString().split("T")[0], jumlah: 0, harga_satuan: 0, keterangan: "" },
  });

  const watchBarangId = transaksiForm.watch("barang_id");
  const selectedBarang = barangList.find(b => b.id === Number(watchBarangId));

  const openTransaksi = (tipe: "masuk" | "keluar") => {
    transaksiForm.reset({ barang_id: 0, tanggal: new Date().toISOString().split("T")[0], jumlah: 0, harga_satuan: 0, keterangan: "" });
    setTransaksiDialog(tipe);
  };

  // Auto-isi harga saat pilih barang
  const handleBarangChange = (id: string, onChange: (v: number) => void) => {
    onChange(Number(id));
    const b = barangList.find(b => b.id === Number(id));
    if (b) {
      const harga = transaksiDialog === "masuk" ? b.harga_beli : b.harga_jual;
      transaksiForm.setValue("harga_satuan", harga);
    }
  };

  const transaksiMutation = useMutation({
    mutationFn: (values: TransaksiForm) => apiFetch(
      `/api/stok/${transaksiDialog}`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(values) }
    ),
    onSuccess: (data) => {
      const pesan = transaksiDialog === "masuk"
        ? `Stok bertambah. ${data.keuangan_otomatis ? "Keuangan keluar otomatis dicatat." : ""}`
        : `Stok berkurang. ${data.keuangan_otomatis ? "Keuangan masuk otomatis dicatat." : ""}${data.peringatan_stok ? " ⚠️ Stok mendekati minimum!" : ""}`;
      toast({ title: transaksiDialog === "masuk" ? "Barang Masuk" : "Barang Keluar", description: pesan });
      setTransaksiDialog(null);
      invalidate();
    },
    onError: (e: Error) => toast({ title: "Gagal", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Stok Barang</h1>
          <p className="text-muted-foreground text-sm mt-1">Kelola stok dan catat transaksi barang masuk/keluar</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" className="border-green-500 text-green-700 hover:bg-green-50" onClick={() => openTransaksi("masuk")} disabled={!lisensiAktif}>
            <ArrowDownCircle className="h-4 w-4 mr-2" /> Barang Masuk
          </Button>
          <Button variant="outline" className="border-red-500 text-red-700 hover:bg-red-50" onClick={() => openTransaksi("keluar")} disabled={!lisensiAktif}>
            <ArrowUpCircle className="h-4 w-4 mr-2" /> Barang Keluar
          </Button>
          <Button variant="outline" onClick={() => { setImportRows([]); setImportError(""); setImportDialog(true); }}>
            <Upload className="h-4 w-4 mr-2" /> Import Excel
          </Button>
          <Button onClick={openTambahBarang} disabled={!lisensiAktif}>
            <Plus className="h-4 w-4 mr-2" /> Tambah Barang
          </Button>
        </div>
      </div>

      {/* Peringatan Stok */}
      {peringatan.length > 0 && (
        <Card className="border-red-300 bg-red-50 dark:bg-red-950/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-red-700 dark:text-red-400 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" /> {peringatan.length} Barang Perlu Perhatian
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {peringatan.map(b => {
                const habis = b.stok === 0;
                return (
                  <Badge key={b.id} variant="outline"
                    className={habis
                      ? "border-red-400 text-red-700 bg-red-100"
                      : "border-orange-400 text-orange-700 bg-orange-100"}>
                    {b.nama} — {habis ? "Stok Habis" : `sisa ${b.stok} ${b.satuan}`}
                  </Badge>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tab Daftar & Riwayat */}
      <Tabs defaultValue="daftar">
        <TabsList>
          <TabsTrigger value="daftar">Daftar Barang</TabsTrigger>
          <TabsTrigger value="riwayat">Riwayat Transaksi</TabsTrigger>
        </TabsList>

        {/* Tab Daftar Barang */}
        <TabsContent value="daftar">
          {barangList.length > 0 && (
            <div className="flex gap-2 mb-3">
              <Select value={filterKategori} onValueChange={setFilterKategori}>
                <SelectTrigger className="w-48 h-9 text-sm">
                  <SelectValue placeholder="Semua Kategori" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Semua Kategori</SelectItem>
                  {kategoriList.map(k => <SelectItem key={k} value={k}>{k}</SelectItem>)}
                </SelectContent>
              </Select>
              {filterKategori !== "__all__" && (
                <Button variant="ghost" size="sm" onClick={() => setFilterKategori("__all__")} className="text-xs">
                  Reset Filter
                </Button>
              )}
            </div>
          )}
          <Card>
            <CardContent className="p-0">
              {loadingBarang ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nama Barang</TableHead>
                      <TableHead>Kategori</TableHead>
                      <TableHead>Satuan</TableHead>
                      <TableHead className="text-right">Harga Beli</TableHead>
                      <TableHead className="text-right">Harga Jual</TableHead>
                      <TableHead className="text-center">Stok</TableHead>
                      <TableHead className="text-center">Min.</TableHead>
                      <TableHead className="text-center">Status</TableHead>
                      <TableHead className="text-center w-24">Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableSkeleton cols={9} />
                </Table>
              ) : barangList.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Package className="h-10 w-10 mx-auto mb-3 opacity-30" />
                  <p>Belum ada barang. Tambahkan barang pertama Anda.</p>
                  <Button variant="outline" size="sm" className="mt-3" onClick={openTambahBarang}>Tambah Barang</Button>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nama Barang</TableHead>
                      <TableHead>Kategori</TableHead>
                      <TableHead>Satuan</TableHead>
                      <TableHead className="text-right">Harga Beli</TableHead>
                      <TableHead className="text-right">Harga Jual</TableHead>
                      <TableHead className="text-center">Stok Saat Ini</TableHead>
                      <TableHead className="text-center">Min. Stok</TableHead>
                      <TableHead className="text-center">Status</TableHead>
                      <TableHead className="text-center w-24">Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {barangFiltered.map(b => (
                      <TableRow key={b.id}>
                        <TableCell className="font-medium">{b.nama}</TableCell>
                        <TableCell>
                          {b.kategori
                            ? <Badge variant="outline" className="text-xs font-normal">{b.kategori}</Badge>
                            : <span className="text-muted-foreground text-xs">—</span>}
                        </TableCell>
                        <TableCell className="text-muted-foreground">{b.satuan}</TableCell>
                        <TableCell className="text-right text-sm">{formatRupiah(b.harga_beli)}</TableCell>
                        <TableCell className="text-right text-sm">{formatRupiah(b.harga_jual)}</TableCell>
                        <TableCell className="text-center font-bold">
                          <span className={b.stok === 0 ? "text-red-600" : b.peringatan ? "text-orange-600" : "text-green-700"}>{b.stok}</span>
                        </TableCell>
                        <TableCell className="text-center text-muted-foreground">{b.stok_minimum}</TableCell>
                        <TableCell className="text-center">
                          {b.stok === 0
                            ? <Badge className="bg-red-100 text-red-800 hover:bg-red-100"><AlertTriangle className="h-3 w-3 mr-1" />Stok Habis</Badge>
                            : b.peringatan
                              ? <Badge className="bg-orange-100 text-orange-800 hover:bg-orange-100"><AlertTriangle className="h-3 w-3 mr-1" />Hampir Habis</Badge>
                              : <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Aman</Badge>}
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-center gap-1">
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditBarang(b)} disabled={!lisensiAktif}>
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setDeleteBarangId(b.id)} disabled={!lisensiAktif}>
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
        </TabsContent>

        {/* Tab Riwayat Transaksi */}
        <TabsContent value="riwayat">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-wrap gap-3 items-center">
                <CardTitle className="text-base flex items-center gap-2"><RefreshCw className="h-4 w-4" /> Riwayat Transaksi</CardTitle>
                <div className="flex flex-wrap gap-2 ml-auto items-center">
                  <Input
                    placeholder="Cari nama barang..."
                    value={filterNama}
                    onChange={e => setFilterNama(e.target.value)}
                    className="w-44 h-9 text-sm"
                  />
                  <Select value={filterBulan} onValueChange={setFilterBulan}>
                    <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {BULAN_NAMES.map((n, i) => <SelectItem key={i + 1} value={String(i + 1)}>{n}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Select value={filterTahun} onValueChange={setFilterTahun}>
                    <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {tahunOptions.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {loadingTransaksi ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tanggal</TableHead>
                      <TableHead>Barang</TableHead>
                      <TableHead>Tipe</TableHead>
                      <TableHead className="text-right">Jumlah</TableHead>
                      <TableHead className="text-right">Harga Satuan</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead>Keterangan</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableSkeleton cols={8} />
                </Table>
              ) : transaksiFiltered.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Package className="h-10 w-10 mx-auto mb-3 opacity-30" />
                  <p>{transaksiList.length === 0 ? "Belum ada transaksi pada periode ini" : "Tidak ada hasil untuk pencarian ini"}</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tanggal</TableHead>
                      <TableHead>Barang</TableHead>
                      <TableHead>Tipe</TableHead>
                      <TableHead className="text-right">Jumlah</TableHead>
                      <TableHead className="text-right">Harga Satuan</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead>Keterangan</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transaksiFiltered.map(t => (
                      <TableRow key={t.id}>
                        <TableCell className="text-sm">{formatDate(t.tanggal)}</TableCell>
                        <TableCell className="font-medium">{t.nama_barang}</TableCell>
                        <TableCell>
                          <Badge className={t.tipe === "masuk"
                            ? "bg-green-100 text-green-800 hover:bg-green-100"
                            : "bg-red-100 text-red-800 hover:bg-red-100"}>
                            {t.tipe === "masuk" ? "Masuk" : "Keluar"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">{t.jumlah} {t.satuan}</TableCell>
                        <TableCell className="text-right text-sm">{formatRupiah(t.harga_satuan)}</TableCell>
                        <TableCell className={`text-right font-medium ${t.tipe === "masuk" ? "text-red-700" : "text-green-700"}`}>
                          {formatRupiah(t.total)}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{t.keterangan ?? "-"}</TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-red-600"
                            onClick={() => setDeleteTransaksiId(t.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                  <tfoot>
                    <TableRow className="bg-muted/50 font-semibold border-t-2">
                      <TableCell colSpan={3} className="text-sm text-muted-foreground">
                        Total ({transaksiFiltered.length} transaksi)
                      </TableCell>
                      <TableCell className="text-right text-sm">
                        <span className="text-green-700">+{totalMasukJumlah}</span>
                        {" / "}
                        <span className="text-red-700">-{totalKeluarJumlah}</span>
                      </TableCell>
                      <TableCell />
                      <TableCell className="text-right text-sm font-bold">{formatRupiah(totalNilai)}</TableCell>
                      <TableCell colSpan={2} />
                    </TableRow>
                  </tfoot>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Dialog Tambah/Edit Barang */}
      <Dialog open={barangDialog} onOpenChange={setBarangDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editBarang ? "Edit Barang" : "Tambah Barang Baru"}</DialogTitle>
          </DialogHeader>
          <Form {...barangForm}>
            <form onSubmit={barangForm.handleSubmit(v => simpanBarangMutation.mutate(v))} className="space-y-4">
              <FormField control={barangForm.control} name="nama" render={({ field }) => (
                <FormItem><FormLabel>Nama Barang</FormLabel>
                  <FormControl><Input placeholder="Beras Premium, Minyak Goreng, dll" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={barangForm.control} name="satuan" render={({ field }) => (
                <FormItem><FormLabel>Satuan</FormLabel>
                  <FormControl><Input placeholder="kg, pcs, sak, karung, liter" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={barangForm.control} name="kategori" render={({ field }) => (
                <FormItem><FormLabel>Kategori <span className="text-muted-foreground text-xs">(opsional)</span></FormLabel>
                  <Select
                    onValueChange={v => field.onChange(v === "__none__" ? "" : v)}
                    value={field.value ? field.value : "__none__"}
                  >
                    <FormControl>
                      <SelectTrigger><SelectValue placeholder="Pilih kategori..." /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="__none__">— Tanpa Kategori —</SelectItem>
                      {KATEGORI_OPTIONS.map(k => <SelectItem key={k} value={k}>{k}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <div className="grid grid-cols-2 gap-3">
                <FormField control={barangForm.control} name="harga_beli" render={({ field }) => (
                  <FormItem><FormLabel>Harga Beli (Rp)</FormLabel>
                    <FormControl><Input type="number" min={0} {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={barangForm.control} name="harga_jual" render={({ field }) => (
                  <FormItem><FormLabel>Harga Jual (Rp)</FormLabel>
                    <FormControl><Input type="number" min={0} {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                {!editBarang && (
                  <FormField control={barangForm.control} name="stok_awal" render={({ field }) => (
                    <FormItem><FormLabel>Stok Awal</FormLabel>
                      <FormControl><Input type="number" min={0} step="any" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                )}
                <FormField control={barangForm.control} name="stok_minimum" render={({ field }) => (
                  <FormItem><FormLabel>Stok Minimum</FormLabel>
                    <FormControl><Input type="number" min={0} step="any" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setBarangDialog(false)}>Batal</Button>
                <Button type="submit" disabled={simpanBarangMutation.isPending}>
                  {simpanBarangMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Simpan
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Dialog Transaksi Masuk / Keluar */}
      <Dialog open={transaksiDialog !== null} onOpenChange={(open) => { if (!open) setTransaksiDialog(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className={transaksiDialog === "masuk" ? "text-green-700" : "text-red-700"}>
              {transaksiDialog === "masuk" ? "📦 Barang Masuk (Beli)" : "📤 Barang Keluar (Jual)"}
            </DialogTitle>
          </DialogHeader>
          {transaksiDialog && (
            <Form {...transaksiForm}>
              <form onSubmit={transaksiForm.handleSubmit(v => transaksiMutation.mutate(v))} className="space-y-4">
                <FormField control={transaksiForm.control} name="barang_id" render={({ field }) => (
                  <FormItem><FormLabel>Barang</FormLabel>
                    <Select onValueChange={(v) => handleBarangChange(v, field.onChange)} value={field.value ? String(field.value) : ""}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Pilih barang" /></SelectTrigger></FormControl>
                      <SelectContent>
                        {barangList.map(b => (
                          <SelectItem key={b.id} value={String(b.id)}>
                            {b.nama} — stok: {b.stok} {b.satuan}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={transaksiForm.control} name="tanggal" render={({ field }) => (
                  <FormItem><FormLabel>Tanggal</FormLabel>
                    <FormControl><Input type="date" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <div className="grid grid-cols-2 gap-3">
                  <FormField control={transaksiForm.control} name="jumlah" render={({ field }) => (
                    <FormItem><FormLabel>Jumlah {selectedBarang ? `(${selectedBarang.satuan})` : ""}</FormLabel>
                      <FormControl><Input type="number" min={0.01} step="any" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={transaksiForm.control} name="harga_satuan" render={({ field }) => (
                    <FormItem><FormLabel>Harga Satuan (Rp)</FormLabel>
                      <FormControl><Input type="number" min={0} {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
                {transaksiForm.watch("jumlah") > 0 && transaksiForm.watch("harga_satuan") > 0 && (
                  <div className={`text-sm p-2 rounded-md ${transaksiDialog === "masuk" ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"}`}>
                    Total {transaksiDialog === "masuk" ? "pengeluaran" : "pemasukan"}: <strong>{formatRupiah(transaksiForm.watch("jumlah") * transaksiForm.watch("harga_satuan"))}</strong>
                    <span className="text-xs block mt-0.5">Otomatis dicatat di Keuangan</span>
                  </div>
                )}
                <FormField control={transaksiForm.control} name="keterangan" render={({ field }) => (
                  <FormItem><FormLabel>Keterangan <span className="text-muted-foreground text-xs">(opsional)</span></FormLabel>
                    <FormControl><Input placeholder="Catatan tambahan..." {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <div className="flex justify-end gap-2 pt-2">
                  <Button type="button" variant="outline" onClick={() => setTransaksiDialog(null)}>Batal</Button>
                  <Button type="submit" disabled={transaksiMutation.isPending}
                    className={transaksiDialog === "masuk" ? "bg-green-700 hover:bg-green-800" : "bg-red-700 hover:bg-red-800"}>
                    {transaksiMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    {transaksiDialog === "masuk" ? "Catat Masuk" : "Catat Keluar"}
                  </Button>
                </div>
              </form>
            </Form>
          )}
        </DialogContent>
      </Dialog>

      {/* Konfirmasi Hapus Barang */}
      <AlertDialog open={deleteBarangId !== null} onOpenChange={(open) => { if (!open) setDeleteBarangId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Barang?</AlertDialogTitle>
            <AlertDialogDescription>Barang hanya bisa dihapus jika belum punya riwayat transaksi.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive hover:bg-destructive/90"
              onClick={() => deleteBarangId !== null && hapusBarangMutation.mutate(deleteBarangId)}
              disabled={hapusBarangMutation.isPending}>
              {hapusBarangMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Konfirmasi Hapus Riwayat Transaksi */}
      <AlertDialog open={deleteTransaksiId !== null} onOpenChange={(open) => { if (!open) setDeleteTransaksiId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Riwayat Transaksi?</AlertDialogTitle>
            <AlertDialogDescription>
              Riwayat ini akan dihapus secara permanen. Stok barang akan dibalik secara otomatis, dan catatan keuangan terkait juga akan ikut dihapus.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={() => deleteTransaksiId !== null && hapusTransaksiMutation.mutate(deleteTransaksiId)}
              disabled={hapusTransaksiMutation.isPending}>
              {hapusTransaksiMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Ya, Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog Import Barang */}
      <Dialog open={importDialog} onOpenChange={(open) => { if (!open) { setImportDialog(false); setImportRows([]); setImportError(""); if (fileInputRef.current) fileInputRef.current.value = ""; } }}>
        <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5" /> Import Barang dari Excel / CSV
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 flex-1 overflow-y-auto">
            {/* Info kolom */}
            <div className="bg-muted/50 rounded-lg p-3 text-xs space-y-1">
              <p className="font-semibold">Kolom yang dibutuhkan:</p>
              <p className="text-muted-foreground">Nama*, Satuan*, Kategori, Harga Beli, Harga Jual, Stok Awal, Stok Minimum</p>
              <p className="text-muted-foreground text-[11px]">* wajib diisi. Baris tanpa Nama/Satuan akan dilewati.</p>
            </div>

            {/* Download template + Upload */}
            <div className="flex flex-wrap gap-2 items-center">
              <Button variant="outline" size="sm" onClick={downloadTemplate}>
                <FileSpreadsheet className="h-4 w-4 mr-1.5" /> Download Template
              </Button>
              <div className="flex-1 min-w-[200px]">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleFileUpload}
                  className="hidden"
                  id="import-file-input"
                />
                <label htmlFor="import-file-input">
                  <Button variant="outline" size="sm" asChild>
                    <span className="cursor-pointer">
                      <Upload className="h-4 w-4 mr-1.5" /> Pilih File Excel / CSV
                    </span>
                  </Button>
                </label>
              </div>
            </div>

            {importError && (
              <p className="text-sm text-destructive bg-destructive/10 rounded p-2">{importError}</p>
            )}

            {/* Preview tabel */}
            {importRows.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium">{importRows.length} baris ditemukan</p>
                  <Badge variant="secondary">{importRows.filter(r => r._valid).length} valid</Badge>
                  {importRows.some(r => !r._valid) && (
                    <Badge variant="destructive">{importRows.filter(r => !r._valid).length} dilewati</Badge>
                  )}
                </div>
                <div className="overflow-x-auto border rounded-lg max-h-64">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-6"></TableHead>
                        <TableHead>Nama</TableHead>
                        <TableHead>Satuan</TableHead>
                        <TableHead>Kategori</TableHead>
                        <TableHead className="text-right">H. Beli</TableHead>
                        <TableHead className="text-right">H. Jual</TableHead>
                        <TableHead className="text-right">Stok</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {importRows.map((row, i) => (
                        <TableRow key={i} className={!row._valid ? "opacity-40 bg-red-50" : ""}>
                          <TableCell>
                            {row._valid
                              ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                              : <span className="text-destructive text-xs">✕</span>}
                          </TableCell>
                          <TableCell className="font-medium text-sm">{row.nama || "—"}</TableCell>
                          <TableCell className="text-sm">{row.satuan || "—"}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{row.kategori || "—"}</TableCell>
                          <TableCell className="text-right text-sm">{formatRupiah(row.harga_beli)}</TableCell>
                          <TableCell className="text-right text-sm">{formatRupiah(row.harga_jual)}</TableCell>
                          <TableCell className="text-right text-sm">{row.stok_awal}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex gap-2 pt-2 border-t mt-2">
            <Button variant="outline" className="flex-1" onClick={() => setImportDialog(false)}>
              Batal
            </Button>
            <Button
              className="flex-1"
              disabled={importRows.filter(r => r._valid).length === 0 || importMutation.isPending}
              onClick={() => importMutation.mutate(importRows.filter(r => r._valid))}
            >
              {importMutation.isPending
                ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Mengimport...</>
                : <><Upload className="h-4 w-4 mr-2" />Import {importRows.filter(r => r._valid).length} Barang</>}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
