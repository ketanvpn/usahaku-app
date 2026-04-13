import { ReactNode, useState, useEffect } from "react";
import { UpdateBanner } from "./UpdateBanner";
import { Link, useLocation } from "wouter";
import { 
  LayoutDashboard, 
  Users, 
  WalletCards, 
  CreditCard, 
  FileText, 
  DatabaseBackup, 
  UserCircle,
  Building2,
  LogOut,
  Menu,
  KeyRound,
  ShieldCheck,
  BookOpen,
  Package,
  ShoppingBag,
  RefreshCw,
  X,
  ShieldAlert,
  ShieldOff
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { useLogout } from "@workspace/api-client-react";
import { useQuery } from "@tanstack/react-query";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

interface LicenseStatus {
  aktif: boolean;
  sisa_hari: number;
  expires_at: string | null;
  jam_dimanipulasi?: boolean;
}
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet";

type NavLink = { href: string; label: string; icon: React.ElementType };
type NavGroup = { label: string; links: NavLink[] };

export function Layout({ children }: { children: ReactNode }) {
  const { isSuperAdmin, logout } = useAuth();
  const [location] = useLocation();
  const logoutMutation = useLogout();
  const [appVersion, setAppVersion] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [checkResult, setCheckResult] = useState<string | null>(null);
  const [backupReminderDismissed, setBackupReminderDismissed] = useState(false);
  const [daysWithoutBackup, setDaysWithoutBackup] = useState<number | null>(null);

  const { data: licenseStatus } = useQuery<LicenseStatus>({
    queryKey: ["lisensi-status"],
    queryFn: async () => {
      const r = await fetch(`${BASE}/api/lisensi/status`, { credentials: "include" });
      if (!r.ok) throw new Error("Gagal");
      return r.json();
    },
    enabled: !isSuperAdmin,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const showLisensiBanner = !isSuperAdmin && licenseStatus && location !== "/lisensi";
  const lisensiNearExpiry = licenseStatus?.aktif && (licenseStatus?.sisa_hari ?? 0) <= 7;
  const lisensiMati = licenseStatus && !licenseStatus.aktif;

  useEffect(() => {
    window.electronApp?.getVersion().then(setAppVersion).catch(() => {});
  }, []);

  useEffect(() => {
    const lastBackup = localStorage.getItem("lastBackupDate");
    if (!lastBackup) {
      setDaysWithoutBackup(999);
      return;
    }
    const selisih = Math.floor((Date.now() - new Date(lastBackup).getTime()) / (1000 * 60 * 60 * 24));
    if (selisih >= 7) setDaysWithoutBackup(selisih);
  }, []);

  const handleCheckUpdate = async () => {
    if (!window.electronApp?.update?.checkNow) return;
    setChecking(true);
    setCheckResult(null);
    try {
      await window.electronApp.update.checkNow();
      // Tunggu sebentar lalu cek status terbaru
      setTimeout(async () => {
        const status = await window.electronApp?.update?.getStatus();
        if (status?.status === "not-available") {
          setCheckResult("Aplikasi sudah versi terbaru");
        }
        setChecking(false);
      }, 3000);
    } catch {
      setChecking(false);
      setCheckResult("Gagal cek pembaruan");
    }
  };

  const handleLogout = () => {
    logoutMutation.mutate(undefined, { onSuccess: () => logout() });
  };

  const ownerGroups: NavGroup[] = [
    {
      label: "UTAMA",
      links: [
        { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      ],
    },
    {
      label: "TRANSAKSI",
      links: [
        { href: "/pelanggan", label: "Pelanggan", icon: Users },
        { href: "/hutang", label: "Hutang", icon: WalletCards },
        { href: "/pembayaran", label: "Pembayaran", icon: CreditCard },
      ],
    },
    {
      label: "BISNIS",
      links: [
        { href: "/kasir", label: "Kasir", icon: ShoppingBag },
        { href: "/stok", label: "Stok Barang", icon: Package },
        { href: "/keuangan", label: "Keuangan", icon: BookOpen },
      ],
    },
    {
      label: "LAPORAN",
      links: [
        { href: "/laporan", label: "Laporan", icon: FileText },
      ],
    },
    {
      label: "SISTEM",
      links: [
        { href: "/backup", label: "Backup & Restore", icon: DatabaseBackup },
        { href: "/lisensi", label: "Lisensi", icon: ShieldCheck },
        { href: "/profil", label: "Profil", icon: UserCircle },
      ],
    },
  ];

  const adminLinks: NavLink[] = [
    { href: "/admin/dashboard", label: "Dashboard Global", icon: LayoutDashboard },
    { href: "/admin/usaha", label: "Daftar Usaha", icon: Building2 },
    { href: "/admin/owners", label: "Kelola Owner", icon: Users },
    { href: "/admin/lisensi", label: "Lisensi Key", icon: KeyRound },
    { href: "/profil", label: "Profil", icon: UserCircle },
  ];

  const renderLink = (link: NavLink) => {
    const isActive = location === link.href || location.startsWith(`${link.href}/`);
    const Icon = link.icon;
    return (
      <Link key={link.href} href={link.href}>
        <div className={`flex items-center gap-3 px-3 py-2 rounded-md transition-colors cursor-pointer ${
          isActive
            ? "bg-primary text-primary-foreground font-medium"
            : "text-muted-foreground hover:bg-muted hover:text-foreground"
        }`}>
          <Icon className="h-5 w-5" />
          <span>{link.label}</span>
        </div>
      </Link>
    );
  };

  const NavLinks = () => (
    <div className="py-3 space-y-1">
      {isSuperAdmin ? (
        <div className="space-y-1 px-0">
          {adminLinks.map(renderLink)}
        </div>
      ) : (
        ownerGroups.map((group) => (
          <div key={group.label} className="mb-1">
            <p className="px-3 pt-3 pb-1 text-[10px] font-semibold tracking-widest text-muted-foreground/60 uppercase">
              {group.label}
            </p>
            {group.links.map(renderLink)}
          </div>
        ))
      )}
      <div className="pt-3 mt-2 border-t mx-3 space-y-1">
        {window.electronApp && (
          <div className="px-3 py-2">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted-foreground">
                Versi {appVersion ?? "..."}
              </span>
            </div>
            <button
              onClick={handleCheckUpdate}
              disabled={checking}
              className="flex w-full items-center gap-2 text-xs text-muted-foreground hover:text-primary transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${checking ? "animate-spin" : ""}`} />
              <span>{checking ? "Memeriksa..." : "Cek Pembaruan"}</span>
            </button>
            {checkResult && (
              <p className="text-xs text-muted-foreground/70 mt-1 pl-5">{checkResult}</p>
            )}
          </div>
        )}
        <button
          onClick={handleLogout}
          disabled={logoutMutation.isPending}
          className="flex w-full items-center gap-3 px-3 py-2 rounded-md transition-colors text-destructive hover:bg-destructive/10 cursor-pointer"
        >
          <LogOut className="h-5 w-5" />
          <span>Keluar</span>
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background flex">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-64 border-r bg-card no-print fixed h-full z-10">
        <div className="p-4 border-b h-16 flex items-center">
          <div>
            <h1 className="text-xl font-bold text-primary tracking-tight">Usahaku</h1>
            <p className="text-[10px] text-muted-foreground leading-tight">by KetanTech</p>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-3 py-2">
          <NavLinks />
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col md:pl-64 min-w-0">
        <UpdateBanner />
        {/* Banner status lisensi */}
        {showLisensiBanner && lisensiMati && (
          <div className="flex items-center gap-3 px-4 py-2 bg-red-50 border-b border-red-200 text-red-800 text-sm no-print">
            <ShieldOff className="h-4 w-4 flex-shrink-0 text-red-600" />
            <span className="flex-1">
              Lisensi tidak aktif — fitur tambah, edit, dan hapus data tidak tersedia.
            </span>
            <Link href="/lisensi">
              <Button size="sm" variant="outline" className="h-7 text-xs border-red-400 text-red-700 hover:bg-red-100 flex-shrink-0">
                Aktivasi Sekarang
              </Button>
            </Link>
          </div>
        )}
        {showLisensiBanner && lisensiNearExpiry && (
          <div className="flex items-center gap-3 px-4 py-2 bg-orange-50 border-b border-orange-200 text-orange-800 text-sm no-print">
            <ShieldAlert className="h-4 w-4 flex-shrink-0 text-orange-600" />
            <span className="flex-1">
              Lisensi habis dalam <strong>{licenseStatus?.sisa_hari} hari</strong>. Segera perpanjang agar fitur tetap berjalan.
            </span>
            <Link href="/lisensi">
              <Button size="sm" variant="outline" className="h-7 text-xs border-orange-400 text-orange-700 hover:bg-orange-100 flex-shrink-0">
                Perpanjang
              </Button>
            </Link>
          </div>
        )}
        {/* Banner pengingat backup */}
        {!isSuperAdmin && !backupReminderDismissed && daysWithoutBackup !== null && location !== "/backup" && (
          <div className="flex items-center gap-3 px-4 py-2 bg-amber-50 border-b border-amber-200 text-amber-800 text-sm no-print">
            <DatabaseBackup className="h-4 w-4 flex-shrink-0 text-amber-600" />
            <span className="flex-1">
              {daysWithoutBackup >= 999
                ? "Anda belum pernah melakukan backup data."
                : `Backup terakhir ${daysWithoutBackup} hari lalu.`}
              {" "}Segera backup agar data tidak hilang.
            </span>
            <Link href="/backup">
              <Button size="sm" variant="outline" className="h-7 text-xs border-amber-400 text-amber-700 hover:bg-amber-100 flex-shrink-0">
                Backup Sekarang
              </Button>
            </Link>
            <button
              onClick={() => setBackupReminderDismissed(true)}
              className="text-amber-500 hover:text-amber-700 flex-shrink-0"
              aria-label="Tutup"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
        {/* Mobile Header */}
        <header className="md:hidden flex items-center justify-between p-4 border-b bg-card no-print h-16 sticky top-0 z-10">
          <div>
            <h1 className="text-xl font-bold text-primary">Usahaku</h1>
            <p className="text-[10px] text-muted-foreground leading-tight">by KetanTech</p>
          </div>
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[280px] p-0">
              <div className="p-4 border-b">
                <h1 className="text-xl font-bold text-primary">Usahaku</h1>
                <p className="text-[10px] text-muted-foreground">by KetanTech</p>
              </div>
              <div className="px-3 py-2">
                <NavLinks />
              </div>
            </SheetContent>
          </Sheet>
        </header>

        {/* Page Content */}
        <div className="flex-1 p-4 md:p-6 overflow-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
