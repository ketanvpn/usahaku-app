import { customFetch } from "@workspace/api-client-react";

export interface BarangPeringatan {
  id: number;
  nama: string;
  satuan: string;
  stok: number;
  stok_minimum: number;
}

export interface TrenKeuanganItem {
  tanggal: string;
  masuk: number;
  keluar: number;
}

export interface KasirRingkasan {
  penjualan_hari_ini: number;
  transaksi_hari_ini: number;
  penjualan_bulan_ini: number;
  transaksi_bulan_ini: number;
}

export async function fetchPeringatanStok(): Promise<BarangPeringatan[]> {
  try {
    return await customFetch<BarangPeringatan[]>("/api/barang/peringatan");
  } catch {
    return [];
  }
}

export async function fetchTrenKeuangan(hari: 7 | 30 = 30): Promise<TrenKeuanganItem[]> {
  try {
    return await customFetch<TrenKeuanganItem[]>(`/api/dashboard/tren-keuangan?hari=${hari}`);
  } catch {
    return [];
  }
}

export async function fetchKasirRingkasan(): Promise<KasirRingkasan> {
  try {
    return await customFetch<KasirRingkasan>("/api/dashboard/kasir-ringkasan");
  } catch {
    return {
      penjualan_hari_ini: 0,
      transaksi_hari_ini: 0,
      penjualan_bulan_ini: 0,
      transaksi_bulan_ini: 0,
    };
  }
}
