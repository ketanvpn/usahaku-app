import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, ShieldCheck, ShieldAlert, ShieldOff, KeyRound, AlertTriangle, MessageCircle } from "lucide-react";

const PAKET_LISENSI = [
  { label: "1 Bulan", durasi: "30 hari", harga: 19900 },
  { label: "3 Bulan", durasi: "90 hari", harga: 54900, populer: true },
  { label: "6 Bulan", durasi: "180 hari", harga: 99000 },
  { label: "1 Tahun", durasi: "365 hari", harga: 179000 },
];

const WA_NUMBER = "6282397803813";
const WA_MESSAGE = encodeURIComponent("Halo, saya ingin order/perpanjang lisensi Usahaku. Mohon info lebih lanjut.");

function formatRupiahLisensi(n: number) {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(n);
}

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

interface LicenseStatus {
  aktif: boolean;
  expires_at: string | null;
  sisa_hari: number;
  jam_dimanipulasi?: boolean;
}

async function fetchStatus(): Promise<LicenseStatus> {
  const r = await fetch(`${BASE}/api/lisensi/status`, { credentials: "include" });
  if (!r.ok) throw new Error("Gagal memuat status lisensi");
  return r.json();
}

async function aktivasiKey(key: string): Promise<{ message: string; tipe: string; expires_at: string }> {
  const r = await fetch(`${BASE}/api/lisensi/aktivasi`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ key }),
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data.error || data.message || "Gagal aktivasi");
  return data;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("id-ID", {
    weekday: "long", day: "2-digit", month: "long", year: "numeric",
  });
}

