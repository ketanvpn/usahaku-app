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

import { eq, and, like, desc } from "drizzle-orm";
import { pembayaranTable, db } from "@workspace/db";

/**
 * Generate the next kwitansi number for a given usaha and year.
 * Uses a sorted query with LIMIT 1 instead of scanning ALL records.
 *
 * Format: KWT-{year}-{0001}
 *
 * @returns The next kwitansi number string
 */
export function generateKwitansiNumber(usahaId: number, tahun?: number): string {
  const year = tahun ?? new Date().getFullYear();
  const prefix = `KWT-${year}-`;

  // Get the highest kwitansi number by sorting descending and taking first
  const rows = db.select({ nomor: pembayaranTable.nomorKwitansi })
    .from(pembayaranTable)
    .where(and(
      eq(pembayaranTable.usahaId, usahaId),
      like(pembayaranTable.nomorKwitansi, `${prefix}%`),
    ))
    .orderBy(desc(pembayaranTable.nomorKwitansi))
    .limit(1)
    .all();

  let maxUrut = 0;
  if (rows.length > 0 && rows[0].nomor) {
    const parts = rows[0].nomor.split("-");
    const urut = parseInt(parts[parts.length - 1] || "0");
    if (!isNaN(urut)) maxUrut = urut;
  }

  return `${prefix}${String(maxUrut + 1).padStart(4, "0")}`;
}
