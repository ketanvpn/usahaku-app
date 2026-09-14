import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { CurrencyInput } from "@/components/ui/currency-input";
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
import { Input } from "@/components/ui/input";
import { formatDate, formatRupiah } from "@/lib/format";
import { Loader2 } from "lucide-react";
import type { GajiData } from "./use-gaji-data";
type Props = Pick<
  GajiData,
  | "isBatchDialogOpen"
  | "setIsBatchDialogOpen"
  | "batchPekerja"
  | "setBatchPekerja"
  | "batchForm"
  | "submitBatch"
  | "batchUpahList"
  | "totalSisaBatch"
  | "batchPelangganDetail"
  | "batchHutangAktifTerkait"
  | "selectedBatchHutangIds"
  | "setSelectedBatchHutangIds"
  | "selectedBatchHutangList"
  | "selectedBatchHutangTotal"
  | "potongHutangBatchEnabled"
  | "setPotongHutangBatchEnabled"
  | "potongHutangBatchAmount"
  | "setPotongHutangBatchAmount"
  | "jumlahBayarBatch"
  | "potongHutangBatchNum"
  | "toggleBatchHutangSelection"
  | "bayarBatchPending"
>;
export function BatchPaymentDialog(p: Props) {
  return (
    <Dialog
      open={p.isBatchDialogOpen}
      onOpenChange={(open) => {
        p.setIsBatchDialogOpen(open);
        if (!open) {
          p.setBatchPekerja(null);
          p.batchForm.clearErrors();
          p.setPotongHutangBatchEnabled(false);
          p.setPotongHutangBatchAmount("");
          p.setSelectedBatchHutangIds([]);
        }
      }}
    >
      <DialogContent
        aria-describedby={undefined}
        className="max-w-lg w-full max-h-[90vh] !overflow-hidden !flex !flex-col rounded-3xl border-border/60 shadow-2xl"
      >
        <DialogHeader>
          <DialogTitle>Bayar Upah Batch — {p.batchPekerja?.nama}</DialogTitle>
        </DialogHeader>
        {p.batchPekerja && (
          <Form {...p.batchForm}>
            <form
              onSubmit={p.batchForm.handleSubmit(p.submitBatch)}
              className="flex flex-col flex-1 min-h-0 gap-4"
            >
              <div className="flex-1 min-h-0 overflow-y-auto pr-1 space-y-4">
                {p.batchPekerja.pelanggan_id && (
                  <div className="rounded-lg border bg-blue-50/60 p-3 space-y-3 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="font-semibold">Opsi potong hutang</p>
                        <p className="text-xs text-muted-foreground">
                          {p.batchPelangganDetail
                            ? `Terkait pelanggan: ${p.batchPelangganDetail.nama}`
                            : "Memuat data pelanggan..."}
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant={
                          p.potongHutangBatchEnabled ? "default" : "outline"
                        }
                        size="sm"
                        disabled={!p.batchHutangAktifTerkait.length}
                        onClick={() =>
                          p.setPotongHutangBatchEnabled(
                            !p.potongHutangBatchEnabled,
                          )
                        }
                      >
                        {p.potongHutangBatchEnabled
                          ? "Nonaktifkan"
                          : "Pilih hutang"}
                      </Button>
                    </div>
                    {p.potongHutangBatchEnabled && (
                      <>
                        <div className="space-y-2 rounded-md border bg-white p-2 max-h-36 overflow-y-auto">
                          {p.batchHutangAktifTerkait.map((hutang) => (
                            <label
                              key={hutang.id}
                              className="flex items-start gap-3 rounded-md border p-2 hover:bg-muted/30 cursor-pointer"
                            >
                              <Checkbox
                                checked={p.selectedBatchHutangIds.includes(
                                  hutang.id,
                                )}
                                onCheckedChange={() =>
                                  p.toggleBatchHutangSelection(hutang.id)
                                }
                              />
                              <div className="min-w-0 flex-1">
                                <p className="font-medium truncate">
                                  {hutang.keterangan}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {formatDate(hutang.tanggal_hutang)} · sisa{" "}
                                  {formatRupiah(hutang.sisa_hutang)}
                                </p>
                              </div>
                            </label>
                          ))}
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <label className="text-xs font-medium">
                              Potong Hutang
                            </label>
                            <CurrencyInput
                              minValue={0}
                              maxValue={Math.min(
                                p.jumlahBayarBatch,
                                p.selectedBatchHutangTotal,
                              )}
                              value={p.potongHutangBatchAmount}
                              onValueChange={p.setPotongHutangBatchAmount}
                              placeholder="0"
                            />
                          </div>
                          <div className="space-y-1 rounded-md border bg-white p-2">
                            <div className="flex justify-between text-xs">
                              <span>Gaji</span>
                              <span>{formatRupiah(p.jumlahBayarBatch)}</span>
                            </div>
                            <div className="flex justify-between text-xs">
                              <span>Potong</span>
                              <span>
                                {formatRupiah(p.potongHutangBatchNum)}
                              </span>
                            </div>
                            <div className="flex justify-between text-xs font-semibold border-t pt-1 mt-1">
                              <span>Diterima</span>
                              <span>
                                {formatRupiah(
                                  Math.max(
                                    0,
                                    p.jumlahBayarBatch - p.potongHutangBatchNum,
                                  ),
                                )}
                              </span>
                            </div>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                )}
                <div className="rounded-md border bg-muted/40 p-3 space-y-1.5 max-h-48 overflow-y-auto">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                    Distribusi FIFO (terlama dulu)
                  </p>
                  {p.batchUpahList.map((upah) => (
                    <div
                      key={upah.id}
                      className="flex items-center justify-between text-sm"
                    >
                      <div>
                        <span className="font-medium">{upah.keterangan}</span>
                        <span className="text-xs text-muted-foreground block">
                          {formatDate(upah.tanggal_kerja)} · sisa{" "}
                          {formatRupiah(upah.sisa_upah)}
                        </span>
                      </div>
                    </div>
                  ))}
                  <div className="flex justify-between pt-1.5 border-t text-sm font-semibold">
                    <span>Total Sisa</span>
                    <span>{formatRupiah(p.totalSisaBatch)}</span>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <FormField
                    control={p.batchForm.control}
                    name="jumlah_total"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          Jumlah Bayar{" "}
                          <span className="text-destructive">*</span>
                        </FormLabel>
                        <FormControl>
                          <CurrencyInput
                            minValue={1}
                            maxValue={p.totalSisaBatch}
                            value={field.value}
                            onValueChange={field.onChange}
                            placeholder="0"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={p.batchForm.control}
                    name="tanggal_bayar"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          Tanggal Bayar{" "}
                          <span className="text-destructive">*</span>
                        </FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={p.batchForm.control}
                  name="catatan"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Catatan</FormLabel>
                      <FormControl>
                        <Input placeholder="Opsional" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="sticky bottom-0 z-10 -mx-6 px-6 pb-1 pt-3 border-t shrink-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/85 flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => p.setIsBatchDialogOpen(false)}
                >
                  Batal
                </Button>
                <Button type="submit" disabled={p.bayarBatchPending}>
                  {p.bayarBatchPending && (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  )}
                  Bayar Sekarang
                </Button>
              </div>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  );
}
