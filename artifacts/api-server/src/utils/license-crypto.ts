import { createHmac, randomBytes } from "crypto";

const SECRET = process.env.LICENSE_SECRET ?? "BUKUHUTANG_LICENSE_SECRET_V1_2024_OFFLINE";

export type LicenseTipe = "harian" | "bulanan" | "tahunan";

const TIPE_CODE: Record<LicenseTipe, number> = {
  harian: 1,
  bulanan: 2,
  tahunan: 3,
};

const CODE_TIPE: Record<number, LicenseTipe> = {
  1: "harian",
  2: "bulanan",
  3: "tahunan",
};

export const DURASI_HARI: Record<LicenseTipe, number> = {
  harian: 1,
  bulanan: 30,
  tahunan: 365,
};

export function calcExpiresAt(tipe: LicenseTipe, from: Date = new Date()): Date {
  const d = new Date(from);
  d.setDate(d.getDate() + DURASI_HARI[tipe]);
  return d;
}

export function generateLicenseKey(tipe: LicenseTipe): { key: string; expiresAt: Date } {
  const expiresAt = calcExpiresAt(tipe);

  const buf = Buffer.alloc(8);
  buf.writeUInt8(TIPE_CODE[tipe], 0);
  buf.writeUInt32BE(Math.floor(expiresAt.getTime() / 1000), 1);
  const nonce = randomBytes(3);
  nonce.copy(buf, 5);

  const hmac = createHmac("sha256", SECRET).update(buf).digest();
  const sig = hmac.slice(0, 4);

  const full = Buffer.concat([buf, sig]);
  const hex = full.toString("hex").toUpperCase();
  const parts = hex.match(/.{1,4}/g)!;
  const key = "BUKU-" + parts.join("-");

  return { key, expiresAt };
}

export function verifyLicenseKey(keyStr: string): {
  valid: boolean;
  tipe?: LicenseTipe;
  expiresAt?: Date;
  error?: string;
} {
  const clean = keyStr.trim().toUpperCase().replace(/^BUKU-/, "").replace(/-/g, "");

  if (clean.length !== 24) {
    return { valid: false, error: "Format key tidak valid. Pastikan key diketik dengan benar." };
  }

  let full: Buffer;
  try {
    full = Buffer.from(clean, "hex");
  } catch {
    return { valid: false, error: "Format key tidak valid." };
  }

  if (full.length !== 12) {
    return { valid: false, error: "Format key tidak valid." };
  }

  const buf = full.subarray(0, 8);
  const sig = full.subarray(8, 12);

  const hmac = createHmac("sha256", SECRET).update(buf).digest();
  const expectedSig = hmac.subarray(0, 4);

  if (!sig.equals(expectedSig)) {
    return { valid: false, error: "Key tidak valid atau sudah dimanipulasi." };
  }

  const typeCode = buf.readUInt8(0);
  const tipe = CODE_TIPE[typeCode];
  if (!tipe) {
    return { valid: false, error: "Tipe lisensi tidak dikenal." };
  }

  const expUnix = buf.readUInt32BE(1);
  const expiresAt = new Date(expUnix * 1000);

  if (expiresAt < new Date()) {
    return { valid: false, error: `Lisensi sudah kadaluarsa sejak ${expiresAt.toLocaleDateString("id-ID")}.` };
  }

  return { valid: true, tipe, expiresAt };
}

export function formatKeyDisplay(key: string): string {
  return key.toUpperCase();
}
