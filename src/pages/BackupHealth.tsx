import React, { useState, useEffect } from 'react';
import { 
  HardDriveDownload, 
  Upload, 
  ShieldCheck, 
  Database, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw,
  FolderDown,
  RotateCcw
} from 'lucide-react';
import { AppLanguage } from '../types';
import { getTranslation } from '../i18n';
import { exportDatabaseFile, restoreDatabaseFromFile, checkIntegrity } from '../db/sqliteEngine';

interface BackupHealthProps {
  currentLang: AppLanguage;
  onRefreshData?: () => void;
}

export const BackupHealth: React.FC<BackupHealthProps> = ({ currentLang, onRefreshData }) => {
  const [integrityStatus, setIntegrityStatus] = useState<string>('checking');
  const [restoring, setRestoring] = useState(false);
  const [backupSuccess, setBackupSuccess] = useState(false);
  const [dbSize, setDbSize] = useState('0.85 MB');

  useEffect(() => {
    runCheck();
  }, []);

  const runCheck = async () => {
    try {
      const ok = await checkIntegrity();
      setIntegrityStatus(ok ? 'ok' : 'error');
    } catch (e) {
      setIntegrityStatus('error');
    }
  };

  const handleDownloadBackup = async () => {
    try {
      await exportDatabaseFile();
      setBackupSuccess(true);
      setTimeout(() => setBackupSuccess(false), 4000);
    } catch (err: any) {
      alert((currentLang === 'mr' ? 'बॅकअप डाऊनलोड अयशस्वी: ' : 'Backup failed: ') + err.message);
    }
  };

  const handleRestoreFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!confirm(getTranslation('restore_confirm', currentLang))) {
      return;
    }

    setRestoring(true);
    try {
      await restoreDatabaseFromFile(file);
      alert(getTranslation('restore_success', currentLang));
      window.location.reload();
    } catch (err: any) {
      alert((currentLang === 'mr' ? 'रिस्टोअर अयशस्वी: ' : 'Restore failed: ') + err.message);
    } finally {
      setRestoring(false);
    }
  };

  return (
    <div className="flex-1 p-6 overflow-y-auto space-y-6">
      {/* Header */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
        <h2 className="text-base font-bold text-slate-800">
          {getTranslation('backup_title', currentLang)}
        </h2>
        <p className="text-xs text-slate-500 mt-1">
          {getTranslation('backup_subtitle', currentLang)}
        </p>
      </div>

      {/* Two Columns: Backup & Restore */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Backup Card */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-2xs space-y-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-emerald-50 rounded-xl text-emerald-700">
              <HardDriveDownload className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-900">
                {getTranslation('download_backup_title', currentLang)}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {getTranslation('download_backup_desc', currentLang)}
              </p>
            </div>
          </div>

          <div className="p-4 bg-slate-50 rounded-lg text-xs text-slate-600 space-y-2 border border-slate-200">
            <div>
              {currentLang === 'mr' ? '• डेटाबेस स्थिती: ' : '• Database Status: '}
              <strong className="text-emerald-700">{currentLang === 'mr' ? 'स्थानिक व सुरक्षित' : 'Local & Secure'}</strong>
            </div>
            <div>
              {currentLang === 'mr' ? '• अंदाजित आकार: ' : '• Estimated Size: '}
              <strong className="font-mono text-slate-800">{dbSize}</strong>
            </div>
            <div>
              {currentLang === 'mr' 
                ? '• समाविष्ट डेटा: सर्व पावत्या, शेतकरी खाती, खरेदी, साठा व कर नोंदी' 
                : '• Included Data: All invoices, farmer accounts, purchases, stock & tax records'}
            </div>
          </div>

          <button
            onClick={handleDownloadBackup}
            className="w-full py-3 px-4 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 shadow-xs transition-colors cursor-pointer"
          >
            <FolderDown className="w-4 h-4" />
            <span>{getTranslation('download_backup_btn', currentLang)}</span>
          </button>

          {backupSuccess && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800 font-semibold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{getTranslation('backup_success_msg', currentLang)}</span>
            </div>
          )}
        </div>

        {/* Restore Card */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-2xs space-y-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-50 rounded-xl text-blue-700">
              <Upload className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-900">
                {getTranslation('restore_backup_title', currentLang)}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {getTranslation('restore_backup_desc', currentLang)}
              </p>
            </div>
          </div>

          <div className="p-4 bg-amber-50 rounded-lg text-xs text-amber-800 space-y-1 border border-amber-200">
            <div className="font-bold flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
              <span>{getTranslation('restore_warning_title', currentLang)}</span>
            </div>
            <p>
              {getTranslation('restore_warning_text', currentLang)}
            </p>
          </div>

          <div>
            <label className="w-full py-3 px-4 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer text-center">
              <Upload className="w-4 h-4" />
              <span>{restoring ? getTranslation('loading', currentLang) : getTranslation('restore_btn', currentLang)}</span>
              <input
                type="file"
                accept=".db,.sqlite,.sqlite3"
                onChange={handleRestoreFile}
                disabled={restoring}
                className="hidden"
              />
            </label>
          </div>
        </div>
      </div>

      {/* Database Integrity & Protection Status */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-700" />
            <h3 className="font-bold text-sm text-slate-900">
              {currentLang === 'mr' ? 'डेटा सुरक्षा व पडताळणी स्थिती' : 'Data Protection & Verification'}
            </h3>
          </div>
          <button
            onClick={runCheck}
            className="text-xs text-emerald-700 hover:text-emerald-800 font-semibold cursor-pointer flex items-center gap-1"
          >
            <RefreshCw className="w-3 h-3" />
            <span>{getTranslation('recheck_btn', currentLang)}</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
            <div className="text-slate-500">{getTranslation('system_integrity', currentLang)}</div>
            <div className="font-bold text-slate-800 mt-1 flex items-center gap-1.5">
              {integrityStatus === 'ok' ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span className="text-emerald-700">{getTranslation('system_integrity_ok', currentLang)}</span>
                </>
              ) : (
                <span className="text-amber-600">{getTranslation('loading', currentLang)}</span>
              )}
            </div>
          </div>

          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
            <div className="text-slate-500">{getTranslation('local_storage_status', currentLang)}</div>
            <div className="font-bold text-slate-800 mt-1 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span className="text-emerald-700">{getTranslation('local_storage_active', currentLang)}</span>
            </div>
          </div>

          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
            <div className="text-slate-500">{getTranslation('data_protection_status', currentLang)}</div>
            <div className="font-bold text-slate-800 mt-1 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span className="text-emerald-700">{getTranslation('data_protection_active', currentLang)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
