import { Link } from "wouter";
import {
  LayoutDashboard,
  Users,
  WalletCards,
  CreditCard,
  FileText,
  DatabaseBackup,
  Building2,
  KeyRound,
  ShieldCheck,
  BookOpen,
  Package,
  ShoppingBag,
  Truck,
  HardHat,
  Settings,
} from "lucide-react";
import type { LicenseStatus } from "./useSidebarBadges";

export type NavLink = {
  href: string;
  label: string;
  icon: React.ElementType;
  badgeKey?: "stok" | "upah" | "hutang_tempo" | "backup" | "lisensi";
};

export type NavGroup = { label: string; links: NavLink[] };

export const OWNER_GROUPS: NavGroup[] = [
  {
    label: "UTAMA",
    links: [{ href: "/dashboard", label: "Dashboard", icon: LayoutDashboard }],
  },
  {
    label: "PIUTANG",
    links: [
      { href: "/pelanggan", label: "Pelanggan", icon: Users },
      { href: "/hutang", label: "Hutang", icon: WalletCards, badgeKey: "hutang_tempo" },
      { href: "/pembayaran", label: "Pembayaran", icon: CreditCard },
    ],
  },
  {
    label: "PENJUALAN",
    links: [
      { href: "/kasir", label: "Kasir", icon: ShoppingBag },
      { href: "/stok", label: "Barang & Stok", icon: Package, badgeKey: "stok" },
      { href: "/supplier", label: "Supplier", icon: Truck },
    ],
  },
  {
    label: "KEUANGAN",
    links: [
      { href: "/keuangan", label: "Keuangan", icon: BookOpen },
      { href: "/gaji-tenaga", label: "Pekerja & Upah", icon: HardHat, badgeKey: "upah" },
    ],
  },
  {
    label: "LAPORAN",
    links: [{ href: "/laporan", label: "Laporan", icon: FileText }],
  },
  {
    label: "SISTEM",
    links: [
      { href: "/pengaturan", label: "Pengaturan", icon: Settings },
      { href: "/backup", label: "Backup & Restore", icon: DatabaseBackup, badgeKey: "backup" },
      { href: "/lisensi", label: "Lisensi", icon: ShieldCheck, badgeKey: "lisensi" },
    ],
  },
];

export const ADMIN_LINKS: NavLink[] = [
  { href: "/admin/dashboard", label: "Dashboard Global", icon: LayoutDashboard },
  { href: "/admin/usaha", label: "Daftar Usaha", icon: Building2 },
  { href: "/admin/owners", label: "Kelola Owner", icon: Users },
  { href: "/admin/lisensi", label: "Lisensi Key", icon: KeyRound },
];

interface SidebarNavLinksProps {
  isSuperAdmin: boolean;
  location: string;
  licenseStatus: LicenseStatus | undefined;
  daysWithoutBackup: number | null;
  stokPeringatanCount: number;
  upahBelumLunasCount: number;
  hutangJatuhTempoCount: number;
}

export function SidebarNavLinks({
  isSuperAdmin,
  location,
  licenseStatus,
  daysWithoutBackup,
  stokPeringatanCount,
  upahBelumLunasCount,
  hutangJatuhTempoCount,
}: SidebarNavLinksProps) {
  const renderLink = (link: NavLink) => {
    const isActive = location === link.href || location.startsWith(`${link.href}/`);
    const Icon = link.icon;

    let badge: { text: string; className: string } | null = null;

    if (!isSuperAdmin && link.badgeKey === "backup" && daysWithoutBackup !== null) {
      badge =
        daysWithoutBackup >= 7
          ? { text: "Perlu", className: "bg-amber-100 text-amber-700" }
          : { text: "Aman", className: "bg-emerald-100 text-emerald-700" };
    }
    if (!isSuperAdmin && link.badgeKey === "lisensi" && licenseStatus) {
      if (!licenseStatus.aktif || licenseStatus.jam_dimanipulasi) {
        badge = { text: "Mati", className: "bg-red-100 text-red-700" };
      } else if ((licenseStatus.sisa_hari ?? 0) <= 7) {
        badge = { text: `${licenseStatus.sisa_hari}h`, className: "bg-orange-100 text-orange-700" };
      }
    }
    if (link.badgeKey === "stok" && stokPeringatanCount > 0) {
      badge = {
        text: String(stokPeringatanCount),
        className: "bg-amber-100 text-amber-700",
      };
    }
    if (link.badgeKey === "upah" && upahBelumLunasCount > 0) {
      badge = {
        text: String(upahBelumLunasCount),
        className: "bg-orange-100 text-orange-700",
      };
    }
    if (link.badgeKey === "hutang_tempo" && hutangJatuhTempoCount > 0) {
      badge = {
        text: String(hutangJatuhTempoCount),
        className: "bg-red-100 text-red-700",
      };
    }

    return (
      <Link key={link.href} href={link.href}>
        <div
          className={`group relative flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 cursor-pointer ${
            isActive
              ? "bg-white/14 text-white font-semibold shadow-[inset_0_0_0_1px_rgba(255,255,255,0.12)]"
              : "text-sidebar-foreground/72 hover:bg-white/8 hover:text-white"
          }`}
        >
          {isActive && (
            <span className="absolute left-0 top-2 bottom-2 w-1 rounded-r-full bg-emerald-300 shadow-[0_0_14px_rgba(110,231,183,0.8)]" />
          )}
          <div
            className={`grid h-8 w-8 place-items-center rounded-lg transition-colors ${
              isActive ? "bg-white/14" : "bg-white/5 group-hover:bg-white/10"
            }`}
          >
            <Icon className="h-4.5 w-4.5" />
          </div>
          <span className="flex-1 text-sm">{link.label}</span>
          {badge && (
            <span
              className={`text-[10px] px-2 py-0.5 rounded-full font-bold shadow-sm ${badge.className}`}
            >
              {badge.text}
            </span>
          )}
        </div>
      </Link>
    );
  };

  return (
    <div className="py-1 space-y-1">
      {isSuperAdmin ? (
        <div className="space-y-1 px-0">{ADMIN_LINKS.map(renderLink)}</div>
      ) : (
        OWNER_GROUPS.map((group) => (
          <div key={group.label} className="mb-2">
            <p className="px-3 pt-3 pb-1 text-[10px] font-extrabold tracking-[0.18em] text-sidebar-foreground/40 uppercase">
              {group.label}
            </p>
            <div className="space-y-1">{group.links.map(renderLink)}</div>
          </div>
        ))
      )}
    </div>
  );
}
