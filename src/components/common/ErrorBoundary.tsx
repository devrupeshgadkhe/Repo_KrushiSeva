import React, { ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Trash2, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: any;
}

export class ErrorBoundary extends (React.Component as new (props: Props) => {
  props: Props;
  state: State;
  setState: (state: Partial<State> | ((prev: State) => Partial<State>)) => void;
}) {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  public static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: any) {
    console.error('Uncaught error caught by ErrorBoundary:', error, errorInfo);
    this.setState({ error, errorInfo });
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleResetCache = () => {
    try {
      localStorage.removeItem('ksk_biz_cache');
      localStorage.removeItem('ksk_active_tab');
    } catch {}
    window.location.reload();
  };

  private handleResetAll = () => {
    if (window.confirm('तुम्हाला खरोखर कॅशे साफ करायची आहे का? तुमचा डेटाबेस डेटा सुरक्षित राहील.')) {
      try {
        localStorage.clear();
      } catch {}
      window.location.reload();
    }
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="h-screen w-screen bg-slate-900 text-white flex flex-col items-center justify-center p-6 select-none font-sans">
          <div className="bg-slate-800/90 border border-amber-500/50 p-6 sm:p-8 rounded-2xl max-w-lg w-full text-center space-y-5 shadow-2xl backdrop-blur-md">
            <div className="w-14 h-14 rounded-2xl bg-amber-500/20 text-amber-400 mx-auto flex items-center justify-center shadow-inner">
              <AlertTriangle className="w-8 h-8" />
            </div>

            <div className="space-y-1">
              <h2 className="text-lg font-black text-amber-300">
                स्क्रीन लोड करताना अडचण आली
              </h2>
              <p className="text-xs text-slate-300">
                Application Screen Error - A safe fallback is active.
              </p>
            </div>

            {this.state.error && (
              <div className="text-left font-mono text-[11px] bg-slate-950/80 p-3.5 rounded-xl border border-slate-700/60 max-h-36 overflow-y-auto text-rose-300 break-words">
                {this.state.error.toString()}
              </div>
            )}

            <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5 pt-2">
              <button
                type="button"
                onClick={this.handleReload}
                className="w-full sm:w-auto px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
                <span>पुन्हा लोड करा (Reload)</span>
              </button>

              <button
                type="button"
                onClick={this.handleResetCache}
                className="w-full sm:w-auto px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <Home className="w-4 h-4" />
                <span>कॅशे रीसेट करा</span>
              </button>

              <button
                type="button"
                onClick={this.handleResetAll}
                className="w-full sm:w-auto px-3 py-2.5 bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-800/50 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                title="Clear all local cache"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>साफ करा</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
