import * as React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import type { Pekerja, Pelanggan } from "@workspace/api-client-react";

const pekerjaSchema = z.object({
  nama: z.string().min(1, "Nama wajib diisi"),
  jabatan: z.string().optional(),
  telepon: z.string().optional(),
  catatan: z.string().optional(),
  pelanggan_id: z.number().nullable().optional(),
});

export type PekerjaFormValues = z.infer<typeof pekerjaSchema>;

interface PekerjaModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingPekerja: Pekerja | null;
  pelangganList: Pelanggan[];
  onSubmit: (values: PekerjaFormValues) => void;
  isSubmitting: boolean;
}

export function PekerjaModal({
  open,
  onOpenChange,
  editingPekerja,
  pelangganList,
  onSubmit,
  isSubmitting,
}: PekerjaModalProps) {
  const form = useForm<PekerjaFormValues>({
    resolver: zodResolver(pekerjaSchema),
    defaultValues: {
      nama: "",
      jabatan: "",
      telepon: "",
      catatan: "",
      pelanggan_id: null,
    },
  });

  React.useEffect(() => {
    if (open) {
      if (editingPekerja) {
        form.reset({
          nama: editingPekerja.nama,
          jabatan: editingPekerja.jabatan ?? "",
          telepon: editingPekerja.telepon ?? "",
          catatan: editingPekerja.catatan ?? "",
          pelanggan_id: editingPekerja.pelanggan_id ?? null,
        });
      } else {
        form.reset({
          nama: "",
          jabatan: "",
          telepon: "",
          catatan: "",
          pelanggan_id: null,
        });
      }
    }
  }, [open, editingPekerja, form]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>{editingPekerja ? "Edit Tenaga Kerja" : "Tambah Tenaga Kerja"}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="nama"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nama Lengkap</FormLabel>
                  <FormControl>
                    <Input placeholder="Contoh: Pak Budi" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="jabatan"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Peran / Jabatan</FormLabel>
                  <FormControl>
                    <Input placeholder="Contoh: Buruh Tani, Sopir, Tukang Panen" {...field} />
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
                  <FormLabel>Nomor Telepon</FormLabel>
                  <FormControl>
                    <Input placeholder="08..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="pelanggan_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Hubungkan dengan Data Pelanggan (Opsional)</FormLabel>
                  <Select
                    value={field.value ? String(field.value) : "none"}
                    onValueChange={(val) => field.onChange(val === "none" ? null : Number(val))}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Pilih pelanggan jika ada akun piutang" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="none">— Tidak Dihubungkan —</SelectItem>
                      {pelangganList.map((p) => (
                        <SelectItem key={p.id} value={String(p.id)}>
                          {p.nama} {p.telepon ? `(${p.telepon})` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="catatan"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Catatan</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Catatan tambahan (opsional)" rows={2} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Batal
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editingPekerja ? "Simpan Perubahan" : "Tambah Pekerja"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
