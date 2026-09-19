import initSqlJs, { Database } from 'sql.js';
import { INITIAL_SCHEMA_SQL } from './schema';
import { SEED_DATA_SQL } from './seedData';

const DB_STORAGE_KEY = 'krushi_seva_erp_sqlite_db';
const DB_VERSION = 1;

function getSqlWasmUrl(): string {
  if (typeof window !== 'undefined' && window.location.protocol === 'file:') {
    return './sql-wasm.wasm';
  }
  return '/sql-wasm.wasm';
}

class SQLiteDatabaseManager {
  private db: Database | null = null;
  private isInitialized = false;
  private initPromise: Promise<Database> | null = null;
  private inTransaction = false;

  public async getDb(): Promise<Database> {
    if (this.db) return this.db;
    if (this.initPromise) return this.initPromise;

    this.initPromise = this.init();
    return this.initPromise;
  }

  private async init(): Promise<Database> {
    try {
      const SQL = await initSqlJs({
        locateFile: () => getSqlWasmUrl()
      });

      // Try loading existing database from IndexedDB
      const savedBytes = await this.loadFromIndexedDB();

      if (savedBytes && savedBytes.length > 0) {
        try {
          this.db = new SQL.Database(savedBytes);
          // Run integrity check
          const integrity = this.runIntegrityCheck(this.db);
          if (integrity !== 'ok') {
            console.warn('Database integrity check warning:', integrity);
          }
        } catch (e) {
          console.error('Failed to load saved SQLite bytes, re-creating database:', e);
          this.db = new SQL.Database();
          this.bootstrapNewDb(this.db);
        }
      } else {
        // First-time database creation
        this.db = new SQL.Database();
        this.bootstrapNewDb(this.db);
      }

      this.runSchemaMigrations(this.db);

      this.isInitialized = true;
      await this.saveToIndexedDB();
      return this.db;
    } catch (err) {
      console.error('Failed to initialize SQLite WASM:', err);
      throw err;
    }
  }

  private runSchemaMigrations(database: Database) {
    const migrationStatements = [
      'ALTER TABLE business_settings ADD COLUMN partner_name TEXT;',
      'ALTER TABLE business_settings ADD COLUMN taluka TEXT;',
      'ALTER TABLE business_settings ADD COLUMN jurisdiction_city TEXT;',
      'ALTER TABLE business_settings ADD COLUMN mobile_secondary TEXT;',
      'ALTER TABLE business_settings ADD COLUMN cot_licence TEXT;',
      'ALTER TABLE business_settings ADD COLUMN fert_licence_r TEXT;',
      'ALTER TABLE customers ADD COLUMN aadhar_no TEXT;',
      'ALTER TABLE sales ADD COLUMN doc_no TEXT;',
      'ALTER TABLE sales ADD COLUMN doc_date TEXT;',
      'ALTER TABLE sales ADD COLUMN customer_aadhar TEXT;',
      'ALTER TABLE sales ADD COLUMN customer_outstanding REAL DEFAULT 0;',
      'ALTER TABLE sales ADD COLUMN previous_balance REAL DEFAULT 0;',
      'ALTER TABLE sale_items ADD COLUMN mfg TEXT;',
      'ALTER TABLE sale_items ADD COLUMN company TEXT;',
      'ALTER TABLE sale_items ADD COLUMN content TEXT;',
    ];

    for (const sql of migrationStatements) {
      try {
        database.run(sql);
      } catch {
        // Ignored if column already exists
      }
    }
  }

  private bootstrapNewDb(database: Database) {
    database.run(INITIAL_SCHEMA_SQL);
    database.run(`INSERT OR REPLACE INTO schema_migrations (version, applied_at) VALUES (${DB_VERSION}, datetime('now'));`);
    database.run(SEED_DATA_SQL);
  }

  public async persist(): Promise<void> {
    if (!this.db) return;
    await this.saveToIndexedDB();
  }

  public runIntegrityCheck(database?: Database): string {
    const target = database || this.db;
    if (!target) return 'Not initialized';
    try {
      const res = target.exec('PRAGMA integrity_check;');
      if (res.length > 0 && res[0].values.length > 0) {
        return String(res[0].values[0][0]);
      }
      return 'ok';
    } catch (e: any) {
      return `Error: ${e.message}`;
    }
  }

  public query<T = any>(sql: string, params: any[] = []): T[] {
    if (!this.db) throw new Error('Database not initialized');
    const stmt = this.db.prepare(sql);
    if (params && params.length) {
      stmt.bind(params);
    }
    const results: T[] = [];
    while (stmt.step()) {
      results.push(stmt.getAsObject() as unknown as T);
    }
    stmt.free();
    return results;
  }

  public queryOne<T = any>(sql: string, params: any[] = []): T | null {
    const results = this.query<T>(sql, params);
    return results.length > 0 ? results[0] : null;
  }

