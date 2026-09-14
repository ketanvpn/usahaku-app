/**
 * File-based logging for the Electron main process.
 *
 * initLogFile() must be called once at startup (after app is ready).
 * writeLog() appends timestamped lines to both console and the log file.
 */
import { app } from "electron";
import * as fs from "fs";
import * as path from "path";

let logFilePath = "";

export function getLogFilePath(): string {
  return logFilePath;
}

export function initLogFile(): void {
  const userDataDir = app.getPath("userData");
  logFilePath = path.join(userDataDir, "usahaku.log");
  try {
    const timestamp = new Date().toISOString();
    fs.appendFileSync(logFilePath, `\n=== Usahaku started at ${timestamp} ===\n`);
  } catch {
    logFilePath = "";
  }
}

export function writeLog(message: string): void {
  const line = `[${new Date().toISOString()}] ${message}`;
  console.log(line);
  if (logFilePath) {
    try {
      fs.appendFileSync(logFilePath, line + "\n");
    } catch {
    }
  }
}
