import { Router, type IRouter } from "express";
import { db, suppliersTable, transaksiStokTable, barangTable } from "@workspace/db";
import { eq, and, asc, desc } from "drizzle-orm";
import { z } from "zod";
import { requireAuth, requireLicense } from "../middlewares/auth";

const router: IRouter = Router();

// ── Schemas ────────────────────────────────────────────────────────────────

const SupplierBodySchema = z.object({
  nama: z.string().min(1, "Nama wajib diisi").trim(),
  telepon: z.string().trim().optional().nullable(),
  alamat: z.string().trim().optional().nullable(),
  catatan: z.string().trim().optional().nullable(),
});

// ── Helpers ────────────────────────────────────────────────────────────────

function toTitleCase(str: string): string {
  return str
    .trim()
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

function fmtSupplier(s: typeof suppliersTable.$inferSelect) {
  return {
    id: s.id,
    usaha_id: s.usahaId,
    nama: s.nama,
    telepon: s.telepon ?? null,
    alamat: s.alamat ?? null,
    catatan: s.catatan ?? null,
    created_at:
      s.createdAt instanceof Date
        ? s.createdAt.toISOString()
        : new Date(s.createdAt).toISOString(),
  };
}

// ── Routes ─────────────────────────────────────────────────────────────────

// GET /api/suppliers
router.get("/suppliers", requireAuth, async (req, res): Promise<void> => {
  const usahaId = req.session.usahaId;
  if (!usahaId) {
    res.status(403).json({ error: "Akses ditolak." });
    return;
  }

  const list = await db
    .select()
    .from(suppliersTable)
    .where(eq(suppliersTable.usahaId, usahaId))
    .orderBy(asc(suppliersTable.nama), asc(suppliersTable.id));
  res.json(list.map(fmtSupplier));
});

// POST /api/suppliers
router.post(
  "/suppliers",
  requireAuth,
  requireLicense,
  async (req, res): Promise<void> => {
    const usahaId = req.session.usahaId;
    if (!usahaId) {
      res.status(403).json({ error: "Akses ditolak." });
      return;
    }

    const parsed = SupplierBodySchema.safeParse(req.body);
    if (!parsed.success) {
      res
        .status(400)
        .json({ error: parsed.error.issues[0]?.message ?? "Data tidak valid" });
      return;
    }

    const [supplier] = await db
      .insert(suppliersTable)
      .values({
        usahaId,
        nama: toTitleCase(parsed.data.nama),
        telepon: parsed.data.telepon ?? null,
        alamat: parsed.data.alamat ?? null,
        catatan: parsed.data.catatan ?? null,
      })
      .returning();

    res.status(201).json(fmtSupplier(supplier));
  },
);

// GET /api/suppliers/:id — detail supplier + agregasi pembelian
router.get("/suppliers/:id", requireAuth, async (req, res): Promise<void> => {
  const usahaId = req.session.usahaId;
  if (!usahaId) {
    res.status(403).json({ error: "Akses ditolak." });
    return;
  }

  const idParam = typeof req.params.id === "string" ? req.params.id : "";
  const id = parseInt(idParam, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "ID tidak valid." });
    return;
  }

  const [supplier] = await db
    .select()
    .from(suppliersTable)
    .where(
      and(eq(suppliersTable.id, id), eq(suppliersTable.usahaId, usahaId)),
    );

  if (!supplier) {
    res.status(404).json({ error: "Supplier tidak ditemukan." });
    return;
  }

  // v1.1.1: agregasi pembelian dari supplier ini.
  // Pakai SQL.raw untuk SUM(jumlah * harga_satuan) supaya konsisten dengan
  // total Rp di stok.ts. Filter usaha_id ditambah supaya tenant-safe.
  const transaksiList = await db
    .select()
    .from(transaksiStokTable)
    .where(
      and(
        eq(transaksiStokTable.supplierId, id),
        eq(transaksiStokTable.usahaId, usahaId),
        eq(transaksiStokTable.tipe, "masuk"),
      ),
    )
    .orderBy(desc(transaksiStokTable.tanggal), desc(transaksiStokTable.id));

  const barangList = await db
    .select()
    .from(barangTable)
    .where(eq(barangTable.usahaId, usahaId));
  const barangMap = new Map(barangList.map((b) => [b.id, b]));

  let totalNilai = 0;
  type BarangAgg = { barang_id: number; nama: string; satuan: string; total_jumlah: number; total_nilai: number };
  const perBarang = new Map<number, BarangAgg>();

  for (const t of transaksiList) {
    const jumlah = parseFloat(t.jumlah);
    const harga = parseFloat(t.hargaSatuan);
    const sub = jumlah * harga;
    totalNilai += sub;

    const b = barangMap.get(t.barangId);
    const namaBarang = b?.nama ?? `(barang #${t.barangId} terhapus)`;
    const satuan = b?.satuan ?? "";
    const exist = perBarang.get(t.barangId);
    if (exist) {
      exist.total_jumlah += jumlah;
      exist.total_nilai += sub;
    } else {
      perBarang.set(t.barangId, {
        barang_id: t.barangId,
        nama: namaBarang,
        satuan,
        total_jumlah: jumlah,
        total_nilai: sub,
      });
    }
  }

  const barangTerbeli = Array.from(perBarang.values()).sort(
    (a, b) => b.total_nilai - a.total_nilai,
  );

  // Tampilkan max 10 transaksi terakhir di response. Sisanya bisa dilihat di
  // halaman Stok kalau user butuh — tidak perlu duplikasi semua di sini.
  const transaksiTerakhir = transaksiList.slice(0, 10).map((t) => {
    const b = barangMap.get(t.barangId);
    const jumlah = parseFloat(t.jumlah);
    const harga = parseFloat(t.hargaSatuan);
    return {
      id: t.id,
      tanggal: t.tanggal,
      barang_id: t.barangId,
      nama_barang: b?.nama ?? `(barang #${t.barangId})`,
      satuan: b?.satuan ?? "",
      jumlah,
      harga_satuan: harga,
      total: jumlah * harga,
      keterangan: t.keterangan ?? null,
    };
  });

  res.json({
    ...fmtSupplier(supplier),
    total_transaksi: transaksiList.length,
    total_pembelian: totalNilai,
    barang_terbeli: barangTerbeli,
    transaksi_terakhir: transaksiTerakhir,
  });
});

