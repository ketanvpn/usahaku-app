// ── ID Mapping Utilities for Backup Restore ──────────────────────────────────
// mapRequiredId: throws on missing (used during actual restore INSERT).
// mapOptionalId: returns null on missing (nullable FK).
// validateRefs: pre-validation — checks ALL referential integrity before any
//   destructive DELETE. Collects all errors instead of failing on the first.

export function mapRequiredId(idMap: Map<number, number>, oldId: number, tableName: string, fieldName: string): number {
  const newId = idMap.get(oldId);
  if (newId === undefined) {
    throw new Error(`ID mapping gagal: ${tableName}.${fieldName} ID lama ${oldId} tidak ditemukan di peta`);
  }
  return newId;
}

export function mapOptionalId(idMap: Map<number, number>, oldId: number | null | undefined): number | null {
  if (oldId == null) return null;
  return idMap.get(oldId) ?? null;
}

// ── Pre-validation: Referential Integrity Check ──────────────────────────────
// Runs BEFORE any DELETE/INSERT. Ensures every required FK reference in the
// backup data actually points to a record that exists in the same backup.

interface RefCheck {
  /** Table that holds the FK (e.g. "hutang") */
  table: string;
  /** FK field name (e.g. "pelanggan_id") */
  field: string;
  /** Set of valid IDs from the referenced table */
  validIds: Set<number>;
  /** Array of objects containing the FK value to check */
  rows: Array<Record<string, unknown>>;
  /** Whether the FK is required (true) or nullable (false) */
  required: boolean;
}

export interface ValidationError {
  table: string;
  field: string;
  invalidId: number;
  message: string;
}

/**
 * Validates referential integrity across all backup data.
 * Returns an array of errors — empty means all refs are valid.
 */
export function validateRefs(checks: RefCheck[]): ValidationError[] {
  const errors: ValidationError[] = [];
  for (const check of checks) {
    for (const row of check.rows) {
      const value = row[check.field];
      if (value == null) {
        if (check.required) {
          errors.push({
            table: check.table,
            field: check.field,
            invalidId: 0,
            message: `${check.table}.${check.field} wajib diisi tetapi bernilai null`,
          });
        }
        continue;
      }
      if (typeof value === "number" && !check.validIds.has(value)) {
        errors.push({
          table: check.table,
          field: check.field,
          invalidId: value,
          message: `${check.table}.${check.field} merujuk ID ${value} yang tidak ada di data backup`,
        });
      }
    }
  }
  return errors;
}
