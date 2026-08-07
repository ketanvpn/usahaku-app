import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

export interface LicenseStatus {
  aktif: boolean;
  sisa_hari: number;
  expires_at: string | null;
  jam_dimanipulasi?: boolean;
}

interface BarangPeringatanItem {
  id: number;
  stok: number;
  stok_minimum: number;
}

interface UpahItem {
  id: number;
  status: "lunas" | "belum_lunas";
}

interface HutangItem {
  id: number;
  status: string;
  tanggal_jatuh_tempo: string | null;
  sisa_hutang: number;
}

export function useSidebarBadges({
  isSuperAdmin,
  licenseStatus,
}: {
  isSuperAdmin: boolean;
  licenseStatus: LicenseStatus | undefined;
}) {
  const lisensiOK =
    isSuperAdmin ||
    ((licenseStatus?.aktif ?? true) && !(licenseStatus?.jam_dimanipulasi ?? false));
  const enableBadges = !isSuperAdmin && lisensiOK;

  const { data: barangPeringatan } = useQuery<BarangPeringatanItem[]>({
    queryKey: ["badge-barang-peringatan"],
    queryFn: async () => {
      const r = await fetch(`${BASE}/api/barang/peringatan`, { credentials: "include" });
      if (!r.ok) return [];
      return r.json();
    },
    enabled: enableBadges,
    staleTime: 60 * 1000,
    refetchOnWindowFocus: true,
  });

  const { data: upahBelumLunas } = useQuery<UpahItem[]>({
    queryKey: ["badge-upah-belum-lunas"],
    queryFn: async () => {
      const r = await fetch(`${BASE}/api/upah?status=belum_lunas`, { credentials: "include" });
      if (!r.ok) return [];
      return r.json();
    },
    enabled: enableBadges,
    staleTime: 60 * 1000,
    refetchOnWindowFocus: true,
  });

  const { data: hutangAktif } = useQuery<HutangItem[]>({
    queryKey: ["badge-hutang-aktif"],
    queryFn: async () => {
      const r = await fetch(`${BASE}/api/hutang?status=aktif`, { credentials: "include" });
      if (!r.ok) return [];
      return r.json();
    },
    enabled: enableBadges,
    staleTime: 60 * 1000,
    refetchOnWindowFocus: true,
  });

  const hutangJatuhTempo = useMemo(() => {
    if (!hutangAktif) return 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return hutangAktif.filter((h) => {
      if (!h.tanggal_jatuh_tempo) return false;
      const due = new Date(`${h.tanggal_jatuh_tempo}T00:00:00`);
      return due.getTime() < today.getTime() && (h.sisa_hutang ?? 0) > 0;
    }).length;
  }, [hutangAktif]);

  return {
    stokPeringatanCount: barangPeringatan?.length ?? 0,
    upahBelumLunasCount: upahBelumLunas?.length ?? 0,
    hutangJatuhTempoCount: hutangJatuhTempo,
  };
}
