import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatRupiah } from "@/lib/format";
import { Printer } from "lucide-react";
import type { GajiData } from "./use-gaji-data";
type Props = Pick<
  GajiData,
  | "isKwitansiOpen"
  | "setIsKwitansiOpen"
  | "kwitansiData"
  | "handleCetakKwitansiUpah"
>;
export function KwitansiDialog({
  isKwitansiOpen: open,
  setIsKwitansiOpen: onOpenChange,
  kwitansiData,
  handleCetakKwitansiUpah,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        aria-describedby={undefined}
        className="max-w-sm rounded-3xl border-border/60 shadow-2xl"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Printer className="h-5 w-5 text-primary" />
            Cetak Kwitansi
          </DialogTitle>
        </DialogHeader>
        {kwitansiData && (
          <div className="space-y-4">
            <div className="bg-muted/50 rounded-lg p-3 space-y-1.5 text-sm">
              <div className="font-semibold">{kwitansiData.pekerja_nama}</div>
              {kwitansiData.pekerja_jabatan && (
                <div className="text-muted-foreground text-xs">
                  {kwitansiData.pekerja_jabatan}
                </div>
              )}
              <div className="text-muted-foreground">
                {kwitansiData.keterangan}
              </div>
              <div className="pt-1 font-bold text-base text-primary">
                {formatRupiah(kwitansiData.jumlah)}
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              Cetak kwitansi pembayaran upah untuk diberikan kepada pekerja?
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Lewati
              </Button>
              <Button
                onClick={() => {
                  void handleCetakKwitansiUpah(kwitansiData);
                  onOpenChange(false);
                }}
              >
                <Printer className="h-4 w-4 mr-2" />
                Cetak Kwitansi
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
