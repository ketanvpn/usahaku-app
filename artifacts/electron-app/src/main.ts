import { app, BrowserWindow, dialog, shell, Menu, ipcMain, safeStorage } from "electron";
import { utilityProcess } from "electron";
import * as path from "path";
import * as http from "http";
import * as https from "https";
import * as fs from "fs";
import * as os from "os";
import { autoUpdater } from "electron-updater";
// Credentials di-inject saat build oleh scripts/inject-credentials.js → baked-in ke binary
import { GDRIVE_CLIENT_ID, GDRIVE_CLIENT_SECRET } from "./credentials";

const APP_NAME = "Usahaku";
const APP_ID = "com.ketantech.usahaku";
const BACKEND_PORT = 8080;
const FRONTEND_DEV_PORT = process.env.VITE_PORT || "5173";

const isDev = !app.isPackaged || process.env.NODE_ENV === "development";

let backendProcess: Electron.UtilityProcess | null = null;
let mainWindow: BrowserWindow | null = null;
let backendStderrBuffer = "";
let isRestoring = false;
let logFilePath = "";
let isQuitting = false;

app.setName(APP_NAME);
if (process.platform === "win32") {
  app.setAppUserModelId(APP_ID);
}

Menu.setApplicationMenu(null);

const LOADING_HTML = `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${APP_NAME}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      display: flex; align-items: center; justify-content: center;
      height: 100vh;
      background: #0d3526;
      color: white;
      font-family: 'Segoe UI', system-ui, sans-serif;
      user-select: none;
    }
    .container { text-align: center; }
    .icon { font-size: 3rem; margin-bottom: 0.75rem; }
    h1 { font-size: 1.75rem; font-weight: 700; }
    .subtitle { font-size: 0.875rem; opacity: 0.7; margin-top: 0.25rem; }
    .spinner {
      width: 36px; height: 36px;
      border: 3px solid rgba(255,255,255,0.25);
      border-top-color: white;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
      margin: 1.5rem auto 1rem;
    }
    .status { font-size: 0.8rem; opacity: 0.6; }
    @keyframes spin { to { transform: rotate(360deg); } }
  </style>
</head>
<body>
  <div class="container">
    <div class="icon">📒</div>
    <h1>${APP_NAME}</h1>
    <div class="subtitle">by KetanTech</div>
    <div class="spinner"></div>
    <div class="status">Memuat aplikasi, harap tunggu...</div>
  </div>
</body>
</html>`;

function getDbPath(): string {
  return path.join(app.getPath("userData"), "app.db");
}

function initLogFile(): void {
  const userDataDir = app.getPath("userData");
  logFilePath = path.join(userDataDir, "usahaku.log");
  try {
    const timestamp = new Date().toISOString();
    fs.appendFileSync(logFilePath, `\n=== Usahaku started at ${timestamp} ===\n`);
  } catch {
    logFilePath = "";
  }
}

function writeLog(message: string): void {
  const line = `[${new Date().toISOString()}] ${message}`;
  console.log(line);
  if (logFilePath) {
    try {
      fs.appendFileSync(logFilePath, line + "\n");
    } catch {
    }
  }
}

function ensureUserDataDir(): void {
  const userDataDir = app.getPath("userData");
  if (!fs.existsSync(userDataDir)) {
    try {
      fs.mkdirSync(userDataDir, { recursive: true });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      dialog.showErrorBox(
        "Gagal Membuat Folder Data",
        `Tidak dapat membuat folder penyimpanan:\n${userDataDir}\n\nError: ${msg}\n\nPastikan Anda memiliki izin menulis di folder AppData.`
      );
      app.quit();
    }
  }
}

