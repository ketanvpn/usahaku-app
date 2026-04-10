import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("electronApp", {
  platform: process.platform,
  isElectron: true,
  print: (): Promise<void> => ipcRenderer.invoke("print-page"),
});
