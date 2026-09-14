/**
 * Logo management — save, read, and delete business logos via IPC.
 *
 * Logos are stored as files in <userData>/logos/<usahaId>/ to keep the
 * SQLite DB lean. Renderer sends base64 data; we validate, decode, and
 * write with mode 0600.
 */
import { app, ipcMain } from "electron";
import * as fs from "fs";
import * as path from "path";
import { writeLog } from "./logging";

const LOGO_MAX_BYTES = 1 * 1024 * 1024; // 1 MB binary
const LOGO_MAX_BASE64 = Math.ceil(LOGO_MAX_BYTES * 1.4);

function getLogosDir(usahaId: number): string {
  const safeId = Math.floor(Number(usahaId));
  if (!Number.isFinite(safeId) || safeId < 0) {
    throw new Error("usahaId tidak valid");
  }
  return path.join(app.getPath("userData"), "logos", String(safeId));
}

export function registerLogoIpc(): void {
  ipcMain.handle(
    "pengaturan:saveLogo",
    async (
      _event,
      payload: { usahaId: number; data: string; ext: string },
    ): Promise<{ success: boolean; filename?: string; message?: string }> => {
      try {
        const { usahaId, data, ext } = payload ?? {};

        if (typeof usahaId !== "number" || typeof data !== "string" || typeof ext !== "string") {
          return { success: false, message: "Payload tidak valid" };
        }

        const extLower = ext.toLowerCase();
        if (!["png", "jpg", "jpeg"].includes(extLower)) {
          return { success: false, message: "Format harus PNG atau JPG" };
        }

        if (data.length === 0) {
          return { success: false, message: "Data logo kosong" };
        }
        if (data.length > LOGO_MAX_BASE64) {
          return { success: false, message: "Logo maksimal 1 MB" };
        }

        const sample = data.slice(0, 1024);
        if (!/^[A-Za-z0-9+/=]+$/.test(sample)) {
          return { success: false, message: "Data logo tidak valid (bukan base64)" };
        }

        let buffer: Buffer;
        try {
          buffer = Buffer.from(data, "base64");
        } catch {
          return { success: false, message: "Gagal decode base64" };
        }

        if (buffer.length === 0 || buffer.length > LOGO_MAX_BYTES) {
          return { success: false, message: "Ukuran logo di luar batas" };
        }

        const logosDir = getLogosDir(usahaId);
        await fs.promises.mkdir(logosDir, { recursive: true });

        try {
          const oldFiles = await fs.promises.readdir(logosDir);
          for (const f of oldFiles) {
            await fs.promises.unlink(path.join(logosDir, f)).catch(() => {});
          }
        } catch {
          // Folder baru, abaikan.
        }

        const filename = `logo-${Date.now()}.${extLower}`;
        const filePath = path.join(logosDir, filename);
        await fs.promises.writeFile(filePath, buffer, { mode: 0o600 });

        return { success: true, filename };
      } catch (e) {
        writeLog(`pengaturan:saveLogo error: ${String(e)}`);
        return { success: false, message: "Gagal menyimpan logo" };
      }
    },
  );

  ipcMain.handle(
    "pengaturan:getLogoData",
    async (_event, usahaId: number, filename: string): Promise<string | null> => {
      try {
        if (typeof usahaId !== "number" || typeof filename !== "string" || filename.length === 0) {
          return null;
        }
        if (filename.includes("/") || filename.includes("\\") || filename.includes("..")) {
          return null;
        }

        const filePath = path.join(getLogosDir(usahaId), filename);

        const resolved = path.resolve(filePath);
        const allowedBase = path.resolve(getLogosDir(usahaId));
        if (!resolved.startsWith(allowedBase + path.sep) && resolved !== allowedBase) {
          return null;
        }

        const buf = await fs.promises.readFile(filePath);
        return buf.toString("base64");
      } catch {
        return null;
      }
    },
  );

  ipcMain.handle(
    "pengaturan:deleteLogo",
    async (_event, usahaId: number): Promise<{ success: boolean; message?: string }> => {
      try {
        const logosDir = getLogosDir(usahaId);
        await fs.promises.rm(logosDir, { recursive: true, force: true });
        return { success: true };
      } catch (e) {
        writeLog(`pengaturan:deleteLogo error: ${String(e)}`);
        return { success: false, message: "Gagal menghapus logo" };
      }
    },
  );
}
