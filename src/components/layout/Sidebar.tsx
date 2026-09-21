import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, 
  ShoppingCart, 
  ReceiptText, 
  PackagePlus, 
  Boxes, 
  Tag, 
  Users, 
  Truck, 
  WalletCards, 
  ShieldCheck, 
  BarChart3, 
  HardDriveDownload, 
  Settings,
  Building2,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { AppLanguage } from '../../types';
import { getTranslation } from '../../i18n';
import { updateService, UpdateState } from '../../services/updateService';

export type NavItemKey = 
  | 'dashboard'
  | 'pos'
  | 'sales'
  | 'purchase'
  | 'inventory'
  | 'products'
  | 'farmers'
  | 'suppliers'
  | 'expenses'
  | 'compliance'
  | 'reports'
  | 'backup'
  | 'business'
  | 'settings';

interface SidebarProps {
  activeTab: NavItemKey;
  onSelectTab: (tab: NavItemKey) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
  currentLang: AppLanguage;
  lowStockCount?: number;
  expiringCount?: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onSelectTab,
  collapsed,
  onToggleCollapse,
  currentLang,
  lowStockCount = 0,
  expiringCount = 0,
}) => {
  const [updateState, setUpdateState] = useState<UpdateState>(updateService.getState());

  useEffect(() => {
    const unsub = updateService.subscribe(setUpdateState);
    return unsub;
  }, []);

  const navItems: { key: NavItemKey; labelKey: any; icon: any; badge?: number; badgeColor?: string }[] = [
    { key: 'dashboard', labelKey: 'nav_dashboard', icon: LayoutDashboard },
    { key: 'pos', labelKey: 'nav_pos', icon: ShoppingCart },
    { key: 'sales', labelKey: 'nav_sales', icon: ReceiptText },
    { key: 'purchase', labelKey: 'nav_purchase', icon: PackagePlus },
    { 
      key: 'inventory', 
      labelKey: 'nav_inventory', 
      icon: Boxes, 
      badge: lowStockCount + expiringCount, 
      badgeColor: expiringCount > 0 ? 'bg-amber-500' : 'bg-rose-500' 
    },
    { key: 'products', labelKey: 'nav_products', icon: Tag },
    { key: 'farmers', labelKey: 'nav_farmers', icon: Users },
    { key: 'suppliers', labelKey: 'nav_suppliers', icon: Truck },
    { key: 'expenses', labelKey: 'nav_expenses', icon: WalletCards },
    { key: 'compliance', labelKey: 'nav_compliance', icon: ShieldCheck },
    { key: 'reports', labelKey: 'nav_reports', icon: BarChart3 },
    { key: 'business', labelKey: 'nav_business', icon: Building2 },
    { key: 'backup', labelKey: 'nav_backup', icon: HardDriveDownload },
    { key: 'settings', labelKey: 'nav_settings', icon: Settings },
  ];

  return (
    <aside
      className={`bg-slate-900 text-slate-300 border-r border-slate-800 transition-all duration-200 flex flex-col z-20 ${
        collapsed ? 'w-16' : 'w-60'
      }`}
    >
      {/* Navigation List */}
      <div className="flex-1 py-3 px-2 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.key;
          const label = getTranslation(item.labelKey, currentLang);

          return (
            <button
              key={item.key}
              onClick={() => onSelectTab(item.key)}
              title={collapsed ? label : undefined}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-all group relative cursor-pointer ${
                isActive
                  ? 'bg-emerald-600 text-white shadow-xs font-semibold'
                  : 'hover:bg-slate-800 text-slate-300 hover:text-white'
              }`}
            >
              <Icon className={`w-4 h-4 shrink-0 transition-transform ${isActive ? 'text-white' : 'text-slate-400 group-hover:text-emerald-400'}`} />
              
              {!collapsed && (
                <span className="truncate flex-1 text-left">
                  {label}
                </span>
              )}

              {/* Badge for notifications like inventory alerts */}
              {item.badge && item.badge > 0 ? (
                <span
                  className={`text-[10px] text-white font-bold px-1.5 py-0.2 rounded-full ${
                    item.badgeColor || 'bg-rose-500'
                  } ${collapsed ? 'absolute top-1.5 right-1.5' : ''}`}
                >
                  {item.badge}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      {/* Collapse Toggle Footer */}
      <div className="p-2 border-t border-slate-800 flex items-center justify-between">
        {!collapsed && (
          <div className="text-[10px] text-slate-400 px-2 font-mono flex items-center gap-1.5">
            <span className="font-bold text-emerald-400">v{updateState.currentVersion}</span>
            <span className="text-slate-600">•</span>
            <span className="font-sans">{getTranslation('offline_secure', currentLang)}</span>
          </div>
        )}
        <button
          onClick={onToggleCollapse}
          className="p-1.5 rounded-md hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer ml-auto"
          title={collapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>
    </aside>
  );
};
