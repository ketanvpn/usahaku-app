/**
 * Auto-updater setup and IPC handlers.
 *
 * Uses electron-updater with manual download control (autoDownload=false).
 * Checks 10s after start, then every 6 hours.
 */
import { app, ipcMain, shell } from "electron";
import { autoUpdater } from "electron-updater";
import { mainWindow } from "./app-state";
import { writeLog } from "./logging";

let lastUpdateStatus: object | null = null;

function sendUpdateStatus(status: string, payload?: object) {
  const data = { status, ...payload };
  lastUpdateStatus = data;
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("update:status", data);
  }
}

export function setupAutoUpdater(): void {
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

// ── IPC handlers ──────────────────────────────────────────────────────────────

export function registerAutoUpdaterIpc(): void {
  ipcMain.handle("update:getStatus", () => lastUpdateStatus);

  ipcMain.handle("update:checkNow", async () => {
    try {
      await autoUpdater.checkForUpdates();
    } catch (e: unknown) {
      writeLog(`[updater] manual check failed: ${e}`);
    }
  });

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

  ipcMain.handle("app:getVersion", () => app.getVersion());

  // v1.1.4: shortcut handler yang dipakai RECOVERY_HTML.
  ipcMain.handle(
    "app:checkUpdateNow",
    async (): Promise<{ available: boolean; version?: string }> => {
      try {
        const result = await autoUpdater.checkForUpdates();
        const info = result?.updateInfo;
        const currentVersion = app.getVersion();
        if (info && info.version && info.version !== currentVersion) {
          return { available: true, version: info.version };
        }
        return { available: false };
      } catch (e: unknown) {
        writeLog(`[updater] app:checkUpdateNow error: ${e}`);
        return { available: false };
      }
    },
  );

  ipcMain.handle(
    "app:downloadUpdateNow",
    async (): Promise<{ success: boolean; message?: string }> => {
      try {
        await autoUpdater.downloadUpdate();
        return { success: true };
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        writeLog(`[updater] app:downloadUpdateNow error: ${msg}`);
        return { success: false, message: msg };
      }
    },
  );

  ipcMain.handle("app:openUserData", async () => {
    await shell.openPath(app.getPath("userData"));
  });

  ipcMain.handle("app:openReleases", async () => {
    await shell.openExternal(
      "https://github.com/ketanvpn/usahaku-app/releases/latest",
    );
  });

  ipcMain.handle("app:quit", () => {
    app.quit();
  });
}
