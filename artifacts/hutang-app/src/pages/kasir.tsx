import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, Plus, Minus, Trash2, ShoppingCart, CheckCircle, Loader2, Receipt, Printer, Tag, History, ChevronDown, ChevronUp } from "lucide-react";
import { formatRupiah } from "@/lib/format";
import { useLicense } from "@/context/license-context";

function escHtml(s: string | number): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

function openPrintStruk(hasil: HasilTransaksi) {
  const tgl = new Date(hasil.tanggal + "T00:00:00").toLocaleDateString("id-ID", {
    day: "numeric", month: "long", year: "numeric",
  });
  const rows = hasil.items.map(i =>
    `<tr><td>${escHtml(i.nama_barang)}</td><td class="right">${escHtml(i.jumlah)} ${escHtml(i.satuan)}</td><td class="right">${fmt(i.harga_satuan)}</td><td class="right">${fmt(i.subtotal)}</td></tr>`
  ).join("");

  const diskonRow = hasil.diskon > 0
    ? `<tr><td colspan="3">Diskon</td><td class="right">-${fmt(hasil.diskon)}</td></tr>`
    : "";

  const html = `<!DOCTYPE html><html lang="id"><head><meta charset="UTF-8"/>
<style>
@page{size:80mm auto;margin:4mm 4mm}
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:monospace;font-size:11pt;color:#000;width:72mm}
.center{text-align:center}.right{text-align:right}
.bold{font-weight:bold}.sep{border-top:1px dashed #000;margin:4px 0}
table{width:100%;border-collapse:collapse}
td{padding:1px 2px;font-size:10pt}
.total td{font-weight:bold;font-size:11pt;border-top:1px solid #000;padding-top:3px}
</style>
<script>window.addEventListener('load',function(){setTimeout(function(){window.print();},400);})<\/script>
</head><body>
<div class="center bold" style="font-size:13pt">${escHtml(hasil.nama_usaha || "Usahaku")}</div>
<div class="center" style="font-size:9pt;margin-bottom:4px">by KetanTech</div>
<div class="sep"></div>
<div style="font-size:9pt">Tanggal : ${escHtml(tgl)}</div>
<div style="font-size:9pt">No      : #${escHtml(String(hasil.id).padStart(4,"0"))}</div>
<div class="sep"></div>
<table>
<thead><tr><td class="bold">Barang</td><td class="bold right">Qty</td><td class="bold right">Harga</td><td class="bold right">Sub</td></tr></thead>
<tbody>${rows}</tbody>
</table>
<div class="sep"></div>
<table>
${hasil.diskon > 0 ? `<tr><td>Subtotal</td><td class="right" colspan="3">${fmt(hasil.subtotal)}</td></tr>${diskonRow}` : ""}
<tr class="total"><td>TOTAL</td><td class="right bold" colspan="3">${fmt(hasil.total)}</td></tr>
<tr><td>Bayar</td><td class="right" colspan="3">${fmt(hasil.uang_bayar)}</td></tr>
<tr><td>Kembali</td><td class="right" colspan="3">${fmt(hasil.kembalian)}</td></tr>
</table>
<div class="sep"></div>
<div class="center" style="font-size:9pt;margin-top:4px">Terima kasih!</div>
</body></html>`;

  if (window.electronApp?.isElectron && typeof window.electronApp.openInBrowser === "function") {
    window.electronApp.openInBrowser(html);
  } else {
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank");
  }
}

