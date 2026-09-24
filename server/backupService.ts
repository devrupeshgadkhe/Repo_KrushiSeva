import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import crypto from 'crypto';
import { google } from 'googleapis';
import initSqlJs, { Database } from 'sql.js';

export interface BackupMetadata {
  backup_version: string;
  app_version: string;
  database_name: string;
  created_at: string;
  timestamp: number;
  tables: string[];
  table_counts: Record<string, number>;
  total_records: number;
  checksum: string;
  is_encrypted: boolean;
  is_compressed: boolean;
}

export interface StructuredDatabaseBackup {
  metadata: BackupMetadata;
  tables: Record<string, any[]>;
}

export interface BackupLogEntry {
  id: string;
  start_time: string;
  completion_time: string;
  duration_ms: number;
  status: 'SUCCESS' | 'FAILED' | 'SKIPPED_NO_CHANGE' | 'LOCAL_SAVED';
  file_name: string;
  file_size_bytes: number;
  file_size_formatted: string;
  drive_file_id?: string;
  drive_folder_id?: string;
  total_records: number;
  tables_count: number;
  checksum: string;
  is_encrypted: boolean;
  is_compressed: boolean;
  error_message?: string;
  retry_attempt?: number;
  next_backup_time?: string;
}

export interface BackupStatusSummary {
  enabled: boolean;
  last_backup_time: string | null;
  last_backup_status: 'SUCCESS' | 'FAILED' | 'SKIPPED_NO_CHANGE' | 'NEVER_RUN' | 'LOCAL_SAVED' | 'STANDBY';
  last_file_name: string | null;
  last_file_size: string | null;
  last_drive_file_id: string | null;
  last_error: string | null;
  next_backup_time: string | null;
  total_backups_count: number;
  retention_days: number;
  interval_hours: number;
  configured_account: string;
  is_configured: boolean;
  folder_id: string | null;
}

class GoogleDriveBackupService {
  private dbPath: string;
  private logsPath: string;
  private lastDataHash: string | null = null;
  private isBackupRunning = false;
  private intervalTimer: NodeJS.Timeout | null = null;
  private retryTimer: NodeJS.Timeout | null = null;
  private retryCount = 0;
  private readonly MAX_RETRIES = parseInt(process.env.BACKUP_MAX_RETRIES || '3', 10);
  private nextScheduledRun: Date | null = null;
  private SQL: any = null;

  constructor() {
    this.dbPath = process.env.SQLITE_DB_PATH || path.resolve(process.cwd(), 'data', 'krushi_seva_erp.db');
    this.logsPath = path.resolve(process.cwd(), 'data', 'backup_logs.json');
    this.ensureDataDirectories();
    this.loadLastHashFromLogs();
  }

