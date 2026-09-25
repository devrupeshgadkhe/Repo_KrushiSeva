import React, { useState, useEffect, useRef } from 'react';
import { 
  Sprout, 
  Search, 
  Wallet, 
  Globe, 
  Bell, 
  User as UserIcon, 
  LogOut,
  Minus,
  Square,
  X,
  Clock,
  RefreshCw,
  CheckCircle2,
  Sparkles,
  ChevronDown,
  Check,
  Shield
} from 'lucide-react';
import { AppLanguage, User } from '../../types';
import { getTranslation } from '../../i18n';
import { formatINR } from '../../utils/formatters';
import { dbService } from '../../services/api';
import { updateService, UpdateState } from '../../services/updateService';

interface TitleBarProps {
  currentLang: AppLanguage;
  onLanguageChange: (lang: AppLanguage) => void;
  currentUser: User | null;
  onLogout: () => void;
  onOpenGlobalSearch: () => void;
  cashInHand: number;
  onSwitchUser?: (user: User) => void;
}

export const TitleBar: React.FC<TitleBarProps> = ({
  currentLang,
  onLanguageChange,
  currentUser,
  onLogout,
  onOpenGlobalSearch,
  cashInHand,
  onSwitchUser,
}) => {
  const [timeStr, setTimeStr] = useState('');
  const [updateState, setUpdateState] = useState<UpdateState>(updateService.getState());
  const [dbUser, setDbUser] = useState<User | null>(currentUser);
  const [allDbUsers, setAllDbUsers] = useState<User[]>([]);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // Sync with prop when passed
  useEffect(() => {
    if (currentUser) {
      setDbUser(currentUser);
    }
  }, [currentUser]);

  // Always load directly from SQLite database to guarantee fresh DB values
  useEffect(() => {
    let isMounted = true;
    const loadDbUsers = async () => {
      try {
        const users = await dbService.getUsers();
        if (isMounted && users && users.length > 0) {
          setAllDbUsers(users);
          if (!currentUser) {
            setDbUser(users[0]);
          }
        }
      } catch (e) {
        console.warn('Error loading users in TitleBar:', e);
      }
    };
    loadDbUsers();
    return () => {
      isMounted = false;
    };
  }, [currentUser]);

  // Close user dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setShowUserMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const unsub = updateService.subscribe(setUpdateState);
    return unsub;
  }, []);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTimeStr(
        now.toLocaleTimeString('en-IN', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true,
        })
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const activeUser = dbUser || currentUser;

  return (
    <header className="h-13 bg-emerald-900 text-white flex items-center justify-between px-3 select-none border-b border-emerald-950/40 shadow-sm z-30">
      {/* Brand & App Title */}
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-300">
          <Sprout className="w-5 h-5" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-bold text-sm tracking-wide text-white leading-tight">
              {getTranslation('app_title', currentLang)}
            </h1>
            <span 
              className="px-1.5 py-0.2 rounded bg-emerald-950/70 border border-emerald-500/40 text-[10px] font-mono font-bold text-emerald-300 shadow-2xs"
              title={updateState.isElectron ? 'Windows Desktop App' : 'Web Preview'}
            >
              v{updateState.currentVersion}
            </span>
          </div>
          <p className="text-[11px] text-emerald-200/75 leading-none">
            {getTranslation('app_subtitle', currentLang)}
          </p>
        </div>
      </div>

      {/* Center: Global Search Bar */}
      <div className="flex-1 max-w-md mx-4">
        <button
          onClick={onOpenGlobalSearch}
          className="w-full h-8 px-3 rounded-md bg-emerald-950/40 hover:bg-emerald-950/60 border border-emerald-700/50 text-emerald-200/80 text-xs flex items-center justify-between transition-colors group cursor-pointer"
        >
          <div className="flex items-center gap-2">
            <Search className="w-3.5 h-3.5 text-emerald-400" />
            <span>{getTranslation('search_placeholder', currentLang)}</span>
          </div>
          <kbd className="hidden sm:inline-block text-[10px] bg-emerald-800/60 border border-emerald-600/40 text-emerald-200 px-1.5 py-0.5 rounded">
            Ctrl + F
          </kbd>
        </button>
      </div>

      {/* Right Controls: Cash, Time, Language, User, Window controls */}
      <div className="flex items-center gap-3">
        {/* Cash in Hand */}
        <div className="hidden md:flex items-center gap-1.5 bg-emerald-950/50 border border-emerald-700/40 px-2.5 py-1 rounded text-xs">
          <Wallet className="w-3.5 h-3.5 text-emerald-400" />
          <span className="text-emerald-300/80 text-[11px]">{getTranslation('cash_in_hand', currentLang)}:</span>
          <span className="font-semibold text-emerald-100 font-mono">{formatINR(cashInHand)}</span>
        </div>

        {/* Live Clock */}
        <div className="hidden lg:flex items-center gap-1 text-[11px] text-emerald-200/70 font-mono">
          <Clock className="w-3 h-3 text-emerald-400" />
          <span>{timeStr}</span>
        </div>

        {/* Windows Desktop Auto-Update Status Indicator */}
        {updateState.isElectron && (updateState.downloading || updateState.updateReady) && (
          <div className="flex items-center">
            {updateState.updateReady ? (
              <button
                type="button"
                onClick={() => updateService.restartAndInstall()}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs shadow-sm cursor-pointer transition-all active:scale-95 animate-pulse"
                title={currentLang === 'mr' ? 'अपडेट तयार आहे. रीस्टार्ट करण्यासाठी क्लिक करा' : 'Update ready. Click to restart and apply'}
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-slate-950" />
                <span>{currentLang === 'mr' ? 'नवीन व्हर्जन तयार - रीस्टार्ट करा' : 'Update Ready - Restart'}</span>
              </button>
            ) : updateState.downloading ? (
              <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-emerald-950 border border-emerald-500/50 text-[11px] text-emerald-300 font-mono">
                <RefreshCw className="w-3 h-3 text-emerald-400 animate-spin" />
                <span>
                  {currentLang === 'mr' ? 'ऑटो-अपडेट' : 'Auto-updating'}: {updateState.progress?.percent || 0}%
                </span>
              </div>
            ) : null}
          </div>
        )}

        {/* Language Toggle: Marathi / English */}
        <div className="flex items-center bg-emerald-950/70 border border-emerald-600/50 rounded-lg p-0.5 shadow-inner">
          <button
            type="button"
            onClick={() => onLanguageChange('mr')}
            className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all cursor-pointer ${
              currentLang === 'mr'
                ? 'bg-emerald-400 text-slate-950 shadow-xs font-bold'
                : 'text-emerald-100/80 hover:text-white hover:bg-emerald-800/40'
            }`}
            title="मराठी भाषा निवडा"
          >
            मराठी
          </button>
          <button
            type="button"
            onClick={() => onLanguageChange('en')}
            className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all cursor-pointer ${
              currentLang === 'en'
                ? 'bg-emerald-400 text-slate-950 shadow-xs font-bold'
                : 'text-emerald-100/80 hover:text-white hover:bg-emerald-800/40'
            }`}
            title="Switch to English"
          >
            English
          </button>
        </div>

        {/* User Info & Database Profile Switcher */}
        {activeUser && (
          <div className="relative pl-1 border-l border-emerald-800" ref={userMenuRef}>
            <div 
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-emerald-800/60 cursor-pointer transition-colors"
              title={currentLang === 'mr' ? 'डेटाबेस वापरकर्ता खाते' : 'Database User Account'}
            >
              <div className="w-7 h-7 rounded-full bg-emerald-700/80 border border-emerald-500/50 flex items-center justify-center text-white shrink-0">
                <UserIcon className="w-3.5 h-3.5 text-emerald-200" />
              </div>
              <div className="text-right hidden sm:block">
                <div className="text-xs font-semibold text-white leading-tight">
                  {activeUser.name}
                </div>
                <div className="text-[10px] text-emerald-300/80 uppercase font-mono">
                  {activeUser.role}
                </div>
              </div>
              <ChevronDown className={`w-3.5 h-3.5 text-emerald-300 transition-transform ${showUserMenu ? 'rotate-180' : ''}`} />
            </div>

            {/* User Dropdown Menu */}
            {showUserMenu && (
              <div className="absolute right-0 top-full mt-1.5 w-64 bg-white rounded-xl shadow-2xl border border-slate-200 text-slate-800 p-2 z-50 animate-in fade-in">
                <div className="p-2 border-b border-slate-100 bg-slate-50 rounded-lg mb-1">
                  <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                    {currentLang === 'mr' ? 'सक्रिय वापरकर्ता खाते (SQLite)' : 'Active SQLite User Account'}
                  </div>
                  <div className="font-bold text-xs text-slate-900 mt-0.5">{activeUser.name}</div>
                  <div className="text-[11px] text-slate-500 flex items-center gap-2 mt-0.5">
                    <span className="font-mono">@{activeUser.username}</span>
                    <span className="px-1.5 py-0.2 bg-emerald-100 text-emerald-800 rounded text-[10px] font-bold uppercase">
                      {activeUser.role}
                    </span>
                  </div>
                </div>

                {allDbUsers.length > 1 && (
                  <div className="py-1">
                    <div className="text-[10px] font-bold text-slate-400 px-2 py-1 uppercase">
                      {currentLang === 'mr' ? 'वापरकर्ता बदला (Switch User):' : 'Switch Database User:'}
                    </div>
                    {allDbUsers.map((u) => (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => {
                          setDbUser(u);
                          onSwitchUser?.(u);
                          setShowUserMenu(false);
                        }}
                        className={`w-full text-left px-2 py-1.5 rounded-lg text-xs flex items-center justify-between hover:bg-slate-100 transition-colors cursor-pointer ${
                          u.id === activeUser.id ? 'bg-emerald-50 text-emerald-900 font-bold' : 'text-slate-700'
                        }`}
                      >
                        <div>
                          <div>{u.name}</div>
                          <div className="text-[10px] text-slate-400 font-mono">@{u.username} • {u.role}</div>
                        </div>
                        {u.id === activeUser.id && (
                          <Check className="w-4 h-4 text-emerald-600" />
                        )}
                      </button>
                    ))}
                  </div>
                )}

                <div className="pt-1 mt-1 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => {
                      setShowUserMenu(false);
                      onLogout();
                    }}
                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs text-rose-600 hover:bg-rose-50 font-semibold cursor-pointer transition-colors"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>{getTranslation('logout', currentLang)}</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Simulated Desktop Window Controls (Min, Max, Close) */}
        <div className="hidden sm:flex items-center gap-1 pl-2 border-l border-emerald-800/80 text-emerald-300/60">
          <button className="w-5 h-5 flex items-center justify-center hover:bg-emerald-800 rounded text-xs" title="Minimize">
            <Minus className="w-3 h-3" />
          </button>
          <button className="w-5 h-5 flex items-center justify-center hover:bg-emerald-800 rounded text-xs" title="Maximize">
            <Square className="w-2.5 h-2.5" />
          </button>
          <button className="w-5 h-5 flex items-center justify-center hover:bg-red-700 hover:text-white rounded text-xs" title="Close">
            <X className="w-3 h-3" />
          </button>
        </div>
      </div>
    </header>
  );
};
