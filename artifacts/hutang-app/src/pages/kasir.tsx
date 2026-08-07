import { useState, useMemo, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, Plus, Minus, Trash2, ShoppingCart, CheckCircle, Loader2, Receipt, Printer, Tag, History, PackageOpen } from "lucide-react";
import { formatRupiah } from "@/lib/format";
import { useLicense } from "@/context/license-context";
import { usePengaturan, type Pengaturan } from "@/hooks/use-pengaturan";
import { useAuth } from "@/hooks/use-auth";
import { buildStrukHtml, loadLogoBase64ForPrint } from "@/lib/struk";

interface PrintStrukOptions {
  pengaturan?: Pengaturan;
  logoBase64?: string | null;
  alamatUsaha?: string | null;
  teleponUsaha?: string | null;
}

async function openPrintStruk(hasil: HasilTransaksi, opts: PrintStrukOptions = {}) {
  const html = buildStrukHtml(hasil, opts);

  if (window.electronApp?.isElectron && typeof window.electronApp.openInBrowser === "function") {
    await window.electronApp.openInBrowser(html);
  } else {
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank");
  }
}

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

interface Barang {
  id: number;
  nama: string;
  satuan: string;
  harga_jual: number;
  stok: number;
  peringatan: boolean;
}

interface CartItem {
  barang: Barang;
  jumlah: number;
}

interface HasilTransaksi {
  id: number;
  tanggal: string;
  nama_usaha: string;
  subtotal: number;
  diskon: number;
  total: number;
  uang_bayar: number;
  kembalian: number;
  items: Array<{ nama_barang: string; jumlah: number; satuan: string; harga_satuan: number; subtotal: number }>;
}

interface RiwayatTransaksi {
  id: number;
  tanggal: string;
  total: number;
  diskon: number;
  uang_bayar: number;
  kembalian: number;
  catatan: string | null;
  created_at: string;
  items: Array<{
    nama_barang: string;
    jumlah: number;
    satuan: string;
    harga_satuan: number;
    subtotal: number;
  }>;
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export default function KasirPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { lisensiAktif } = useLicense();
  const { user } = useAuth();
  const usahaId = user?.usaha_id ?? null;

  // Ambil pengaturan struk + data usaha untuk dipakai di header struk.
  const { data: pengaturan } = usePengaturan();
  const { data: usahaData } = useQuery({
    queryKey: ["usaha-mine", usahaId],
    enabled: !!usahaId,
    queryFn: async () => {
      const r = await fetch(`${BASE}/api/usaha/${usahaId}`, { credentials: "include" });
      if (!r.ok) return null;
      return r.json() as Promise<{
        id: number;
        nama_usaha: string;
        telepon: string | null;
        alamat: string | null;
      }>;
    },
  });

  // Wrapper async: load logo dari Electron, lalu call openPrintStruk dengan opsi.
  const handlePrintStruk = async (h: HasilTransaksi) => {
    let logoBase64: string | null = null;
    if (usahaId) {
      logoBase64 = await loadLogoBase64ForPrint(usahaId, pengaturan);
    }
    await openPrintStruk(h, {
      pengaturan,
      logoBase64,
      alamatUsaha: usahaData?.alamat ?? null,
      teleponUsaha: usahaData?.telepon ?? null,
    });
  };

  // Cetak ulang dari Riwayat: convert RiwayatTransaksi → HasilTransaksi.
  // Subtotal direkonstruksi (total + diskon) supaya struk hasil cetak ulang
  // menampilkan angka yang sama persis dengan struk pertama.
  const handlePrintRiwayat = async (t: RiwayatTransaksi) => {
    const subtotal = t.total + t.diskon;
    const namaUsaha = usahaData?.nama_usaha ?? "Usahaku";
    const hasil: HasilTransaksi = {
      id: t.id,
      tanggal: t.tanggal,
      nama_usaha: namaUsaha,
      subtotal,
      diskon: t.diskon,
      total: t.total,
      uang_bayar: t.uang_bayar,
      kembalian: t.kembalian,
      items: t.items,
    };
    await handlePrintStruk(hasil);
  };

  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [qtyInputs, setQtyInputs] = useState<Record<number, string>>({});
  const [uangBayar, setUangBayar] = useState("");
  const [catatan, setCatatan] = useState("");
  const [diskonInput, setDiskonInput] = useState("");
  const [diskonMode, setDiskonMode] = useState<"persen" | "nominal">("persen");
  const [hasil, setHasil] = useState<HasilTransaksi | null>(null);
  const [showHasil, setShowHasil] = useState(false);
  const [showRiwayat, setShowRiwayat] = useState(false);
  const [hapusId, setHapusId] = useState<number | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const bayarInputRef = useRef<HTMLInputElement | null>(null);

