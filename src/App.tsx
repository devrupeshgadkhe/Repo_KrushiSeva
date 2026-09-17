import React, { useState, useEffect, useCallback } from 'react';
import { 
  Sprout, 
  AlertCircle, 
  RefreshCw, 
  Database,
  CheckCircle2
} from 'lucide-react';
import { AppLanguage, User } from './types';
import { getTranslation } from './i18n';
import { dbService } from './services/api';
import { TitleBar } from './components/layout/TitleBar';
import { Sidebar, NavItemKey } from './components/layout/Sidebar';
import { GlobalSearchModal } from './components/layout/GlobalSearchModal';

// Pages
import { Dashboard } from './pages/Dashboard';
import { SalesPOS } from './pages/SalesPOS';
import { SalesRegister } from './pages/SalesRegister';
import { Purchases } from './pages/Purchases';
import { Inventory } from './pages/Inventory';
import { Products } from './pages/Products';
import { Farmers } from './pages/Farmers';
import { Suppliers } from './pages/Suppliers';
import { ExpensesCash } from './pages/ExpensesCash';
import { Compliance } from './pages/Compliance';
import { Reports } from './pages/Reports';
import { BackupHealth } from './pages/BackupHealth';
import { Settings } from './pages/Settings';
import { BusinessProfile } from './pages/BusinessProfile';
import { UpdateNotification } from './components/common/UpdateNotification';

