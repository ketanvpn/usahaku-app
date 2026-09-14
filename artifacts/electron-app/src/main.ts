/**
 * Usahaku — Electron main process (slim orchestrator).
 *
 * This file wires together the extracted modules and owns:
 * - App lifecycle (ready, window-all-closed, will-quit)
 * - Window creation and navigation
 * - Application menu
 * - Settings file I/O
 * - Print-to-browser IPC
 *
 * All heavy functionality lives in dedicated modules:
 *   app-state.ts, logging.ts, secrets.ts, html-templates.ts,
 *   backend.ts, auto-updater.ts, local-backup.ts, google-drive.ts, logo.ts
 */
import { app, BrowserWindow, dialog, shell, Menu, ipcMain } from "electron";
import * as path from "path";
import * as fs from "fs";
import * as os from "os";
import * as crypto from "crypto";
import { autoUpdater } from "electron-updater";

// ── Module imports ────────────────────────────────────────────────────────────
import {
  APP_NAME,
  APP_ID,
  BACKEND_PORT,
  FRONTEND_DEV_PORT,
  isDev,
  backendProcess,
  mainWindow as mw,
  backendStderrBuffer,
  setMainWindow,
  setIsQuitting,
  setBackendProcess,
} from "./app-state";
import { initLogFile, writeLog, getLogFilePath } from "./logging";
import { RECOVERY_HTML, LOADING_HTML } from "./html-templates";
import { startBackend, waitForBackend, getIconPath } from "./backend";
import { setupAutoUpdater, registerAutoUpdaterIpc } from "./auto-updater";
import {
  performAutoBackup,
  walCheckpoint,
  registerLocalBackupIpc,
  injectSettingsHelpers,
} from "./local-backup";
import {
  scheduleGDriveAutoBackup,
  getGDriveAutoBackupTimer,
  registerGDriveIpc,
  injectGDriveSettingsHelpers,
} from "./google-drive";
import { registerLogoIpc } from "./logo";

// ── App identity ──────────────────────────────────────────────────────────────
app.setName(APP_NAME);
if (process.platform === "win32") {
  app.setAppUserModelId(APP_ID);
}

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

// Wire settings into modules that need them (avoids circular deps).
injectSettingsHelpers(readSettings, writeSettings);
injectGDriveSettingsHelpers(readSettings, writeSettings);

// ── Application Menu ──────────────────────────────────────────────────────────
// v1.1.4: Permanent menu as a safety net. If renderer crashes blank-white,
// user can still check/install updates and open the data folder.
function buildAppMenu(): Menu {
  return Menu.buildFromTemplate([
    {
      label: "Aplikasi",
      submenu: [
        {
          label: "Cek Update",
          click: () => {
            autoUpdater.checkForUpdates().catch((e: unknown) =>
              writeLog(`[menu] check update error: ${e}`),
            );
          },
        },
        {
          label: "Download Update Sekarang",
          click: () => {
            autoUpdater.downloadUpdate().catch((e: unknown) =>
              writeLog(`[menu] download update error: ${e}`),
            );
          },
        },
        {
          label: "Pasang Update && Restart",
          click: () => {
            try {
              autoUpdater.quitAndInstall(false, true);
            } catch (e: unknown) {
              writeLog(`[menu] install update error: ${e}`);
            }
          },
        },
        { type: "separator" },
        {
          label: "Buka Folder Data Aplikasi",
          click: () => {
            shell.openPath(app.getPath("userData")).catch((e: unknown) =>
              writeLog(`[menu] openPath error: ${e}`),
            );
          },
        },
        {
          label: "Buka Halaman Rilis di Browser",
          click: () => {
            shell
              .openExternal(
                "https://github.com/ketanvpn/usahaku-app/releases/latest",
              )
              .catch((e: unknown) =>
                writeLog(`[menu] openExternal error: ${e}`),
              );
          },
        },
        { type: "separator" },
        {
          label: "Tutup Aplikasi",
          accelerator: process.platform === "darwin" ? "Cmd+Q" : "Alt+F4",
          click: () => app.quit(),
        },
      ],
    },
    {
      label: "Bantuan",
      submenu: [
        {
          label: `Versi: ${app.getVersion()}`,
          enabled: false,
        },
        { type: "separator" },
        {
          label: "Reload Halaman",
          accelerator: "F5",
          click: () => {
            if (mw && !mw.isDestroyed()) {
              mw.webContents.reload();
            }
          },
        },
        {
          label: "Reload Paksa",
          accelerator: "Ctrl+Shift+R",
          click: () => {
            if (mw && !mw.isDestroyed()) {
              mw.webContents.reloadIgnoringCache();
            }
          },
        },
      ],
    },
  ]);
}

// ── Print-to-browser IPC ──────────────────────────────────────────────────────
const MAX_PRINT_HTML_BYTES = 5 * 1024 * 1024; // 5 MB cap
const printTempDir = path.join(os.tmpdir(), "usahaku-print");