  const { data: riwayatList = [], refetch: refetchRiwayat } = useQuery<RiwayatTransaksi[]>({
    queryKey: ["kasir-riwayat"],
    queryFn: async () => {
      const r = await fetch(`${BASE}/api/kasir/transaksi`, { credentials: "include" });
      if (!r.ok) return [];
      return r.json();
    },
    enabled: showRiwayat,
  });

  const hapusMutation = useMutation({
    mutationFn: async (id: number) => {
      const r = await fetch(`${BASE}/api/kasir/transaksi/${id}`, { method: "DELETE", credentials: "include" });
      if (!r.ok) { const e = await r.json(); throw new Error(e.error || "Gagal menghapus"); }
    },
    onSuccess: () => {
      toast({ title: "Transaksi dihapus", description: "Riwayat, stok, dan keuangan telah diperbarui." });
      refetchRiwayat();
      queryClient.invalidateQueries({ queryKey: ["barang"] });
      queryClient.invalidateQueries({ queryKey: ["keuangan"] });
      queryClient.invalidateQueries({ queryKey: ["keuangan-rekap"] });
      queryClient.invalidateQueries({ queryKey: ["laporan-kasir-ringkasan"] });
      queryClient.invalidateQueries({ queryKey: ["laporan-kasir-harian"] });
      queryClient.invalidateQueries({ queryKey: ["laporan-kasir-bulanan"] });
      queryClient.invalidateQueries({ queryKey: ["laporan-kasir-top"] });
    },
    onError: (e: Error) => toast({ title: "Gagal", description: e.message, variant: "destructive" }),
  });

  const { data: barangList = [], isLoading } = useQuery<Barang[]>({
    queryKey: ["barang"],
    queryFn: async () => {
      const r = await fetch(`${BASE}/api/barang`, { credentials: "include" });
      if (!r.ok) throw new Error("Gagal memuat barang");
      return r.json();
    },
  });

  const filtered = useMemo(() =>
    barangList.filter(b =>
      b.nama.toLowerCase().includes(search.toLowerCase()) && b.stok > 0
    ), [barangList, search]);

  const subtotal = cart.reduce((s, i) => s + i.barang.harga_jual * i.jumlah, 0);

  const diskonAngka = diskonMode === "persen"
    ? (parseFloat(diskonInput) || 0)
    : (Number(diskonInput) || 0);
  const nominalDiskon = diskonMode === "persen"
    ? Math.min(subtotal * diskonAngka / 100, subtotal)
    : Math.min(diskonAngka, subtotal);

  const total = subtotal - nominalDiskon;
  const uangBayarNum = parseFloat(uangBayar.replace(/[^0-9]/g, "")) || 0;
  const kembalian = uangBayarNum - total;
  const quickBayar = [1000, 5000, 10000, 50000, 100000];

  function tambahKeCart(barang: Barang) {
    setCart(prev => {
      const idx = prev.findIndex(i => i.barang.id === barang.id);
      if (idx >= 0) {
        const updated = [...prev];
        if (updated[idx].jumlah < barang.stok) {
          updated[idx] = { ...updated[idx], jumlah: updated[idx].jumlah + 1 };
        } else {
          toast({ title: "Stok tidak cukup", description: `${barang.nama} tersisa ${barang.stok} ${barang.satuan}.`, variant: "destructive" });
        }
        return updated;
      }
      return [...prev, { barang, jumlah: 1 }];
    });
  }

