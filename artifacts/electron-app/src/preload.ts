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
  },
});
