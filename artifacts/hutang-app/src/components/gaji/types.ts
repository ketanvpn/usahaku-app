import { createElement } from "react";
import * as z from "zod";
import { Badge } from "@/components/ui/badge";

export function toTitleCase(str: string): string {
  return str.replace(/\b\w/g, (c) => c.toUpperCase());
}

export function capitalizeFirst(str: string): string {
  if (!str) return str;
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export function normalizeKey(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .trim();
}

export const pekerjaSchema = z.object({
  nama: z.string().min(1, { message: "Nama wajib diisi" }),
  telepon: z.string().optional(),
  jabatan: z.string().optional(),
  catatan: z.string().optional(),
});

export const upahSchema = z.object({
  pekerja_id: z.coerce.number().min(1, { message: "Pilih pekerja" }),
  keterangan: z.string().min(1, { message: "Keterangan wajib diisi" }),
  jumlah_total: z.coerce
    .number()
    .min(1, { message: "Jumlah harus lebih dari 0" }),
  tanggal_kerja: z.string().min(1, { message: "Tanggal kerja wajib diisi" }),
  catatan: z.string().optional(),
});

export const bayarSchema = z.object({
  jumlah: z.coerce
    .number()
    .min(1, { message: "Jumlah bayar harus lebih dari 0" }),
  tanggal_bayar: z.string().min(1, { message: "Tanggal bayar wajib diisi" }),
  catatan: z.string().optional(),
});

export const batchSchema = z.object({
  jumlah_total: z.coerce
    .number()
    .min(1, { message: "Jumlah harus lebih dari 0" }),
  tanggal_bayar: z.string().min(1, { message: "Tanggal bayar wajib diisi" }),
  catatan: z.string().optional(),
});

export type PekerjaForm = z.infer<typeof pekerjaSchema>;
export type UpahForm = z.infer<typeof upahSchema>;
export type BayarForm = z.infer<typeof bayarSchema>;
export type BatchForm = z.infer<typeof batchSchema>;

export function StatusBadge({ status }: { status: string }) {
  if (status === "lunas") {
    return createElement(
      Badge,
      {
        className:
          "rounded-full bg-green-100 text-green-800 border-green-200 text-xs",
      },
      "Lunas",
    );
  }
  return createElement(
    Badge,
    {
      className: "rounded-full bg-red-100 text-red-800 border-red-200 text-xs",
    },
    "Belum Lunas",
  );
}