function waitForBackend(port: number, maxWaitMs = 25000): Promise<void> {
  return new Promise((resolve, reject) => {
    const start = Date.now();

    function attempt() {
      const req = http.get(
        `http://127.0.0.1:${port}/api/healthz`,
        (res) => {
          if (res.statusCode === 200) {
            resolve();
          } else {
            scheduleRetry();
          }
          res.resume();
        }
      );
      req.on("error", scheduleRetry);
      req.end();
    }

    function scheduleRetry() {
      if (Date.now() - start >= maxWaitMs) {
        reject(
          new Error(
            `Server tidak merespons setelah ${maxWaitMs / 1000} detik.\n\nPort ${port} mungkin tidak dapat diakses atau server gagal start.\n\nCoba tutup dan buka kembali aplikasi.`
          )
        );
      } else {
        setTimeout(attempt, 600);
      }
    }

    attempt();
  });
}

function getBackendScriptPath(): string {
  if (isDev) {
    return path.resolve(__dirname, "../../api-server/dist/index.mjs");
  }
  return path.join(process.resourcesPath, "backend", "dist", "index.mjs");
}

function getBetterSqlite3Path(): string {
  if (isDev) {
    return path.resolve(__dirname, "../../api-server/node_modules/better-sqlite3");
  }
  return path.join(process.resourcesPath, "backend", "node_modules", "better-sqlite3");
}

function getFrontendDistPath(): string {
  if (isDev) {
    return path.resolve(__dirname, "../../hutang-app/dist/public");
  }
  return path.join(process.resourcesPath, "frontend");
}

function getIconPath(): string | undefined {
  const candidates = [
    path.join(__dirname, "../assets/icon.png"),
    path.join(__dirname, "../assets/icon.ico"),
  ];
  if (!isDev) {
    candidates.unshift(
      path.join(process.resourcesPath, "assets", "icon.png"),
      path.join(process.resourcesPath, "assets", "icon.ico")
    );
  }
  return candidates.find((p) => fs.existsSync(p));
}