export default function LisensiPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [keyInput, setKeyInput] = useState("");

  const { data: status, isLoading } = useQuery({
    queryKey: ["lisensi-status"],
    queryFn: fetchStatus,
  });

  const aktivasiMutation = useMutation({
    mutationFn: () => aktivasiKey(keyInput.trim()),
    onSuccess: (data) => {
      toast({ title: "Lisensi Aktif!", description: data.message });
      setKeyInput("");
      qc.invalidateQueries({ queryKey: ["lisensi-status"] });
    },
    onError: (e: Error) => {
      toast({ title: "Aktivasi Gagal", description: e.message, variant: "destructive" });
    },
  });

  const sisaHari = status?.sisa_hari ?? 0;
  const isNearExpiry = status?.aktif && sisaHari <= 7;

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div>
        <h2 className="text-3xl font-bold tracking-tight text-primary">Lisensi Aplikasi</h2>
        <p className="text-muted-foreground">Kelola dan aktivasi lisensi untuk menggunakan fitur lengkap.</p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : (
        <>
          {status?.jam_dimanipulasi && (
            <Card className="border-2 border-yellow-400 bg-yellow-50">
              <CardContent className="pt-6">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-6 w-6 text-yellow-600 mt-0.5 shrink-0" />
                  <div>
                    <p className="font-semibold text-yellow-800">Tanggal & Waktu PC Tidak Valid</p>
                    <p className="text-sm text-yellow-700 mt-1">
                      Sistem mendeteksi tanggal di komputer ini dimundurkan. Lisensi dinonaktifkan sementara sebagai tindakan keamanan.
                    </p>
                    <p className="text-sm text-yellow-700 mt-1 font-medium">
                      Betulkan tanggal dan waktu Windows ke tanggal yang benar, lalu buka ulang aplikasi.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <Card className={`border-2 ${status?.aktif ? (isNearExpiry ? "border-orange-300" : "border-green-300") : "border-red-300"}`}>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                {status?.aktif ? (
                  isNearExpiry ? (
                    <div className="rounded-full bg-orange-100 p-3">
                      <ShieldAlert className="h-8 w-8 text-orange-500" />
                    </div>
                  ) : (
                    <div className="rounded-full bg-green-100 p-3">
                      <ShieldCheck className="h-8 w-8 text-green-600" />
                    </div>
                  )
                ) : (
                  <div className="rounded-full bg-red-100 p-3">
                    <ShieldOff className="h-8 w-8 text-red-500" />
                  </div>
                )}
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-lg font-semibold">Status Lisensi</p>
                    {status?.aktif ? (
                      <Badge className={`${isNearExpiry ? "bg-orange-100 text-orange-700" : "bg-green-100 text-green-700"} hover:bg-opacity-100`}>
                        {isNearExpiry ? "Segera Habis" : "Aktif"}
                      </Badge>
                    ) : (
                      <Badge variant="destructive">Tidak Aktif</Badge>
                    )}
                  </div>
                  {status?.aktif && status.expires_at ? (
                    <div className="space-y-0.5">
                      <p className="text-sm text-muted-foreground">
                        Berlaku hingga: <span className="font-medium text-foreground">{formatDate(status.expires_at)}</span>
                      </p>
                      <p className={`text-sm font-semibold ${isNearExpiry ? "text-orange-600" : "text-green-600"}`}>
                        Sisa {sisaHari} hari
                      </p>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Lisensi belum aktif. Input key dari Super Admin untuk mengaktifkan.
                    </p>
                  )}
                </div>
              </div>
              {isNearExpiry && (
                <div className="mt-4 rounded-md bg-orange-50 border border-orange-200 p-3 text-sm text-orange-700">
                  ⚠ Lisensi Anda akan habis dalam {sisaHari} hari. Segera hubungi Super Admin untuk perpanjangan.
                </div>
              )}
              {!status?.aktif && (
                <div className="mt-4 rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-700">
                  ⛔ Lisensi tidak aktif — fitur tambah, edit, dan hapus data tidak tersedia. Hanya mode baca (lihat data) yang bisa digunakan.
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <KeyRound className="h-5 w-5" /> Aktivasi License Key
              </CardTitle>
              <CardDescription>
                Masukkan license key yang diberikan oleh Super Admin. Key hanya bisa dipakai sekali.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <Input
                  placeholder="Contoh: BUKU-A1B2-C3D4-E5F6-G7H8-I9J0-K1L2"
                  value={keyInput}
                  onChange={(e) => setKeyInput(e.target.value.toUpperCase())}
                  className="font-mono tracking-wider"
                  onKeyDown={(e) => e.key === "Enter" && keyInput.trim() && aktivasiMutation.mutate()}
                />
                <Button
                  className="w-full"
                  onClick={() => aktivasiMutation.mutate()}
                  disabled={!keyInput.trim() || aktivasiMutation.isPending}
                >
                  {aktivasiMutation.isPending
                    ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Memverifikasi...</>
                    : <><ShieldCheck className="h-4 w-4 mr-2" /> Aktivasi Lisensi</>
                  }
                </Button>
              </div>
              <div className="mt-4 rounded-md bg-muted p-3 text-xs text-muted-foreground space-y-1">
                <p className="font-medium">Cara aktivasi:</p>
                <ol className="list-decimal list-inside space-y-0.5">
                  <li>Minta license key dari Super Admin (via WhatsApp, SMS, dll)</li>
                  <li>Ketik atau tempel key di kotak di atas</li>
                  <li>Klik tombol Aktivasi Lisensi</li>
                </ol>
              </div>
            </CardContent>
          </Card>

          {/* Paket Harga */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageCircle className="h-5 w-5" /> Paket & Harga Lisensi
              </CardTitle>
              <CardDescription>
                Pilih paket yang sesuai, lalu hubungi Admin via WhatsApp untuk pemesanan.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                {PAKET_LISENSI.map((paket) => (
                  <div
                    key={paket.label}
                    className={`relative rounded-lg border-2 p-4 text-center space-y-1 ${
                      paket.populer
                        ? "border-primary bg-primary/5"
                        : "border-border bg-muted/20"
                    }`}
                  >
                    {paket.populer && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                        <Badge className="text-[10px] px-2 py-0.5 bg-primary text-primary-foreground">
                          Populer
                        </Badge>
                      </div>
                    )}
                    <p className="font-semibold text-sm">{paket.label}</p>
                    <p className="text-xs text-muted-foreground">{paket.durasi}</p>
                    <p className={`text-lg font-bold ${paket.populer ? "text-primary" : "text-foreground"}`}>
                      {formatRupiahLisensi(paket.harga)}
                    </p>
                  </div>
                ))}
              </div>

              <p className="text-xs text-muted-foreground text-center italic">
                * Harga dapat berubah sewaktu-waktu. Konfirmasi ke Admin untuk harga terkini.
              </p>

              <a
                href={`https://wa.me/${WA_NUMBER}?text=${WA_MESSAGE}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button className="w-full bg-green-600 hover:bg-green-700 text-white">
                  <MessageCircle className="h-4 w-4 mr-2" />
                  Hubungi Admin via WhatsApp
                </Button>
              </a>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
