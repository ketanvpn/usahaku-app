declare global {
  interface Window {
    electronApp?: {
      platform: string;
      isElectron: boolean;
      openInBrowser: (html: string) => Promise<string>;
      update?: {
        onStatus: (cb: (payload: UpdateStatusPayload) => void) => () => void;
        download: () => Promise<void>;
        install: () => Promise<void>;
      };
    };
  }
}

export interface UpdateStatusPayload {
  status: "available" | "not-available" | "downloading" | "downloaded" | "error";
  version?: string;
  percent?: number;
  message?: string;
}