function startBackend(): void {
  const scriptPath = getBackendScriptPath();
  const frontendPath = getFrontendDistPath();
  const dbPath = getDbPath();
  const betterSqlite3Path = getBetterSqlite3Path();

  writeLog(`Starting backend: ${scriptPath}`);
  writeLog(`Database path: ${dbPath}`);
  writeLog(`Frontend path: ${frontendPath}`);
  writeLog(`isDev: ${isDev}`);

  writeLog(`[native] better-sqlite3 path: ${betterSqlite3Path}`);
  writeLog(`[native] better-sqlite3 exists: ${fs.existsSync(betterSqlite3Path)}`);

  if (!isDev) {
    const bindingsStubPath = path.join(process.resourcesPath, "backend", "node_modules", "bindings");
    const nodeBinaryPath = path.join(betterSqlite3Path, "build", "Release", "better_sqlite3.node");
    const prebuildPath = path.join(betterSqlite3Path, "prebuilds");
    writeLog(`[native] bindings stub exists: ${fs.existsSync(bindingsStubPath)}`);
    writeLog(`[native] better_sqlite3.node exists: ${fs.existsSync(nodeBinaryPath)}`);
    writeLog(`[native] prebuilds dir exists: ${fs.existsSync(prebuildPath)}`);
    if (fs.existsSync(path.join(betterSqlite3Path, "build", "Release"))) {
      try {
        const releaseFiles = fs.readdirSync(path.join(betterSqlite3Path, "build", "Release"));
        writeLog(`[native] build/Release files: ${releaseFiles.join(", ")}`);
      } catch {
        writeLog(`[native] could not list build/Release dir`);
      }
    }
  }

  if (!fs.existsSync(scriptPath)) {
    const hint = isDev
      ? "Jalankan:\npnpm --filter @workspace/api-server run build"
      : "Instalasi aplikasi tidak lengkap.\nCoba uninstall dan install ulang.";
    dialog.showErrorBox(
      "File Aplikasi Tidak Ditemukan",
      `File server tidak ditemukan:\n${scriptPath}\n\n${hint}`
    );
    app.quit();
    return;
  }

  if (!fs.existsSync(frontendPath) && !isDev) {
    writeLog(`WARNING: Frontend path not found: ${frontendPath}`);
  }

  const sessionSecret =
    process.env.SESSION_SECRET ||
    `usahaku-${Buffer.from(app.getPath("userData")).toString("base64").slice(0, 20)}`;

  backendStderrBuffer = "";

  backendProcess = utilityProcess.fork(scriptPath, [], {
    env: {
      ...process.env,
      DATABASE_PATH: dbPath,
      PORT: String(BACKEND_PORT),
      NODE_ENV: "production",
      SERVE_STATIC: "true",
      STATIC_PATH: frontendPath,
      SESSION_SECRET: sessionSecret,
      BETTER_SQLITE3_PATH: betterSqlite3Path,
    },
    stdio: "pipe",
  });

  backendProcess.stdout?.on("data", (data: Buffer) => {
    const text = data.toString().trim();
    writeLog(`[backend] ${text}`);
  });

  backendProcess.stderr?.on("data", (data: Buffer) => {
    const text = data.toString().trim();
    writeLog(`[backend:err] ${text}`);
    backendStderrBuffer += text + "\n";
    if (backendStderrBuffer.length > 4000) {
      backendStderrBuffer = backendStderrBuffer.slice(-4000);
    }
  });

  backendProcess.on("exit", (code: number) => {
    writeLog(`[backend] Exited with code ${code}`);
    backendProcess = null;

    if (!isQuitting && !isRestoring && mainWindow && !mainWindow.isDestroyed()) {
      const errorDetail = backendStderrBuffer.trim()
        ? `\n\nDetail error:\n${backendStderrBuffer.slice(-1000)}`
        : "";
      const logInfo = logFilePath ? `\n\nLog tersimpan di:\n${logFilePath}` : "";

      dialog
        .showMessageBox(mainWindow, {
          type: "error",
          title: "Layanan Aplikasi Berhenti",
          message: `Server berhenti tidak terduga (kode: ${code}).\n\nAplikasi perlu ditutup dan dibuka kembali.${errorDetail}${logInfo}`,
          buttons: ["Tutup Aplikasi"],
          defaultId: 0,
        })
        .then(() => app.quit());
    }
  });
}

// ── Auto-update setup ────────────────────────────────────────────────────────
let lastUpdateStatus: object | null = null;

function sendUpdateStatus(status: string, payload?: object) {
  const data = { status, ...payload };
  lastUpdateStatus = data;
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("update:status", data);
  }
}

ipcMain.handle("update:getStatus", () => lastUpdateStatus);
ipcMain.handle("update:checkNow", async () => {
  try {
    await autoUpdater.checkForUpdates();
  } catch (e: unknown) {
    writeLog(`[updater] manual check failed: ${e}`);
  }
});
ipcMain.handle("app:getVersion", () => app.getVersion());

function setupAutoUpdater() {
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on("checking-for-update", () => {
    writeLog("[updater] Checking for update...");
  });

  autoUpdater.on("update-available", (info: { version: string }) => {
    writeLog(`[updater] Update available: ${info.version}`);
    sendUpdateStatus("available", { version: info.version });
  });

  autoUpdater.on("update-not-available", () => {
    writeLog("[updater] No update available.");
    sendUpdateStatus("not-available");
  });

  autoUpdater.on("download-progress", (progress: { percent: number }) => {
    const pct = Math.round(progress.percent);
    writeLog(`[updater] Downloading: ${pct}%`);
    sendUpdateStatus("downloading", { percent: pct });
  });

  autoUpdater.on("update-downloaded", (info: { version: string }) => {
    writeLog(`[updater] Update downloaded: ${info.version}`);
    sendUpdateStatus("downloaded", { version: info.version });
  });

  autoUpdater.on("error", (err: Error) => {
    writeLog(`[updater] Error: ${err.message}`);
    sendUpdateStatus("error", { message: err.message });
  });

  // Check for updates 10 seconds after app starts, then every 6 hours
  setTimeout(() => {
    autoUpdater.checkForUpdates().catch((e: unknown) => writeLog(`[updater] check failed: ${e}`));
  }, 10_000);
  setInterval(() => {
    autoUpdater.checkForUpdates().catch((e: unknown) => writeLog(`[updater] check failed: ${e}`));
  }, 6 * 60 * 60 * 1000);
}

