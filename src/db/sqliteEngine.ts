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

export interface FullDatabaseBackupJSON {
  version: string;
  appName: string;
  exportedAt: string;
  timestamp: number;
  tables: Record<string, any[]>;
  tableCounts: Record<string, number>;
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
      'ALTER TABLE sales ADD COLUMN is_gst_bill INTEGER DEFAULT 1;',
      'ALTER TABLE sale_items ADD COLUMN mfg TEXT;',
      'ALTER TABLE sale_items ADD COLUMN company TEXT;',
      'ALTER TABLE sale_items ADD COLUMN content TEXT;',
      'ALTER TABLE sale_items ADD COLUMN technical_name TEXT;',
      'ALTER TABLE purchase_items ADD COLUMN technical_name TEXT;',
      'ALTER TABLE products ADD COLUMN technical_name TEXT;',
      'ALTER TABLE products ADD COLUMN fertilizer_grade TEXT;',
      'ALTER TABLE products ADD COLUMN npk_ratio TEXT;',
      'ALTER TABLE products ADD COLUMN seed_variety TEXT;',
      'ALTER TABLE products ADD COLUMN seed_germination TEXT;',
      'ALTER TABLE products ADD COLUMN toxicity_class TEXT;',
      'ALTER TABLE products ADD COLUMN cib_registration_no TEXT;',
      'ALTER TABLE products ADD COLUMN dealer_rate REAL DEFAULT 0;',
      'ALTER TABLE products ADD COLUMN active INTEGER NOT NULL DEFAULT 1;',
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

  public async exportDatabaseJSON(): Promise<FullDatabaseBackupJSON> {
    await this.getDb();
    if (!this.db) throw new Error('Database not initialized');

    const tablesRes = this.query<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE 'schema_migrations' ORDER BY name ASC;"
    );

    const tables: Record<string, any[]> = {};
    const tableCounts: Record<string, number> = {};

    for (const t of tablesRes) {
      try {
        const rows = this.query(`SELECT * FROM ${t.name};`);
        tables[t.name] = rows;
        tableCounts[t.name] = rows.length;
      } catch (tableErr) {
        console.warn(`Could not export table ${t.name}:`, tableErr);
        tables[t.name] = [];
        tableCounts[t.name] = 0;
      }
    }

