/**
 * Local backup management — auto-backup on close, manual save/restore,
 * DB file validation, and IPC handlers.
 */
import { app, dialog, ipcMain } from "electron";
import * as fs from "fs";
import * as http from "http";
import * as path from "path";
import {
  BACKEND_PORT,
  mainWindow,
  backendProcess,
  getDbPath,
  setBackendProcess,
  setIsRestoring,
} from "./app-state";
import { writeLog } from "./logging";
import { startBackend, waitForBackend } from "./backend";

// ── Settings helpers (duplicated intentionally to avoid circular deps) ────────
// main.ts owns readSettings/writeSettings; we import them lazily via the
// barrel pattern below so we don't create a hard dependency cycle.

let _readSettings: () => Record<string, unknown> = () => ({});
let _writeSettings: (_s: Record<string, unknown>) => void = () => {};

export function injectSettingsHelpers(
  read: () => Record<string, unknown>,
  write: (s: Record<string, unknown>) => void,
): void {
  _readSettings = read;
  _writeSettings = write;
}

// ── Backup directory ──────────────────────────────────────────────────────────

export function getAutoBackupDir(): string {
  const settings = _readSettings();
  if (typeof settings.backupFolder === "string" && settings.backupFolder.trim()) {
    return settings.backupFolder;
  }
  return path.join(app.getPath("documents"), "UsahakuBackup");
}

// ── WAL checkpoint ────────────────────────────────────────────────────────────

export async function walCheckpoint(): Promise<void> {
  try {
    await new Promise<void>((resolve) => {
      const req = http.request(
        { hostname: "127.0.0.1", port: BACKEND_PORT, path: "/api/internal/wal-checkpoint", method: "POST" },
        (res) => { res.resume(); res.on("end", resolve); }
      );
      req.on("error", () => resolve());
      req.end();
    });
    writeLog("[backup] WAL checkpoint selesai");
  } catch {
    writeLog("[backup] WAL checkpoint gagal — backup tetap dilanjutkan");
  }
}

// ── Validation ────────────────────────────────────────────────────────────────

export function validateBackupDbFile(filePath: string): { valid: boolean; reason?: string } {
  try {
    const stat = fs.statSync(filePath);
    writeLog(`[restore] Ukuran file backup: ${stat.size} bytes`);

    if (stat.size < 8 * 1024) {
      return {
        valid: false,
        reason: `File backup terlalu kecil (${Math.round(stat.size / 1024)} KB) dan bukan file database Usahaku yang valid. Pastikan Anda memilih file backup yang benar.`,
      };
    }

    const fd = fs.openSync(filePath, "r");
    const header = Buffer.alloc(16);
    fs.readSync(fd, header, 0, 16, 0);
    fs.closeSync(fd);
    if (header.toString("utf8", 0, 15) !== "SQLite format 3") {
      return { valid: false, reason: "File bukan database SQLite yang valid. Pastikan file yang dipilih adalah backup Usahaku (.db)." };
    }

    return { valid: true };
  } catch (e) {
    writeLog(`[restore] Validasi file backup error: ${e}`);
    return { valid: false, reason: `File backup tidak dapat dibaca: ${e instanceof Error ? e.message : String(e)}` };
  }
}

// ── DB integrity check via backend ────────────────────────────────────────────

async function dbIntegrityCheck(): Promise<boolean> {
  try {
    const ok = await new Promise<boolean>((resolve) => {
      const req = http.request(
        { hostname: "127.0.0.1", port: BACKEND_PORT, path: "/api/internal/db-integrity", method: "POST" },
        (res) => {
          let body = "";
          res.on("data", (d: Buffer) => { body += d.toString(); });
          res.on("end", () => {
            try { resolve(JSON.parse(body)?.ok === true); } catch { resolve(false); }
          });
        }
      );
      req.on("error", () => resolve(false));
      req.end();
    });
    writeLog(`[restore] Integrity check: ${ok ? "OK" : "GAGAL"}`);
    return ok;
  } catch {
    writeLog("[restore] Integrity check: exception — dianggap gagal");
    return false;
  }
}

