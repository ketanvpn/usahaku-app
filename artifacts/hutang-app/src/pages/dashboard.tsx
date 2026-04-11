import { useState } from "react";
import { useGetOwnerDashboard } from "@workspace/api-client-react";
import { useQuery } from "@tanstack/react-query";
import { formatRupiah, formatDate } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, TrendingDown, TrendingUp, Users, Wallet, CreditCard, Activity, AlertTriangle, Package, BarChart2, ShoppingBag, Receipt } from "lucide-react";
import { Link } from "wouter";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from "recharts";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

interface BarangPeringatan {
  id: number;
  nama: string;
  satuan: string;
  stok: number;
  stok_minimum: number;
}

interface TrenItem {
  tanggal: string;
  masuk: number;
  keluar: number;
}

function fmtRupiahSingkat(value: number) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1).replace(".0", "")}jt`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(0)}rb`;
  return String(value);
}

function fmtTanggalPendek(iso: string) {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("id-ID", { day: "numeric", month: "short" });
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-border rounded-lg shadow-lg p-3 text-sm">
      <p className="font-semibold text-foreground mb-1">{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} style={{ color: p.color }}>
          {p.name === "masuk" ? "▲ Masuk" : "▼ Keluar"}: {formatRupiah(p.value)}
        </p>
      ))}
    </div>
  );
};