ipcMain.handle("update:download", async () => {
  try {
    await autoUpdater.downloadUpdate();
  } catch (e: unknown) {
    writeLog(`[updater] download error: ${e}`);
  }
});

ipcMain.handle("update:install", () => {
  autoUpdater.quitAndInstall(false, true);
});

// ── IPC: write HTML to temp file and open in default browser for print/PDF ──
ipcMain.handle("open-in-browser", async (_event, html: string) => {
  try {
    const tempPath = path.join(os.tmpdir(), "usahaku-laporan.html");
    fs.writeFileSync(tempPath, html, "utf8");
    const err = await shell.openPath(tempPath);
    if (err) writeLog(`open-in-browser shell.openPath error: ${err}`);
    return err;
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    writeLog(`open-in-browser error: ${msg}`);
    return msg;
  }
});

function createLoadingWindow(): void {
  const iconPath = getIconPath();
  const preloadPath = path.join(__dirname, "preload.js");

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 640,
    title: APP_NAME,
    icon: iconPath,
    backgroundColor: "#0d3526",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      preload: preloadPath,
    },
    show: false,
  });

  mainWindow.loadURL(
    `data:text/html;charset=utf-8,${encodeURIComponent(LOADING_HTML)}`
  );

  mainWindow.once("ready-to-show", () => {
    mainWindow!.center();
    mainWindow!.show();
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  mainWindow.on("close", (e) => {
    // Auto-backup sebelum tutup (hanya di production/release)
    if (!isDev) {
      e.preventDefault();
      isQuitting = true;
      // Matikan backend dulu agar SQLite selesai menulis
      if (backendProcess) {
        backendProcess.kill();
        backendProcess = null;
      }
      // Beri waktu 400ms agar SQLite flush WAL ke disk
      setTimeout(() => {
        performAutoBackup();
        mainWindow?.destroy();
      }, 400);
    }
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

async function loadApp(appUrl: string): Promise<void> {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  writeLog(`Loading app URL: ${appUrl}`);

  await mainWindow.loadURL(appUrl).catch((err: Error) => {
    dialog.showErrorBox(
      "Gagal Memuat Antarmuka",
      `Tidak dapat memuat halaman aplikasi.\n\nError: ${err.message}\n\nCoba tutup dan buka kembali.`
    );
    app.quit();
  });

  // Pastikan keyboard focus aktif setelah navigasi selesai
  // Di Windows, Electron kadang tidak otomatis memindahkan focus ke webContents
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.focus();
    mainWindow.webContents.focus();
  }
}

app.whenReady().then(async () => {
  ensureUserDataDir();
  initLogFile();
  writeLog(`App starting, isDev=${isDev}, platform=${process.platform}`);
  writeLog(`userData: ${app.getPath("userData")}`);
  if (!isDev) {
    writeLog(`resourcesPath: ${process.resourcesPath}`);
  }

  try {
    if (isDev) {
      const backendAlreadyRunning = await waitForBackend(BACKEND_PORT, 3000)
        .then(() => true)
        .catch(() => false);

      createLoadingWindow();

      if (!backendAlreadyRunning) {
        startBackend();
        writeLog("Waiting for backend to start...");
        await waitForBackend(BACKEND_PORT, 20000);
      } else {
        writeLog("Backend already running on port " + BACKEND_PORT);
      }

      const devUrl = `http://localhost:${FRONTEND_DEV_PORT}`;
      writeLog("Dev mode: loading " + devUrl);
      await loadApp(devUrl);
      scheduleGDriveAutoBackup();
    } else {
      createLoadingWindow();
      startBackend();
      writeLog("Production mode: waiting for backend...");
      await waitForBackend(BACKEND_PORT, 30000);
      await loadApp(`http://localhost:${BACKEND_PORT}`);
      setupAutoUpdater();
      scheduleGDriveAutoBackup();
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    writeLog("FATAL: " + message);

    const stderrDetail = backendStderrBuffer.trim()
      ? `\n\nOutput error backend:\n${backendStderrBuffer.slice(-800)}`
      : "";
    const logInfo = logFilePath ? `\n\nLog: ${logFilePath}` : "";

    dialog.showErrorBox(
      "Gagal Memulai Usahaku",
      `${message}${stderrDetail}${logInfo}`
    );
    app.quit();
  }
});

// ── Settings file ─────────────────────────────────────────────────────────────
function getSettingsPath(): string {
  return path.join(app.getPath("userData"), "settings.json");
}

function readSettings(): Record<string, unknown> {
  try {
    const data = fs.readFileSync(getSettingsPath(), "utf8");
    return JSON.parse(data);
  } catch {
    return {};
  }
}

function writeSettings(settings: Record<string, unknown>): void {
  try {
    fs.writeFileSync(getSettingsPath(), JSON.stringify(settings, null, 2), "utf8");
  } catch (err: unknown) {
    writeLog(`Gagal menyimpan settings: ${err}`);
  }
}

// ── Auto-backup on close ─────────────────────────────────────────────────────
function getAutoBackupDir(): string {
  const settings = readSettings();
  if (typeof settings.backupFolder === "string" && settings.backupFolder.trim()) {
    return settings.backupFolder;
  }
  return path.join(app.getPath("documents"), "UsahakuBackup");
}

ipcMain.handle("backup:getFolder", () => getAutoBackupDir());

ipcMain.handle("backup:chooseFolder", async () => {
  if (!mainWindow) return null;
  const result = await dialog.showOpenDialog(mainWindow, {
    title: "Pilih Folder Backup Usahaku",
    properties: ["openDirectory", "createDirectory"],
    defaultPath: getAutoBackupDir(),
  });
  if (result.canceled || result.filePaths.length === 0) return null;
  const chosen = result.filePaths[0];
  const settings = readSettings();
  settings.backupFolder = chosen;
  writeSettings(settings);
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

function performAutoBackup(): void {
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
    writeLog(`Auto-backup tersimpan: ${backupFile}`);

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

// ── Google Drive Backup ────────────────────────────────────────────────────────
const GDRIVE_FOLDER_NAME = "Usahaku Backup";
const GDRIVE_MAX_BACKUPS = 7;

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

let gdriveLastError = "";
let gdriveAutoBackupTimer: ReturnType<typeof setInterval> | null = null;

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
      // Jika Google menolak (token dicabut/revoked), hapus token lokal agar user diminta reconnect
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

async function uploadBackupToDrive(accessToken: string, dbPath: string): Promise<boolean> {
  try {
    const folderId = await getOrCreateDriveFolder(accessToken);
    if (!folderId) return false;

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
      const settings = readSettings();
      settings.lastDriveBackupAt = new Date().toISOString();
      writeSettings(settings);

      // Hapus backup lama jika lebih dari GDRIVE_MAX_BACKUPS
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
    // Kirim notif ke renderer
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("gdrive:backupDone");
    }
  } else {
    gdriveLastError = "Auto-backup ke Google Drive gagal.";
  }
}

function scheduleGDriveAutoBackup(): void {
  // Pertama: 45 detik setelah app siap
  setTimeout(() => {
    tryGDriveAutoBackup().catch((e) => writeLog(`[gdrive] auto-backup error: ${e}`));
    // Kemudian setiap 15 menit
    gdriveAutoBackupTimer = setInterval(() => {
      tryGDriveAutoBackup().catch((e) => writeLog(`[gdrive] auto-backup error: ${e}`));
    }, 15 * 60 * 1000);
  }, 45_000);
}

// OAuth2 flow — buka browser, tangkap code lewat server lokal
async function startGDriveOAuthFlow(): Promise<{ success: boolean; message?: string }> {
  return new Promise((resolve) => {
    const server = http.createServer();
    let settled = false; // pastikan resolve hanya dipanggil sekali

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

        // Abaikan request selain root (misal: /favicon.ico dari browser)
        if (url.pathname !== "/" && url.pathname !== "") {
          res.writeHead(204).end();
          return;
        }

        // Abaikan kalau sudah selesai (request duplikat)
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
          // Tukar code dengan tokens
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

          // Ambil email pengguna
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

// Fungsi restore DB yang dapat dipakai bersama (lokal maupun Drive)
async function performRestoreFromFile(sourcePath: string): Promise<{ success: boolean; canceled?: boolean; message?: string }> {
  const dbPath = getDbPath();
  const rollbackPath = dbPath + ".rollback";

  try {
    fs.copyFileSync(dbPath, rollbackPath);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, message: `Gagal membuat salinan pengaman: ${msg}` };
  }

  isRestoring = true;
  backendStderrBuffer = "";
  if (backendProcess) {
    backendProcess.kill();
    backendProcess = null;
  }
  await new Promise<void>((r) => setTimeout(r, 600));

  try {
    fs.copyFileSync(sourcePath, dbPath);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    try { fs.copyFileSync(rollbackPath, dbPath); } catch {}
    try { fs.unlinkSync(rollbackPath); } catch {}
    startBackend();
    isRestoring = false;
    return { success: false, message: `Gagal menyalin file: ${msg}` };
  }

  try {
    startBackend();
    await waitForBackend(BACKEND_PORT, 20000);
    try { fs.unlinkSync(rollbackPath); } catch {}
    isRestoring = false;
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.reload();
    return { success: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    writeLog(`[restore] Backend gagal, rollback: ${msg}`);
    const stuck = backendProcess as Electron.UtilityProcess | null;
    stuck?.kill();
    backendProcess = null;
    await new Promise<void>((r) => setTimeout(r, 400));
    try {
      fs.copyFileSync(rollbackPath, dbPath);
      fs.unlinkSync(rollbackPath);
    } catch {}
    startBackend();
    isRestoring = false;
    return { success: false, message: "File backup tidak valid atau tidak kompatibel. Data Anda sudah dikembalikan." };
  }
}

// ── Google Drive IPC Handlers ─────────────────────────────────────────────────

ipcMain.handle("gdrive:getStatus", (): GDriveStatus => {
  if (!GDRIVE_CLIENT_ID || !GDRIVE_CLIENT_SECRET) {
    return { configured: false, connected: false };
  }
  const tokens = loadGDriveTokens();
  const settings = readSettings();
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
  // Langsung backup 5 detik setelah connect berhasil — tidak perlu tunggu 60 menit
  if (result.success) {
    setTimeout(() => {
      tryGDriveAutoBackup().catch((e) => writeLog(`[gdrive] post-connect backup error: ${e}`));
    }, 5_000);
  }
  return result;
});

ipcMain.handle("gdrive:disconnect", (): void => {
  clearGDriveTokens();
  const s = readSettings();
  delete s.lastDriveBackupAt;
  writeSettings(s);
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

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("will-quit", () => {
  isQuitting = true;
  if (gdriveAutoBackupTimer) clearInterval(gdriveAutoBackupTimer);
  writeLog("App quitting, killing backend...");
  if (backendProcess) {
    backendProcess.kill();
    backendProcess = null;
  }
});
