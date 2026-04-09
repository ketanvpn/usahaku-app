import { useAuth } from "@/hooks/use-auth";
import { useGetMe, useLogout } from "@workspace/api-client-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { UserCircle, Shield, LogOut, Loader2 } from "lucide-react";
import { formatDate } from "@/lib/format";

export default function ProfilPage() {
  const { user, logout } = useAuth();
  const logoutMutation = useLogout();

  const handleLogout = () => {
    logoutMutation.mutate(undefined, {
      onSuccess: () => {
        logout();
      }
    });
  };

  if (!user) return null;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight text-primary">Profil Pengguna</h2>
        <p className="text-muted-foreground">Informasi akun Anda saat ini.</p>
      </div>

      <div className="max-w-2xl">
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
                  {user.role === 'super_admin' ? 'Super Administrator' : 'Owner Usaha'}
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
      </div>
    </div>
  );
}
