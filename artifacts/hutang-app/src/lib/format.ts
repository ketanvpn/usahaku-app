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
