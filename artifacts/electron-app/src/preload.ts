import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("electronApp", {
  platform: process.platform,
  isElectron: true,
  openInBrowser: (html: string): Promise<string> =>
    ipcRenderer.invoke("open-in-browser", html),
  update: {
    onStatus: (cb: (payload: Record<string, unknown>) => void) => {
      const handler = (_: unknown, payload: Record<string, unknown>) => cb(payload);
      ipcRenderer.on("update:status", handler);
      return () => ipcRenderer.removeListener("update:status", handler);
    },
    getStatus: (): Promise<Record<string, unknown> | null> =>
      ipcRenderer.invoke("update:getStatus"),
    checkNow: (): Promise<void> =>
      ipcRenderer.invoke("update:checkNow"),
    download: () => ipcRenderer.invoke("update:download"),
    install: () => ipcRenderer.invoke("update:install"),
  },
  getVersion: (): Promise<string> => ipcRenderer.invoke("app:getVersion"),
  backup: {
    getFolder: (): Promise<string> =>
      ipcRenderer.invoke("backup:getFolder"),
    chooseFolder: (): Promise<string | null> =>
      ipcRenderer.invoke("backup:chooseFolder"),
    saveManual: (jsonData: string): Promise<{ success: boolean; filePath?: string; message?: string }> =>
      ipcRenderer.invoke("backup:saveManual", jsonData),
    restoreDB: (): Promise<{ success: boolean; canceled?: boolean; message?: string }> =>
      ipcRenderer.invoke("backup:restoreDB"),
  },
  gdrive: {
    getStatus: (): Promise<{
      configured: boolean; connected: boolean; email?: string;
      lastBackupAt?: string; lastError?: string;
    }> => ipcRenderer.invoke("gdrive:getStatus"),
    connect: (): Promise<{ success: boolean; message?: string }> =>
      ipcRenderer.invoke("gdrive:connect"),
    disconnect: (): Promise<void> =>
      ipcRenderer.invoke("gdrive:disconnect"),
    backupNow: (): Promise<{ success: boolean; message?: string }> =>
      ipcRenderer.invoke("gdrive:backupNow"),
    listBackups: (): Promise<{ id: string; name: string; createdTime: string; size: string }[]> =>
      ipcRenderer.invoke("gdrive:listBackups"),
    restoreFromDrive: (fileId: string): Promise<{ success: boolean; message?: string }> =>
      ipcRenderer.invoke("gdrive:restoreFromDrive", fileId),
    onBackupDone: (cb: () => void) => {
      const handler = () => cb();
      ipcRenderer.on("gdrive:backupDone", handler);
      return () => ipcRenderer.removeListener("gdrive:backupDone", handler);
    },
  },
});
