import { useState } from "react";
import { Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
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
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Loader2, Plus, Edit, Trash2, Search, Truck, Eye } from "lucide-react";
import { TableSkeleton } from "@/components/ui/table-skeleton";
import { useLicense } from "@/context/license-context";
import { getErrorMessage } from "@/lib/format";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

interface Supplier {
  id: number;
  usaha_id: number;
  nama: string;
  telepon: string | null;
  alamat: string | null;
  catatan: string | null;
  created_at: string;
}

const supplierSchema = z.object({
  nama: z.string().min(1, "Nama wajib diisi"),
  telepon: z.string().optional(),
  alamat: z.string().optional(),
  catatan: z.string().optional(),
});

type SupplierFormValues = z.infer<typeof supplierSchema>;

async function apiFetch(path: string, options?: RequestInit) {
  const r = await fetch(`${BASE}${path}`, { credentials: "include", ...options });
  if (!r.ok) {
    const e = await r.json().catch(() => ({}));
    throw new Error(e.error || "Terjadi kesalahan");
  }
  return r.json();
}

export const SUPPLIER_QUERY_KEY = ["suppliers"];

export default function SupplierPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { lisensiAktif } = useLicense();

  const [search, setSearch] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [selected, setSelected] = useState<Supplier | null>(null);

  const { data: list, isLoading } = useQuery<Supplier[]>({
    queryKey: SUPPLIER_QUERY_KEY,
    queryFn: () => apiFetch("/api/suppliers"),
  });

  const form = useForm<SupplierFormValues>({
    resolver: zodResolver(supplierSchema),
    defaultValues: { nama: "", telepon: "", alamat: "", catatan: "" },
  });

  const handleOpenDialog = (supplier?: Supplier) => {
    if (supplier) {
      setEditing(supplier);
      form.reset({
        nama: supplier.nama,
        telepon: supplier.telepon ?? "",
        alamat: supplier.alamat ?? "",
        catatan: supplier.catatan ?? "",
      });
    } else {
      setEditing(null);
      form.reset({ nama: "", telepon: "", alamat: "", catatan: "" });
    }
    setIsDialogOpen(true);
  };

  const saveMutation = useMutation({
    mutationFn: (values: SupplierFormValues) =>
      apiFetch(editing ? `/api/suppliers/${editing.id}` : "/api/suppliers", {
        method: editing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      }),
    onSuccess: () => {
      toast({
        title: editing ? "Supplier berhasil diperbarui" : "Supplier berhasil ditambahkan",
      });
      qc.invalidateQueries({ queryKey: SUPPLIER_QUERY_KEY });
      setIsDialogOpen(false);
    },
    onError: (err: unknown) =>
      toast({
        variant: "destructive",
        title: "Gagal",
        description: getErrorMessage(err),
      }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) =>
      apiFetch(`/api/suppliers/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast({ title: "Supplier berhasil dihapus" });
      qc.invalidateQueries({ queryKey: SUPPLIER_QUERY_KEY });
      setIsDeleteDialogOpen(false);
    },
    onError: (err: unknown) =>
      toast({
        variant: "destructive",
        title: "Gagal",
        description: getErrorMessage(err),
      }),
  });

  const filteredList = (list ?? []).filter(
    (s) =>
      s.nama.toLowerCase().includes(search.toLowerCase()) ||
      (s.telepon ?? "").includes(search) ||
      (s.alamat ?? "").toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="space-y-6">
      <div className="page-hero">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary/75">Rantai Pasok</p>
          <h1 className="page-hero-title mt-2 flex items-center gap-2">
            <Truck className="h-7 w-7" />
            Daftar Supplier
          </h1>
          <p className="page-hero-description">
            Kelola kontak, alamat, dan catatan supplier agar pencatatan pembelian stok masuk lebih rapi.
          </p>
        </div>
        <Button className="rounded-xl shadow-lg shadow-primary/20" onClick={() => handleOpenDialog()} disabled={!lisensiAktif}>
          <Plus className="mr-2 h-4 w-4" />
          Tambah Supplier
        </Button>
      </div>

      <div className="toolbar-card">
        <div className="relative w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Cari nama, telepon, atau alamat..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 rounded-xl bg-background/80"
          />
        </div>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent aria-describedby={undefined} className="rounded-3xl border-border/60 shadow-2xl">
          <DialogHeader>
            <DialogTitle>
              {editing ? "Edit Supplier" : "Tambah Supplier"}
            </DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit((v) => saveMutation.mutate(v))}
              className="space-y-4"
            >
              <FormField
                control={form.control}
                name="nama"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nama Supplier</FormLabel>
                    <FormControl>
                      <Input placeholder="PT Sumber Berkah, Toko Pak Budi, dll" {...field} />
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
                    <FormLabel>
                      Nomor Telepon{" "}
                      <span className="text-muted-foreground text-xs">(opsional)</span>
                    </FormLabel>
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
                    <FormLabel>
                      Alamat{" "}
                      <span className="text-muted-foreground text-xs">(opsional)</span>
                    </FormLabel>
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
                    <FormLabel>
                      Catatan{" "}
                      <span className="text-muted-foreground text-xs">(opsional)</span>
                    </FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Info lainnya, mis. produk yang biasa diambil dari supplier ini"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button
                type="submit"
                className="w-full rounded-xl shadow-lg shadow-primary/20"
                disabled={saveMutation.isPending}
              >
                {saveMutation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Simpan
              </Button>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent className="rounded-3xl border-border/60 shadow-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Supplier?</AlertDialogTitle>
            <AlertDialogDescription>
              Data <strong>{selected?.nama}</strong> akan dihapus. Tindakan ini
              tidak dapat dibatalkan. Supplier yang masih dipakai di transaksi
              stok masuk tidak bisa dihapus.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Kembali</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => selected && deleteMutation.mutate(selected.id)}
              disabled={deleteMutation.isPending}
              className="bg-destructive text-destructive-foreground"
            >
              {deleteMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="mr-2 h-4 w-4" />
              )}
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Card className="data-card">
        <CardContent className="p-0">
          <Table className="table-premium">
            <TableHeader>
              <TableRow>
                <TableHead>Nama</TableHead>
                <TableHead>Telepon</TableHead>
                <TableHead>Alamat</TableHead>
                <TableHead>Catatan</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            {isLoading ? (
              <TableSkeleton cols={5} />
            ) : (
              <TableBody>
                {filteredList.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="text-center py-10 text-muted-foreground"
                    >
                      <div className="empty-state border-0 bg-transparent py-4 shadow-none">
                        <Truck className="h-10 w-10 mx-auto mb-3 opacity-30" />
                        <p>{search
                          ? "Tidak ada supplier yang sesuai pencarian."
                          : "Belum ada data supplier. Tambahkan supplier pertama untuk memudahkan pencatatan stok masuk."}</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredList.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="font-medium">{s.nama}</TableCell>
                      <TableCell>{s.telepon || "-"}</TableCell>
                      <TableCell className="truncate max-w-[200px]">
                        {s.alamat || "-"}
                      </TableCell>
                      <TableCell className="truncate max-w-[200px] text-muted-foreground text-sm">
                        {s.catatan || "-"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Link href={`/supplier/${s.id}`}>
                            <Button variant="ghost" size="icon" className="action-icon-btn" title="Detail">
                              <Eye className="h-4 w-4" />
                            </Button>
                          </Link>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="action-icon-btn"
                            onClick={() => handleOpenDialog(s)}
                            title="Edit"
                            disabled={!lisensiAktif}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setSelected(s);
                              setIsDeleteDialogOpen(true);
                            }}
                            title="Hapus"
                            className="action-icon-btn text-destructive hover:text-destructive"
                            disabled={!lisensiAktif}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            )}
          </Table>
        </CardContent>
        {search && filteredList.length > 0 && (
          <div className="px-4 py-2 text-xs text-muted-foreground border-t">
            Menampilkan {filteredList.length} dari {list?.length ?? 0} supplier
          </div>
        )}
      </Card>
    </div>
  );
}
