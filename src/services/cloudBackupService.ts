import { exportDatabaseJSON, downloadDatabaseJSONFile, FullDatabaseBackupJSON } from '../db/sqliteEngine';

export interface CloudBackupState {
  lastBackupTime: string | null;
  status: 'idle' | 'syncing' | 'success' | 'failed';
  localSaved: boolean;
  cloudSaved: boolean;
  totalRecordsBackedUp: number;
  lastError: string | null;
}

// Google Apps Script Web App endpoint and target account configured privately (never exposed on UI)
const DEFAULT_CLOUD_BACKUP_ENDPOINT = 'https://script.google.com/macros/s/AKfycbyAYKVB5xsVTtyKjQv1R-9sSRKsCJo8VZFHZPgqCaKOHZYpbRQJI_PgFvGACKZ32r8/exec';
const BACKUP_ACCOUNT_EMAIL = 'pradipayanbackup@gmail.com';

const STORAGE_LAST_BACKUP_TIME = 'krushi_last_auto_backup_timestamp';
const STORAGE_LAST_BACKUP_STATUS = 'krushi_last_auto_backup_status';
const STORAGE_LAST_RECORD_COUNT = 'krushi_last_auto_backup_record_count';
const STORAGE_GAS_URL = 'krushi_gas_backup_url';

class CloudBackupService {
  private state: CloudBackupState = {
    lastBackupTime: null,
    status: 'idle',
    localSaved: true,
    cloudSaved: false,
    totalRecordsBackedUp: 0,
    lastError: null,
  };

  private listeners: Set<(state: CloudBackupState) => void> = new Set();
  private debounceTimer: any = null;
  private intervalTimer: any = null;
  private lastTriggeredAt = 0;
  private initialized = false;

  constructor() {
    this.restoreSavedState();
  }

  public getGASUrl(): string {
    try {
      const customUrl = localStorage.getItem(STORAGE_GAS_URL);
      if (customUrl && customUrl.trim().startsWith('http')) {
        return customUrl.trim();
      }
    } catch {
      // Ignore
    }
    return DEFAULT_CLOUD_BACKUP_ENDPOINT;
  }

  public setGASUrl(url: string): void {
    try {
      if (!url || !url.trim()) {
        localStorage.removeItem(STORAGE_GAS_URL);
      } else {
        localStorage.setItem(STORAGE_GAS_URL, url.trim());
      }
    } catch {
      // Ignore
    }
  }

  public getTargetEmail(): string {
    return BACKUP_ACCOUNT_EMAIL;
  }

  private restoreSavedState() {
    try {
      const savedTime = localStorage.getItem(STORAGE_LAST_BACKUP_TIME);
      const savedStatus = localStorage.getItem(STORAGE_LAST_BACKUP_STATUS) as CloudBackupState['status'] | null;
      const savedCount = localStorage.getItem(STORAGE_LAST_RECORD_COUNT);

      if (savedTime) {
        this.state.lastBackupTime = savedTime;
        this.state.status = (savedStatus === 'success' || savedStatus === 'failed') ? savedStatus : 'idle';
        this.state.cloudSaved = savedStatus === 'success';
        this.state.totalRecordsBackedUp = savedCount ? parseInt(savedCount, 10) : 0;
      }
    } catch {
      // Storage unavailable or blocked
    }
  }

