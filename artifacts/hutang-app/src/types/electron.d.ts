declare global {
  interface Window {
    electronApp?: {
      platform: string;
      isElectron: boolean;
      openInBrowser: (html: string) => Promise<string>;
      getVersion: () => Promise<string>;
      update?: {
        onStatus: (cb: (payload: UpdateStatusPayload) => void) => () => void;
        getStatus: () => Promise<UpdateStatusPayload | null>;
        checkNow: () => Promise<void>;
        download: () => Promise<void>;
        install: () => Promise<void>;
      };
      backup?: {
        getFolder: () => Promise<string>;
        chooseFolder: () => Promise<string | null>;
        saveManual: (jsonData: string) => Promise<{ success: boolean; filePath?: string; message?: string }>;
        restoreDB: () => Promise<{ success: boolean; canceled?: boolean; message?: string }>;
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
