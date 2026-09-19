import React, { useState, useEffect } from 'react';
import { 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle, 
  X, 
  ArrowUpCircle,
  Sparkles
} from 'lucide-react';
import { AppLanguage } from '../../types';
import { updateService, UpdateState } from '../../services/updateService';

interface UpdateNotificationProps {
  currentLang: AppLanguage;
}

export const UpdateNotification: React.FC<UpdateNotificationProps> = ({ currentLang }) => {
  const isMr = currentLang === 'mr';
  const [updateState, setUpdateState] = useState<UpdateState>(updateService.getState());
  const [minimized, setMinimized] = useState(false);

  useEffect(() => {
    // Initialize update service
    updateService.init();
    // Subscribe to state changes
    const unsub = updateService.subscribe(setUpdateState);
    return unsub;
  }, []);

  // Strict requirement: Only Windows Desktop (Electron) receives auto-updates
  if (!updateState.isElectron) {
    return null;
  }

  // If no update detected, not downloading, and not ready, do not show anything
  if (!updateState.hasUpdate && !updateState.downloading && !updateState.updateReady && !updateState.error) {
    return null;
  }

  const handleRestart = () => {
    updateService.restartAndInstall();
  };

  // Minimized floating pill
  if (minimized) {
    return (
      <button
        type="button"
        onClick={() => setMinimized(false)}
        className="fixed bottom-4 right-4 z-50 px-3 py-2 bg-emerald-700 hover:bg-emerald-600 text-white rounded-full shadow-xl flex items-center gap-2 cursor-pointer transition-all active:scale-95 border border-emerald-400/40"
        title={isMr ? 'ऑटो-अपडेट प्रगती पहा' : 'View Update Progress'}
      >
        {updateState.updateReady ? (
          <CheckCircle2 className="w-4 h-4 text-emerald-300 animate-pulse" />
        ) : (
          <RefreshCw className="w-4 h-4 text-emerald-300 animate-spin" />
        )}
        <span className="text-xs font-bold font-mono">
          {updateState.updateReady 
            ? (isMr ? 'अपडेट तयार (v' + updateState.latestVersion + ')' : 'Update Ready (v' + updateState.latestVersion + ')')
            : (isMr ? 'अपडेट होत आहे (' + (updateState.progress?.percent || 0) + '%)' : 'Updating (' + (updateState.progress?.percent || 0) + '%)')}
        </span>
      </button>
    );
  }

  return (
    <div className="fixed bottom-5 right-5 z-50 max-w-sm w-full bg-slate-900 text-white rounded-2xl shadow-2xl border border-emerald-500/40 p-4 animate-in slide-in-from-bottom-5">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/30">
            {updateState.updateReady ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            ) : updateState.downloading ? (
              <RefreshCw className="w-5 h-5 text-emerald-400 animate-spin" />
            ) : updateState.error ? (
              <AlertCircle className="w-5 h-5 text-rose-400" />
            ) : (
              <Sparkles className="w-5 h-5 text-emerald-400" />
            )}
          </div>
          <div>
            <h4 className="text-xs font-bold text-slate-100">
              {updateState.updateReady 
                ? (isMr ? 'नवीन व्हर्जन इन्स्टॉलसाठी तयार!' : 'New Version Ready to Apply!')
                : updateState.downloading
                ? (isMr ? 'नवीन आवृत्ती ऑटो-डाऊनलोड होत आहे...' : 'Auto-Downloading Update...')
                : updateState.error
                ? (isMr ? 'अपडेट करताना अडचण आली' : 'Update Notice')
                : (isMr ? 'नवीन व्हर्जन सापडले आहे!' : 'New Update Detected!')}
            </h4>
            <p className="text-[10px] text-slate-400 font-mono mt-0.5">
              {`v${updateState.currentVersion} ➔ v${updateState.latestVersion || '...'}`}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setMinimized(true)}
          className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 cursor-pointer"
          title={isMr ? 'लपवा' : 'Minimize'}
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Auto-download Notice */}
      {updateState.downloading && (
        <p className="text-[11px] text-slate-300 mb-2 leading-relaxed">
          {isMr
            ? 'नवीन अपडेट आपोआप बॅकग्राऊंडमध्ये डाऊनलोड केले जात आहे. आपले काम चालू ठेवा.'
            : 'New update is downloading automatically in the background. You can continue your work.'}
        </p>
      )}

      {/* Progress bar */}
      {updateState.downloading && updateState.progress && (
        <div className="my-2.5 space-y-1.5">
          <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden border border-slate-700">
            <div 
              className="bg-gradient-to-r from-emerald-500 to-teal-400 h-2 rounded-full transition-all duration-300"
              style={{ width: `${updateState.progress.percent}%` }}
            />
          </div>
          <div className="flex justify-between text-[10px] text-slate-400 font-mono">
            <span>{updateState.progress.percent}% {isMr ? 'पूर्ण' : 'complete'}</span>
            <span>
              {(updateState.progress.bytesPerSecond / (1024 * 1024)).toFixed(1)} MB/s
            </span>
          </div>
        </div>
      )}

      {/* Update Ready Notice */}
      {updateState.updateReady && (
        <p className="text-[11px] text-emerald-300 mb-3 bg-emerald-950/60 p-2.5 rounded-xl border border-emerald-800/60">
          {isMr 
            ? 'अपडेट यशस्वीरित्या डाऊनलोड झाले आहे. ॲप रीस्टार्ट झाल्यावर नवीन व्हर्जन आपोआप लागू होईल.'
            : 'Update downloaded successfully. Restart now or on next app launch to apply.'}
        </p>
      )}

      {/* Error Message if any */}
      {updateState.error && (
        <p className="text-[11px] text-rose-300 bg-rose-950/50 p-2 rounded-lg border border-rose-800/40 mb-3">
          {updateState.error}
        </p>
      )}

      {/* Action Buttons */}
      <div className="flex items-center justify-end gap-2 mt-2 pt-2 border-t border-slate-800">
        {updateState.updateReady ? (
          <button
            type="button"
            onClick={handleRestart}
            className="w-full py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm cursor-pointer transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>{isMr ? 'आता रीस्टार्ट करा (Restart Now)' : 'Restart & Apply Update'}</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setMinimized(true)}
            className="py-1 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer"
          >
            {isMr ? 'लपवा (Minimize)' : 'Minimize'}
          </button>
        )}
      </div>
    </div>
  );
};