function fmt(n: number) {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(n);
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
  catatan: string | null;
  created_at: string;
  items: Array<{ nama_barang: string; jumlah: number; satuan: string; subtotal: number }>;
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export default function KasirPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { lisensiAktif } = useLicense();

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

  const diskonAngka = parseFloat(diskonInput) || 0;
  const nominalDiskon = diskonMode === "persen"
    ? Math.min(subtotal * diskonAngka / 100, subtotal)
    : Math.min(diskonAngka, subtotal);

  const total = subtotal - nominalDiskon;
  const uangBayarNum = parseFloat(uangBayar.replace(/[^0-9]/g, "")) || 0;
  const kembalian = uangBayarNum - total;

  function tambahKeCart(barang: Barang) {
    setCart(prev => {
      const idx = prev.findIndex(i => i.barang.id === barang.id);
      if (idx >= 0) {
        const updated = [...prev];
        const maxQty = barang.stok;
        if (updated[idx].jumlah < maxQty) {
          updated[idx] = { ...updated[idx], jumlah: updated[idx].jumlah + 1 };
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
      if (baru <= 0) return i;
      if (baru > i.barang.stok) return i;
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
    setQtyInputs(prev => {
      const { [barangId]: _, ...rest } = prev;
      return rest;
    });
    setCart(prev => prev.map(i => {
      if (i.barang.id !== barangId) return i;
      const raw = qtyInputs[barangId];
      const angka = parseInt(raw ?? "", 10);
      if (isNaN(angka) || angka < 1) return { ...i, jumlah: 1 };
      if (angka > i.barang.stok) return { ...i, jumlah: i.barang.stok };
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

  return (
    <div className="flex flex-col md:flex-row gap-4 h-[calc(100vh-8rem)]">
      {/* Panel Kiri: Daftar Barang */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="mb-3 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Cari barang..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center flex-1 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin mr-2" /> Memuat...
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center flex-1 text-muted-foreground gap-2">
            <ShoppingCart className="h-10 w-10 opacity-30" />
            <p className="text-sm">{search ? "Barang tidak ditemukan" : "Belum ada barang dengan stok tersedia"}</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 gap-2 overflow-y-auto pr-1">
            {filtered.map(b => {
              const inCart = cart.find(i => i.barang.id === b.id);
              return (
                <Card
                  key={b.id}
                  onClick={() => tambahKeCart(b)}
                  className="cursor-pointer hover:border-primary hover:shadow-md transition-all select-none relative"
                >
                  <CardContent className="p-3">
                    {inCart && (
                      <Badge className="absolute top-2 right-2 bg-primary text-primary-foreground text-xs px-1.5">
                        {inCart.jumlah}
                      </Badge>
                    )}
                    <p className="font-medium text-sm leading-tight mb-1 pr-6 line-clamp-2">{b.nama}</p>
                    <p className="text-xs text-muted-foreground mb-2">Stok: {b.stok} {b.satuan}</p>
                    <p className="text-primary font-bold text-sm">{formatRupiah(b.harga_jual)}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Panel Kanan: Keranjang */}
      <div className="w-full md:w-80 lg:w-96 flex flex-col border rounded-lg bg-card">
        <div className="p-3 border-b">
          <h2 className="font-semibold flex items-center gap-2">
            <ShoppingCart className="h-4 w-4" />
            Keranjang
            {cart.length > 0 && (
              <Badge variant="secondary">{cart.length} item</Badge>
            )}
          </h2>
        </div>

        {/* Item Keranjang */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {cart.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Tap barang untuk menambahkan
            </p>
          ) : (
            cart.map(item => (
              <div key={item.barang.id} className="flex items-start gap-2 py-1.5 border-b last:border-0">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium leading-tight truncate">{item.barang.nama}</p>
                  <p className="text-xs text-muted-foreground">{formatRupiah(item.barang.harga_jual)} / {item.barang.satuan}</p>
                  <p className="text-xs font-semibold text-primary mt-0.5">
                    {formatRupiah(item.barang.harga_jual * item.jumlah)}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => ubahJumlah(item.barang.id, -1)}
                    className="w-6 h-6 rounded border flex items-center justify-center hover:bg-muted"
                  >
                    <Minus className="h-3 w-3" />
                  </button>
                  <input
                    type="number"
                    min={1}
                    max={item.barang.stok}
                    value={qtyInputs[item.barang.id] ?? item.jumlah}
                    onChange={e => setJumlahLangsung(item.barang.id, e.target.value)}
                    onFocus={e => e.target.select()}
                    onBlur={() => commitQtyInput(item.barang.id)}
                    className="w-14 text-center text-sm font-medium border rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-primary [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                  <button
                    onClick={() => ubahJumlah(item.barang.id, 1)}
                    disabled={item.jumlah >= item.barang.stok}
                    className="w-6 h-6 rounded border flex items-center justify-center hover:bg-muted disabled:opacity-40"
                  >
                    <Plus className="h-3 w-3" />
                  </button>
                  <button
                    onClick={() => hapusDariCart(item.barang.id)}
                    className="w-6 h-6 rounded flex items-center justify-center text-destructive hover:bg-destructive/10 ml-1"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Total & Pembayaran */}
        <div className="p-3 border-t space-y-2.5">
          {/* Diskon */}
          {cart.length > 0 && (
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-xs text-muted-foreground font-medium flex items-center gap-1">
                  <Tag className="h-3 w-3" /> Diskon
                </label>
                <div className="flex rounded overflow-hidden border text-xs">
                  <button
                    onClick={() => setDiskonMode("persen")}
                    className={`px-2 py-0.5 transition-colors ${diskonMode === "persen" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
                  >%</button>
                  <button
                    onClick={() => setDiskonMode("nominal")}
                    className={`px-2 py-0.5 transition-colors ${diskonMode === "nominal" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
                  >Rp</button>
                </div>
              </div>
              <Input
                placeholder={diskonMode === "persen" ? "0 %" : "0 Rupiah"}
                value={diskonInput}
                onChange={e => setDiskonInput(e.target.value)}
                type="number"
                min={0}
                max={diskonMode === "persen" ? 100 : undefined}
                className="text-sm"
              />
              {nominalDiskon > 0 && (
                <p className="text-xs text-emerald-600 text-right">Hemat {formatRupiah(nominalDiskon)}</p>
              )}
            </div>
          )}

          {/* Subtotal & Total */}
          {nominalDiskon > 0 && (
            <div className="flex justify-between items-center text-sm text-muted-foreground">
              <span>Subtotal</span>
              <span>{formatRupiah(subtotal)}</span>
            </div>
          )}
          <div className="flex justify-between items-center">
            <span className="font-semibold">Total</span>
            <span className="text-xl font-bold text-primary">{formatRupiah(total)}</span>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground font-medium">Uang Bayar</label>
            <Input
              placeholder="Masukkan nominal..."
              value={uangBayar}
              onChange={e => setUangBayar(e.target.value)}
              type="number"
              min={0}
              className="text-lg font-bold"
            />
          </div>

          {uangBayarNum > 0 && (
            <div className={`flex justify-between items-center rounded-md px-3 py-2 ${kembalian >= 0 ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
              <span className="text-sm font-medium">{kembalian >= 0 ? "Kembalian" : "Kurang"}</span>
              <span className="font-bold">{formatRupiah(Math.abs(kembalian))}</span>
            </div>
          )}

          <Input
            placeholder="Catatan (opsional)"
            value={catatan}
            onChange={e => setCatatan(e.target.value)}
            className="text-sm"
          />

          <Button
            className="w-full"
            size="lg"
            disabled={
              !lisensiAktif ||
              cart.length === 0 ||
              uangBayarNum < total ||
              total === 0 ||
              selesaikanMutation.isPending
            }
            onClick={() => selesaikanMutation.mutate()}
          >
            {selesaikanMutation.isPending ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Memproses...</>
            ) : (
              <><CheckCircle className="h-4 w-4 mr-2" />Selesaikan Transaksi</>
            )}
          </Button>
          {cart.length > 0 && total > 0 && uangBayarNum > 0 && uangBayarNum < total && (
            <p className="text-xs text-red-600 text-center -mt-1">
              Uang bayar kurang {formatRupiah(total - uangBayarNum)}
            </p>
          )}

          {cart.length > 0 && (
            <button
              onClick={resetKasir}
              className="w-full text-xs text-muted-foreground hover:text-destructive transition-colors"
            >
              Kosongkan keranjang
            </button>
          )}
        </div>
      </div>

      {/* Section Riwayat Penjualan */}
      <div className="mt-4 border rounded-lg overflow-hidden">
        <button
          className="w-full flex items-center justify-between px-4 py-3 bg-muted/50 hover:bg-muted transition-colors text-sm font-medium"
          onClick={() => setShowRiwayat(v => !v)}
        >
          <span className="flex items-center gap-2"><History className="h-4 w-4" /> Riwayat Penjualan (50 terakhir)</span>
          {showRiwayat ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
        {showRiwayat && (
          <div className="p-0">
            {riwayatList.length === 0 ? (
              <p className="text-center text-muted-foreground text-sm py-6">Belum ada transaksi.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">#</TableHead>
                    <TableHead>Tanggal</TableHead>
                    <TableHead>Item</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="w-16"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {riwayatList.map(t => (
                    <TableRow key={t.id}>
                      <TableCell className="text-muted-foreground text-xs">{String(t.id).padStart(4, "0")}</TableCell>
                      <TableCell className="text-sm">{new Date(t.tanggal + "T00:00:00").toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{t.items.map(i => `${i.nama_barang} ×${i.jumlah}`).join(", ")}</TableCell>
                      <TableCell className="text-right font-medium text-sm">{formatRupiah(t.total)}</TableCell>
                      <TableCell>
                        <Button
                          size="sm" variant="ghost"
                          className="h-7 w-7 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                          disabled={!lisensiAktif || hapusMutation.isPending}
                          onClick={() => setHapusId(t.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        )}
      </div>

      {/* Konfirmasi Hapus Transaksi */}
      <AlertDialog open={hapusId !== null} onOpenChange={(open) => { if (!open) setHapusId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Transaksi Kasir?</AlertDialogTitle>
            <AlertDialogDescription>
              Transaksi #{String(hapusId ?? 0).padStart(4, "0")} akan dihapus permanen. Data keuangan terkait juga ikut dihapus. Stok barang akan dikembalikan jika barang masih ada.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => { if (hapusId !== null) { hapusMutation.mutate(hapusId); setHapusId(null); } }}
            >
              Ya, Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Modal Hasil Transaksi */}
      <Dialog open={showHasil} onOpenChange={(open) => { if (!open) { setShowHasil(false); resetKasir(); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-emerald-700">
              <CheckCircle className="h-5 w-5" />
              Transaksi Berhasil!
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
                    <span>Uang Bayar</span>
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
                Stok dan keuangan otomatis terupdate
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => openPrintStruk(hasil)}
                >
                  <Printer className="h-4 w-4 mr-2" />
                  Cetak Struk
                </Button>
                <Button className="flex-1" onClick={() => { setShowHasil(false); resetKasir(); }}>
                  Transaksi Baru
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