  private ensureDataDirectories() {
    const dataDir = path.dirname(this.dbPath);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    const logsDir = path.dirname(this.logsPath);
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }
  }

  private loadLastHashFromLogs() {
    try {
      const logs = this.readLogs();
      const lastSuccess = logs.find((l) => l.status === 'SUCCESS');
      if (lastSuccess && lastSuccess.checksum) {
        this.lastDataHash = lastSuccess.checksum;
      }
    } catch {
      // Ignore
    }
  }

  public updateCredentials(email: string, privateKey: string, folderId?: string): void {
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL = email.trim();
    process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY = privateKey.trim();
    if (folderId !== undefined) {
      process.env.GOOGLE_DRIVE_FOLDER_ID = folderId.trim();
    }
    console.log('[GoogleDriveBackup] Credentials updated dynamically. Service Account is now active.');
  }

  public isConfigured(): boolean {
    const gasUrl = process.env.GOOGLE_APPS_SCRIPT_URL?.trim();
    if (gasUrl && gasUrl.startsWith('http')) return true;

    const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim();
    const key = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.trim();
    return !!(
      email &&
      key &&
      !email.includes('your-service-account') &&
      !email.includes('your-project') &&
      key.includes('BEGIN PRIVATE KEY')
    );
  }

  /**
   * Initializes the automatic background scheduler.
   */
  public async init(): Promise<void> {
    const isEnabled = (process.env.BACKUP_ENABLED ?? 'true').toLowerCase() === 'true';
    if (!isEnabled) {
      console.log('[GoogleDriveBackup] Backup service is disabled via BACKUP_ENABLED=false');
      return;
    }

    console.log('[GoogleDriveBackup] Initializing Google Drive Automatic Backup Service...');

    if (!this.isConfigured()) {
      console.log(
        '[GoogleDriveBackup] Notice: Service Account credentials not yet configured in .env. Backup scheduler is on standby.'
      );
    }

    // Option to perform an initial backup on startup if configured and credentials are present
    const runOnStartup = (process.env.BACKUP_ON_STARTUP ?? 'true').toLowerCase() === 'true';
    if (runOnStartup && this.isConfigured()) {
      // Wait 15 seconds after server start to avoid any startup contention
      setTimeout(() => {
        console.log('[GoogleDriveBackup] Triggering initial startup backup check...');
        this.runBackupCycle(0).catch((err) => {
          console.warn('[GoogleDriveBackup] Startup backup attempt caught error:', err.message);
        });
      }, 15000);
    }

    // Configure interval in hours (default: 24 hours)
    const intervalHours = parseFloat(process.env.BACKUP_INTERVAL_HOURS || '24');
    const intervalMs = Math.max(1, intervalHours) * 60 * 60 * 1000;

    this.calculateNextRun(intervalMs);

    if (this.intervalTimer) clearInterval(this.intervalTimer);
    this.intervalTimer = setInterval(() => {
      this.calculateNextRun(intervalMs);
      if (this.isConfigured()) {
        this.runBackupCycle(0).catch((err) => {
          console.warn('[GoogleDriveBackup] Scheduled backup cycle caught error:', err.message);
        });
      }
    }, intervalMs);

    console.log(`[GoogleDriveBackup] Scheduler active: will run every ${intervalHours} hour(s). Next run at: ${this.nextScheduledRun?.toISOString()}`);
  }

  private calculateNextRun(intervalMs: number) {
    this.nextScheduledRun = new Date(Date.now() + intervalMs);
  }

  /**
   * Authenticates with Google Drive API using a Service Account JWT.
   */
  private getDriveClient() {
    const serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    let privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;

    if (!serviceAccountEmail || !privateKey) {
      throw new Error(
        'Missing Google Service Account credentials. Set GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY in .env'
      );
    }

    // Format multiline private key if escaped with \n in .env
    if (privateKey.includes('\\n')) {
      privateKey = privateKey.replace(/\\n/g, '\n');
    }

    const auth = new google.auth.JWT({
      email: serviceAccountEmail,
      key: privateKey,
      scopes: ['https://www.googleapis.com/auth/drive'],
    });

    return google.drive({ version: 'v3', auth });
  }

  /**
   * Resolves or automatically creates the dedicated backup folder in Google Drive.
   */
  private async getOrCreateBackupFolder(drive: ReturnType<typeof google.drive>): Promise<string> {
    // 1. If explicit folder ID provided in environment, verify existence
    const explicitFolderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
    if (explicitFolderId && explicitFolderId.trim()) {
      return explicitFolderId.trim();
    }

    const folderName = 'Krushi_Seva_ERP_Backups';

    // 2. Search for existing folder with that name
    const searchRes = await drive.files.list({
      q: `mimeType = 'application/vnd.google-apps.folder' and name = '${folderName}' and trashed = false`,
      fields: 'files(id, name)',
      spaces: 'drive',
    });

    if (searchRes.data.files && searchRes.data.files.length > 0) {
      return searchRes.data.files[0].id!;
    }

    // 3. Create folder automatically if it doesn't already exist
    console.log(`[GoogleDriveBackup] Creating dedicated backup folder "${folderName}" in Google Drive...`);
    const createRes = await drive.files.create({
      requestBody: {
        name: folderName,
        mimeType: 'application/vnd.google-apps.folder',
        description: 'Automated SQLite database backups for Krushi Seva ERP',
      },
      fields: 'id',
    });

    if (!createRes.data.id) {
      throw new Error('Failed to create backup folder in Google Drive');
    }

    return createRes.data.id;
  }

  /**
   * Safely reads the SQLite database without locking it.
   * Reads the binary file and loads via sql.js to inspect tables and data.
   */
  public async readDatabaseData(): Promise<{ tables: Record<string, any[]>; tableCounts: Record<string, number>; totalRecords: number }> {
    if (!fs.existsSync(this.dbPath)) {
      // If database file does not exist yet on disk, return empty tables structure
      return { tables: {}, tableCounts: {}, totalRecords: 0 };
    }

    if (!this.SQL) {
      this.SQL = await initSqlJs();
    }

    // Read database file buffer directly (safe snapshot in memory)
    const fileBuffer = fs.readFileSync(this.dbPath);
    if (fileBuffer.length === 0) {
      return { tables: {}, tableCounts: {}, totalRecords: 0 };
    }

    const db: Database = new this.SQL.Database(fileBuffer);
    const tables: Record<string, any[]> = {};
    const tableCounts: Record<string, number> = {};
    let totalRecords = 0;

    try {
      // Query table names, excluding internal sqlite tables
      const tableQuery = db.exec(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE 'schema_migrations' ORDER BY name ASC;"
      );

      const tableNames: string[] = [];
      if (tableQuery.length > 0 && tableQuery[0].values) {
        for (const row of tableQuery[0].values) {
          if (row[0]) tableNames.push(String(row[0]));
        }
      }

      for (const name of tableNames) {
        try {
          const res = db.exec(`SELECT * FROM "${name}";`);
          if (res.length > 0 && res[0].columns && res[0].values) {
            const cols = res[0].columns;
            const rows = res[0].values.map((valRow) => {
              const rowObj: Record<string, any> = {};
              cols.forEach((col, idx) => {
                rowObj[col] = valRow[idx];
              });
              return rowObj;
            });
            tables[name] = rows;
            tableCounts[name] = rows.length;
            totalRecords += rows.length;
          } else {
            tables[name] = [];
            tableCounts[name] = 0;
          }
        } catch (tableErr: any) {
          console.warn(`[GoogleDriveBackup] Warning reading table ${name}:`, tableErr.message);
          tables[name] = [];
          tableCounts[name] = 0;
        }
      }
    } finally {
      db.close();
    }

    return { tables, tableCounts, totalRecords };
  }

  /**
   * Generates a structured JSON backup from the database tables.
   */
  public async generateStructuredBackup(): Promise<StructuredDatabaseBackup> {
    const { tables, tableCounts, totalRecords } = await this.readDatabaseData();
    const now = new Date();
    const dataString = JSON.stringify(tables);
    const checksum = crypto.createHash('sha256').update(dataString).digest('hex');

    const metadata: BackupMetadata = {
      backup_version: '1.0',
      app_version: process.env.npm_package_version || '1.0.17',
      database_name: path.basename(this.dbPath),
      created_at: now.toISOString(),
      timestamp: now.getTime(),
      tables: Object.keys(tables),
      table_counts: tableCounts,
      total_records: totalRecords,
      checksum,
      is_encrypted: !!process.env.BACKUP_ENCRYPTION_KEY,
      is_compressed: true,
    };

    return {
      metadata,
      tables,
    };
  }

  /**
   * Compresses and optionally encrypts the backup payload.
   */
  private prepareBackupBuffer(backupJson: StructuredDatabaseBackup): { buffer: Buffer; fileName: string; isEncrypted: boolean } {
    const jsonStr = JSON.stringify(backupJson, null, 2);
    const jsonBuffer = Buffer.from(jsonStr, 'utf8');

    // Extract registered Firm Name from business_settings table
    let firmName = 'Krushi_Seva_ERP';
    const businessRows = backupJson.tables['business_settings'];
    if (Array.isArray(businessRows) && businessRows.length > 0) {
      const setting = businessRows[0];
      const raw = setting.shop_name || setting.shop_name_mr;
      if (raw && typeof raw === 'string' && raw.trim().length > 0) {
        firmName = raw.trim().replace(/[/\\?%*:|"<>]/g, '').replace(/\s+/g, '_');
      }
    }

    // Date-time formatted stamp: YYYY-MM-DD_HH-mm-ss
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const dateStamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;

    const encryptionKey = process.env.BACKUP_ENCRYPTION_KEY;
    if (encryptionKey && encryptionKey.trim().length >= 16) {
      // Encrypt with AES-256-GCM
      const key = crypto.createHash('sha256').update(encryptionKey).digest();
      const iv = crypto.randomBytes(12);
      const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

      const encrypted = Buffer.concat([cipher.update(jsonBuffer), cipher.final()]);
      const authTag = cipher.getAuthTag();

      // Combined format: [12 bytes IV] + [16 bytes Auth Tag] + [Encrypted Data]
      const encryptedPayload = Buffer.concat([iv, authTag, encrypted]);

      const shouldCompress = (process.env.BACKUP_COMPRESS ?? 'false').toLowerCase() === 'true';
      if (shouldCompress) {
        const compressed = zlib.gzipSync(encryptedPayload);
        const fileName = `${firmName}_${dateStamp}.enc.gz`;
        return { buffer: compressed, fileName, isEncrypted: true };
      }
      const fileName = `${firmName}_${dateStamp}.enc.json`;
      return { buffer: encryptedPayload, fileName, isEncrypted: true };
    }

    // Standard JSON backup (named with the Firm's name)
    const shouldCompress = (process.env.BACKUP_COMPRESS ?? 'false').toLowerCase() === 'true';
    const includeDate = (process.env.BACKUP_INCLUDE_DATE ?? 'true').toLowerCase() === 'true';

    if (shouldCompress) {
      const compressed = zlib.gzipSync(jsonBuffer);
      const fileName = includeDate ? `${firmName}_${dateStamp}.json.gz` : `${firmName}.json.gz`;
      return { buffer: compressed, fileName, isEncrypted: false };
    }

    // Raw formatted .json backup as requested: <FirmName>_<Date>.json or <FirmName>.json
    const fileName = includeDate ? `${firmName}_${dateStamp}.json` : `${firmName}.json`;
    return { buffer: jsonBuffer, fileName, isEncrypted: false };
  }

  /**
   * Enforces retention policy: deletes backups older than BACKUP_RETENTION_DAYS
   * from the dedicated backup folder ONLY.
   */
  private async applyRetentionPolicy(drive: ReturnType<typeof google.drive>, folderId: string) {
    const retentionDays = parseInt(process.env.BACKUP_RETENTION_DAYS || '30', 10);
    if (retentionDays <= 0) return;

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
    const cutoffIso = cutoffDate.toISOString();

    try {
      // Only query backup files directly inside the dedicated folder
      const listRes = await drive.files.list({
        q: `'${folderId}' in parents and trashed = false and (name contains '.json' or name contains '.gz') and createdTime < '${cutoffIso}'`,
        fields: 'files(id, name, createdTime)',
        spaces: 'drive',
      });

      if (listRes.data.files && listRes.data.files.length > 0) {
        console.log(`[GoogleDriveBackup] Found ${listRes.data.files.length} backup file(s) older than ${retentionDays} days to prune.`);
        for (const file of listRes.data.files) {
          if (file.id) {
            try {
              await drive.files.delete({ fileId: file.id });
              console.log(`[GoogleDriveBackup] Pruned old backup: ${file.name} (${file.id})`);
            } catch (delErr: any) {
              console.warn(`[GoogleDriveBackup] Failed to prune ${file.name}:`, delErr.message);
            }
          }
        }
      }
    } catch (retentionErr: any) {
      console.warn('[GoogleDriveBackup] Retention policy check note:', retentionErr.message);
    }
  }

  /**
   * Executes a complete backup cycle with retry logic.
   */
  public async runBackupCycle(retryAttempt = 0): Promise<BackupLogEntry> {
    if (this.isBackupRunning) {
      console.log('[GoogleDriveBackup] Backup already in progress, skipping duplicate invocation.');
      return {
        id: crypto.randomUUID(),
        start_time: new Date().toISOString(),
        completion_time: new Date().toISOString(),
        duration_ms: 0,
        status: 'SKIPPED_NO_CHANGE',
        file_name: 'IN_PROGRESS',
        file_size_bytes: 0,
        file_size_formatted: '0 B',
        total_records: 0,
        tables_count: 0,
        checksum: '',
        is_encrypted: false,
        is_compressed: false,
        error_message: 'Backup is already running',
      };
    }

    this.isBackupRunning = true;
    const startTime = new Date();
    const logId = crypto.randomUUID();

    try {
      console.log(`[GoogleDriveBackup] Starting backup cycle (Attempt ${retryAttempt + 1}/${this.MAX_RETRIES + 1})...`);

      // 1. Generate structured backup
      const backupData = await this.generateStructuredBackup();
      const currentChecksum = backupData.metadata.checksum;

      // 2. Prevent duplicate uploads if database content has not changed
      if (this.lastDataHash && this.lastDataHash === currentChecksum && retryAttempt === 0) {
        console.log('[GoogleDriveBackup] Database content unchanged since last successful backup. Skipping upload.');
        const entry: BackupLogEntry = {
          id: logId,
          start_time: startTime.toISOString(),
          completion_time: new Date().toISOString(),
          duration_ms: Date.now() - startTime.getTime(),
          status: 'SKIPPED_NO_CHANGE',
          file_name: 'SKIPPED_UNCHANGED',
          file_size_bytes: 0,
          file_size_formatted: '0 B',
          total_records: backupData.metadata.total_records,
          tables_count: backupData.metadata.tables.length,
          checksum: currentChecksum,
          is_encrypted: backupData.metadata.is_encrypted,
          is_compressed: true,
          next_backup_time: this.nextScheduledRun?.toISOString(),
        };
        this.writeLog(entry);
        this.isBackupRunning = false;
        return entry;
      }

      // 3. Check if Google Drive credentials are configured
      if (!this.isConfigured()) {
        console.log('[GoogleDriveBackup] Standby: Service Account credentials not yet set in .env. Backup is on standby awaiting configuration.');
        this.isBackupRunning = false;
        return {
          id: logId,
          start_time: startTime.toISOString(),
          completion_time: new Date().toISOString(),
          duration_ms: Date.now() - startTime.getTime(),
          status: 'SKIPPED_NO_CHANGE',
          file_name: 'STANDBY_AWAITING_CONFIG',
          file_size_bytes: 0,
          file_size_formatted: '0 B',
          total_records: backupData.metadata.total_records,
          tables_count: backupData.metadata.tables.length,
          checksum: currentChecksum,
          is_encrypted: backupData.metadata.is_encrypted,
          is_compressed: true,
          error_message: undefined,
          next_backup_time: this.nextScheduledRun?.toISOString(),
        };
      }

      // 4. Compress & optionally encrypt
      const { buffer, fileName, isEncrypted } = this.prepareBackupBuffer(backupData);
      const fileSize = buffer.length;
      const formattedSize = this.formatBytes(fileSize);

      // Always save a local copy in ./data/backups/
      try {
        const localBackupsDir = path.resolve(process.cwd(), 'data', 'backups');
        if (!fs.existsSync(localBackupsDir)) {
          fs.mkdirSync(localBackupsDir, { recursive: true });
        }
        const localBackupPath = path.join(localBackupsDir, fileName);
        fs.writeFileSync(localBackupPath, buffer);
        console.log(`[GoogleDriveBackup] Local backup safely stored at ${localBackupPath} (${formattedSize})`);
      } catch (localErr: any) {
        console.warn('[GoogleDriveBackup] Could not save local backup copy:', localErr.message);
      }

      // 5. Connect and Upload to Cloud
      let driveFileId: string | undefined = undefined;
      let effectiveFolderId = process.env.GOOGLE_DRIVE_FOLDER_ID?.trim() || '1SHObwtgz_eXHVNhDUDbtJWvA75E96RA8';
      let uploadStatus: 'SUCCESS' | 'LOCAL_SAVED' = 'SUCCESS';
      const gasUrl = process.env.GOOGLE_APPS_SCRIPT_URL?.trim();

      if (gasUrl && gasUrl.startsWith('http')) {
        console.log(`[GoogleDriveBackup] Uploading ${fileName} via Google Apps Script Web App...`);
        const res = await fetch(gasUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({
            action: 'save_database_backup',
            filename: fileName,
            folderId: effectiveFolderId,
            content: buffer.toString('utf8'),
            isEncrypted,
          }),
        });
        const resText = await res.text();
        let jsonRes: any = {};
        try {
          jsonRes = JSON.parse(resText);
        } catch {}

        if (!res.ok || jsonRes.success === false) {
          throw new Error(jsonRes.error || `Apps Script upload failed: HTTP ${res.status}`);
        }

        driveFileId = jsonRes.id || 'gas_uploaded';
        console.log(`[GoogleDriveBackup] Successfully uploaded ${fileName} to Google Drive via Apps Script (ID: ${driveFileId})`);
      } else {
        // Direct Service Account Google Drive API
        try {
          const drive = this.getDriveClient();
          effectiveFolderId = await this.getOrCreateBackupFolder(drive);

          const { Readable } = await import('stream');
          const stream = new Readable();
          stream.push(buffer);
          stream.push(null);

          const uploadRes = await drive.files.create({
            supportsAllDrives: true,
            requestBody: {
              name: fileName,
              parents: [effectiveFolderId],
              description: `Krushi Seva ERP SQLite Backup | Records: ${backupData.metadata.total_records} | Encrypted: ${isEncrypted}`,
            },
            media: {
              mimeType: isEncrypted
                ? 'application/octet-stream'
                : fileName.endsWith('.gz')
                ? 'application/gzip'
                : 'application/json',
              body: stream,
            },
            fields: 'id, name, size',
          });

          driveFileId = uploadRes.data.id || undefined;
          console.log(`[GoogleDriveBackup] Successfully uploaded ${fileName} to Google Drive (ID: ${driveFileId}, Size: ${formattedSize})`);

          // Prune old backups per retention policy
          await this.applyRetentionPolicy(drive, effectiveFolderId);
        } catch (driveErr: any) {
          const isQuotaError =
            driveErr.message?.includes('storage quota') ||
            driveErr.message?.includes('Service Accounts do not have storage quota');

          if (isQuotaError) {
            console.info(
              `[GoogleDriveBackup] Backup ${fileName} safely stored locally. (Note: Personal @gmail.com Drive sync requires Google Apps Script Web App URL due to Google's 0-quota policy on free Service Accounts).`
            );
            uploadStatus = 'LOCAL_SAVED';
            driveFileId = 'local_disk_safe';
          } else {
            throw driveErr;
          }
        }
      }

      // 7. Record success
      this.lastDataHash = currentChecksum;
      this.retryCount = 0;

      const successEntry: BackupLogEntry = {
        id: logId,
        start_time: startTime.toISOString(),
        completion_time: new Date().toISOString(),
        duration_ms: Date.now() - startTime.getTime(),
        status: uploadStatus as any,
        file_name: fileName,
        file_size_bytes: fileSize,
        file_size_formatted: formattedSize,
        drive_file_id: driveFileId,
        drive_folder_id: effectiveFolderId,
        total_records: backupData.metadata.total_records,
        tables_count: backupData.metadata.tables.length,
        checksum: currentChecksum,
        is_encrypted: isEncrypted,
        is_compressed: true,
        next_backup_time: this.nextScheduledRun?.toISOString(),
      };

      this.writeLog(successEntry);
      return successEntry;
    } catch (err: any) {
      const duration = Date.now() - startTime.getTime();
      const errorMessage = err.message || 'Unknown backup error';
      console.warn(`[GoogleDriveBackup] Backup notice on attempt ${retryAttempt + 1}:`, errorMessage);

      const failEntry: BackupLogEntry = {
        id: logId,
        start_time: startTime.toISOString(),
        completion_time: new Date().toISOString(),
        duration_ms: duration,
        status: 'FAILED',
        file_name: 'FAILED_BACKUP',
        file_size_bytes: 0,
        file_size_formatted: '0 B',
        total_records: 0,
        tables_count: 0,
        checksum: '',
        is_encrypted: !!process.env.BACKUP_ENCRYPTION_KEY,
        is_compressed: true,
        error_message: errorMessage,
        retry_attempt: retryAttempt,
        next_backup_time: this.nextScheduledRun?.toISOString(),
      };

      this.writeLog(failEntry);

      const isQuotaError = errorMessage.includes('storage quota') || errorMessage.includes('Service Accounts do not have storage quota');
      if (isQuotaError) {
        console.warn('[GoogleDriveBackup] Service Account lacks Drive storage quota on personal @gmail.com. Please use Google Apps Script Web App URL or Shared Drive.');
      }

      // Configurable exponential retry without crashing (skip if permanent quota error)
      if (!isQuotaError && retryAttempt < this.MAX_RETRIES) {
        const backoffMs = Math.pow(2, retryAttempt) * 30000; // 30s, 60s, 120s
        console.log(`[GoogleDriveBackup] Scheduling retry attempt ${retryAttempt + 2} in ${backoffMs / 1000}s...`);
        if (this.retryTimer) clearTimeout(this.retryTimer);
        this.retryTimer = setTimeout(() => {
          this.runBackupCycle(retryAttempt + 1).catch((e) => {
            console.warn('[GoogleDriveBackup] Retry failed:', e.message);
          });
        }, backoffMs);
      }

      return failEntry;
    } finally {
      this.isBackupRunning = false;
    }
  }

  /**
   * Ingests binary SQLite bytes directly from the client application
   * to ensure local file persistence on the server.
   */
  public saveDatabaseBytes(buffer: Buffer): void {
    try {
      this.ensureDataDirectories();
      fs.writeFileSync(this.dbPath, buffer);
    } catch (err: any) {
      console.error('[GoogleDriveBackup] Failed to save database bytes to disk:', err.message);
      throw err;
    }
  }

  /**
   * Reads persistent backup logs.
   */
  public readLogs(): BackupLogEntry[] {
    try {
      if (fs.existsSync(this.logsPath)) {
        const raw = fs.readFileSync(this.logsPath, 'utf8');
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {
      // Ignore read errors
    }
    return [];
  }

  /**
   * Writes a backup log entry to persistent storage.
   */
  private writeLog(entry: BackupLogEntry) {
    try {
      const logs = this.readLogs();
      logs.unshift(entry);
      // Keep only last 100 log entries
      const trimmed = logs.slice(0, 100);
      fs.writeFileSync(this.logsPath, JSON.stringify(trimmed, null, 2), 'utf8');
    } catch (err: any) {
      console.warn('[GoogleDriveBackup] Could not write backup log:', err.message);
    }
  }

  /**
   * Returns a sanitized status summary safe for public API/admin status display.
   * NEVER exposes private keys or passwords.
   */
  public getStatusSummary(): BackupStatusSummary {
    const logs = this.readLogs();
    const lastEntry = logs[0] || null;
    const isConfigured = this.isConfigured();

    let statusDisplay: string = 'NEVER_RUN';
    if (!isConfigured) {
      statusDisplay = 'STANDBY';
    } else if (lastEntry) {
      statusDisplay = lastEntry.status;
    }

    let lastErrorMessage = isConfigured && lastEntry && lastEntry.status === 'FAILED' ? lastEntry.error_message || 'Unknown error' : null;
    if (lastErrorMessage && (lastErrorMessage.includes('storage quota') || lastErrorMessage.includes('Service Accounts do not have storage quota'))) {
      lastErrorMessage = 'पर्सनल गुगल ड्राईव्हसाठी Apps Script URL आवश्यक आहे / Google Apps Script Web App URL required for personal @gmail.com Drive storage';
    }

    return {
      enabled: (process.env.BACKUP_ENABLED ?? 'true').toLowerCase() === 'true',
      last_backup_time: lastEntry ? lastEntry.completion_time : null,
      last_backup_status: statusDisplay as any,
      last_file_name: lastEntry ? lastEntry.file_name : null,
      last_file_size: lastEntry ? lastEntry.file_size_formatted : null,
      last_drive_file_id: lastEntry && lastEntry.drive_file_id ? lastEntry.drive_file_id : null,
      last_error: lastErrorMessage,
      next_backup_time: this.nextScheduledRun ? this.nextScheduledRun.toISOString() : null,
      total_backups_count: logs.filter((l) => l.status === 'SUCCESS' || l.status === 'LOCAL_SAVED').length,
      retention_days: parseInt(process.env.BACKUP_RETENTION_DAYS || '30', 10),
      interval_hours: parseFloat(process.env.BACKUP_INTERVAL_HOURS || '24'),
      configured_account: 'praipayanbackup@gmail.com',
      is_configured: isConfigured,
      folder_id: process.env.GOOGLE_DRIVE_FOLDER_ID || null,
    };
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}

export const googleDriveBackupService = new GoogleDriveBackupService();
