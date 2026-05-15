// Helper bersama untuk template print/struk yang menggunakan tabel pengaturan.
// Dipakai oleh kasir.tsx (v1.0.83 batch 1). Halaman print lain (laporan,
// pembayaran, gaji-tenaga, keuangan) akan dimigrasi bertahap di rilis berikutnya.
//
// v1.0.84: layout struk 58mm dirombak supaya tidak overflow.
//   - 58mm pakai layout 2-baris per item (nama di baris 1, qty/harga/sub di baris 2)
//   - 80mm + A4 tetap pakai tabel 4 kolom (sudah aman)
//   - Builder HTML dipindah ke `buildStrukHtml(...)` supaya bisa dipakai
//     ulang dari halaman lain (cetak ulang, laporan transaksi, dll).

import type { Pengaturan } from "../hooks/use-pengaturan";
import { escapeHtml } from "./format";

/**
 * Return CSS @page declaration berdasarkan ukuran kertas yang dipilih user.
 * Dipakai dengan `<style>${getPageCss(...)}</style>`.
 */
export function getPageCss(ukuran: Pengaturan["struk_ukuran_kertas"] | string): string {
  switch (ukuran) {
    case "58mm":
      // Margin 1mm supaya konten dapat ruang maksimum di printer thermal 58mm
      // yang area cetak efektifnya cuma ~48mm.
      return `@page { size: 58mm auto; margin: 1mm 1mm; }`;
    case "A4":
      return `@page { size: A4; margin: 15mm; }`;
    case "80mm":
    default:
      return `@page { size: 80mm auto; margin: 4mm 4mm; }`;
  }
}

/**
 * Lebar body untuk struk thermal supaya konten tidak overflow.
 *
 * Catatan 58mm: lebar fisik 58mm, tapi area cetak efektif ~48mm karena printer
 * thermal selalu ada dead-zone di kiri-kanan. Kita sengaja set 50mm untuk
 * memberi sedikit safety margin.
 */
