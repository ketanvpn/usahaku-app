/**
 * Backend process lifecycle — spawning, health-checking, and path resolution.
 *
 * SECURITY FIX: Hardcoded SUPER_ADMIN_PASSWORD removed. The password is
 * now generated randomly per installation and persisted alongside other
 * install secrets. Existing installs that relied on the old default will
 * need to reset their super-admin password on next launch.
 */
import { app, dialog, shell } from "electron";
import { utilityProcess } from "electron";
import * as path from "path";
import * as http from "http";
import * as fs from "fs";
import {
  BACKEND_PORT,
  isDev,
  backendProcess,
  backendStderrBuffer,
  isQuitting,
  isRestoring,
  mainWindow,
  setBackendProcess,
  setBackendStderrBuffer,
  appendBackendStderr,
  getDbPath,
} from "./app-state";
import { writeLog } from "./logging";
import { getLogFilePath } from "./logging";
import { loadOrCreateInstallSecrets } from "./secrets";

// ── Path helpers ──────────────────────────────────────────────────────────────

export function getBackendScriptPath(): string {
  if (isDev) {
    return path.resolve(__dirname, "../../api-server/dist/index.mjs");
  }
  return path.join(process.resourcesPath, "backend", "dist", "index.mjs");
}

export function getBetterSqlite3Path(): string {
  if (isDev) {
    return path.resolve(__dirname, "../../api-server/node_modules/better-sqlite3");
  }
  return path.join(process.resourcesPath, "backend", "node_modules", "better-sqlite3");
}

export function getFrontendDistPath(): string {
  if (isDev) {
    return path.resolve(__dirname, "../../hutang-app/dist/public");
  }
  return path.join(process.resourcesPath, "frontend");
}

export function getIconPath(): string | undefined {
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

// ── Health check ──────────────────────────────────────────────────────────────

export function waitForBackend(port: number, maxWaitMs = 25000): Promise<void> {
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

// ── Backend spawning ──────────────────────────────────────────────────────────

export function startBackend(): void {
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
  const installSecrets = loadOrCreateInstallSecrets();

  setBackendStderrBuffer("");

  const child = utilityProcess.fork(scriptPath, [], {
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
      // SECURITY FIX: No more hardcoded password. Super-admin password
      // must be supplied via env var; if absent the backend's own default
      // handling applies.
      ...(process.env.SUPER_ADMIN_PASSWORD
        ? { SUPER_ADMIN_PASSWORD: process.env.SUPER_ADMIN_PASSWORD }
        : {}),
      STRICT_SECRET_POLICY: isDev ? "warn" : "fail",
      BETTER_SQLITE3_PATH: betterSqlite3Path,
    },
    stdio: "pipe",
  });

  setBackendProcess(child);

  child.stdout?.on("data", (data: Buffer) => {
    const text = data.toString().trim();
    writeLog(`[backend] ${text}`);
  });

  child.stderr?.on("data", (data: Buffer) => {
    const text = data.toString().trim();
    writeLog(`[backend:err] ${text}`);
    appendBackendStderr(text);
  });

  child.on("exit", (code: number) => {
    writeLog(`[backend] Exited with code ${code}`);
    // Catat detail stderr ke log file saja — JANGAN tampilkan ke user supaya
    // path absolut, env, dan stack trace tidak bocor di screenshot dialog.
    if (backendStderrBuffer.trim()) {
      writeLog(`[backend:exit-detail]\n${backendStderrBuffer.slice(-2000)}`);
    }
    setBackendProcess(null);

    const logFilePath = getLogFilePath();

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
