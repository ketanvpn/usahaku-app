import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import {
  PENGATURAN_QUERY_KEY,
  savePengaturanBatch,
  usePengaturan,
} from "@/hooks/use-pengaturan";
import { getErrorMessage } from "@/lib/format";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Loader2,
  Store,
  Receipt,
  Upload,
  Trash2,
  Check,
  ImageIcon,
} from "lucide-react";
import { StrukPreview } from "@/components/struk-preview";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

// ── Schema form ──────────────────────────────────────────────────────────────
const usahaSchema = z.object({
  nama_usaha: z.string().min(2, "Nama usaha minimal 2 karakter"),
  telepon: z.string().optional(),
  alamat: z.string().optional(),
  catatan: z.string().optional(),
});
type UsahaForm = z.infer<typeof usahaSchema>;

const strukSchema = z.object({
  struk_header: z.string().max(500, "Maksimal 500 karakter").optional(),
  struk_footer: z.string().max(500, "Maksimal 500 karakter").optional(),
  struk_ukuran_kertas: z.enum(["58mm", "80mm", "A4"]),
  struk_tampilkan_logo: z.boolean(),
});
type StrukForm = z.infer<typeof strukSchema>;

// ── Helper: convert File ke base64 string (tanpa data: prefix) ────────────────
async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // result: "data:image/png;base64,xxxx" — kita ambil setelah comma
      const idx = result.indexOf(",");
      resolve(idx >= 0 ? result.slice(idx + 1) : result);
    };
    reader.onerror = () => reject(new Error("Gagal baca file"));
    reader.readAsDataURL(file);
  });
}

function getExtFromMime(mime: string): "png" | "jpg" | null {
  if (mime === "image/png") return "png";
  if (mime === "image/jpeg") return "jpg";
  return null;
}

// ── Sub-component: Logo Upload ───────────────────────────────────────────────
interface LogoUploadProps {
  usahaId: number;
  currentFilename: string | null;
  onChanged: () => void;
}