export function getBodyWidth(ukuran: Pengaturan["struk_ukuran_kertas"] | string): string {
  if (ukuran === "58mm") return "50mm";
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

// ─────────────────────────────────────────────────────────────────────────────
// Header HTML bersama untuk dokumen print (kwitansi pembayaran, kwitansi upah,
// laporan). Bukan untuk struk thermal — struk pakai `buildStrukHtml` yang
// sudah handle layout per ukuran kertas.
// ─────────────────────────────────────────────────────────────────────────────

export interface PrintHeaderInput {
  namaUsaha: string;
  alamat?: string | null;
  telepon?: string | null;
  /** Teks header tambahan dari pengaturan (string kosong = tidak render). */
  headerExtra?: string;
  /** Logo base64 (tanpa prefix "data:..."). Null = tidak render. */
  logoBase64?: string | null;
  /** Filename logo (untuk deteksi mime type). */
  logoFilename?: string | null;
  /** Judul dokumen, contoh "KWITANSI PEMBAYARAN HUTANG". Optional. */
  judul?: string;
  /** Nomor dokumen + tanggal, contoh "No: KWT-001 • Tanggal: 15 Mei 2026". Optional. */
  meta?: string;
}

/**
 * Build header HTML untuk dokumen print (A4/A5). Return blok `<div class="print-header">...</div>`
 * yang langsung bisa di-paste ke template kwitansi/laporan.
 *
 * CSS class yang dipakai (caller harus sediakan styling-nya sendiri):
 *   - `.print-header` — wrapper
 *   - `.print-logo` — img logo (max-height diatur caller)
 *   - `.print-nama-usaha` — nama besar
 *   - `.print-alamat`, `.print-telepon`, `.print-header-extra` — baris kecil
 *   - `.print-judul` — judul dokumen (opsional)
 *   - `.print-meta` — nomor + tanggal (opsional)
 *
 * Caller bisa pakai `getDefaultPrintHeaderCss()` untuk default style yang konsisten.
 */
export function buildPrintHeaderHtml(input: PrintHeaderInput): string {
  const {
    namaUsaha,
    alamat,
    telepon,
    headerExtra,
    logoBase64,
    logoFilename,
    judul,
    meta,
  } = input;

  const logoTag = logoBase64
    ? `<img class="print-logo" src="data:${getLogoMime(logoFilename)};base64,${logoBase64}" alt="Logo"/>`
    : "";
  const alamatLine = alamat
    ? `<div class="print-alamat">${escapeHtml(alamat)}</div>`
    : "";
  const teleponLine = telepon
    ? `<div class="print-telepon">Telp: ${escapeHtml(telepon)}</div>`
    : "";
  const headerExtraLine = headerExtra && headerExtra.trim()
    ? `<div class="print-header-extra">${escapeHtml(headerExtra.trim())}</div>`
    : "";
  const judulLine = judul
    ? `<div class="print-judul">${escapeHtml(judul)}</div>`
    : "";
  const metaLine = meta
    ? `<div class="print-meta">${escapeHtml(meta)}</div>`
    : "";

  return `<div class="print-header">
${logoTag}
<div class="print-nama-usaha">${escapeHtml(namaUsaha)}</div>
${alamatLine}
${teleponLine}
${headerExtraLine}
${judulLine}
${metaLine}
</div>`;
}

/**
 * CSS default untuk class yang dipakai `buildPrintHeaderHtml`. Caller bisa
 * override dengan menulis ulang class yang sama setelah ini.
 *
 * Default cocok untuk dokumen A5 (kwitansi). A4 / laporan boleh override
 * font-size kalau perlu.
 */
export function getDefaultPrintHeaderCss(): string {
  return `
.print-header { text-align: center; border-bottom: 1px dashed #888; padding-bottom: 8px; margin-bottom: 10px; }
.print-logo { max-height: 50px; max-width: 100%; display: block; margin: 0 auto 4px; }
.print-nama-usaha { font-size: 14pt; font-weight: bold; }
.print-alamat, .print-telepon, .print-header-extra { font-size: 9pt; color: #444; margin-top: 1px; }
.print-judul { font-size: 11pt; font-weight: bold; letter-spacing: 1px; margin-top: 4px; }
.print-meta { font-size: 8.5pt; color: #555; margin-top: 2px; }
`;
}


// ─────────────────────────────────────────────────────────────────────────────
// Builder HTML struk (kasir)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Format Rupiah ringkas untuk struk. Tidak pakai prefix "Rp" supaya hemat ruang
 * di kertas 58mm (mis. `50.000` bukan `Rp 50.000`).
 */
function fmtAngka(n: number): string {
  return new Intl.NumberFormat("id-ID", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Math.round(n));
}

export interface StrukItem {
  nama_barang: string;
  jumlah: number;
  satuan: string;
  harga_satuan: number;
  subtotal: number;
}

export interface StrukData {
  id: number;
  tanggal: string;       // YYYY-MM-DD
  nama_usaha: string;
  subtotal: number;
  diskon: number;
  total: number;
  uang_bayar: number;
  kembalian: number;
  items: StrukItem[];
}

export interface BuildStrukOptions {
  pengaturan?: Pengaturan;
  logoBase64?: string | null;
  alamatUsaha?: string | null;
  teleponUsaha?: string | null;
  /**
   * Kalau true, script auto-print di-skip. Dipakai untuk preview live di
   * halaman Pengaturan (rendering di iframe sandbox).
   */
  forPreview?: boolean;
}

/**
 * Build HTML lengkap untuk struk kasir, sudah termasuk auto-print script.
 * Layout otomatis menyesuaikan `pengaturan.struk_ukuran_kertas`:
 *   - "58mm" → layout 2-baris per item (kompak, font kecil, tanpa kolom tabel)
 *   - "80mm" → tabel 4 kolom (Barang | Qty | Harga | Sub)
 *   - "A4"   → tabel 4 kolom dengan font lebih besar
 */
export function buildStrukHtml(hasil: StrukData, opts: BuildStrukOptions = {}): string {
  const { pengaturan, logoBase64, alamatUsaha, teleponUsaha } = opts;
  const ukuran = pengaturan?.struk_ukuran_kertas ?? "80mm";
  const headerExtra = (pengaturan?.struk_header ?? "").trim();
  const footerText = (pengaturan?.struk_footer ?? "Terima kasih atas kunjungan Anda").trim();

  const tgl = new Date(hasil.tanggal + "T00:00:00").toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const noStruk = `#${String(hasil.id).padStart(4, "0")}`;

  const logoTag = logoBase64
    ? `<img src="data:${getLogoMime(pengaturan?.logo_filename)};base64,${logoBase64}" class="logo" alt="Logo"/>`
    : "";
  const alamatLine = alamatUsaha
    ? `<div class="center small">${escapeHtml(alamatUsaha)}</div>`
    : "";
  const teleponLine = teleponUsaha
    ? `<div class="center small">Telp: ${escapeHtml(teleponUsaha)}</div>`
    : "";
  const headerExtraLine = headerExtra
    ? `<div class="center small mt2">${escapeHtml(headerExtra)}</div>`
    : "";

  const body = ukuran === "58mm"
    ? buildBody58mm(hasil)
    : buildBodyWide(hasil);

  const styles = ukuran === "58mm"
    ? css58mm()
    : ukuran === "A4"
      ? cssA4()
      : css80mm();

  // Preview di Pengaturan render HTML ini di iframe → script print akan
  // otomatis trigger dialog cetak browser, yang sangat mengganggu. Skip-nya.
  const printScript = opts.forPreview
    ? ""
    : `<script>window.addEventListener('load',function(){setTimeout(function(){window.print();},400);})<\/script>`;

  return `<!DOCTYPE html><html lang="id"><head><meta charset="UTF-8"/>
<style>
${getPageCss(ukuran)}
${styles}
</style>
${printScript}
</head><body>
${logoTag}
<div class="center bold nama">${escapeHtml(hasil.nama_usaha || "Usahaku")}</div>
${alamatLine}
${teleponLine}
${headerExtraLine}
<div class="sep"></div>
<div class="meta"><span>Tanggal</span><span>${escapeHtml(tgl)}</span></div>
<div class="meta"><span>No</span><span>${escapeHtml(noStruk)}</span></div>
<div class="sep"></div>
${body}
<div class="sep"></div>
<div class="center small mt4">${escapeHtml(footerText)}</div>
</body></html>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Layout body per ukuran
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Layout untuk 58mm. Tiap item dibuat 2 baris supaya nama panjang tidak
 * memaksa kolom harga ke baris berikutnya secara acak (bug di v1.0.83).
 *
 *   Roti Tawar Sari Roti
 *   2 pcs × 8.500          17.000
 */
function buildBody58mm(hasil: StrukData): string {
  const items = hasil.items.map((i) => {
    const left = `${escapeHtml(i.jumlah)} ${escapeHtml(i.satuan)} × ${fmtAngka(i.harga_satuan)}`;
    const right = fmtAngka(i.subtotal);
    return `<div class="item">
  <div class="item-nama">${escapeHtml(i.nama_barang)}</div>
  <div class="row"><span>${left}</span><span>${right}</span></div>
</div>`;
  }).join("");

  const subtotalLine = hasil.diskon > 0
    ? `<div class="row small"><span>Subtotal</span><span>${fmtAngka(hasil.subtotal)}</span></div>
       <div class="row small"><span>Diskon</span><span>-${fmtAngka(hasil.diskon)}</span></div>`
    : "";

  return `${items}
<div class="sep"></div>
${subtotalLine}
<div class="row total"><span>TOTAL</span><span>${fmtAngka(hasil.total)}</span></div>
<div class="row small"><span>Bayar</span><span>${fmtAngka(hasil.uang_bayar)}</span></div>
<div class="row small"><span>Kembali</span><span>${fmtAngka(hasil.kembalian)}</span></div>`;
}

/**
 * Layout untuk 80mm + A4 (tabel 4 kolom). Pertahankan layout lama yang sudah
 * stabil di 80mm; A4 dikasih font sedikit lebih besar lewat CSS.
 */
function buildBodyWide(hasil: StrukData): string {
  const rows = hasil.items.map((i) =>
    `<tr>
      <td>${escapeHtml(i.nama_barang)}</td>
      <td class="right">${escapeHtml(i.jumlah)} ${escapeHtml(i.satuan)}</td>
      <td class="right">${fmtAngka(i.harga_satuan)}</td>
      <td class="right">${fmtAngka(i.subtotal)}</td>
    </tr>`
  ).join("");

  const diskonRow = hasil.diskon > 0
    ? `<tr><td colspan="3">Diskon</td><td class="right">-${fmtAngka(hasil.diskon)}</td></tr>`
    : "";

  const subtotalRow = hasil.diskon > 0
    ? `<tr><td>Subtotal</td><td class="right" colspan="3">${fmtAngka(hasil.subtotal)}</td></tr>`
    : "";

  return `<table>
<thead><tr><td class="bold">Barang</td><td class="bold right">Qty</td><td class="bold right">Harga</td><td class="bold right">Sub</td></tr></thead>
<tbody>${rows}</tbody>
</table>
<div class="sep"></div>
<table>
${subtotalRow}
${diskonRow}
<tr class="total"><td>TOTAL</td><td class="right bold" colspan="3">${fmtAngka(hasil.total)}</td></tr>
<tr><td>Bayar</td><td class="right" colspan="3">${fmtAngka(hasil.uang_bayar)}</td></tr>
<tr><td>Kembali</td><td class="right" colspan="3">${fmtAngka(hasil.kembalian)}</td></tr>
</table>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Stylesheet per ukuran
// ─────────────────────────────────────────────────────────────────────────────

function cssCommon(width: string, fontSize: string): string {
  return `
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Courier New',monospace;font-size:${fontSize};color:#000;width:${width};line-height:1.25}
.center{text-align:center}.right{text-align:right}
.bold{font-weight:bold}
.sep{border-top:1px dashed #000;margin:4px 0}
.mt2{margin-top:2px}.mt4{margin-top:4px}
.logo{display:block;max-width:100%;margin:0 auto 4px}
img{display:block}
`;
}

/**
 * 58mm: font sangat kecil (8pt), layout 2-baris per item via flex.
 * Lebar body 50mm (dipotong dari area cetak efektif printer thermal).
 */
function css58mm(): string {
  return `${cssCommon(getBodyWidth("58mm"), "8pt")}
.nama{font-size:10pt;margin-bottom:1px}
.small{font-size:7pt}
.meta{display:flex;justify-content:space-between;font-size:7pt}
.row{display:flex;justify-content:space-between;gap:4px}
.row > span:first-child{flex:1;min-width:0;word-break:break-word}
.row > span:last-child{flex-shrink:0;text-align:right;font-variant-numeric:tabular-nums}
.item{margin-bottom:2px}
.item-nama{font-weight:600;word-break:break-word}
.total{font-weight:bold;font-size:9pt;border-top:1px solid #000;padding-top:2px;margin-top:2px}
.logo{max-height:36px}
`;
}

/**
 * 80mm: layout tabel 4 kolom seperti sebelumnya (sudah aman).
 */
function css80mm(): string {
  return `${cssCommon(getBodyWidth("80mm"), "11pt")}
.nama{font-size:13pt}
.small{font-size:9pt}
.meta{display:flex;justify-content:space-between;font-size:9pt}
table{width:100%;border-collapse:collapse}
td{padding:1px 2px;font-size:10pt;vertical-align:top}
.total td{font-weight:bold;font-size:11pt;border-top:1px solid #000;padding-top:3px}
.logo{max-height:50px}
`;
}

/**
 * A4: font lebih besar dan tabel sama seperti 80mm tapi center supaya tidak
 * melebar penuh (struk A4 memang jarang dipakai, biasanya hanya untuk preview).
 */
function cssA4(): string {
  return `${cssCommon("180mm", "12pt")}
body{margin:0 auto}
.nama{font-size:18pt;margin-bottom:4px}
.small{font-size:11pt}
.meta{display:flex;justify-content:space-between;font-size:11pt}
table{width:100%;border-collapse:collapse}
td{padding:3px 6px;font-size:12pt;vertical-align:top}
.total td{font-weight:bold;font-size:14pt;border-top:1px solid #000;padding-top:4px}
.logo{max-height:80px}
`;
}
