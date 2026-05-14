import { ReactNode } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  LayoutDashboard,
  Users,
  WalletCards,
  CreditCard,
  ShoppingBag,
  Package,
  BookOpen,
  HardHat,
  FileText,
  DatabaseBackup,
  ShieldCheck,
  KeyRound,
  HelpCircle,
} from "lucide-react";

interface HelpDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface HelpSection {
  icon: ReactNode;
  judul: string;
  ringkasan: string;
  langkah: string[];
}

const sections: HelpSection[] = [
  {
    icon: <LayoutDashboard className="h-5 w-5 text-primary" />,
    judul: "Dashboard",
    ringkasan: "Ringkasan kondisi usaha hari ini.",
    langkah: [
      "Lihat saldo, total piutang aktif, dan transaksi kasir hari ini.",
      "Periksa peringatan stok rendah dan upah pekerja yang belum dibayar.",
      "Klik kartu apapun untuk masuk ke menu yang lebih detail.",
    ],
  },
  {
    icon: <Users className="h-5 w-5 text-primary" />,
    judul: "Pelanggan",
    ringkasan: "Master data pelanggan yang berhutang atau pembeli langganan.",
    langkah: [
      "Tambah pelanggan dengan tombol + Tambah Pelanggan.",
      "Klik nama pelanggan untuk lihat riwayat hutang & pembayaran.",
      "Edit/hapus melalui ikon di tabel.",
    ],
  },
  {
    icon: <WalletCards className="h-5 w-5 text-primary" />,
    judul: "Hutang",
    ringkasan: "Catat hutang baru yang dimiliki pelanggan ke usaha.",
    langkah: [
      "Klik + Tambah Hutang, pilih pelanggan, isi nominal & tanggal.",
      "Opsional isi tanggal jatuh tempo agar muncul peringatan kalau lewat.",
      "Hutang lunas otomatis berstatus Lunas saat sisa = 0.",
    ],
  },
  {
    icon: <CreditCard className="h-5 w-5 text-primary" />,
    judul: "Pembayaran",
    ringkasan: "Catat pembayaran hutang dari pelanggan.",
    langkah: [
      "Pilih pelanggan, lalu pilih hutang yang mau dibayar.",
      "Isi nominal pembayaran. Sisa hutang otomatis di-update.",
      "Cetak kwitansi langsung dari halaman pembayaran.",
    ],
  },
  {
    icon: <ShoppingBag className="h-5 w-5 text-primary" />,
    judul: "Kasir",
    ringkasan: "Transaksi penjualan multi-item ke pembeli langsung.",
    langkah: [
      "Tambah barang ke keranjang dengan klik + atau scan kode.",
      "Atur jumlah, terapkan diskon bila ada.",
      "Klik Bayar, masukkan uang yang diterima, lihat kembalian.",
      "Cetak struk lewat tombol Print di halaman riwayat.",
    ],
  },
  {
    icon: <Package className="h-5 w-5 text-primary" />,
    judul: "Barang & Stok",
    ringkasan: "Kelola master barang dan riwayat stok masuk/keluar.",
    langkah: [
      "Tambah barang baru dengan harga beli, harga jual, dan stok minimum.",
      "Tab Stok Masuk: input pembelian dari supplier — otomatis nambah stok & catat di Keuangan.",
      "Tab Stok Keluar: input pengurangan stok manual (rusak, retur, dll).",
      "Badge angka di sidebar muncul kalau ada barang dengan stok ≤ minimum.",
    ],
  },
  {
    icon: <BookOpen className="h-5 w-5 text-primary" />,
    judul: "Keuangan",
    ringkasan: "Catatan kas masuk dan keluar.",
    langkah: [
      "Tambah pemasukan/pengeluaran manual dengan kategori.",
      "Transaksi kasir & stok masuk otomatis muncul di sini.",
      "Lihat saldo per bulan dan rekap per kategori.",
    ],
  },
  {
    icon: <HardHat className="h-5 w-5 text-primary" />,
    judul: "Pekerja & Upah",
    ringkasan: "Kelola pekerja dan upah harian/borongan.",
    langkah: [
      "Tab Pekerja: tambah pekerja dengan nama, jabatan, telepon.",
      "Tab Upah: catat upah per kerjaan, status awal Belum Lunas.",
      "Bayar upah satu-satu atau batch (semua tunggakan sekaligus).",
      "Badge angka di sidebar muncul kalau ada upah belum lunas.",
    ],
  },
  {
    icon: <FileText className="h-5 w-5 text-primary" />,
    judul: "Laporan",
    ringkasan: "Rekap & cetak laporan untuk pembukuan.",
    langkah: [
      "Pilih periode (bulanan, tahunan, atau custom).",
      "Tab tersedia: Piutang, Kasir, Stok, Keuangan, Upah Pekerja.",
      "Export ke Excel atau cetak ke PDF lewat tombol Print.",
    ],
  },
  {
    icon: <DatabaseBackup className="h-5 w-5 text-primary" />,
    judul: "Backup & Restore",
    ringkasan: "Cadangkan dan kembalikan data agar tidak hilang.",
    langkah: [
      "Klik Backup Sekarang untuk simpan file .usahaku-bak ke komputer Anda.",
      "Untuk restore, klik Pilih File lalu cari file backup.",
      "Aplikasi ingatkan otomatis kalau sudah 7 hari tidak backup.",
      "PENTING: Simpan file backup di tempat aman (flashdisk, Google Drive, dll).",
    ],
  },
  {
    icon: <ShieldCheck className="h-5 w-5 text-primary" />,
    judul: "Lisensi",
    ringkasan: "Aktivasi & perpanjangan lisensi aplikasi.",
    langkah: [
      "Masukkan kode lisensi yang Anda terima dari penyedia.",
      "Lihat sisa hari aktif dan tanggal kadaluarsa.",
      "7 hari sebelum habis muncul peringatan untuk perpanjang.",
    ],
  },
  {
    icon: <KeyRound className="h-5 w-5 text-primary" />,
    judul: "Profil & Keamanan",
    ringkasan: "Edit data usaha & ganti password login.",
    langkah: [
      "Edit nama usaha, alamat, telepon — info ini muncul di struk dan kwitansi.",
      "Ganti password berkala untuk keamanan.",
      "Lupa password? Hubungi penyedia aplikasi untuk kode reset.",
    ],
  },
];

