import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { usePengaturan, type Pengaturan } from "@/hooks/use-pengaturan";
import { loadLogoBase64ForPrint } from "@/lib/struk";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

export interface PrintContext {
  /** Nama usaha (selalu ada — fallback "Usahaku" kalau belum ada). */
  namaUsaha: string;
  /** Alamat usaha (null kalau belum diisi). */
  alamat: string | null;
  /** Nomor telepon usaha (null kalau belum diisi). */
  telepon: string | null;
  /** Teks header tambahan dari pengaturan (string kosong kalau belum diisi). */
  headerExtra: string;
  /** Teks footer dari pengaturan (default "Terima kasih atas kunjungan Anda"). */
  footer: string;
  /** Pengaturan mentah, untuk caller yang butuh field lain. */
  pengaturan?: Pengaturan;
}

interface UsahaResponse {
  id: number;
  nama_usaha: string;
  telepon: string | null;
  alamat: string | null;
  catatan?: string | null;
}

/**
 * Hook gabungan untuk halaman yang generate dokumen print (kwitansi, struk,
 * laporan). Mengambil:
 *   - Data usaha (nama, alamat, telepon)
 *   - Pengaturan struk (header tambahan, footer)
 *
 * Logo TIDAK di-load di hook ini supaya tidak ada delay saat halaman load.
 * Caller yang butuh logo panggil `loadLogoForPrint(ctx, usahaId)` saat tombol
 * Cetak ditekan.
 */
export function usePrintContext(): PrintContext {
  const { user } = useAuth();
  const usahaId = user?.usaha_id ?? null;

  const { data: usahaData } = useQuery<UsahaResponse | null>({
    queryKey: ["usaha-mine", usahaId],
    enabled: !!usahaId,
    queryFn: async () => {
      const r = await fetch(`${BASE}/api/usaha/${usahaId}`, { credentials: "include" });
      if (!r.ok) return null;
      return r.json();
    },
  });

  const { data: pengaturan } = usePengaturan();

  return {
    namaUsaha: usahaData?.nama_usaha ?? "Usahaku",
    alamat: usahaData?.alamat ?? null,
    telepon: usahaData?.telepon ?? null,
    headerExtra: (pengaturan?.struk_header ?? "").trim(),
    footer: (pengaturan?.struk_footer ?? "Terima kasih atas kunjungan Anda").trim(),
    pengaturan,
  };
}

/**
 * Helper async: load logo base64 untuk print context yang sudah ada.
 * Return null kalau pengaturan belum di-load atau toggle logo dimatikan.
 *
 * Pakai begini di halaman:
 * ```ts
 * const printCtx = usePrintContext();
 * const handleCetak = async () => {
 *   const logo = await loadLogoForPrint(printCtx, usahaId);
 *   const html = buildKwitansiHtml({ ...data, ctx: printCtx, logoBase64: logo });
 *   openInBrowser(html);
 * };
 * ```
 */
export async function loadLogoForPrint(
  ctx: PrintContext,
  usahaId: number | null,
): Promise<string | null> {
  if (!usahaId) return null;
  return loadLogoBase64ForPrint(usahaId, ctx.pengaturan);
}
