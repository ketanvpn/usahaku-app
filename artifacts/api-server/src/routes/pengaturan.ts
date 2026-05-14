import { Router, type IRouter } from "express";
import { db, pengaturanTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { requireAuth, requireLicense } from "../middlewares/auth";

const router: IRouter = Router();

// Whitelist key yang boleh disimpan. Mencegah user nyimpan key acak (DoS via DB bloat).
// Tambah key di sini bila ada setting baru.
export const ALLOWED_KEYS = new Set<string>([
  "struk_header",
  "struk_footer",
  "struk_ukuran_kertas",
  "struk_tampilkan_logo",
  "logo_filename",
]);

// Default value untuk setiap key. Dipakai bila row belum ada di DB.
export const DEFAULTS: Record<string, string | null> = {
  struk_header: "",
  struk_footer: "Terima kasih atas kunjungan Anda",
  struk_ukuran_kertas: "80mm",
  struk_tampilkan_logo: "1",
  logo_filename: null,
};

// Batas panjang value supaya tidak ada attacker stuff DB. 4 KB cukup untuk teks struk panjang.
export const MAX_VALUE_LENGTH = 4096;

/**
 * Merge stored settings dengan default. Stored menang.
 * Key yang tidak ada di whitelist diabaikan dari stored (defensif).
 */
export function mergeWithDefaults(
  stored: Record<string, string | null>,
): Record<string, string | null> {
  const result: Record<string, string | null> = { ...DEFAULTS };
  for (const k of Object.keys(stored)) {
    if (ALLOWED_KEYS.has(k)) {
      result[k] = stored[k];
    }
  }
  return result;
}

/**
 * Validasi item batch: key di whitelist + value tidak terlalu panjang.
 * Return `null` bila valid, atau pesan error string bila invalid.
 */
export function validateBatchItem(item: {
  key: string;
  value: string | null;
}): string | null {
  if (!ALLOWED_KEYS.has(item.key)) {
    return `Key "${item.key}" tidak dikenali.`;
  }
  if (item.value !== null && item.value.length > MAX_VALUE_LENGTH) {
    return `Nilai untuk "${item.key}" terlalu panjang (maks ${MAX_VALUE_LENGTH} karakter).`;
  }
  return null;
}

const PengaturanBatchBody = z.object({
  items: z
    .array(
      z.object({
        key: z.string().min(1).max(64),
        value: z.string().nullable(),
      }),
    )
    .min(1)
    .max(20),
});

// ── GET /api/pengaturan ──────────────────────────────────────────────────────
// Return semua setting untuk usaha aktif. Inject default di server agar
// frontend tidak perlu fallback per-key.
router.get("/pengaturan", requireAuth, async (req, res): Promise<void> => {
  const usahaId = req.session.usahaId;
  if (!usahaId) {
    res.status(403).json({ error: "Akses ditolak." });
    return;
  }

  const rows = await db
    .select()
    .from(pengaturanTable)
    .where(eq(pengaturanTable.usahaId, usahaId));

  const stored: Record<string, string | null> = {};
  for (const r of rows) {
    stored[r.key] = r.value;
  }

  res.json(mergeWithDefaults(stored));
});

// ── PUT /api/pengaturan/batch ────────────────────────────────────────────────
// Upsert beberapa key sekaligus. Body: { items: [{ key, value }] }.
router.put(
  "/pengaturan/batch",
  requireAuth,
  requireLicense,
  async (req, res): Promise<void> => {
    const usahaId = req.session.usahaId;
    if (!usahaId) {
      res.status(403).json({ error: "Akses ditolak." });
      return;
    }

    const parsed = PengaturanBatchBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Format pengaturan tidak valid." });
      return;
    }

    // Validasi tiap key di whitelist + value tidak terlalu panjang.
    for (const item of parsed.data.items) {
      const errMsg = validateBatchItem(item);
      if (errMsg) {
        res.status(400).json({ error: errMsg });
        return;
      }
    }

    // Upsert per key. Pakai loop bukan transaction supaya simple — partial
    // failure di tengah loop tidak realistis karena semua key sudah divalidasi.
    for (const { key, value } of parsed.data.items) {
      const existing = await db
        .select({ id: pengaturanTable.id })
        .from(pengaturanTable)
        .where(
          and(
            eq(pengaturanTable.usahaId, usahaId),
            eq(pengaturanTable.key, key),
          ),
        );

      if (existing.length > 0) {
        await db
          .update(pengaturanTable)
          .set({ value, updatedAt: new Date() })
          .where(
            and(
              eq(pengaturanTable.usahaId, usahaId),
              eq(pengaturanTable.key, key),
            ),
          );
      } else {
        await db.insert(pengaturanTable).values({ usahaId, key, value });
      }
    }

    res.json({ success: true });
  },
);

export default router;
