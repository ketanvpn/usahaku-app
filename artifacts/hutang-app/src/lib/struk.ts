// Helper bersama untuk template print/struk yang menggunakan tabel pengaturan.
// Dipakai oleh kasir.tsx (v1.0.83 batch 1). Halaman print lain (laporan,
// pembayaran, gaji-tenaga, keuangan) akan dimigrasi bertahap di rilis berikutnya.

import type { Pengaturan } from "@/hooks/use-pengaturan";

/**
 * Return CSS @page declaration berdasarkan ukuran kertas yang dipilih user.
 * Dipakai dengan `<style>${getPageCss(...)}</style>`.
 */
export function getPageCss(ukuran: Pengaturan["struk_ukuran_kertas"] | string): string {
  switch (ukuran) {
    case "58mm":
      return `@page { size: 58mm auto; margin: 2mm 2mm; }`;
    case "A4":
      return `@page { size: A4; margin: 15mm; }`;
    case "80mm":
    default:
      return `@page { size: 80mm auto; margin: 4mm 4mm; }`;
  }
}

/**
 * Lebar body untuk struk thermal supaya konten tidak overflow.
 */
export function getBodyWidth(ukuran: Pengaturan["struk_ukuran_kertas"] | string): string {
  if (ukuran === "58mm") return "54mm";
  if (ukuran === "A4") return "auto";
  return "72mm";
}

/**
 * Load logo dari Electron file system sebagai base64. Return null kalau:
 *  - tidak di Electron
 *  - filename kosong
 *  - file tidak ada
 *  - user mematikan tampilan logo
 *
 * Caller boleh memanggil ini bahkan saat `struk_tampilkan_logo === "0"`,
 * helper sudah cek toggle-nya supaya page logic tetap simple.
 */
export async function loadLogoBase64ForPrint(
  usahaId: number,
  pengaturan: Pengaturan | undefined,
): Promise<string | null> {
  if (!pengaturan) return null;
  if (pengaturan.struk_tampilkan_logo !== "1") return null;
  if (!pengaturan.logo_filename) return null;
  if (!window.electronApp?.pengaturan) return null;
  try {
    return await window.electronApp.pengaturan.getLogoData(
      usahaId,
      pengaturan.logo_filename,
    );
  } catch {
    return null;
  }
}

/**
 * Return ekstensi gambar dari nama file. Default ke png supaya `<img src=...>`
 * tetap render meski filename tidak punya extension.
 */
export function getLogoMime(filename: string | null | undefined): string {
  if (!filename) return "image/png";
  const lower = filename.toLowerCase();
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  return "image/png";
}
