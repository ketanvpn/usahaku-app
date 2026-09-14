/**
 * Shared mutable application state.
 *
 * Every module that needs to read or mutate top-level process state
 * (mainWindow, backendProcess, flags, etc.) imports from here.
 * This keeps the coupling explicit and avoids circular dependencies.
 */
import { app } from "electron";
import * as path from "path";

// ── Constants ─────────────────────────────────────────────────────────────────
export const APP_NAME = "Usahaku";
export const APP_ID = "com.ketantech.usahaku";
export const BACKEND_PORT = 8080;
export const FRONTEND_DEV_PORT = process.env.VITE_PORT || "5173";
export const isDev = !app.isPackaged || process.env.NODE_ENV === "development";

// ── Mutable state ─────────────────────────────────────────────────────────────
export let backendProcess: Electron.UtilityProcess | null = null;
export let mainWindow: Electron.BrowserWindow | null = null;
export let backendStderrBuffer = "";
export let isRestoring = false;
export let isQuitting = false;

// Setters — because `export let` re-assignments only work inside the
// declaring module, consumers must call these helpers.
export function setBackendProcess(p: Electron.UtilityProcess | null): void {
  backendProcess = p;
}
export function setMainWindow(w: Electron.BrowserWindow | null): void {
  mainWindow = w;
}
export function setBackendStderrBuffer(s: string): void {
  backendStderrBuffer = s;
}
export function appendBackendStderr(text: string): void {
  backendStderrBuffer += text + "\n";
  if (backendStderrBuffer.length > 4000) {
    backendStderrBuffer = backendStderrBuffer.slice(-4000);
  }
}
export function setIsRestoring(v: boolean): void {
  isRestoring = v;
}
export function setIsQuitting(v: boolean): void {
  isQuitting = v;
}

// ── Derived paths ─────────────────────────────────────────────────────────────
export function getDbPath(): string {
  return path.join(app.getPath("userData"), "app.db");
}
