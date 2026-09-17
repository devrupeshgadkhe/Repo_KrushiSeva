import React, { useState, useEffect } from 'react';
import { 
  DownloadCloud, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle, 
  X, 
  ArrowUpCircle,
  ExternalLink 
} from 'lucide-react';
import { AppLanguage } from '../../types';
import { ElectronUpdateInfo, ElectronDownloadProgress } from '../../types/electron';

interface UpdateNotificationProps {
  currentLang: AppLanguage;
}

export const UpdateNotification: React.FC<UpdateNotificationProps> = ({ currentLang }) => {
  const isMr = currentLang === 'mr';
  const isElectron = typeof window !== 'undefined' && !!window.electronAPI?.isElectron;

  const [currentVersion, setCurrentVersion] = useState<string>('1.0.0');
  const [updateAvailable, setUpdateAvailable] = useState<ElectronUpdateInfo | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<ElectronDownloadProgress | null>(null);
  const [updateReady, setUpdateReady] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [minimized, setMinimized] = useState(false);

  useEffect(() => {
    if (!isElectron || !window.electronAPI) return;

    // Get current app version
    window.electronAPI.getAppVersion().then((ver) => {
      if (ver) setCurrentVersion(ver);
    }).catch(console.error);

    // Register event listeners
    const unsubAvailable = window.electronAPI.onUpdateAvailable((info) => {
      setUpdateAvailable(info);
      setMinimized(false);
    });

    const unsubProgress = window.electronAPI.onDownloadProgress((progress) => {
      setDownloading(true);
      setDownloadProgress(progress);
    });

    const unsubDownloaded = window.electronAPI.onUpdateDownloaded(() => {
      setDownloading(false);
      setUpdateReady(true);
      setMinimized(false);
    });

    const unsubError = window.electronAPI.onUpdateError((data) => {
      console.warn('Auto updater notice:', data.message);
      // Only show error if downloading was underway
      if (downloading) {
        setUpdateError(data.message);
        setDownloading(false);
      }
    });

    return () => {
      unsubAvailable();
      unsubProgress();
      unsubDownloaded();
      unsubError();
    };
  }, [isElectron, downloading]);

  if (!isElectron) {
    return null;
  }

  // If no update and no error, don't show
  if (!updateAvailable && !updateReady && !updateError) {
    return null;
  }

  const handleStartDownload = async () => {
    if (!window.electronAPI) return;
    setDownloading(true);
    setUpdateError(null);
    try {
      await window.electronAPI.downloadUpdate();
    } catch (e: any) {
      setUpdateError(e.message || 'Download failed');
      setDownloading(false);
    }
  };

  const handleRestartToInstall = () => {
    if (!window.electronAPI) return;
    window.electronAPI.quitAndInstall();
  };

  if (minimized) {
    return (
      <button
        type="button"
        onClick={() => setMinimized(false)}
        className="fixed bottom-4 right-4 z-50 p-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-full shadow-lg flex items-center gap-2 cursor-pointer transition-transform active:scale-95 animate-bounce"
        title={isMr ? 'नवीन अपडेट उपलब्ध आहे' : 'Update Available'}
      >
        <ArrowUpCircle className="w-5 h-5" />
        <span className="text-xs font-bold font-mono">v{updateAvailable?.version}</span>
      </button>
    );
  }

  return (
    <div className="fixed bottom-5 right-5 z-50 max-w-sm w-full bg-slate-900 text-white rounded-2xl shadow-2xl border border-emerald-500/40 p-4 animate-in slide-in-from-bottom-5">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
            {updateReady ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            ) : downloading ? (
              <RefreshCw className="w-5 h-5 text-emerald-400 animate-spin" />
            ) : updateError ? (
              <AlertCircle className="w-5 h-5 text-rose-400" />
            ) : (
              <ArrowUpCircle className="w-5 h-5 text-emerald-400" />
            )}
          </div>
          <div>
            <h4 className="text-xs font-bold text-slate-100">
              {updateReady 
                ? (isMr ? 'अपडेट इन्स्टॉल करण्यासाठी तयार!' : 'Update Ready to Install!')
                : downloading
                ? (isMr ? 'नवीन व्हर्जन डाऊनलोड होत आहे...' : 'Downloading New Version...')
                : updateError
                ? (isMr ? 'अपडेट करताना अडचण आली' : 'Update Notice')
                : (isMr ? 'नवीन सॉफ्टवेअर व्हर्जन उपलब्ध!' : 'New Update Available!')}
            </h4>
            <p className="text-[10px] text-slate-400 font-mono">
              {updateAvailable ? `v${currentVersion} ➔ v${updateAvailable.version}` : `v${currentVersion}`}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setMinimized(true)}
          className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Progress bar if downloading */}
      {downloading && downloadProgress && (
        <div className="my-3 space-y-1.5">
          <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
            <div 
              className="bg-emerald-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${downloadProgress.percent}%` }}
            />
          </div>
          <div className="flex justify-between text-[10px] text-slate-400 font-mono">
            <span>{downloadProgress.percent}% {isMr ? 'पूर्ण' : 'complete'}</span>
            <span>
              {(downloadProgress.bytesPerSecond / (1024 * 1024)).toFixed(1)} MB/s
            </span>
          </div>
        </div>
      )}

      {/* Error Message */}
      {updateError && (
        <p className="text-[11px] text-rose-300 bg-rose-950/50 p-2 rounded-lg border border-rose-800/40 mb-3">
          {updateError}
        </p>
      )}

      {/* Action Buttons */}
      <div className="flex items-center justify-end gap-2 mt-2 pt-2 border-t border-slate-800">
        {updateReady ? (
          <button
            type="button"
            onClick={handleRestartToInstall}
            className="w-full py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm cursor-pointer transition-colors active:scale-95"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>{isMr ? 'आता रीस्टार्ट करून अपडेट करा' : 'Restart & Apply Update'}</span>
          </button>
        ) : downloading ? (
          <span className="text-[11px] text-slate-400 italic">
            {isMr ? 'कृपया वाट पाहा...' : 'Please wait...'}
          </span>
        ) : (
          <>
            <button
              type="button"
              onClick={() => setMinimized(true)}
              className="py-1.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer"
            >
              {isMr ? 'नंतर करा' : 'Later'}
            </button>
            <button
              type="button"
              onClick={handleStartDownload}
              className="py-1.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm cursor-pointer transition-colors active:scale-95"
            >
              <DownloadCloud className="w-3.5 h-3.5" />
              <span>{isMr ? 'अपडेट डाऊनलोड करा' : 'Download Update'}</span>
            </button>
          </>
        )}
      </div>
    </div>
  );
};
