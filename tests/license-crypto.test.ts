import { describe, it, expect } from "vitest";
import { generateLicenseKey, verifyLicenseKey } from "../artifacts/api-server/src/utils/license-crypto";

describe("license-crypto", () => {
  it("generates a key that verifies successfully", () => {
    const { key, expiresAt } = generateLicenseKey("1bulan");
    const result = verifyLicenseKey(key);
    expect(result.valid).toBe(true);
    expect(result.tipe).toBe("1bulan");
    // Key menyimpan expiry sebagai unix timestamp (detik), jadi presisi
    // milidetik hilang. Bandingkan pada tingkat detik.
    const expectedSec = Math.floor(expiresAt.getTime() / 1000);
    const actualSec = Math.floor((result.expiresAt?.getTime() ?? 0) / 1000);
    expect(actualSec).toBe(expectedSec);
  });

  it("rejects key that has been tampered with", () => {
    const { key } = generateLicenseKey("3bulan");
    // Flip the last hex char
    const tampered = key.slice(0, -1) + (key.slice(-1) === "0" ? "1" : "0");
    const result = verifyLicenseKey(tampered);
    expect(result.valid).toBe(false);
  });

  it("rejects malformed key", () => {
    const result = verifyLicenseKey("BUKU-1234-5678");
    expect(result.valid).toBe(false);
  });

  it("normalizes lowercase and missing prefix", () => {
    const { key } = generateLicenseKey("6bulan");
    const noPrefix = key.replace(/^BUKU-/, "").toLowerCase();
    const result = verifyLicenseKey(noPrefix);
    expect(result.valid).toBe(true);
    expect(result.tipe).toBe("6bulan");
  });

  it("verifies offline master key even if backend had a different secret", () => {
    const { key } = generateLicenseKey("1tahun", "BUKUHUTANG_LICENSE_SECRET_V1_2024_OFFLINE");
    const result = verifyLicenseKey(key);
    expect(result.valid).toBe(true);
    expect(result.tipe).toBe("1tahun");
  });
});
