import { randomBytes } from "crypto";
import { logger } from "./logger";

function shouldFailOnInsecureSecret() {
  return process.env.STRICT_SECRET_POLICY === "fail";
}

export function resolveSecret(opts: {
  key: string;
  value: string | undefined;
  fallback: string;
  reason: string;
}): string {
  if (opts.value && opts.value.trim().length > 0) {
    return opts.value;
  }

  if (shouldFailOnInsecureSecret()) {
    throw new Error(
      `[security] ${opts.key} tidak diset (${opts.reason}). ` +
        `STRICT_SECRET_POLICY=fail aktif, startup dihentikan. ` +
        `Set env ${opts.key} untuk melanjutkan.`
    );
  }

  const generated = randomBytes(32).toString("hex");

  logger.warn(
    { key: opts.key, reason: opts.reason },
    `${opts.key} tidak diset — menggunakan random secret. Set env ${opts.key} untuk konsistensi antar restart.`
  );

  return generated;
}
