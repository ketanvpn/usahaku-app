import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useLogout } from "@workspace/api-client-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { UserCircle, Shield, LogOut, Loader2, KeyRound, Check, Store, Phone, MapPin, Pencil, X } from "lucide-react";
import { formatDate } from "@/lib/format";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

const usahaSchema = z.object({
  nama_usaha: z.string().min(2, "Nama usaha minimal 2 karakter"),
  telepon: z.string().optional(),
  alamat: z.string().optional(),
  catatan: z.string().optional(),
});
type UsahaForm = z.infer<typeof usahaSchema>;

const changePasswordSchema = z
  .object({
    current_password: z.string().min(1, { message: "Password lama wajib diisi" }),
    new_password: z.string().min(6, { message: "Password baru minimal 6 karakter" }),
    confirm_password: z.string().min(1, { message: "Konfirmasi password wajib diisi" }),
  })
  .refine((data) => data.new_password === data.confirm_password, {
    message: "Konfirmasi password tidak cocok",
    path: ["confirm_password"],
  });

type ChangePasswordValues = z.infer<typeof changePasswordSchema>;

export default function ProfilPage() {
  const { user, logout } = useAuth();
  const logoutMutation = useLogout();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [pwdSuccess, setPwdSuccess] = useState(false);
  const [editingUsaha, setEditingUsaha] = useState(false);

  const { data: usahaData, isLoading: usahaLoading } = useQuery({
    queryKey: ["usaha-mine", user?.usaha_id],
    enabled: !!user?.usaha_id,
    queryFn: async () => {
      const r = await fetch(`${BASE}/api/usaha/${user!.usaha_id}`, { credentials: "include" });
      if (!r.ok) return null;
      return r.json() as Promise<{ id: number; nama_usaha: string; telepon: string | null; alamat: string | null; catatan: string | null; created_at: string }>;
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
      toast({ title: "Data usaha berhasil diperbarui" });
      queryClient.invalidateQueries({ queryKey: ["usaha-mine"] });
      setEditingUsaha(false);
    },
    onError: (err: any) => {
      toast({ variant: "destructive", title: "Gagal", description: err.message });
    },
  });

  const pwdForm = useForm<ChangePasswordValues>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: {
      current_password: "",
      new_password: "",
      confirm_password: "",
    },
  });

  const changePasswordMutation = useMutation({
    mutationFn: async (values: { current_password: string; new_password: string }) => {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(values),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Terjadi kesalahan");
      }
      return data;
    },
  });

  const handleLogout = () => {
    logoutMutation.mutate(undefined, {
      onSuccess: () => {
        logout();
      },
    });
  };

  const onChangePwd = (values: ChangePasswordValues) => {
    setPwdSuccess(false);
    changePasswordMutation.mutate(
      { current_password: values.current_password, new_password: values.new_password },
      {
        onSuccess: () => {
          toast({ title: "Password berhasil diubah" });
          pwdForm.reset();
          setPwdSuccess(true);
        },
        onError: (err: any) => {
          toast({
            variant: "destructive",
            title: "Gagal mengubah password",
            description: err.message || "Terjadi kesalahan",
          });
        },
      }
    );
  };

  if (!user) return null;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight text-primary">Profil Pengguna</h2>
        <p className="text-muted-foreground">Informasi akun dan pengaturan keamanan.</p>
      </div>

      <div className="max-w-2xl space-y-6">
        <Card className="shadow-md">
          <CardHeader className="bg-primary/5 pb-8 pt-8">
            <div className="flex items-center gap-4">
              <div className="h-16 w-16 bg-primary rounded-full flex items-center justify-center text-primary-foreground shadow-inner">
                <UserCircle className="h-10 w-10" />
              </div>
              <div>
                <CardTitle className="text-2xl">{user.nama}</CardTitle>
                <CardDescription className="flex items-center gap-1 mt-1">
                  <Shield className="h-3 w-3" />
                  {user.role === "super_admin" ? "Super Administrator" : "Owner Usaha"}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-1">
                <label className="text-sm font-medium text-muted-foreground">Username</label>
                <div className="font-medium text-lg">{user.username}</div>
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium text-muted-foreground">Status Akun</label>
                <div>
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
                    Aktif
                  </span>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium text-muted-foreground">Terdaftar Sejak</label>
                <div className="font-medium">{formatDate(user.created_at)}</div>
              </div>

              {user.usaha_id && (
                <div className="space-y-1">
                  <label className="text-sm font-medium text-muted-foreground">ID Usaha Terhubung</label>
                  <div className="font-medium">#{user.usaha_id}</div>
                </div>
              )}
            </div>
          </CardContent>
          <CardFooter className="bg-muted/30 border-t border-border mt-6 pt-6">
            <Button
              variant="destructive"
              onClick={handleLogout}
              disabled={logoutMutation.isPending}
              className="w-full sm:w-auto"
            >
              {logoutMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <LogOut className="mr-2 h-4 w-4" />
              )}
              Keluar Akun
            </Button>
          </CardFooter>
        </Card>

        {user.role === "owner" && (
          <Card className="shadow-md">
            <CardHeader className="flex flex-row items-center justify-between">
              <div className="flex items-center gap-2">
                <Store className="h-5 w-5 text-primary" />
                <div>
                  <CardTitle>Info Usaha / Toko</CardTitle>
                  <CardDescription>Data toko yang terhubung ke akun Anda.</CardDescription>
                </div>
              </div>
              {!editingUsaha && (
                <Button variant="outline" size="sm" onClick={() => setEditingUsaha(true)}>
                  <Pencil className="h-4 w-4 mr-1" /> Edit
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {usahaLoading ? (
                <div className="flex justify-center py-6"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
              ) : !usahaData ? (
                <p className="text-sm text-muted-foreground">Data usaha tidak ditemukan.</p>
              ) : editingUsaha ? (
                <Form {...usahaForm}>
                  <form onSubmit={usahaForm.handleSubmit((v) => updateUsahaMutation.mutate(v))} className="space-y-4">
                    <FormField control={usahaForm.control} name="nama_usaha" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nama Usaha / Toko</FormLabel>
                        <FormControl><Input {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={usahaForm.control} name="telepon" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nomor Telepon</FormLabel>
                        <FormControl><Input placeholder="08xxxxxxxxxx" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={usahaForm.control} name="alamat" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Alamat</FormLabel>
                        <FormControl><Input placeholder="Jl. ..." {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={usahaForm.control} name="catatan" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Catatan</FormLabel>
                        <FormControl><Textarea placeholder="Keterangan tambahan..." rows={3} {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <div className="flex gap-2">
                      <Button type="submit" disabled={updateUsahaMutation.isPending}>
                        {updateUsahaMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Check className="h-4 w-4 mr-1" />}
                        Simpan
                      </Button>
                      <Button type="button" variant="outline" onClick={() => { setEditingUsaha(false); usahaForm.reset(); }}>
                        <X className="h-4 w-4 mr-1" /> Batal
                      </Button>
                    </div>
                  </form>
                </Form>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <Store className="h-4 w-4 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="text-xs text-muted-foreground">Nama Usaha</p>
                      <p className="font-semibold text-lg">{usahaData.nama_usaha}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Phone className="h-4 w-4 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="text-xs text-muted-foreground">Nomor Telepon</p>
                      <p className="font-medium">{usahaData.telepon || <span className="text-muted-foreground italic">Belum diisi</span>}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="text-xs text-muted-foreground">Alamat</p>
                      <p className="font-medium">{usahaData.alamat || <span className="text-muted-foreground italic">Belum diisi</span>}</p>
                    </div>
                  </div>
                  {usahaData.catatan && (
                    <div className="flex items-start gap-3">
                      <div className="h-4 w-4 mt-0.5" />
                      <div>
                        <p className="text-xs text-muted-foreground">Catatan</p>
                        <p className="font-medium">{usahaData.catatan}</p>
                      </div>
                    </div>
                  )}
                  <div className="flex items-start gap-3 pt-2 border-t">
                    <div className="h-4 w-4 mt-0.5" />
                    <div>
                      <p className="text-xs text-muted-foreground">Terdaftar Sejak</p>
                      <p className="font-medium">{formatDate(usahaData.created_at)}</p>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <Card className="shadow-md">
          <CardHeader>
            <div className="flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-primary" />
              <CardTitle>Ganti Password</CardTitle>
            </div>
            <CardDescription>
              Gunakan password yang kuat dan tidak mudah ditebak. Minimal 6 karakter.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {pwdSuccess && (
              <div className="flex items-center gap-2 mb-4 p-3 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm">
                <Check className="h-4 w-4" />
                Password berhasil diubah.
              </div>
            )}
            <Form {...pwdForm}>
              <form onSubmit={pwdForm.handleSubmit(onChangePwd)} className="space-y-4">
                <FormField
                  control={pwdForm.control}
                  name="current_password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Password Lama</FormLabel>
                      <FormControl>
                        <Input type="password" placeholder="Masukkan password lama" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={pwdForm.control}
                  name="new_password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Password Baru</FormLabel>
                      <FormControl>
                        <Input type="password" placeholder="Minimal 6 karakter" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={pwdForm.control}
                  name="confirm_password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Konfirmasi Password Baru</FormLabel>
                      <FormControl>
                        <Input type="password" placeholder="Ketik ulang password baru" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button
                  type="submit"
                  disabled={changePasswordMutation.isPending}
                  className="w-full sm:w-auto"
                >
                  {changePasswordMutation.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <KeyRound className="mr-2 h-4 w-4" />
                  )}
                  Simpan Password Baru
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
