import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("electronApp", {
  platform: process.platform,
  isElectron: true,
  openInBrowser: (html: string): Promise<string> =>
    ipcRenderer.invoke("open-in-browser", html),
});