  function ubahJumlah(barangId: number, delta: number) {
    setCart(prev => prev.map(i => {
      if (i.barang.id !== barangId) return i;
      const baru = i.jumlah + delta;
      if (baru <= 0 || baru > i.barang.stok) return i;
      return { ...i, jumlah: baru };
    }));
  }

  function setJumlahLangsung(barangId: number, nilai: string) {
    setQtyInputs(prev => ({ ...prev, [barangId]: nilai }));
    const angka = parseInt(nilai, 10);
    if (isNaN(angka)) return;
    setCart(prev => prev.map(i => {
      if (i.barang.id !== barangId) return i;
      if (angka < 1) return i;
      if (angka > i.barang.stok) return { ...i, jumlah: i.barang.stok };
      return { ...i, jumlah: angka };
    }));
  }

  function commitQtyInput(barangId: number) {
    setQtyInputs(prev => { const { [barangId]: _, ...rest } = prev; return rest; });
    setCart(prev => prev.map(i => {
      if (i.barang.id !== barangId) return i;
      const raw = qtyInputs[barangId];
      const angka = parseInt(raw ?? "", 10);
      if (isNaN(angka) || angka < 1) return { ...i, jumlah: 1 };
      if (angka > i.barang.stok) {
        toast({ title: "Stok tidak cukup", description: `${i.barang.nama} tersisa ${i.barang.stok} ${i.barang.satuan}.`, variant: "destructive" });
        return { ...i, jumlah: i.barang.stok };
      }
      return { ...i, jumlah: angka };
    }));
  }

  function hapusDariCart(barangId: number) {
    setCart(prev => prev.filter(i => i.barang.id !== barangId));
    setQtyInputs(prev => { const { [barangId]: _, ...rest } = prev; return rest; });
  }

  function resetKasir() {
    setCart([]);
    setQtyInputs({});
    setUangBayar("");
    setCatatan("");
    setDiskonInput("");
    setHasil(null);
  }

