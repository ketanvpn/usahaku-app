/**
 * Google Drive backup — OAuth2 flow, token management, upload/download,
 * auto-backup scheduling, and all gdrive:* IPC handlers.
 */
import { app, ipcMain, safeStorage, shell } from "electron";
import * as fs from "fs";
import * as http from "http";
import * as https from "https";
import * as os from "os";
import * as path from "path";
import { GDRIVE_CLIENT_ID, GDRIVE_CLIENT_SECRET } from "./credentials";
import { mainWindow, getDbPath } from "./app-state";
import { writeLog } from "./logging";
import { walCheckpoint, performRestoreFromFile } from "./local-backup";

// ── Constants ─────────────────────────────────────────────────────────────────
const GDRIVE_FOLDER_NAME = "Usahaku Backup";
const GDRIVE_MAX_BACKUPS = 7;

// ── Types ─────────────────────────────────────────────────────────────────────
interface GDriveTokens {
  access_token: string;
  refresh_token: string;
  expiry_date: number;
  email: string;
}

interface GDriveFile {
  id: string;
  name: string;
  createdTime: string;
  size: string;
}

interface GDriveStatus {
  configured: boolean;
  connected: boolean;
  email?: string;
  lastBackupAt?: string;
  lastError?: string;
}

// ── Module state ──────────────────────────────────────────────────────────────
let gdriveLastError = "";
let gdriveAutoBackupTimer: ReturnType<typeof setInterval> | null = null;

// Settings helpers injected at init time to avoid circular deps.
let _readSettings: () => Record<string, unknown> = () => ({});
let _writeSettings: (_s: Record<string, unknown>) => void = () => {};

export function injectGDriveSettingsHelpers(
  read: () => Record<string, unknown>,
  write: (s: Record<string, unknown>) => void,
): void {
  _readSettings = read;
  _writeSettings = write;
}

export function getGDriveAutoBackupTimer(): ReturnType<typeof setInterval> | null {
  return gdriveAutoBackupTimer;
}

// ── Token persistence (encrypted via safeStorage) ─────────────────────────────

function getGDriveTokenPath(): string {
  return path.join(app.getPath("userData"), "gdrive-tokens.dat");
}

function loadGDriveTokens(): GDriveTokens | null {
  try {
    const p = getGDriveTokenPath();
    if (!fs.existsSync(p)) return null;
    const raw = fs.readFileSync(p);
    let jsonStr: string;
    if (safeStorage.isEncryptionAvailable()) {
      jsonStr = safeStorage.decryptString(raw);
    } else {
      jsonStr = raw.toString("utf8");
    }
    return JSON.parse(jsonStr) as GDriveTokens;
  } catch {
    return null;
  }
}

function saveGDriveTokens(tokens: GDriveTokens): void {
  try {
    const jsonStr = JSON.stringify(tokens);
    const data = safeStorage.isEncryptionAvailable()
      ? safeStorage.encryptString(jsonStr)
      : Buffer.from(jsonStr, "utf8");
    fs.writeFileSync(getGDriveTokenPath(), data);
  } catch (e) {
    writeLog(`[gdrive] Gagal simpan tokens: ${e}`);
  }
}

function clearGDriveTokens(): void {
  try {
    const p = getGDriveTokenPath();
    if (fs.existsSync(p)) fs.unlinkSync(p);
  } catch {}
}

// ── HTTPS helper ──────────────────────────────────────────────────────────────

function httpsReq(
  options: https.RequestOptions,
  body?: Buffer | string
): Promise<{ statusCode: number; body: Buffer }> {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      const chunks: Buffer[] = [];
      res.on("data", (c: Buffer) => chunks.push(c));
      res.on("end", () => resolve({ statusCode: res.statusCode ?? 0, body: Buffer.concat(chunks) }));
    });
    req.on("error", reject);
    if (body) req.write(body);
    req.end();
  });
}

// ── Token refresh ─────────────────────────────────────────────────────────────