ipcMain.handle("open-in-browser", async (_event, html: unknown) => {
  try {
    if (typeof html !== "string") {
      writeLog("open-in-browser: payload bukan string, ditolak");
      return "Payload tidak valid.";
    }
    const byteLen = Buffer.byteLength(html, "utf8");
    if (byteLen === 0) {
      writeLog("open-in-browser: payload kosong, ditolak");
      return "Payload kosong.";
    }
    if (byteLen > MAX_PRINT_HTML_BYTES) {
      writeLog(`open-in-browser: payload ${byteLen} byte > ${MAX_PRINT_HTML_BYTES}, ditolak`);
      return "Konten cetak terlalu besar.";
    }
    fs.mkdirSync(printTempDir, { recursive: true });
    const fileName = `usahaku-laporan-${crypto.randomBytes(8).toString("hex")}.html`;
    const tempPath = path.join(printTempDir, fileName);
    fs.writeFileSync(tempPath, html, { encoding: "utf8", mode: 0o600 });
    const err = await shell.openPath(tempPath);
    if (err) writeLog(`open-in-browser shell.openPath error: ${err}`);
    return err;
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    writeLog(`open-in-browser error: ${msg}`);
    return msg;
  }
});

// ── Utilities ─────────────────────────────────────────────────────────────────
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

// ── Window management ─────────────────────────────────────────────────────────
function createLoadingWindow(): void {
  const iconPath = getIconPath();
  const preloadPath = path.join(__dirname, "preload.js");

  const win = new BrowserWindow({
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

  setMainWindow(win);

  try {
    const loadingPath = path.join(app.getPath("userData"), "loading-screen.html");
    fs.writeFileSync(loadingPath, LOADING_HTML, "utf8");
    win.loadFile(loadingPath);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    writeLog(`fallback loading-screen data url: ${msg}`);
    win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(LOADING_HTML)}`);
  }

  win.once("ready-to-show", () => {
    win.center();
    win.show();
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  win.webContents.on("console-message", (_event, level, message, line, sourceId) => {
    const lvl = level === 2 ? "warn" : level >= 3 ? "error" : "info";
    writeLog(`[renderer:${lvl}] ${sourceId}:${line} ${message}`);
  });

  win.webContents.on("render-process-gone", (_event, details) => {
    writeLog(`[renderer] process gone: reason=${details.reason} exitCode=${details.exitCode}`);
  });

  win.webContents.on("did-fail-load", (_event, errorCode, errorDescription, validatedURL) => {
    writeLog(`[renderer] did-fail-load code=${errorCode} desc=${errorDescription} url=${validatedURL}`);
    if (errorCode === -3) return;
    if (validatedURL.startsWith("data:text/html")) return;
    if (win && !win.isDestroyed()) {
      writeLog("[renderer] Loading RECOVERY_HTML fallback");
      win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(RECOVERY_HTML)}`).catch(
        (e: Error) => writeLog(`[renderer] Failed to load RECOVERY_HTML: ${e.message}`),
      );
    }
  });

  win.on("close", (e) => {
    if (!isDev) {
      e.preventDefault();
      setIsQuitting(true);
      (async () => {
        await walCheckpoint();
        if (backendProcess) {
          backendProcess.kill();
          setBackendProcess(null);
        }
        await new Promise<void>((r) => setTimeout(r, 200));
        performAutoBackup();
        win.destroy();
      })().catch((err) => {
        writeLog(`[auto-backup close] error: ${err}`);
        win.destroy();
      });
    }
  });

  win.on("closed", () => {
    setMainWindow(null);
  });
}

async function loadApp(appUrl: string): Promise<void> {
  if (!mw || mw.isDestroyed()) return;
  writeLog(`Loading app URL: ${appUrl}`);

  await mw.loadURL(appUrl).catch((err: Error) => {
    dialog.showErrorBox(
      "Gagal Memuat Antarmuka",
      `Tidak dapat memuat halaman aplikasi.\n\nError: ${err.message}\n\nCoba tutup dan buka kembali.`
    );
    app.quit();
  });

  if (mw && !mw.isDestroyed()) {
    mw.focus();
    mw.webContents.focus();
  }
}

// ── App ready ─────────────────────────────────────────────────────────────────
app.whenReady().then(async () => {
  ensureUserDataDir();
  initLogFile();
  writeLog(`App starting, isDev=${isDev}, platform=${process.platform}`);
  Menu.setApplicationMenu(buildAppMenu());
  writeLog(`userData: ${app.getPath("userData")}`);
  if (!isDev) {
    writeLog(`resourcesPath: ${process.resourcesPath}`);
  }

  // Register all IPC handlers from modules
  registerAutoUpdaterIpc();
  registerLocalBackupIpc();
  registerGDriveIpc();
  registerLogoIpc();

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
    if (backendStderrBuffer.trim()) {
      writeLog(`[startup-failure-stderr]\n${backendStderrBuffer.slice(-2000)}`);
    }

    const logFilePath = getLogFilePath();
    const logInfo = logFilePath ? `\n\nDetail teknis tersimpan di:\n${logFilePath}` : "";

    dialog.showErrorBox(
      "Gagal Memulai Usahaku",
      `${message}${logInfo}`,
    );
    app.quit();
  }
});

// ── App lifecycle ─────────────────────────────────────────────────────────────
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("will-quit", () => {
  setIsQuitting(true);
  const gdriveTimer = getGDriveAutoBackupTimer();
  if (gdriveTimer) clearInterval(gdriveTimer);
  try {
    writeLog("App quitting, running snapshot auto-backup...");
    performAutoBackup();
  } catch (err: unknown) {
    writeLog(`Auto-backup on quit error: ${err}`);
  }
  writeLog("App quitting, killing backend...");
  if (backendProcess) {
    backendProcess.kill();
    setBackendProcess(null);
  }
});
