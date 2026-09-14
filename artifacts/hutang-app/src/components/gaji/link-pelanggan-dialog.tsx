import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Link2, Link2Off, Loader2 } from "lucide-react";
import type { GajiData } from "./use-gaji-data";

type Props = Pick<
  GajiData,
  | "isLinkDialogOpen"
  | "setIsLinkDialogOpen"
  | "linkPekerja"
  | "linkPelangganId"
  | "setLinkPelangganId"
  | "pelangganList"
  | "pelangganById"
  | "suggestedPelangganId"
  | "submitLinkPelanggan"
  | "updatePekerjaPending"
>;
export function LinkPelangganDialog({
  isLinkDialogOpen: open,
  setIsLinkDialogOpen: onOpenChange,
  linkPekerja,
  linkPelangganId,
  setLinkPelangganId,
  pelangganList,
  pelangganById,
  suggestedPelangganId,
  submitLinkPelanggan,
  updatePekerjaPending,
}: Props) {
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) setLinkPelangganId("none");
      }}
    >
      <DialogContent aria-describedby={undefined} className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5 text-primary" />
            Hubungkan ke Pelanggan
          </DialogTitle>
        </DialogHeader>
        {linkPekerja && (
          <div className="space-y-4">
            <div className="rounded-md border bg-muted/40 p-3 space-y-1.5">
              <div className="font-semibold">{linkPekerja.nama}</div>
              <div className="text-sm text-muted-foreground">
                Pilih pelanggan yang sama supaya data Piutang dan Gaji bisa
                dipakai bersama.
              </div>
              {suggestedPelangganId && (
                <div className="text-xs text-emerald-700 font-medium">
                  Saran otomatis:{" "}
                  {pelangganById.get(suggestedPelangganId)?.nama}
                </div>
              )}
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">Pelanggan Terkait</p>
              <Select
                value={linkPelangganId}
                onValueChange={setLinkPelangganId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Pilih pelanggan" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Tidak dihubungkan</SelectItem>
                  {pelangganList
                    .slice()
                    .sort((a, b) => a.nama.localeCompare(b.nama, "id"))
                    .map((pelanggan) => (
                      <SelectItem
                        key={pelanggan.id}
                        value={pelanggan.id.toString()}
                      >
                        {pelanggan.nama}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Kalau nama sudah ada di tab Piutang, cukup hubungkan sekali.
                Data lama tidak perlu diinput ulang.
              </p>
            </div>
            <div className="flex justify-between gap-2 pt-1">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setLinkPelangganId("none")}
                disabled={linkPelangganId === "none"}
              >
                <Link2Off className="h-4 w-4 mr-2" />
                Lepas Relasi
              </Button>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                >
                  Batal
                </Button>
                <Button
                  type="button"
                  onClick={submitLinkPelanggan}
                  disabled={updatePekerjaPending}
                >
                  {updatePekerjaPending && (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  )}
                  Simpan
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
