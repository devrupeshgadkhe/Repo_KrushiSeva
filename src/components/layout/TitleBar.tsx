import React, { useState, useEffect } from 'react';
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
  Clock
} from 'lucide-react';
import { AppLanguage, User } from '../../types';
import { getTranslation } from '../../i18n';
import { formatINR } from '../../utils/formatters';
import { dbService } from '../../services/api';

interface TitleBarProps {
  currentLang: AppLanguage;
  onLanguageChange: (lang: AppLanguage) => void;
  currentUser: User | null;
  onLogout: () => void;
  onOpenGlobalSearch: () => void;
  cashInHand: number;
}

export const TitleBar: React.FC<TitleBarProps> = ({
  currentLang,
  onLanguageChange,
  currentUser,
  onLogout,
  onOpenGlobalSearch,
  cashInHand,
}) => {
  const [timeStr, setTimeStr] = useState('');

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

        {/* User Info & Logout */}
        {currentUser && (
          <div className="flex items-center gap-2 pl-1 border-l border-emerald-800">
            <div className="text-right hidden sm:block">
              <div className="text-xs font-semibold text-white leading-tight">
                {currentUser.name}
              </div>
              <div className="text-[10px] text-emerald-300/80 uppercase">
                {currentUser.role}
              </div>
            </div>
            <button
              onClick={onLogout}
              title={getTranslation('logout', currentLang)}
              className="p-1.5 rounded-md hover:bg-emerald-800 text-emerald-200 hover:text-red-300 transition-colors cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
            </button>
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