// ── File copy with retry ──────────────────────────────────────────────────────

async function copyFileWithRetry(src: string, dest: string, maxAttempts = 3): Promise<void> {
  let lastErr: unknown;
  for (let i = 0; i < maxAttempts; i++) {
    try {
      fs.copyFileSync(src, dest);
      return;
    } catch (err) {
      lastErr = err;
      writeLog(`[restore] copyFile percobaan ${i + 1} gagal: ${err} — tunggu 600ms`);
      await new Promise<void>((r) => setTimeout(r, 600));
    }
  }
  throw lastErr;
}

// ── Auto-backup (called on close and will-quit) ──────────────────────────────

export function performAutoBackup(): void {
  const dbPath = getDbPath();
  if (!fs.existsSync(dbPath)) {
    writeLog("Auto-backup: DB tidak ditemukan, dilewati");
    return;
  }
  const backupDir = getAutoBackupDir();
  try {
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }
    const now = new Date();
    const datePart = now.toISOString().slice(0, 10);
    const timePart = now.toTimeString().slice(0, 8).replace(/:/g, "-");
    const backupFile = path.join(backupDir, `usahaku_${datePart}_${timePart}.db`);
    fs.copyFileSync(dbPath, backupFile);

    const check = validateBackupDbFile(backupFile);
    if (!check.valid) {
      writeLog(`Auto-backup GAGAL validasi: ${check.reason} — file dihapus`);
      try { fs.unlinkSync(backupFile); } catch {}
      return;
    }
    writeLog(`Auto-backup tersimpan dan valid: ${backupFile}`);

    // Hapus backup lama, simpan maksimal 7 file terbaru
    const allFiles = fs.readdirSync(backupDir)
      .filter((f) => f.startsWith("usahaku_") && f.endsWith(".db"))
      .sort()
      .map((f) => path.join(backupDir, f));
    if (allFiles.length > 7) {
      allFiles.slice(0, allFiles.length - 7).forEach((f) => {
        try { fs.unlinkSync(f); } catch {}
      });
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    writeLog(`Auto-backup gagal: ${msg}`);
  }
}

// ── Full restore flow ─────────────────────────────────────────────────────────

export async function performRestoreFromFile(sourcePath: string): Promise<{ success: boolean; canceled?: boolean; message?: string }> {
  const dbPath = getDbPath();
  const rollbackPath = dbPath + ".rollback";

  const validation = validateBackupDbFile(sourcePath);
  if (!validation.valid) {
    writeLog(`[restore] File backup tidak valid: ${validation.reason}`);
    return { success: false, message: validation.reason ?? "File backup tidak valid." };
  }

  try {
    fs.copyFileSync(dbPath, rollbackPath);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, message: `Gagal membuat salinan pengaman: ${msg}` };
  }

  setIsRestoring(true);
  if (backendProcess) {
    backendProcess.kill();
    setBackendProcess(null);
  }
  await new Promise<void>((r) => setTimeout(r, 1500));

  // Hapus file WAL dan SHM agar data lama tidak menimpa DB yang akan di-restore
  try { fs.unlinkSync(dbPath + "-wal"); } catch {}
  try { fs.unlinkSync(dbPath + "-shm"); } catch {}

  try {
    await copyFileWithRetry(sourcePath, dbPath);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    writeLog(`[restore] Semua percobaan copy gagal: ${msg}`);
    try { fs.copyFileSync(rollbackPath, dbPath); } catch {}
    try { fs.unlinkSync(rollbackPath); } catch {}
    startBackend();
    setIsRestoring(false);
    return { success: false, message: `Gagal menyalin file database: ${msg}` };
  }

  try {
    startBackend();
    await waitForBackend(BACKEND_PORT, 20000);

    const healthy = await dbIntegrityCheck();
    if (!healthy) {
      writeLog("[restore] Integrity check gagal — rollback ke data sebelumnya");
      const stuck = backendProcess as Electron.UtilityProcess | null;
      stuck?.kill();
      setBackendProcess(null);
      await new Promise<void>((r) => setTimeout(r, 500));
      try { fs.copyFileSync(rollbackPath, dbPath); } catch {}
      try { fs.unlinkSync(rollbackPath); } catch {}
      startBackend();
      setIsRestoring(false);
      return { success: false, message: "File backup rusak atau tidak kompatibel (integrity check gagal). Data Anda sudah dikembalikan." };
    }

    try { fs.unlinkSync(rollbackPath); } catch {}
    setIsRestoring(false);
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.reload();
    return { success: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    writeLog(`[restore] Backend gagal start, rollback: ${msg}`);
    const stuck = backendProcess as Electron.UtilityProcess | null;
    stuck?.kill();
    setBackendProcess(null);
    await new Promise<void>((r) => setTimeout(r, 400));
    try {
      fs.copyFileSync(rollbackPath, dbPath);
      fs.unlinkSync(rollbackPath);
    } catch {}
    startBackend();
    setIsRestoring(false);
    return { success: false, message: "File backup tidak valid atau tidak kompatibel. Data Anda sudah dikembalikan." };
  }
}

