import { mainWindow, getDbPath } from "../app-state";
import { GDRIVE_CLIENT_ID, GDRIVE_CLIENT_SECRET } from "../credentials";
import { writeLog } from "../logging";
import { walCheckpoint } from "../local-backup";
import { getValidAccessToken, loadGDriveTokens } from "./gdrive-auth";
import * as fs from "fs";
import * as https from "https";

const GDRIVE_FOLDER_NAME = "Usahaku Backup";
const GDRIVE_MAX_BACKUPS = 7;
let gdriveLastError = "";
let gdriveAutoBackupTimer: ReturnType<typeof setInterval> | null = null;
let consecutiveFailures = 0;
let _readSettings: () => Record<string, unknown> = () => ({});
let _writeSettings: (settings: Record<string, unknown>) => void = () => {};

export interface GDriveFile {
  id: string;
  name: string;
  createdTime: string;
  size: string;
}

export function injectGDriveSettingsHelpers(read: () => Record<string, unknown>, write: (settings: Record<string, unknown>) => void): void {
  _readSettings = read;
  _writeSettings = write;
}

export function getGDriveSettings(): Record<string, unknown> {
  return _readSettings();
}

export function saveGDriveSettings(settings: Record<string, unknown>): void {
  _writeSettings(settings);
}

export function getGDriveLastError(): string {
  return gdriveLastError;
}

export function setGDriveLastError(error: string): void {
  gdriveLastError = error;
}

export function getGDriveAutoBackupTimer(): ReturnType<typeof setInterval> | null {
  return gdriveAutoBackupTimer;
}

export function httpsReq(options: https.RequestOptions, body?: Buffer | string): Promise<{ statusCode: number; body: Buffer }> {
  return new Promise((resolve, reject) => {
    const request = https.request(options, (response) => {
      const chunks: Buffer[] = [];
      response.on("data", (chunk: Buffer) => chunks.push(chunk));
      response.on("end", () => resolve({ statusCode: response.statusCode ?? 0, body: Buffer.concat(chunks) }));
    });
    request.on("error", reject);
    if (body) request.write(body);
    request.end();
  });
}

export async function checkInternet(): Promise<boolean> {
  return new Promise((resolve) => {
    const request = https.request({ hostname: "oauth2.googleapis.com", path: "/", method: "HEAD", timeout: 5000 }, (response) => {
      response.resume();
      resolve(true);
    });
    request.on("error", () => resolve(false));
    request.on("timeout", () => {
      request.destroy();
      resolve(false);
    });
    request.end();
  });
}

