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
    download: () => ipcRenderer.invoke("update:download"),
    install: () => ipcRenderer.invoke("update:install"),
  },
});
