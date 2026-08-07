import { ReactNode, useState, useEffect, useMemo, useCallback } from "react";
import { useLocation } from "wouter";
import { BookOpen } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLogout } from "@workspace/api-client-react";

import { useAuth } from "@/hooks/use-auth";
import { LicenseContext } from "@/context/license-context";
import { UpdateBanner } from "./UpdateBanner";
import { HelpDialog } from "./HelpDialog";
import { LicenseBanner } from "./LicenseBanner";
import { SidebarNavLinks } from "./SidebarNavLinks";
import { SidebarFooter } from "./SidebarFooter";
import { MobileHeader } from "./MobileHeader";
import { useSidebarBadges, type LicenseStatus } from "./useSidebarBadges";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

export function Layout({ children }: { children: ReactNode }) {
  const { isSuperAdmin, logout, user } = useAuth();
  const [location] = useLocation();
  const logoutMutation = useLogout();
  const qc = useQueryClient();

  const [appVersion, setAppVersion] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [checkResult, setCheckResult] = useState<string | null>(null);
  const [backupReminderDismissed, setBackupReminderDismissed] = useState(false);
  const [daysWithoutBackup, setDaysWithoutBackup] = useState<number | null>(null);
  const [recheckingLisensi, setRecheckingLisensi] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  // Status Lisensi
  const { data: licenseStatus } = useQuery<LicenseStatus>({
    queryKey: ["lisensi-status"],
    queryFn: async () => {
      const r = await fetch(`${BASE}/api/lisensi/status`, { credentials: "include" });
      if (!r.ok) throw new Error("Gagal");
      return r.json();
    },
    enabled: !isSuperAdmin,
    staleTime: 10 * 1000,
    refetchOnWindowFocus: true,
    refetchInterval: 60 * 1000,
  });

  // Badge data counts hook
  const { stokPeringatanCount, upahBelumLunasCount, hutangJatuhTempoCount } = useSidebarBadges({
    isSuperAdmin,
    licenseStatus,
  });

  const handleRecheckLisensi = async () => {
    setRecheckingLisensi(true);
    await qc.invalidateQueries({ queryKey: ["lisensi-status"] });
    setRecheckingLisensi(false);
  };

  const licenseContextValue = useMemo(
    () => ({
      lisensiAktif: isSuperAdmin
        ? true
        : (licenseStatus?.aktif ?? true) && !(licenseStatus?.jam_dimanipulasi ?? false),
      jamDimanipulasi: licenseStatus?.jam_dimanipulasi ?? false,
    }),
    [isSuperAdmin, licenseStatus]
  );

  useEffect(() => {
    window.electronApp?.getVersion().then(setAppVersion).catch(() => {});
  }, []);

  // Backup reminder tracking
  useEffect(() => {
    const refreshDaysWithoutBackup = () => {
      const lastBackup = localStorage.getItem("lastBackupDate");
      if (!lastBackup) {
        setDaysWithoutBackup(999);
        return;
      }
      const selisih = Math.floor(
        (Date.now() - new Date(lastBackup).getTime()) / (1000 * 60 * 60 * 24)
      );
      setDaysWithoutBackup(Number.isNaN(selisih) || selisih < 0 ? 0 : selisih);
    };

    refreshDaysWithoutBackup();
    const onFocus = () => refreshDaysWithoutBackup();
    const onVisibility = () => {
      if (!document.hidden) refreshDaysWithoutBackup();
    };
    const onStorage = (e: StorageEvent) => {
      if (e.key === "lastBackupDate") refreshDaysWithoutBackup();
    };
    const onBackupUpdated = () => refreshDaysWithoutBackup();

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("storage", onStorage);
    window.addEventListener("backup:updated", onBackupUpdated);

    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("backup:updated", onBackupUpdated);
    };
  }, []);

  const handleCheckUpdate = useCallback(async () => {
    if (!window.electronApp?.update?.checkNow) return;
    setChecking(true);
    setCheckResult(null);
    try {
      await window.electronApp.update.checkNow();
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
  }, []);

  const handleLogout = useCallback(() => {
    logoutMutation.mutate(undefined, { onSuccess: () => logout() });
  }, [logoutMutation, logout]);

  // Content navigasi yang dipakai bersama di Desktop Sidebar dan Mobile Drawer
  const NavContent = (
    <div className="py-2">
      <SidebarNavLinks
        isSuperAdmin={isSuperAdmin}
        location={location}
        licenseStatus={licenseStatus}
        daysWithoutBackup={daysWithoutBackup}
        stokPeringatanCount={stokPeringatanCount}
        upahBelumLunasCount={upahBelumLunasCount}
        hutangJatuhTempoCount={hutangJatuhTempoCount}
      />
      <SidebarFooter
        user={user}
        location={location}
        appVersion={appVersion}
        checking={checking}
        checkResult={checkResult}
        isLoggingOut={logoutMutation.isPending}
        onOpenHelp={() => setHelpOpen(true)}
        onCheckUpdate={handleCheckUpdate}
        onLogout={handleLogout}
      />
    </div>
  );

  return (
    <div className="min-h-screen bg-background flex">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-64 border-r border-sidebar-border bg-sidebar text-sidebar-foreground no-print fixed h-full z-10 shadow-2xl shadow-emerald-950/20">
        <div className="relative h-20 overflow-hidden border-b border-white/10 p-4 flex items-center">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(110,231,183,0.22),transparent_55%)]" />
          <div className="relative flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-white/12 shadow-inner ring-1 ring-white/15">
              <BookOpen className="h-5 w-5 text-emerald-200" />
            </div>
            <div>
              <h1 className="text-xl font-extrabold text-white tracking-tight">Usahaku</h1>
              <p className="text-[10px] text-sidebar-foreground/55 leading-tight">by KetanTech</p>
            </div>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-3 py-2 [scrollbar-width:thin] [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:bg-white/15 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-track]:bg-transparent">
          {NavContent}
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col md:pl-64 min-w-0">
        <UpdateBanner />

        <LicenseBanner
          licenseStatus={licenseStatus}
          isSuperAdmin={isSuperAdmin}
          location={location}
          recheckingLisensi={recheckingLisensi}
          onRecheckLisensi={handleRecheckLisensi}
          backupReminderDismissed={backupReminderDismissed}
          daysWithoutBackup={daysWithoutBackup}
          onDismissBackupReminder={() => setBackupReminderDismissed(true)}
        />

        <MobileHeader>{NavContent}</MobileHeader>

        {/* Page Content */}
        <div className="flex-1 overflow-auto p-4 md:p-7">
          <div className="mx-auto w-full max-w-[1500px] animate-soft-in">
            <LicenseContext.Provider value={licenseContextValue}>
              {children}
            </LicenseContext.Provider>
          </div>
        </div>
      </main>

      {/* Help Dialog */}
      <HelpDialog open={helpOpen} onOpenChange={setHelpOpen} />
    </div>
  );
}
