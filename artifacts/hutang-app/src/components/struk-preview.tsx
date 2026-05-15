import { useEffect, useState } from "react";
import { buildStrukHtml, type StrukData } from "@/lib/struk";
import type { Pengaturan } from "@/hooks/use-pengaturan";

interface StrukPreviewProps {
  /** Pengaturan saat ini (dari form yang sedang diedit user). */
  pengaturan: Pengaturan;
  /** Nama usaha untuk header (dari form Data Usaha). */
  namaUsaha: string;
  /** Alamat usaha (dari form Data Usaha). */
  alamat?: string | null;
  /** Telepon usaha (dari form Data Usaha). */
  telepon?: string | null;
  /** ID usaha (untuk load logo via IPC). */
  usahaId: number | null;
}

// Data dummy yang ditampilkan di preview. Item-nya cukup banyak supaya user
// bisa lihat layout di kertas pendek (58mm) dan tetap representatif untuk
// ukuran lain.
const SAMPLE_DATA: Omit<StrukData, "nama_usaha"> = {
  id: 1,
  tanggal: new Date().toISOString().slice(0, 10),
  subtotal: 32500,
  diskon: 2500,
  total: 30000,
  uang_bayar: 50000,
  kembalian: 20000,
  items: [
    {
      nama_barang: "Roti Tawar Sari Roti",
      jumlah: 2,
      satuan: "pcs",
      harga_satuan: 8500,
      subtotal: 17000,
    },
    {
      nama_barang: "Susu UHT Coklat 250ml",
      jumlah: 1,
      satuan: "kotak",
      harga_satuan: 8500,
      subtotal: 8500,
    },
    {
      nama_barang: "Permen Kopiko",
      jumlah: 7,
      satuan: "pcs",
      harga_satuan: 1000,
      subtotal: 7000,
    },
  ],
};

/**
 * Live preview struk yang sinkron dengan field di tab Pengaturan.
 *
 * Render via iframe (srcDoc) supaya CSS @page dan width body tidak
 * tabrakan dengan style halaman induk. `forPreview: true` skip auto-print
 * supaya tidak trigger dialog cetak browser.
 *
 * Logo di-load lewat IPC kalau di Electron + toggle aktif. Saat field
 * preview berubah, debounce 200ms untuk menghindari render rebuild
 * berulang per keystroke.
 */
export function StrukPreview(props: StrukPreviewProps) {
  const { pengaturan, namaUsaha, alamat, telepon, usahaId } = props;
  const [logoBase64, setLogoBase64] = useState<string | null>(null);
  const [debouncedHtml, setDebouncedHtml] = useState<string>("");

  // Load logo saat filename + toggle berubah. Pakai effect terpisah karena
  // butuh IPC async, tidak bisa dipanggil saat render.
  useEffect(() => {
    let cancelled = false;
    async function loadLogo() {
      if (pengaturan.struk_tampilkan_logo !== "1" || !pengaturan.logo_filename || !usahaId) {
        if (!cancelled) setLogoBase64(null);
        return;
      }
      if (!window.electronApp?.pengaturan) {
        if (!cancelled) setLogoBase64(null);
        return;
      }
      try {
        const data = await window.electronApp.pengaturan.getLogoData(
          usahaId,
          pengaturan.logo_filename,
        );
        if (!cancelled) setLogoBase64(data);
      } catch {
        if (!cancelled) setLogoBase64(null);
      }
    }
    void loadLogo();
    return () => {
      cancelled = true;
    };
  }, [pengaturan.logo_filename, pengaturan.struk_tampilkan_logo, usahaId]);

  // Build HTML setiap kali field/logo berubah. Pakai debounce supaya
  // typing di textarea header/footer tidak rebuild iframe per huruf.
  useEffect(() => {
    const timer = setTimeout(() => {
      const html = buildStrukHtml(
        { ...SAMPLE_DATA, nama_usaha: namaUsaha || "Usahaku" },
        {
          pengaturan,
          logoBase64,
          alamatUsaha: alamat ?? null,
          teleponUsaha: telepon ?? null,
          forPreview: true,
        },
      );
      setDebouncedHtml(html);
    }, 200);
    return () => clearTimeout(timer);
  }, [pengaturan, namaUsaha, alamat, telepon, logoBase64]);

  return (
    <div className="rounded-md border bg-muted/30 overflow-hidden">
      <div className="px-3 py-2 border-b bg-background flex items-center justify-between">
        <span className="text-sm font-medium">Pratinjau Struk</span>
        <span className="text-xs text-muted-foreground">
          Ukuran: {pengaturan.struk_ukuran_kertas}
        </span>
      </div>
      <div className="p-4 flex justify-center bg-[#f4f4f4] min-h-[420px]">
        <iframe
          title="Pratinjau struk"
          srcDoc={debouncedHtml}
          sandbox=""
          className="bg-white shadow-md border"
          style={{
            // Lebar yang nyaman dilihat di layar (bukan ukuran cetak fisik).
            width: pengaturan.struk_ukuran_kertas === "A4" ? 600 : 280,
            minHeight: 400,
          }}
        />
      </div>
      <p className="px-3 py-2 text-[11px] text-muted-foreground border-t bg-background">
        Pratinjau pakai data contoh. Ukuran cetak sebenarnya menyesuaikan kertas
        printer (mis. 58mm thermal akan tetap pas di kertas 58mm).
      </p>
    </div>
  );
}
