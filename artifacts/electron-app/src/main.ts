import { app, BrowserWindow, dialog, shell, Menu } from "electron";
import { utilityProcess } from "electron";
import * as path from "path";
import * as http from "http";
import * as fs from "fs";

const APP_NAME = "Buku Hutang";
const APP_ID = "com.bukuhutang.app";
const BACKEND_PORT = 8080;
const FRONTEND_DEV_PORT = process.env.VITE_PORT || "5173";

const isDev = !app.isPackaged || process.env.NODE_ENV === "development";

let backendProcess: Electron.UtilityProcess | null = null;
let mainWindow: BrowserWindow | null = null;

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
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100vh;
      background: #1d4ed8;
      color: white;
      font-family: 'Segoe UI', system-ui, sans-serif;
      user-select: none;
    }
    .container { text-align: center; }
    .icon { font-size: 3rem; margin-bottom: 0.75rem; }
    h1 { font-size: 1.75rem; font-weight: 700; letter-spacing: -0.5px; }
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
    <div class="subtitle">Manajemen Hutang Usaha</div>
    <div class="spinner"></div>
    <div class="status">Memuat aplikasi, harap tunggu...</div>
  </div>
</body>
</html>`;

function getDbPath(): string {
  return path.join(app.getPath("userData"), "app.db");
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
        `Tidak dapat membuat folder penyimpanan data:\n${userDataDir}\n\nError: ${msg}\n\nPastikan Anda memiliki izin tulis di folder AppData.`
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
            `Server tidak merespons setelah ${maxWaitMs / 1000} detik.\n\nKemungkinan penyebab:\n- Port ${port} sedang dipakai aplikasi lain\n- Izin akses jaringan lokal diblokir\n\nCoba tutup dan buka kembali aplikasi.`
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

  if (!fs.existsSync(scriptPath)) {
    const hint = isDev
      ? "Jalankan terlebih dahulu:\npnpm --filter @workspace/api-server run build"
      : "Instalasi aplikasi mungkin rusak atau tidak lengkap.\nCoba uninstall dan install ulang aplikasi.";
    dialog.showErrorBox(
      "File Aplikasi Tidak Ditemukan",
      `Tidak dapat menemukan file server:\n${scriptPath}\n\n${hint}`
    );
    app.quit();
    return;
  }

  const sessionSecret =
    process.env.SESSION_SECRET || `buku-hutang-${app.getPath("userData").replace(/\\/g, "/")}`;

  backendProcess = utilityProcess.fork(scriptPath, [], {
    env: {
      ...process.env,
      DATABASE_PATH: dbPath,
      PORT: String(BACKEND_PORT),
      NODE_ENV: "production",
      SERVE_STATIC: "true",
      STATIC_PATH: frontendPath,
      SESSION_SECRET: sessionSecret,
    },
    stdio: "pipe",
  });

  backendProcess.stdout?.on("data", (data: Buffer) => {
    if (isDev) console.log("[backend]", data.toString().trim());
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
          title: "Layanan Aplikasi Berhenti",
          message:
            "Layanan server lokal berhenti tidak terduga.\n\nAplikasi perlu ditutup. Silakan buka kembali.",
          buttons: ["Tutup Aplikasi"],
          defaultId: 0,
        })
        .then(() => app.quit());
    }
  });
}

function createLoadingWindow(): void {
  const iconPath = getIconPath();

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 640,
    title: APP_NAME,
    icon: iconPath,
    backgroundColor: "#1d4ed8",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
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

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

async function loadApp(appUrl: string): Promise<void> {
  if (!mainWindow || mainWindow.isDestroyed()) return;

  await mainWindow.loadURL(appUrl).catch((err: Error) => {
    dialog.showErrorBox(
      "Gagal Memuat Antarmuka",
      `Tidak dapat memuat halaman aplikasi.\n\nError: ${err.message}\n\nCoba tutup dan buka kembali aplikasi.`
    );
    app.quit();
  });
}

app.whenReady().then(async () => {
  try {
    if (isDev) {
      const backendAlreadyRunning = await waitForBackend(BACKEND_PORT, 3000)
        .then(() => true)
        .catch(() => false);

      createLoadingWindow();

      if (!backendAlreadyRunning) {
        startBackend();
        console.log("[electron] Waiting for backend to start...");
        await waitForBackend(BACKEND_PORT, 20000);
      } else {
        console.log("[electron] Backend already running on port", BACKEND_PORT);
      }

      const devUrl = `http://localhost:${FRONTEND_DEV_PORT}`;
      console.log("[electron] Loading:", devUrl);
      await loadApp(devUrl);
    } else {
      ensureUserDataDir();
      createLoadingWindow();
      startBackend();
      console.log("[electron] Waiting for backend...");
      await waitForBackend(BACKEND_PORT, 30000);
      await loadApp(`http://localhost:${BACKEND_PORT}`);
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    dialog.showErrorBox("Gagal Memulai Buku Hutang", message);
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
