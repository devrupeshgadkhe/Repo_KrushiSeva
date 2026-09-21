export interface ElectronUpdateInfo {
  version: string;
  releaseDate?: string;
  releaseNotes?: string | string[];
  downloadUrl?: string;
}

export interface ElectronDownloadProgress {
  percent: number;
  transferred: number;
  total: number;
  bytesPerSecond: number;
}

export interface ElectronAPI {
  isElectron: boolean;
  getAppVersion: () => Promise<string>;
  checkForUpdates: () => Promise<{ status: string; updateInfo?: any; message?: string; version?: string }>;
  downloadUpdate: () => Promise<{ status: string; message?: string }>;
  downloadAndInstallDirect?: (downloadUrl: string, version: string) => Promise<{ status: string; message?: string }>;
  quitAndInstall: () => Promise<void>;
  sendCloudBackup?: (payload: any) => Promise<{ success: boolean; status?: number; message?: string; localSaved?: boolean; cloudSaved?: boolean }>;

  onUpdateChecking: (callback: (data: any) => void) => () => void;
  onUpdateAvailable: (callback: (info: ElectronUpdateInfo) => void) => () => void;
  onUpdateNotAvailable: (callback: (data: { version: string }) => void) => () => void;
  onUpdateError: (callback: (data: { message: string }) => void) => () => void;
  onDownloadProgress: (callback: (progress: ElectronDownloadProgress) => void) => () => void;
  onUpdateDownloaded: (callback: (info: { version: string }) => void) => () => void;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}
