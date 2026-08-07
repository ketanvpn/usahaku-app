import { customFetch } from "@workspace/api-client-react";

export interface KeuanganItem {
  id: number;
  usaha_id: number;
  tanggal: string;
  tipe: "masuk" | "keluar";
  kategori: string | null;
  keterangan: string;
  jumlah: number;
  created_at: string;
}

export interface RekapKeuangan {
  total_masuk: number;
  total_keluar: number;
  saldo: number;
  jumlah_transaksi: number;
}

export interface RekapKategoriKeuangan {
  kategori: string;
  tipe: "masuk" | "keluar";
  total: number;
  jumlah_transaksi: number;
}

export interface RekapBulananKeuangan {
  bulan: number;
  nama: string;
  masuk: number;
  keluar: number;
}

export interface KeuanganInputBody {
  tanggal: string;
  tipe: "masuk" | "keluar";
  kategori?: string;
  keterangan: string;
  jumlah: number;
}

export interface GetKeuanganParams {
  bulan?: string;
  tahun?: string;
  tipe?: string;
  dari?: string;
  sampai?: string;
}

export interface GetRekapParams {
  bulan?: string;
  tahun?: string;
}

export async function fetchKeuanganList(params: GetKeuanganParams = {}): Promise<KeuanganItem[]> {
  const q = new URLSearchParams();
  if (params.bulan) q.set("bulan", params.bulan);
  if (params.tahun) q.set("tahun", params.tahun);
  if (params.tipe && params.tipe !== "semua") q.set("tipe", params.tipe);
  if (params.dari) q.set("dari", params.dari);
  if (params.sampai) q.set("sampai", params.sampai);

  const query = q.toString();
  return customFetch<KeuanganItem[]>(`/api/keuangan${query ? `?${query}` : ""}`);
}

export async function fetchRekapKeuangan(params?: GetRekapParams): Promise<RekapKeuangan> {
  const q = new URLSearchParams();
  if (params?.bulan) q.set("bulan", params.bulan);
  if (params?.tahun) q.set("tahun", params.tahun);

  const query = q.toString();
  return customFetch<RekapKeuangan>(`/api/keuangan/rekap${query ? `?${query}` : ""}`);
}

export async function fetchRekapKategoriKeuangan(params: { bulan?: string; tahun?: string }): Promise<RekapKategoriKeuangan[]> {
  const q = new URLSearchParams();
  if (params.bulan) q.set("bulan", params.bulan);
  if (params.tahun) q.set("tahun", params.tahun);

  const query = q.toString();
  return customFetch<RekapKategoriKeuangan[]>(`/api/keuangan/rekap-kategori${query ? `?${query}` : ""}`);
}

export async function fetchRekapBulananKeuangan(tahun: string): Promise<RekapBulananKeuangan[]> {
  return customFetch<RekapBulananKeuangan[]>(`/api/keuangan/rekap-bulanan?tahun=${encodeURIComponent(tahun)}`);
}

export async function createKeuangan(body: KeuanganInputBody): Promise<KeuanganItem> {
  return customFetch<KeuanganItem>("/api/keuangan", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export async function updateKeuangan(id: number, body: KeuanganInputBody): Promise<KeuanganItem> {
  return customFetch<KeuanganItem>(`/api/keuangan/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export async function deleteKeuangan(id: number): Promise<{ success: boolean; message: string }> {
  return customFetch<{ success: boolean; message: string }>(`/api/keuangan/${id}`, {
    method: "DELETE",
  });
}
