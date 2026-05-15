import { app, BrowserWindow, dialog, shell, Menu, ipcMain, safeStorage } from "electron";
import { utilityProcess } from "electron";
import * as path from "path";
import * as http from "http";
import * as https from "https";
import * as fs from "fs";
import * as os from "os";
import * as crypto from "crypto";
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

// v1.1.4: Application Menu permanen sebagai safety net.
// Menu selalu visible di atas window. Berisi tombol fisik untuk cek/pasang
// update + buka folder data, jadi kalau renderer crash blank putih, user
// masih bisa recovery sendiri tanpa harus download installer manual dari
// GitHub. Sebelumnya Menu.setApplicationMenu(null) bikin tidak ada jalan
// keluar dari blank-putih kecuali install ulang manual.
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
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.webContents.reload();
            }
          },
        },
        {
          label: "Reload Paksa",
          accelerator: "Ctrl+Shift+R",
          click: () => {
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.webContents.reloadIgnoringCache();
            }
          },
        },
      ],
    },
  ]);
}

// Halaman fallback yang di-load kalau renderer gagal load (mis. backend
// belum siap, port lain dipakai, dst). Tombol di sini panggil IPC yang
// sama dengan menu di atas. User awam tidak perlu tahu cara download
// installer manual.
const RECOVERY_HTML = `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Aplikasi Bermasalah</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      display: flex; align-items: center; justify-content: center;
      min-height: 100vh; padding: 2rem;
      background: #0d3526; color: white;
      font-family: 'Segoe UI', system-ui, sans-serif;
      user-select: none;
    }
    .card {
      background: rgba(255,255,255,0.07);
      border: 1px solid rgba(255,255,255,0.18);
      border-radius: 12px;
      padding: 2rem; max-width: 540px; width: 100%;
    }
    h1 { font-size: 1.5rem; margin-bottom: 0.4rem; }
    .subtitle { font-size: 0.9rem; opacity: 0.8; margin-bottom: 1.25rem; }
    .desc { font-size: 0.95rem; line-height: 1.6; opacity: 0.95; margin-bottom: 1.5rem; }
    .btn-group { display: flex; flex-direction: column; gap: 0.5rem; }
    button {
      width: 100%; padding: 0.75rem 1rem;
      background: white; color: #0d3526;
      border: none; border-radius: 8px;
      font-size: 0.95rem; font-weight: 600;
      cursor: pointer; text-align: left;
      transition: opacity 0.15s;
    }
    button:hover { opacity: 0.9; }
    button.secondary {
      background: transparent; color: white;
      border: 1px solid rgba(255,255,255,0.4);
    }
    button.secondary:hover { background: rgba(255,255,255,0.08); }
    .hint { font-size: 0.8rem; opacity: 0.7; margin-top: 1.25rem; line-height: 1.5; }
    .status {
      margin-top: 0.75rem; padding: 0.6rem 0.75rem;
      background: rgba(0,0,0,0.25); border-radius: 6px;
      font-size: 0.85rem; min-height: 1.2rem;
    }
  </style>
</head>
<body>
  <div class="card">
    <h1>⚠️ Aplikasi Bermasalah</h1>
    <div class="subtitle">Versi: <span id="ver">memuat...</span></div>
    <div class="desc">
      Halaman utama tidak bisa dimuat. Coba salah satu opsi di bawah untuk
      memperbaiki. <strong>Data Anda tidak akan hilang</strong> — semua
      tersimpan terpisah dari aplikasi.
    </div>
    <div class="btn-group">
      <button onclick="reload()">🔄 Coba Muat Ulang</button>
      <button onclick="checkUpdate()">⬇️ Cek &amp; Pasang Update</button>
      <button class="secondary" onclick="openData()">📂 Buka Folder Data</button>
      <button class="secondary" onclick="openReleases()">🌐 Buka Halaman Rilis</button>
      <button class="secondary" onclick="quitApp()">✕ Tutup Aplikasi</button>
    </div>
    <div class="status" id="status">Menu &quot;Aplikasi&quot; di atas juga punya tombol-tombol ini.</div>
    <div class="hint">
      Kalau ini terus terjadi, hubungi support dan kirim folder
      <code>logs/</code> dari folder data di atas.
    </div>
  </div>
  <script>
    const api = window.electronApp || {};
    const $status = document.getElementById('status');
    const $ver = document.getElementById('ver');
    function setStatus(msg) { $status.textContent = msg; }
    if (api.getAppVersion) {
      api.getAppVersion().then(v => { $ver.textContent = v || '-'; }).catch(() => {});
    } else {
      $ver.textContent = '(API tidak tersedia)';
    }
    function reload() { setStatus('Memuat ulang...'); location.reload(); }
    function checkUpdate() {
      if (!api.checkUpdate) { setStatus('API update tidak tersedia.'); return; }
      setStatus('Mengecek update...');
      api.checkUpdate().then((info) => {
        if (info && info.available) {
          setStatus('Update tersedia: v' + info.version + '. Mendownload...');
          api.downloadUpdate().then(() => {
            setStatus('Download selesai. Klik tombol ini lagi untuk pasang.');
            const btn = document.querySelectorAll('button')[1];
            btn.textContent = '⬆️ Pasang & Restart';
            btn.onclick = () => api.installUpdate();
          }).catch(e => setStatus('Gagal download: ' + (e && e.message || e)));
        } else if (info) {
          setStatus('Tidak ada update tersedia (sudah versi terbaru).');
        }
      }).catch(e => setStatus('Gagal cek: ' + (e && e.message || e)));
    }
    function openData() { api.openUserData && api.openUserData(); }
    function openReleases() { api.openReleases && api.openReleases(); }
    function quitApp() { api.quitApp && api.quitApp(); }
  </script>
</body>
</html>`;

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

