/**
 * Install-time secret management.
 *
 * On first install a random sessionSecret is generated and persisted to
 * `<userData>/install-secrets.json`. License and reset secrets are read
 * from env vars or generated randomly if not set.
 *
 * SECURITY FIX: Hardcoded default secrets have been removed. When no
 * env var is provided the app now generates a cryptographically random
 * secret per installation, preventing all installs from sharing the
 * same signing key.
 */
import { app } from "electron";
import * as crypto from "crypto";
import * as fs from "fs";
import * as path from "path";
import { writeLog } from "./logging";

export interface InstallSecrets {
  sessionSecret: string;
  licenseSecret: string;
  resetSecret: string;
}

function generateRandomSecret(): string {
  return crypto.randomBytes(32).toString("hex");
}

export function loadOrCreateInstallSecrets(): InstallSecrets {
  const userData = app.getPath("userData");
  const file = path.join(userData, "install-secrets.json");

  function generate(): InstallSecrets {
    return {
      sessionSecret: generateRandomSecret(),
      licenseSecret: process.env.LICENSE_SECRET || generateRandomSecret(),
      resetSecret: process.env.RESET_SECRET || generateRandomSecret(),
    };
  }

  try {
    if (fs.existsSync(file)) {
      const parsed = JSON.parse(fs.readFileSync(file, "utf8")) as Partial<InstallSecrets>;
      const fresh = generate();
      const merged: InstallSecrets = {
        sessionSecret: parsed.sessionSecret && parsed.sessionSecret.length >= 32 ? parsed.sessionSecret : fresh.sessionSecret,
        // Persist existing secrets from file if present; override only when
        // an env var is explicitly set (so rotation is opt-in).
        licenseSecret: process.env.LICENSE_SECRET || (parsed.licenseSecret && parsed.licenseSecret.length >= 32 ? parsed.licenseSecret : fresh.licenseSecret),
        resetSecret: process.env.RESET_SECRET || (parsed.resetSecret && parsed.resetSecret.length >= 32 ? parsed.resetSecret : fresh.resetSecret),
      };
      if (
        merged.sessionSecret !== parsed.sessionSecret ||
        merged.licenseSecret !== parsed.licenseSecret ||
        merged.resetSecret !== parsed.resetSecret
      ) {
        fs.writeFileSync(file, JSON.stringify(merged, null, 2), { encoding: "utf8", mode: 0o600 });
      }
      return merged;
    }
  } catch (e) {
    writeLog(`[secrets] Gagal baca ${file}: ${e instanceof Error ? e.message : String(e)} — generate baru`);
  }

  const fresh = generate();
  try {
    fs.mkdirSync(userData, { recursive: true });
    fs.writeFileSync(file, JSON.stringify(fresh, null, 2), { encoding: "utf8", mode: 0o600 });
  } catch (e) {
    writeLog(`[secrets] Gagal tulis ${file}: ${e instanceof Error ? e.message : String(e)}`);
  }
  return fresh;
}