    return {
      version: '1.0',
      appName: 'Krushi Seva ERP',
      exportedAt: new Date().toISOString(),
      timestamp: Date.now(),
      tables,
      tableCounts
    };
  }

  public async restoreDatabaseFromJSON(backup: FullDatabaseBackupJSON): Promise<boolean> {
    await this.getDb();
    if (!this.db) throw new Error('Database not initialized');
    if (!backup || !backup.tables || typeof backup.tables !== 'object') {
      throw new Error('Invalid JSON backup file format');
    }

    // Safety backup of current database first
    try {
      const emergencyBackup = this.db.export();
      sessionStorage.setItem('krushi_emergency_pre_restore_backup', JSON.stringify(Array.from(emergencyBackup)));
    } catch (e) {
      console.warn('Could not store emergency session backup', e);
    }

    // Temporarily turn off foreign keys to allow restoring in any table order
    this.db.run('PRAGMA foreign_keys = OFF;');

    try {
      this.transaction(() => {
        for (const [tableName, rows] of Object.entries(backup.tables)) {
          if (!Array.isArray(rows)) continue;

          // Check if table exists in active schema
          const tableCheck = this.query<{ name: string }>(
            "SELECT name FROM sqlite_master WHERE type='table' AND name = ?;",
            [tableName]
          );
          if (tableCheck.length === 0) continue;

          // Clear table
          this.db!.run(`DELETE FROM ${tableName};`);

          if (rows.length === 0) continue;

          // Insert rows
          for (const row of rows) {
            if (!row || typeof row !== 'object') continue;
            const keys = Object.keys(row);
            if (keys.length === 0) continue;
            const placeholders = keys.map(() => '?').join(', ');
            const columnNames = keys.map(k => `"${k}"`).join(', ');
            const values = keys.map(k => row[k]);

            this.db!.run(
              `INSERT OR REPLACE INTO ${tableName} (${columnNames}) VALUES (${placeholders});`,
              values
            );
          }
        }
      });
      this.db.run('PRAGMA foreign_keys = ON;');
      await this.saveToIndexedDB();
      return true;
    } catch (err) {
      this.db.run('PRAGMA foreign_keys = ON;');
      throw err;
    }
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

  public async hardResetDatabase(options: {
    wipeAll?: boolean;
    wipeSales?: boolean;
    wipePurchases?: boolean;
    wipeStock?: boolean;
    wipeProducts?: boolean;
    wipeCustomers?: boolean;
    wipeSuppliers?: boolean;
    wipeExpenses?: boolean;
    wipeCashTransactions?: boolean;
    wipePesticides?: boolean;
    wipeAuditLogs?: boolean;
  } = {}): Promise<void> {
    const db = await this.getDb();
    db.run('BEGIN TRANSACTION;');
    try {
      const safeDelete = (tableName: string) => {
        try {
          db.run(`DELETE FROM "${tableName}";`);
          try {
            db.run(`DELETE FROM sqlite_sequence WHERE name = '${tableName}';`);
          } catch {}
        } catch (err) {
          console.warn(`[Reset] Table ${tableName} delete note:`, err);
        }
      };

      const isAll = !!options.wipeAll;

      // 1. Sales & Invoices
      if (isAll || options.wipeSales) {
        safeDelete('sale_items');
        safeDelete('sales');
        safeDelete('sales_return_items');
        safeDelete('sales_returns');
      }

      // 2. Purchases & Purchase Items
      if (isAll || options.wipePurchases) {
        safeDelete('purchase_items');
        safeDelete('purchases');
      }

      // 3. Batches & Stock Movements
      if (isAll || options.wipeStock) {
        safeDelete('product_batches');
        safeDelete('stock_movements');
      }

      // 4. Products Master Catalog
      if (isAll || options.wipeProducts) {
        safeDelete('products');
      }

      // 5. Customers & Farmers Khata
      if (isAll || options.wipeCustomers) {
        safeDelete('customer_crops');
        safeDelete('customer_payments');
        safeDelete('customer_ledger');
        safeDelete('customers');
      } else if (options.wipeSales) {
        try {
          db.run('UPDATE customers SET current_balance = 0;');
        } catch {}
      }

      // 6. Suppliers & Payables
      if (isAll || options.wipeSuppliers) {
        safeDelete('supplier_payments');
        safeDelete('supplier_ledger');
        safeDelete('suppliers');
      } else if (options.wipePurchases) {
        try {
          db.run('UPDATE suppliers SET current_balance = 0;');
        } catch {}
      }

      // 7. Expenses
      if (isAll || options.wipeExpenses) {
        safeDelete('expenses');
      }

      // 8. Cash Transactions
      if (isAll || options.wipeCashTransactions) {
        safeDelete('cash_transactions');
      }

      // 9. Pesticide Sales Records
      if (isAll || options.wipePesticides) {
        safeDelete('pesticide_sales_records');
      }

      // 10. Audit Logs
      if (isAll || options.wipeAuditLogs) {
        safeDelete('audit_logs');
      }

      db.run('COMMIT;');
      await this.saveToIndexedDB();
    } catch (e) {
      db.run('ROLLBACK;');
      throw e;
    }
  }

  private backendSyncTimer: any = null;
  private syncBackend(bytes: Uint8Array) {
    if (typeof window === 'undefined' || !window.fetch) return;
    if (this.backendSyncTimer) clearTimeout(this.backendSyncTimer);
    this.backendSyncTimer = setTimeout(() => {
      try {
        fetch('/api/backup/sync-db', {
          method: 'POST',
          headers: { 'Content-Type': 'application/octet-stream' },
          body: bytes,
        }).catch(() => {});
      } catch {}
    }, 2000);
  }

  private async saveToIndexedDB(): Promise<void> {
    if (!this.db) return;
    try {
      const bytes = this.db.export();
      this.syncBackend(bytes);
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

export async function exportDatabaseJSON(): Promise<FullDatabaseBackupJSON> {
  return sqliteEngine.exportDatabaseJSON();
}

export async function downloadDatabaseJSONFile(): Promise<void> {
  const jsonBackup = await sqliteEngine.exportDatabaseJSON();
  const jsonStr = JSON.stringify(jsonBackup, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `krushi_seva_erp_backup_${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function restoreDatabaseFromFile(file: File): Promise<boolean> {
  if (file.name.endsWith('.json')) {
    const text = await file.text();
    const parsed = JSON.parse(text);
    return sqliteEngine.restoreDatabaseFromJSON(parsed);
  }
  const arrayBuffer = await file.arrayBuffer();
  return sqliteEngine.restoreDatabaseFromFile(new Uint8Array(arrayBuffer));
}

export async function restoreDatabaseFromJSON(backup: FullDatabaseBackupJSON): Promise<boolean> {
  return sqliteEngine.restoreDatabaseFromJSON(backup);
}

export async function checkIntegrity(): Promise<boolean> {
  const res = sqliteEngine.runIntegrityCheck();
  return res === 'ok';
}