  const selesaikanMutation = useMutation({
    mutationFn: async () => {
      const body = {
        tanggal: todayStr(),
        items: cart.map(i => ({
          barang_id: i.barang.id,
          jumlah: i.jumlah,
          harga_satuan: i.barang.harga_jual,
        })),
        diskon: nominalDiskon,
        uang_bayar: uangBayarNum,
        catatan: catatan || undefined,
      };
      const r = await fetch(`${BASE}/api/kasir/transaksi`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      if (!r.ok) {
        const err = await r.json();
        throw new Error(err.error || "Transaksi gagal");
      }
      return r.json() as Promise<HasilTransaksi>;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["barang"] });
      queryClient.invalidateQueries({ queryKey: ["keuangan"] });
      queryClient.invalidateQueries({ queryKey: ["keuangan-rekap"] });
      queryClient.invalidateQueries({ queryKey: ["kasir-riwayat"] });
      queryClient.invalidateQueries({ queryKey: ["laporan-kasir-ringkasan"] });
      queryClient.invalidateQueries({ queryKey: ["laporan-kasir-harian"] });
      queryClient.invalidateQueries({ queryKey: ["laporan-kasir-bulanan"] });
      queryClient.invalidateQueries({ queryKey: ["laporan-kasir-top"] });
      setHasil(data);
      setShowHasil(true);
    },
    onError: (e: Error) => {
      toast({ title: "Gagal", description: e.message, variant: "destructive" });
    },
  });

  const canSubmit = lisensiAktif && cart.length > 0 && uangBayarNum >= total && total > 0 && !selesaikanMutation.isPending;

  useEffect(() => {
    searchInputRef.current?.focus();
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      const isTypingContext = tag === "input" || tag === "textarea" || target?.isContentEditable;

      if (e.key === "F2") {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
        return;
      }

      if (e.key === "F4") {
        e.preventDefault();
        bayarInputRef.current?.focus();
        bayarInputRef.current?.select();
        return;
      }

      if (e.key === "F9" || (e.ctrlKey && e.key === "Enter")) {
        if (canSubmit) {
          e.preventDefault();
          selesaikanMutation.mutate();
        }
        return;
      }

      if (e.key === "Escape") {
        if (hapusId !== null) setHapusId(null);
        else if (showHasil) setShowHasil(false);
        else if (showRiwayat) setShowRiwayat(false);
        else if (cart.length > 0) {
          if (confirm("Kosongkan keranjang belanja?")) {
            resetKasir();
          }
        }
        return;
      }

      if (e.key === "Enter" && target === searchInputRef.current) {
        e.preventDefault();
        if (filtered.length > 0) {
          tambahKeCart(filtered[0]);
        }
        return;
      }

      if (!isTypingContext && e.key.length === 1 && /[\w\d\s]/.test(e.key)) {
        searchInputRef.current?.focus();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [filtered, canSubmit, showHasil, showRiwayat, hapusId]);

  return (
    <div className="space-y-4">
      <div className="page-hero flex flex-col justify-between gap-3 lg:flex-row lg:items-center">
        <div>
          <h1 className="page-hero-title">Kasir</h1>
          <p className="page-hero-description">Transaksi cepat, pencarian barang, keranjang, diskon, pembayaran, dan cetak struk.</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="h-10 shrink-0 rounded-xl bg-white/70 gap-1.5"
          onClick={() => { setShowRiwayat(true); refetchRiwayat(); }}
        >
          <History className="h-4 w-4" />
          <span>Riwayat Penjualan</span>
        </Button>
      </div>

      <div className="flex flex-col gap-4 lg:flex-row lg:h-[calc(100vh-15rem)] lg:min-h-[560px]">

        {/* ── Panel Kiri: Daftar Barang ─────────────────────────────── */}
        <div className="flex-1 flex flex-col min-w-0 gap-3">

          {/* Header: search */}
          <div className="toolbar-card sticky top-0 z-10 p-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                ref={searchInputRef}
                placeholder="Cari barang atau scan barcode... (Tekan F2 untuk fokus)"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9 pr-14 h-10 rounded-xl bg-white/80"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold bg-muted px-1.5 py-0.5 rounded text-muted-foreground border">
                F2
              </span>
            </div>
          </div>

        {/* Keterangan jumlah barang */}
        {!isLoading && (
          <p className="text-xs text-muted-foreground -mt-1">
            {filtered.length} barang tersedia{search ? ` untuk "${search}"` : ""}
          </p>
        )}

        {/* Grid barang */}
        {isLoading ? (
          <div className="flex items-center justify-center flex-1 text-muted-foreground gap-2">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-sm">Memuat barang...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="empty-state flex-1">
            <PackageOpen className="h-12 w-12 opacity-20" />
            <p className="text-sm font-semibold">
              {search ? `Tidak ada barang yang cocok dengan "${search}"` : "Belum ada barang yang bisa dijual"}
            </p>
            {search && (
              <Button variant="ghost" size="sm" onClick={() => setSearch("")}>Reset pencarian</Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 gap-2.5 overflow-y-auto pr-1 content-start">
            {filtered.map(b => {
              const inCart = cart.find(i => i.barang.id === b.id);
              return (
                <Card
                  key={b.id}
                  onClick={() => tambahKeCart(b)}
                  className={`cursor-pointer transition-all duration-150 select-none relative group active:scale-[0.98] rounded-2xl ${
                    inCart
                      ? "border-primary bg-primary/5 shadow-md ring-1 ring-primary/20"
                      : "bg-card/90 hover:border-primary/60 hover:shadow-md hover:-translate-y-0.5"
                  }`}
                >
                  <CardContent className="p-3 flex flex-col gap-1.5 h-full">
                    {/* Badge jumlah di keranjang — di dalam batas kartu agar tidak terpotong */}
                    {inCart && (
                      <Badge className="absolute top-2 right-2 h-5 min-w-5 px-1.5 text-xs bg-primary text-primary-foreground shadow">
                        {inCart.jumlah}
                      </Badge>
                    )}

                    {/* Nama barang — dua baris, tidak terpotong secara tiba-tiba */}
                    <p className="font-semibold text-sm leading-snug line-clamp-2 min-h-[2.5rem]">
                      {b.nama}
                    </p>

                    {/* Stok */}
                    <p className="text-xs text-muted-foreground tabular-nums">
                      Stok: <span className="font-medium text-foreground">{b.stok}</span> {b.satuan}
                    </p>

                    {/* Harga — menonjol di bawah, tabular nums supaya digit rata */}
                    <p className="text-primary font-bold text-base mt-auto tabular-nums">
                      {formatRupiah(b.harga_jual)}
                    </p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Panel Kanan: Keranjang ────────────────────────────────── */}
        <div className="w-full lg:w-96 flex flex-col min-h-[560px] lg:min-h-0 data-card shrink-0 overflow-hidden">

        {/* Header keranjang */}
        <div className="px-4 py-3 border-b flex items-center justify-between">
          <h2 className="font-semibold flex items-center gap-2 text-base">
            <ShoppingCart className="h-4 w-4 text-primary" />
            Keranjang
          </h2>
          {cart.length > 0 && (
            <Badge variant="secondary" className="text-xs">{cart.length} item</Badge>
          )}
        </div>

        {/* Daftar item keranjang */}
        <div className="flex-1 min-h-0 overflow-y-auto px-4 py-2 space-y-0 divide-y">
          {cart.length === 0 ? (
            <div className="flex min-h-[180px] flex-col items-center justify-center text-muted-foreground gap-2 py-10">
              <ShoppingCart className="h-8 w-8 opacity-20" />
              <p className="text-sm">Klik barang untuk menambahkan</p>
            </div>
          ) : (
            cart.map(item => (
              <div key={item.barang.id} className="flex items-center gap-2 py-2.5 group/item">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium leading-snug truncate">{item.barang.nama}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 tabular-nums">
                    {formatRupiah(item.barang.harga_jual)} / {item.barang.satuan}
                  </p>
                  <p className="text-sm font-bold text-primary mt-0.5 tabular-nums">
                    {formatRupiah(item.barang.harga_jual * item.jumlah)}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => ubahJumlah(item.barang.id, -1)}
                    className="w-7 h-7 rounded-md border flex items-center justify-center hover:bg-muted active:scale-95 transition-all"
                    aria-label="Kurangi"
                  >
                    <Minus className="h-3.5 w-3.5" />
                  </button>
                  <input
                    type="number"
                    min={1}
                    max={item.barang.stok}
                    value={qtyInputs[item.barang.id] ?? item.jumlah}
                    onChange={e => setJumlahLangsung(item.barang.id, e.target.value)}
                    onFocus={e => e.target.select()}
                    onBlur={() => commitQtyInput(item.barang.id)}
                    className="w-12 h-7 text-center text-sm font-semibold tabular-nums border rounded-md px-1 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                  <button
                    onClick={() => ubahJumlah(item.barang.id, 1)}
                    disabled={item.jumlah >= item.barang.stok}
                    className="w-7 h-7 rounded-md border flex items-center justify-center hover:bg-muted active:scale-95 transition-all disabled:opacity-40 disabled:active:scale-100"
                    aria-label="Tambah"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => hapusDariCart(item.barang.id)}
                    className="w-7 h-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 active:scale-95 transition-all ml-0.5"
                    aria-label="Hapus item"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Total & Pembayaran */}
        <div className="px-4 py-2.5 border-t space-y-2.5 shrink-0">

          {/* Diskon */}
          {cart.length > 0 && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs text-muted-foreground font-medium flex items-center gap-1">
                  <Tag className="h-3 w-3" /> Diskon
                </label>
                <div className="flex rounded-md overflow-hidden border text-xs">
                  <button
                    onClick={() => { setDiskonMode("persen"); setDiskonInput(""); }}
                    className={`px-2.5 py-1 transition-colors font-medium ${diskonMode === "persen" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
                  >%</button>
                  <button
                    onClick={() => { setDiskonMode("nominal"); setDiskonInput(""); }}
                    className={`px-2.5 py-1 transition-colors font-medium ${diskonMode === "nominal" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
                  >Rp</button>
                </div>
              </div>
              {diskonMode === "persen" ? (
                <Input
                  placeholder="0 %"
                  value={diskonInput}
                  onChange={e => setDiskonInput(e.target.value)}
                  type="number"
                  min={0}
                  max={100}
                  className="text-sm h-8"
                />
              ) : (
                <CurrencyInput
                  placeholder="0"
                  value={diskonInput}
                  onValueChange={setDiskonInput}
                  minValue={0}
                  className="text-sm h-8"
                />
              )}
              {nominalDiskon > 0 && (
                <p className="text-xs text-emerald-600 text-right font-medium tabular-nums">Hemat {formatRupiah(nominalDiskon)}</p>
              )}
            </div>
          )}

          {/* Subtotal (hanya tampil jika ada diskon) */}
          {nominalDiskon > 0 && (
            <div className="flex justify-between items-center text-sm text-muted-foreground tabular-nums">
              <span>Subtotal</span>
              <span>{formatRupiah(subtotal)}</span>
            </div>
          )}

          {/* Total */}
          <div className="flex justify-between items-baseline py-1.5 border-t border-dashed">
            <span className="font-semibold text-sm">Total</span>
            <span className="text-2xl font-bold text-primary tabular-nums tracking-tight">{formatRupiah(total)}</span>
          </div>

          {/* Uang Bayar */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-xs text-muted-foreground font-medium">Uang Diterima</label>
              <span className="text-[10px] font-bold bg-muted px-1.5 py-0.5 rounded text-muted-foreground border">F4</span>
            </div>
            <CurrencyInput
              ref={bayarInputRef}
              placeholder="Masukkan nominal..."
              value={uangBayar}
              onValueChange={setUangBayar}
              minValue={0}
              className="text-lg font-bold h-10 tabular-nums"
            />
            <div className="flex flex-wrap gap-1 pt-1">
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="h-6 px-2 text-[11px]"
                onClick={() => setUangBayar(String(Math.max(0, Math.round(total))))}
                disabled={total <= 0}
              >
                Pas
              </Button>
              {quickBayar.map((nominal) => (
                <Button
                  key={nominal}
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-6 px-2 text-[11px]"
                    onClick={() => setUangBayar(String(uangBayarNum + nominal))}
                  >
                  +{nominal >= 1000 ? `${nominal / 1000}k` : String(nominal)}
                </Button>
              ))}
            </div>
          </div>

          {/* Kembalian / Kurang */}
          {uangBayarNum > 0 && (
            <div className={`flex justify-between items-center rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors ${
              kembalian >= 0 ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-red-50 text-red-600 border border-red-200"
            }`}>
              <span>{kembalian >= 0 ? "Kembalian" : "Kurang"}</span>
              <span className="text-base font-bold tabular-nums">{formatRupiah(Math.abs(kembalian))}</span>
            </div>
          )}

          {/* Catatan */}
          <Input
            placeholder="Catatan (opsional)"
            value={catatan}
            onChange={e => setCatatan(e.target.value)}
            className="text-sm h-8"
          />

          {/* Tombol Selesaikan */}
          <Button
            className="w-full h-11 text-base font-semibold shadow-lg shadow-primary/15"
            disabled={!canSubmit}
            onClick={() => selesaikanMutation.mutate()}
          >
            {selesaikanMutation.isPending ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Memproses...</>
            ) : (
              <div className="flex items-center justify-center gap-2">
                <CheckCircle className="h-4 w-4" />
                <span>Bayar Sekarang</span>
                <span className="text-[10px] font-bold bg-white/20 px-1.5 py-0.5 rounded ml-1">F9</span>
              </div>
            )}
          </Button>

          {cart.length > 0 && total > 0 && uangBayarNum > 0 && uangBayarNum < total && (
            <p className="text-xs text-red-500 text-center">
              Kurang {formatRupiah(total - uangBayarNum)}
            </p>
          )}

          {cart.length > 0 && (
            <button
              onClick={resetKasir}
              className="w-full text-xs text-muted-foreground hover:text-destructive transition-colors py-1"
            >
              Bersihkan keranjang
            </button>
          )}
        </div>
      </div>
      </div>

      {/* ── Dialog Riwayat Penjualan ──────────────────────────────── */}
      <Dialog open={showRiwayat} onOpenChange={setShowRiwayat}>
        <DialogContent aria-describedby={undefined} className="max-w-3xl max-h-[80vh] flex flex-col rounded-2xl border bg-card/95 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              Riwayat Penjualan (50 terakhir)
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto">
            {riwayatList.length === 0 ? (
              <p className="text-center text-muted-foreground text-sm py-10">Belum ada transaksi.</p>
            ) : (
              <Table className="table-premium">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-14">#</TableHead>
                    <TableHead>Tanggal</TableHead>
                    <TableHead>Item</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="w-20 text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {riwayatList.map(t => (
                    <TableRow key={t.id}>
                      <TableCell className="text-muted-foreground text-xs font-mono">
                        #{String(t.id).padStart(4, "0")}
                      </TableCell>
                      <TableCell className="text-sm whitespace-nowrap">
                        {new Date(t.tanggal + "T00:00:00").toLocaleDateString("id-ID", {
                          day: "numeric", month: "short", year: "numeric",
                        })}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-xs">
                        <span className="line-clamp-2">
                          {t.items.map(i => `${i.nama_barang} ×${i.jumlah}`).join(", ")}
                        </span>
                      </TableCell>
                      <TableCell className="text-right font-semibold text-sm whitespace-nowrap">
                        {formatRupiah(t.total)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-0.5">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0 text-muted-foreground hover:text-primary hover:bg-primary/10"
                            onClick={() => handlePrintRiwayat(t)}
                            title="Cetak ulang struk"
                          >
                            <Printer className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                            disabled={!lisensiAktif || hapusMutation.isPending}
                            onClick={() => setHapusId(t.id)}
                            title="Batalkan transaksi"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Konfirmasi Hapus Transaksi ────────────────────────────── */}
      <AlertDialog open={hapusId !== null} onOpenChange={(open) => { if (!open) setHapusId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Batalkan Transaksi Penjualan?</AlertDialogTitle>
            <AlertDialogDescription>
              Transaksi #{String(hapusId ?? 0).padStart(4, "0")} akan dibatalkan. Stok barang dan catatan keuangan akan dikembalikan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Kembali</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => { if (hapusId !== null) { hapusMutation.mutate(hapusId); setHapusId(null); } }}
            >
              Ya, Batalkan
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Modal Hasil Transaksi ─────────────────────────────────── */}
      <Dialog open={showHasil} onOpenChange={(open) => { if (!open) { setShowHasil(false); resetKasir(); } }}>
        <DialogContent aria-describedby={undefined} className="max-w-sm rounded-2xl border bg-card/95 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-emerald-700">
              <CheckCircle className="h-5 w-5" />
              Pembayaran Berhasil!
            </DialogTitle>
          </DialogHeader>
          {hasil && (
            <div className="space-y-3">
              <div className="bg-muted rounded-lg p-3 space-y-1.5 text-sm">
                {hasil.items.map((item, i) => (
                  <div key={i} className="flex justify-between">
                    <span className="text-muted-foreground">{item.nama_barang} × {item.jumlah} {item.satuan}</span>
                    <span className="font-medium">{formatRupiah(item.subtotal)}</span>
                  </div>
                ))}
                <div className="border-t pt-1.5 mt-1.5 space-y-1">
                  {hasil.diskon > 0 && (
                    <>
                      <div className="flex justify-between text-muted-foreground">
                        <span>Subtotal</span>
                        <span>{formatRupiah(hasil.subtotal)}</span>
                      </div>
                      <div className="flex justify-between text-emerald-600">
                        <span>Diskon</span>
                        <span>-{formatRupiah(hasil.diskon)}</span>
                      </div>
                    </>
                  )}
                  <div className="flex justify-between font-bold">
                    <span>Total</span>
                    <span className="text-primary">{formatRupiah(hasil.total)}</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>Uang Diterima</span>
                    <span>{formatRupiah(hasil.uang_bayar)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-emerald-700">
                    <span>Kembalian</span>
                    <span>{formatRupiah(hasil.kembalian)}</span>
                  </div>
                </div>
              </div>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Receipt className="h-3 w-3" />
                Stok dan catatan keuangan otomatis diperbarui
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => handlePrintStruk(hasil)}
                >
                  <Printer className="h-4 w-4 mr-2" />
                  Cetak Struk
                </Button>
                <Button className="flex-1" onClick={() => { setShowHasil(false); resetKasir(); }}>
                  Mulai Transaksi Baru
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