export function HelpDialog({ open, onOpenChange }: HelpDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <HelpCircle className="h-5 w-5 text-primary" />
            Panduan Pemakaian Usahaku
          </DialogTitle>
          <DialogDescription>
            Penjelasan singkat tiap menu. Klik judul mana saja untuk lihat langkah.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          {sections.map((s) => (
            <section key={s.judul} className="border rounded-lg p-4 bg-muted/30">
              <div className="flex items-start gap-3">
                <div className="mt-0.5">{s.icon}</div>
                <div className="flex-1">
                  <h3 className="font-semibold text-foreground">{s.judul}</h3>
                  <p className="text-sm text-muted-foreground mb-2">{s.ringkasan}</p>
                  <ol className="text-sm space-y-1 list-decimal pl-5">
                    {s.langkah.map((l, i) => (
                      <li key={i} className="text-foreground/90">{l}</li>
                    ))}
                  </ol>
                </div>
              </div>
            </section>
          ))}

          <div className="text-xs text-muted-foreground border-t pt-3 mt-4">
            <p className="font-semibold mb-1">Tips Cepat</p>
            <ul className="list-disc pl-5 space-y-0.5">
              <li>Backup data minimal sekali seminggu — file disimpan di komputer Anda, jadi kalau laptop rusak, data hilang kalau tidak ada backup.</li>
              <li>Logout setelah selesai pakai kalau aplikasi dipakai bersama.</li>
              <li>Periksa badge angka merah/oranye di sidebar — itu indikator hal yang butuh perhatian.</li>
            </ul>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
