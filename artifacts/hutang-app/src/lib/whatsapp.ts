import { formatRupiah, formatDate } from "@/lib/format";

export interface WhatsAppReminderParams {
  telepon?: string | null;
  namaPelanggan: string;
  namaUsaha: string;
  nominalHutang: number;
  sisaHutang: number;
  tanggalHutang?: string | null;
  tanggalJatuhTempo?: string | null;
  keterangan?: string | null;
}

export function cleanPhoneNumber(phone?: string | null): string {
  if (!phone) return "";
  let cleaned = phone.replace(/[^0-9]/g, "");
  if (cleaned.startsWith("0")) {
    cleaned = "62" + cleaned.slice(1);
  } else if (cleaned.startsWith("8")) {
    cleaned = "62" + cleaned;
  }
  return cleaned;
}

export function buildWhatsAppReminderUrl(params: WhatsAppReminderParams): string {
  const {
    telepon,
    namaPelanggan,
    namaUsaha,
    sisaHutang,
    tanggalHutang,
    tanggalJatuhTempo,
    keterangan,
  } = params;

  const phone = cleanPhoneNumber(telepon);

  let pesan = `Halo Bapak/Ibu *${namaPelanggan}*,\n\n` +
    `Kami dari *${namaUsaha}* ingin menyampaikan rincian catatan transaksi hutang Anda:\n` +
    `• Sisa Tagihan: *${formatRupiah(sisaHutang)}*\n`;

  if (tanggalHutang) {
    pesan += `• Tanggal Transaksi: ${formatDate(tanggalHutang)}\n`;
  }
  if (tanggalJatuhTempo) {
    pesan += `• Jatuh Tempo: *${formatDate(tanggalJatuhTempo)}*\n`;
  }
  if (keterangan) {
    pesan += `• Keterangan: ${keterangan}\n`;
  }

  pesan += `\nMohon konfirmasi jika ada ketidaksesuaian atau informasi waktu pelunasan. Terima kasih banyak atas kerja samanya. 🙏\n\n_${namaUsaha}_`;

  const encoded = encodeURIComponent(pesan);
  if (phone) {
    return `https://wa.me/${phone}?text=${encoded}`;
  }
  return `https://wa.me/?text=${encoded}`;
}
