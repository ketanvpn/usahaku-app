import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Search, Plus, Minus, Trash2, ShoppingCart, CheckCircle, Loader2, Receipt } from "lucide-react";
import { formatRupiah } from "@/lib/format";

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
  total: number;
  uang_bayar: number;
  kembalian: number;
  items: Array<{ nama_barang: string; jumlah: number; satuan: string; harga_satuan: number; subtotal: number }>;
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export default function KasirPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [uangBayar, setUangBayar] = useState("");
  const [catatan, setCatatan] = useState("");
  const [hasil, setHasil] = useState<HasilTransaksi | null>(null);
  const [showHasil, setShowHasil] = useState(false);

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

  const total = cart.reduce((s, i) => s + i.barang.harga_jual * i.jumlah, 0);
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

  function hapusDariCart(barangId: number) {
    setCart(prev => prev.filter(i => i.barang.id !== barangId));
  }

  function resetKasir() {
    setCart([]);
    setUangBayar("");
    setCatatan("");
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
                  <span className="w-7 text-center text-sm font-medium">{item.jumlah}</span>
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
        <div className="p-3 border-t space-y-3">
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
              <Button className="w-full" onClick={() => { setShowHasil(false); resetKasir(); }}>
                Transaksi Baru
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