  public run(sql: string, params: any[] = []): { lastInsertRowid: number; changes: number } {
    if (!this.db) throw new Error('Database not initialized');
    this.db.run(sql, params);
    const lastIdRes = this.db.exec('SELECT last_insert_rowid() as id, changes() as affected;');
    let lastInsertRowid = 0;
    let changes = 0;
    if (lastIdRes.length > 0 && lastIdRes[0].values.length > 0) {
      lastInsertRowid = Number(lastIdRes[0].values[0][0]) || 0;
      changes = Number(lastIdRes[0].values[0][1]) || 0;
    }
    // Schedule asynchronous persist only outside active transactions (transactions persist on commit)
    if (!this.inTransaction) {
      this.persist().catch(console.error);
    }
    return { lastInsertRowid, changes };
  }

  public transaction<T>(callback: () => T): T {
    if (!this.db) throw new Error('Database not initialized');

    // If already in an active transaction, execute callback directly to prevent nested transaction crash
    if (this.inTransaction) {
      return callback();
    }

    this.inTransaction = true;
    try {
      this.db.run('BEGIN TRANSACTION;');
    } catch (beginErr) {
      this.inTransaction = false;
      throw beginErr;
    }

    try {
      const result = callback();
      this.db.run('COMMIT;');
      this.inTransaction = false;
      this.persist().catch(console.error);
      return result;
    } catch (error) {
      try {
        this.db.run('ROLLBACK;');
      } catch (rollbackErr) {
        // SQLite may have already automatically rolled back on the error, or no transaction was active.
        // We log a warning but NEVER allow rollback failure to mask the original underlying error!
        console.warn('Rollback warning (transaction may have already aborted):', rollbackErr);
      } finally {
        this.inTransaction = false;
      }
      throw error;
    }
  }

  public async exportDatabaseFile(): Promise<Blob> {
    if (!this.db) throw new Error('Database not initialized');
    const binaryArray = this.db.export();
    return new Blob([binaryArray], { type: 'application/x-sqlite3' });
  }

  public async restoreDatabaseFromFile(fileData: Uint8Array): Promise<boolean> {
    const SQL = await initSqlJs({ locateFile: () => getSqlWasmUrl() });
    const candidateDb = new SQL.Database(fileData);
    const integrity = this.runIntegrityCheck(candidateDb);
    if (integrity !== 'ok') {
      throw new Error(`Corrupt backup file: ${integrity}`);
    }

    // Safety backup of current database first
    if (this.db) {
      try {
        const emergencyBackup = this.db.export();
        sessionStorage.setItem('krushi_emergency_pre_restore_backup', JSON.stringify(Array.from(emergencyBackup)));
      } catch (e) {
        console.warn('Could not store emergency session backup', e);
      }
      this.db.close();
    }

    this.db = candidateDb;
    await this.saveToIndexedDB();
    return true;
  }

  public async resetToSeedData(): Promise<void> {
    const SQL = await initSqlJs({ locateFile: () => getSqlWasmUrl() });
    if (this.db) {
      this.db.close();
    }
    this.db = new SQL.Database();
    this.bootstrapNewDb(this.db);
    await this.saveToIndexedDB();
  }

  // --- IndexedDB Storage Helper for binary SQLite db persistence ---
  private openIndexedDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('KrushiSevaERP_Storage', 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains('sqlite')) {
          db.createObjectStore('sqlite');
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  private async loadFromIndexedDB(): Promise<Uint8Array | null> {
    try {
      const idb = await this.openIndexedDB();
      return new Promise((resolve) => {
        const tx = idb.transaction('sqlite', 'readonly');
        const store = tx.objectStore('sqlite');
        const getReq = store.get(DB_STORAGE_KEY);
        getReq.onsuccess = () => {
          if (getReq.result instanceof Uint8Array) {
            resolve(getReq.result);
          } else if (getReq.result instanceof ArrayBuffer) {
            resolve(new Uint8Array(getReq.result));
          } else {
            resolve(null);
          }
        };
        getReq.onerror = () => resolve(null);
      });
    } catch {
      return null;
    }
  }

  private async saveToIndexedDB(): Promise<void> {
    if (!this.db) return;
    try {
      const bytes = this.db.export();
      const idb = await this.openIndexedDB();
      return new Promise((resolve, reject) => {
        const tx = idb.transaction('sqlite', 'readwrite');
        const store = tx.objectStore('sqlite');
        const putReq = store.put(bytes, DB_STORAGE_KEY);
        putReq.onsuccess = () => resolve();
        putReq.onerror = () => reject(putReq.error);
      });
    } catch (e) {
      console.error('Failed to save SQLite to IndexedDB:', e);
    }
  }
}

export const sqliteEngine = new SQLiteDatabaseManager();

export async function exportDatabaseFile(): Promise<void> {
  const blob = await sqliteEngine.exportDatabaseFile();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `krushi_seva_erp_backup_${new Date().toISOString().slice(0, 10)}.db`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function restoreDatabaseFromFile(file: File): Promise<boolean> {
  const arrayBuffer = await file.arrayBuffer();
  return sqliteEngine.restoreDatabaseFromFile(new Uint8Array(arrayBuffer));
}

export async function checkIntegrity(): Promise<boolean> {
  const res = sqliteEngine.runIntegrityCheck();
  return res === 'ok';
}

