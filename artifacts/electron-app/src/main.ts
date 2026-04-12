import { app, BrowserWindow, dialog, shell, Menu, ipcMain } from "electron";
import { utilityProcess } from "electron";
import * as path from "path";
import * as http from "http";
import * as fs from "fs";
import * as os from "os";
import { autoUpdater } from "electron-updater";

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
    } else {
      createLoadingWindow();
      startBackend();
      writeLog("Production mode: waiting for backend...");
      await waitForBackend(BACKEND_PORT, 30000);
      await loadApp(`http://localhost:${BACKEND_PORT}`);
      setupAutoUpdater();
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

  const sourcePath = result.filePaths[0];
  const dbPath = getDbPath();
  const rollbackPath = dbPath + ".rollback";

  // ── LANGKAH 1: Buat salinan rollback dari DB aktif ──────────────────────
  try {
    fs.copyFileSync(dbPath, rollbackPath);
    writeLog(`Rollback tersimpan: ${rollbackPath}`);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    writeLog(`Gagal membuat rollback: ${message}`);
    return { success: false, message: `Gagal membuat salinan pengaman: ${message}` };
  }

  // ── LANGKAH 2: Hentikan backend ─────────────────────────────────────────
  isRestoring = true;
  backendStderrBuffer = "";
  if (backendProcess) {
    backendProcess.kill();
    backendProcess = null;
  }
  await new Promise(r => setTimeout(r, 600));

  // ── LANGKAH 3: Salin file backup pilihan user ke DB aktif ────────────────
  try {
    fs.copyFileSync(sourcePath, dbPath);
    writeLog(`DB di-restore dari: ${sourcePath}`);
  } catch (err: unknown) {
    // Salin gagal → rollback langsung, tidak perlu cek backend
    const message = err instanceof Error ? err.message : String(err);
    writeLog(`Salin file gagal, rollback...: ${message}`);
    try { fs.copyFileSync(rollbackPath, dbPath); } catch { /* abaikan */ }
    try { fs.unlinkSync(rollbackPath); } catch { /* abaikan */ }
    startBackend();
    isRestoring = false;
    return { success: false, message: `Gagal menyalin file: ${message}` };
  }

  // ── LANGKAH 4: Nyalakan backend, cek apakah berhasil jalan ──────────────
  try {
    startBackend();
    await waitForBackend(BACKEND_PORT, 20000);

    // Berhasil → hapus file rollback, reload renderer
    try { fs.unlinkSync(rollbackPath); } catch { /* tidak kritis */ }
    writeLog("Restore berhasil. Rollback dihapus.");
    isRestoring = false;

    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.reload();
    }

    return { success: true };

  } catch (err: unknown) {
    // Backend gagal start → kembalikan DB semula (auto-rollback)
    const message = err instanceof Error ? err.message : String(err);
    writeLog(`Backend gagal setelah restore, menjalankan auto-rollback: ${message}`);

    const stuckProcess = backendProcess as Electron.UtilityProcess | null;
    stuckProcess?.kill();
    backendProcess = null;
    await new Promise(r => setTimeout(r, 400));

    try {
      fs.copyFileSync(rollbackPath, dbPath);
      fs.unlinkSync(rollbackPath);
      writeLog("Auto-rollback berhasil. DB dikembalikan ke semula.");
    } catch (rbErr: unknown) {
      const rbMsg = rbErr instanceof Error ? rbErr.message : String(rbErr);
      writeLog(`Auto-rollback GAGAL: ${rbMsg}`);
    }

    startBackend();
    isRestoring = false;
    return {
      success: false,
      message: `File backup tidak valid atau tidak kompatibel dengan versi ini. Data Anda sudah dikembalikan seperti semula.`,
    };
  }
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

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("will-quit", () => {
  isQuitting = true;
  writeLog("App quitting, killing backend...");
  if (backendProcess) {
    backendProcess.kill();
    backendProcess = null;
  }
});
