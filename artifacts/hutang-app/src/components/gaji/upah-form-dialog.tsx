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
import { Button } from "@/components/ui/button";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";
import { formatRupiah } from "@/lib/format";
import { capitalizeFirst } from "./types";
import type { GajiData } from "./use-gaji-data";

type Props = Pick<
  GajiData,
  | "isUpahDialogOpen"
  | "setIsUpahDialogOpen"
  | "editingUpah"
  | "setEditingUpah"
  | "pekerjaList"
  | "upahForm"
  | "isBoronganMode"
  | "setIsBoronganMode"
  | "boronganVolume"
  | "setBoronganVolume"
  | "boronganTarif"
  | "setBoronganTarif"
  | "submitUpah"
  | "isPending"
>;
export function UpahFormDialog(props: Props) {
  const {
    isUpahDialogOpen: open,
    setIsUpahDialogOpen: onOpenChange,
    editingUpah,
    setEditingUpah,
    pekerjaList,
    upahForm,
    isBoronganMode,
    setIsBoronganMode,
    boronganVolume,
    setBoronganVolume,
    boronganTarif,
    setBoronganTarif,
    submitUpah,
    isPending,
  } = props;
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) {
          setEditingUpah(null);
          upahForm.clearErrors();
        }
      }}
    >
      <DialogContent
        aria-describedby={undefined}
        className="max-w-md rounded-3xl border-border/60 shadow-2xl"
      >
        <DialogHeader>
          <DialogTitle>
            {editingUpah ? "Edit Catatan Upah" : "Tambah Catatan Upah"}
          </DialogTitle>
        </DialogHeader>
        <Form {...upahForm}>
          <form
            onSubmit={upahForm.handleSubmit(submitUpah)}
            className="space-y-4"
          >
            {!editingUpah && (
              <FormField
                control={upahForm.control}
                name="pekerja_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Pekerja <span className="text-destructive">*</span>
                    </FormLabel>
                    <Select
                      value={field.value ? field.value.toString() : ""}
                      onValueChange={(value) => field.onChange(Number(value))}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Pilih pekerja..." />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {(pekerjaList ?? [])
                          .slice()
                          .sort((a, b) => a.nama.localeCompare(b.nama, "id"))
                          .map((p) => (
                            <SelectItem key={p.id} value={p.id.toString()}>
                              {p.nama}
                              {p.jabatan ? ` — ${p.jabatan}` : ""}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
            <FormField
              control={upahForm.control}
              name="keterangan"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Keterangan Pekerjaan{" "}
                    <span className="text-destructive">*</span>
                  </FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Contoh: Angkut gabah 3 ton"
                      autoCapitalize="sentences"
                      {...field}
                      onChange={(event) =>
                        field.onChange(capitalizeFirst(event.target.value))
                      }
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="rounded-xl border bg-slate-50/50 p-4 space-y-4">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold text-slate-800">
                  Mode Borongan (Hitung Otomatis)
                </Label>
                <Switch
                  checked={isBoronganMode}
                  onCheckedChange={(checked) => {
                    setIsBoronganMode(checked);
                    if (!checked) {
                      upahForm.setValue("jumlah_total", 0);
                      setBoronganVolume("");
                      setBoronganTarif("");
                    }
                  }}
                />
              </div>
              {isBoronganMode ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Volume / Kuantitas</Label>
                      <Input
                        type="number"
                        min="0"
                        step="any"
                        placeholder="Misal: 3.5"
                        value={boronganVolume}
                        onChange={(event) => {
                          setBoronganVolume(event.target.value);
                          upahForm.setValue(
                            "jumlah_total",
                            (parseFloat(event.target.value) || 0) *
                              (parseFloat(boronganTarif) || 0),
                          );
                        }}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Tarif per Satuan</Label>
                      <CurrencyInput
                        placeholder="Misal: 15000"
                        value={boronganTarif}
                        onValueChange={(value) => {
                          setBoronganTarif(String(value));
                          upahForm.setValue(
                            "jumlah_total",
                            (parseFloat(boronganVolume) || 0) *
                              (Number(value) || 0),
                          );
                        }}
                        minValue={0}
                      />
                    </div>
                  </div>
                  <div className="flex justify-between items-center rounded-lg bg-slate-100 p-2 px-3 border border-slate-200">
                    <span className="text-xs font-medium text-slate-600">
                      Total Upah Otomatis:
                    </span>
                    <span className="font-bold text-primary">
                      {formatRupiah(upahForm.watch("jumlah_total") || 0)}
                    </span>
                  </div>
                </div>
              ) : (
                <FormField
                  control={upahForm.control}
                  name="jumlah_total"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Total Gaji <span className="text-destructive">*</span>
                      </FormLabel>
                      <FormControl>
                        <CurrencyInput
                          minValue={1}
                          value={field.value}
                          onValueChange={field.onChange}
                          placeholder="0"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </div>
            <FormField
              control={upahForm.control}
              name="tanggal_kerja"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Tanggal Kerja <span className="text-destructive">*</span>
                  </FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={upahForm.control}
              name="catatan"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Catatan</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Opsional..." rows={2} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Batal
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {editingUpah ? "Simpan Perubahan" : "Tambah Catatan"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
