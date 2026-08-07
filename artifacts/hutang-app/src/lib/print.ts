export function openPrintWindow(html: string) {
  if (window.electronApp?.isElectron && typeof window.electronApp.openInBrowser === "function") {
    window.electronApp.openInBrowser(html);
  } else {
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const tab = window.open(url, "_blank");
    if (tab) {
      tab.addEventListener("load", () => setTimeout(() => URL.revokeObjectURL(url), 2000));
    }
  }
}
