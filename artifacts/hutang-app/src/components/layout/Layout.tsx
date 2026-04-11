import { ReactNode } from "react";
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
  ShoppingBag
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { useLogout } from "@workspace/api-client-react";
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
      <div className="pt-3 mt-2 border-t mx-3">
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
