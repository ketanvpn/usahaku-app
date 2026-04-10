import { ReactNode } from "react";
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
  Package
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { useLogout } from "@workspace/api-client-react";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet";

export function Layout({ children }: { children: ReactNode }) {
  const { isSuperAdmin, logout } = useAuth();
  const [location] = useLocation();
  const logoutMutation = useLogout();

  const handleLogout = () => {
    logoutMutation.mutate(undefined, {
      onSuccess: () => {
        logout();
      }
    });
  };

  const ownerLinks = [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/pelanggan", label: "Pelanggan", icon: Users },
    { href: "/hutang", label: "Hutang", icon: WalletCards },
    { href: "/pembayaran", label: "Pembayaran", icon: CreditCard },
    { href: "/stok", label: "Stok Barang", icon: Package },
    { href: "/keuangan", label: "Keuangan", icon: BookOpen },
    { href: "/laporan", label: "Laporan", icon: FileText },
    { href: "/backup", label: "Backup & Restore", icon: DatabaseBackup },
    { href: "/lisensi", label: "Lisensi", icon: ShieldCheck },
    { href: "/profil", label: "Profil", icon: UserCircle },
  ];

  const adminLinks = [
    { href: "/admin/dashboard", label: "Dashboard Global", icon: LayoutDashboard },
    { href: "/admin/usaha", label: "Daftar Usaha", icon: Building2 },
    { href: "/admin/owners", label: "Kelola Owner", icon: Users },
    { href: "/admin/lisensi", label: "Lisensi Key", icon: KeyRound },
    { href: "/profil", label: "Profil", icon: UserCircle },
  ];

  const links = isSuperAdmin ? adminLinks : ownerLinks;

  const NavLinks = () => (
    <div className="space-y-1 py-4">
      {links.map((link) => {
        const isActive = location === link.href || location.startsWith(`${link.href}/`);
        const Icon = link.icon;
        return (
          <Link key={link.href} href={link.href}>
            <div
              className={`flex items-center gap-3 px-3 py-2 rounded-md transition-colors cursor-pointer ${
                isActive 
                  ? "bg-primary text-primary-foreground font-medium" 
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              <Icon className="h-5 w-5" />
              <span>{link.label}</span>
            </div>
          </Link>
        );
      })}
      <div className="pt-4 mt-4 border-t">
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
          <h1 className="text-xl font-bold text-primary tracking-tight">Buku Hutang</h1>
        </div>
        <div className="flex-1 overflow-y-auto px-3 py-2">
          <NavLinks />
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col md:pl-64 min-w-0">
        {/* Mobile Header */}
        <header className="md:hidden flex items-center justify-between p-4 border-b bg-card no-print h-16 sticky top-0 z-10">
          <h1 className="text-xl font-bold text-primary">Buku Hutang</h1>
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[280px] p-0">
              <div className="p-4 border-b">
                <h1 className="text-xl font-bold text-primary">Buku Hutang</h1>
              </div>
              <div className="px-3 py-2">
                <NavLinks />
              </div>
            </SheetContent>
          </Sheet>
        </header>

        {/* Page Content */}
        <div className="flex-1 p-4 md:p-8 overflow-auto">
          <div className="max-w-6xl mx-auto">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
