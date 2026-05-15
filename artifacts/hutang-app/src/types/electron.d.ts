export interface GDriveStatusPayload {
  configured: boolean;
  connected: boolean;
  email?: string;
  lastBackupAt?: string;
  lastError?: string;
}

export interface GDriveBackupFile {
  id: string;
  name: string;
  createdTime: string;
  size: string;
}

declare global {
  interface Window {
    electronApp?: {
      platform: string;
      isElectron: boolean;
      openInBrowser: (html: string) => Promise<string>;
      getVersion: () => Promise<string>;
      // v1.1.4: shortcut API untuk recovery page (juga aman dipakai dari renderer biasa)
      getAppVersion?: () => Promise<string>;
      checkUpdate?: () => Promise<{ available: boolean; version?: string }>;
      downloadUpdate?: () => Promise<{ success: boolean; message?: string }>;
      installUpdate?: () => Promise<void>;
      openUserData?: () => Promise<void>;
      openReleases?: () => Promise<void>;
      quitApp?: () => Promise<void>;
      update?: {
        onStatus: (cb: (payload: UpdateStatusPayload) => void) => () => void;
        getStatus: () => Promise<UpdateStatusPayload | null>;
        checkNow: () => Promise<void>;
        download: () => Promise<void>;
        install: () => Promise<void>;
      };
      backup?: {
        getFolder: () => Promise<string>;
        openFolder: () => Promise<{ success: boolean; message?: string }>;
        chooseFolder: () => Promise<string | null>;
        saveManual: (jsonData: string) => Promise<{ success: boolean; filePath?: string; message?: string }>;
        restoreDB: () => Promise<{ success: boolean; canceled?: boolean; message?: string }>;
      };
      gdrive?: {
        getStatus: () => Promise<GDriveStatusPayload>;
        connect: () => Promise<{ success: boolean; message?: string }>;
        disconnect: () => Promise<void>;
        backupNow: () => Promise<{ success: boolean; message?: string }>;
        listBackups: () => Promise<GDriveBackupFile[]>;
        restoreFromDrive: (fileId: string) => Promise<{ success: boolean; message?: string }>;
        onBackupDone: (cb: () => void) => () => void;
      };
      pengaturan?: {
        saveLogo: (payload: { usahaId: number; data: string; ext: string }) => Promise<{ success: boolean; filename?: string; message?: string }>;
        getLogoData: (usahaId: number, filename: string) => Promise<string | null>;
        deleteLogo: (usahaId: number) => Promise<{ success: boolean; message?: string }>;
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
