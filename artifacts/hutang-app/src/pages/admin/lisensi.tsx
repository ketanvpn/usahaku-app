import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Loader2, Plus, Copy, Trash2, Key, CheckCircle2, Clock } from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

interface LicenseKey {
  id: number;
  key: string;
  tipe: "1bulan" | "3bulan" | "6bulan" | "1tahun";
  expires_at: string;
  is_used: boolean;
  used_at: string | null;
  created_at: string;
}

const TIPE_LABEL: Record<string, string> = {
  "1bulan": "1 Bulan (30 hari)",
  "3bulan": "3 Bulan (90 hari)",
  "6bulan": "6 Bulan (180 hari)",
  "1tahun": "1 Tahun (365 hari)",
};

const TIPE_COLOR: Record<string, string> = {
  "1bulan": "bg-blue-100 text-blue-700 border-blue-200",
  "3bulan": "bg-cyan-100 text-cyan-700 border-cyan-200",
  "6bulan": "bg-violet-100 text-violet-700 border-violet-200",
  "1tahun": "bg-purple-100 text-purple-700 border-purple-200",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("id-ID", {
    day: "2-digit", month: "long", year: "numeric",
  });
}

async function fetchKeys(): Promise<LicenseKey[]> {
  const r = await fetch(`${BASE}/api/lisensi`, { credentials: "include" });
  if (!r.ok) throw new Error("Gagal memuat data");
  return r.json();
}

async function generateKey(tipe: string): Promise<LicenseKey> {
  const r = await fetch(`${BASE}/api/lisensi/generate`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tipe }),
  });
  if (!r.ok) {
    const e = await r.json().catch(() => ({}));
    throw new Error(e.error || "Gagal generate key");
  }
  return r.json();
}

async function deleteKey(id: number): Promise<void> {
  const r = await fetch(`${BASE}/api/lisensi/${id}`, {
    method: "DELETE",
    credentials: "include",
  });
  if (!r.ok) {
    const e = await r.json().catch(() => ({}));
    throw new Error(e.error || "Gagal menghapus key");
  }
}

