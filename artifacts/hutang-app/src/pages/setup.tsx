import { useState } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle2, KeyRound, Store, User, Loader2 } from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

const setupSchema = z.object({
  licenseKey: z.string().min(1, "License key wajib diisi"),
  namaUsaha: z.string().min(2, "Nama usaha minimal 2 karakter"),
  alamat: z.string().optional(),
  telepon: z.string().optional(),
  namaPemilik: z.string().min(2, "Nama pemilik minimal 2 karakter"),
  username: z.string().min(3, "Username minimal 3 karakter").regex(/^[a-zA-Z0-9_]+$/, "Username hanya boleh huruf, angka, dan underscore"),
  password: z.string().min(6, "Password minimal 6 karakter"),
  konfirmasiPassword: z.string().min(1, "Konfirmasi password wajib diisi"),
}).refine((d) => d.password === d.konfirmasiPassword, {
  message: "Password tidak cocok",
  path: ["konfirmasiPassword"],
});

type SetupForm = z.infer<typeof setupSchema>;

export default function SetupPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [done, setDone] = useState(false);
  const [lisensiInfo, setLisensiInfo] = useState<{ tipe: string; sisa_hari: number } | null>(null);

  const form = useForm<SetupForm>({
    resolver: zodResolver(setupSchema),
    defaultValues: {
      licenseKey: "",
      namaUsaha: "",
      alamat: "",
      telepon: "",
      namaPemilik: "",
      username: "",
      password: "",
      konfirmasiPassword: "",
    },
  });

  const onSubmit = async (values: SetupForm) => {
    try {
      const res = await fetch(`${BASE}/api/setup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          licenseKey: values.licenseKey,
          namaUsaha: values.namaUsaha,
          alamat: values.alamat,
          telepon: values.telepon,
          namaPemilik: values.namaPemilik,
          username: values.username,
          password: values.password,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        form.setError("root", { message: data.error });
        return;
      }
      setLisensiInfo({ tipe: data.tipe, sisa_hari: data.sisa_hari });
      setDone(true);
      queryClient.invalidateQueries({ queryKey: ["setup-status"] });
    } catch {
      form.setError("root", { message: "Terjadi kesalahan. Coba lagi." });
    }
  };

  const TIPE_LABEL: Record<string, string> = {
    harian: "Harian",
    bulanan: "Bulanan (30 hari)",
    tahunan: "Tahunan (365 hari)",
  };

  if (done) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
        <Card className="w-full max-w-sm shadow-lg text-center">
          <CardContent className="pt-10 pb-8 flex flex-col items-center gap-4">
            <CheckCircle2 className="h-16 w-16 text-green-500" />
            <h2 className="text-2xl font-bold text-primary">Setup Berhasil!</h2>
            <p className="text-muted-foreground text-sm">
              Akun dan toko Anda telah dibuat.
            </p>
            {lisensiInfo && (
              <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 w-full text-sm">
                <p className="font-medium text-green-800">Lisensi Aktif</p>
                <p className="text-green-700">{TIPE_LABEL[lisensiInfo.tipe] ?? lisensiInfo.tipe} — sisa {lisensiInfo.sisa_hari} hari</p>
              </div>
            )}
            <Button className="w-full mt-2" onClick={() => setLocation("/login")}>
              Masuk Sekarang
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-lg shadow-lg border-primary/10">
        <CardHeader className="text-center bg-primary/5 pb-6 pt-8 rounded-t-lg">
          <CardTitle className="text-2xl font-bold text-primary tracking-tight">Usahaku</CardTitle>
          <CardDescription>by KetanTech — Setup Awal Aplikasi</CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">

              <div className="flex items-center gap-2 text-sm font-semibold text-primary border-b pb-2">
                <KeyRound className="h-4 w-4" /> Aktivasi Lisensi
              </div>
              <FormField control={form.control} name="licenseKey" render={({ field }) => (
                <FormItem>
                  <FormLabel>License Key <span className="text-destructive">*</span></FormLabel>
                  <FormControl>
                    <Input placeholder="BUKU-XXXX-XXXX-XXXX-XXXX-XXXX" {...field}
                      onChange={(e) => field.onChange(e.target.value.toUpperCase())} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <div className="flex items-center gap-2 text-sm font-semibold text-primary border-b pb-2 pt-2">
                <Store className="h-4 w-4" /> Data Usaha / Toko
              </div>
              <FormField control={form.control} name="namaUsaha" render={({ field }) => (
                <FormItem>
                  <FormLabel>Nama Usaha / Toko <span className="text-destructive">*</span></FormLabel>
                  <FormControl><Input placeholder="Contoh: Toko Sumber Rejeki" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <div className="grid grid-cols-2 gap-3">
                <FormField control={form.control} name="telepon" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Telepon</FormLabel>
                    <FormControl><Input placeholder="08xxxxxxxxxx" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="alamat" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Alamat</FormLabel>
                    <FormControl><Input placeholder="Jl. ..." {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              <div className="flex items-center gap-2 text-sm font-semibold text-primary border-b pb-2 pt-2">
                <User className="h-4 w-4" /> Akun Pemilik
              </div>
              <FormField control={form.control} name="namaPemilik" render={({ field }) => (
                <FormItem>
                  <FormLabel>Nama Lengkap Pemilik <span className="text-destructive">*</span></FormLabel>
                  <FormControl><Input placeholder="Nama lengkap" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="username" render={({ field }) => (
                <FormItem>
                  <FormLabel>Username <span className="text-destructive">*</span></FormLabel>
                  <FormControl><Input placeholder="username untuk login" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <div className="grid grid-cols-2 gap-3">
                <FormField control={form.control} name="password" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password <span className="text-destructive">*</span></FormLabel>
                    <FormControl><Input type="password" placeholder="Min. 6 karakter" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="konfirmasiPassword" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Konfirmasi Password <span className="text-destructive">*</span></FormLabel>
                    <FormControl><Input type="password" placeholder="Ulangi password" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              {form.formState.errors.root && (
                <div className="bg-destructive/10 border border-destructive/20 rounded-md px-4 py-3 text-sm text-destructive">
                  {form.formState.errors.root.message}
                </div>
              )}

              <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? (
                  <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Memproses...</>
                ) : "Mulai Setup"}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
