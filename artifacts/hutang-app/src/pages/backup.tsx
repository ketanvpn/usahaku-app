import { useState, useRef, useEffect } from "react";
import { getExportBackupUrl, useImportBackup, getGetOwnerDashboardQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Loader2, Download, Upload, AlertTriangle, FileJson, Users, ReceiptText, CreditCard, FolderOpen, HardDrive, Database, RotateCcw } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface BackupPreview {
  pelanggan: number;
  hutang: number;
  pembayaran: number;
  usaha_id: number;
  nama_usaha?: string;
  exported_at?: string;
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

  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const importMutation = useImportBackup();
  const isElectron = !!window.electronApp?.backup;

  useEffect(() => {
    if (window.electronApp?.backup) {
      window.electronApp.backup.getFolder().then(setAutoBackupFolder).catch(() => {});
    }
  }, []);

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

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const response = await fetch(getExportBackupUrl(), { credentials: "include" });
      if (!response.ok) throw new Error("Gagal mengambil data backup");

      const data = await response.json();
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
        localStorage.setItem("lastBackupDate", new Date().toISOString());
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
        localStorage.setItem("lastBackupDate", new Date().toISOString());
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
            onSuccess: () => {
              toast({ title: "Restore data berhasil!", description: `${preview?.pelanggan ?? 0} pelanggan, ${preview?.hutang ?? 0} hutang, ${preview?.pembayaran ?? 0} pembayaran telah dipulihkan.` });
              setFile(null);
              setPreview(null);
              if (fileInputRef.current) fileInputRef.current.value = "";
              queryClient.invalidateQueries();
            },
            onError: (err: any) => {
              toast({
                variant: "destructive",
                title: "Restore gagal",
                description: err?.data?.error || err?.message || "Terjadi kesalahan",
              });
            },
          }
        );
      } catch (error: any) {
        toast({ variant: "destructive", title: "Gagal membaca file", description: error.message });
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight text-primary">Backup & Restore</h2>
        <p className="text-muted-foreground">Amankan data usaha Anda secara berkala.</p>
      </div>

      {isElectron && (
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-primary">
              <HardDrive className="h-5 w-5" />
              Pengaturan Auto-Backup
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
              Ubah Folder Auto-Backup
            </Button>
          </CardContent>
        </Card>
      )}

      {isElectron && (
        <Card className="border-amber-200 bg-amber-50/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-amber-800">
              <Database className="h-5 w-5" />
              Restore dari Auto-Backup (.db)
            </CardTitle>
            <CardDescription className="text-amber-700">
              Pulihkan data dari file auto-backup yang tersimpan otomatis saat menutup aplikasi.
              File auto-backup berformat <strong>.db</strong> dan tersimpan di folder auto-backup di atas.
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
              Pilih File Auto-Backup & Restore...
            </Button>
          </CardFooter>
        </Card>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Download className="h-5 w-5 text-primary" />
              Export Data
            </CardTitle>
            <CardDescription>
              {isElectron
                ? "Simpan data ke file JSON — pilih lokasi penyimpanan sesuka Anda."
                : "Unduh seluruh data pelanggan, hutang, dan pembayaran dalam format JSON."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Lakukan backup secara rutin untuk menghindari kehilangan data. File yang disimpan
              dapat digunakan untuk restore kapan saja.
            </p>
          </CardContent>
          <CardFooter>
            <Button onClick={handleExport} disabled={isExporting} className="w-full sm:w-auto">
              {isExporting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Download className="mr-2 h-4 w-4" />
              )}
              {isElectron ? "Simpan File Backup..." : "Unduh File Backup"}
            </Button>
          </CardFooter>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5 text-orange-500" />
              Restore Data
            </CardTitle>
            <CardDescription>Kembalikan data dari file JSON backup sebelumnya.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert variant="destructive" className="bg-destructive/10 text-destructive border-destructive/20">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Perhatian!</AlertTitle>
              <AlertDescription className="text-xs mt-1">
                Melakukan restore akan menghapus semua data saat ini dan menggantinya dengan data
                dari file backup. Pastikan Anda sudah mengunduh backup terbaru sebelum melanjutkan.
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
              Mulai Restore
            </Button>
          </CardFooter>
        </Card>
      </div>

      <AlertDialog open={isConfirmRestoreOpen} onOpenChange={setIsConfirmRestoreOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Konfirmasi Restore Data</AlertDialogTitle>
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
                    <div className="font-semibold mb-1">Data yang akan direstore:</div>
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
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setIsConfirmRestoreOpen(false);
                handleImportConfirmed();
              }}
              className="bg-destructive text-destructive-foreground"
            >
              Ya, Restore Sekarang
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={isConfirmRestoreDBOpen} onOpenChange={setIsConfirmRestoreDBOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restore dari Auto-Backup?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>
                  Anda akan memilih file <strong>.db</strong> dari folder auto-backup.
                  Semua data saat ini akan <strong>dihapus dan diganti</strong> dengan isi file tersebut.
                </p>
                <p>Aplikasi akan memuat ulang otomatis setelah restore selesai.</p>
                <p className="text-destructive font-medium">Proses ini tidak dapat dibatalkan.</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
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
    </div>
  );
}
