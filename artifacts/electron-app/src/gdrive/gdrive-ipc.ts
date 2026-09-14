import { ipcMain } from "electron";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { getDbPath, mainWindow } from "../app-state";
import { GDRIVE_CLIENT_ID, GDRIVE_CLIENT_SECRET } from "../credentials";
import { writeLog } from "../logging";
import { performRestoreFromFile } from "../local-backup";
import { clearGDriveTokens, getValidAccessToken, loadGDriveTokens, startGDriveOAuthFlow } from "./gdrive-auth";
import { checkInternet, getGDriveLastError, getGDriveSettings, getOrCreateDriveFolder, httpsReq, listDriveBackups, saveGDriveSettings, setGDriveLastError, tryGDriveAutoBackup, uploadBackupToDrive } from "./gdrive-sync";
import type { GDriveFile } from "./gdrive-sync";

interface GDriveStatus {
  configured: boolean;
  connected: boolean;
  email?: string;
  lastBackupAt?: string;
  lastError?: string;
}

export function registerGDriveIpc(): void {
  ipcMain.handle("gdrive:getStatus", (): GDriveStatus => {
    if (!GDRIVE_CLIENT_ID || !GDRIVE_CLIENT_SECRET) return { configured: false, connected: false };
    const tokens = loadGDriveTokens();
    const settings = getGDriveSettings();
    return { configured: true, connected: !!tokens, email: tokens?.email, lastBackupAt: settings.lastDriveBackupAt as string | undefined, lastError: getGDriveLastError() || undefined };
  });
  ipcMain.handle("gdrive:connect", async (): Promise<{ success: boolean; message?: string }> => {
    if (!GDRIVE_CLIENT_ID || !GDRIVE_CLIENT_SECRET) return { success: false, message: "Google Drive belum dikonfigurasi. Hubungi pengembang aplikasi." };
    setGDriveLastError("");
    const result = await startGDriveOAuthFlow();
    if (result.success) setTimeout(() => { tryGDriveAutoBackup().catch((error) => writeLog(`[gdrive] post-connect backup error: ${error}`)); }, 5_000);
    return result;
  });
  ipcMain.handle("gdrive:disconnect", (): void => {
    clearGDriveTokens();
    const settings = getGDriveSettings();
    delete settings.lastDriveBackupAt;
    saveGDriveSettings(settings);
    setGDriveLastError("");
    writeLog("[gdrive] Koneksi diputus");
  });
  ipcMain.handle("gdrive:backupNow", async (): Promise<{ success: boolean; message?: string }> => {
    if (!GDRIVE_CLIENT_ID || !GDRIVE_CLIENT_SECRET) return { success: false, message: "Google Drive belum dikonfigurasi." };
    if (!loadGDriveTokens()) return { success: false, message: "Google Drive belum terhubung." };
    if (!(await checkInternet())) return { success: false, message: "Tidak ada koneksi internet." };
    const accessToken = await getValidAccessToken();
    if (!accessToken) return { success: false, message: "Token tidak valid. Coba hubungkan ulang." };
    if (await uploadBackupToDrive(accessToken, getDbPath())) {
      setGDriveLastError("");
      if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send("gdrive:backupDone");
      return { success: true };
    }
    setGDriveLastError("Backup manual gagal.");
    return { success: false, message: "Backup gagal. Cek koneksi internet Anda." };
  });
  ipcMain.handle("gdrive:listBackups", async (): Promise<GDriveFile[]> => {
    const accessToken = await getValidAccessToken();
    if (!accessToken) return [];
    const folderId = await getOrCreateDriveFolder(accessToken);
    return folderId ? listDriveBackups(accessToken, folderId) : [];
  });
  ipcMain.handle("gdrive:restoreFromDrive", async (_event, fileId: string): Promise<{ success: boolean; message?: string }> => {
    if (typeof fileId !== "string" || !/^[a-zA-Z0-9_-]+$/.test(fileId)) return { success: false, message: "ID file tidak valid." };
    const accessToken = await getValidAccessToken();
    if (!accessToken) return { success: false, message: "Token tidak valid. Coba hubungkan ulang." };
    const tempPath = path.join(os.tmpdir(), `usahaku_gdrive_${Date.now()}.db`);
    try {
      const response = await httpsReq({ hostname: "www.googleapis.com", path: `/drive/v3/files/${fileId}?alt=media`, method: "GET", headers: { Authorization: `Bearer ${accessToken}` } });
      if (response.statusCode !== 200) return { success: false, message: "Gagal mengunduh file dari Google Drive." };
      fs.writeFileSync(tempPath, response.body);
      return await performRestoreFromFile(tempPath);
    } finally {
      try {
        if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
      } catch {}
    }
  });
}
