import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";

import { AuthProvider, ProtectedRoute } from "@/hooks/use-auth";
import { Layout } from "@/components/layout/Layout";

// Pages
import LoginPage from "@/pages/login";
import SetupPage from "@/pages/setup";
import DashboardPage from "@/pages/dashboard";
import PelangganPage from "@/pages/pelanggan";
import PelangganDetail from "@/pages/pelanggan-detail";
import HutangPage from "@/pages/hutang";
import HutangDetail from "@/pages/hutang-detail";
import PembayaranPage from "@/pages/pembayaran";
import LaporanPage from "@/pages/laporan";
import BackupPage from "@/pages/backup";
import ProfilPage from "@/pages/profil";
import AdminDashboardPage from "@/pages/admin/dashboard";
import AdminUsahaPage from "@/pages/admin/usaha";
import AdminOwnersPage from "@/pages/admin/owners";
import AdminLisensiPage from "@/pages/admin/lisensi";
import LisensiPage from "@/pages/lisensi";
import KeuanganPage from "@/pages/keuangan";
import StokPage from "@/pages/stok";
import KasirPage from "@/pages/kasir";
import GajiTenagaPage from "@/pages/gaji-tenaga";
import PengaturanPage from "@/pages/pengaturan";

const queryClient = new QueryClient();

function Router() {
  return (
    <Switch>
      <Route path="/setup" component={SetupPage} />
      <Route path="/login" component={LoginPage} />
      
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

      <Route component={NotFound} />
    </Switch>
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
