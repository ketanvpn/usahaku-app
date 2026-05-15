import { useState, useRef, useEffect, useCallback } from "react";
import { getExportBackupUrl, useImportBackup } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { getErrorMessage } from "@/lib/format";
import { useAuth } from "@/hooks/use-auth";
import { savePengaturanBatch, PENGATURAN_QUERY_KEY } from "@/hooks/use-pengaturan";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Loader2, Download, Upload, AlertTriangle, FileJson, Users, ReceiptText, CreditCard, FolderOpen, HardDrive, Database, RotateCcw, Cloud, CloudOff, RefreshCw, Unlink, CheckCircle2, Clock, Copy } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import type { GDriveStatusPayload, GDriveBackupFile } from "@/types/electron";

interface BackupPreview {
  pelanggan: number;
  hutang: number;
  pembayaran: number;
  usaha_id: number;
  nama_usaha?: string;
  exported_at?: string;
}

function formatTanggal(isoStr: string): string {
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric", month: "long", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  }).format(new Date(isoStr));
}

function formatSize(bytes: string): string {
  const n = parseInt(bytes, 10);
  if (isNaN(n)) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function formatRelativeBackup(isoStr: string): string {
  const diffMs = Date.now() - new Date(isoStr).getTime();
  if (Number.isNaN(diffMs) || diffMs < 0) return "Baru saja";
  const minutes = Math.floor(diffMs / (1000 * 60));
  if (minutes < 1) return "Baru saja";
  if (minutes < 60) return `${minutes} menit lalu`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} jam lalu`;
  const days = Math.floor(hours / 24);
  return `${days} hari lalu`;
}

export default function BackupPage() {
  const [isExporting, setIsExporting] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<BackupPreview | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [isConfirmRestoreOpen, setIsConfirmRestoreOpen] = useState(false);
  const [autoBackupFolder, setAutoBackupFolder] = useState<string>("");
  const [isChoosingFolder, setIsChoosingFolder] = useState(false);
  const [isRestoringDB, setIsRestoringDB] = useState(false);
  const [isConfirmRestoreDBOpen, setIsConfirmRestoreDBOpen] = useState(false);
  const [restoreErrorMsg, setRestoreErrorMsg] = useState<string | null>(null);
  const [lastManualBackup, setLastManualBackup] = useState<string | null>(null);

  // ── Google Drive state ────────────────────────────────────────────────────
  const [gdriveStatus, setGdriveStatus] = useState<GDriveStatusPayload | null>(null);
  const [gdriveBackups, setGdriveBackups] = useState<GDriveBackupFile[]>([]);
  const [isGdriveLoading, setIsGdriveLoading] = useState(false);
  const [isGdriveBackingUp, setIsGdriveBackingUp] = useState(false);
  const [isGdriveConnecting, setIsGdriveConnecting] = useState(false);
  const [gdriveRestoreFile, setGdriveRestoreFile] = useState<GDriveBackupFile | null>(null);
  const [isGdriveRestoring, setIsGdriveRestoring] = useState(false);
  const [showGdriveBackups, setShowGdriveBackups] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const usahaId = user?.usaha_id ?? null;

  const markManualBackupNow = () => {
    const nowIso = new Date().toISOString();
    localStorage.setItem("lastBackupDate", nowIso);
    setLastManualBackup(nowIso);
    window.dispatchEvent(new Event("backup:updated"));
  };

  const importMutation = useImportBackup();
  const isElectron = !!window.electronApp?.backup;
  const hasGdrive = !!window.electronApp?.gdrive;

  const refreshGdriveStatus = useCallback(async () => {
    if (!window.electronApp?.gdrive) return;
    try {
      const status = await window.electronApp.gdrive.getStatus();
      setGdriveStatus(status);
      if (status.connected) {
        setIsGdriveLoading(true);
        const files = await window.electronApp.gdrive.listBackups();
        setGdriveBackups(files);
      } else {
        setGdriveBackups([]);
      }
    } catch {
    } finally {
      setIsGdriveLoading(false);
    }
  }, []);

  useEffect(() => {
    if (window.electronApp?.backup) {
      window.electronApp.backup.getFolder().then(setAutoBackupFolder).catch(() => {});
    }
    setLastManualBackup(localStorage.getItem("lastBackupDate"));
    refreshGdriveStatus();

    // Dengarkan event backup selesai dari Electron
    const unsub = window.electronApp?.gdrive?.onBackupDone(() => {
      refreshGdriveStatus();
    });
    return () => { unsub?.(); };
  }, [refreshGdriveStatus]);

  const handleChooseFolder = async () => {
    if (!window.electronApp?.backup) return;
    setIsChoosingFolder(true);
    try {
      const chosen = await window.electronApp.backup.chooseFolder();
      if (chosen) {
        setAutoBackupFolder(chosen);
        toast({ title: "Folder backup diperbarui", description: chosen });
      }
    } finally {
      setIsChoosingFolder(false);
    }
  };

  const handleCopyFolderPath = async () => {
    if (!autoBackupFolder) return;
    try {
      await navigator.clipboard.writeText(autoBackupFolder);
      toast({ title: "Lokasi folder disalin", description: autoBackupFolder });
    } catch {
      toast({ variant: "destructive", title: "Gagal menyalin lokasi folder" });
    }
  };

  const handleOpenFolder = async () => {
    if (!window.electronApp?.backup?.openFolder) return;
    const result = await window.electronApp.backup.openFolder();
    if (!result.success) {
      toast({ variant: "destructive", title: "Gagal membuka folder", description: result.message ?? "Terjadi kesalahan" });
    }
  };

  const handleRefreshStatus = async () => {
    try {
      if (window.electronApp?.backup) {
        const folder = await window.electronApp.backup.getFolder();
        setAutoBackupFolder(folder);
      }
      setLastManualBackup(localStorage.getItem("lastBackupDate"));
      await refreshGdriveStatus();
      toast({ title: "Status backup diperbarui" });
    } catch {
      toast({ variant: "destructive", title: "Gagal memperbarui status backup" });
    }
  };

  const handleRestoreDB = async () => {
    if (!window.electronApp?.backup?.restoreDB) return;
    setIsRestoringDB(true);
    try {
      const result = await window.electronApp.backup.restoreDB();
      if (result.canceled) return;
      if (result.success) {
        toast({ title: "Restore auto-backup berhasil!", description: "Aplikasi memuat ulang data..." });
      } else {
        toast({ variant: "destructive", title: "Restore gagal", description: result.message || "Terjadi kesalahan" });
      }
    } finally {
      setIsRestoringDB(false);
    }
  };

  const handleGdriveConnect = async () => {
    if (!window.electronApp?.gdrive) return;
    setIsGdriveConnecting(true);
    try {
      const result = await window.electronApp.gdrive.connect();
      if (result.success) {
        toast({ title: "Google Drive terhubung!", description: "Backup otomatis sudah aktif." });
        await refreshGdriveStatus();
      } else {
        toast({ variant: "destructive", title: "Gagal menghubungkan", description: result.message ?? "Terjadi kesalahan" });
      }
    } finally {
      setIsGdriveConnecting(false);
    }
  };

  const handleGdriveDisconnect = async () => {
    if (!window.electronApp?.gdrive) return;
    await window.electronApp.gdrive.disconnect();
    setGdriveStatus(prev => prev ? { ...prev, connected: false, email: undefined, lastBackupAt: undefined } : null);
    setGdriveBackups([]);
    toast({ title: "Google Drive diputus", description: "Backup lokal tetap berjalan." });
  };

  const handleGdriveBackupNow = async () => {
    if (!window.electronApp?.gdrive) return;
    setIsGdriveBackingUp(true);
    try {
      const result = await window.electronApp.gdrive.backupNow();
      if (result.success) {
        toast({ title: "Backup ke Google Drive berhasil!" });
        await refreshGdriveStatus();
      } else {
        toast({ variant: "destructive", title: "Backup gagal", description: result.message ?? "Terjadi kesalahan" });
      }
    } finally {
      setIsGdriveBackingUp(false);
    }
  };

  const handleGdriveRestoreConfirmed = async () => {
    if (!gdriveRestoreFile || !window.electronApp?.gdrive) return;
    setIsGdriveRestoring(true);
    setGdriveRestoreFile(null);
    try {
      const result = await window.electronApp.gdrive.restoreFromDrive(gdriveRestoreFile.id);
      if (result.success) {
        toast({ title: "Restore dari Google Drive berhasil!", description: "Aplikasi memuat ulang data..." });
      } else {
        toast({ variant: "destructive", title: "Restore gagal", description: result.message ?? "Terjadi kesalahan" });
      }
    } finally {
      setIsGdriveRestoring(false);
    }
  };

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const response = await fetch(getExportBackupUrl(), { credentials: "include" });
      if (!response.ok) throw new Error("Gagal mengambil data backup");

      const data = await response.json();

      // v1.0.88: enrichment client-side untuk file logo. Server tidak bisa baca
      // userData/logos/, jadi client yang baca via IPC dan tempel ke payload.
      // Bump version ke "1.9" supaya jelas mana backup yang sudah include logo.
      const logoFilename: string | null =
        Array.isArray(data?.pengaturan)
          ? (data.pengaturan.find((p: { key?: string }) => p?.key === "logo_filename")?.value ?? null)
          : null;

      if (logoFilename && usahaId && window.electronApp?.pengaturan) {
        try {
          const base64 = await window.electronApp.pengaturan.getLogoData(
            usahaId,
            logoFilename,
          );
          if (base64) {
            const lower = logoFilename.toLowerCase();
            const ext: "png" | "jpg" =
              lower.endsWith(".jpg") || lower.endsWith(".jpeg") ? "jpg" : "png";
            data.logo_base64 = base64;
            data.logo_ext = ext;
            data.version = "1.9";
          }
        } catch {
          // Logo gagal di-baca → backup tetap dihasilkan tanpa logo, log saja.
          // Jangan blocking export hanya karena logo bermasalah.
        }
      }

      const jsonStr = JSON.stringify(data, null, 2);

      if (window.electronApp?.backup?.saveManual) {
        // Electron: buka dialog "Simpan sebagai"
        const result = await window.electronApp.backup.saveManual(jsonStr);
        if (!result.success) {
          if (result.message && result.message !== "Dibatalkan") {
            toast({ variant: "destructive", title: "Gagal menyimpan", description: result.message });
          }
          return;
        }
        markManualBackupNow();
        toast({ title: "Backup berhasil disimpan", description: result.filePath });
      } else {
        // Browser biasa: download otomatis
        const blob = new Blob([jsonStr], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `usahaku_backup_${new Date().toISOString().split("T")[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        markManualBackupNow();
        toast({ title: "Backup berhasil diunduh" });
      }
    } catch (error: any) {
      toast({ variant: "destructive", title: "Gagal export", description: error.message });
    } finally {
      setIsExporting(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPreview(null);
    setPreviewError(null);

    if (!e.target.files || e.target.files.length === 0) {
      setFile(null);
      return;
    }

    const selectedFile = e.target.files[0];
    setFile(selectedFile);

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const jsonStr = ev.target?.result as string;
        const data = JSON.parse(jsonStr);

        if (!data.version || !data.usaha_id) {
          setPreviewError("Format file backup tidak valid. Pastikan file adalah hasil export dari aplikasi ini.");
          return;
        }

        setPreview({
          pelanggan: Array.isArray(data.pelanggan) ? data.pelanggan.length : 0,
          hutang: Array.isArray(data.hutang) ? data.hutang.length : 0,
          pembayaran: Array.isArray(data.pembayaran) ? data.pembayaran.length : 0,
          usaha_id: data.usaha_id,
          nama_usaha: data.usaha?.nama_usaha ?? undefined,
          exported_at: data.exported_at,
        });
      } catch {
        setPreviewError("File tidak dapat dibaca. Pastikan file adalah JSON yang valid.");
      }
    };
    reader.readAsText(selectedFile);
  };

  // Restore logo dari payload backup v1.9. Server hanya tahu key/value
  // pengaturan biasa; file logo harus ditulis ke userData via IPC, lalu
  // logo_filename di DB diupdate ke filename hasil saveLogo (yang punya
  // timestamp baru).
  const restoreLogoIfPresent = async (data: {
    logo_base64?: string;
    logo_ext?: string;
  }) => {
    if (!data.logo_base64 || !data.logo_ext) return;
    if (!usahaId || !window.electronApp?.pengaturan) return;
    const ext = data.logo_ext === "jpg" || data.logo_ext === "jpeg" ? "jpg" : "png";
    try {
      const result = await window.electronApp.pengaturan.saveLogo({
        usahaId,
        data: data.logo_base64,
        ext,
      });
      if (result.success && result.filename) {
        await savePengaturanBatch([
          { key: "logo_filename", value: result.filename },
        ]);
        queryClient.invalidateQueries({ queryKey: PENGATURAN_QUERY_KEY });
      }
    } catch {
      // Logo gagal di-restore tidak boleh menggagalkan keseluruhan restore.
      // User bisa upload ulang dari halaman Pengaturan.
    }
  };

  const handleImportConfirmed = () => {
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const jsonStr = e.target?.result as string;
        const data = JSON.parse(jsonStr);

        if (!data.version || !data.usaha_id) {
          throw new Error("Format file backup tidak valid.");
        }

        importMutation.mutate(
          { data },
          {
            onSuccess: async () => {
              // Backup v1.9: tulis ulang file logo ke userData/logos/.
              // Aman dipanggil untuk v1.7/v1.8 — fungsi internal cek
              // `logo_base64` dulu sebelum apa-apa.
              await restoreLogoIfPresent(data);

              toast({ title: "Restore data berhasil!", description: `${preview?.pelanggan ?? 0} pelanggan, ${preview?.hutang ?? 0} hutang, ${preview?.pembayaran ?? 0} pembayaran telah dipulihkan.` });
              setFile(null);
              setPreview(null);
              if (fileInputRef.current) fileInputRef.current.value = "";
              queryClient.invalidateQueries();
            },
            onError: (err: unknown) => {
              setRestoreErrorMsg(getErrorMessage(err, "Terjadi kesalahan tidak diketahui"));
            },
          }
        );
      } catch (error: unknown) {
        toast({ variant: "destructive", title: "Gagal membaca file", description: getErrorMessage(error) });
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight text-primary">Cadangan & Pulihkan Data</h2>
        <p className="text-muted-foreground">Amankan data usaha Anda secara berkala.</p>
      </div>

      {isElectron && (
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-primary">
              <HardDrive className="h-5 w-5" />
              Pengaturan Cadangan Otomatis
            </CardTitle>
            <CardDescription>
               Setiap kali menutup aplikasi, data otomatis dicadangkan ke folder ini. Maksimal 7 file terakhir disimpan.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-2 p-3 bg-background rounded-md border text-sm">
              <FolderOpen className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <span className="text-muted-foreground flex-1 break-all">
                {autoBackupFolder || "Memuat..."}
              </span>
            </div>
            <div className="text-xs text-muted-foreground">
              {lastManualBackup
                 ? `Cadangan manual terakhir: ${formatRelativeBackup(lastManualBackup)} (${formatTanggal(lastManualBackup)})`
                 : "Belum ada cadangan manual tercatat"}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleChooseFolder}
              disabled={isChoosingFolder}
              className="w-full sm:w-auto"
            >
              {isChoosingFolder ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <FolderOpen className="mr-2 h-4 w-4" />
              )}
               Ubah Folder Cadangan Otomatis
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleCopyFolderPath}
              disabled={!autoBackupFolder}
              className="w-full sm:w-auto"
            >
              <Copy className="mr-2 h-4 w-4" /> Salin Lokasi Folder
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleOpenFolder}
              disabled={!isElectron}
              className="w-full sm:w-auto"
            >
              <FolderOpen className="mr-2 h-4 w-4" /> Buka Folder Cadangan
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefreshStatus}
              className="w-full sm:w-auto"
            >
              <RefreshCw className="mr-2 h-4 w-4" /> Perbarui Status
            </Button>
          </CardContent>
        </Card>
      )}

      {isElectron && (
        <Card className="border-amber-200 bg-amber-50/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-amber-800">
              <Database className="h-5 w-5" />
              Pulihkan dari Cadangan Otomatis (.db)
            </CardTitle>
            <CardDescription className="text-amber-700">
               Pulihkan data dari file cadangan otomatis yang tersimpan saat aplikasi ditutup.
               File cadangan otomatis berformat <strong>.db</strong> dan tersimpan di folder cadangan di atas.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Alert className="bg-amber-100 border-amber-300 text-amber-900">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Perhatian</AlertTitle>
              <AlertDescription className="text-xs mt-1">
                Restore akan menghapus semua data saat ini dan menggantinya dengan isi file .db yang dipilih.
                Aplikasi akan memuat ulang secara otomatis setelah selesai.
              </AlertDescription>
            </Alert>
          </CardContent>
          <CardFooter>
            <Button
              variant="outline"
              className="border-amber-400 text-amber-800 hover:bg-amber-100 w-full sm:w-auto"
              onClick={() => setIsConfirmRestoreDBOpen(true)}
              disabled={isRestoringDB}
            >
              {isRestoringDB ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RotateCcw className="mr-2 h-4 w-4" />
              )}
              Pilih File Cadangan & Pulihkan...
            </Button>
          </CardFooter>
        </Card>
      )}

      {/* ── Kartu Google Drive ──────────────────────────────────────────── */}
      {hasGdrive && gdriveStatus && (
        <Card className={gdriveStatus.connected ? "border-blue-200 bg-blue-50/40" : "border-muted"}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-blue-700">
              {gdriveStatus.connected ? (
                <Cloud className="h-5 w-5 text-blue-600" />
              ) : (
                <CloudOff className="h-5 w-5 text-muted-foreground" />
              )}
              Cadangan ke Google Drive
              {gdriveStatus.connected && (
                <span className="ml-auto text-xs font-normal px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" /> Terhubung
                </span>
              )}
            </CardTitle>
            <CardDescription>
              {gdriveStatus.connected
                ? "Data dicadangkan otomatis ke Google Drive setiap kali ada perubahan dan internet tersedia."
                : "Hubungkan akun Google untuk cadangan otomatis ke cloud. Aman, gratis, dan mudah dipulihkan."}
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-3">
            {!gdriveStatus.configured && (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Belum Diaktifkan</AlertTitle>
                <AlertDescription className="text-xs">
                  Fitur Google Drive belum diaktifkan pada versi ini. Hubungi pengembang untuk informasi lebih lanjut.
                </AlertDescription>
              </Alert>
            )}

            {gdriveStatus.configured && gdriveStatus.connected && (
              <>
                <div className="flex flex-col gap-1.5 p-3 bg-background rounded-md border text-sm">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Cloud className="h-4 w-4 flex-shrink-0 text-blue-500" />
                    <span className="font-medium text-foreground truncate">{gdriveStatus.email}</span>
                  </div>
                  {gdriveStatus.lastBackupAt && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground pl-6">
                      <Clock className="h-3 w-3" />
                      Backup terakhir: {formatTanggal(gdriveStatus.lastBackupAt)}
                    </div>
                  )}
                  {!gdriveStatus.lastBackupAt && (
                    <div className="text-xs text-muted-foreground pl-6">Belum ada cadangan ke Drive</div>
                  )}
                  {gdriveStatus.lastError && (
                    <div className="text-xs text-destructive pl-6">{gdriveStatus.lastError}</div>
                  )}
                </div>

                {/* Daftar backup */}
                <div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs h-7 px-2 text-blue-600"
                    onClick={() => setShowGdriveBackups(v => !v)}
                    disabled={isGdriveLoading}
                  >
                    {isGdriveLoading ? (
                      <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                    ) : (
                      <RefreshCw className="mr-1 h-3 w-3" />
                    )}
                    {showGdriveBackups ? "Sembunyikan" : `Lihat ${gdriveBackups.length} cadangan di Drive`}
                  </Button>

                  {showGdriveBackups && gdriveBackups.length > 0 && (
                    <div className="mt-2 border rounded-md overflow-hidden text-sm">
                      {gdriveBackups.map((f, i) => (
                        <div key={f.id} className={`flex items-center gap-2 px-3 py-2 ${i % 2 === 0 ? "bg-background" : "bg-muted/30"}`}>
                          <Database className="h-3.5 w-3.5 text-blue-400 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="truncate text-xs font-medium">{f.name}</div>
                            <div className="text-xs text-muted-foreground">
                              {formatTanggal(f.createdTime)}{f.size ? ` · ${formatSize(f.size)}` : ""}
                            </div>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs flex-shrink-0"
                            onClick={() => setGdriveRestoreFile(f)}
                            disabled={isGdriveRestoring}
                          >
                            <RotateCcw className="mr-1 h-3 w-3" />
                            Pulihkan
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                  {showGdriveBackups && gdriveBackups.length === 0 && !isGdriveLoading && (
                    <p className="text-xs text-muted-foreground mt-2 px-1">Belum ada file cadangan di Drive.</p>
                  )}
                </div>
              </>
            )}

            {gdriveStatus.configured && !gdriveStatus.connected && (
              <p className="text-sm text-muted-foreground">
                Setelah terhubung, cadangan otomatis berjalan di latar belakang setiap kali ada internet.
                Maksimal 7 file backup tersimpan di Drive.
              </p>
            )}
          </CardContent>

          <CardFooter className="gap-2 flex-wrap">
            {gdriveStatus.configured && !gdriveStatus.connected && (
              <Button
                onClick={handleGdriveConnect}
                disabled={isGdriveConnecting}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                {isGdriveConnecting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Cloud className="mr-2 h-4 w-4" />}
                Hubungkan Google Drive
              </Button>
            )}
            {gdriveStatus.configured && gdriveStatus.connected && (
              <>
                <Button
                  variant="outline"
                  onClick={handleGdriveBackupNow}
                  disabled={isGdriveBackingUp}
                  className="border-blue-300 text-blue-700 hover:bg-blue-50"
                >
                  {isGdriveBackingUp ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Cloud className="mr-2 h-4 w-4" />}
                  Cadangkan Sekarang
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleGdriveDisconnect}
                  className="text-muted-foreground hover:text-destructive ml-auto"
                >
                  <Unlink className="mr-1 h-3.5 w-3.5" />
                  Putuskan Koneksi
                </Button>
              </>
            )}
          </CardFooter>
        </Card>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Download className="h-5 w-5 text-primary" />
              Simpan Cadangan
            </CardTitle>
            <CardDescription>
              {isElectron
                ? "Simpan data ke file JSON — pilih lokasi penyimpanan sesuka Anda."
                : "Unduh seluruh data pelanggan, hutang, dan pembayaran dalam format JSON."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Lakukan cadangan secara rutin untuk menghindari kehilangan data. File yang disimpan
              dapat digunakan untuk memulihkan data kapan saja.
            </p>
          </CardContent>
          <CardFooter>
            <Button onClick={handleExport} disabled={isExporting} className="w-full sm:w-auto">
              {isExporting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Download className="mr-2 h-4 w-4" />
              )}
               {isElectron ? "Simpan File Cadangan..." : "Unduh File Cadangan"}
            </Button>
          </CardFooter>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5 text-orange-500" />
              Pulihkan Data
            </CardTitle>
            <CardDescription>Kembalikan data dari file JSON cadangan sebelumnya.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert variant="destructive" className="bg-destructive/10 text-destructive border-destructive/20">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Perhatian!</AlertTitle>
                <AlertDescription className="text-xs mt-1">
                  Melakukan pemulihan akan menghapus semua data saat ini dan menggantinya dengan data
                  dari file cadangan. Pastikan Anda sudah punya cadangan terbaru sebelum melanjutkan.
                </AlertDescription>
            </Alert>

            <div className="grid w-full items-center gap-1.5">
              <input
                type="file"
                accept=".json"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                onChange={handleFileChange}
                ref={fileInputRef}
              />
            </div>

            {file && !previewError && !preview && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground p-2 bg-muted rounded">
                <FileJson className="h-4 w-4" /> Membaca file...
              </div>
            )}

            {previewError && (
              <div className="text-sm text-destructive p-3 bg-destructive/10 rounded border border-destructive/20">
                {previewError}
              </div>
            )}

            {preview && !previewError && (
              <div className="p-3 bg-blue-50 rounded-lg border border-blue-100">
                <div className="text-sm font-semibold text-blue-800 mb-1 flex items-center gap-1">
                  <FileJson className="h-4 w-4" />
                  Preview Data: {file?.name}
                </div>
                {preview.nama_usaha && (
                  <div className="text-xs text-blue-600 mb-2 bg-blue-100 rounded px-2 py-1">
                    Usaha dalam backup: <strong>{preview.nama_usaha}</strong>
                  </div>
                )}
                <div className="grid grid-cols-3 gap-2">
                  <div className="text-center p-2 bg-white rounded border border-blue-100">
                    <Users className="h-4 w-4 mx-auto mb-1 text-blue-500" />
                    <div className="text-lg font-bold text-blue-700">{preview.pelanggan}</div>
                    <div className="text-xs text-blue-500">Pelanggan</div>
                  </div>
                  <div className="text-center p-2 bg-white rounded border border-blue-100">
                    <ReceiptText className="h-4 w-4 mx-auto mb-1 text-amber-500" />
                    <div className="text-lg font-bold text-amber-700">{preview.hutang}</div>
                    <div className="text-xs text-amber-500">Hutang</div>
                  </div>
                  <div className="text-center p-2 bg-white rounded border border-blue-100">
                    <CreditCard className="h-4 w-4 mx-auto mb-1 text-emerald-500" />
                    <div className="text-lg font-bold text-emerald-700">{preview.pembayaran}</div>
                    <div className="text-xs text-emerald-500">Pembayaran</div>
                  </div>
                </div>
                {preview.exported_at && (
                  <div className="text-xs text-blue-400 mt-2 text-center">
                    Backup dari:{" "}
                    {new Intl.DateTimeFormat("id-ID", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    }).format(new Date(preview.exported_at))}
                  </div>
                )}
              </div>
            )}
          </CardContent>
          <CardFooter>
            <Button
              variant="destructive"
              onClick={() => setIsConfirmRestoreOpen(true)}
              disabled={!file || !preview || !!previewError || importMutation.isPending}
              className="w-full sm:w-auto"
            >
              {importMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Upload className="mr-2 h-4 w-4" />
              )}
               Mulai Pulihkan
            </Button>
          </CardFooter>
        </Card>
      </div>

      <AlertDialog open={isConfirmRestoreOpen} onOpenChange={setIsConfirmRestoreOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Konfirmasi Pulihkan Data</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>
                  Tindakan ini akan <strong>menghapus seluruh data yang ada saat ini</strong> dan
                  menggantinya dengan data dari file <strong>{file?.name}</strong>.
                </p>
                {preview && (
                  <div className="p-3 bg-muted rounded-md text-sm space-y-1">
                    {preview.nama_usaha && (
                      <div className="font-semibold text-primary">Usaha: {preview.nama_usaha}</div>
                    )}
                    <div className="font-semibold mb-1">Data yang akan dipulihkan:</div>
                    <div>{preview.pelanggan} pelanggan</div>
                    <div>{preview.hutang} hutang</div>
                    <div>{preview.pembayaran} pembayaran</div>
                  </div>
                )}
                <p className="text-destructive font-medium">Proses ini tidak dapat dibatalkan.</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Kembali</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setIsConfirmRestoreOpen(false);
                handleImportConfirmed();
              }}
              className="bg-destructive text-destructive-foreground"
            >
              Ya, Pulihkan Sekarang
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {/* Konfirmasi restore dari Google Drive */}
      <AlertDialog open={!!gdriveRestoreFile} onOpenChange={(open) => { if (!open) setGdriveRestoreFile(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Pulihkan dari Google Drive?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>
                  Anda akan memulihkan data dari file:<br />
                  <strong className="text-foreground">{gdriveRestoreFile?.name}</strong>
                </p>
                {gdriveRestoreFile?.createdTime && (
                  <div className="text-sm text-muted-foreground">
                    Dibuat: {formatTanggal(gdriveRestoreFile.createdTime)}
                  </div>
                )}
                <p>
                  Semua data saat ini akan <strong>dihapus dan diganti</strong> dengan isi file ini.
                  Aplikasi akan memuat ulang secara otomatis.
                </p>
                <p className="text-destructive font-medium">Proses ini tidak dapat dibatalkan.</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Kembali</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleGdriveRestoreConfirmed}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              Ya, Pulihkan Sekarang
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={isConfirmRestoreDBOpen} onOpenChange={setIsConfirmRestoreDBOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Pulihkan dari Cadangan Otomatis?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>
                  Anda akan memilih file <strong>.db</strong> dari folder cadangan otomatis.
                  Semua data saat ini akan <strong>dihapus dan diganti</strong> dengan isi file tersebut.
                </p>
                <p>Aplikasi akan memuat ulang otomatis setelah proses selesai.</p>
                <p className="text-destructive font-medium">Proses ini tidak dapat dibatalkan.</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Kembali</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setIsConfirmRestoreDBOpen(false);
                handleRestoreDB();
              }}
              className="bg-amber-600 hover:bg-amber-700 text-white"
            >
              Lanjutkan, Pilih File...
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog error restore JSON — tampil penuh agar bisa dibaca lengkap */}
      <AlertDialog open={!!restoreErrorMsg} onOpenChange={(open) => { if (!open) setRestoreErrorMsg(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Pulihkan Data Gagal
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-left">
                <p className="text-sm text-muted-foreground">Terjadi kesalahan saat memproses file backup. Detail error:</p>
                <div className="bg-muted rounded p-3 text-xs font-mono break-all whitespace-pre-wrap max-h-48 overflow-auto">
                  {restoreErrorMsg}
                </div>
                <p className="text-sm text-muted-foreground">Data Anda tidak berubah (semua perubahan dibatalkan otomatis). Silakan screenshot error di atas dan hubungi pengembang jika masalah berlanjut.</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setRestoreErrorMsg(null)}>Tutup</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
