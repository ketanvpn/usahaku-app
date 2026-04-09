import { useState, useRef } from "react";
import { getExportBackupUrl, useImportBackup, getGetOwnerDashboardQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Loader2, Download, Upload, AlertTriangle, FileJson } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export default function BackupPage() {
  const [isExporting, setIsExporting] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const importMutation = useImportBackup();

  const handleExport = async () => {
    setIsExporting(true);
    try {
      // Create a link to download the JSON data
      const response = await fetch(getExportBackupUrl());
      if (!response.ok) throw new Error("Gagal mengunduh backup");
      
      const data = await response.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = `backup_hutang_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast({ title: "Backup berhasil diunduh" });
    } catch (error: any) {
      toast({ variant: "destructive", title: "Gagal export", description: error.message });
    } finally {
      setIsExporting(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
    }
  };

  const handleImport = async () => {
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const jsonStr = e.target?.result as string;
        const data = JSON.parse(jsonStr);
        
        // Basic validation
        if (!data.version || !data.usaha_id) {
          throw new Error("Format file backup tidak valid.");
        }
        
        importMutation.mutate(
          { data },
          {
            onSuccess: () => {
              toast({ title: "Restore data berhasil!" });
              setFile(null);
              if (fileInputRef.current) fileInputRef.current.value = '';
              // Invalidate all queries to refresh UI
              queryClient.invalidateQueries();
            },
            onError: (err: any) => {
              toast({ variant: "destructive", title: "Restore gagal", description: err?.error || "Terjadi kesalahan" });
            }
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
              Penting untuk melakukan backup secara rutin untuk menghindari kehilangan data.
              Data yang diunduh dapat direstore kapan saja.
            </p>
          </CardContent>
          <CardFooter>
            <Button onClick={handleExport} disabled={isExporting} className="w-full sm:w-auto">
              {isExporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
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
            <CardDescription>
              Kembalikan data dari file JSON backup sebelumnya.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert variant="destructive" className="bg-destructive/10 text-destructive border-destructive/20">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Perhatian!</AlertTitle>
              <AlertDescription className="text-xs mt-1">
                Melakukan restore akan menimpa data yang ada saat ini jika terjadi konflik ID. Lakukan dengan hati-hati.
              </AlertDescription>
            </Alert>
            
            <div className="grid w-full max-w-sm items-center gap-1.5">
              <input
                type="file"
                accept=".json"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                onChange={handleFileChange}
                ref={fileInputRef}
              />
            </div>
            
            {file && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground p-2 bg-muted rounded">
                <FileJson className="h-4 w-4" /> {file.name}
              </div>
            )}
          </CardContent>
          <CardFooter>
            <Button 
              variant="destructive" 
              onClick={handleImport} 
              disabled={!file || importMutation.isPending} 
              className="w-full sm:w-auto"
            >
              {importMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
              Mulai Restore
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
