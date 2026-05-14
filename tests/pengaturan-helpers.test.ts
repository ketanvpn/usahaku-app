import { describe, it, expect, vi } from "vitest";

// Stub @workspace/db & drizzle-orm — modul pengaturan.ts impor mereka tapi kita
// hanya butuh helper murni (mergeWithDefaults, validateBatchItem) yang tidak
// menyentuh DB sama sekali.
vi.mock("@workspace/db", () => ({
  db: {},
  pengaturanTable: { usahaId: "usahaId", key: "key", id: "id" },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn(() => "eq-stub"),
  and: vi.fn(() => "and-stub"),
}));

vi.mock("../artifacts/api-server/src/middlewares/auth", () => ({
  requireAuth: vi.fn(),
  requireLicense: vi.fn(),
}));

import {
  ALLOWED_KEYS,
  DEFAULTS,
  MAX_VALUE_LENGTH,
  mergeWithDefaults,
  validateBatchItem,
} from "../artifacts/api-server/src/routes/pengaturan";

describe("pengaturan helpers — mergeWithDefaults", () => {
  it("return semua default ketika stored kosong", () => {
    const result = mergeWithDefaults({});
    expect(result.struk_header).toBe("");
    expect(result.struk_footer).toBe("Terima kasih atas kunjungan Anda");
    expect(result.struk_ukuran_kertas).toBe("80mm");
    expect(result.struk_tampilkan_logo).toBe("1");
    expect(result.logo_filename).toBeNull();
  });

  it("stored mengganti default per-key", () => {
    const result = mergeWithDefaults({
      struk_header: "Toko ABC",
      struk_ukuran_kertas: "58mm",
    });
    expect(result.struk_header).toBe("Toko ABC");
    expect(result.struk_ukuran_kertas).toBe("58mm");
    // Default lain tetap utuh
    expect(result.struk_footer).toBe("Terima kasih atas kunjungan Anda");
    expect(result.struk_tampilkan_logo).toBe("1");
  });

  it("abaikan key yang tidak ada di whitelist", () => {
    const result = mergeWithDefaults({
      struk_header: "Toko ABC",
      sql_injection: "DROP TABLE",
      random_key: "harusnya hilang",
    } as Record<string, string | null>);
    expect(result.struk_header).toBe("Toko ABC");
    expect("sql_injection" in result).toBe(false);
    expect("random_key" in result).toBe(false);
  });

  it("hasil mengandung semua key whitelist", () => {
    const result = mergeWithDefaults({});
    for (const key of ALLOWED_KEYS) {
      expect(key in result).toBe(true);
    }
  });

  it("nilai null dari stored dipertahankan (override default non-null)", () => {
    const result = mergeWithDefaults({ struk_footer: null });
    expect(result.struk_footer).toBeNull();
  });
});

describe("pengaturan helpers — validateBatchItem", () => {
  it("return null untuk item valid", () => {
    expect(validateBatchItem({ key: "struk_header", value: "Toko" })).toBeNull();
    expect(validateBatchItem({ key: "struk_tampilkan_logo", value: "1" })).toBeNull();
    expect(validateBatchItem({ key: "logo_filename", value: null })).toBeNull();
  });

  it("tolak key tidak whitelisted", () => {
    const err = validateBatchItem({ key: "sql_injection", value: "DROP" });
    expect(err).toContain("tidak dikenali");
  });

  it("tolak value yang terlalu panjang", () => {
    const longValue = "x".repeat(MAX_VALUE_LENGTH + 1);
    const err = validateBatchItem({ key: "struk_header", value: longValue });
    expect(err).toContain("terlalu panjang");
  });

  it("terima value tepat di batas MAX_VALUE_LENGTH", () => {
    const exactValue = "x".repeat(MAX_VALUE_LENGTH);
    expect(validateBatchItem({ key: "struk_header", value: exactValue })).toBeNull();
  });

  it("terima value null untuk semua key whitelisted", () => {
    for (const key of ALLOWED_KEYS) {
      expect(validateBatchItem({ key, value: null })).toBeNull();
    }
  });
});

describe("pengaturan helpers — DEFAULTS", () => {
  it("DEFAULTS hanya berisi key yang di whitelist", () => {
    for (const key of Object.keys(DEFAULTS)) {
      expect(ALLOWED_KEYS.has(key)).toBe(true);
    }
  });
});