export default function AdminLisensiPage() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const [tipe, setTipe] = useState<string>("1bulan");
  const [newKey, setNewKey] = useState<LicenseKey | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<LicenseKey | null>(null);

  const { data: keys = [], isLoading } = useQuery({
    queryKey: ["admin-lisensi"],
    queryFn: fetchKeys,
  });

  const generateMutation = useMutation({
    mutationFn: () => generateKey(tipe),
    onSuccess: (key) => {
      setNewKey(key);
      qc.invalidateQueries({ queryKey: ["admin-lisensi"] });
    },
    onError: (e: Error) => toast({ title: "Gagal", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteKey(id),
    onSuccess: () => {
      toast({ title: "Key dihapus" });
      setDeleteTarget(null);
      qc.invalidateQueries({ queryKey: ["admin-lisensi"] });
    },
    onError: (e: Error) => toast({ title: "Gagal", description: e.message, variant: "destructive" }),
  });

  function copyKey(key: string) {
    navigator.clipboard.writeText(key).then(() => {
      toast({ title: "Key disalin!", description: "Kirimkan key ini ke Owner." });
    });
  }

  const totalKeys = keys.length;
  const usedKeys = keys.filter((k) => k.is_used).length;
  const unusedKeys = totalKeys - usedKeys;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight text-primary">Manajemen Lisensi</h2>
        <p className="text-muted-foreground">Generate dan kelola license key untuk Owner.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-primary/10 p-2"><Key className="h-5 w-5 text-primary" /></div>
              <div>
                <p className="text-sm text-muted-foreground">Total Key</p>
                <p className="text-2xl font-bold">{totalKeys}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-green-100 p-2"><CheckCircle2 className="h-5 w-5 text-green-600" /></div>
              <div>
                <p className="text-sm text-muted-foreground">Sudah Dipakai</p>
                <p className="text-2xl font-bold text-green-600">{usedKeys}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-orange-100 p-2"><Clock className="h-5 w-5 text-orange-600" /></div>
              <div>
                <p className="text-sm text-muted-foreground">Belum Dipakai</p>
                <p className="text-2xl font-bold text-orange-600">{unusedKeys}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Generate Key Baru</CardTitle>
          <CardDescription>Pilih tipe lisensi lalu klik Generate. Key berlaku sejak hari ini.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-3">
            <Select value={tipe} onValueChange={setTipe}>
              <SelectTrigger className="w-full sm:w-64">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1bulan">1 Bulan (30 hari)</SelectItem>
                <SelectItem value="3bulan">3 Bulan (90 hari)</SelectItem>
                <SelectItem value="6bulan">6 Bulan (180 hari)</SelectItem>
                <SelectItem value="1tahun">1 Tahun (365 hari)</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={() => generateMutation.mutate()} disabled={generateMutation.isPending}>
              {generateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
              Generate Key
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Daftar License Key</CardTitle>
          <CardDescription>Semua key yang pernah di-generate. Salin key lalu kirim ke Owner.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : keys.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Belum ada license key. Generate key pertama di atas.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>License Key</TableHead>
                    <TableHead>Tipe</TableHead>
                    <TableHead>Berlaku s/d</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Dibuat</TableHead>
                    <TableHead className="w-24">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {keys.map((k) => (
                    <TableRow key={k.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <code className="text-xs font-mono bg-muted px-2 py-1 rounded">{k.key}</code>
                          {!k.is_used && (
                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => copyKey(k.key)}>
                              <Copy className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${TIPE_COLOR[k.tipe] ?? "bg-gray-100 text-gray-700"}`}>
                          {TIPE_LABEL[k.tipe] ?? k.tipe}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm">{formatDate(k.expires_at)}</TableCell>
                      <TableCell>
                        {k.is_used ? (
                          <Badge className="bg-green-100 text-green-700 hover:bg-green-100">Terpakai</Badge>
                        ) : (
                          <Badge variant="outline" className="text-orange-600 border-orange-300">Belum dipakai</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{formatDate(k.created_at)}</TableCell>
                      <TableCell>
                        {!k.is_used && (
                          <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => setDeleteTarget(k)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!newKey} onOpenChange={() => setNewKey(null)}>
        <DialogContent aria-describedby={undefined} className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-green-600">
              <CheckCircle2 className="h-5 w-5" /> Key Berhasil Dibuat!
            </DialogTitle>
          </DialogHeader>
          {newKey && (
            <div className="space-y-4">
              <div className="rounded-lg border-2 border-primary/20 bg-primary/5 p-4 text-center">
                <p className="text-xs text-muted-foreground mb-2">License Key</p>
                <code className="text-lg font-mono font-bold tracking-widest text-primary">{newKey.key}</code>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="rounded bg-muted p-2">
                  <p className="text-xs text-muted-foreground">Tipe</p>
                  <p className="font-medium capitalize">{newKey.tipe}</p>
                </div>
                <div className="rounded bg-muted p-2">
                  <p className="text-xs text-muted-foreground">Berlaku s/d</p>
                  <p className="font-medium">{formatDate(newKey.expires_at)}</p>
                </div>
              </div>
              <p className="text-sm text-muted-foreground text-center">
                Salin key ini lalu kirimkan ke Owner (WhatsApp, SMS, dll).
              </p>
              <Button className="w-full" onClick={() => copyKey(newKey.key)}>
                <Copy className="h-4 w-4 mr-2" /> Salin Key
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Key?</AlertDialogTitle>
            <AlertDialogDescription>
              Key <code className="font-mono text-xs">{deleteTarget?.key}</code> akan dihapus permanen dan tidak bisa digunakan lagi.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
              disabled={deleteMutation.isPending}>
              {deleteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
