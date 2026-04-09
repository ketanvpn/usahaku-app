import { app, BrowserWindow, dialog, shell } from "electron";
import { utilityProcess } from "electron";
import * as path from "path";
import * as http from "http";
import * as fs from "fs";

const isDev = !app.isPackaged || process.env.NODE_ENV === "development";

const BACKEND_PORT = 8080;
const FRONTEND_DEV_PORT = process.env.VITE_PORT || "5173";

let backendProcess: Electron.UtilityProcess | null = null;
let mainWindow: BrowserWindow | null = null;

function getDbPath(): string {
  return path.join(app.getPath("userData"), "app.db");
}

function waitForBackend(port: number, maxWaitMs = 20000): Promise<void> {
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
            `Server backend tidak merespons setelah ${maxWaitMs / 1000} detik.`
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

function getFrontendDistPath(): string {
  if (isDev) {
    return path.resolve(__dirname, "../../hutang-app/dist/public");
  }
  return path.join(process.resourcesPath, "frontend");
}

function startBackend(): void {
  const scriptPath = getBackendScriptPath();
  const frontendPath = getFrontendDistPath();
  const dbPath = getDbPath();

  if (!fs.existsSync(scriptPath)) {
    const hint = isDev
      ? 'Jalankan: pnpm --filter @workspace/api-server run build'
      : 'Instalasi aplikasi rusak. Coba install ulang.';
    dialog.showErrorBox(
      "Backend Tidak Ditemukan",
      `File server tidak ditemukan:\n${scriptPath}\n\n${hint}`
    );
    app.quit();
    return;
  }

  backendProcess = utilityProcess.fork(scriptPath, [], {
    env: {
      ...process.env,
      DATABASE_PATH: dbPath,
      PORT: String(BACKEND_PORT),
      NODE_ENV: "production",
      SERVE_STATIC: "true",
      STATIC_PATH: frontendPath,
      SESSION_SECRET:
        process.env.SESSION_SECRET || "buku-hutang-desktop-s3cr3t-key",
    },
    stdio: "pipe",
  });

  backendProcess.stdout?.on("data", (data: Buffer) => {
    console.log("[backend]", data.toString().trim());
  });

  backendProcess.stderr?.on("data", (data: Buffer) => {
    console.error("[backend:err]", data.toString().trim());
  });

  backendProcess.on("exit", (code: number) => {
    console.log(`[backend] Exited with code ${code}`);
    backendProcess = null;
    if (mainWindow && !mainWindow.isDestroyed()) {
      dialog
        .showMessageBox(mainWindow, {
          type: "error",
          title: "Server Berhenti",
          message:
            "Server backend berhenti tidak terduga. Aplikasi akan ditutup.",
          buttons: ["Tutup"],
        })
        .then(() => app.quit());
    }
  });
}

function createWindow(loadUrl: string): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: "Buku Hutang",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
    show: false,
  });

  mainWindow.loadURL(loadUrl).catch((err: Error) => {
    dialog.showErrorBox(
      "Gagal Memuat Aplikasi",
      `Tidak dapat membuka halaman:\n${err.message}`
    );
  });

  mainWindow.once("ready-to-show", () => {
    mainWindow!.show();
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

app.whenReady().then(async () => {
  try {
    if (isDev) {
      const backendAlreadyRunning = await waitForBackend(BACKEND_PORT, 3000)
        .then(() => true)
        .catch(() => false);

      if (!backendAlreadyRunning) {
        startBackend();
        console.log("[electron] Waiting for backend to start...");
        await waitForBackend(BACKEND_PORT, 20000);
      } else {
        console.log("[electron] Backend already running on port", BACKEND_PORT);
      }

      const devUrl = `http://localhost:${FRONTEND_DEV_PORT}`;
      console.log("[electron] Opening dev URL:", devUrl);
      createWindow(devUrl);
    } else {
      startBackend();
      console.log("[electron] Waiting for backend...");
      await waitForBackend(BACKEND_PORT, 25000);
      createWindow(`http://localhost:${BACKEND_PORT}`);
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    dialog.showErrorBox(
      "Gagal Memulai Aplikasi",
      `Terjadi kesalahan saat memulai:\n${message}`
    );
    app.quit();
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("will-quit", () => {
  if (backendProcess) {
    backendProcess.kill();
    backendProcess = null;
  }
});
