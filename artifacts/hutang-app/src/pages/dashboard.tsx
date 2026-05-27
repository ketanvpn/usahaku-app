import { useEffect, useState } from "react";
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

function fmtTanggalRange(iso: string) {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}

function getBackupInfoText(): string {
  const last = localStorage.getItem("lastBackupDate");
  if (!last) return "Belum ada backup manual";
  const diffMs = Date.now() - new Date(last).getTime();
  if (Number.isNaN(diffMs) || diffMs < 0) return "Backup manual: baru saja";
  const minutes = Math.floor(diffMs / (1000 * 60));
  if (minutes < 1) return "Backup manual: baru saja";
  if (minutes < 60) return `Backup manual: ${minutes} menit lalu`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Backup manual: ${hours} jam lalu`;
  const days = Math.floor(hours / 24);
  return `Backup manual: ${days} hari lalu`;
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
  const [backupInfo, setBackupInfo] = useState<string>("Belum ada backup manual");
  const { data, isLoading } = useGetOwnerDashboard();

  useEffect(() => {
    const refreshBackupInfo = () => setBackupInfo(getBackupInfoText());

    refreshBackupInfo();
    const onFocus = () => refreshBackupInfo();
    const onVisibility = () => {
      if (!document.hidden) refreshBackupInfo();
    };
    const onStorage = (e: StorageEvent) => {
      if (e.key === "lastBackupDate") refreshBackupInfo();
    };
    const onBackupUpdated = () => refreshBackupInfo();
    const interval = window.setInterval(refreshBackupInfo, 60_000);

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("storage", onStorage);
    window.addEventListener("backup:updated", onBackupUpdated);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("backup:updated", onBackupUpdated);
    };
  }, []);

  const { data: peringatanStok = [] } = useQuery<BarangPeringatan[]>({
    queryKey: ["barang-peringatan"],
    queryFn: async () => {
      const r = await fetch(`${BASE}/api/barang/peringatan`, { credentials: "include" });
      if (!r.ok) return [];
      return r.json();
    },
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  const { data: trenData = [], isLoading: trenLoading } = useQuery<TrenItem[]>({
    queryKey: ["tren-keuangan", trenHari],
    queryFn: async () => {
      const r = await fetch(`${BASE}/api/dashboard/tren-keuangan?hari=${trenHari}`, { credentials: "include" });
      if (!r.ok) return [];
      return r.json();
    },
    staleTime: 45_000,
    refetchOnWindowFocus: false,
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
    staleTime: 45_000,
    refetchOnWindowFocus: false,
  });

  const chartData = trenData.map(d => ({
    ...d,
    label: fmtTanggalPendek(d.tanggal),
  }));

  const rangeStart = trenData.length > 0 ? trenData[0].tanggal : null;
  const rangeEnd = trenData.length > 0 ? trenData[trenData.length - 1].tanggal : null;

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
      <div className="relative overflow-hidden rounded-3xl border bg-gradient-to-br from-emerald-950 via-emerald-800 to-teal-700 p-6 text-white shadow-2xl shadow-emerald-950/20">
        <div className="absolute -right-20 -top-24 h-72 w-72 rounded-full bg-emerald-300/20 blur-3xl" />
        <div className="absolute -bottom-24 left-1/3 h-64 w-64 rounded-full bg-amber-200/14 blur-3xl" />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/12 px-3 py-1 text-xs font-semibold text-emerald-50 ring-1 ring-white/15">
              <Activity className="h-3.5 w-3.5" />
              Ringkasan Bisnis
            </div>
            <h2 className="text-3xl font-extrabold tracking-tight md:text-4xl">Dashboard Usahaku</h2>
            <p className="mt-2 max-w-2xl text-sm text-emerald-50/80">
              Pantau hutang, pembayaran, stok, penjualan kasir, dan backup dari satu tempat.
            </p>
            <p className="mt-3 text-xs text-emerald-50/65">{backupInfo}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/pembayaran" className="block">
              <Button className="bg-white text-emerald-900 hover:bg-emerald-50 shadow-lg shadow-emerald-950/20">Catat Pembayaran</Button>
            </Link>
            <Link href="/hutang" className="block">
              <Button variant="outline" className="border-white/30 bg-white/10 text-white hover:bg-white/20 hover:text-white">Hutang</Button>
            </Link>
            <Link href="/laporan" className="block">
              <Button variant="outline" className="border-white/30 bg-white/10 text-white hover:bg-white/20 hover:text-white">Laporan</Button>
            </Link>
            <Link href="/backup" className="block">
              <Button variant="outline" className="border-white/30 bg-white/10 text-white hover:bg-white/20 hover:text-white">Backup</Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Peringatan stok */}
      {peringatanStok.length > 0 && (
        <div className="rounded-2xl border border-red-200/80 bg-gradient-to-r from-red-50 to-amber-50 px-4 py-3 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <div className="grid h-8 w-8 place-items-center rounded-xl bg-red-100">
              <AlertTriangle className="h-4 w-4 text-red-600 flex-shrink-0" />
            </div>
            <p className="font-bold text-sm text-red-800">
              Peringatan Stok — {peringatanStok.length} barang perlu perhatian
            </p>
            <Link href="/stok" className="ml-auto">
              <Button size="sm" variant="ghost" className="h-8 rounded-xl text-xs text-red-700 hover:bg-red-100 px-3">
                Kelola Stok →
              </Button>
            </Link>
          </div>
          <div className="flex flex-wrap gap-2">
            {peringatanStok.map(b => {
              const habis = b.stok === 0;
              return (
                <Link key={b.id} href="/stok">
                  <Badge
                    variant="outline"
                    className={habis
                      ? "rounded-full border-gray-300 bg-white/80 px-3 py-1 text-gray-700 hover:bg-gray-100 cursor-pointer"
                      : "rounded-full border-amber-300 bg-white/80 px-3 py-1 text-amber-800 hover:bg-amber-100 cursor-pointer"}
                  >
                    <Package className="h-3 w-3 mr-1" />
                    {b.nama} —{" "}
                    {habis
                      ? <span className="font-bold">Stok Habis</span>
                      : <span>sisa {b.stok} {b.satuan}</span>
                    }
                  </Badge>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="premium-card overflow-hidden border-l-4 border-l-amber-500 shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Sisa Hutang</CardTitle>
            <div className="h-9 w-9 rounded-full bg-amber-100 flex items-center justify-center">
              <TrendingDown className="h-4 w-4 text-amber-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-extrabold text-amber-600">{formatRupiah(data.sisa_hutang)}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Dari <span className="font-semibold">{data.jumlah_hutang_aktif}</span> hutang yang belum lunas
              </p>
          </CardContent>
        </Card>

        <Card className="premium-card overflow-hidden border-l-4 border-l-emerald-500 shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Sudah Dibayar</CardTitle>
            <div className="h-9 w-9 rounded-full bg-emerald-100 flex items-center justify-center">
              <TrendingUp className="h-4 w-4 text-emerald-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-extrabold text-emerald-600">{formatRupiah(data.total_dibayar)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              <span className="font-semibold">{data.jumlah_hutang_lunas}</span> hutang telah lunas
            </p>
          </CardContent>
        </Card>

        <Card className="premium-card overflow-hidden border-l-4 border-l-blue-500 shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Hutang Tercatat</CardTitle>
            <div className="h-9 w-9 rounded-full bg-blue-100 flex items-center justify-center">
              <Wallet className="h-4 w-4 text-blue-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-extrabold text-blue-600">{formatRupiah(data.total_hutang)}</div>
            <p className="text-xs text-muted-foreground mt-1">Keseluruhan tercatat</p>
          </CardContent>
        </Card>

        <Card className="premium-card overflow-hidden border-l-4 border-l-primary shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pelanggan yang Masih Punya Hutang</CardTitle>
            <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center">
              <Users className="h-4 w-4 text-primary" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-extrabold text-primary">{data.jumlah_pelanggan_berhutang}</div>
            <p className="text-xs text-muted-foreground mt-1">Masih punya sisa hutang</p>
          </CardContent>
        </Card>
      </div>

      {/* Kasir Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="premium-card overflow-hidden border-l-4 border-l-emerald-500 shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Penjualan Kasir Hari Ini</CardTitle>
            <div className="h-9 w-9 rounded-full bg-emerald-100 flex items-center justify-center">
              <ShoppingBag className="h-4 w-4 text-emerald-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-extrabold text-emerald-600">{formatRupiah(kasirStats?.penjualan_hari_ini ?? 0)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              <span className="font-semibold">{kasirStats?.transaksi_hari_ini ?? 0}</span> transaksi hari ini
            </p>
          </CardContent>
        </Card>
        <Card className="premium-card overflow-hidden border-l-4 border-l-teal-500 shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Penjualan Kasir Bulan Ini</CardTitle>
            <div className="h-9 w-9 rounded-full bg-teal-100 flex items-center justify-center">
              <Receipt className="h-4 w-4 text-teal-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-extrabold text-teal-600">{formatRupiah(kasirStats?.penjualan_bulan_ini ?? 0)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              <span className="font-semibold">{kasirStats?.transaksi_bulan_ini ?? 0}</span> transaksi bulan ini
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Chart Tren Keuangan */}
      <Card className="premium-card overflow-hidden">
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
              {rangeStart && rangeEnd && (
                <p className="text-xs text-muted-foreground mt-1">
                  Periode aktif: {fmtTanggalRange(rangeStart)} - {fmtTanggalRange(rangeEnd)}
                </p>
              )}
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
        <Card className="premium-card overflow-hidden">
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
                          <Link href="/pembayaran">
                            <Button variant="outline" size="sm" className="mt-2">Catat Pembayaran</Button>
                          </Link>
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

        <Card className="premium-card overflow-hidden">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-amber-600" />
              Hutang Belum Lunas Terbesar
            </CardTitle>
            <CardDescription>5 sisa hutang terbesar yang belum lunas</CardDescription>
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
                          Tidak ada hutang yang belum lunas.
                          <Link href="/hutang">
                            <Button variant="outline" size="sm" className="mt-2">Lihat Hutang</Button>
                          </Link>
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
                            {h.status === "aktif" ? "Belum lunas" : "Lunas"}
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
