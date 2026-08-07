import { escapeHtml, formatDate } from "@/lib/format";
import type { PrintContext } from "@/hooks/use-print-context";
import { buildPrintHeaderHtml, getDefaultPrintHeaderCss } from "@/lib/struk";

export interface KwitansiUpahData {
  type: "single" | "batch";
  pekerja_nama: string;
  pekerja_jabatan: string;
  keterangan: string;
  tanggal_bayar: string;
  jumlah: number;
  catatan: string;
  namaUsaha: string;
}

export function buildKwitansiUpahHtml(
  d: KwitansiUpahData,
  extras: { ctx: PrintContext; logoBase64: string | null },
): string {
  const { ctx, logoBase64 } = extras;
  const noKwitansi = `KWT-UPAH-${Date.now().toString().slice(-8)}`;
  const judulKet = d.type === "batch" ? "Pembayaran seluruh upah tertunggak" : d.keterangan;
  const namaUsaha = ctx.namaUsaha || d.namaUsaha || "Usaha";

  const headerHtml = buildPrintHeaderHtml({
    namaUsaha,
    alamat: ctx.alamat,
    telepon: ctx.telepon,
    headerExtra: ctx.headerExtra,
    logoBase64,
    logoFilename: ctx.pengaturan?.logo_filename ?? null,
    judul: "KWITANSI PEMBAYARAN UPAH",
    meta: `No: ${noKwitansi} • Tgl: ${formatDate(d.tanggal_bayar)}`,
  });

  return `<!DOCTYPE html><html lang="id"><head><meta charset="UTF-8"/>
<title>Kwitansi ${escapeHtml(noKwitansi)}</title>
<style>
@page { size: A5 landscape; margin: 8mm 10mm; }
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: Arial, Helvetica, sans-serif; font-size: 9pt; color: #111; background: white; width: 182mm; }
.wrap { border: 1.5px solid #333; border-radius: 3px; padding: 10px 14px; }
${getDefaultPrintHeaderCss()}
.print-header { padding-bottom: 6px; margin-bottom: 8px; border-bottom: 1px solid #333; }
.print-logo { max-height: 40px; margin-bottom: 2px; }
.kwt-table { width: 100%; border-collapse: collapse; margin: 8px 0; }
.kwt-table td { padding: 3px 6px; vertical-align: top; font-size: 9pt; }
.kwt-table .lbl { width: 120px; font-weight: 600; color: #444; }
.kwt-table .sep { width: 12px; }
.amount-box { border: 1.5px solid #16a34a; background: #f0fdf4; border-radius: 4px; padding: 6px 12px; margin: 8px 0; display: inline-block; }
.amount-lbl { font-size: 8pt; color: #15803d; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; }
.amount-val { font-size: 14pt; font-weight: bold; color: #14532d; font-family: 'Courier New', monospace; }
.ttd-row { display: flex; justify-content: space-between; margin-top: 14px; padding-top: 4px; }
.ttd-box { text-align: center; width: 140px; font-size: 8.5pt; }
.ttd-line { border-bottom: 1px solid #555; height: 36px; margin-bottom: 3px; }
.cut-guide { margin-top: 10px; border-top: 1px dashed #bbb; padding-top: 4px; text-align: center; font-size: 7.5pt; color: #999; }
</style>
<script>window.addEventListener('load',function(){setTimeout(function(){window.print();},400);});<\/script>
</head><body>
<div class="wrap">
  ${headerHtml}
  <table class="kwt-table">
    <tr><td class="lbl">Telah Diterima Dari</td><td class="sep">:</td><td><strong>${escapeHtml(namaUsaha)}</strong></td></tr>
    <tr><td class="lbl">Kepada Pekerja</td><td class="sep">:</td><td><strong>${escapeHtml(d.pekerja_nama)}</strong> ${d.pekerja_jabatan ? `<span style="color:#666">(${escapeHtml(d.pekerja_jabatan)})</span>` : ""}</td></tr>
    <tr><td class="lbl">Untuk Pembayaran</td><td class="sep">:</td><td>${escapeHtml(judulKet)}</td></tr>
    ${d.catatan ? `<tr><td class="lbl">Catatan</td><td class="sep">:</td><td style="color:#555;font-style:italic">${escapeHtml(d.catatan)}</td></tr>` : ""}
  </table>
  <div class="amount-box">
    <div class="amount-lbl">Jumlah Dibayarkan</div>
    <div class="amount-val">Rp ${d.jumlah.toLocaleString("id-ID")}</div>
  </div>
  <div class="ttd-row">
    <div class="ttd-box"><div class="muted">Penerima (Pekerja)</div><div class="ttd-line"></div><div>${escapeHtml(d.pekerja_nama)}</div></div>
    <div class="ttd-box"><div class="muted">Pembayar (Pengelola)</div><div class="ttd-line"></div><div>${escapeHtml(namaUsaha)}</div></div>
  </div>
</div>
<div class="cut-guide">- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -</div>
</body></html>`;
}
