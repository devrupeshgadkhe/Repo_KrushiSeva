/**
 * Auto-Update Service for Krushi Seva ERP
 * Automatically checks for updates from GitHub Releases,
 * detects Windows Desktop (Electron) vs Web App,
 * and seamlessly performs auto-downloads on Windows.
 */

import { ElectronUpdateInfo, ElectronDownloadProgress } from '../types/electron';

export interface UpdateState {
  isElectron: boolean;
  currentVersion: string;
  latestVersion: string | null;
  hasUpdate: boolean;
  checking: boolean;
  downloading: boolean;
  progress: ElectronDownloadProgress | null;
  updateReady: boolean;
  downloadUrl: string | null;
  releaseNotes: string | null;
  error: string | null;
}

type UpdateListener = (state: UpdateState) => void;

class UpdateService {
  private state: UpdateState = {
    isElectron: false,
    currentVersion: '1.0.9',
    latestVersion: null,
    hasUpdate: false,
    checking: false,
    downloading: false,
    progress: null,
    updateReady: false,
    downloadUrl: null,
    releaseNotes: null,
    error: null,
  };

  private listeners: Set<UpdateListener> = new Set();
  private initialized = false;

  constructor() {
    // Detect environment on construction if window exists
    if (typeof window !== 'undefined') {
      this.state.isElectron = !!window.electronAPI?.isElectron;
    }
  }

  public getState(): UpdateState {
    return { ...this.state };
  }

  public subscribe(listener: UpdateListener): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    const currentState = this.getState();
    this.listeners.forEach((listener) => {
      try {
        listener(currentState);
      } catch (e) {
        console.error('Error in update listener', e);
      }
    });
  }

  public isNewerVersion(current: string, latest: string): boolean {
    const cleanCurrent = current.replace(/^v/, '').trim();
    const cleanLatest = latest.replace(/^v/, '').trim();
    if (cleanCurrent === cleanLatest) return false;

    const cParts = cleanCurrent.split('.').map((p) => parseInt(p, 10) || 0);
    const lParts = cleanLatest.split('.').map((p) => parseInt(p, 10) || 0);

    for (let i = 0; i < Math.max(cParts.length, lParts.length); i++) {
      const c = cParts[i] || 0;
      const l = lParts[i] || 0;
      if (l > c) return true;
      if (l < c) return false;
    }
    return false;
  }

  public async init() {
    if (this.initialized) return;
    this.initialized = true;

    this.state.isElectron = typeof window !== 'undefined' && !!window.electronAPI?.isElectron;

    // Get true version from Electron if available
    if (this.state.isElectron && window.electronAPI) {
      try {
        const ver = await window.electronAPI.getAppVersion();
        if (ver) {
          this.state.currentVersion = ver;
        }
      } catch (e) {
        console.warn('Could not read version from electronAPI:', e);
      }

      // Attach electron-updater event listeners
      window.electronAPI.onUpdateAvailable((info: ElectronUpdateInfo) => {
        this.state.hasUpdate = true;
        this.state.latestVersion = info.version;
        this.state.releaseNotes = Array.isArray(info.releaseNotes)
          ? info.releaseNotes.join('\n')
          : info.releaseNotes || null;
        this.state.downloading = true; // Auto download started
        this.notify();
      });

      window.electronAPI.onDownloadProgress((prog: ElectronDownloadProgress) => {
        this.state.downloading = true;
        this.state.progress = prog;
        this.notify();
      });

      window.electronAPI.onUpdateDownloaded((info) => {
        this.state.downloading = false;
        this.state.updateReady = true;
        if (info?.version) {
          this.state.latestVersion = info.version;
        }
        this.notify();
      });

      window.electronAPI.onUpdateError((err) => {
        console.warn('Auto updater error notice:', err.message);
        // Only mark error if we were in the middle of downloading
        if (this.state.downloading) {
          this.state.error = err.message;
          this.state.downloading = false;
          this.notify();
        }
      });
    }

    // Only Windows Desktop (Electron) performs background auto-checking and automatic downloading
    if (this.state.isElectron) {
      // Check immediately shortly after boot
      setTimeout(() => {
        this.checkForUpdates(true);
      }, 3000);

      // And periodic check every 30 minutes
      setInterval(() => {
        this.checkForUpdates(true);
      }, 30 * 60 * 1000);
    }
  }

  /**
   * Check for updates from GitHub Releases
   * If autoDownload is true and running in Windows Desktop (Electron), it triggers download automatically!
   */
  public async checkForUpdates(autoDownload = true): Promise<UpdateState> {
    this.state.checking = true;
    this.state.error = null;
    this.notify();

    try {
      // 1. Fetch latest release from GitHub API
      const res = await fetch('https://api.github.com/repos/devrupeshgadkhe/Repo_KrushiSeva/releases/latest', {
        headers: { Accept: 'application/vnd.github.v3+json' },
      });

      if (res.ok) {
        const data = await res.json();
        const tag = (data.tag_name || '').trim();
        const latestVer = tag.replace(/^v/, '');

        // Find .exe asset for Windows
        let exeDownloadUrl = '';
        if (Array.isArray(data.assets)) {
          const exeAsset = data.assets.find((a: any) =>
            typeof a.name === 'string' && a.name.toLowerCase().endsWith('.exe')
          );
          if (exeAsset) {
            exeDownloadUrl = exeAsset.browser_download_url;
          }
        }

        this.state.latestVersion = latestVer;
        this.state.downloadUrl = exeDownloadUrl;
        this.state.releaseNotes = data.body || '';

        const hasNew = this.isNewerVersion(this.state.currentVersion, latestVer);
        this.state.hasUpdate = hasNew;

        // 2. If running on Windows Desktop (Electron) and update is available:
        // Automatically start downloading without requiring any button click!
        if (hasNew && this.state.isElectron && autoDownload && !this.state.updateReady && !this.state.downloading) {
          this.startAutomaticDownload(exeDownloadUrl, latestVer);
        }
      } else {
        // If GitHub API rate-limited, fallback to electronAPI.checkForUpdates()
        if (this.state.isElectron && window.electronAPI) {
          await window.electronAPI.checkForUpdates();
        }
      }
    } catch (err: any) {
      console.warn('Update check failed:', err);
      if (this.state.isElectron && window.electronAPI) {
        try {
          await window.electronAPI.checkForUpdates();
        } catch (e) {
          // ignore
        }
      }
    } finally {
      this.state.checking = false;
      this.notify();
    }

    return this.getState();
  }

  /**
   * Starts automatic download seamlessly in the background
   */
  public async startAutomaticDownload(downloadUrl: string, version: string) {
    if (!this.state.isElectron || !window.electronAPI) return;

    this.state.downloading = true;
    this.state.error = null;
    this.notify();

    try {
      // If direct asset url is available, use robust direct downloader
      if (downloadUrl && window.electronAPI.downloadAndInstallDirect) {
        await window.electronAPI.downloadAndInstallDirect(downloadUrl, version);
      } else {
        await window.electronAPI.downloadUpdate();
      }
    } catch (e: any) {
      console.error('Automatic update download failed:', e);
      this.state.error = e.message || 'Download error';
      this.state.downloading = false;
      this.notify();
    }
  }

  /**
   * Restarts the app and applies the downloaded update
   */
  public restartAndInstall() {
    if (this.state.isElectron && window.electronAPI) {
      window.electronAPI.quitAndInstall();
    }
  }
}

export const updateService = new UpdateService();
