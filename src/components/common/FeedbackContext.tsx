import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';
import { AppLanguage } from '../../types';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastItem {
  id: string;
  message: string;
  type: ToastType;
  title?: string;
}

export interface ConfirmDialogOptions {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  isDanger?: boolean;
  onConfirm: () => void | Promise<void>;
  onCancel?: () => void;
}

interface FeedbackContextValue {
  showToast: (message: string, type?: ToastType, title?: string, duration?: number) => void;
  showConfirm: (options: ConfirmDialogOptions) => void;
}

const FeedbackContext = createContext<FeedbackContextValue | null>(null);

// Global dispatcher to allow safe calls anywhere in the app
type FeedbackDispatcher = {
  toast: (message: string, type?: ToastType, title?: string, duration?: number) => void;
  confirm: (options: ConfirmDialogOptions) => void;
};

export const feedback: FeedbackDispatcher = {
  toast: (message, type = 'info', title, duration) => {
    if (globalShowToast) {
      globalShowToast(message, type, title, duration);
    } else {
      console.log(`[Toast ${type}] ${message}`);
    }
  },
  confirm: (options) => {
    if (globalShowConfirm) {
      globalShowConfirm(options);
    } else {
      console.log(`[Confirm] ${options.message}`);
    }
  }
};

let globalShowToast: ((message: string, type?: ToastType, title?: string, duration?: number) => void) | null = null;
let globalShowConfirm: ((options: ConfirmDialogOptions) => void) | null = null;

