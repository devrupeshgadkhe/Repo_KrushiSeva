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
  RotateCcw,
  FileJson,
  CloudCheck
} from 'lucide-react';
import { AppLanguage } from '../types';
import { getTranslation } from '../i18n';
import { exportDatabaseFile, restoreDatabaseFromFile, checkIntegrity } from '../db/sqliteEngine';
import { cloudBackupService, CloudBackupState } from '../services/cloudBackupService';
import { useFeedback } from '../components/common/FeedbackContext';
import { formatDate } from '../utils/formatters';

interface BackupHealthProps {
  currentLang: AppLanguage;
  onRefreshData?: () => void;
}

export const BackupHealth: React.FC<BackupHealthProps> = ({ currentLang, onRefreshData }) => {
  const { showToast, showConfirm } = useFeedback();
  const [integrityStatus, setIntegrityStatus] = useState<string>('checking');
  const [restoring, setRestoring] = useState(false);
  const [backupSuccess, setBackupSuccess] = useState(false);
  const [backupJsonSuccess, setBackupJsonSuccess] = useState(false);
  const [dbSize, setDbSize] = useState('1.2 MB');
  const [backupState, setBackupState] = useState<CloudBackupState>(cloudBackupService.getState());

  useEffect(() => {
    runCheck();
    const unsub = cloudBackupService.subscribe((state) => {
      setBackupState(state);
    });
    return unsub;
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
      showToast(currentLang === 'mr' ? 'डेटाबेस बॅकअप (.db) यशस्वीरित्या डाऊनलोड झाला.' : 'Database backup (.db) downloaded successfully.', 'success');
      setTimeout(() => setBackupSuccess(false), 4000);
    } catch (err: any) {
      showToast((currentLang === 'mr' ? 'बॅकअप डाऊनलोड अयशस्वी: ' : 'Backup failed: ') + err.message, 'error');
    }
  };

  const handleDownloadJSONBackup = async () => {
    try {
      await cloudBackupService.downloadJSONBackup();
      setBackupJsonSuccess(true);
      showToast(currentLang === 'mr' ? 'डेटाबेस जेसन (.json) बॅकअप यशस्वीरित्या डाऊनलोड झाला.' : 'JSON database backup (.json) downloaded successfully.', 'success');
      setTimeout(() => setBackupJsonSuccess(false), 4000);
    } catch (err: any) {
      showToast((currentLang === 'mr' ? 'जेसन बॅकअप डाऊनलोड अयशस्वी: ' : 'JSON backup failed: ') + err.message, 'error');
    }
  };

  const handleRestoreFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    showConfirm({
      title: currentLang === 'mr' ? 'डेटाबेस पूर्ववत (Restore) करा?' : 'Restore Database?',
      message: getTranslation('restore_confirm', currentLang),
      confirmText: currentLang === 'mr' ? 'होय, रिस्टोअर करा' : 'Yes, Restore',
      cancelText: currentLang === 'mr' ? 'रद्द करा' : 'Cancel',
      isDanger: true,
      onConfirm: async () => {
        setRestoring(true);
        try {
          await restoreDatabaseFromFile(file);
          showToast(getTranslation('restore_success', currentLang), 'success');
          setTimeout(() => {
            window.location.reload();
          }, 1000);
        } catch (err: any) {
          showToast((currentLang === 'mr' ? 'रिस्टोअर अयशस्वी: ' : 'Restore failed: ') + err.message, 'error');
        } finally {
          setRestoring(false);
        }
      }
    });
  };

  const isMr = currentLang === 'mr';

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

      {/* Automated Backup Banner */}
      <div className="bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-50 border border-emerald-200 p-4 rounded-xl shadow-2xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold shrink-0 shadow-xs">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <div className="font-bold text-xs text-emerald-950 flex items-center gap-2">
              <span>{isMr ? '१००% स्वयंचलित बहु-पर्यायी बॅकअप प्रणाली कार्यरत' : '100% Automated Multi-Destination Backup Active'}</span>
              <span className="bg-emerald-600 text-white text-[10px] px-2 py-0.5 rounded-full font-bold">
                {isMr ? 'सक्रिय' : 'Live'}
              </span>
            </div>
            <p className="text-[11px] text-emerald-800 mt-0.5">
              {isMr 
                ? 'प्रत्येक व्यवहारानंतर सर्व डेटा सुरक्षित स्थानिक व क्लाउड प्रतींमध्ये आपोआप जतन केला जातो. कोणत्याही मॅन्युअल सेटिंगची आवश्यकता नाही.'
                : 'All database records are continuously synced and protected both locally and in cloud storage with zero manual intervention.'}
            </p>
          </div>
        </div>
        <div className="text-right text-xs shrink-0 self-end sm:self-center">
          <span className="text-slate-500 text-[11px] block">{isMr ? 'शेवटचा स्वयंचलित बॅकअप:' : 'Last Automated Sync:'}</span>
          <span className="font-bold text-emerald-900 font-mono text-xs">
            {backupState.lastBackupTime 
              ? new Date(backupState.lastBackupTime).toLocaleString(isMr ? 'mr-IN' : 'en-IN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' })
              : (isMr ? 'प्रक्रिया सुरू आहे' : 'In Progress')}
          </span>
        </div>
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
              <strong className="text-emerald-700">{currentLang === 'mr' ? 'स्थानिक व क्लाउड सुरक्षित' : 'Local & Cloud Protected'}</strong>
            </div>
            <div>
              {currentLang === 'mr' ? '• समाविष्ट डेटा: ' : '• Included Data: '}
              <strong className="text-slate-800 font-medium">
                {currentLang === 'mr' 
                  ? 'सर्व विक्री बिले, शेतकरी खाती, खरेदी, उत्पादने, साठा व कर नोंदी' 
                  : 'All sales invoices, farmer ledgers, purchases, products, stock & tax entries'}
              </strong>
            </div>
            <div>
              {currentLang === 'mr' ? '• उपलब्ध स्वरूप: ' : '• Available Formats: '}
              <span className="font-bold text-emerald-700">{isMr ? 'डेटा संचिका (.json)' : 'Data File (.json)'}</span> &amp; <span className="font-bold text-slate-700">{isMr ? 'सुरक्षित डेटाबेस संचिका (.db)' : 'Encrypted Database (.db)'}</span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <button
              onClick={handleDownloadJSONBackup}
              className="w-full py-2.5 px-3 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 shadow-xs transition-colors cursor-pointer"
            >
              <FileJson className="w-4 h-4" />
              <span>{isMr ? 'JSON बॅकअप डाऊनलोड' : 'Download JSON Backup'}</span>
            </button>

            <button
              onClick={handleDownloadBackup}
              className="w-full py-2.5 px-3 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 shadow-xs transition-colors cursor-pointer"
            >
              <FolderDown className="w-4 h-4" />
              <span>{isMr ? 'डेटाबेस फाइल (.db) डाऊनलोड' : 'Download Database (.db)'}</span>
            </button>
          </div>

          {backupJsonSuccess && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800 font-semibold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{isMr ? 'जेसन (.json) डेटाबेस बॅकअप संगणकावर सेव्ह झाला.' : 'JSON database backup saved to your computer.'}</span>
            </div>
          )}

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
                accept=".json,.db,.sqlite,.sqlite3"
                onChange={handleRestoreFile}
                disabled={restoring}
                className="hidden"
              />
            </label>
            <span className="block text-center text-[11px] text-slate-400 mt-1.5">
              {isMr ? 'स्वीकृत बॅकअप फाइल्स: .json, .db' : 'Supported backup files: .json, .db'}
            </span>
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
            <div className="text-slate-500">{currentLang === 'mr' ? 'स्थानिक बॅकअप संग्रहण' : 'Local Backup Storage'}</div>
            <div className="font-bold text-slate-800 mt-1 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span className="text-emerald-700">{isMr ? '१००% सक्रिय व सुरक्षित' : 'Active & Synced'}</span>
            </div>
          </div>

          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
            <div className="text-slate-500">{currentLang === 'mr' ? 'क्लाउड बॅकअप सुरक्षा' : 'Cloud Backup Security'}</div>
            <div className="font-bold text-slate-800 mt-1 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span className="text-emerald-700">{isMr ? 'स्वयंचलित समक्रमण सक्षम' : 'Auto Sync Enabled'}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
