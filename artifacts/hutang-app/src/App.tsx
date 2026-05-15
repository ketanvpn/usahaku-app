import { lazy, Suspense } from "react";
import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";

import { AuthProvider, ProtectedRoute } from "@/hooks/use-auth";
import { Layout } from "@/components/layout/Layout";

// Pages — semua di-lazy load supaya bundle awal kecil dan pindah halaman tidak
// membaca seluruh kode app sekaligus. v1.1.2: pemecahan code-split per route.
const NotFound = lazy(() => import("@/pages/not-found"));
const LoginPage = lazy(() => import("@/pages/login"));
const SetupPage = lazy(() => import("@/pages/setup"));
const DashboardPage = lazy(() => import("@/pages/dashboard"));
const PelangganPage = lazy(() => import("@/pages/pelanggan"));
const PelangganDetail = lazy(() => import("@/pages/pelanggan-detail"));
const HutangPage = lazy(() => import("@/pages/hutang"));
const HutangDetail = lazy(() => import("@/pages/hutang-detail"));
const PembayaranPage = lazy(() => import("@/pages/pembayaran"));
const LaporanPage = lazy(() => import("@/pages/laporan"));
const BackupPage = lazy(() => import("@/pages/backup"));
const ProfilPage = lazy(() => import("@/pages/profil"));
const AdminDashboardPage = lazy(() => import("@/pages/admin/dashboard"));
const AdminUsahaPage = lazy(() => import("@/pages/admin/usaha"));
const AdminOwnersPage = lazy(() => import("@/pages/admin/owners"));
const AdminLisensiPage = lazy(() => import("@/pages/admin/lisensi"));
const LisensiPage = lazy(() => import("@/pages/lisensi"));
const KeuanganPage = lazy(() => import("@/pages/keuangan"));
const StokPage = lazy(() => import("@/pages/stok"));
const KasirPage = lazy(() => import("@/pages/kasir"));
const GajiTenagaPage = lazy(() => import("@/pages/gaji-tenaga"));
const PengaturanPage = lazy(() => import("@/pages/pengaturan"));
const SupplierPage = lazy(() => import("@/pages/supplier"));
const SupplierDetail = lazy(() => import("@/pages/supplier-detail"));

const queryClient = new QueryClient();

function PageFallback() {
  return (
    <div className="flex justify-center items-center min-h-[60vh]">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
}

function Router() {
  return (
    <Suspense fallback={<PageFallback />}>
      <Switch>
        <Route path="/setup"><SetupPage /></Route>
        <Route path="/login"><LoginPage /></Route>

        {/* Protected Owner Routes */}
        <Route path="/dashboard">
          <ProtectedRoute allowedRoles={["owner"]}>
            <Layout><DashboardPage /></Layout>
          </ProtectedRoute>
        </Route>
        <Route path="/pelanggan">
          <ProtectedRoute allowedRoles={["owner"]}>
            <Layout><PelangganPage /></Layout>
          </ProtectedRoute>
        </Route>
        <Route path="/pelanggan/:id">
          <ProtectedRoute allowedRoles={["owner"]}>
            <Layout><PelangganDetail /></Layout>
          </ProtectedRoute>
        </Route>
        <Route path="/hutang">
          <ProtectedRoute allowedRoles={["owner"]}>
            <Layout><HutangPage /></Layout>
          </ProtectedRoute>
        </Route>
        <Route path="/hutang/:id">
          <ProtectedRoute allowedRoles={["owner"]}>
            <Layout><HutangDetail /></Layout>
          </ProtectedRoute>
        </Route>
        <Route path="/pembayaran">
          <ProtectedRoute allowedRoles={["owner"]}>
            <Layout><PembayaranPage /></Layout>
          </ProtectedRoute>
        </Route>
        <Route path="/laporan">
          <ProtectedRoute allowedRoles={["owner"]}>
            <Layout><LaporanPage /></Layout>
          </ProtectedRoute>
        </Route>
        <Route path="/backup">
          <ProtectedRoute allowedRoles={["owner"]}>
            <Layout><BackupPage /></Layout>
          </ProtectedRoute>
        </Route>
        <Route path="/lisensi">
          <ProtectedRoute allowedRoles={["owner"]}>
            <Layout><LisensiPage /></Layout>
          </ProtectedRoute>
        </Route>
        <Route path="/stok">
          <ProtectedRoute allowedRoles={["owner"]}>
            <Layout><StokPage /></Layout>
          </ProtectedRoute>
        </Route>
        <Route path="/supplier">
          <ProtectedRoute allowedRoles={["owner"]}>
            <Layout><SupplierPage /></Layout>
          </ProtectedRoute>
        </Route>
        <Route path="/supplier/:id">
          <ProtectedRoute allowedRoles={["owner"]}>
            <Layout><SupplierDetail /></Layout>
          </ProtectedRoute>
        </Route>
        <Route path="/kasir">
          <ProtectedRoute allowedRoles={["owner"]}>
            <Layout><KasirPage /></Layout>
          </ProtectedRoute>
        </Route>
        <Route path="/keuangan">
          <ProtectedRoute allowedRoles={["owner"]}>
            <Layout><KeuanganPage /></Layout>
          </ProtectedRoute>
        </Route>
        <Route path="/gaji-tenaga">
          <ProtectedRoute allowedRoles={["owner"]}>
            <Layout><GajiTenagaPage /></Layout>
          </ProtectedRoute>
        </Route>
        <Route path="/pengaturan">
          <ProtectedRoute allowedRoles={["owner"]}>
            <Layout><PengaturanPage /></Layout>
          </ProtectedRoute>
        </Route>

        {/* Protected Admin Routes */}
        <Route path="/admin/dashboard">
          <ProtectedRoute allowedRoles={["super_admin"]}>
            <Layout><AdminDashboardPage /></Layout>
          </ProtectedRoute>
        </Route>
        <Route path="/admin/usaha">
          <ProtectedRoute allowedRoles={["super_admin"]}>
            <Layout><AdminUsahaPage /></Layout>
          </ProtectedRoute>
        </Route>
        <Route path="/admin/owners">
          <ProtectedRoute allowedRoles={["super_admin"]}>
            <Layout><AdminOwnersPage /></Layout>
          </ProtectedRoute>
        </Route>
        <Route path="/admin/lisensi">
          <ProtectedRoute allowedRoles={["super_admin"]}>
            <Layout><AdminLisensiPage /></Layout>
          </ProtectedRoute>
        </Route>

        {/* Shared Protected Route */}
        <Route path="/profil">
          <ProtectedRoute>
            <Layout><ProfilPage /></Layout>
          </ProtectedRoute>
        </Route>

        {/* Root redirects via ProtectedRoute */}
        <Route path="/">
          <ProtectedRoute>
            {/* Will redirect based on role in ProtectedRoute */}
            <div />
          </ProtectedRoute>
        </Route>

        <Route><NotFound /></Route>
      </Switch>
    </Suspense>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
        <AuthProvider>
          <TooltipProvider>
            <Router />
            <Toaster />
          </TooltipProvider>
        </AuthProvider>
      </WouterRouter>
    </QueryClientProvider>
  );
}

export default App;
