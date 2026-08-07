import { Link } from "wouter";
import { UserCircle, HelpCircle, RefreshCw, LogOut } from "lucide-react";
import type { User } from "@/hooks/use-auth";

interface SidebarFooterProps {
  user: User | null;
  location: string;
  appVersion: string | null;
  checking: boolean;
  checkResult: string | null;
  isLoggingOut: boolean;
  onOpenHelp: () => void;
  onCheckUpdate: () => Promise<void>;
  onLogout: () => void;
}

export function SidebarFooter({
  user,
  location,
  appVersion,
  checking,
  checkResult,
  isLoggingOut,
  onOpenHelp,
  onCheckUpdate,
  onLogout,
}: SidebarFooterProps) {
  return (
    <div className="mx-2 mt-3 space-y-1 border-t border-white/10 pt-3">
      {/* Tombol Bantuan */}
      <button
        onClick={onOpenHelp}
        className="flex w-full items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 text-sidebar-foreground/72 hover:bg-white/8 hover:text-white cursor-pointer"
      >
        <HelpCircle className="h-5 w-5" />
        <span>Bantuan</span>
      </button>

      {/* Profil User */}
      <Link href="/profil">
        <div
          className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 cursor-pointer ${
            location === "/profil"
              ? "bg-white/14 text-white font-semibold"
              : "text-sidebar-foreground/72 hover:bg-white/8 hover:text-white"
          }`}
        >
          <UserCircle className="h-5 w-5" />
          <span className="flex-1 truncate">{user?.nama ?? "Profil"}</span>
        </div>
      </Link>

      {/* Versi & Auto-Update Electron */}
      {window.electronApp && (
        <div className="rounded-xl bg-white/5 px-3 py-2.5">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-sidebar-foreground/60">
              Versi {appVersion ?? "..."}
            </span>
          </div>
          <button
            onClick={onCheckUpdate}
            disabled={checking}
            className="flex w-full items-center gap-2 text-xs text-sidebar-foreground/70 hover:text-white transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${checking ? "animate-spin" : ""}`} />
            <span>{checking ? "Memeriksa..." : "Cek Pembaruan"}</span>
          </button>
          {checkResult && (
            <p className="text-xs text-sidebar-foreground/50 mt-1 pl-5">{checkResult}</p>
          )}
        </div>
      )}

      {/* Logout */}
      <button
        onClick={onLogout}
        disabled={isLoggingOut}
        className="flex w-full items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 text-red-200 hover:bg-red-500/12 hover:text-red-100 cursor-pointer disabled:opacity-50"
      >
        <LogOut className="h-5 w-5" />
        <span>Keluar</span>
      </button>
    </div>
  );
}
