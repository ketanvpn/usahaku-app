/**
 * money.ts — Safe integer-based money helpers for Indonesian Rupiah.
 *
 * All money in the DB is stored as TEXT (string).  These helpers convert
 * text→number using Math.round() (not parseFloat alone) so every
 * intermediate calculation stays as an exact integer — no floating-point
 * drift across thousands of transactions.
 *
 * Rupiah has no sub-units (no sen), so rounding to the nearest integer
 * is always correct.
 */

/**
 * Convert a text/string money value from the DB to a safe integer number.
 * Returns 0 for null / undefined / empty / NaN values.
 *
 * @example toNum("150000")   // 150000
 * @example toNum("99.99999") // 100
 * @example toNum(null)       // 0
 */
export function toNum(value: string | null | undefined): number {
  if (value == null || value === "") return 0;
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n) : 0;
}

/**
 * Convert a number to the string format expected by Drizzle text columns.
 *
 * @example toStr(150000) // "150000"
 */
export function toStr(value: number): string {
  return String(Math.round(value));
}

// ── Kwitansi Number Generation ───────────────────────────────────────────────

import { eq, and, like, sql } from "drizzle-orm";
import { pembayaranTable, db } from "@workspace/db";

/** Minimal interface satisfied by both `db` and `tx` from `db.transaction()`. */
interface QueryRunner {
  select: typeof db.select;
}

/**
 * Generate the next kwitansi number for a given usaha and year.
 *
 * Format: KWT-{year}-{NNNN}  (zero-padded to 4 digits, grows beyond 4 if needed)
 *
 * **Bug fixes (v1.2.29):**
 * - Uses integer extraction (`CAST … AS INTEGER`) instead of lexicographic
 *   string sort, so numbering stays correct past 9999.
 * - Accepts an optional `queryRunner` (tx) so callers can generate the number
 *   INSIDE a transaction, eliminating race-condition duplicates.
 *
 * @param usahaId  - The business ID
 * @param tahun    - Override year (defaults to current year)
 * @param queryRunner - Pass `tx` from `db.transaction(tx => …)` to make generation atomic
 * @returns The next kwitansi number string, e.g. "KWT-2026-0042"
 */
export function generateKwitansiNumber(
  usahaId: number,
  tahun?: number,
  queryRunner?: QueryRunner,
): string {
  const runner = queryRunner ?? db;
  const year = tahun ?? new Date().getFullYear();
  const prefix = `KWT-${year}-`;

  const rows = runner
    .select({
      maxUrut: sql<number>`MAX(CAST(SUBSTR(${pembayaranTable.nomorKwitansi}, ${prefix.length + 1}) AS INTEGER))`,
    })
    .from(pembayaranTable)
    .where(
      and(
        eq(pembayaranTable.usahaId, usahaId),
        like(pembayaranTable.nomorKwitansi, `${prefix}%`),
      ),
    )
    .all();

  const maxUrut = rows[0]?.maxUrut ?? 0;
  const next = (maxUrut ?? 0) + 1;

  return `${prefix}${String(next).padStart(4, "0")}`;
}
