import { useQuery } from "@tanstack/react-query";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

export interface Pengaturan {
  struk_header: string;
  struk_footer: string;
  struk_ukuran_kertas: "58mm" | "80mm" | "A4";
  struk_tampilkan_logo: "0" | "1";
  logo_filename: string | null;
}

const DEFAULTS: Pengaturan = {
  struk_header: "",
  struk_footer: "Terima kasih atas kunjungan Anda",
  struk_ukuran_kertas: "80mm",
  struk_tampilkan_logo: "1",
  logo_filename: null,
};

export const PENGATURAN_QUERY_KEY = ["pengaturan"] as const;

export function usePengaturan() {
  return useQuery<Pengaturan>({
    queryKey: PENGATURAN_QUERY_KEY,
    queryFn: async () => {
      const r = await fetch(`${BASE}/api/pengaturan`, { credentials: "include" });
      if (!r.ok) {
        // Endpoint mungkin belum tersedia (versi backend lama). Fallback ke default.
        return DEFAULTS;
      }
      return r.json();
    },
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Helper kirim batch update ke /api/pengaturan/batch.
 * Tidak pakai mutation hook supaya bisa dipanggil dari mana saja.
 */
export async function savePengaturanBatch(
  items: { key: string; value: string | null }[],
): Promise<void> {
  const r = await fetch(`${BASE}/api/pengaturan/batch`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ items }),
  });
  if (!r.ok) {
    const data = (await r.json().catch(() => null)) as { error?: string } | null;
    throw new Error(data?.error ?? "Gagal menyimpan pengaturan");
  }
}