export default function App() {
  // App states
  const [activeTab, setActiveTab] = useState<NavItemKey>('dashboard');
  const [targetEntityId, setTargetEntityId] = useState<number | undefined>(undefined);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [currentLang, setCurrentLang] = useState<AppLanguage>(() => {
    return (localStorage.getItem('ksk_lang') as AppLanguage) || 'en';
  });

  // DB & Initialization states
  const [dbReady, setDbReady] = useState(false);
  const [dbError, setDbError] = useState<string | null>(null);

  // Global counts & stats
  const [cashInHand, setCashInHand] = useState(0);
  const [lowStockCount, setLowStockCount] = useState(0);
  const [expiringCount, setExpiringCount] = useState(0);

  // User
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  // Search Modal
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  const handleLanguageChange = (lang: AppLanguage) => {
    setCurrentLang(lang);
    localStorage.setItem('ksk_lang', lang);
  };

  const refreshGlobalMetrics = useCallback(async () => {
    try {
      const [cash, metrics] = await Promise.all([
        dbService.getCashInHand(),
        dbService.getDashboardMetrics(),
      ]);
      setCashInHand(cash);
      setLowStockCount(metrics.low_stock_count);
      setExpiringCount(metrics.expiring_soon_count);
    } catch (e) {
      console.warn('Failed to refresh global metrics', e);
    }
  }, []);

  // Initialize SQLite database on boot
  useEffect(() => {
    let mounted = true;

    async function initSystem() {
      try {
        // Initialize SQLite WASM & seed if fresh
        const users = await dbService.getUsers();
        if (users && users.length > 0) {
          setCurrentUser(users[0]);
        }
        await refreshGlobalMetrics();

        if (mounted) {
          setDbReady(true);
        }
      } catch (err: any) {
        console.error('System init error:', err);
        if (mounted) {
          setDbError(err?.message || 'डेटाबेस सुरू करताना अडचण आली.');
        }
      }
    }

    initSystem();
    return () => {
      mounted = false;
    };
  }, [refreshGlobalMetrics]);

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts if target is an active input/textarea
      const target = e.target as HTMLElement;
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;

      // Ctrl + F or Ctrl + K -> Global Search
      if ((e.ctrlKey || e.metaKey) && (e.key === 'f' || e.key === 'k')) {
        e.preventDefault();
        setIsSearchOpen(true);
        return;
      }

      // Escape -> close search
      if (e.key === 'Escape') {
        setIsSearchOpen(false);
      }

      if (isInput) return;

      // Function keys
      if (e.key === 'F1') {
        e.preventDefault();
        setIsSearchOpen(true);
      } else if (e.key === 'F2') {
        e.preventDefault();
        setActiveTab('pos');
      } else if (e.key === 'F3') {
        e.preventDefault();
        setActiveTab('sales');
      } else if (e.key === 'F4') {
        e.preventDefault();
        setActiveTab('inventory');
      } else if (e.key === 'F6') {
        e.preventDefault();
        setActiveTab('farmers');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Universal Navigation Handler from child components (Dashboard, Search, etc.)
  const handleNavigate = (tab: NavItemKey, id?: number) => {
    setActiveTab(tab);
    setTargetEntityId(id);
    setIsSearchOpen(false);
  };

  // Splash Screen while database is loading
  if (!dbReady) {
    return (
      <div className="h-screen w-screen bg-slate-900 text-white flex flex-col items-center justify-center p-6 select-none">
        {dbError ? (
          <div className="bg-slate-800 border border-red-500/50 p-6 rounded-2xl max-w-md text-center space-y-4 shadow-2xl">
            <div className="w-12 h-12 rounded-full bg-red-500/20 text-red-400 mx-auto flex items-center justify-center">
              <AlertCircle className="w-7 h-7" />
            </div>
            <h2 className="text-base font-bold text-red-300">
              {currentLang === 'mr' ? 'प्रणाली सुरू करताना अडचण आली' : 'System Startup Issue'}
            </h2>
            <p className="text-xs text-slate-300 font-mono bg-slate-950 p-3 rounded-lg border border-slate-800">
              {dbError}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold flex items-center gap-2 mx-auto cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
              <span>{currentLang === 'mr' ? 'पुन्हा प्रयत्न करा' : 'Try Again'}</span>
            </button>
          </div>
        ) : (
          <div className="text-center space-y-5 animate-in fade-in duration-300">
            <div className="relative mx-auto w-16 h-16 flex items-center justify-center">
              <div className="absolute inset-0 rounded-2xl bg-emerald-500/20 animate-ping opacity-75"></div>
              <div className="relative w-16 h-16 rounded-2xl bg-emerald-600 border border-emerald-400/40 flex items-center justify-center shadow-lg text-white">
                <Sprout className="w-9 h-9" />
              </div>
            </div>

            <div className="space-y-1">
              <h1 className="text-xl font-black tracking-tight text-white">
                {currentLang === 'mr' ? 'कृषी सेवा केंद्र ईआरपी' : 'Krushi Seva ERP'}
              </h1>
              <p className="text-xs text-emerald-300/80 font-medium">
                {currentLang === 'mr' ? 'स्थानिक प्रणाली सुरू होत आहे...' : 'Initializing local system...'}
              </p>
            </div>

            <div className="flex items-center justify-center gap-2 text-[11px] text-slate-400 font-medium">
              <Database className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
              <span>{currentLang === 'mr' ? 'सुरक्षित स्थानिक डेटाबेस' : 'Secure Local Storage Active'}</span>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="h-screen w-screen flex flex-col bg-slate-100 overflow-hidden font-sans antialiased text-slate-900">
      {/* Top Desktop Title Bar */}
      <TitleBar
        currentLang={currentLang}
        onLanguageChange={handleLanguageChange}
        currentUser={currentUser}
        onLogout={() => alert(currentLang === 'mr' ? 'सध्याचे वापरकर्ता सत्र सुरक्षित आहे.' : 'User session is active and secure.')}
        onOpenGlobalSearch={() => setIsSearchOpen(true)}
        cashInHand={cashInHand}
      />

      {/* Main Workspace Body */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Navigation Sidebar */}
        <Sidebar
          activeTab={activeTab}
          onSelectTab={(tab) => {
            setActiveTab(tab);
            setTargetEntityId(undefined);
          }}
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
          currentLang={currentLang}
          lowStockCount={lowStockCount}
          expiringCount={expiringCount}
        />

        {/* Right Active View Area */}
        <main className="flex-1 flex flex-col min-w-0 bg-slate-100 overflow-hidden">
          {activeTab === 'dashboard' && (
            <Dashboard
              currentLang={currentLang}
              onNavigate={handleNavigate}
              onRefreshMetrics={refreshGlobalMetrics}
            />
          )}

          {activeTab === 'pos' && (
            <SalesPOS
              currentLang={currentLang}
              onSaleCompleted={() => {
                refreshGlobalMetrics();
              }}
            />
          )}

          {activeTab === 'sales' && (
            <SalesRegister
              currentLang={currentLang}
              onRefreshData={refreshGlobalMetrics}
            />
          )}

          {activeTab === 'purchase' && (
            <Purchases
              currentLang={currentLang}
              onPurchaseCompleted={() => {
                refreshGlobalMetrics();
              }}
            />
          )}

          {activeTab === 'inventory' && (
            <Inventory
              currentLang={currentLang}
              onRefreshData={refreshGlobalMetrics}
            />
          )}

          {activeTab === 'products' && (
            <Products
              currentLang={currentLang}
              onRefreshData={refreshGlobalMetrics}
            />
          )}

          {activeTab === 'farmers' && (
            <Farmers
              currentLang={currentLang}
              onRefreshData={refreshGlobalMetrics}
              preselectedId={targetEntityId}
            />
          )}

          {activeTab === 'suppliers' && (
            <Suppliers
              currentLang={currentLang}
              onRefreshData={refreshGlobalMetrics}
              preselectedId={targetEntityId}
            />
          )}

          {activeTab === 'expenses' && (
            <ExpensesCash
              currentLang={currentLang}
              onRefreshData={refreshGlobalMetrics}
            />
          )}

          {activeTab === 'compliance' && (
            <Compliance
              currentLang={currentLang}
            />
          )}

          {activeTab === 'reports' && (
            <Reports
              currentLang={currentLang}
            />
          )}

          {activeTab === 'business' && (
            <BusinessProfile
              currentLang={currentLang}
              onSettingsSaved={refreshGlobalMetrics}
            />
          )}

          {activeTab === 'backup' && (
            <BackupHealth
              currentLang={currentLang}
              onRefreshData={refreshGlobalMetrics}
            />
          )}

          {activeTab === 'settings' && (
            <Settings
              currentLang={currentLang}
              onSettingsSaved={refreshGlobalMetrics}
            />
          )}
        </main>
      </div>

      {/* Global Quick Search Modal (Ctrl+F or Search Bar) */}
      <GlobalSearchModal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        currentLang={currentLang}
        onNavigate={handleNavigate}
      />

      {/* Desktop Auto-Update Notification Banner */}
      <UpdateNotification currentLang={currentLang} />
    </div>
  );
}