export async function getOrCreateDriveFolder(accessToken: string): Promise<string | null> {
  try {
    const query = encodeURIComponent(`name='${GDRIVE_FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`);
    const listResponse = await httpsReq({ hostname: "www.googleapis.com", path: `/drive/v3/files?q=${query}&fields=files(id)`, method: "GET", headers: { Authorization: `Bearer ${accessToken}` } });
    if (listResponse.statusCode === 200) {
      const files = (JSON.parse(listResponse.body.toString("utf8")) as { files: { id: string }[] }).files;
      if (files && files.length > 0) return files[0].id;
    }
    const metadata = JSON.stringify({ name: GDRIVE_FOLDER_NAME, mimeType: "application/vnd.google-apps.folder" });
    const createResponse = await httpsReq({ hostname: "www.googleapis.com", path: "/drive/v3/files", method: "POST", headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json", "Content-Length": Buffer.byteLength(metadata) } }, metadata);
    return createResponse.statusCode === 200 || createResponse.statusCode === 201
      ? (JSON.parse(createResponse.body.toString("utf8")) as { id: string }).id
      : null;
  } catch {
    return null;
  }
}

export async function listDriveBackups(accessToken: string, folderId: string): Promise<GDriveFile[]> {
  try {
    const query = encodeURIComponent(`'${folderId}' in parents and name contains 'usahaku_' and trashed=false`);
    const response = await httpsReq({ hostname: "www.googleapis.com", path: `/drive/v3/files?q=${query}&fields=files(id,name,createdTime,size)&orderBy=createdTime+desc`, method: "GET", headers: { Authorization: `Bearer ${accessToken}` } });
    return response.statusCode === 200 ? (JSON.parse(response.body.toString("utf8")) as { files: GDriveFile[] }).files ?? [] : [];
  } catch {
    return [];
  }
}

export async function uploadBackupToDrive(accessToken: string, dbPath: string): Promise<boolean> {
  try {
    const folderId = await getOrCreateDriveFolder(accessToken);
    if (!folderId) return false;
    await walCheckpoint();
    const now = new Date();
    const fileName = `usahaku_backup_${now.toISOString().slice(0, 10)}_${now.toTimeString().slice(0, 5).replace(":", "")}.db`;
    const boundary = `usahaku_bnd_${Date.now()}`;
    const metadata = JSON.stringify({ name: fileName, parents: [folderId] });
    const bodyStart = Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n--${boundary}\r\nContent-Type: application/octet-stream\r\n\r\n`, "utf8");
    const fullBody = Buffer.concat([bodyStart, fs.readFileSync(dbPath), Buffer.from(`\r\n--${boundary}--`, "utf8")]);
    const response = await httpsReq({ hostname: "www.googleapis.com", path: "/upload/drive/v3/files?uploadType=multipart", method: "POST", headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": `multipart/related; boundary=${boundary}`, "Content-Length": fullBody.length } }, fullBody);
    if (response.statusCode !== 200 && response.statusCode !== 201) {
      writeLog(`[gdrive] Upload gagal (${response.statusCode}): ${response.body.toString("utf8").slice(0, 200)}`);
      return false;
    }
    writeLog(`[gdrive] Upload berhasil: ${fileName}`);
    const settings = _readSettings();
    settings.lastDriveBackupAt = new Date().toISOString();
    _writeSettings(settings);
    const files = await listDriveBackups(accessToken, folderId);
    for (const file of files.slice(GDRIVE_MAX_BACKUPS)) {
      await httpsReq({ hostname: "www.googleapis.com", path: `/drive/v3/files/${file.id}`, method: "DELETE", headers: { Authorization: `Bearer ${accessToken}` } });
      writeLog(`[gdrive] Hapus backup lama: ${file.name}`);
    }
    return true;
  } catch (error) {
    writeLog(`[gdrive] uploadBackupToDrive error: ${error}`);
    return false;
  }
}

export async function tryGDriveAutoBackup(): Promise<void> {
  if (!GDRIVE_CLIENT_ID || !GDRIVE_CLIENT_SECRET || !loadGDriveTokens()) return;
  if (!(await checkInternet())) {
    writeLog("[gdrive] Auto-backup: offline, dilewati");
    recordAutoBackupFailure();
    return;
  }
  const accessToken = await getValidAccessToken();
  if (!accessToken) {
    recordAutoBackupFailure();
    return;
  }
  const success = await uploadBackupToDrive(accessToken, getDbPath());
  if (success) {
    consecutiveFailures = 0;
    setGDriveLastError("");
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send("gdrive:backupDone");
    return;
  }
  recordAutoBackupFailure();
}

function recordAutoBackupFailure(): void {
  consecutiveFailures += 1;
  setGDriveLastError("Auto-backup ke Google Drive gagal.");
  if (consecutiveFailures === 3 && mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("gdrive:backupError", { message: "Auto-backup Google Drive gagal 3x berturut-turut. Periksa koneksi Anda.", consecutiveFailures });
  }
  if (consecutiveFailures >= 5) {
    if (gdriveAutoBackupTimer) clearInterval(gdriveAutoBackupTimer);
    gdriveAutoBackupTimer = null;
    writeLog("[gdrive] Auto-backup dihentikan setelah 5 kegagalan berturut-turut");
  }
}

export function scheduleGDriveAutoBackup(): void {
  setTimeout(() => {
    tryGDriveAutoBackup().catch((error) => writeLog(`[gdrive] auto-backup error: ${error}`));
    gdriveAutoBackupTimer = setInterval(() => {
      tryGDriveAutoBackup().catch((error) => writeLog(`[gdrive] auto-backup error: ${error}`));
    }, 15 * 60 * 1000);
  }, 45_000);
}
