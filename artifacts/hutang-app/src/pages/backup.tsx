import { useState, useRef } from "react";
import { getExportBackupUrl, useImportBackup, getGetOwnerDashboardQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Loader2, Download, Upload, AlertTriangle, FileJson, Users, ReceiptText, CreditCard } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface BackupPreview {
  pelanggan: number;
  hutang: number;
  pembayaran: number;
  usaha_id: number;
  exported_at?: string;
}

export default function BackupPage() {
  const [isExporting, setIsExporting] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<BackupPreview | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [isConfirmRestoreOpen, setIsConfirmRestoreOpen] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const importMutation = useImportBackup();

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const response = await fetch(getExportBackupUrl(), { credentials: "include" });
      if (!response.ok) throw new Error("Gagal mengunduh backup");

      const data = await response.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = `backup_hutang_${new Date().toISOString().split("T")[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      localStorage.setItem("lastBackupDate", new Date().toISOString());
      toast({ title: "Backup berhasil diunduh" });
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

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Download className="h-5 w-5 text-primary" />
              Export Data
            </CardTitle>
            <CardDescription>
              Unduh seluruh data pelanggan, hutang, dan pembayaran dalam format JSON.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Lakukan backup secara rutin untuk menghindari kehilangan data. File yang diunduh
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
              Unduh File Backup
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
                <div className="text-sm font-semibold text-blue-800 mb-2 flex items-center gap-1">
                  <FileJson className="h-4 w-4" />
                  Preview Data: {file?.name}
                </div>
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
    </div>
  );
}
