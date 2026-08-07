import { useEffect, useState } from "react";
import { useGetOwnerDashboard } from "@workspace/api-client-react";
import { useQuery } from "@tanstack/react-query";
import { formatRupiah, formatDate, formatRupiahShort, formatDateShort, formatDateRange, getBackupInfoText } from "@/lib/format";
import {
  fetchPeringatanStok,
  fetchTrenKeuangan,
  fetchKasirRingkasan,
  type BarangPeringatan,
  type TrenKeuanganItem,
  type KasirRingkasan,
} from "@/lib/api-dashboard";
import { PageHero } from "@/components/ui/page-hero";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, TrendingDown, TrendingUp, Users, Wallet, CreditCard, Activity, AlertTriangle, Package, BarChart2, ShoppingBag, Receipt } from "lucide-react";
import { Link } from "wouter";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from "recharts";

import type { TooltipProps } from "recharts";

const CustomTooltip = ({ active, payload, label }: TooltipProps<number, string>) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-border rounded-lg shadow-lg p-3 text-sm">
      <p className="font-semibold text-foreground mb-1">{label}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color }}>
          {p.name === "masuk" ? "▲ Masuk" : "▼ Keluar"}: {formatRupiah(p.value ?? 0)}
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
    queryFn: () => fetchPeringatanStok(),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  const { data: trenData = [], isLoading: trenLoading } = useQuery<TrenKeuanganItem[]>({
    queryKey: ["tren-keuangan", trenHari],
    queryFn: () => fetchTrenKeuangan(trenHari),
    staleTime: 45_000,
    refetchOnWindowFocus: false,
  });

  const { data: kasirStats } = useQuery<KasirRingkasan>({
    queryKey: ["dashboard-kasir-ringkasan"],
    queryFn: () => fetchKasirRingkasan(),
    staleTime: 45_000,
    refetchOnWindowFocus: false,
  });

  const chartData = trenData.map(d => ({
    ...d,
    label: formatDateShort(d.tanggal),
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
      <PageHero
        variant="featured"
        badge={
          <div className="inline-flex items-center gap-2 rounded-full bg-white/12 px-3 py-1 text-xs font-semibold text-emerald-50 ring-1 ring-white/15">
            <Activity className="h-3.5 w-3.5" />
            Ringkasan Bisnis
          </div>
        }
        title="Dashboard Usahaku"
        description="Pantau hutang, pembayaran, stok, penjualan kasir, dan backup dari satu tempat."
        actions={
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
        }
      >
        <p className="text-xs text-emerald-50/65">{backupInfo}</p>
      </PageHero>

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
        <StatCard
          title="Total Sisa Hutang"
          value={<span className="text-amber-600 dark:text-amber-400">{formatRupiah(data.sisa_hutang)}</span>}
          subtitle={`Dari ${data.jumlah_hutang_aktif} hutang aktif`}
          variant="warning"
          icon={<TrendingDown className="h-5 w-5" />}
        />
        <StatCard
          title="Total Sudah Dibayar"
          value={<span className="text-emerald-600 dark:text-emerald-400">{formatRupiah(data.total_dibayar)}</span>}
          subtitle={`${data.jumlah_hutang_lunas} hutang telah lunas`}
          variant="success"
          icon={<TrendingUp className="h-5 w-5" />}
        />
        <StatCard
          title="Total Hutang Tercatat"
          value={<span className="text-blue-600 dark:text-blue-400">{formatRupiah(data.total_hutang)}</span>}
          subtitle="Keseluruhan tercatat"
          variant="info"
          icon={<Wallet className="h-5 w-5" />}
        />
        <StatCard
          title="Pelanggan Berhutang"
          value={data.jumlah_pelanggan_berhutang}
          subtitle="Masih punya sisa hutang"
          variant="default"
          icon={<Users className="h-5 w-5" />}
        />
      </div>

      {/* Kasir Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2">
        <StatCard
          title="Penjualan Kasir Hari Ini"
          value={<span className="text-emerald-600 dark:text-emerald-400">{formatRupiah(kasirStats?.penjualan_hari_ini ?? 0)}</span>}
          subtitle={`${kasirStats?.transaksi_hari_ini ?? 0} transaksi hari ini`}
          variant="success"
          icon={<ShoppingBag className="h-5 w-5" />}
        />
        <StatCard
          title="Penjualan Kasir Bulan Ini"
          value={<span className="text-teal-600 dark:text-teal-400">{formatRupiah(kasirStats?.penjualan_bulan_ini ?? 0)}</span>}
          subtitle={`${kasirStats?.transaksi_bulan_ini ?? 0} transaksi bulan ini`}
          variant="info"
          icon={<Receipt className="h-5 w-5" />}
        />
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
                  Periode aktif: {formatDateRange(rangeStart)} - {formatDateRange(rangeEnd)}
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
                  tickFormatter={formatRupiahShort}
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
