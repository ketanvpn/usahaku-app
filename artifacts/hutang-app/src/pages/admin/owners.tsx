import { useState } from "react";
import { useGetUsers, useCreateUser, useUpdateUser, useDeleteUser, useResetUserPassword, useToggleUserActive, useGetUsahaList, getGetUsersQueryKey, User } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { formatDate } from "@/lib/format";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Loader2, Plus, Edit, KeyRound, UserX, UserCheck, Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const userSchema = z.object({
  nama: z.string().min(1, { message: "Nama wajib diisi" }),
  username: z.string().min(3, { message: "Username minimal 3 karakter" }),
  password: z.string().min(6, { message: "Password minimal 6 karakter" }).optional(),
  role: z.enum(["super_admin", "owner"]),
  usaha_id: z.coerce.number().optional().nullable(),
});

const resetPasswordSchema = z.object({
  new_password: z.string().min(6, { message: "Password minimal 6 karakter" }),
});

export default function AdminOwnersPage() {
  const { data: users, isLoading } = useGetUsers();
  const { data: usahaList } = useGetUsahaList();
  
  const [isUserDialogOpen, setIsUserDialogOpen] = useState(false);
  const [isResetPwdDialogOpen, setIsResetPwdDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const createMutation = useCreateUser();
  const updateMutation = useUpdateUser();
  const deleteMutation = useDeleteUser();
  const resetPwdMutation = useResetUserPassword();
  const toggleActiveMutation = useToggleUserActive();

  const userForm = useForm<z.infer<typeof userSchema>>({
    resolver: zodResolver(userSchema),
    defaultValues: {
      nama: "",
      username: "",
      password: "",
      role: "owner",
      usaha_id: null,
    },
  });

  const pwdForm = useForm<z.infer<typeof resetPasswordSchema>>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { new_password: "" },
  });

  const handleOpenUserDialog = (user?: User) => {
    if (user) {
      setEditingUser(user);
      userForm.reset({
        nama: user.nama,
        username: user.username,
        password: "", // Leave blank for edit
        role: user.role,
        usaha_id: user.usaha_id,
      });
    } else {
      setEditingUser(null);
      userForm.reset({ nama: "", username: "", password: "", role: "owner", usaha_id: null });
    }
    setIsUserDialogOpen(true);
  };

  const onUserSubmit = (values: z.infer<typeof userSchema>) => {
    const dataToSend = { ...values };
    if (editingUser) {
      delete dataToSend.password; // Don't send password on update
      updateMutation.mutate(
        { id: editingUser.id, data: dataToSend as any },
        {
          onSuccess: () => {
            toast({ title: "Berhasil diperbarui" });
            queryClient.invalidateQueries({ queryKey: getGetUsersQueryKey() });
            setIsUserDialogOpen(false);
          },
          onError: (err: any) => toast({ variant: "destructive", title: "Gagal", description: err?.data?.error || err?.message || "Terjadi kesalahan" })
        }
      );
    } else {
      createMutation.mutate(
        { data: dataToSend as any },
        {
          onSuccess: () => {
            toast({ title: "Berhasil ditambahkan" });
            queryClient.invalidateQueries({ queryKey: getGetUsersQueryKey() });
            setIsUserDialogOpen(false);
          },
          onError: (err: any) => toast({ variant: "destructive", title: "Gagal", description: err?.data?.error || err?.message || "Terjadi kesalahan" })
        }
      );
    }
  };

  const onResetPwdSubmit = (values: z.infer<typeof resetPasswordSchema>) => {
    if (!selectedUser) return;
    resetPwdMutation.mutate(
      { id: selectedUser.id, data: values },
      {
        onSuccess: () => {
          toast({ title: "Password berhasil direset" });
          setIsResetPwdDialogOpen(false);
        },
        onError: (err: any) => toast({ variant: "destructive", title: "Gagal", description: err?.data?.error || err?.message || "Terjadi kesalahan" })
      }
    );
  };

  const handleToggleActive = (user: User) => {
    toggleActiveMutation.mutate(
      { id: user.id },
      {
        onSuccess: () => {
          toast({ title: `User berhasil di${user.is_active ? 'nonaktifkan' : 'aktifkan'}` });
          queryClient.invalidateQueries({ queryKey: getGetUsersQueryKey() });
        },
        onError: (err: any) => toast({ variant: "destructive", title: "Gagal", description: err?.data?.error || err?.message || "Terjadi kesalahan" })
      }
    );
  };

  const handleDelete = () => {
    if (!selectedUser) return;
    deleteMutation.mutate(
      { id: selectedUser.id },
      {
        onSuccess: () => {
          toast({ title: "User berhasil dihapus" });
          queryClient.invalidateQueries({ queryKey: getGetUsersQueryKey() });
          setIsDeleteDialogOpen(false);
        },
        onError: (err: any) => toast({ variant: "destructive", title: "Gagal", description: err?.data?.error || err?.message || "Terjadi kesalahan" })
      }
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-primary">Kelola User</h2>
          <p className="text-muted-foreground">Kelola akun owner dan super admin.</p>
        </div>
        <Button onClick={() => handleOpenUserDialog()}>
          <Plus className="mr-2 h-4 w-4" />
          Tambah User
        </Button>
      </div>

      <Dialog open={isUserDialogOpen} onOpenChange={setIsUserDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingUser ? "Edit User" : "Tambah User Baru"}</DialogTitle>
          </DialogHeader>
          <Form {...userForm}>
            <form onSubmit={userForm.handleSubmit(onUserSubmit)} className="space-y-4">
              <FormField
                control={userForm.control}
                name="nama"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nama Lengkap</FormLabel>
                    <FormControl><Input placeholder="Nama..." {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={userForm.control}
                name="username"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Username</FormLabel>
                    <FormControl><Input placeholder="Username..." {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {!editingUser && (
                <FormField
                  control={userForm.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Password</FormLabel>
                      <FormControl><Input type="password" placeholder="***" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
              <FormField
                control={userForm.control}
                name="role"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Role</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger><SelectValue placeholder="Pilih Role" /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="owner">Owner Usaha</SelectItem>
                        <SelectItem value="super_admin">Super Admin</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {userForm.watch("role") === "owner" && (
                <FormField
                  control={userForm.control}
                  name="usaha_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Usaha</FormLabel>
                      <Select 
                        onValueChange={(val) => field.onChange(val ? parseInt(val) : null)} 
                        defaultValue={field.value?.toString() || ""}
                      >
                        <FormControl>
                          <SelectTrigger><SelectValue placeholder="Pilih Usaha (Opsional)" /></SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="none">Tidak Ada</SelectItem>
                          {usahaList?.map(u => (
                            <SelectItem key={u.id} value={u.id.toString()}>{u.nama_usaha}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
              <Button type="submit" className="w-full" disabled={createMutation.isPending || updateMutation.isPending}>
                {(createMutation.isPending || updateMutation.isPending) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Simpan
              </Button>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={isResetPwdDialogOpen} onOpenChange={setIsResetPwdDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset Password - {selectedUser?.nama}</DialogTitle>
          </DialogHeader>
          <Form {...pwdForm}>
            <form onSubmit={pwdForm.handleSubmit(onResetPwdSubmit)} className="space-y-4">
              <FormField
                control={pwdForm.control}
                name="new_password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password Baru</FormLabel>
                    <FormControl><Input type="password" placeholder="***" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full" disabled={resetPwdMutation.isPending}>
                {resetPwdMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Reset Password
              </Button>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus User?</AlertDialogTitle>
            <AlertDialogDescription>
              Tindakan ini tidak dapat dibatalkan. User {selectedUser?.nama} akan dihapus secara permanen.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              {deleteMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nama</TableHead>
                  <TableHead>Username</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Usaha</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {!users || users.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      Belum ada data user.
                    </TableCell>
                  </TableRow>
                ) : (
                  users.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">{user.nama}</TableCell>
                      <TableCell>{user.username}</TableCell>
                      <TableCell>
                        <span className={`px-2 py-1 rounded text-xs ${user.role === 'super_admin' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'}`}>
                          {user.role === 'super_admin' ? 'Super Admin' : 'Owner'}
                        </span>
                      </TableCell>
                      <TableCell>
                        {usahaList?.find(u => u.id === user.usaha_id)?.nama_usaha || "-"}
                      </TableCell>
                      <TableCell>
                        <span className={`px-2 py-1 rounded text-xs ${user.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}>
                          {user.is_active ? 'Aktif' : 'Nonaktif'}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" onClick={() => handleOpenUserDialog(user)} title="Edit">
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => { setSelectedUser(user); pwdForm.reset(); setIsResetPwdDialogOpen(true); }} title="Reset Password">
                            <KeyRound className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleToggleActive(user)} title={user.is_active ? "Nonaktifkan" : "Aktifkan"}>
                            {user.is_active ? <UserX className="h-4 w-4 text-orange-500" /> : <UserCheck className="h-4 w-4 text-emerald-500" />}
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => { setSelectedUser(user); setIsDeleteDialogOpen(true); }} title="Hapus" className="text-destructive">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
