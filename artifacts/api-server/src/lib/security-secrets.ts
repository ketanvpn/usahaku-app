const warnedKeys = new Set<string>();

function shouldWarnOrFail() {
  return process.env.NODE_ENV === "production";
}

function shouldFailOnInsecureSecret() {
  return process.env.STRICT_SECRET_POLICY === "fail";
}

export function resolveSecret(opts: {
  key: string;
  value: string | undefined;
  fallback: string;
  reason: string;
}): string {
  const value = opts.value && opts.value.trim().length > 0 ? opts.value : opts.fallback;
  const usesFallback = value === opts.fallback;

  if (usesFallback && shouldWarnOrFail()) {
    const msg = `[security] ${opts.key} memakai fallback bawaan (${opts.reason}). Set env ${opts.key} untuk production.`;

    if (shouldFailOnInsecureSecret()) {
      throw new Error(`${msg} STRICT_SECRET_POLICY=fail aktif, startup dihentikan.`);
    }

    if (!warnedKeys.has(opts.key)) {
      warnedKeys.add(opts.key);
      console.warn(msg);
    }
  }

  return value;
}