function LogoUpload({ usahaId, currentFilename, onChanged }: LogoUploadProps) {
  const { toast } = useToast();
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load preview saat filename berubah
  useEffect(() => {
    let cancelled = false;
    async function loadLogo() {
      if (!currentFilename || !window.electronApp?.pengaturan) {
        setLogoPreview(null);
        return;
      }
      const data = await window.electronApp.pengaturan.getLogoData(
        usahaId,
        currentFilename,
      );
      if (cancelled) return;
      if (data) {
        const ext = currentFilename.toLowerCase().endsWith(".png") ? "png" : "jpeg";
        setLogoPreview(`data:image/${ext};base64,${data}`);
      } else {
        setLogoPreview(null);
      }
    }
    void loadLogo();
    return () => {
      cancelled = true;
    };
  }, [usahaId, currentFilename]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!window.electronApp?.pengaturan) {
      toast({
        variant: "destructive",
        title: "Logo tidak tersedia",
        description: "Fitur logo hanya berjalan di aplikasi desktop Usahaku.",
      });
      return;
    }

    const ext = getExtFromMime(file.type);
    if (!ext) {
      toast({
        variant: "destructive",
        title: "Format tidak didukung",
        description: "Gunakan file PNG atau JPG.",
      });
      return;
    }

    if (file.size > 1024 * 1024) {
      toast({
        variant: "destructive",
        title: "Ukuran terlalu besar",
        description: "Logo maksimal 1 MB.",
      });
      return;
    }

    setUploading(true);
    try {
      const data = await fileToBase64(file);
      const result = await window.electronApp.pengaturan.saveLogo({
        usahaId,
        data,
        ext,
      });
      if (!result.success || !result.filename) {
        throw new Error(result.message ?? "Gagal menyimpan logo");
      }
      // Update logo_filename di server
      await savePengaturanBatch([
        { key: "logo_filename", value: result.filename },
      ]);
      toast({ title: "Logo berhasil diunggah" });
      onChanged();
    } catch (err: unknown) {
      toast({
        variant: "destructive",
        title: "Gagal mengunggah logo",
        description: getErrorMessage(err),
      });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDelete = async () => {
    if (!window.electronApp?.pengaturan) return;
    if (!confirm("Hapus logo? Logo akan hilang dari struk dan kwitansi.")) return;
    try {
      await window.electronApp.pengaturan.deleteLogo(usahaId);
      await savePengaturanBatch([{ key: "logo_filename", value: null }]);
      toast({ title: "Logo dihapus" });
      onChanged();
    } catch (err: unknown) {
      toast({
        variant: "destructive",
        title: "Gagal menghapus",
        description: getErrorMessage(err),
      });
    }
  };

  const isElectron = !!window.electronApp?.pengaturan;

  return (
    <div className="space-y-3">
      <label className="text-sm font-medium">Logo Usaha</label>
      <p className="text-xs text-muted-foreground">
        Logo tampil di struk kasir dan kwitansi pembayaran. Format PNG atau JPG, maks 1 MB.
      </p>

      <div className="flex items-start gap-4">
        <div className="h-24 w-24 rounded-md border-2 border-dashed border-muted-foreground/30 flex items-center justify-center bg-muted/20 overflow-hidden">
          {logoPreview ? (
            <img src={logoPreview} alt="Logo" className="max-h-full max-w-full object-contain" />
          ) : (
            <ImageIcon className="h-8 w-8 text-muted-foreground/50" />
          )}
        </div>

        <div className="flex flex-col gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg"
            className="hidden"
            onChange={handleFileChange}
            disabled={uploading || !isElectron}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading || !isElectron}
          >
            {uploading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Upload className="h-4 w-4 mr-2" />
            )}
            {currentFilename ? "Ganti Logo" : "Pilih File"}
          </Button>
          {currentFilename && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleDelete}
              disabled={uploading}
              className="text-destructive hover:text-destructive"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Hapus Logo
            </Button>
          )}
          {!isElectron && (
            <p className="text-xs text-amber-700">
              Logo hanya bisa diunggah di aplikasi desktop.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Halaman utama ────────────────────────────────────────────────────────────
export default function PengaturanPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const usahaId = user?.usaha_id ?? null;

  // Tab Usaha — query usaha existing
  const { data: usahaData, isLoading: usahaLoading } = useQuery({
    queryKey: ["usaha-mine", usahaId],
    enabled: !!usahaId,
    queryFn: async () => {
      const r = await fetch(`${BASE}/api/usaha/${usahaId}`, { credentials: "include" });
      if (!r.ok) return null;
      return r.json() as Promise<{
        id: number;
        nama_usaha: string;
        telepon: string | null;
        alamat: string | null;
        catatan: string | null;
      }>;
    },
  });

  const usahaForm = useForm<UsahaForm>({
    resolver: zodResolver(usahaSchema),
    values: {
      nama_usaha: usahaData?.nama_usaha ?? "",
      telepon: usahaData?.telepon ?? "",
      alamat: usahaData?.alamat ?? "",
      catatan: usahaData?.catatan ?? "",
    },
  });

  const updateUsahaMutation = useMutation({
    mutationFn: async (values: UsahaForm) => {
      const res = await fetch(`${BASE}/api/usaha/mine`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(values),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal menyimpan");
      return data;
    },
    onSuccess: () => {
      toast({ title: "Data usaha berhasil disimpan" });
      queryClient.invalidateQueries({ queryKey: ["usaha-mine"] });
    },
    onError: (err: unknown) => {
      toast({
        variant: "destructive",
        title: "Gagal menyimpan",
        description: getErrorMessage(err),
      });
    },
  });

  // Tab Struk — query pengaturan
  const { data: pengaturan, isLoading: pengaturanLoading } = usePengaturan();

  const strukForm = useForm<StrukForm>({
    resolver: zodResolver(strukSchema),
    values: {
      struk_header: pengaturan?.struk_header ?? "",
      struk_footer: pengaturan?.struk_footer ?? "Terima kasih atas kunjungan Anda",
      struk_ukuran_kertas: pengaturan?.struk_ukuran_kertas ?? "80mm",
      struk_tampilkan_logo: pengaturan?.struk_tampilkan_logo === "1",
    },
  });

  const updateStrukMutation = useMutation({
    mutationFn: async (values: StrukForm) => {
      await savePengaturanBatch([
        { key: "struk_header", value: values.struk_header ?? "" },
        { key: "struk_footer", value: values.struk_footer ?? "" },
        { key: "struk_ukuran_kertas", value: values.struk_ukuran_kertas },
        { key: "struk_tampilkan_logo", value: values.struk_tampilkan_logo ? "1" : "0" },
      ]);
    },
    onSuccess: () => {
      toast({ title: "Pengaturan struk berhasil disimpan" });
      queryClient.invalidateQueries({ queryKey: PENGATURAN_QUERY_KEY });
    },
    onError: (err: unknown) => {
      toast({
        variant: "destructive",
        title: "Gagal menyimpan",
        description: getErrorMessage(err),
      });
    },
  });

  if (!usahaId) {
    return (
      <div className="space-y-6">
        <h2 className="text-3xl font-bold tracking-tight text-primary">Pengaturan</h2>
        <p className="text-muted-foreground">
          Anda belum terhubung ke usaha tertentu. Hubungi administrator.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight text-primary">Pengaturan</h2>
        <p className="text-muted-foreground">
          Atur data usaha Anda dan tampilan struk yang dicetak.
        </p>
      </div>

      <Tabs defaultValue="usaha" className="max-w-3xl">
        <TabsList>
          <TabsTrigger value="usaha">
            <Store className="h-4 w-4 mr-2" />
            Data Usaha
          </TabsTrigger>
          <TabsTrigger value="struk">
            <Receipt className="h-4 w-4 mr-2" />
            Struk &amp; Cetak
          </TabsTrigger>
        </TabsList>

        {/* ── Tab Usaha ────────────────────────────────────────────────── */}
        <TabsContent value="usaha" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Data Usaha</CardTitle>
              <CardDescription>
                Informasi ini tampil di struk kasir, kwitansi, dan laporan cetak.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {usahaLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Memuat...
                </div>
              ) : (
                <Form {...usahaForm}>
                  <form
                    onSubmit={usahaForm.handleSubmit((v) => updateUsahaMutation.mutate(v))}
                    className="space-y-4"
                  >
                    <FormField
                      control={usahaForm.control}
                      name="nama_usaha"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Nama Usaha</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="Contoh: Toko ABC Sembako" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={usahaForm.control}
                      name="telepon"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Nomor Telepon</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="08xx-xxxx-xxxx" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={usahaForm.control}
                      name="alamat"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Alamat</FormLabel>
                          <FormControl>
                            <Textarea {...field} placeholder="Jl. Contoh No. 123" rows={2} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={usahaForm.control}
                      name="catatan"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Catatan (opsional)</FormLabel>
                          <FormControl>
                            <Textarea {...field} placeholder="Catatan internal" rows={2} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <Button
                      type="submit"
                      disabled={updateUsahaMutation.isPending}
                    >
                      {updateUsahaMutation.isPending ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Check className="h-4 w-4 mr-2" />
                      )}
                      Simpan Data Usaha
                    </Button>
                  </form>
                </Form>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Logo</CardTitle>
              <CardDescription>
                Logo yang akan dicetak di header struk dan kwitansi.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {pengaturanLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Memuat...
                </div>
              ) : (
                <LogoUpload
                  usahaId={usahaId}
                  currentFilename={pengaturan?.logo_filename ?? null}
                  onChanged={() =>
                    queryClient.invalidateQueries({ queryKey: PENGATURAN_QUERY_KEY })
                  }
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Tab Struk ───────────────────────────────────────────────── */}
        <TabsContent value="struk" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Struk &amp; Cetak</CardTitle>
              <CardDescription>
                Atur teks tambahan, ukuran kertas, dan tampilan logo pada struk.
                Pratinjau di kanan akan ikut berubah saat field diedit.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {pengaturanLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Memuat...
                </div>
              ) : (
                <div className="grid gap-6 lg:grid-cols-2">
                <Form {...strukForm}>
                  <form
                    onSubmit={strukForm.handleSubmit((v) => updateStrukMutation.mutate(v))}
                    className="space-y-4"
                  >
                    <FormField
                      control={strukForm.control}
                      name="struk_header"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Teks Header Tambahan</FormLabel>
                          <FormControl>
                            <Textarea
                              {...field}
                              placeholder="Contoh: Buka 08:00-21:00 / Free WiFi"
                              rows={2}
                            />
                          </FormControl>
                          <FormDescription>
                            Tampil di atas alamat usaha pada struk dan kwitansi. Kosongkan jika tidak perlu.
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={strukForm.control}
                      name="struk_footer"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Teks Footer</FormLabel>
                          <FormControl>
                            <Textarea
                              {...field}
                              placeholder="Terima kasih atas kunjungan Anda"
                              rows={2}
                            />
                          </FormControl>
                          <FormDescription>
                            Tampil di bawah total struk. Cocok untuk ucapan terima kasih atau info kembali lagi.
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={strukForm.control}
                      name="struk_ukuran_kertas"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Ukuran Kertas Default</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="58mm">58mm — Struk thermal kecil</SelectItem>
                              <SelectItem value="80mm">80mm — Struk thermal standar</SelectItem>
                              <SelectItem value="A4">A4 — Printer kantor / kwitansi</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormDescription>
                            Default akan dipakai saat cetak struk dan kwitansi.
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={strukForm.control}
                      name="struk_tampilkan_logo"
                      render={({ field }) => (
                        <FormItem className="flex items-center justify-between rounded-md border p-3">
                          <div className="space-y-0.5 pr-4">
                            <FormLabel className="cursor-pointer">Tampilkan Logo di Struk</FormLabel>
                            <FormDescription>
                              Aktifkan jika sudah upload logo di tab Data Usaha.
                            </FormDescription>
                          </div>
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <Button
                      type="submit"
                      disabled={updateStrukMutation.isPending}
                    >
                      {updateStrukMutation.isPending ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Check className="h-4 w-4 mr-2" />
                      )}
                      Simpan Pengaturan Struk
                    </Button>
                  </form>
                </Form>

                {/* Live preview — sinkron dengan field di atas */}
                {pengaturan && (
                  <StrukPreview
                    pengaturan={{
                      struk_header: strukForm.watch("struk_header") ?? "",
                      struk_footer: strukForm.watch("struk_footer") ?? "",
                      struk_ukuran_kertas: strukForm.watch("struk_ukuran_kertas"),
                      struk_tampilkan_logo: strukForm.watch("struk_tampilkan_logo") ? "1" : "0",
                      logo_filename: pengaturan.logo_filename,
                    }}
                    namaUsaha={usahaForm.watch("nama_usaha") || usahaData?.nama_usaha || "Usahaku"}
                    alamat={usahaForm.watch("alamat") || usahaData?.alamat || null}
                    telepon={usahaForm.watch("telepon") || usahaData?.telepon || null}
                    usahaId={usahaId}
                  />
                )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