export const FeedbackProvider: React.FC<{ children: React.ReactNode; currentLang: AppLanguage }> = ({ 
  children, 
  currentLang 
}) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogOptions | null>(null);
  const [isConfirming, setIsConfirming] = useState(false);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback((
    message: string, 
    type: ToastType = 'info', 
    title?: string, 
    duration = 4000
  ) => {
    if (!message) return;
    const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
    
    // Auto title if not provided
    let defaultTitle = title;
    if (!defaultTitle) {
      const isMr = currentLang === 'mr';
      switch (type) {
        case 'success':
          defaultTitle = isMr ? 'यशस्वी' : 'Success';
          break;
        case 'error':
          defaultTitle = isMr ? 'त्रुटी' : 'Error';
          break;
        case 'warning':
          defaultTitle = isMr ? 'सूचना' : 'Warning';
          break;
        case 'info':
        default:
          defaultTitle = isMr ? 'माहिती' : 'Notice';
          break;
      }
    }

    setToasts((prev) => [...prev.slice(-4), { id, message, type, title: defaultTitle }]);

    if (duration > 0) {
      setTimeout(() => {
        removeToast(id);
      }, duration);
    }
  }, [currentLang, removeToast]);

  const showConfirm = useCallback((options: ConfirmDialogOptions) => {
    setConfirmDialog(options);
  }, []);

  useEffect(() => {
    globalShowToast = showToast;
    globalShowConfirm = showConfirm;

    // Safety interceptor: prevent native window.alert from locking electron event loop
    if (typeof window !== 'undefined') {
      const originalAlert = window.alert;
      window.alert = (msg: any) => {
        showToast(String(msg), 'info');
      };
      return () => {
        window.alert = originalAlert;
      };
    }
  }, [showToast, showConfirm]);

  const handleConfirmAction = async () => {
    if (!confirmDialog) return;
    try {
      setIsConfirming(true);
      await confirmDialog.onConfirm();
    } catch (err: any) {
      console.error('Error during confirm action:', err);
      showToast(err?.message || 'Operation failed', 'error');
    } finally {
      setIsConfirming(false);
      setConfirmDialog(null);
    }
  };

  const handleCancelAction = () => {
    if (!confirmDialog) return;
    confirmDialog.onCancel?.();
    setConfirmDialog(null);
  };

  return (
    <FeedbackContext.Provider value={{ showToast, showConfirm }}>
      {children}

      {/* Floating Toast Container */}
      <div 
        aria-live="polite"
        className="fixed top-12 right-4 z-9999 flex flex-col gap-2 max-w-sm w-full pointer-events-none"
      >
        {toasts.map((t) => {
          let bgClasses = 'bg-white border-slate-200 text-slate-800';
          let IconComponent = Info;
          let iconColor = 'text-blue-600';
          let borderAccent = 'border-l-4 border-l-blue-600';

          if (t.type === 'success') {
            IconComponent = CheckCircle2;
            iconColor = 'text-emerald-600';
            borderAccent = 'border-l-4 border-l-emerald-600';
          } else if (t.type === 'error') {
            IconComponent = AlertCircle;
            iconColor = 'text-rose-600';
            borderAccent = 'border-l-4 border-l-rose-600';
          } else if (t.type === 'warning') {
            IconComponent = AlertTriangle;
            iconColor = 'text-amber-600';
            borderAccent = 'border-l-4 border-l-amber-600';
          }

          return (
            <div
              key={t.id}
              className={`pointer-events-auto flex items-start gap-3 p-3.5 rounded-xl shadow-xl border ${bgClasses} ${borderAccent} bg-white animate-in fade-in slide-in-from-top-2 duration-200`}
            >
              <IconComponent className={`w-5 h-5 shrink-0 mt-0.5 ${iconColor}`} />
              <div className="flex-1 min-w-0">
                {t.title && (
                  <p className="text-xs font-bold text-slate-900 leading-tight">
                    {t.title}
                  </p>
                )}
                <p className="text-xs font-medium text-slate-600 mt-0.5 whitespace-pre-line break-words leading-relaxed">
                  {t.message}
                </p>
              </div>
              <button
                type="button"
                onClick={() => removeToast(t.id)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-md transition-colors cursor-pointer shrink-0"
                aria-label="Close notification"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}
      </div>

      {/* Confirmation Modal */}
      {confirmDialog && (
        <div className="fixed inset-0 z-99999 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div 
            className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full overflow-hidden animate-in zoom-in-95 duration-200"
            role="dialog"
            aria-modal="true"
          >
            <div className="p-5 flex items-start gap-4">
              <div className={`p-3 rounded-full shrink-0 ${confirmDialog.isDanger ? 'bg-rose-100 text-rose-600' : 'bg-emerald-100 text-emerald-700'}`}>
                {confirmDialog.isDanger ? (
                  <AlertTriangle className="w-6 h-6" />
                ) : (
                  <CheckCircle2 className="w-6 h-6" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-bold text-slate-900">
                  {confirmDialog.title || (currentLang === 'mr' ? 'खात्री करा' : 'Confirm Action')}
                </h3>
                <p className="text-xs font-medium text-slate-600 mt-1.5 leading-relaxed">
                  {confirmDialog.message}
                </p>
              </div>
            </div>

            <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex justify-end gap-2.5">
              <button
                type="button"
                disabled={isConfirming}
                onClick={handleCancelAction}
                className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
              >
                {confirmDialog.cancelText || (currentLang === 'mr' ? 'रद्द करा' : 'Cancel')}
              </button>
              <button
                type="button"
                disabled={isConfirming}
                onClick={handleConfirmAction}
                className={`px-4 py-2 text-xs font-bold text-white rounded-lg transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1.5 ${
                  confirmDialog.isDanger 
                    ? 'bg-rose-600 hover:bg-rose-700' 
                    : 'bg-emerald-700 hover:bg-emerald-800'
                }`}
              >
                {isConfirming && <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                {confirmDialog.confirmText || (currentLang === 'mr' ? 'होय, पुढे चला' : 'Yes, Proceed')}
              </button>
            </div>
          </div>
        </div>
      )}
    </FeedbackContext.Provider>
  );
};

export const useFeedback = () => {
  const context = useContext(FeedbackContext);
  if (!context) {
    return {
      showToast: feedback.toast,
      showConfirm: feedback.confirm,
    };
  }
  return context;
};
