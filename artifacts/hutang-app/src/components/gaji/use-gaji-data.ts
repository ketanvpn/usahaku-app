import { useEffect, useMemo, useRef, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import {
  getGetPekerjaListQueryKey,
  getGetPelangganQueryKey,
  getGetUpahListQueryKey,
  getGetUpahQueryKey,
  getGetUsahaQueryKey,
  useBayarBatchUpah,
  useBayarUpah,
  useCreatePekerja,
  useCreateUpah,
  useDeleteBayarUpah,
  useDeletePekerja,
  useDeleteUpah,
  useGetPekerjaList,
  useGetPelanggan,
  useGetPelangganList,
  useGetUpah,
  useGetUpahList,
  useGetUsaha,
  useUpdatePekerja,
  useUpdateUpah,
  type GetUpahListParams,
  type Pekerja,
  type UpahPekerja,
  type UpahStatus,
} from "@workspace/api-client-react";
import { useForm } from "react-hook-form";
import { useToast } from "@/hooks/use-toast";
import { useLicense } from "@/context/license-context";
import { useAuth } from "@/hooks/use-auth";
import { loadLogoForPrint, usePrintContext } from "@/hooks/use-print-context";
import { formatRupiah } from "@/lib/format";
import { openPrintWindow } from "@/lib/print";
import { buildKwitansiUpahHtml, type KwitansiUpahData } from "./kwitansi-print";
import {
  batchSchema,
  bayarSchema,
  normalizeKey,
  pekerjaSchema,
  upahSchema,
  type BatchForm,
  type BayarForm,
  type PekerjaForm,
  type UpahForm,
} from "./types";

export function useGajiData() {
  const { lisensiAktif } = useLicense();
  const { toast } = useToast();
  const qc = useQueryClient();
  const { user } = useAuth();
  const printCtx = usePrintContext();
  const [isKwitansiOpen, setIsKwitansiOpen] = useState(false);
  const [kwitansiData, setKwitansiData] = useState<KwitansiUpahData | null>(
    null,
  );
  const pendingKwitansiRef = useRef<KwitansiUpahData | null>(null);
  const [filterStatus, setFilterStatus] = useState<UpahStatus | undefined>();
  const [filterPekerja, setFilterPekerja] = useState<number | undefined>();
  const [searchUpah, setSearchUpah] = useState("");
  const [isUpahDialogOpen, setIsUpahDialogOpen] = useState(false);
  const [isDeleteUpahOpen, setIsDeleteUpahOpen] = useState(false);
  const [editingUpah, setEditingUpah] = useState<UpahPekerja | null>(null);
  const [selectedUpahId, setSelectedUpahId] = useState<number | null>(null);
  const [isBayarDialogOpen, setIsBayarDialogOpen] = useState(false);
  const [deletingUpahId, setDeletingUpahId] = useState<number | null>(null);
  const [isBoronganMode, setIsBoronganMode] = useState(false);
  const [boronganVolume, setBoronganVolume] = useState("");
  const [boronganTarif, setBoronganTarif] = useState("");
  const [searchPekerja, setSearchPekerja] = useState("");
  const [isPekerjaDialogOpen, setIsPekerjaDialogOpen] = useState(false);
  const [isDeletePekerjaOpen, setIsDeletePekerjaOpen] = useState(false);
  const [editingPekerja, setEditingPekerja] = useState<Pekerja | null>(null);
  const [deletingPekerjaId, setDeletingPekerjaId] = useState<number | null>(
    null,
  );
  const [deletingBayarId, setDeletingBayarId] = useState<number | null>(null);
  const [filterPekerjaLink, setFilterPekerjaLink] = useState<
    "semua" | "terhubung" | "belum_terhubung"
  >("semua");
  const [isLinkDialogOpen, setIsLinkDialogOpen] = useState(false);
  const [linkPekerja, setLinkPekerja] = useState<Pekerja | null>(null);
  const [linkPelangganId, setLinkPelangganId] = useState("none");
  const [potongHutangSingleEnabled, setPotongHutangSingleEnabled] =
    useState(false);
  const [potongHutangSingleAmount, setPotongHutangSingleAmount] = useState("");
  const [batchPekerja, setBatchPekerja] = useState<Pekerja | null>(null);
  const [isBatchDialogOpen, setIsBatchDialogOpen] = useState(false);
  const [potongHutangBatchEnabled, setPotongHutangBatchEnabled] =
    useState(false);
  const [potongHutangBatchAmount, setPotongHutangBatchAmount] = useState("");
  const [selectedBatchHutangIds, setSelectedBatchHutangIds] = useState<
    number[]
  >([]);
  const params: GetUpahListParams = {};
  if (filterStatus) params.status = filterStatus;
  if (filterPekerja) params.pekerja_id = filterPekerja;
  const { data: upahList, isLoading: loadingUpah } = useGetUpahList(params);
  const { data: allUpahList } = useGetUpahList({});
  const { data: pekerjaList, isLoading: loadingPekerja } = useGetPekerjaList();
  const { data: pelangganList = [] } = useGetPelangganList();
  const { data: upahDetail, isLoading: loadingDetail } = useGetUpah(
    selectedUpahId ?? 0,
    {
      query: {
        enabled: !!selectedUpahId,
        queryKey: getGetUpahQueryKey(selectedUpahId ?? 0),
      },
    },
  );
  const { data: batchPelangganDetail } = useGetPelanggan(
    batchPekerja?.pelanggan_id ?? 0,
    {
      query: {
        enabled: !!batchPekerja?.pelanggan_id,
        queryKey: getGetPelangganQueryKey(batchPekerja?.pelanggan_id ?? 0),
      },
    },
  );
  const selectedUpahPekerja = useMemo(
    () => pekerjaList?.find((p) => p.id === upahDetail?.pekerja_id) ?? null,
    [pekerjaList, upahDetail?.pekerja_id],
  );
  const linkedPelangganId = selectedUpahPekerja?.pelanggan_id ?? null;
  const { data: linkedPelangganDetail } = useGetPelanggan(
    linkedPelangganId ?? 0,
    {
      query: {
        enabled: !!linkedPelangganId,
        queryKey: getGetPelangganQueryKey(linkedPelangganId ?? 0),
      },
    },
  );
  const { data: usahaData } = useGetUsaha(user?.usaha_id ?? 0, {
    query: {
      enabled: !!user?.usaha_id,
      queryKey: getGetUsahaQueryKey(user?.usaha_id ?? 0),
    },
  });
  const namaUsaha = usahaData?.nama_usaha ?? "Usahaku";
  const handleCetakKwitansiUpah = async (data: KwitansiUpahData) => {
    const logoBase64 = await loadLogoForPrint(printCtx, user?.usaha_id ?? null);
    openPrintWindow(buildKwitansiUpahHtml(data, { ctx: printCtx, logoBase64 }));
  };
  const invalidateUpah = () => {
    qc.invalidateQueries({ queryKey: getGetUpahListQueryKey() });
    if (selectedUpahId)
      qc.invalidateQueries({ queryKey: getGetUpahQueryKey(selectedUpahId) });
  };
  const invalidatePekerja = () =>
    qc.invalidateQueries({ queryKey: getGetPekerjaListQueryKey() });
  const pelangganById = useMemo(
    () => new Map(pelangganList.map((p) => [p.id, p])),
    [pelangganList],
  );
  const getSuggestedPelangganId = (p: Pekerja) => {
    const namaPekerja = normalizeKey(p.nama);
    if (!namaPekerja) return p.pelanggan_id ?? null;
    const exact = pelangganList.find(
      (pelanggan) => normalizeKey(pelanggan.nama) === namaPekerja,
    );
    if (exact) return exact.id;
    return (
      pelangganList.find((pelanggan) => {
        const namaPelanggan = normalizeKey(pelanggan.nama);
        return (
          namaPelanggan.includes(namaPekerja) ||
          namaPekerja.includes(namaPelanggan)
        );
      })?.id ??
      p.pelanggan_id ??
      null
    );
  };
  const suggestedPelangganId = useMemo(
    () => (linkPekerja ? getSuggestedPelangganId(linkPekerja) : null),
    [linkPekerja, pelangganList],
  );
  const today = new Date().toISOString().split("T")[0];
  const upahForm = useForm<UpahForm>({
    resolver: zodResolver(upahSchema),
    defaultValues: {
      pekerja_id: 0,
      keterangan: "",
      jumlah_total: 0,
      tanggal_kerja: today,
      catatan: "",
    },
  });
  const pekerjaForm = useForm<PekerjaForm>({
    resolver: zodResolver(pekerjaSchema),
    defaultValues: { nama: "", telepon: "", jabatan: "", catatan: "" },
  });
  const bayarForm = useForm<BayarForm>({
    resolver: zodResolver(bayarSchema),
    defaultValues: { jumlah: 0, tanggal_bayar: today, catatan: "" },
  });
  const batchForm = useForm<BatchForm>({
    resolver: zodResolver(batchSchema),
    defaultValues: { jumlah_total: 0, tanggal_bayar: today, catatan: "" },
  });
  const createUpah = useCreateUpah({
    mutation: {
      onSuccess: () => {
        invalidateUpah();
        toast({ title: "Catatan upah berhasil ditambah" });
        setIsUpahDialogOpen(false);
      },
      onError: (e: unknown) =>
        toast({
          title: "Gagal",
          description: (e as Error)?.message,
          variant: "destructive",
        }),
    },
  });
  const updateUpah = useUpdateUpah({
    mutation: {
      onSuccess: () => {
        invalidateUpah();
        toast({ title: "Catatan upah berhasil diperbarui" });
        setIsUpahDialogOpen(false);
        setEditingUpah(null);
      },
      onError: (e: unknown) =>
        toast({
          title: "Gagal",
          description: (e as Error)?.message,
          variant: "destructive",
        }),
    },
  });
  const deleteUpah = useDeleteUpah({
    mutation: {
      onSuccess: () => {
        invalidateUpah();
        toast({ title: "Catatan upah berhasil dihapus" });
        setIsDeleteUpahOpen(false);
        setDeletingUpahId(null);
      },
      onError: (e: unknown) =>
        toast({
          title: "Gagal",
          description: (e as Error)?.message,
          variant: "destructive",
        }),
    },
  });
  const bayarUpah = useBayarUpah({
    mutation: {
      onSuccess: () => {
        invalidateUpah();
        if (linkedPelangganId)
          qc.invalidateQueries({
            queryKey: getGetPelangganQueryKey(linkedPelangganId),
          });
        toast({ title: "Pembayaran berhasil dicatat" });
        bayarForm.reset();
        if (pendingKwitansiRef.current) {
          setKwitansiData(pendingKwitansiRef.current);
          setIsKwitansiOpen(true);
          pendingKwitansiRef.current = null;
        }
      },
      onError: (e: unknown) =>
        toast({
          title: "Gagal",
          description: (e as Error)?.message,
          variant: "destructive",
        }),
    },
  });
  const deleteBayar = useDeleteBayarUpah({
    mutation: {
      onSuccess: () => {
        invalidateUpah();
        if (linkedPelangganId)
          qc.invalidateQueries({
            queryKey: getGetPelangganQueryKey(linkedPelangganId),
          });
        toast({ title: "Pembayaran berhasil dihapus" });
        setDeletingBayarId(null);
      },
      onError: (e: unknown) =>
        toast({
          title: "Gagal",
          description: (e as Error)?.message,
          variant: "destructive",
        }),
    },
  });
  const bayarBatch = useBayarBatchUpah({
    mutation: {
      onSuccess: (data) => {
        invalidateUpah();
        qc.invalidateQueries({ queryKey: getGetUpahListQueryKey({}) });
        if (batchPekerja?.pelanggan_id)
          qc.invalidateQueries({
            queryKey: getGetPelangganQueryKey(batchPekerja.pelanggan_id),
          });
        toast({
          title: "Pembayaran batch berhasil",
          description: data.message,
        });
        setIsBatchDialogOpen(false);
        setBatchPekerja(null);
        setPotongHutangBatchEnabled(false);
        setPotongHutangBatchAmount("");
        if (pendingKwitansiRef.current) {
          setKwitansiData(pendingKwitansiRef.current);
          setIsKwitansiOpen(true);
          pendingKwitansiRef.current = null;
        }
      },
      onError: (e: unknown) =>
        toast({
          title: "Gagal",
          description: (e as Error)?.message,
          variant: "destructive",
        }),
    },
  });
  const createPekerja = useCreatePekerja({
    mutation: {
      onSuccess: () => {
        invalidatePekerja();
        toast({ title: "Pekerja berhasil ditambah" });
        setIsPekerjaDialogOpen(false);
      },
      onError: (e: unknown) =>
        toast({
          title: "Gagal",
          description: (e as Error)?.message,
          variant: "destructive",
        }),
    },
  });
  const updatePekerja = useUpdatePekerja({
    mutation: {
      onSuccess: () => {
        invalidatePekerja();
        toast({ title: "Pekerja berhasil diperbarui" });
        setIsPekerjaDialogOpen(false);
        setEditingPekerja(null);
        setIsLinkDialogOpen(false);
        setLinkPekerja(null);
        setLinkPelangganId("none");
      },
      onError: (e: unknown) =>
        toast({
          title: "Gagal",
          description: (e as Error)?.message,
          variant: "destructive",
        }),
    },
  });
  const deletePekerja = useDeletePekerja({
    mutation: {
      onSuccess: () => {
        invalidatePekerja();
        invalidateUpah();
        toast({ title: "Pekerja berhasil dihapus" });
        setIsDeletePekerjaOpen(false);
        setDeletingPekerjaId(null);
      },
      onError: (e: unknown) =>
        toast({
          title: "Gagal",
          description: (e as Error)?.message,
          variant: "destructive",
        }),
    },
  });
  const sisaPerPekerja = useMemo(() => {
    const map = new Map<number, number>();
    (allUpahList ?? [])
      .filter((u) => u.status === "belum_lunas")
      .forEach((u) =>
        map.set(u.pekerja_id, (map.get(u.pekerja_id) ?? 0) + u.sisa_upah),
      );
    return map;
  }, [allUpahList]);
  const batchUpahList = useMemo(
    () =>
      !batchPekerja
        ? []
        : (allUpahList ?? [])
            .filter(
              (u) =>
                u.pekerja_id === batchPekerja.id && u.status === "belum_lunas",
            )
            .slice()
            .sort(
              (a, b) =>
                a.tanggal_kerja.localeCompare(b.tanggal_kerja) || a.id - b.id,
            ),
    [allUpahList, batchPekerja],
  );
  const totalSisaBatch = batchUpahList.reduce((acc, u) => acc + u.sisa_upah, 0);
  const totalSisaUpah = useMemo(
    () => (allUpahList ?? []).reduce((sum, u) => sum + u.sisa_upah, 0),
    [allUpahList],
  );
  const catatanBelumLunas = useMemo(
    () => (allUpahList ?? []).filter((u) => u.status === "belum_lunas").length,
    [allUpahList],
  );
  const hutangAktifTerkait = useMemo(
    () =>
      (linkedPelangganDetail?.hutang_list ?? [])
        .filter((h) => h.status === "aktif")
        .slice()
        .sort(
          (a, b) =>
            a.tanggal_hutang.localeCompare(b.tanggal_hutang) || a.id - b.id,
        ),
    [linkedPelangganDetail],
  );
  const hutangTertuaTerkait = hutangAktifTerkait[0] ?? null;
  const batchHutangAktifTerkait = useMemo(
    () =>
      (batchPelangganDetail?.hutang_list ?? [])
        .filter((h) => h.status === "aktif")
        .slice()
        .sort(
          (a, b) =>
            a.tanggal_hutang.localeCompare(b.tanggal_hutang) || a.id - b.id,
        ),
    [batchPelangganDetail],
  );
  const batchHutangTertuaTerkait = batchHutangAktifTerkait[0] ?? null;
  const selectedBatchHutangList = useMemo(() => {
    const selected = new Set(selectedBatchHutangIds);
    return batchHutangAktifTerkait.filter((hutang) => selected.has(hutang.id));
  }, [batchHutangAktifTerkait, selectedBatchHutangIds]);
  const selectedBatchHutangTotal = useMemo(
    () =>
      selectedBatchHutangList.reduce(
        (sum, hutang) => sum + hutang.sisa_hutang,
        0,
      ),
    [selectedBatchHutangList],
  );
  const jumlahBayarSingle = Number(bayarForm.watch("jumlah")) || 0;
  const potongHutangSingleNum =
    Number(potongHutangSingleAmount.replace(/[^0-9.]/g, "")) || 0;
  const jumlahBayarBatch = Number(batchForm.watch("jumlah_total")) || 0;
  const potongHutangBatchNum =
    Number(potongHutangBatchAmount.replace(/[^0-9.]/g, "")) || 0;
  useEffect(() => {
    if (!potongHutangBatchEnabled) return;
    const batasMaksimum = Math.min(jumlahBayarBatch, selectedBatchHutangTotal);
    if (batasMaksimum <= 0) {
      setPotongHutangBatchAmount("");
      return;
    }
    if (potongHutangBatchNum > batasMaksimum)
      setPotongHutangBatchAmount(String(batasMaksimum));
  }, [
    potongHutangBatchEnabled,
    jumlahBayarBatch,
    selectedBatchHutangTotal,
    potongHutangBatchNum,
  ]);
  const openTambahUpah = () => {
    setEditingUpah(null);
    upahForm.reset({
      pekerja_id: 0,
      keterangan: "",
      jumlah_total: 0,
      tanggal_kerja: today,
      catatan: "",
    });
    setIsUpahDialogOpen(true);
  };
  const openEditUpah = (u: UpahPekerja) => {
    setEditingUpah(u);
    upahForm.reset({
      pekerja_id: u.pekerja_id,
      keterangan: u.keterangan,
      jumlah_total: u.jumlah_total,
      tanggal_kerja: u.tanggal_kerja,
      catatan: u.catatan ?? "",
    });
    setIsUpahDialogOpen(true);
  };
  const openBayar = (u: UpahPekerja) => {
    setSelectedUpahId(u.id);
    bayarForm.reset({ jumlah: u.sisa_upah, tanggal_bayar: today, catatan: "" });
    setPotongHutangSingleEnabled(false);
    setPotongHutangSingleAmount("");
    setIsBayarDialogOpen(true);
  };
  const openBatch = (p: Pekerja) => {
    setBatchPekerja(p);
    batchForm.reset({
      jumlah_total: (allUpahList ?? [])
        .filter((u) => u.pekerja_id === p.id && u.status === "belum_lunas")
        .reduce((acc, u) => acc + u.sisa_upah, 0),
      tanggal_bayar: today,
      catatan: "",
    });
    setPotongHutangBatchEnabled(false);
    setPotongHutangBatchAmount("");
    setSelectedBatchHutangIds([]);
    setIsBatchDialogOpen(true);
  };
  const toggleBatchHutangSelection = (hutangId: number) => {
    const next = selectedBatchHutangIds.includes(hutangId)
      ? selectedBatchHutangIds.filter((id) => id !== hutangId)
      : [...selectedBatchHutangIds, hutangId];
    setSelectedBatchHutangIds(next);
    if (!next.length) {
      setPotongHutangBatchEnabled(false);
      setPotongHutangBatchAmount("");
    } else setPotongHutangBatchEnabled(true);
  };
  const submitBatch = (data: BatchForm) => {
    if (!batchPekerja) return;
    const hutangIds = potongHutangBatchEnabled ? selectedBatchHutangIds : [];
    const potong = hutangIds.length ? potongHutangBatchNum : 0;
    pendingKwitansiRef.current = {
      type: "batch",
      pekerja_nama: batchPekerja.nama,
      pekerja_jabatan: batchPekerja.jabatan ?? "",
      keterangan: "Pembayaran seluruh upah tertunggak",
      tanggal_bayar: data.tanggal_bayar,
      jumlah: Math.max(0, data.jumlah_total - potong),
      catatan:
        potong > 0
          ? `${data.catatan ? `${data.catatan} · ` : ""}Potong hutang ${formatRupiah(potong)}`
          : (data.catatan ?? ""),
      namaUsaha,
    };
    bayarBatch.mutate({
      id: batchPekerja.id,
      data: {
        jumlah_total: data.jumlah_total,
        tanggal_bayar: data.tanggal_bayar,
        catatan: data.catatan || undefined,
        potong_hutang: potong || undefined,
        hutang_ids: potong ? hutangIds : undefined,
      },
    });
  };
  const submitUpah = (data: UpahForm) =>
    editingUpah
      ? updateUpah.mutate({
          id: editingUpah.id,
          data: {
            keterangan: data.keterangan,
            jumlah_total: data.jumlah_total,
            tanggal_kerja: data.tanggal_kerja,
            catatan: data.catatan || null,
          },
        })
      : createUpah.mutate({
          data: {
            pekerja_id: data.pekerja_id,
            keterangan: data.keterangan,
            jumlah_total: data.jumlah_total,
            tanggal_kerja: data.tanggal_kerja,
            catatan: data.catatan || null,
          },
        });
  const submitBayar = (data: BayarForm) => {
    if (!selectedUpahId || !upahDetail) return;
    const potong = potongHutangSingleEnabled ? potongHutangSingleNum : 0;
    pendingKwitansiRef.current = {
      type: "single",
      pekerja_nama: upahDetail.pekerja_nama,
      pekerja_jabatan: upahDetail.pekerja_jabatan ?? "",
      keterangan: upahDetail.keterangan,
      tanggal_bayar: data.tanggal_bayar,
      jumlah: Math.max(0, data.jumlah - potong),
      catatan:
        potong > 0
          ? `${data.catatan ? `${data.catatan} · ` : ""}Potong hutang ${formatRupiah(potong)}`
          : (data.catatan ?? ""),
      namaUsaha,
    };
    bayarUpah.mutate({
      id: selectedUpahId,
      data: {
        upah_id: selectedUpahId,
        jumlah: data.jumlah,
        tanggal_bayar: data.tanggal_bayar,
        catatan: data.catatan || null,
        potong_hutang: potong || undefined,
      },
    });
  };
  const openTambahPekerja = () => {
    setEditingPekerja(null);
    pekerjaForm.reset({ nama: "", telepon: "", jabatan: "", catatan: "" });
    setIsPekerjaDialogOpen(true);
  };
  const openEditPekerja = (p: Pekerja) => {
    setEditingPekerja(p);
    pekerjaForm.reset({
      nama: p.nama,
      telepon: p.telepon ?? "",
      jabatan: p.jabatan ?? "",
      catatan: p.catatan ?? "",
    });
    setIsPekerjaDialogOpen(true);
  };
  const openLinkPelanggan = (p: Pekerja) => {
    setLinkPekerja(p);
    setLinkPelangganId(getSuggestedPelangganId(p)?.toString() ?? "none");
    setIsLinkDialogOpen(true);
  };
  const submitLinkPelanggan = () => {
    if (linkPekerja)
      updatePekerja.mutate({
        id: linkPekerja.id,
        data: {
          pelanggan_id:
            linkPelangganId === "none" ? null : Number(linkPelangganId),
        },
      });
  };
  const submitPekerja = (data: PekerjaForm) =>
    editingPekerja
      ? updatePekerja.mutate({
          id: editingPekerja.id,
          data: {
            nama: data.nama,
            telepon: data.telepon || null,
            jabatan: data.jabatan || null,
            catatan: data.catatan || null,
          },
        })
      : createPekerja.mutate({
          data: {
            nama: data.nama,
            telepon: data.telepon || null,
            jabatan: data.jabatan || null,
            catatan: data.catatan || null,
          },
        });
  const filteredUpah = (upahList ?? [])
    .filter(
      (u) =>
        !searchUpah ||
        u.pekerja_nama.toLowerCase().includes(searchUpah.toLowerCase()) ||
        u.keterangan.toLowerCase().includes(searchUpah.toLowerCase()),
    )
    .sort(
      (a, b) =>
        a.pekerja_nama.localeCompare(b.pekerja_nama, "id") ||
        b.tanggal_kerja.localeCompare(a.tanggal_kerja) ||
        b.id - a.id,
    );
  const filteredPekerja = (pekerjaList ?? [])
    .filter(
      (p) =>
        (!searchPekerja ||
          p.nama.toLowerCase().includes(searchPekerja.toLowerCase()) ||
          (p.jabatan ?? "")
            .toLowerCase()
            .includes(searchPekerja.toLowerCase())) &&
        (filterPekerjaLink === "semua" ||
          (filterPekerjaLink === "terhubung" && p.pelanggan_id != null) ||
          (filterPekerjaLink === "belum_terhubung" && p.pelanggan_id == null)),
    )
    .sort((a, b) => a.nama.localeCompare(b.nama, "id"));
  const exportUpahCSV = () => {
    const header = [
      "No",
      "Pekerja",
      "Jabatan",
      "Keterangan",
      "Tanggal Kerja",
      "Total Gaji",
      "Sudah Dibayar",
      "Sisa",
      "Status",
      "Catatan",
    ];
    const rows = filteredUpah.map((u, i) => [
      i + 1,
      u.pekerja_nama,
      u.pekerja_jabatan ?? "",
      u.keterangan,
      u.tanggal_kerja,
      u.jumlah_total,
      u.total_dibayar,
      u.sisa_upah,
      u.status === "lunas" ? "Lunas" : "Belum Lunas",
      u.catatan ?? "",
    ]);
    const csv = [header, ...rows]
      .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const url = URL.createObjectURL(
      new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `catatan-upah-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };
  return {
    lisensiAktif,
    filterStatus,
    setFilterStatus,
    filterPekerja,
    setFilterPekerja,
    searchUpah,
    setSearchUpah,
    isUpahDialogOpen,
    setIsUpahDialogOpen,
    isDeleteUpahOpen,
    setIsDeleteUpahOpen,
    editingUpah,
    setEditingUpah,
    deletingUpahId,
    setDeletingUpahId,
    isBayarDialogOpen,
    setIsBayarDialogOpen,
    deletingBayarId,
    setDeletingBayarId,
    isBoronganMode,
    setIsBoronganMode,
    boronganVolume,
    setBoronganVolume,
    boronganTarif,
    setBoronganTarif,
    searchPekerja,
    setSearchPekerja,
    isPekerjaDialogOpen,
    setIsPekerjaDialogOpen,
    isDeletePekerjaOpen,
    setIsDeletePekerjaOpen,
    editingPekerja,
    setEditingPekerja,
    deletingPekerjaId,
    setDeletingPekerjaId,
    filterPekerjaLink,
    setFilterPekerjaLink,
    isLinkDialogOpen,
    setIsLinkDialogOpen,
    linkPekerja,
    linkPelangganId,
    setLinkPelangganId,
    isBatchDialogOpen,
    setIsBatchDialogOpen,
    batchPekerja,
    setBatchPekerja,
    potongHutangSingleEnabled,
    setPotongHutangSingleEnabled,
    potongHutangSingleAmount,
    setPotongHutangSingleAmount,
    potongHutangBatchEnabled,
    setPotongHutangBatchEnabled,
    potongHutangBatchAmount,
    setPotongHutangBatchAmount,
    selectedBatchHutangIds,
    setSelectedBatchHutangIds,
    upahList,
    pekerjaList,
    pelangganList,
    pelangganById,
    suggestedPelangganId,
    upahDetail,
    loadingDetail,
    linkedPelangganId,
    linkedPelangganDetail,
    hutangTertuaTerkait,
    batchPelangganDetail,
    batchHutangAktifTerkait,
    batchHutangTertuaTerkait,
    selectedBatchHutangList,
    selectedBatchHutangTotal,
    batchUpahList,
    totalSisaBatch,
    totalSisaUpah,
    catatanBelumLunas,
    sisaPerPekerja,
    loadingUpah,
    loadingPekerja,
    filteredUpah,
    filteredPekerja,
    upahForm,
    pekerjaForm,
    bayarForm,
    batchForm,
    jumlahBayarSingle,
    potongHutangSingleNum,
    jumlahBayarBatch,
    potongHutangBatchNum,
    isPending: createUpah.isPending || updateUpah.isPending,
    isPekerjaFormPending: createPekerja.isPending || updatePekerja.isPending,
    bayarUpahPending: bayarUpah.isPending,
    deleteBayarPending: deleteBayar.isPending,
    bayarBatchPending: bayarBatch.isPending,
    deleteUpahPending: deleteUpah.isPending,
    deletePekerjaPending: deletePekerja.isPending,
    updatePekerjaPending: updatePekerja.isPending,
    openTambahUpah,
    openEditUpah,
    openBayar,
    openBatch,
    toggleBatchHutangSelection,
    submitBatch,
    submitUpah,
    submitBayar,
    openTambahPekerja,
    openEditPekerja,
    openLinkPelanggan,
    submitLinkPelanggan,
    submitPekerja,
    deleteUpah: (id: number) => deleteUpah.mutate({ id }),
    deletePekerja: (id: number) => deletePekerja.mutate({ id }),
    deleteBayar: (id: number) => deleteBayar.mutate({ id }),
    exportUpahCSV,
    isKwitansiOpen,
    setIsKwitansiOpen,
    kwitansiData,
    handleCetakKwitansiUpah,
  };
}

export type GajiData = ReturnType<typeof useGajiData>;
