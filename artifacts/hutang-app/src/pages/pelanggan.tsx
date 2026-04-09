import { useState } from "react";
import { Link } from "wouter";
import { useGetPelangganList, useCreatePelanggan, useUpdatePelanggan, useDeletePelanggan, getGetPelangganListQueryKey, Pelanggan } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Loader2, Plus, Edit, Trash2, Eye, Search } from "lucide-react";

const pelangganSchema = z.object({
  nama: z.string().min(1, { message: "Nama wajib diisi" }),
  telepon: z.string().optional(),
  alamat: z.string().optional(),
  catatan: z.string().optional(),
});

type PelangganFormValues = z.infer<typeof pelangganSchema>;

export default function PelangganPage() {
  const { data: pelangganList, isLoading } = useGetPelangganList();
  const [search, setSearch] = useState("");
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [editingPelanggan, setEditingPelanggan] = useState<Pelanggan | null>(null);
  const [selectedPelanggan, setSelectedPelanggan] = useState<Pelanggan | null>(null);
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const createMutation = useCreatePelanggan();
  const updateMutation = useUpdatePelanggan();
  const deleteMutation = useDeletePelanggan();

  const form = useForm<PelangganFormValues>({
    resolver: zodResolver(pelangganSchema),
    defaultValues: { nama: "", telepon: "", alamat: "", catatan: "" },
  });

  const handleOpenDialog = (pelanggan?: Pelanggan) => {
    if (pelanggan) {
      setEditingPelanggan(pelanggan);
      form.reset({
        nama: pelanggan.nama,
        telepon: pelanggan.telepon || "",
        alamat: pelanggan.alamat || "",
        catatan: pelanggan.catatan || "",
      });
    } else {
      setEditingPelanggan(null);
      form.reset({ nama: "", telepon: "", alamat: "", catatan: "" });
    }
    setIsDialogOpen(true);
  };

  const onSubmit = (values: PelangganFormValues) => {
    if (editingPelanggan) {
      updateMutation.mutate(
        { id: editingPelanggan.id, data: values },
        {
          onSuccess: () => {
            toast({ title: "Pelanggan berhasil diperbarui" });
            queryClient.invalidateQueries({ queryKey: getGetPelangganListQueryKey() });
            setIsDialogOpen(false);
          },
          onError: (err: any) => toast({ variant: "destructive", title: "Gagal", description: err?.data?.error || err?.message || "Terjadi kesalahan" })
        }
      );
    } else {
      createMutation.mutate(
        { data: values },
        {
          onSuccess: () => {
            toast({ title: "Pelanggan berhasil ditambahkan" });
            queryClient.invalidateQueries({ queryKey: getGetPelangganListQueryKey() });
            setIsDialogOpen(false);
          },
          onError: (err: any) => toast({ variant: "destructive", title: "Gagal", description: err?.data?.error || err?.message || "Terjadi kesalahan" })
        }
      );
    }
  };

  const handleDelete = () => {
    if (!selectedPelanggan) return;
    deleteMutation.mutate(
      { id: selectedPelanggan.id },
      {
        onSuccess: () => {
          toast({ title: "Pelanggan berhasil dihapus" });
          queryClient.invalidateQueries({ queryKey: getGetPelangganListQueryKey() });
          setIsDeleteDialogOpen(false);
        },
        onError: (err: any) => toast({ variant: "destructive", title: "Gagal", description: err?.data?.error || err?.message || "Terjadi kesalahan" })
      }
    );
  };

  const filteredList = pelangganList?.filter(p =>
    p.nama.toLowerCase().includes(search.toLowerCase()) ||
    (p.telepon || "").includes(search) ||
    (p.alamat || "").toLowerCase().includes(search.toLowerCase())
  ) ?? [];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-primary">Daftar Pelanggan</h2>
          <p className="text-muted-foreground">Kelola daftar pelanggan Anda.</p>
        </div>
        <Button onClick={() => handleOpenDialog()}>
          <Plus className="mr-2 h-4 w-4" />
          Tambah Pelanggan
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Cari nama, telepon, atau alamat..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingPelanggan ? "Edit Pelanggan" : "Tambah Pelanggan"}</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField control={form.control} name="nama" render={({ field }) => (
                <FormItem>
                  <FormLabel>Nama Lengkap</FormLabel>
                  <FormControl><Input placeholder="Nama pelanggan" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="telepon" render={({ field }) => (
                <FormItem>
                  <FormLabel>Nomor Telepon (Opsional)</FormLabel>
                  <FormControl><Input placeholder="08..." {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="alamat" render={({ field }) => (
                <FormItem>
                  <FormLabel>Alamat (Opsional)</FormLabel>
                  <FormControl><Textarea placeholder="Alamat lengkap" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="catatan" render={({ field }) => (
                <FormItem>
                  <FormLabel>Catatan Tambahan (Opsional)</FormLabel>
                  <FormControl><Textarea placeholder="Info lainnya" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <Button type="submit" className="w-full" disabled={createMutation.isPending || updateMutation.isPending}>
                {(createMutation.isPending || updateMutation.isPending) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Simpan
              </Button>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Pelanggan?</AlertDialogTitle>
            <AlertDialogDescription>
              Apakah Anda yakin ingin menghapus {selectedPelanggan?.nama}? Data ini tidak dapat dikembalikan.
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
                  <TableHead>Telepon</TableHead>
                  <TableHead>Alamat</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredList.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                      {search ? "Tidak ada pelanggan yang sesuai pencarian." : "Belum ada data pelanggan."}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredList.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">{p.nama}</TableCell>
                      <TableCell>{p.telepon || "-"}</TableCell>
                      <TableCell className="truncate max-w-[200px]">{p.alamat || "-"}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Link href={`/pelanggan/${p.id}`}>
                            <Button variant="ghost" size="icon" title="Detail">
                              <Eye className="h-4 w-4" />
                            </Button>
                          </Link>
                          <Button variant="ghost" size="icon" onClick={() => handleOpenDialog(p)} title="Edit">
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => { setSelectedPelanggan(p); setIsDeleteDialogOpen(true); }} title="Hapus" className="text-destructive">
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
        {search && filteredList.length > 0 && (
          <div className="px-4 py-2 text-xs text-muted-foreground border-t">
            Menampilkan {filteredList.length} dari {pelangganList?.length ?? 0} pelanggan
          </div>
        )}
      </Card>
    </div>
  );
}
