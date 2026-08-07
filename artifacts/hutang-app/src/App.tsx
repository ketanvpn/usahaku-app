import { lazy, Suspense } from "react";
import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, ProtectedRoute } from "@/hooks/use-auth";
import { Layout } from "@/components/layout/Layout";
import { Spinner } from "@/components/ui/spinner";
import type { UserRole } from "@/hooks/use-auth";

// Eagerly loaded public & fallback pages
import LoginPage from "@/pages/login";
import SetupPage from "@/pages/setup";
import NotFound from "@/pages/not-found";

// Lazy-loaded Owner Pages (Code Splitting)
const DashboardPage = lazy(() => import("@/pages/dashboard"));
const PelangganPage = lazy(() => import("@/pages/pelanggan"));
const PelangganDetail = lazy(() => import("@/pages/pelanggan-detail"));
const HutangPage = lazy(() => import("@/pages/hutang"));
const HutangDetail = lazy(() => import("@/pages/hutang-detail"));
const PembayaranPage = lazy(() => import("@/pages/pembayaran"));
const LaporanPage = lazy(() => import("@/pages/laporan"));
const BackupPage = lazy(() => import("@/pages/backup"));
const LisensiPage = lazy(() => import("@/pages/lisensi"));
const KeuanganPage = lazy(() => import("@/pages/keuangan"));
const StokPage = lazy(() => import("@/pages/stok"));
const KasirPage = lazy(() => import("@/pages/kasir"));
const GajiTenagaPage = lazy(() => import("@/pages/gaji-tenaga"));
const PengaturanPage = lazy(() => import("@/pages/pengaturan"));
const SupplierPage = lazy(() => import("@/pages/supplier"));
const SupplierDetail = lazy(() => import("@/pages/supplier-detail"));
const ProfilPage = lazy(() => import("@/pages/profil"));

// Lazy-loaded Super Admin Pages
const AdminDashboardPage = lazy(() => import("@/pages/admin/dashboard"));
const AdminUsahaPage = lazy(() => import("@/pages/admin/usaha"));
const AdminOwnersPage = lazy(() => import("@/pages/admin/owners"));
const AdminLisensiPage = lazy(() => import("@/pages/admin/lisensi"));

interface AppRouteConfig {
  path: string;
  component: React.ComponentType;
  allowedRoles?: UserRole[];
}

const PROTECTED_ROUTES: AppRouteConfig[] = [
  // Owner Routes
  { path: "/dashboard", component: DashboardPage, allowedRoles: ["owner"] },
  { path: "/pelanggan", component: PelangganPage, allowedRoles: ["owner"] },
  { path: "/pelanggan/:id", component: PelangganDetail, allowedRoles: ["owner"] },
  { path: "/hutang", component: HutangPage, allowedRoles: ["owner"] },
  { path: "/hutang/:id", component: HutangDetail, allowedRoles: ["owner"] },
  { path: "/pembayaran", component: PembayaranPage, allowedRoles: ["owner"] },
  { path: "/laporan", component: LaporanPage, allowedRoles: ["owner"] },
  { path: "/backup", component: BackupPage, allowedRoles: ["owner"] },
  { path: "/lisensi", component: LisensiPage, allowedRoles: ["owner"] },
  { path: "/stok", component: StokPage, allowedRoles: ["owner"] },
  { path: "/supplier", component: SupplierPage, allowedRoles: ["owner"] },
  { path: "/supplier/:id", component: SupplierDetail, allowedRoles: ["owner"] },
  { path: "/kasir", component: KasirPage, allowedRoles: ["owner"] },
  { path: "/keuangan", component: KeuanganPage, allowedRoles: ["owner"] },
  { path: "/gaji-tenaga", component: GajiTenagaPage, allowedRoles: ["owner"] },
  { path: "/pengaturan", component: PengaturanPage, allowedRoles: ["owner"] },

  // Super Admin Routes
  { path: "/admin/dashboard", component: AdminDashboardPage, allowedRoles: ["super_admin"] },
  { path: "/admin/usaha", component: AdminUsahaPage, allowedRoles: ["super_admin"] },
  { path: "/admin/owners", component: AdminOwnersPage, allowedRoles: ["super_admin"] },
  { path: "/admin/lisensi", component: AdminLisensiPage, allowedRoles: ["super_admin"] },

  // Shared Protected Route (Owner & Super Admin)
  { path: "/profil", component: ProfilPage },
];

function PageLoadingFallback() {
  return (
    <div className="flex h-[50vh] w-full items-center justify-center">
      <Spinner className="h-8 w-8 text-primary" />
    </div>
  );
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function Router() {
  return (
    <Switch>
      {/* Public Pages */}
      <Route path="/setup" component={SetupPage} />
      <Route path="/login" component={LoginPage} />

      {/* Declarative Protected Routes with Shell Layout & Suspense Fallback */}
      {PROTECTED_ROUTES.map(({ path, component: Component, allowedRoles }) => (
        <Route key={path} path={path}>
          <ProtectedRoute allowedRoles={allowedRoles}>
            <Layout>
              <Suspense fallback={<PageLoadingFallback />}>
                <Component />
              </Suspense>
            </Layout>
          </ProtectedRoute>
        </Route>
      ))}

      {/* Root route: Role-based redirect via ProtectedRoute */}
      <Route path="/">
        <ProtectedRoute>
          <div />
        </ProtectedRoute>
      </Route>

      {/* 404 Fallback */}
      <Route component={NotFound} />
    </Switch>
  );
}

export default function App() {
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