  public init() {
    if (this.initialized) return;
    this.initialized = true;

    // Automatic check 12 seconds after startup to ensure smooth initial loading
    setTimeout(() => {
      this.triggerBackup(false).catch(console.warn);
    }, 12000);

    // Periodic automatic backup every 2 hours
    this.intervalTimer = setInterval(() => {
      this.triggerBackup(false).catch(console.warn);
    }, 2 * 60 * 60 * 1000);

    // Auto-sync when internet reconnects
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        setTimeout(() => {
          this.triggerBackup(false).catch(console.warn);
        }, 5000);
      });
    }
  }

  public getState(): CloudBackupState {
    return { ...this.state };
  }

  public subscribe(listener: (state: CloudBackupState) => void): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => this.listeners.delete(listener);
  }

  private notify() {
    const currentState = this.getState();
    this.listeners.forEach((listener) => {
      try {
        listener(currentState);
      } catch (err) {
        console.error('Error in cloud backup state subscriber:', err);
      }
    });
  }

  /**
   * Triggers an automated backup.
   * Debounced to prevent excessive calls during rapid billing entries.
   */
  public async triggerBackup(immediate = false): Promise<boolean> {
    const now = Date.now();
    // Debounce: if not immediate, wait at least 3 minutes between auto-triggers
    if (!immediate && now - this.lastTriggeredAt < 3 * 60 * 1000) {
      if (!this.debounceTimer) {
        this.debounceTimer = setTimeout(() => {
          this.debounceTimer = null;
          this.executeBackup().catch(console.warn);
        }, 3 * 60 * 1000);
      }
      return true;
    }

    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }

    this.lastTriggeredAt = now;
    return this.executeBackup();
  }

  private async executeBackup(): Promise<boolean> {
    this.state.status = 'syncing';
    this.state.lastError = null;
    this.notify();

    try {
      // 1. Generate full database snapshot in JSON format
      const backupJSON: FullDatabaseBackupJSON = await exportDatabaseJSON();
      const totalRecords = Object.values(backupJSON.tableCounts).reduce((a, b) => a + b, 0);
      const jsonContent = JSON.stringify(backupJSON, null, 2);
      const timestampIso = new Date().toISOString();
      const filename = `krushi_seva_erp_backup_${timestampIso.slice(0, 10)}.json`;

      // 2. Cache in local storage for fast offline reference
      try {
        localStorage.setItem('krushi_last_json_backup_cache_time', timestampIso);
        localStorage.setItem(STORAGE_LAST_RECORD_COUNT, String(totalRecords));
      } catch {
        // quota exceeded or private mode
      }

      // 3. Prepare payload for cloud delivery
      const targetGasUrl = this.getGASUrl();
      const payload = {
        action: 'save_database_backup',
        filename,
        appName: 'Krushi Seva ERP',
        targetEmail: BACKUP_ACCOUNT_EMAIL,
        gasUrl: targetGasUrl,
        exportedAt: timestampIso,
        timestamp: Date.now(),
        totalRecords,
        tableCounts: backupJSON.tableCounts,
        data: backupJSON,
        content: jsonContent,
      };

      let localSaved = true;
      let cloudSaved = false;
      let message = '';

      // 4. Send via Electron Desktop IPC if available (with filesystem save and direct https)
      if (window.electronAPI && typeof window.electronAPI.sendCloudBackup === 'function') {
        const res = await window.electronAPI.sendCloudBackup(payload);
        localSaved = res.localSaved ?? true;
        cloudSaved = res.cloudSaved ?? false;
        message = res.message || '';
      } else {
        // Web Environment Fallback: Send to Google Apps Script Web App
        try {
          await fetch(targetGasUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'text/plain;charset=utf-8',
            },
            body: JSON.stringify(payload),
            mode: 'no-cors',
          });
          cloudSaved = true;
          message = 'Cloud backup request dispatched';
        } catch (fetchErr: any) {
          console.warn('Web cloud backup transmission issue:', fetchErr);
          message = fetchErr?.message || 'Cloud backup transmission failed';
        }
      }

      this.state.status = (localSaved || cloudSaved) ? 'success' : 'failed';
      this.state.localSaved = localSaved;
      this.state.cloudSaved = cloudSaved;
      this.state.lastBackupTime = timestampIso;
      this.state.totalRecordsBackedUp = totalRecords;
      this.state.lastError = cloudSaved ? null : (message || 'Cloud sync error');

      try {
        localStorage.setItem(STORAGE_LAST_BACKUP_TIME, timestampIso);
        localStorage.setItem(STORAGE_LAST_BACKUP_STATUS, this.state.status);
      } catch {
        // ignore storage error
      }

      this.notify();
      return localSaved || cloudSaved;
    } catch (err: any) {
      console.error('Automated backup execution error:', err);
      this.state.status = 'failed';
      this.state.lastError = err?.message || 'Backup failed';
      this.notify();
      return false;
    }
  }

  public async syncNow(): Promise<{ success: boolean; localSaved: boolean; cloudSaved: boolean; message: string }> {
    await this.executeBackup();
    return {
      success: this.state.status === 'success',
      localSaved: this.state.localSaved,
      cloudSaved: this.state.cloudSaved,
      message: this.state.lastError || (this.state.cloudSaved ? 'Google Drive व स्थानिक बॅकअप यशस्वी' : 'स्थानिक बॅकअप यशस्वी, गुगल ड्राईव्ह प्रलंबित'),
    };
  }

  public async downloadJSONBackup(): Promise<void> {
    return downloadDatabaseJSONFile();
  }
}

export const cloudBackupService = new CloudBackupService();
