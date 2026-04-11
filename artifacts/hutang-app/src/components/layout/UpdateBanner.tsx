import { useEffect, useState } from "react";
import { Download, RefreshCw, X, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { UpdateStatusPayload } from "@/types/electron";

export function UpdateBanner() {
  const [status, setStatus] = useState<UpdateStatusPayload | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const update = window.electronApp?.update;
    if (!update) return;

    // Ambil status terakhir yang mungkin sudah terjadi sebelum komponen ini mount
    update.getStatus().then((payload) => {
      if (payload && payload.status !== "not-available") {
        setStatus(payload);
      }
    }).catch(() => {});

    // Dengarkan status baru ke depannya
    const unsubscribe = update.onStatus((payload) => {
      setStatus(payload);
      setDismissed(false);
    });
    return unsubscribe;
  }, []);

  if (!status || dismissed) return null;
  if (status.status === "not-available") return null;

  const handleDownload = () => {
    window.electronApp?.update?.download();
  };

  const handleInstall = () => {
    window.electronApp?.update?.install();
  };

  if (status.status === "available") {
    return (
      <div className="bg-emerald-700 text-white px-4 py-2 flex items-center justify-between gap-3 text-sm no-print">
        <div className="flex items-center gap-2">
          <Download className="h-4 w-4 shrink-0" />
          <span>
            Versi baru tersedia: <strong>v{status.version}</strong>
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="secondary"
            className="h-7 text-xs"
            onClick={handleDownload}
          >
            Download Sekarang
          </Button>
          <button
            onClick={() => setDismissed(true)}
            className="opacity-70 hover:opacity-100 transition-opacity"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  }

  if (status.status === "downloading") {
    return (
      <div className="bg-emerald-800 text-white px-4 py-2 flex items-center gap-3 text-sm no-print">
        <RefreshCw className="h-4 w-4 shrink-0 animate-spin" />
        <span>Mengunduh pembaruan... {status.percent}%</span>
        <div className="flex-1 bg-white/20 rounded-full h-1.5 max-w-[200px]">
          <div
            className="bg-white h-1.5 rounded-full transition-all duration-300"
            style={{ width: `${status.percent}%` }}
          />
        </div>
      </div>
    );
  }

  if (status.status === "downloaded") {
    return (
      <div className="bg-emerald-700 text-white px-4 py-2 flex items-center justify-between gap-3 text-sm no-print">
        <div className="flex items-center gap-2">
          <RefreshCw className="h-4 w-4 shrink-0" />
          <span>
            Pembaruan <strong>v{status.version}</strong> siap dipasang — aplikasi akan restart otomatis
          </span>
        </div>
        <Button
          size="sm"
          variant="secondary"
          className="h-7 text-xs"
          onClick={handleInstall}
        >
          Restart &amp; Pasang Sekarang
        </Button>
      </div>
    );
  }

  if (status.status === "error") {
    return (
      <div className="bg-amber-600 text-white px-4 py-2 flex items-center justify-between gap-3 text-sm no-print">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>Gagal cek pembaruan: <span className="opacity-80">{status.message}</span></span>
        </div>
        <button onClick={() => setDismissed(true)} className="opacity-70 hover:opacity-100 transition-opacity">
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return null;
}
