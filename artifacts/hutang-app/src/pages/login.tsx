import { useEffect, useRef, useState } from "react";
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
import { getErrorMessage } from "@/lib/format";
import { Loader2, BookOpen, ShieldCheck, TrendingUp, Package, KeyRound, ArrowLeft, User } from "lucide-react";

const loginSchema = z.object({
  username: z.string().min(1, { message: "Username tidak boleh kosong" }),
  password: z.string().min(1, { message: "Password tidak boleh kosong" }),
});

const resetSchema = z.object({
  username: z.string().min(1, { message: "Username tidak boleh kosong" }),
  reset_code: z.string().min(1, { message: "Kode reset tidak boleh kosong" }),
  new_password: z.string().min(6, { message: "Password baru minimal 6 karakter" }),
});

const fiturList = [
  { icon: BookOpen, text: "Catat hutang pelanggan dengan mudah" },
  { icon: TrendingUp, text: "Pantau keuangan masuk & keluar" },
  { icon: Package, text: "Kelola stok barang bisnis Anda" },
  { icon: ShieldCheck, text: "Data aman tersimpan di perangkat Anda" },
];

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

export default function LoginPage() {
  const { isAuthenticated, user, isLoading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const loginMutation = useLogin();
  const [showReset, setShowReset] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [showUsernames, setShowUsernames] = useState(false);
  const [usernameList, setUsernameList] = useState<{username: string; nama: string}[]>([]);
  const [isFetchingUsernames, setIsFetchingUsernames] = useState(false);
  const resetUsernameRef = useRef<HTMLInputElement>(null);

  const form = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: { username: "", password: "" },
  });

  const resetForm = useForm<z.infer<typeof resetSchema>>({
    resolver: zodResolver(resetSchema),
    defaultValues: { username: "", reset_code: "", new_password: "" },
  });

  useEffect(() => {
    if (!authLoading && isAuthenticated && user) {
      if (user.role === "super_admin") setLocation("/admin/dashboard");
      else setLocation("/dashboard");
    }
  }, [authLoading, isAuthenticated, user, setLocation]);

  useEffect(() => {
    if (!showReset) return undefined;
    const timer = setTimeout(() => {
      resetUsernameRef.current?.focus();
    }, 50);
    return () => clearTimeout(timer);
  }, [showReset]);

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
        onError: (error: unknown) => {
          toast({
            variant: "destructive",
            title: "Login gagal",
            description: getErrorMessage(error, "Username atau password salah"),
          });
        },
      }
    );
  };

  const handleShowUsernames = async () => {
    setIsFetchingUsernames(true);
    try {
      const res = await fetch(`${BASE}/api/auth/usernames`);
      if (res.ok) {
        const data = await res.json();
        setUsernameList(data);
        setShowUsernames(true);
      }
    } catch {
      toast({ variant: "destructive", title: "Gagal", description: "Tidak dapat memuat daftar akun." });
    } finally {
      setIsFetchingUsernames(false);
    }
  };

  const onResetSubmit = async (values: z.infer<typeof resetSchema>) => {
    setIsResetting(true);
    try {
      const res = await fetch(`${BASE}/api/auth/reset-with-code`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ variant: "destructive", title: "Gagal reset", description: data.error || "Terjadi kesalahan." });
      } else {
        toast({ title: "Password berhasil direset!", description: "Silakan login dengan password baru." });
        resetForm.reset();
        setShowReset(false);
      }
    } catch {
      toast({ variant: "destructive", title: "Gagal", description: "Tidak dapat terhubung ke server." });
    } finally {
      setIsResetting(false);
    }
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

          {/* ── Form Login (selalu ada di DOM, disembunyikan CSS) ── */}
          <div style={{ display: showReset ? "none" : undefined }}>
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

            <div className="flex flex-col items-center gap-2 mt-6">
              <button
                type="button"
                onClick={() => { setShowReset(true); resetForm.reset(); setShowUsernames(false); }}
                className="text-xs text-primary hover:underline inline-flex items-center gap-1"
              >
                <KeyRound className="h-3 w-3" />
                Lupa password? Reset dengan kode dari administrator
              </button>
              <button
                type="button"
                onClick={showUsernames ? () => setShowUsernames(false) : handleShowUsernames}
                disabled={isFetchingUsernames}
                className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 disabled:opacity-50"
              >
                {isFetchingUsernames ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <User className="h-3 w-3" />
                )}
                {showUsernames ? "Sembunyikan daftar akun" : "Lupa username? Lihat daftar akun"}
              </button>

              {showUsernames && (
                <div className="w-full mt-1 rounded-lg border bg-muted/50 p-3">
                  <p className="text-xs text-muted-foreground mb-2 font-medium">Akun yang terdaftar di perangkat ini:</p>
                  {usernameList.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic">Belum ada akun owner.</p>
                  ) : (
                    <div className="flex flex-col gap-1">
                      {usernameList.map((u) => (
                        <button
                          key={u.username}
                          type="button"
                          onClick={() => {
                            form.setValue("username", u.username);
                            setShowUsernames(false);
                          }}
                          className="flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-background hover:shadow-sm transition-all text-left"
                        >
                          <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                            <User className="h-3.5 w-3.5 text-primary" />
                          </div>
                          <div>
                            <span className="font-mono font-semibold text-foreground">{u.username}</span>
                            {u.nama && <span className="text-muted-foreground text-xs ml-2">({u.nama})</span>}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground mt-2">Klik nama akun untuk mengisi username otomatis.</p>
                </div>
              )}
            </div>
          </div>

          {/* ── Form Reset Password (selalu ada di DOM, disembunyikan CSS) ── */}
          <div style={{ display: showReset ? undefined : "none" }}>
            <div className="mb-8">
              <button
                type="button"
                onClick={() => setShowReset(false)}
                className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4"
              >
                <ArrowLeft className="h-4 w-4" />
                Kembali ke login
              </button>
              <h2 className="text-2xl font-bold text-foreground">Reset Password</h2>
              <p className="text-muted-foreground text-sm mt-1">
                Masukkan kode reset yang dikirim administrator via WhatsApp.
              </p>
            </div>

            <Form {...resetForm}>
              <form onSubmit={resetForm.handleSubmit(onResetSubmit)} className="space-y-5">
                <FormField
                  control={resetForm.control}
                  name="username"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-foreground font-medium">Username Anda</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Masukkan username"
                          autoComplete="off"
                          spellCheck={false}
                          className="h-11 bg-white"
                          {...field}
                          ref={(el) => {
                            field.ref(el);
                            resetUsernameRef.current = el;
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={resetForm.control}
                  name="reset_code"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-foreground font-medium">Kode Reset</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="RST-XXXX-XXXX-XXXX-XXXX"
                          autoComplete="off"
                          spellCheck={false}
                          className="h-11 bg-white font-mono tracking-wider"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                      <p className="text-xs text-muted-foreground">Kode dikirim oleh administrator via WhatsApp. Berlaku 24 jam.</p>
                    </FormItem>
                  )}
                />
                <FormField
                  control={resetForm.control}
                  name="new_password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-foreground font-medium">Password Baru</FormLabel>
                      <FormControl>
                        <Input
                          type="password"
                          placeholder="Minimal 6 karakter"
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
                  className="w-full h-11 text-base font-semibold shadow-sm"
                  disabled={isResetting}
                >
                  {isResetting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Memproses...
                    </>
                  ) : (
                    "Reset Password"
                  )}
                </Button>
              </form>
            </Form>
          </div>

        </div>
      </div>
    </div>
  );
}
