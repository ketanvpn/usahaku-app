import { useEffect } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useLogin, getGetMeQueryKey } from "@workspace/api-client-react";
import { useAuth } from "@/hooks/use-auth";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { Loader2, BookOpen, ShieldCheck, TrendingUp, Package } from "lucide-react";

const loginSchema = z.object({
  username: z.string().min(1, { message: "Username tidak boleh kosong" }),
  password: z.string().min(1, { message: "Password tidak boleh kosong" }),
});

const fiturList = [
  { icon: BookOpen, text: "Catat hutang pelanggan dengan mudah" },
  { icon: TrendingUp, text: "Pantau keuangan masuk & keluar" },
  { icon: Package, text: "Kelola stok barang bisnis Anda" },
  { icon: ShieldCheck, text: "Data aman tersimpan di perangkat Anda" },
];

export default function LoginPage() {
  const { isAuthenticated, user, isLoading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const loginMutation = useLogin();

  const form = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: { username: "", password: "" },
  });

  useEffect(() => {
    if (!authLoading && isAuthenticated && user) {
      if (user.role === "super_admin") setLocation("/admin/dashboard");
      else setLocation("/dashboard");
    }
  }, [authLoading, isAuthenticated, user, setLocation]);

  if (authLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (isAuthenticated && user) return null;

  const onSubmit = (values: z.infer<typeof loginSchema>) => {
    loginMutation.mutate(
      { data: values },
      {
        onSuccess: () => {
          toast({ title: "Selamat datang kembali!" });
          queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
        },
        onError: (error: any) => {
          toast({
            variant: "destructive",
            title: "Login gagal",
            description: error?.data?.error || error?.message || "Username atau password salah",
          });
        },
      }
    );
  };

  return (
    <div className="min-h-screen flex">
      {/* Panel kiri — branding (hanya desktop) */}
      <div className="hidden lg:flex lg:w-[45%] bg-primary flex-col justify-between p-12 text-white relative overflow-hidden">
        {/* Dekorasi lingkaran */}
        <div className="absolute -top-20 -right-20 w-80 h-80 rounded-full bg-white/5" />
        <div className="absolute -bottom-32 -left-16 w-96 h-96 rounded-full bg-white/5" />
        <div className="absolute top-1/2 right-8 w-48 h-48 rounded-full bg-white/5" />

        {/* Logo & nama */}
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
              <BookOpen className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Usahaku</h1>
              <p className="text-white/60 text-xs">by KetanTech</p>
            </div>
          </div>
          <p className="text-white/80 text-base mt-4 leading-relaxed max-w-xs">
            Aplikasi pencatatan bisnis yang sederhana, cepat, dan bisa digunakan tanpa internet.
          </p>
        </div>

        {/* Fitur list */}
        <div className="relative z-10 space-y-4">
          {fiturList.map(({ icon: Icon, text }) => (
            <div key={text} className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-white/15 flex items-center justify-center shrink-0">
                <Icon className="h-4 w-4 text-white" />
              </div>
              <span className="text-white/85 text-sm">{text}</span>
            </div>
          ))}
        </div>

        {/* Footer */}
        <p className="relative z-10 text-white/40 text-xs">
          © {new Date().getFullYear()} KetanTech. Semua hak dilindungi.
        </p>
      </div>

      {/* Panel kanan — form login */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 bg-background">
        {/* Mobile: tampilkan nama app */}
        <div className="lg:hidden text-center mb-8">
          <div className="w-14 h-14 bg-primary rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-md">
            <BookOpen className="h-7 w-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-primary">Usahaku</h1>
          <p className="text-muted-foreground text-sm">by KetanTech</p>
        </div>

        <div className="w-full max-w-sm">
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-foreground">Masuk ke Akun Anda</h2>
            <p className="text-muted-foreground text-sm mt-1">
              Masukkan username dan password untuk melanjutkan.
            </p>
          </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
              <FormField
                control={form.control}
                name="username"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-foreground font-medium">Username</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Masukkan username"
                        autoFocus
                        autoComplete="username"
                        className="h-11 bg-white"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-foreground font-medium">Password</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        placeholder="Masukkan password"
                        autoComplete="current-password"
                        className="h-11 bg-white"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button
                type="submit"
                className="w-full h-11 text-base font-semibold mt-2 shadow-sm"
                disabled={loginMutation.isPending}
              >
                {loginMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Memproses...
                  </>
                ) : (
                  "Masuk"
                )}
              </Button>
            </form>
          </Form>

          <p className="text-center text-xs text-muted-foreground mt-8">
            Hubungi administrator jika lupa password.
          </p>
        </div>
      </div>
    </div>
  );
}
