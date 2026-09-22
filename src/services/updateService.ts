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
  autoChecking: boolean;
  lastCheckedTime: string | null;
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
    currentVersion: '1.0.14',
    latestVersion: null,
    hasUpdate: false,
    checking: false,
    autoChecking: true,
    lastCheckedTime: null,
    downloading: false,
    progress: null,
    updateReady: false,
    downloadUrl: null,
    releaseNotes: null,
    error: null,
  };

  private listeners: Set<UpdateListener> = new Set();
  private initialized = false;
  private checkIntervalTimer: any = null;

  constructor() {
    // Detect environment on construction if window exists
    if (typeof window !== 'undefined') {
      this.state.isElectron = !!window.electronAPI?.isElectron;
      try {
        const savedLastCheck = localStorage.getItem('krushi_last_update_check_time');
        if (savedLastCheck) {
          this.state.lastCheckedTime = savedLastCheck;
        }
      } catch {
        // ignore
      }
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
    const cleanCurrent = (current || '').replace(/^v/, '').trim();
    const cleanLatest = (latest || '').replace(/^v/, '').trim();
    if (!cleanCurrent || !cleanLatest) return false;
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
          this.notify();
        }
      } catch (e) {
        console.warn('Could not read version from electronAPI:', e);
      }

      // Attach electron-updater event listeners
      window.electronAPI.onUpdateChecking?.(() => {
        this.state.checking = true;
        this.notify();
      });

      window.electronAPI.onUpdateAvailable((info: ElectronUpdateInfo) => {
        this.state.hasUpdate = true;
        this.state.checking = false;
        if (info?.version) {
          this.state.latestVersion = info.version;
        }
        this.state.releaseNotes = Array.isArray(info.releaseNotes)
          ? info.releaseNotes.join('\n')
          : info.releaseNotes || null;
        this.state.downloading = true; // Auto download started
        this.notify();
      });

      window.electronAPI.onUpdateNotAvailable?.((info) => {
        this.state.checking = false;
        if (info?.version) {
          this.state.currentVersion = info.version;
        }
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
        this.state.checking = false;
        // Only mark error if we were in the middle of downloading
        if (this.state.downloading) {
          this.state.error = err.message;
          this.state.downloading = false;
          this.notify();
        }
      });
    }

    // Auto-checking triggers (Continuous Background Update Monitor):
    // 1. Check shortly after launch (1 second)
    setTimeout(() => {
      this.checkForUpdates(true);
    }, 1000);

    // 2. Check continuously every 30 seconds whenever browser/electron is alive
    if (this.checkIntervalTimer) clearInterval(this.checkIntervalTimer);
    this.checkIntervalTimer = setInterval(() => {
      if (typeof navigator === 'undefined' || navigator.onLine) {
        this.checkForUpdates(true);
      }
    }, 30 * 1000);

    // 3. Check whenever browser/electron detects network connection re-established
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        console.log('[UpdateService] Internet connection active, checking for updates...');
        this.checkForUpdates(true);
      });

      // 4. Check whenever window regains user focus
      window.addEventListener('focus', () => {
        this.checkForUpdates(true);
      });

      // 5. Check whenever tab/window becomes visible
      document.addEventListener('visibilitychange', () => {
        if (!document.hidden) {
          this.checkForUpdates(true);
        }
      });
    }
  }

  /**
   * Check for updates from Releases CDN
   * If autoDownload is true and running in Windows Desktop (Electron), it triggers download automatically!
   */
  public async checkForUpdates(autoDownload = true): Promise<UpdateState> {
    if (this.state.downloading || this.state.updateReady || this.state.checking) {
      return this.getState();
    }

    this.state.checking = true;
    this.state.error = null;
    this.notify();

    let foundVersion: string | null = null;
    let foundDownloadUrl: string | null = null;
    let foundNotes: string | null = null;

    try {
      // Endpoint 1: Direct latest.yml from GitHub Releases CDN (FAST, UNLIMITED, NO API RATE LIMIT)
      try {
        const ymlRes = await fetch(
          `https://github.com/devrupeshgadkhe/Repo_KrushiSeva/releases/latest/download/latest.yml?t=${Date.now()}`,
          { cache: 'no-store' }
        );
        if (ymlRes.ok) {
          const ymlText = await ymlRes.text();
          const verMatch = ymlText.match(/version:\s*([^\s\r\n]+)/);
          if (verMatch && verMatch[1]) {
            foundVersion = verMatch[1].trim();
            const pathMatch = ymlText.match(/path:\s*([^\s\r\n]+)/) || ymlText.match(/url:\s*([^\s\r\n]+)/);
            const exeFileName = pathMatch ? pathMatch[1].trim() : `Krushi-Seva-ERP-Setup-${foundVersion}.exe`;
            foundDownloadUrl = `https://github.com/devrupeshgadkhe/Repo_KrushiSeva/releases/download/v${foundVersion}/${exeFileName}`;
            foundNotes = `Release v${foundVersion}`;
          }
        }
      } catch (e) {
        // Fallback to next endpoints
      }

      // Endpoint 2: Raw repository package.json (UNLIMITED)
      if (!foundVersion) {
        try {
          const rawPkgRes = await fetch(
            `https://raw.githubusercontent.com/devrupeshgadkhe/Repo_KrushiSeva/main/package.json?t=${Date.now()}`,
            { cache: 'no-store' }
          );
          if (rawPkgRes.ok) {
            const pkgData = await rawPkgRes.json();
            if (pkgData.version) {
              foundVersion = pkgData.version.trim();
              foundDownloadUrl = `https://github.com/devrupeshgadkhe/Repo_KrushiSeva/releases/download/v${foundVersion}/Krushi-Seva-ERP-Setup-${foundVersion}.exe`;
            }
          }
        } catch (e) {
          // Fallback to GitHub API
        }
      }

      // Endpoint 3: GitHub API
      if (!foundVersion) {
        try {
          const res = await fetch(
            `https://api.github.com/repos/devrupeshgadkhe/Repo_KrushiSeva/releases/latest?t=${Date.now()}`,
            {
              headers: { Accept: 'application/vnd.github.v3+json' },
              cache: 'no-store',
            }
          );
          if (res.ok) {
            const data = await res.json();
            const tag = (data.tag_name || '').trim();
            foundVersion = tag.replace(/^v/, '');
            foundNotes = data.body || '';

            if (Array.isArray(data.assets)) {
              const exeAsset = data.assets.find(
                (a: any) => typeof a.name === 'string' && a.name.toLowerCase().endsWith('.exe')
              );
              if (exeAsset) {
                foundDownloadUrl = exeAsset.browser_download_url;
              }
            }
          }
        } catch (e) {
          // Ignore
        }
      }

      // Also trigger Electron main process autoUpdater
      if (this.state.isElectron && window.electronAPI?.checkForUpdates) {
        window.electronAPI.checkForUpdates().catch(() => {});
      }

      if (foundVersion) {
        this.state.latestVersion = foundVersion;
        if (foundDownloadUrl) this.state.downloadUrl = foundDownloadUrl;
        if (foundNotes) this.state.releaseNotes = foundNotes;

        const hasNew = this.isNewerVersion(this.state.currentVersion, foundVersion);
        this.state.hasUpdate = hasNew;

        // Automatically start downloading if new version is available on Windows Desktop
        if (
          hasNew &&
          this.state.isElectron &&
          autoDownload &&
          !this.state.updateReady &&
          !this.state.downloading
        ) {
          console.log(`[UpdateService] Newer version v${foundVersion} detected. Starting automatic download...`);
          const downloadTarget = foundDownloadUrl || `https://github.com/devrupeshgadkhe/Repo_KrushiSeva/releases/download/v${foundVersion}/Krushi-Seva-ERP-Setup-${foundVersion}.exe`;
          this.startAutomaticDownload(downloadTarget, foundVersion);
        }
      }
    } catch (err: any) {
      console.warn('Update check warning:', err);
    } finally {
      this.state.checking = false;
      this.state.lastCheckedTime = new Date().toISOString();
      try {
        localStorage.setItem('krushi_last_update_check_time', this.state.lastCheckedTime);
      } catch {
        // ignore
      }
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
      console.log(`[UpdateService] Initiating direct background download for v${version}: ${downloadUrl}`);
      // If direct asset url is available, use direct downloader
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