interface InstallSecrets {
  sessionSecret: string;
  licenseSecret: string;
  resetSecret: string;
}

// Generate (atau muat) secret unik per-instalasi dan simpan di userData.
// Berkas hanya dibaca/ditulis oleh aplikasi sendiri, jadi mode read-write biasa
// di Windows sudah cukup untuk membatasi akses dari user lain di mesin yang sama.
function loadOrCreateInstallSecrets(): InstallSecrets {
  const userData = app.getPath("userData");
  const file = path.join(userData, "install-secrets.json");

  function generate(): InstallSecrets {
    return {
      sessionSecret: crypto.randomBytes(32).toString("hex"),
      licenseSecret: crypto.randomBytes(32).toString("hex"),
      resetSecret: crypto.randomBytes(32).toString("hex"),
    };
  }

  try {
    if (fs.existsSync(file)) {
      const parsed = JSON.parse(fs.readFileSync(file, "utf8")) as Partial<InstallSecrets>;
      const fresh = generate();
      const merged: InstallSecrets = {
        sessionSecret: parsed.sessionSecret && parsed.sessionSecret.length >= 32 ? parsed.sessionSecret : fresh.sessionSecret,
        licenseSecret: parsed.licenseSecret && parsed.licenseSecret.length >= 32 ? parsed.licenseSecret : fresh.licenseSecret,
        resetSecret: parsed.resetSecret && parsed.resetSecret.length >= 32 ? parsed.resetSecret : fresh.resetSecret,
      };
      // Tulis ulang hanya jika ada field yang baru di-generate, supaya secret lama tidak berubah.
      if (
        merged.sessionSecret !== parsed.sessionSecret ||
        merged.licenseSecret !== parsed.licenseSecret ||
        merged.resetSecret !== parsed.resetSecret
      ) {
        fs.writeFileSync(file, JSON.stringify(merged, null, 2), { encoding: "utf8", mode: 0o600 });
      }
      return merged;
    }
  } catch (e) {
    writeLog(`[secrets] Gagal baca ${file}: ${e instanceof Error ? e.message : String(e)} — generate baru`);
  }

  const fresh = generate();
  try {
    fs.mkdirSync(userData, { recursive: true });
    fs.writeFileSync(file, JSON.stringify(fresh, null, 2), { encoding: "utf8", mode: 0o600 });
  } catch (e) {
    writeLog(`[secrets] Gagal tulis ${file}: ${e instanceof Error ? e.message : String(e)}`);
  }
  return fresh;
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

  // Generate dan persist secret unik per-instalasi.
  // Saat build rilis, fallback bawaan di backend di-tolak (STRICT_SECRET_POLICY=fail),
  // jadi semua secret WAJIB datang dari env yang kita inject di sini.
  const installSecrets = loadOrCreateInstallSecrets();

  backendStderrBuffer = "";

  backendProcess = utilityProcess.fork(scriptPath, [], {
    env: {
      ...process.env,
      DATABASE_PATH: dbPath,
      PORT: String(BACKEND_PORT),
      NODE_ENV: "production",
      SERVE_STATIC: "true",
      STATIC_PATH: frontendPath,
      SESSION_SECRET: installSecrets.sessionSecret,
      LICENSE_SECRET: installSecrets.licenseSecret,
      RESET_SECRET: installSecrets.resetSecret,
      STRICT_SECRET_POLICY: isDev ? "warn" : "fail",
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
    // Catat detail stderr ke log file saja — JANGAN tampilkan ke user supaya
    // path absolut, env, dan stack trace tidak bocor di screenshot dialog.
    if (backendStderrBuffer.trim()) {
      writeLog(`[backend:exit-detail]\n${backendStderrBuffer.slice(-2000)}`);
    }
    backendProcess = null;

    if (!isQuitting && !isRestoring && mainWindow && !mainWindow.isDestroyed()) {
      const logInfo = logFilePath ? `\n\nDetail teknis tersimpan di:\n${logFilePath}` : "";
      const buttons = logFilePath ? ["Tutup Aplikasi", "Buka File Log"] : ["Tutup Aplikasi"];

      dialog
        .showMessageBox(mainWindow, {
          type: "error",
          title: "Layanan Aplikasi Berhenti",
          message:
            `Server berhenti tidak terduga (kode: ${code}).\n\n` +
            `Aplikasi perlu ditutup dan dibuka kembali. Jika masalah berulang, ` +
            `kirim isi file log di bawah ke pengembang.${logInfo}`,
          buttons,
          defaultId: 0,
          cancelId: 0,
        })
        .then((result) => {
          if (result.response === 1 && logFilePath) {
            shell.openPath(logFilePath).catch((e) => writeLog(`[dialog] gagal buka log: ${e}`));
          }
          app.quit();
        });
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

// v1.1.4: shortcut handler yang dipakai RECOVERY_HTML.
// Berbeda dengan update:checkNow (return void), ini await sampai ada
// jawaban dari electron-updater jadi UI bisa update statusnya secara sync.
ipcMain.handle(
  "app:checkUpdateNow",
  async (): Promise<{ available: boolean; version?: string }> => {
    try {
      const result = await autoUpdater.checkForUpdates();
      const info = result?.updateInfo;
      const currentVersion = app.getVersion();
      // electron-updater anggap "available" kalau remote version != current.
      // Bisa jadi sebenarnya remote LEBIH RENDAH dari local (kasus dev / rollback),
      // tapi flag `available` tetap true. Kita filter di sini supaya benar-benar
      // hanya kasih pop "tersedia" kalau remote > current.
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

// ── IPC: write HTML to temp file and open in default browser for print/PDF ──
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
    // Filename random per panggilan supaya tidak menimpa file lain dan tidak
    // bisa ditebak proses lokal lain di mesin yang sama.
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

  try {
    const loadingPath = path.join(app.getPath("userData"), "loading-screen.html");
    fs.writeFileSync(loadingPath, LOADING_HTML, "utf8");
    mainWindow.loadFile(loadingPath);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    writeLog(`fallback loading-screen data url: ${msg}`);
    mainWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(LOADING_HTML)}`);
  }

  mainWindow.once("ready-to-show", () => {
    mainWindow!.center();
    mainWindow!.show();
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  mainWindow.webContents.on("console-message", (_event, level, message, line, sourceId) => {
    const lvl = level === 2 ? "warn" : level >= 3 ? "error" : "info";
    writeLog(`[renderer:${lvl}] ${sourceId}:${line} ${message}`);
  });

  mainWindow.webContents.on("render-process-gone", (_event, details) => {
    writeLog(`[renderer] process gone: reason=${details.reason} exitCode=${details.exitCode}`);
  });

  mainWindow.webContents.on("did-fail-load", (_event, errorCode, errorDescription, validatedURL) => {
    writeLog(`[renderer] did-fail-load code=${errorCode} desc=${errorDescription} url=${validatedURL}`);
    // v1.1.4: kalau renderer gagal load (mis. chunk JS hilang seperti v1.1.2,
    // backend belum siap, port konflik, dll), tampilkan halaman recovery
    // dengan tombol fisik. Skip kalau errorCode -3 (request aborted, biasanya
    // saat navigasi normal) dan kalau yang gagal adalah RECOVERY_HTML itu
    // sendiri (mencegah loop infinite).
    if (errorCode === -3) return;
    if (validatedURL.startsWith("data:text/html")) return;
    if (mainWindow && !mainWindow.isDestroyed()) {
      writeLog("[renderer] Loading RECOVERY_HTML fallback");
      mainWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(RECOVERY_HTML)}`).catch(
        (e: Error) => writeLog(`[renderer] Failed to load RECOVERY_HTML: ${e.message}`),
      );
    }
  });

  mainWindow.on("close", (e) => {
    // Auto-backup sebelum tutup (hanya di production/release)
    if (!isDev) {
      e.preventDefault();
      isQuitting = true;
      (async () => {
        // 1. Checkpoint WAL dulu selagi backend masih hidup → semua data masuk ke .db
        await walCheckpoint();
        // 2. Matikan backend
        if (backendProcess) {
          backendProcess.kill();
          backendProcess = null;
        }
        // 3. Tunggu sebentar agar proses benar-benar berhenti
        await new Promise<void>((r) => setTimeout(r, 200));
        // 4. Copy .db ke folder backup
        performAutoBackup();
        mainWindow?.destroy();
      })().catch((err) => {
        writeLog(`[auto-backup close] error: ${err}`);
        mainWindow?.destroy();
      });
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
  // v1.1.4: pasang menu permanen sebelum bikin window apa pun, supaya
  // recovery menu langsung available walaupun renderer belum sempat load.
  Menu.setApplicationMenu(buildAppMenu());
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
    if (backendStderrBuffer.trim()) {
      writeLog(`[startup-failure-stderr]\n${backendStderrBuffer.slice(-2000)}`);
    }

    const logInfo = logFilePath ? `\n\nDetail teknis tersimpan di:\n${logFilePath}` : "";

    dialog.showErrorBox(
      "Gagal Memulai Usahaku",
      `${message}${logInfo}`,
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

ipcMain.handle("backup:openFolder", async (): Promise<{ success: boolean; message?: string }> => {
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

    // Validasi file hasil copy — pastikan tidak kosong atau corrupt
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

async function walCheckpoint(): Promise<void> {
  // Flush data dari .db-wal ke file .db utama agar backup tidak ketinggalan data terbaru
  try {
    await new Promise<void>((resolve) => {
      const req = http.request(
        { hostname: "127.0.0.1", port: BACKEND_PORT, path: "/api/internal/wal-checkpoint", method: "POST" },
        (res) => { res.resume(); res.on("end", resolve); }
      );
      req.on("error", () => resolve()); // Abaikan error — backup tetap jalan
      req.end();
    });
    writeLog("[gdrive] WAL checkpoint selesai");
  } catch {
    writeLog("[gdrive] WAL checkpoint gagal — backup tetap dilanjutkan");
  }
}

async function uploadBackupToDrive(accessToken: string, dbPath: string): Promise<boolean> {
  try {
    const folderId = await getOrCreateDriveFolder(accessToken);
    if (!folderId) return false;

    // Flush WAL ke .db sebelum baca file
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

// Validasi apakah file .db adalah SQLite valid berdasarkan magic bytes dan ukuran minimum
function validateBackupDbFile(filePath: string): { valid: boolean; reason?: string } {
  try {
    const stat = fs.statSync(filePath);
    writeLog(`[restore] Ukuran file backup: ${stat.size} bytes`);

    // Tolak file yang sangat kecil — SQLite kosong tanpa schema hanya ~4 KB (1 page)
    // Schema 10 tabel Usahaku saja sudah butuh minimal 2–3 pages (~8–12 KB)
    // Threshold 8 KB hanya memblokir file yang benar-benar kosong / bukan DB Usahaku
    if (stat.size < 8 * 1024) {
      return {
        valid: false,
        reason: `File backup terlalu kecil (${Math.round(stat.size / 1024)} KB) dan bukan file database Usahaku yang valid. Pastikan Anda memilih file backup yang benar.`,
      };
    }

    // Cek magic bytes SQLite: 16 byte pertama harus "SQLite format 3"
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

// Verifikasi integritas DB melalui backend yang sudah berjalan
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

// Coba salin file dengan retry (3 kali, jeda 600ms) — mengatasi file lock di Windows
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

async function performRestoreFromFile(sourcePath: string): Promise<{ success: boolean; canceled?: boolean; message?: string }> {
  const dbPath = getDbPath();
  const rollbackPath = dbPath + ".rollback";

  // Validasi file backup sebelum melakukan apapun
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

  isRestoring = true;
  backendStderrBuffer = "";
  if (backendProcess) {
    backendProcess.kill();
    backendProcess = null;
  }
  // 1500ms — lebih aman untuk PC Windows yang lambat melepas file lock
  await new Promise<void>((r) => setTimeout(r, 1500));

  // Hapus file WAL dan SHM agar data lama tidak menimpa DB yang akan di-restore
  // (SQLite WAL mode: jika file .db-wal masih ada, backend akan menerapkannya ke DB baru)
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
    isRestoring = false;
    return { success: false, message: `Gagal menyalin file database: ${msg}` };
  }

  try {
    startBackend();
    await waitForBackend(BACKEND_PORT, 20000);

    // Verifikasi integritas DB setelah restore — pastikan data benar-benar valid
    const healthy = await dbIntegrityCheck();
    if (!healthy) {
      writeLog("[restore] Integrity check gagal — rollback ke data sebelumnya");
      const stuck = backendProcess as Electron.UtilityProcess | null;
      stuck?.kill();
      backendProcess = null;
      await new Promise<void>((r) => setTimeout(r, 500));
      try { fs.copyFileSync(rollbackPath, dbPath); } catch {}
      try { fs.unlinkSync(rollbackPath); } catch {}
      startBackend();
      isRestoring = false;
      return { success: false, message: "File backup rusak atau tidak kompatibel (integrity check gagal). Data Anda sudah dikembalikan." };
    }

    try { fs.unlinkSync(rollbackPath); } catch {}
    isRestoring = false;
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.reload();
    return { success: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    writeLog(`[restore] Backend gagal start, rollback: ${msg}`);
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

// ── Pengaturan: Logo Upload ─────────────────────────────────────────────────
// Logo disimpan di file (bukan DB) supaya DB tetap ramping. Lokasi:
//   <userData>/logos/<usaha_id>/<filename>
// Renderer kirim base64 lewat IPC; main process validasi + tulis dengan mode 0600.

const LOGO_MAX_BYTES = 1 * 1024 * 1024; // 1 MB binary
const LOGO_MAX_BASE64 = Math.ceil(LOGO_MAX_BYTES * 1.4); // base64 ~33% lebih besar dari binary

function getLogosDir(usahaId: number): string {
  // Path traversal guard: usahaId wajib integer non-negatif.
  const safeId = Math.floor(Number(usahaId));
  if (!Number.isFinite(safeId) || safeId < 0) {
    throw new Error("usahaId tidak valid");
  }
  return path.join(app.getPath("userData"), "logos", String(safeId));
}

ipcMain.handle(
  "pengaturan:saveLogo",
  async (
    _event,
    payload: { usahaId: number; data: string; ext: string },
  ): Promise<{ success: boolean; filename?: string; message?: string }> => {
    try {
      const { usahaId, data, ext } = payload ?? {};

      if (typeof usahaId !== "number" || typeof data !== "string" || typeof ext !== "string") {
        return { success: false, message: "Payload tidak valid" };
      }

      const extLower = ext.toLowerCase();
      if (!["png", "jpg", "jpeg"].includes(extLower)) {
        return { success: false, message: "Format harus PNG atau JPG" };
      }

      if (data.length === 0) {
        return { success: false, message: "Data logo kosong" };
      }
      if (data.length > LOGO_MAX_BASE64) {
        return { success: false, message: "Logo maksimal 1 MB" };
      }

      // Validasi karakter base64 (sample 1 KB pertama supaya tidak mahal).
      const sample = data.slice(0, 1024);
      if (!/^[A-Za-z0-9+/=]+$/.test(sample)) {
        return { success: false, message: "Data logo tidak valid (bukan base64)" };
      }

      let buffer: Buffer;
      try {
        buffer = Buffer.from(data, "base64");
      } catch {
        return { success: false, message: "Gagal decode base64" };
      }

      if (buffer.length === 0 || buffer.length > LOGO_MAX_BYTES) {
        return { success: false, message: "Ukuran logo di luar batas" };
      }

      const logosDir = getLogosDir(usahaId);
      await fs.promises.mkdir(logosDir, { recursive: true });

      // Cleanup logo lama supaya folder tidak menumpuk.
      try {
        const oldFiles = await fs.promises.readdir(logosDir);
        for (const f of oldFiles) {
          await fs.promises.unlink(path.join(logosDir, f)).catch(() => {});
        }
      } catch {
        // Folder baru, abaikan.
      }

      const filename = `logo-${Date.now()}.${extLower}`;
      const filePath = path.join(logosDir, filename);
      await fs.promises.writeFile(filePath, buffer, { mode: 0o600 });

      return { success: true, filename };
    } catch (e) {
      writeLog(`pengaturan:saveLogo error: ${String(e)}`);
      return { success: false, message: "Gagal menyimpan logo" };
    }
  },
);

ipcMain.handle(
  "pengaturan:getLogoData",
  async (_event, usahaId: number, filename: string): Promise<string | null> => {
    try {
      if (typeof usahaId !== "number" || typeof filename !== "string" || filename.length === 0) {
        return null;
      }
      // Path traversal guard: filename tidak boleh mengandung separator.
      if (filename.includes("/") || filename.includes("\\") || filename.includes("..")) {
        return null;
      }

      const filePath = path.join(getLogosDir(usahaId), filename);

      // Pastikan file resolusi berakhir di dalam logosDir (defense in depth).
      const resolved = path.resolve(filePath);
      const allowedBase = path.resolve(getLogosDir(usahaId));
      if (!resolved.startsWith(allowedBase + path.sep) && resolved !== allowedBase) {
        return null;
      }

      const buf = await fs.promises.readFile(filePath);
      return buf.toString("base64");
    } catch {
      return null;
    }
  },
);

ipcMain.handle(
  "pengaturan:deleteLogo",
  async (_event, usahaId: number): Promise<{ success: boolean; message?: string }> => {
    try {
      const logosDir = getLogosDir(usahaId);
      await fs.promises.rm(logosDir, { recursive: true, force: true });
      return { success: true };
    } catch (e) {
      writeLog(`pengaturan:deleteLogo error: ${String(e)}`);
      return { success: false, message: "Gagal menghapus logo" };
    }
  },
);

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