export default function OwnerDashboard() {
  const [trenHari, setTrenHari] = useState<7 | 30>(30);
  const { data, isLoading } = useGetOwnerDashboard();

  const { data: peringatanStok = [] } = useQuery<BarangPeringatan[]>({
    queryKey: ["barang-peringatan"],
    queryFn: async () => {
      const r = await fetch(`${BASE}/api/barang/peringatan`, { credentials: "include" });
      if (!r.ok) return [];
      return r.json();
    },
  });

  const { data: trenData = [], isLoading: trenLoading } = useQuery<TrenItem[]>({
    queryKey: ["tren-keuangan", trenHari],
    queryFn: async () => {
      const r = await fetch(`${BASE}/api/dashboard/tren-keuangan?hari=${trenHari}`, { credentials: "include" });
      if (!r.ok) return [];
      return r.json();
    },
  });

  const { data: kasirStats } = useQuery<{
    penjualan_hari_ini: number; transaksi_hari_ini: number;
    penjualan_bulan_ini: number; transaksi_bulan_ini: number;
  }>({
    queryKey: ["dashboard-kasir-ringkasan"],
    queryFn: async () => {
      const r = await fetch(`${BASE}/api/dashboard/kasir-ringkasan`, { credentials: "include" });
      if (!r.ok) return { penjualan_hari_ini: 0, transaksi_hari_ini: 0, penjualan_bulan_ini: 0, transaksi_bulan_ini: 0 };
      return r.json();
    },
  });

  const chartData = trenData.map(d => ({
    ...d,
    label: fmtTanggalPendek(d.tanggal),
  }));

  const totalMasuk = trenData.reduce((s, d) => s + (d.masuk || 0), 0);
  const totalKeluar = trenData.reduce((s, d) => s + (d.keluar || 0), 0);

  if (isLoading) {
    return (
      <div className="flex h-[50vh] w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-primary">Dashboard</h2>
          <p className="text-muted-foreground">Ringkasan bisnis Anda hari ini.</p>
        </div>
        <div className="flex gap-2">
          <Link href="/hutang" className="block">
            <Button variant="outline">Lihat Semua Hutang</Button>
          </Link>
          <Link href="/pembayaran" className="block">
            <Button>Catat Pembayaran</Button>
          </Link>
        </div>
      </div>

      {/* Peringatan stok */}
      {peringatanStok.length > 0 && (
        <div className="rounded-xl border-2 border-red-300 bg-red-50 dark:bg-red-950/20 p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="h-9 w-9 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
              <AlertTriangle className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <p className="font-bold text-red-700 dark:text-red-400">⚠️ Stok Menipis — Perlu Segera Restock!</p>
              <p className="text-xs text-red-600/80">{peringatanStok.length} barang di bawah stok minimum</p>
            </div>
            <Link href="/stok" className="ml-auto">
              <Button size="sm" variant="outline" className="border-red-400 text-red-700 hover:bg-red-100">
                Kelola Stok
              </Button>
            </Link>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {peringatanStok.map(b => {
              const pct = b.stok_minimum > 0 ? Math.min(100, Math.round((b.stok / b.stok_minimum) * 100)) : 0;
              return (
                <Link key={b.id} href="/stok">
                  <div className="rounded-lg bg-white dark:bg-red-900/20 border border-red-200 p-3 hover:shadow-sm transition-shadow cursor-pointer">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-sm text-foreground truncate">{b.nama}</span>
                      <Badge className="bg-red-100 text-red-700 hover:bg-red-100 text-xs ml-2 flex-shrink-0">Menipis</Badge>
                    </div>
                    <div className="text-xs text-muted-foreground mb-2">
                      Sisa: <strong className="text-red-600">{b.stok} {b.satuan}</strong> / Min: {b.stok_minimum} {b.satuan}
                    </div>
                    <div className="w-full bg-red-100 rounded-full h-1.5">
                      <div
                        className="bg-red-500 h-1.5 rounded-full transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="border-l-4 border-l-amber-500 shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Sisa Hutang</CardTitle>
            <div className="h-9 w-9 rounded-full bg-amber-100 flex items-center justify-center">
              <TrendingDown className="h-4 w-4 text-amber-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">{formatRupiah(data.sisa_hutang)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Dari <span className="font-semibold">{data.jumlah_hutang_aktif}</span> hutang aktif
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-emerald-500 shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Dibayar</CardTitle>
            <div className="h-9 w-9 rounded-full bg-emerald-100 flex items-center justify-center">
              <TrendingUp className="h-4 w-4 text-emerald-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">{formatRupiah(data.total_dibayar)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              <span className="font-semibold">{data.jumlah_hutang_lunas}</span> hutang telah lunas
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-blue-500 shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Hutang</CardTitle>
            <div className="h-9 w-9 rounded-full bg-blue-100 flex items-center justify-center">
              <Wallet className="h-4 w-4 text-blue-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{formatRupiah(data.total_hutang)}</div>
            <p className="text-xs text-muted-foreground mt-1">Keseluruhan tercatat</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-primary shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pelanggan Berhutang</CardTitle>
            <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center">
              <Users className="h-4 w-4 text-primary" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">{data.jumlah_pelanggan_berhutang}</div>
            <p className="text-xs text-muted-foreground mt-1">Pelanggan aktif</p>
          </CardContent>
        </Card>
      </div>

      {/* Kasir Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="border-l-4 border-l-emerald-500 shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Penjualan Kasir Hari Ini</CardTitle>
            <div className="h-9 w-9 rounded-full bg-emerald-100 flex items-center justify-center">
              <ShoppingBag className="h-4 w-4 text-emerald-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">{formatRupiah(kasirStats?.penjualan_hari_ini ?? 0)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              <span className="font-semibold">{kasirStats?.transaksi_hari_ini ?? 0}</span> transaksi hari ini
            </p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-teal-500 shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Penjualan Kasir Bulan Ini</CardTitle>
            <div className="h-9 w-9 rounded-full bg-teal-100 flex items-center justify-center">
              <Receipt className="h-4 w-4 text-teal-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-teal-600">{formatRupiah(kasirStats?.penjualan_bulan_ini ?? 0)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              <span className="font-semibold">{kasirStats?.transaksi_bulan_ini ?? 0}</span> transaksi bulan ini
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Chart Tren Keuangan */}
      <Card className="shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2">
                <BarChart2 className="h-5 w-5 text-primary" />
                Tren Keuangan
              </CardTitle>
              <CardDescription>
                Pemasukan vs pengeluaran {trenHari} hari terakhir
                {trenData.length > 0 && (
                  <span className="ml-2">
                    · <span className="text-emerald-600 font-medium">{formatRupiah(totalMasuk)} masuk</span>
                    {" · "}
                    <span className="text-red-500 font-medium">{formatRupiah(totalKeluar)} keluar</span>
                  </span>
                )}
              </CardDescription>
            </div>
            <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
              <Button
                size="sm" variant={trenHari === 7 ? "default" : "ghost"}
                className="h-7 text-xs px-3"
                onClick={() => setTrenHari(7)}
              >7 Hari</Button>
              <Button
                size="sm" variant={trenHari === 30 ? "default" : "ghost"}
                className="h-7 text-xs px-3"
                onClick={() => setTrenHari(30)}
              >30 Hari</Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {trenLoading ? (
            <div className="flex justify-center items-center h-48">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : chartData.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-muted-foreground gap-2">
              <BarChart2 className="h-10 w-10 opacity-30" />
              <p className="text-sm">Belum ada data keuangan dalam {trenHari} hari terakhir.</p>
              <Link href="/keuangan">
                <Button variant="outline" size="sm">Catat Keuangan</Button>
              </Link>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }} barCategoryGap="30%">
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(38 18% 87%)" />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11, fill: "hsl(215 15% 48%)" }}
                  tickLine={false}
                  axisLine={{ stroke: "hsl(38 18% 87%)" }}
                  interval={trenHari === 30 ? 4 : 0}
                />
                <YAxis
                  tickFormatter={fmtRupiahSingkat}
                  tick={{ fontSize: 11, fill: "hsl(215 15% 48%)" }}
                  tickLine={false}
                  axisLine={false}
                  width={48}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend
                  formatter={(value) => value === "masuk" ? "Pemasukan" : "Pengeluaran"}
                  wrapperStyle={{ fontSize: 12 }}
                />
                <Bar dataKey="masuk" fill="hsl(158 55% 38%)" radius={[4, 4, 0, 0]} name="masuk" maxBarSize={56} />
                <Bar dataKey="keluar" fill="hsl(0 65% 58%)" radius={[4, 4, 0, 0]} name="keluar" maxBarSize={56} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Tabel bawah */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-emerald-600" />
              Pembayaran Terbaru
            </CardTitle>
            <CardDescription>5 transaksi pembayaran terakhir</CardDescription>
          </CardHeader>
          <CardContent className="px-0 md:px-6">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Pelanggan</TableHead>
                    <TableHead>Tanggal</TableHead>
                    <TableHead className="text-right">Nominal</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.pembayaran_terbaru.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                        <div className="flex flex-col items-center gap-1">
                          <CreditCard className="h-7 w-7 opacity-25 mb-1" />
                          Belum ada pembayaran.
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    data.pembayaran_terbaru.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell className="font-medium">
                          <Link href={`/pelanggan/${p.pelanggan_id}`} className="hover:underline text-primary">
                            {p.pelanggan_nama}
                          </Link>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">{formatDate(p.tanggal_bayar)}</TableCell>
                        <TableCell className="text-right font-semibold text-emerald-600">
                          +{formatRupiah(p.nominal_bayar)}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-amber-600" />
              Hutang Terbesar
            </CardTitle>
            <CardDescription>5 sisa hutang aktif terbesar</CardDescription>
          </CardHeader>
          <CardContent className="px-0 md:px-6">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Pelanggan</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Sisa</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.hutang_terbesar.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                        <div className="flex flex-col items-center gap-1">
                          <Activity className="h-7 w-7 opacity-25 mb-1" />
                          Tidak ada hutang aktif.
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    data.hutang_terbesar.map((h) => (
                      <TableRow key={h.id}>
                        <TableCell className="font-medium">
                          <Link href={`/hutang/${h.id}`} className="hover:underline text-primary">
                            {h.pelanggan_nama}
                          </Link>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline"
                            className={h.status === "aktif"
                              ? "border-amber-300 bg-amber-50 text-amber-700"
                              : "border-emerald-300 bg-emerald-50 text-emerald-700"}>
                            {h.status === "aktif" ? "Aktif" : "Lunas"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-semibold text-amber-600">
                          {formatRupiah(h.sisa_hutang)}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