// ── IPC handlers ──────────────────────────────────────────────────────────────

export function registerLocalBackupIpc(): void {
  ipcMain.handle("backup:getFolder", () => getAutoBackupDir());

  ipcMain.handle("backup:openFolder", async (): Promise<{ success: boolean; message?: string }> => {
    const { shell } = await import("electron");
    try {
      const folder = getAutoBackupDir();
      if (!fs.existsSync(folder)) {
        fs.mkdirSync(folder, { recursive: true });
      }
      const err = await shell.openPath(folder);
      if (err) return { success: false, message: err };
      return { success: true };
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      return { success: false, message: msg };
    }
  });

  ipcMain.handle("backup:chooseFolder", async () => {
    if (!mainWindow) return null;
    const result = await dialog.showOpenDialog(mainWindow, {
      title: "Pilih Folder Backup Usahaku",
      properties: ["openDirectory", "createDirectory"],
      defaultPath: getAutoBackupDir(),
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    const chosen = result.filePaths[0];
    const settings = _readSettings();
    settings.backupFolder = chosen;
    _writeSettings(settings);
    writeLog(`Folder backup diubah ke: ${chosen}`);
    return chosen;
  });

  ipcMain.handle("backup:restoreDB", async (): Promise<{ success: boolean; canceled?: boolean; message?: string }> => {
    if (!mainWindow) return { success: false, message: "Window tidak tersedia" };

    const result = await dialog.showOpenDialog(mainWindow, {
      title: "Pilih File Auto-Backup (.db)",
      defaultPath: getAutoBackupDir(),
      filters: [{ name: "File Auto-Backup Usahaku", extensions: ["db"] }],
      properties: ["openFile"],
    });

    if (result.canceled || result.filePaths.length === 0) return { success: false, canceled: true };
    return await performRestoreFromFile(result.filePaths[0]);
  });

  ipcMain.handle("backup:saveManual", async (_event, jsonData: string) => {
    if (!mainWindow) return { success: false, message: "Window tidak tersedia" };
    const datePart = new Date().toISOString().slice(0, 10);
    const result = await dialog.showSaveDialog(mainWindow, {
      title: "Simpan Backup Usahaku",
      defaultPath: path.join(getAutoBackupDir(), `usahaku_backup_${datePart}.json`),
      filters: [{ name: "File Backup Usahaku", extensions: ["json"] }],
    });
    if (result.canceled || !result.filePath) return { success: false, message: "Dibatalkan" };
    try {
      fs.writeFileSync(result.filePath, jsonData, "utf8");
      writeLog(`Backup manual tersimpan: ${result.filePath}`);
      return { success: true, filePath: result.filePath };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, message: msg };
    }
  });
}
