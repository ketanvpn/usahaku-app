export function formatRupiah(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatDate(dateStr: string): string {
  try {
    return new Intl.DateTimeFormat('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(new Date(dateStr));
  } catch (e) {
    return dateStr;
  }
}

// Escape karakter HTML supaya nilai input user tidak bisa membentuk tag/script
// saat diinterpolasi ke template print/laporan/kwitansi.
export function escapeHtml(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Format rupiah singkat: 1.500.000 → "1,5jt", 25.000 → "25rb"
 * Cocok untuk label chart, badge, dsb.
 */
export function formatRupiahShort(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1).replace(".0", "")}jt`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(0)}rb`;
  return String(value);
}

/**
 * Format tanggal pendek: "2025-08-01" → "1 Agt"
 */
export function formatDateShort(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("id-ID", { day: "numeric", month: "short" });
}

/**
 * Format tanggal range: "2025-08-01" → "1 Agt 2025"
 */
export function formatDateRange(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}

/**
 * Teks info backup terakhir berdasarkan localStorage.
 */
export function getBackupInfoText(): string {
  const last = localStorage.getItem("lastBackupDate");
  if (!last) return "Belum ada backup manual";
  const diffMs = Date.now() - new Date(last).getTime();
  if (Number.isNaN(diffMs) || diffMs < 0) return "Backup manual: baru saja";
  const minutes = Math.floor(diffMs / (1000 * 60));
  if (minutes < 1) return "Backup manual: baru saja";
  if (minutes < 60) return `Backup manual: ${minutes} menit lalu`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Backup manual: ${hours} jam lalu`;
  const days = Math.floor(hours / 24);
  return `Backup manual: ${days} hari lalu`;
}

// Ekstrak pesan error yang ramah-pengguna dari berbagai bentuk error
// (ApiError dari custom-fetch, Error standar, atau objek lain).
export function getErrorMessage(err: unknown, fallback = "Terjadi kesalahan"): string {
  if (!err) return fallback;
  if (typeof err === "string") return err || fallback;
  if (typeof err === "object") {
    const anyErr = err as { data?: { error?: unknown; message?: unknown }; message?: unknown };
    const dataError = anyErr.data?.error;
    if (typeof dataError === "string" && dataError.trim()) return dataError;
    const dataMessage = anyErr.data?.message;
    if (typeof dataMessage === "string" && dataMessage.trim()) return dataMessage;
    if (typeof anyErr.message === "string" && anyErr.message.trim()) return anyErr.message;
  }
  return fallback;
}

const SATUAN = ["", "Satu", "Dua", "Tiga", "Empat", "Lima", "Enam", "Tujuh", "Delapan", "Sembilan", "Sepuluh", "Sebelas"];

function terbilangRaw(n: number): string {
  if (n < 0) return `Minus ${terbilangRaw(-n)}`;
  if (n < 12) return SATUAN[n];
  if (n < 20) return `${SATUAN[n - 10]} Belas`;
  if (n < 100) return `${SATUAN[Math.floor(n / 10)]} Puluh${n % 10 ? ` ${SATUAN[n % 10]}` : ""}`;
  if (n < 200) return `Seratus${n % 100 ? ` ${terbilangRaw(n % 100)}` : ""}`;
  if (n < 1_000) return `${SATUAN[Math.floor(n / 100)]} Ratus${n % 100 ? ` ${terbilangRaw(n % 100)}` : ""}`;
  if (n < 2_000) return `Seribu${n % 1_000 ? ` ${terbilangRaw(n % 1_000)}` : ""}`;
  if (n < 1_000_000) return `${terbilangRaw(Math.floor(n / 1_000))} Ribu${n % 1_000 ? ` ${terbilangRaw(n % 1_000)}` : ""}`;
  if (n < 1_000_000_000) return `${terbilangRaw(Math.floor(n / 1_000_000))} Juta${n % 1_000_000 ? ` ${terbilangRaw(n % 1_000_000)}` : ""}`;
  if (n < 1_000_000_000_000) return `${terbilangRaw(Math.floor(n / 1_000_000_000))} Miliar${n % 1_000_000_000 ? ` ${terbilangRaw(n % 1_000_000_000)}` : ""}`;
  return String(n);
}

export function terbilang(n: number): string {
  if (n === 0) return "Nol Rupiah";
  return `${terbilangRaw(Math.abs(Math.trunc(n)))} Rupiah`;
}
