import { useState } from "react";
import { useGetUsahaList, useCreateUsaha, useUpdateUsaha, getGetUsahaListQueryKey, Usaha } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { formatDate } from "@/lib/format";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Loader2, Plus, Edit } from "lucide-react";

const usahaSchema = z.object({
  nama_usaha: z.string().min(1, { message: "Nama usaha wajib diisi" }),
  alamat: z.string().optional(),
  telepon: z.string().optional(),
  catatan: z.string().optional(),
});

type UsahaFormValues = z.infer<typeof usahaSchema>;

export default function AdminUsahaPage() {
  const { data: usahaList, isLoading } = useGetUsahaList();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingUsaha, setEditingUsaha] = useState<Usaha | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const createMutation = useCreateUsaha();
  const updateMutation = useUpdateUsaha();

  const form = useForm<UsahaFormValues>({
    resolver: zodResolver(usahaSchema),
    defaultValues: {
      nama_usaha: "",
      alamat: "",
      telepon: "",
      catatan: "",
    },
  });

  const handleOpenDialog = (usaha?: Usaha) => {
    if (usaha) {
      setEditingUsaha(usaha);
      form.reset({
        nama_usaha: usaha.nama_usaha,
        alamat: usaha.alamat || "",
        telepon: usaha.telepon || "",
        catatan: usaha.catatan || "",
      });
    } else {
      setEditingUsaha(null);
      form.reset({ nama_usaha: "", alamat: "", telepon: "", catatan: "" });
    }
    setIsDialogOpen(true);
  };

  const onSubmit = (values: UsahaFormValues) => {
    if (editingUsaha) {
      updateMutation.mutate(
        { id: editingUsaha.id, data: values },
        {
          onSuccess: () => {
            toast({ title: "Berhasil diperbarui" });
            queryClient.invalidateQueries({ queryKey: getGetUsahaListQueryKey() });
            setIsDialogOpen(false);
          },
          onError: (err: any) => {
            toast({ variant: "destructive", title: "Gagal", description: err?.data?.error || err?.message || "Terjadi kesalahan" });
          }
        }
      );
    } else {
      createMutation.mutate(
        { data: values },
        {
          onSuccess: () => {
            toast({ title: "Berhasil ditambahkan" });
            queryClient.invalidateQueries({ queryKey: getGetUsahaListQueryKey() });
            setIsDialogOpen(false);
          },
          onError: (err: any) => {
            toast({ variant: "destructive", title: "Gagal", description: err?.data?.error || err?.message || "Terjadi kesalahan" });
          }
        }
      );
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-primary">Daftar Usaha</h2>
          <p className="text-muted-foreground">Kelola daftar usaha di sistem.</p>
        </div>
        <Button onClick={() => handleOpenDialog()}>
          <Plus className="mr-2 h-4 w-4" />
          Tambah Usaha
        </Button>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingUsaha ? "Edit Usaha" : "Tambah Usaha Baru"}</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="nama_usaha"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nama Usaha</FormLabel>
                    <FormControl>
                      <Input placeholder="Nama toko / usaha" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="telepon"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nomor Telepon (Opsional)</FormLabel>
                    <FormControl>
                      <Input placeholder="08..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="alamat"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Alamat (Opsional)</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Alamat lengkap" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="catatan"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Catatan (Opsional)</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Catatan tambahan" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full" disabled={createMutation.isPending || updateMutation.isPending}>
                {(createMutation.isPending || updateMutation.isPending) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Simpan
              </Button>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nama Usaha</TableHead>
                  <TableHead>Telepon</TableHead>
                  <TableHead>Alamat</TableHead>
                  <TableHead>Terdaftar</TableHead>
                  <TableHead className="w-[100px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {!usahaList || usahaList.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      Belum ada data usaha.
                    </TableCell>
                  </TableRow>
                ) : (
                  usahaList.map((usaha) => (
                    <TableRow key={usaha.id}>
                      <TableCell className="font-medium">{usaha.nama_usaha}</TableCell>
                      <TableCell>{usaha.telepon || "-"}</TableCell>
                      <TableCell className="truncate max-w-[200px]">{usaha.alamat || "-"}</TableCell>
                      <TableCell>{formatDate(usaha.created_at)}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" onClick={() => handleOpenDialog(usaha)}>
                          <Edit className="h-4 w-4" />
                        </Button>
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
