import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TableSkeleton } from "@/components/ui/table-skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PekerjaModal } from "@/components/gaji/pekerja-modal";
import { BatchPaymentDialog } from "@/components/gaji/batch-payment-dialog";
import { BayarUpahDialog } from "@/components/gaji/bayar-upah-dialog";
import { DeleteConfirmDialogs } from "@/components/gaji/delete-confirm-dialogs";
import { KwitansiDialog } from "@/components/gaji/kwitansi-dialog";
import { LinkPelangganDialog } from "@/components/gaji/link-pelanggan-dialog";
import { UpahFormDialog } from "@/components/gaji/upah-form-dialog";
import { StatusBadge } from "@/components/gaji/types";
import { useGajiData } from "@/components/gaji/use-gaji-data";
import { formatDate, formatRupiah } from "@/lib/format";
import {
  Banknote,
  Download,
  Edit,
  HardHat,
  Link2,
  Plus,
  Search,
  Trash2,
  TrendingDown,
  Users,
} from "lucide-react";

export default function GajiTenagaPage() {
  const gaji = useGajiData();
  return (
    <div className="space-y-4">
      <div className="page-hero">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary/75">
            Operasional Tenaga
          </p>
          <h1 className="page-hero-title mt-2 flex items-center gap-2">
            <HardHat className="h-7 w-7" />
            Gaji & Tenaga
          </h1>
          <p className="page-hero-description">
            Kelola catatan upah, pembayaran pekerja, relasi pelanggan, dan
            kwitansi pembayaran dalam satu tempat.
          </p>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="data-card border-red-200/70 bg-gradient-to-br from-red-50 to-rose-50/70 dark:from-red-950/30 dark:to-rose-950/10">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-500/10 rounded-xl shrink-0">
                <TrendingDown className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total Sisa Upah</p>
                <p className="text-lg font-bold text-red-700">
                  {formatRupiah(gaji.totalSisaUpah)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="data-card">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-3">
              <Users className="h-5 w-5 text-blue-600" />
              <div>
                <p className="text-xs text-muted-foreground">Jumlah Pekerja</p>
                <p className="text-lg font-bold">
                  {gaji.pekerjaList?.length ?? 0} orang
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="data-card">
          <CardContent className="pt-5 pb-4">
            <p className="text-xs text-muted-foreground">Catatan Belum Lunas</p>
            <p className="text-lg font-bold text-orange-700">
              {gaji.catatanBelumLunas} catatan
            </p>
          </CardContent>
        </Card>
      </div>
      <Tabs defaultValue="upah">
        <TabsList>
          <TabsTrigger value="upah" className="gap-2">
            <Banknote className="h-4 w-4" />
            Catatan Upah
          </TabsTrigger>
          <TabsTrigger value="pekerja" className="gap-2">
            <Users className="h-4 w-4" />
            Daftar Pekerja
          </TabsTrigger>
        </TabsList>
        <TabsContent value="upah" className="space-y-4 mt-4">
          <div className="toolbar-card flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Cari nama pekerja atau keterangan..."
                className="pl-9 rounded-xl bg-background/80"
                value={gaji.searchUpah}
                onChange={(event) => gaji.setSearchUpah(event.target.value)}
              />
            </div>
            <Select
              value={gaji.filterStatus ?? "semua"}
              onValueChange={(value) =>
                gaji.setFilterStatus(
                  value === "semua"
                    ? undefined
                    : (value as "lunas" | "belum_lunas"),
                )
              }
            >
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue placeholder="Semua Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="semua">Semua Status</SelectItem>
                <SelectItem value="belum_lunas">Belum Lunas</SelectItem>
                <SelectItem value="lunas">Lunas</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              onClick={gaji.exportUpahCSV}
              disabled={!gaji.filteredUpah.length}
            >
              <Download className="h-4 w-4 mr-1" /> Unduh CSV
            </Button>
            <Button onClick={gaji.openTambahUpah} disabled={!gaji.lisensiAktif}>
              <Plus className="h-4 w-4 mr-1" /> Tambah Upah
            </Button>
          </div>
          <Card className="data-card">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table className="table-premium">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Pekerja</TableHead>
                      <TableHead>Keterangan</TableHead>
                      <TableHead className="text-right">Total Gaji</TableHead>
                      <TableHead className="text-right">
                        Sudah Dibayar
                      </TableHead>
                      <TableHead className="text-right">Sisa</TableHead>
                      <TableHead>Tanggal Kerja</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  {gaji.loadingUpah ? (
                    <TableSkeleton cols={8} />
                  ) : (
                    <TableBody>
                      {gaji.filteredUpah.map((upah) => (
                        <TableRow key={upah.id}>
                          <TableCell>
                            <div className="font-medium">
                              {upah.pekerja_nama}
                            </div>
                            {upah.pekerja_jabatan && (
                              <div className="text-xs text-muted-foreground">
                                {upah.pekerja_jabatan}
                              </div>
                            )}
                          </TableCell>
                          <TableCell>{upah.keterangan}</TableCell>
                          <TableCell className="text-right">
                            {formatRupiah(upah.jumlah_total)}
                          </TableCell>
                          <TableCell className="text-right text-green-700">
                            {formatRupiah(upah.total_dibayar)}
                          </TableCell>
                          <TableCell className="text-right font-semibold text-red-700">
                            {formatRupiah(upah.sisa_upah)}
                          </TableCell>
                          <TableCell>
                            {formatDate(upah.tanggal_kerja)}
                          </TableCell>
                          <TableCell>
                            <StatusBadge status={upah.status} />
                          </TableCell>
                          <TableCell>
                            <div className="flex justify-end gap-1">
                              {upah.status !== "lunas" && (
                                <Button
                                  size="sm"
                                  onClick={() => gaji.openBayar(upah)}
                                  disabled={!gaji.lisensiAktif}
                                >
                                  <Banknote className="h-3 w-3 mr-1" /> Bayar
                                </Button>
                              )}
                              <Button
                                size="sm"
                                variant="outline"
                                className="action-icon-btn"
                                onClick={() => gaji.openEditUpah(upah)}
                                disabled={!gaji.lisensiAktif}
                              >
                                <Edit className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="action-icon-btn text-destructive hover:text-destructive"
                                onClick={() => {
                                  gaji.setDeletingUpahId(upah.id);
                                  gaji.setIsDeleteUpahOpen(true);
                                }}
                                disabled={!gaji.lisensiAktif}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  )}
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="pekerja" className="space-y-4 mt-4">
          <div className="toolbar-card flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Cari nama atau jabatan..."
                className="pl-9 rounded-xl bg-background/80"
                value={gaji.searchPekerja}
                onChange={(event) => gaji.setSearchPekerja(event.target.value)}
              />
            </div>
            <Button
              onClick={gaji.openTambahPekerja}
              disabled={!gaji.lisensiAktif}
            >
              <Plus className="h-4 w-4 mr-1" /> Tambah Pekerja
            </Button>
          </div>
          <Card className="data-card">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table className="table-premium">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nama</TableHead>
                      <TableHead>Jabatan</TableHead>
                      <TableHead>Telepon</TableHead>
                      <TableHead>Pelanggan</TableHead>
                      <TableHead className="text-right">Sisa Upah</TableHead>
                      <TableHead className="text-right">Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  {gaji.loadingPekerja ? (
                    <TableSkeleton cols={6} />
                  ) : (
                    <TableBody>
                      {gaji.filteredPekerja.map((pekerja) => {
                        const sisa = gaji.sisaPerPekerja.get(pekerja.id) ?? 0;
                        return (
                          <TableRow key={pekerja.id}>
                            <TableCell className="font-medium">
                              {pekerja.nama}
                            </TableCell>
                            <TableCell>{pekerja.jabatan ?? "-"}</TableCell>
                            <TableCell>{pekerja.telepon ?? "-"}</TableCell>
                            <TableCell>
                              {pekerja.pelanggan_id ? (
                                <Badge variant="secondary">Terhubung</Badge>
                              ) : (
                                <Badge variant="outline">Belum terhubung</Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              {sisa ? formatRupiah(sisa) : "Lunas"}
                            </TableCell>
                            <TableCell>
                              <div className="flex justify-end gap-1">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() =>
                                    gaji.openLinkPelanggan(pekerja)
                                  }
                                  disabled={!gaji.lisensiAktif}
                                >
                                  <Link2 className="h-3 w-3 mr-1" />
                                  Hubungkan
                                </Button>
                                <Button
                                  size="sm"
                                  onClick={() => gaji.openBatch(pekerja)}
                                  disabled={!gaji.lisensiAktif || !sisa}
                                >
                                  <Banknote className="h-3 w-3 mr-1" /> Bayar
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="action-icon-btn"
                                  onClick={() => gaji.openEditPekerja(pekerja)}
                                >
                                  <Edit className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="action-icon-btn text-destructive"
                                  onClick={() => {
                                    gaji.setDeletingPekerjaId(pekerja.id);
                                    gaji.setIsDeletePekerjaOpen(true);
                                  }}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  )}
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      <UpahFormDialog {...gaji} />
      <BayarUpahDialog {...gaji} />
      <BatchPaymentDialog {...gaji} />
      <LinkPelangganDialog {...gaji} />
      <DeleteConfirmDialogs {...gaji} />
      <KwitansiDialog {...gaji} />
      <PekerjaModal
        open={gaji.isPekerjaDialogOpen}
        onOpenChange={gaji.setIsPekerjaDialogOpen}
        editingPekerja={gaji.editingPekerja}
        pelangganList={gaji.pelangganList}
        onSubmit={gaji.submitPekerja}
        isSubmitting={gaji.isPekerjaFormPending}
      />
    </div>
  );
}
