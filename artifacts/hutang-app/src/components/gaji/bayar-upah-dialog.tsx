import { Button } from "@/components/ui/button";
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
import { Loader2, Trash2 } from "lucide-react";
import type { GajiData } from "./use-gaji-data";

type Props = Pick<
  GajiData,
  | "isBayarDialogOpen"
  | "setIsBayarDialogOpen"
  | "loadingDetail"
  | "upahDetail"
  | "bayarForm"
  | "submitBayar"
  | "deletingBayarId"
  | "setDeletingBayarId"
  | "linkedPelangganId"
  | "linkedPelangganDetail"
  | "hutangTertuaTerkait"
  | "potongHutangSingleEnabled"
  | "setPotongHutangSingleEnabled"
  | "potongHutangSingleAmount"
  | "setPotongHutangSingleAmount"
  | "jumlahBayarSingle"
  | "potongHutangSingleNum"
  | "bayarUpahPending"
  | "lisensiAktif"
>;
export function BayarUpahDialog(p: Props) {
  const detail = p.upahDetail;
  return (
    <Dialog
      open={p.isBayarDialogOpen}
      onOpenChange={(open) => {
        p.setIsBayarDialogOpen(open);
        if (!open) {
          p.bayarForm.clearErrors();
          p.setPotongHutangSingleEnabled(false);
          p.setPotongHutangSingleAmount("");
        }
      }}
    >
      <DialogContent
        aria-describedby={undefined}
        className="max-w-lg max-h-[90vh] overflow-y-auto rounded-3xl border-border/60 shadow-2xl"
      >
        <DialogHeader>
          <DialogTitle>Bayar Upah</DialogTitle>
        </DialogHeader>
        {p.loadingDetail ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : (
          detail && (
            <div className="space-y-4">
              <div className="bg-muted/50 rounded-lg p-3 space-y-1 text-sm">
                <div className="font-semibold text-base">
                  {detail.pekerja_nama}
                </div>
                <div className="text-muted-foreground">{detail.keterangan}</div>
                <div className="flex gap-6 pt-1 text-xs">
                  <span>
                    Total: <strong>{formatRupiah(detail.jumlah_total)}</strong>
                  </span>
                  <span>
                    Dibayar:{" "}
                    <strong className="text-green-700">
                      {formatRupiah(detail.total_dibayar)}
                    </strong>
                  </span>
                  <span>
                    Sisa:{" "}
                    <strong className="text-red-700">
                      {formatRupiah(detail.sisa_upah)}
                    </strong>
                  </span>
                </div>
              </div>
              {detail.bayar_list.length > 0 && (
                <div>
                  <p className="text-sm font-medium mb-2">Riwayat Pembayaran</p>
                  <div className="space-y-1.5 max-h-32 overflow-y-auto">
                    {detail.bayar_list.map((bayar) => (
                      <div
                        key={bayar.id}
                        className="flex items-center justify-between text-sm bg-green-50 border border-green-100 rounded px-3 py-1.5"
                      >
                        <div>
                          <span className="font-medium text-green-800">
                            {formatRupiah(bayar.jumlah)}
                          </span>
                          <span className="text-muted-foreground ml-2 text-xs">
                            — {formatDate(bayar.tanggal_bayar)}
                          </span>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 text-destructive hover:text-destructive hover:bg-red-50"
                          onClick={() => p.setDeletingBayarId(bayar.id)}
                          disabled={!p.lisensiAktif}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {detail.status !== "lunas" && (
                <Form {...p.bayarForm}>
                  <form
                    onSubmit={p.bayarForm.handleSubmit(p.submitBayar)}
                    className="space-y-3 border-t pt-3"
                  >
                    <p className="text-sm font-medium">Tambah Pembayaran</p>
                    {p.linkedPelangganId && (
                      <div className="rounded-lg border bg-blue-50/60 p-3 space-y-2 text-sm">
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            <p className="font-semibold">Opsi potong hutang</p>
                            <p className="text-xs text-muted-foreground">
                              {p.linkedPelangganDetail
                                ? `Terkait pelanggan: ${p.linkedPelangganDetail.nama}`
                                : "Memuat data pelanggan..."}
                            </p>
                          </div>
                          <Button
                            type="button"
                            variant={
                              p.potongHutangSingleEnabled
                                ? "default"
                                : "outline"
                            }
                            size="sm"
                            disabled={!p.hutangTertuaTerkait}
                            onClick={() => {
                              const next = !p.potongHutangSingleEnabled;
                              p.setPotongHutangSingleEnabled(next);
                              p.setPotongHutangSingleAmount(
                                next
                                  ? String(
                                      Math.min(
                                        p.jumlahBayarSingle,
                                        p.hutangTertuaTerkait?.sisa_hutang ?? 0,
                                      ),
                                    )
                                  : "",
                              );
                            }}
                          >
                            {p.potongHutangSingleEnabled
                              ? "Dipakai"
                              : "Sekalian bayar hutang"}
                          </Button>
                        </div>
                        {p.potongHutangSingleEnabled && (
                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <label className="text-xs font-medium">
                                Potong Hutang
                              </label>
                              <CurrencyInput
                                minValue={0}
                                maxValue={Math.min(
                                  p.jumlahBayarSingle,
                                  p.hutangTertuaTerkait?.sisa_hutang ?? 0,
                                )}
                                value={p.potongHutangSingleAmount}
                                onValueChange={p.setPotongHutangSingleAmount}
                                placeholder="0"
                              />
                            </div>
                            <div className="space-y-1 rounded-md border bg-white p-2">
                              <div className="flex justify-between text-xs">
                                <span>Gaji</span>
                                <span>{formatRupiah(p.jumlahBayarSingle)}</span>
                              </div>
                              <div className="flex justify-between text-xs">
                                <span>Potong</span>
                                <span>
                                  {formatRupiah(p.potongHutangSingleNum)}
                                </span>
                              </div>
                              <div className="flex justify-between text-xs font-semibold border-t pt-1 mt-1">
                                <span>Diterima</span>
                                <span>
                                  {formatRupiah(
                                    Math.max(
                                      0,
                                      p.jumlahBayarSingle -
                                        p.potongHutangSingleNum,
                                    ),
                                  )}
                                </span>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-3">
                      <FormField
                        control={p.bayarForm.control}
                        name="jumlah"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>
                              Jumlah Upah Diselesaikan{" "}
                              <span className="text-destructive">*</span>
                            </FormLabel>
                            <FormControl>
                              <CurrencyInput
                                minValue={1}
                                maxValue={detail.sisa_upah}
                                value={field.value}
                                onValueChange={field.onChange}
                                placeholder="0"
                              />
                            </FormControl>
                            <p className="text-xs text-muted-foreground">
                              Total upah yang dilunasi (bukan uang tunai keluar)
                            </p>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={p.bayarForm.control}
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
                      control={p.bayarForm.control}
                      name="catatan"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Catatan</FormLabel>
                          <FormControl>
                            <Input placeholder="Opsional..." {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="flex justify-end gap-2">
                      {p.potongHutangSingleEnabled && (
                        <div className="w-full rounded-lg border-2 border-blue-200 bg-blue-50/80 p-3 space-y-1.5 mb-2">
                          <p className="text-xs font-semibold text-blue-800 uppercase tracking-wide">
                            Rincian Pembayaran
                          </p>
                          <div className="flex justify-between text-sm">
                            <span>Total Upah Dilunasi</span>
                            <span className="font-medium">
                              {formatRupiah(p.jumlahBayarSingle)}
                            </span>
                          </div>
                          <div className="flex justify-between text-sm text-red-700">
                            <span>Potong Hutang</span>
                            <span className="font-medium">
                              − {formatRupiah(p.potongHutangSingleNum)}
                            </span>
                          </div>
                          <div className="flex justify-between text-sm font-bold border-t border-blue-200 pt-1.5 mt-1">
                            <span>💰 Uang Diterima Pekerja</span>
                            <span className="text-green-700">
                              {formatRupiah(
                                Math.max(
                                  0,
                                  p.jumlahBayarSingle -
                                    p.potongHutangSingleNum,
                                ),
                              )}
                            </span>
                          </div>
                        </div>
                      )}
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => p.setIsBayarDialogOpen(false)}
                      >
                        Tutup
                      </Button>
                      <Button type="submit" disabled={p.bayarUpahPending}>
                        {p.bayarUpahPending && (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        )}
                        Bayar
                      </Button>
                    </div>
                  </form>
                </Form>
              )}
              {detail.status === "lunas" && (
                <div className="flex justify-between items-center border-t pt-3">
                  <span className="text-sm text-green-700 font-medium">
                    Upah ini sudah lunas.
                  </span>
                  <Button
                    variant="outline"
                    onClick={() => p.setIsBayarDialogOpen(false)}
                  >
                    Tutup
                  </Button>
                </div>
              )}
            </div>
          )
        )}
      </DialogContent>
    </Dialog>
  );
}
