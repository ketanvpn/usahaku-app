import { Link } from "wouter";
import { ShieldAlert, ShieldOff, DatabaseBackup, RefreshCw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { LicenseStatus } from "./useSidebarBadges";

interface LicenseBannerProps {
  licenseStatus: LicenseStatus | undefined;
  isSuperAdmin: boolean;
  location: string;
  recheckingLisensi: boolean;
  onRecheckLisensi: () => Promise<void>;
  backupReminderDismissed: boolean;
  daysWithoutBackup: number | null;
  onDismissBackupReminder: () => void;
}

export function LicenseBanner({
  licenseStatus,
  isSuperAdmin,
  location,
  recheckingLisensi,
  onRecheckLisensi,
  backupReminderDismissed,
  daysWithoutBackup,
  onDismissBackupReminder,
}: LicenseBannerProps) {
  const showLisensiBanner = !isSuperAdmin && licenseStatus && location !== "/lisensi";
  const lisensiNearExpiry = licenseStatus?.aktif && (licenseStatus?.sisa_hari ?? 0) <= 7;
  const lisensiMati = licenseStatus && !licenseStatus.aktif;

  return (
    <>
      {/* Banner status lisensi mati */}
      {showLisensiBanner && lisensiMati && (
        <div className="flex items-center gap-3 px-4 py-2 bg-red-50 border-b border-red-200 text-red-800 text-sm no-print">
          <ShieldOff className="h-4 w-4 flex-shrink-0 text-red-600" />
          <span className="flex-1">
            {licenseStatus?.jam_dimanipulasi
              ? "Tanggal sistem terdeteksi dimundurkan. Betulkan tanggal lalu klik Cek Ulang."
              : "Lisensi tidak aktif — fitur tambah, edit, dan hapus data tidak tersedia."}
          </span>
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs border-red-400 text-red-700 hover:bg-red-100 flex-shrink-0"
            onClick={onRecheckLisensi}
            disabled={recheckingLisensi}
          >
            <RefreshCw className={`h-3 w-3 mr-1 ${recheckingLisensi ? "animate-spin" : ""}`} />
            Cek Ulang
          </Button>
          {!licenseStatus?.jam_dimanipulasi && (
            <Link href="/lisensi">
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs border-red-400 text-red-700 hover:bg-red-100 flex-shrink-0"
              >
                Aktivasi Sekarang
              </Button>
            </Link>
          )}
        </div>
      )}

      {/* Banner status lisensi mendekati expired */}
      {showLisensiBanner && lisensiNearExpiry && (
        <div className="flex items-center gap-3 px-4 py-2 bg-orange-50 border-b border-orange-200 text-orange-800 text-sm no-print">
          <ShieldAlert className="h-4 w-4 flex-shrink-0 text-orange-600" />
          <span className="flex-1">
            Lisensi habis dalam <strong>{licenseStatus?.sisa_hari} hari</strong>. Segera perpanjang agar fitur tetap berjalan.
          </span>
          <Link href="/lisensi">
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs border-orange-400 text-orange-700 hover:bg-orange-100 flex-shrink-0"
            >
              Perpanjang
            </Button>
          </Link>
        </div>
      )}

      {/* Banner pengingat backup */}
      {!isSuperAdmin &&
        !backupReminderDismissed &&
        daysWithoutBackup !== null &&
        daysWithoutBackup >= 7 &&
        location !== "/backup" && (
          <div className="flex items-center gap-3 px-4 py-2 bg-amber-50 border-b border-amber-200 text-amber-800 text-sm no-print">
            <DatabaseBackup className="h-4 w-4 flex-shrink-0 text-amber-600" />
            <span className="flex-1">
              {daysWithoutBackup >= 999
                ? "Anda belum pernah melakukan backup data."
                : `Backup terakhir ${daysWithoutBackup} hari lalu.`}{" "}
              Segera backup agar data tidak hilang.
            </span>
            <Link href="/backup">
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs border-amber-400 text-amber-700 hover:bg-amber-100 flex-shrink-0"
              >
                Backup Sekarang
              </Button>
            </Link>
            <button
              onClick={onDismissBackupReminder}
              className="text-amber-500 hover:text-amber-700 flex-shrink-0"
              aria-label="Tutup"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
    </>
  );
}
