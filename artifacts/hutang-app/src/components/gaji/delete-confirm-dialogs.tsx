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
import { Loader2 } from "lucide-react";
import type { GajiData } from "./use-gaji-data";
type Props = Pick<
  GajiData,
  | "isDeleteUpahOpen"
  | "setIsDeleteUpahOpen"
  | "deletingUpahId"
  | "setDeletingUpahId"
  | "deleteUpah"
  | "deleteUpahPending"
  | "isDeletePekerjaOpen"
  | "setIsDeletePekerjaOpen"
  | "deletingPekerjaId"
  | "setDeletingPekerjaId"
  | "deletePekerja"
  | "deletePekerjaPending"
  | "deletingBayarId"
  | "setDeletingBayarId"
  | "deleteBayar"
  | "deleteBayarPending"
>;
export function DeleteConfirmDialogs(p: Props) {
  const confirm = (
    open: boolean,
    onChange: (value: boolean) => void,
    title: string,
    description: string,
    id: number | null,
    remove: (id: number) => void,
    pending: boolean,
    onCancel: () => void,
  ) => (
    <AlertDialog open={open} onOpenChange={onChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>Batal</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive hover:bg-destructive/90"
            onClick={() => {
              if (id) remove(id);
            }}
            disabled={pending}
          >
            {pending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Hapus
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
  return (
    <>
      {confirm(
        p.isDeleteUpahOpen,
        p.setIsDeleteUpahOpen,
        "Hapus Catatan Upah?",
        "Semua riwayat pembayaran terkait juga akan dihapus. Tindakan ini tidak dapat dibatalkan.",
        p.deletingUpahId,
        p.deleteUpah,
        p.deleteUpahPending,
        () => p.setDeletingUpahId(null),
      )}
      {confirm(
        p.isDeletePekerjaOpen,
        p.setIsDeletePekerjaOpen,
        "Hapus Pekerja?",
        "Pekerja hanya bisa dihapus jika tidak memiliki catatan gaji. Tindakan ini tidak dapat dibatalkan.",
        p.deletingPekerjaId,
        p.deletePekerja,
        p.deletePekerjaPending,
        () => p.setDeletingPekerjaId(null),
      )}
      {confirm(
        !!p.deletingBayarId,
        (open) => {
          if (!open) p.setDeletingBayarId(null);
        },
        "Hapus Pembayaran Ini?",
        "Entri pengeluaran terkait di Keuangan juga akan dihapus. Tindakan ini tidak dapat dibatalkan.",
        p.deletingBayarId,
        p.deleteBayar,
        p.deleteBayarPending,
        () => p.setDeletingBayarId(null),
      )}
    </>
  );
}