async function refreshAccessToken(refreshToken: string): Promise<string | null> {
  try {
    const body = new URLSearchParams({
      client_id: GDRIVE_CLIENT_ID,
      client_secret: GDRIVE_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }).toString();
    const res = await httpsReq({
      hostname: "oauth2.googleapis.com",
      path: "/token",
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", "Content-Length": Buffer.byteLength(body) },
    }, body);
    if (res.statusCode !== 200) {
      const errBody = JSON.parse(res.body.toString("utf8")) as { error?: string };
      if (res.statusCode === 400 && errBody.error === "invalid_grant") {
        writeLog("[gdrive] Refresh token dicabut. Menghapus token lokal.");
        clearGDriveTokens();
        gdriveLastError = "Akses Google Drive dicabut. Hubungkan ulang.";
      }
      return null;
    }
    return (JSON.parse(res.body.toString("utf8")) as { access_token: string }).access_token;
  } catch {
    return null;
  }
}

async function getValidAccessToken(): Promise<string | null> {
  const tokens = loadGDriveTokens();
  if (!tokens) return null;
  if (Date.now() < tokens.expiry_date - 60_000) return tokens.access_token;
  const newToken = await refreshAccessToken(tokens.refresh_token);
  if (!newToken) {
    gdriveLastError = "Token kadaluarsa, silakan hubungkan ulang Google Drive";
    return null;
  }
  tokens.access_token = newToken;
  tokens.expiry_date = Date.now() + 3600 * 1000;
  saveGDriveTokens(tokens);
  return newToken;
}

// ── Network check ─────────────────────────────────────────────────────────────

async function checkInternet(): Promise<boolean> {
  return new Promise((resolve) => {
    const req = https.request({ hostname: "oauth2.googleapis.com", path: "/", method: "HEAD", timeout: 5000 }, (res) => {
      res.resume();
      resolve(true);
    });
    req.on("error", () => resolve(false));
    req.on("timeout", () => { req.destroy(); resolve(false); });
    req.end();
  });
}

// ── Drive folder operations ───────────────────────────────────────────────────

