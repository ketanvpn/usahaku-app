import { useGetUsaha, getGetUsahaQueryKey } from "@workspace/api-client-react";
import { useAuth } from "@/hooks/use-auth";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ShoppingBag, HandCoins, Wallet, Package, Truck, Users } from "lucide-react";
import LaporanKasirTab from "@/components/laporan/laporan-kasir-tab";
import LaporanHutangTab from "@/components/laporan/laporan-hutang-tab";
import LaporanKeuanganTab from "@/components/laporan/laporan-keuangan-tab";
import LaporanStokTab from "@/components/laporan/laporan-stok-tab";
import LaporanSupplierTab from "@/components/laporan/laporan-supplier-tab";
import LaporanGajiTab from "@/components/laporan/laporan-gaji-tab";

export default function LaporanPage() {
  const { user } = useAuth();
  const { data: usahaData } = useGetUsaha(user?.usaha_id ?? 0, {
    query: { enabled: !!user?.usaha_id, queryKey: getGetUsahaQueryKey(user?.usaha_id ?? 0) },
  });

  const namaUsaha = usahaData?.nama_usaha ?? "Usahaku";
  const tanggalCetak = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "long", year: "numeric" }).format(new Date());

  return (
    <div className="space-y-6">
      <div className="page-hero">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary/75">Pusat Laporan</p>
          <h1 className="page-hero-title mt-2">Laporan</h1>
          <p className="page-hero-description">Laporan lengkap penjualan kasir, hutang, keuangan, stok barang, pembelian supplier, dan gaji tenaga kerja.</p>
        </div>
      </div>

      <Tabs defaultValue="kasir">
        <TabsList className="flex h-auto flex-wrap gap-1 bg-muted p-1 md:inline-flex md:flex-nowrap md:overflow-x-auto md:scrollbar-hide">
          <TabsTrigger value="kasir" className="gap-1.5 text-xs sm:text-sm"><ShoppingBag className="h-3.5 w-3.5 shrink-0" />Penjualan Kasir</TabsTrigger>
          <TabsTrigger value="hutang" className="gap-1.5 text-xs sm:text-sm"><HandCoins className="h-3.5 w-3.5 shrink-0" />Hutang</TabsTrigger>
          <TabsTrigger value="keuangan" className="gap-1.5 text-xs sm:text-sm"><Wallet className="h-3.5 w-3.5 shrink-0" />Keuangan</TabsTrigger>
          <TabsTrigger value="stok" className="gap-1.5 text-xs sm:text-sm"><Package className="h-3.5 w-3.5 shrink-0" />Stok</TabsTrigger>
          <TabsTrigger value="supplier" className="gap-1.5 text-xs sm:text-sm"><Truck className="h-3.5 w-3.5 shrink-0" />Supplier</TabsTrigger>
          <TabsTrigger value="gaji" className="gap-1.5 text-xs sm:text-sm"><Users className="h-3.5 w-3.5 shrink-0" />Gaji</TabsTrigger>
        </TabsList>

        <TabsContent value="kasir" className="space-y-4 mt-4">
          <LaporanKasirTab namaUsaha={namaUsaha} tanggalCetak={tanggalCetak} />
        </TabsContent>

        <TabsContent value="hutang" className="space-y-4 mt-4">
          <LaporanHutangTab namaUsaha={namaUsaha} tanggalCetak={tanggalCetak} />
        </TabsContent>

        <TabsContent value="keuangan" className="space-y-4 mt-4">
          <LaporanKeuanganTab namaUsaha={namaUsaha} tanggalCetak={tanggalCetak} />
        </TabsContent>

        <TabsContent value="stok" className="space-y-4 mt-4">
          <LaporanStokTab namaUsaha={namaUsaha} tanggalCetak={tanggalCetak} />
        </TabsContent>

        <TabsContent value="supplier" className="space-y-4 mt-4">
          <LaporanSupplierTab />
        </TabsContent>

        <TabsContent value="gaji" className="space-y-4 mt-4">
          <LaporanGajiTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
