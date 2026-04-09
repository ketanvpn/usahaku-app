import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useLogout } from "@workspace/api-client-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { UserCircle, Shield, LogOut, Loader2, KeyRound, Check } from "lucide-react";
import { formatDate } from "@/lib/format";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

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
  const [pwdSuccess, setPwdSuccess] = useState(false);

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