// PUT /api/suppliers/:id
router.put(
  "/suppliers/:id",
  requireAuth,
  requireLicense,
  async (req, res): Promise<void> => {
    const usahaId = req.session.usahaId;
    if (!usahaId) {
      res.status(403).json({ error: "Akses ditolak." });
      return;
    }

    const idParam = typeof req.params.id === "string" ? req.params.id : "";
    const id = parseInt(idParam, 10);
    if (isNaN(id)) {
      res.status(400).json({ error: "ID tidak valid." });
      return;
    }

    const parsed = SupplierBodySchema.safeParse(req.body);
    if (!parsed.success) {
      res
        .status(400)
        .json({ error: parsed.error.issues[0]?.message ?? "Data tidak valid" });
      return;
    }

    const [supplier] = await db
      .update(suppliersTable)
      .set({
        nama: toTitleCase(parsed.data.nama),
        telepon: parsed.data.telepon ?? null,
        alamat: parsed.data.alamat ?? null,
        catatan: parsed.data.catatan ?? null,
      })
      .where(
        and(eq(suppliersTable.id, id), eq(suppliersTable.usahaId, usahaId)),
      )
      .returning();

    if (!supplier) {
      res.status(404).json({ error: "Supplier tidak ditemukan." });
      return;
    }

    res.json(fmtSupplier(supplier));
  },
);

// DELETE /api/suppliers/:id
// Cegah hapus kalau masih ada transaksi_stok yang memakainya, supaya tidak
// meninggalkan dangling reference di histori.
router.delete(
  "/suppliers/:id",
  requireAuth,
  requireLicense,
  async (req, res): Promise<void> => {
    const usahaId = req.session.usahaId;
    if (!usahaId) {
      res.status(403).json({ error: "Akses ditolak." });
      return;
    }

    const idParam = typeof req.params.id === "string" ? req.params.id : "";
    const id = parseInt(idParam, 10);
    if (isNaN(id)) {
      res.status(400).json({ error: "ID tidak valid." });
      return;
    }

    const [existing] = await db
      .select()
      .from(suppliersTable)
      .where(
        and(eq(suppliersTable.id, id), eq(suppliersTable.usahaId, usahaId)),
      );

    if (!existing) {
      res.status(404).json({ error: "Supplier tidak ditemukan." });
      return;
    }

    const dipakai = await db
      .select({ id: transaksiStokTable.id })
      .from(transaksiStokTable)
      .where(
        and(
          eq(transaksiStokTable.supplierId, id),
          eq(transaksiStokTable.usahaId, usahaId),
        ),
      );

    if (dipakai.length > 0) {
      res.status(400).json({
        error: `Supplier ini masih dipakai di ${dipakai.length} transaksi stok masuk. Hapus / ubah transaksi terkait dulu, atau biarkan supplier ini tetap tercatat.`,
      });
      return;
    }

    await db
      .delete(suppliersTable)
      .where(
        and(eq(suppliersTable.id, id), eq(suppliersTable.usahaId, usahaId)),
      );

    res.json({ message: "Supplier berhasil dihapus." });
  },
);

export default router;