async function getOrCreateDriveFolder(accessToken: string): Promise<string | null> {
  try {
    const q = encodeURIComponent(`name='${GDRIVE_FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`);
    const listRes = await httpsReq({
      hostname: "www.googleapis.com",
      path: `/drive/v3/files?q=${q}&fields=files(id)`,
      method: "GET",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (listRes.statusCode === 200) {
      const json = JSON.parse(listRes.body.toString("utf8")) as { files: { id: string }[] };
      if (json.files && json.files.length > 0) return json.files[0].id;
    }
    const meta = JSON.stringify({ name: GDRIVE_FOLDER_NAME, mimeType: "application/vnd.google-apps.folder" });
    const createRes = await httpsReq({
      hostname: "www.googleapis.com",
      path: "/drive/v3/files",
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json", "Content-Length": Buffer.byteLength(meta) },
    }, meta);
    if (createRes.statusCode === 200 || createRes.statusCode === 201) {
      return (JSON.parse(createRes.body.toString("utf8")) as { id: string }).id;
    }
    return null;
  } catch {
    return null;
  }
}

async function listDriveBackups(accessToken: string, folderId: string): Promise<GDriveFile[]> {
  try {
    const q = encodeURIComponent(`'${folderId}' in parents and name contains 'usahaku_' and trashed=false`);
    const res = await httpsReq({
      hostname: "www.googleapis.com",
      path: `/drive/v3/files?q=${q}&fields=files(id,name,createdTime,size)&orderBy=createdTime+desc`,
      method: "GET",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (res.statusCode === 200) {
      return (JSON.parse(res.body.toString("utf8")) as { files: GDriveFile[] }).files ?? [];
    }
    return [];
  } catch {
    return [];
  }
}

// ── Upload ────────────────────────────────────────────────────────────────────

async function uploadBackupToDrive(accessToken: string, dbPath: string): Promise<boolean> {
  try {
    const folderId = await getOrCreateDriveFolder(accessToken);
    if (!folderId) return false;

    await walCheckpoint();

    const now = new Date();
    const datePart = now.toISOString().slice(0, 10);
    const timePart = now.toTimeString().slice(0, 5).replace(":", "");
    const fileName = `usahaku_backup_${datePart}_${timePart}.db`;

    const fileContent = fs.readFileSync(dbPath);
    const boundary = `usahaku_bnd_${Date.now()}`;
    const metaJson = JSON.stringify({ name: fileName, parents: [folderId] });

    const bodyStart = Buffer.from(
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metaJson}\r\n` +
      `--${boundary}\r\nContent-Type: application/octet-stream\r\n\r\n`,
      "utf8"
    );
    const bodyEnd = Buffer.from(`\r\n--${boundary}--`, "utf8");
    const fullBody = Buffer.concat([bodyStart, fileContent, bodyEnd]);

    const res = await httpsReq({
      hostname: "www.googleapis.com",
      path: "/upload/drive/v3/files?uploadType=multipart",
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": `multipart/related; boundary=${boundary}`,
        "Content-Length": fullBody.length,
      },
    }, fullBody);

    if (res.statusCode === 200 || res.statusCode === 201) {
      writeLog(`[gdrive] Upload berhasil: ${fileName}`);
      const settings = _readSettings();
      settings.lastDriveBackupAt = new Date().toISOString();
      _writeSettings(settings);

      const files = await listDriveBackups(accessToken, folderId);
      if (files.length > GDRIVE_MAX_BACKUPS) {
        for (const f of files.slice(GDRIVE_MAX_BACKUPS)) {
          await httpsReq({
            hostname: "www.googleapis.com",
            path: `/drive/v3/files/${f.id}`,
            method: "DELETE",
            headers: { Authorization: `Bearer ${accessToken}` },
          });
          writeLog(`[gdrive] Hapus backup lama: ${f.name}`);
        }
      }
      return true;
    }
    writeLog(`[gdrive] Upload gagal (${res.statusCode}): ${res.body.toString("utf8").slice(0, 200)}`);
    return false;
  } catch (e) {
    writeLog(`[gdrive] uploadBackupToDrive error: ${e}`);
    return false;
  }
}

// ── Auto-backup scheduling ────────────────────────────────────────────────────

async function tryGDriveAutoBackup(): Promise<void> {
  if (!GDRIVE_CLIENT_ID || !GDRIVE_CLIENT_SECRET) return;
  const tokens = loadGDriveTokens();
  if (!tokens) return;

  const isOnline = await checkInternet();
  if (!isOnline) {
    writeLog("[gdrive] Auto-backup: offline, dilewati");
    return;
  }

  const dbPath = getDbPath();
  const accessToken = await getValidAccessToken();
  if (!accessToken) return;

  const success = await uploadBackupToDrive(accessToken, dbPath);
  if (success) {
    gdriveLastError = "";
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("gdrive:backupDone");
    }
  } else {
    gdriveLastError = "Auto-backup ke Google Drive gagal.";
  }
}

export function scheduleGDriveAutoBackup(): void {
  setTimeout(() => {
    tryGDriveAutoBackup().catch((e) => writeLog(`[gdrive] auto-backup error: ${e}`));
    gdriveAutoBackupTimer = setInterval(() => {
      tryGDriveAutoBackup().catch((e) => writeLog(`[gdrive] auto-backup error: ${e}`));
    }, 15 * 60 * 1000);
  }, 45_000);
}

// ── OAuth2 flow ───────────────────────────────────────────────────────────────

async function startGDriveOAuthFlow(): Promise<{ success: boolean; message?: string }> {
  return new Promise((resolve) => {
    const server = http.createServer();
    let settled = false;

    server.listen(0, "127.0.0.1", () => {
      const port = (server.address() as { port: number }).port;
      const redirectUri = `http://127.0.0.1:${port}`;

      const authUrl =
        "https://accounts.google.com/o/oauth2/v2/auth?" +
        new URLSearchParams({
          client_id: GDRIVE_CLIENT_ID,
          redirect_uri: redirectUri,
          response_type: "code",
          scope: "https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.email",
          access_type: "offline",
          prompt: "consent",
        }).toString();

      shell.openExternal(authUrl);
      writeLog(`[gdrive] OAuth flow dimulai, port=${port}`);

      const timeout = setTimeout(() => {
        if (settled) return;
        settled = true;
        server.close();
        resolve({ success: false, message: "Waktu habis (5 menit). Silakan coba lagi." });
      }, 5 * 60 * 1000);

      server.on("request", async (req, res) => {
        const url = new URL(req.url ?? "/", `http://127.0.0.1:${port}`);

        if (url.pathname !== "/" && url.pathname !== "") {
          res.writeHead(204).end();
          return;
        }

        if (settled) { res.writeHead(204).end(); return; }

        const code = url.searchParams.get("code");
        const error = url.searchParams.get("error");

        const html = code
          ? `<!DOCTYPE html><html lang="id"><body style="font-family:sans-serif;text-align:center;padding:3rem;background:#f0fdf4">
              <h2 style="color:#166534">✅ Berhasil!</h2>
              <p>Google Drive berhasil dihubungkan ke <strong>Usahaku</strong>.</p>
              <p style="color:#6b7280">Anda bisa menutup tab ini dan kembali ke aplikasi.</p>
             </body></html>`
          : `<!DOCTYPE html><html lang="id"><body style="font-family:sans-serif;text-align:center;padding:3rem;background:#fff7f7">
              <h2 style="color:#991b1b">❌ Dibatalkan</h2>
              <p>Proses dihentikan. Silakan tutup tab ini.</p>
             </body></html>`;

        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        res.end(html);

        clearTimeout(timeout);
        settled = true;
        server.close();

        if (!code) {
          resolve({ success: false, message: error === "access_denied" ? "Izin ditolak." : "Dibatalkan." });
          return;
        }

        try {
          const tokenBody = new URLSearchParams({
            client_id: GDRIVE_CLIENT_ID,
            client_secret: GDRIVE_CLIENT_SECRET,
            code,
            redirect_uri: redirectUri,
            grant_type: "authorization_code",
          }).toString();

          const tokenRes = await httpsReq({
            hostname: "oauth2.googleapis.com",
            path: "/token",
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded", "Content-Length": Buffer.byteLength(tokenBody) },
          }, tokenBody);

          if (tokenRes.statusCode !== 200) {
            writeLog(`[gdrive] Token exchange gagal: ${tokenRes.body.toString("utf8")}`);
            resolve({ success: false, message: "Gagal mendapatkan token dari Google." });
            return;
          }

          const tokenJson = JSON.parse(tokenRes.body.toString("utf8")) as {
            access_token: string; refresh_token: string; expires_in: number;
          };

          let email = "Akun Google";
          const userRes = await httpsReq({
            hostname: "www.googleapis.com",
            path: "/oauth2/v3/userinfo",
            method: "GET",
            headers: { Authorization: `Bearer ${tokenJson.access_token}` },
          });
          if (userRes.statusCode === 200) {
            const userJson = JSON.parse(userRes.body.toString("utf8")) as { email?: string };
            email = userJson.email ?? email;
          }

          const tokens: GDriveTokens = {
            access_token: tokenJson.access_token,
            refresh_token: tokenJson.refresh_token,
            expiry_date: Date.now() + (tokenJson.expires_in || 3600) * 1000,
            email,
          };
          saveGDriveTokens(tokens);
          writeLog(`[gdrive] Terhubung sebagai: ${email}`);
          resolve({ success: true });
        } catch (e) {
          writeLog(`[gdrive] OAuth error: ${e}`);
          resolve({ success: false, message: `Terjadi kesalahan: ${e}` });
        }
      });
    });

    server.on("error", (e) => {
      resolve({ success: false, message: `Gagal membuka server lokal: ${e}` });
    });
  });
}

// ── IPC handlers ──────────────────────────────────────────────────────────────

export function registerGDriveIpc(): void {
  ipcMain.handle("gdrive:getStatus", (): GDriveStatus => {
    if (!GDRIVE_CLIENT_ID || !GDRIVE_CLIENT_SECRET) {
      return { configured: false, connected: false };
    }
    const tokens = loadGDriveTokens();
    const settings = _readSettings();
    return {
      configured: true,
      connected: !!tokens,
      email: tokens?.email,
      lastBackupAt: settings.lastDriveBackupAt as string | undefined,
      lastError: gdriveLastError || undefined,
    };
  });

  ipcMain.handle("gdrive:connect", async (): Promise<{ success: boolean; message?: string }> => {
    if (!GDRIVE_CLIENT_ID || !GDRIVE_CLIENT_SECRET) {
      return { success: false, message: "Google Drive belum dikonfigurasi. Hubungi pengembang aplikasi." };
    }
    gdriveLastError = "";
    const result = await startGDriveOAuthFlow();
    if (result.success) {
      setTimeout(() => {
        tryGDriveAutoBackup().catch((e) => writeLog(`[gdrive] post-connect backup error: ${e}`));
      }, 5_000);
    }
    return result;
  });

  ipcMain.handle("gdrive:disconnect", (): void => {
    clearGDriveTokens();
    const s = _readSettings();
    delete s.lastDriveBackupAt;
    _writeSettings(s);
    gdriveLastError = "";
    writeLog("[gdrive] Koneksi diputus");
  });

  ipcMain.handle("gdrive:backupNow", async (): Promise<{ success: boolean; message?: string }> => {
    if (!GDRIVE_CLIENT_ID || !GDRIVE_CLIENT_SECRET) {
      return { success: false, message: "Google Drive belum dikonfigurasi." };
    }
    if (!loadGDriveTokens()) return { success: false, message: "Google Drive belum terhubung." };

    const isOnline = await checkInternet();
    if (!isOnline) return { success: false, message: "Tidak ada koneksi internet." };

    const accessToken = await getValidAccessToken();
    if (!accessToken) return { success: false, message: "Token tidak valid. Coba hubungkan ulang." };

    const success = await uploadBackupToDrive(accessToken, getDbPath());
    if (success) {
      gdriveLastError = "";
      if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send("gdrive:backupDone");
      return { success: true };
    }
    gdriveLastError = "Backup manual gagal.";
    return { success: false, message: "Backup gagal. Cek koneksi internet Anda." };
  });

  ipcMain.handle("gdrive:listBackups", async (): Promise<GDriveFile[]> => {
    const accessToken = await getValidAccessToken();
    if (!accessToken) return [];
    const folderId = await getOrCreateDriveFolder(accessToken);
    if (!folderId) return [];
    return await listDriveBackups(accessToken, folderId);
  });

  ipcMain.handle("gdrive:restoreFromDrive", async (_event, fileId: string): Promise<{ success: boolean; message?: string }> => {
    const accessToken = await getValidAccessToken();
    if (!accessToken) return { success: false, message: "Token tidak valid. Coba hubungkan ulang." };

    const tempPath = path.join(os.tmpdir(), `usahaku_gdrive_${Date.now()}.db`);
    try {
      const res = await httpsReq({
        hostname: "www.googleapis.com",
        path: `/drive/v3/files/${fileId}?alt=media`,
        method: "GET",
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (res.statusCode !== 200) {
        return { success: false, message: "Gagal mengunduh file dari Google Drive." };
      }
      fs.writeFileSync(tempPath, res.body);
      return await performRestoreFromFile(tempPath);
    } finally {
      try { if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath); } catch {}
    }
  });
}
