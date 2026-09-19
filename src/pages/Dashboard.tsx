import React, { useState, useEffect } from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  ShoppingBag, 
  Users, 
  AlertTriangle, 
  Clock, 
  DollarSign, 
  Package, 
  Plus, 
  ArrowUpRight, 
  Calendar, 
  Boxes,
  FileText,
  Truck,
  CheckCircle2,
  RefreshCw
} from 'lucide-react';
import { AppLanguage, DashboardMetrics } from '../types';
import { getTranslation } from '../i18n';
import { formatINR, formatDate } from '../utils/formatters';
import { dbService } from '../services/api';
import { updateService, UpdateState } from '../services/updateService';

interface DashboardProps {
  currentLang: AppLanguage;
  onNavigate: (tab: any, id?: number) => void;
  onRefreshMetrics: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  currentLang,
  onNavigate,
  onRefreshMetrics,
}) => {
  const isMr = currentLang === 'mr';

  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [updateState, setUpdateState] = useState<UpdateState>(updateService.getState());

  useEffect(() => {
    const unsub = updateService.subscribe(setUpdateState);
    return unsub;
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await dbService.getDashboardMetrics();
      setMetrics(data);
    } catch (err) {
      console.error('Error loading dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  if (loading || !metrics) {
    return (
      <div className="flex-1 p-6 flex items-center justify-center">
        <div className="flex flex-col items-center gap-2 text-slate-500 text-xs">
          <RefreshCw className="w-6 h-6 animate-spin text-emerald-600" />
          <span>{isMr ? 'डॅशबोर्ड माहिती लोड होत आहे...' : 'Loading Dashboard...'}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 p-6 overflow-y-auto space-y-6">
      {/* Top Welcome & Quick Actions Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h2 className="text-lg font-bold text-slate-800 tracking-tight">
              {getTranslation('nav_dashboard', currentLang)} — {isMr ? 'व्यवसाय आढावा' : 'Business Overview'}
            </h2>
            <div 
              className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-xs font-mono font-bold text-emerald-800 shadow-2xs"
              title={updateState.isElectron ? 'Windows Desktop App Edition' : 'Web Browser Preview'}
            >
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>v{updateState.currentVersion}</span>
              <span className="text-[10px] text-emerald-600 font-sans font-normal border-l border-emerald-200 pl-1.5 ml-0.5">
                {updateState.isElectron ? (isMr ? 'डेस्कटॉप (.exe)' : 'Desktop (.exe)') : (isMr ? 'वेब आवृत्ती' : 'Web Edition')}
              </span>
            </div>
            {updateState.hasUpdate && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 border border-amber-300 text-[11px] font-medium text-amber-800 animate-pulse">
                {updateState.downloading
                  ? (isMr ? `ऑटो-अपडेट होत आहे (v${updateState.latestVersion})...` : `Downloading v${updateState.latestVersion}...`)
                  : (isMr ? `नवीन व्हर्जन v${updateState.latestVersion} उपलब्ध` : `New v${updateState.latestVersion} ready`)}
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            {isMr ? 'कृषी सेवा केंद्र व्यवस्थापन' : 'Agricultural Retail Management'} • {getTranslation('financial_year', currentLang)}
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            type="button"
            onClick={() => onNavigate('pos')}
            className="px-3.5 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs flex items-center gap-2 shadow-xs transition-colors cursor-pointer"
          >
            <ShoppingBag className="w-4 h-4" />
            <span>{getTranslation('quick_billing_btn', currentLang)}</span>
          </button>

          <button
            type="button"
            onClick={() => onNavigate('purchase')}
            className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-900 text-white font-semibold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 text-emerald-400" />
            <span>{isMr ? 'नवीन खरेदी नोंद' : 'New Purchase'}</span>
          </button>

          <button
            type="button"
            onClick={() => onNavigate('farmers')}
            className="px-3 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-700 font-semibold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Users className="w-3.5 h-3.5 text-blue-600" />
            <span>{isMr ? 'शेतकरी खातेवही' : 'Farmer Ledger'}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              loadData();
              onRefreshMetrics();
            }}
            className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Financial & Operational KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Today's Sales */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs hover:border-emerald-300 transition-all">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold">{getTranslation('today_sales', currentLang)}</span>
            <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600">
              <ShoppingBag className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl font-bold text-slate-900 font-mono">
            {formatINR(metrics.today_sales)}
          </div>
          <div className="text-[11px] text-slate-500 mt-1 flex items-center justify-between">
            <span>{getTranslation('month_sales', currentLang)}:</span>
            <span className="font-semibold text-slate-700 font-mono">{formatINR(metrics.month_sales)}</span>
          </div>
        </div>

        {/* Farmer Credit Outstanding (Udhaar) */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs hover:border-rose-300 transition-all">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold">{getTranslation('customer_outstanding', currentLang)}</span>
            <div className="p-1.5 rounded-lg bg-rose-50 text-rose-600">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl font-bold text-rose-600 font-mono">
            {formatINR(metrics.customer_outstanding)}
          </div>
          <div className="text-[11px] text-slate-500 mt-1 flex items-center justify-between">
            <span>{getTranslation('today_collection', currentLang)}:</span>
            <span className="font-semibold text-emerald-600 font-mono">{formatINR(metrics.today_collection)}</span>
          </div>
        </div>

        {/* Supplier Payables */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs hover:border-amber-300 transition-all">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold">{getTranslation('supplier_outstanding', currentLang)}</span>
            <div className="p-1.5 rounded-lg bg-amber-50 text-amber-600">
              <Truck className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl font-bold text-amber-600 font-mono">
            {formatINR(metrics.supplier_outstanding)}
          </div>
          <div className="text-[11px] text-slate-500 mt-1 flex items-center justify-between">
            <span>{getTranslation('today_purchase', currentLang)}:</span>
            <span className="font-semibold text-slate-700 font-mono">{formatINR(metrics.today_purchases)}</span>
          </div>
        </div>

        {/* Estimated Profit & Valuation */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs hover:border-blue-300 transition-all">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold">{getTranslation('estimated_profit', currentLang)}</span>
            <div className="p-1.5 rounded-lg bg-blue-50 text-blue-600">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl font-bold text-emerald-700 font-mono">
            {formatINR(metrics.estimated_gross_profit)}
          </div>
          <div className="text-[11px] text-slate-500 mt-1 flex items-center justify-between">
            <span>{getTranslation('total_stock_value', currentLang)}:</span>
            <span className="font-semibold text-slate-700 font-mono">{formatINR(metrics.total_stock_value)}</span>
          </div>
        </div>
      </div>

      {/* Actionable Alerts Banner (Low Stock, Near Expiry, Expired) */}
      {(metrics.low_stock_count > 0 || metrics.expiring_soon_count > 0 || metrics.expired_count > 0) && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Low Stock Alert */}
          {metrics.low_stock_count > 0 && (
            <div
              onClick={() => onNavigate('inventory')}
              className="bg-rose-50 border border-rose-200 p-3 rounded-xl flex items-center justify-between cursor-pointer hover:bg-rose-100/70 transition-colors"
            >
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-rose-200/60 text-rose-700">
                  <AlertTriangle className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-rose-900">
                    {metrics.low_stock_count} {getTranslation('low_stock_items', currentLang)}
                  </div>
                  <div className="text-[10px] text-rose-700">
                    {isMr ? 'साठा कमी झाला असून पुन्हा मागवणे आवश्यक आहे' : 'Inventory below reorder threshold'}
                  </div>
                </div>
              </div>
              <ArrowUpRight className="w-4 h-4 text-rose-700" />
            </div>
          )}

          {/* Near Expiry Alert */}
          {metrics.expiring_soon_count > 0 && (
            <div
              onClick={() => onNavigate('inventory')}
              className="bg-amber-50 border border-amber-200 p-3 rounded-xl flex items-center justify-between cursor-pointer hover:bg-amber-100/70 transition-colors"
            >
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-amber-200/60 text-amber-700">
                  <Clock className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-amber-900">
                    {metrics.expiring_soon_count} {getTranslation('expiring_soon_items', currentLang)}
                  </div>
                  <div className="text-[10px] text-amber-700">
                    {isMr ? 'पुढील ९० दिवसांत मुदत संपणारे उत्पादन साठा' : 'Batches expiring in next 90 days'}
                  </div>
                </div>
              </div>
              <ArrowUpRight className="w-4 h-4 text-amber-700" />
            </div>
          )}

          {/* Expired Stock Warning */}
          {metrics.expired_count > 0 && (
            <div
              onClick={() => onNavigate('inventory')}
              className="bg-red-50 border border-red-300 p-3 rounded-xl flex items-center justify-between cursor-pointer hover:bg-red-100/70 transition-colors"
            >
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-red-200 text-red-800">
                  <AlertTriangle className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-red-950">
                    {metrics.expired_count} {getTranslation('expired_items', currentLang)}
                  </div>
                  <div className="text-[10px] text-red-700 font-semibold">
                    {isMr ? 'मुदत संपल्यामुळे विक्री बंद करण्यात आली आहे' : 'Sale blocked due to expired shelf life'}
                  </div>
                </div>
              </div>
              <ArrowUpRight className="w-4 h-4 text-red-800" />
            </div>
          )}
        </div>
      )}

      {/* Middle Section: Sales Trend & Category Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 7-Day Sales Trend Bar Chart */}
        <div className="lg:col-span-2 bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-800">
                {getTranslation('sales_overview', currentLang)}
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5">
                {isMr ? 'दैनंदिन विक्री कल (गेल्या ७ दिवसांचा आढावा)' : 'Daily sales volume (Last 7 days)'}
              </p>
            </div>
            <div className="flex items-center gap-3 text-[11px]">
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-600" />
                <span className="text-slate-600">{isMr ? 'विक्री' : 'Sales'}</span>
              </div>
            </div>
          </div>

          {/* Clean Visual Bar Visualization */}
          <div className="h-44 flex items-end justify-between gap-3 pt-4 px-2 border-b border-slate-200">
            {metrics.sales_trend.map((day, idx) => {
              const maxVal = Math.max(...metrics.sales_trend.map((d) => d.sales), 25000);
              const heightPct = Math.max(8, Math.min(100, Math.round((day.sales / maxVal) * 100)));

              return (
                <div key={idx} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end group">
                  <div className="text-[10px] font-mono text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity font-semibold">
                    {formatINR(day.sales)}
                  </div>
                  <div
                    style={{ height: `${heightPct}%` }}
                    className="w-full max-w-[36px] bg-emerald-600 group-hover:bg-emerald-500 rounded-t transition-all"
                  />
                  <div className="text-[10px] text-slate-500 font-mono mt-1">
                    {day.date}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Category Breakdown */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-800 mb-1">
              {getTranslation('category_distribution', currentLang)}
            </h3>
            <p className="text-[11px] text-slate-500 mb-4">
              {isMr ? 'खते, बियाणे, कीटकनाशके व सूक्ष्म अन्नद्रव्ये' : 'Fertilizers, seeds and crop protection'}
            </p>

            <div className="space-y-3">
              {metrics.category_sales.slice(0, 5).map((cat, idx) => {
                const totalCatSales = metrics.category_sales.reduce((acc, c) => acc + c.amount, 0) || 1;
                const pct = Math.round((cat.amount / totalCatSales) * 100);

                let catLabel = cat.category;
                if (isMr) {
                  if (cat.category === 'Fertilizers') catLabel = 'रासायनिक खते';
                  else if (cat.category === 'Seeds') catLabel = 'बियाणे';
                  else if (cat.category === 'Pesticides') catLabel = 'कीटकनाशके';
                  else if (cat.category === 'Bio Fertilizers') catLabel = 'सेंद्रिय व टॉनिक';
                  else if (cat.category === 'Equipment') catLabel = 'कृषी अवजारे';
                }

                return (
                  <div key={idx} className="space-y-1">
                    <div className="flex justify-between text-xs font-medium text-slate-700">
                      <span>{catLabel}</span>
                      <span className="font-mono font-bold text-slate-900">{formatINR(cat.amount)} ({pct}%)</span>
                    </div>
                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                      <div
                        className="bg-emerald-600 h-full rounded-full"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="pt-4 border-t border-slate-200 mt-4 flex items-center justify-between text-xs text-slate-600">
            <span>
              {isMr ? 'नोंदणीकृत उत्पादने:' : 'Registered Products:'} <strong className="text-slate-800">{metrics.total_products}</strong>
            </span>
            <button
              type="button"
              onClick={() => onNavigate('reports')}
              className="text-emerald-700 hover:text-emerald-800 font-semibold cursor-pointer"
            >
              {isMr ? 'सविस्तर अहवाल पहा →' : 'View Full Report →'}
            </button>
          </div>
        </div>
      </div>

      {/* Bottom: Recent Sales Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-800">
              {getTranslation('recent_sales_title', currentLang)}
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5">
              {isMr ? 'काऊंटरवरून पूर्ण झालेल्या ताज्या पावत्या' : 'Latest completed customer bills'}
            </p>
          </div>

          <button
            type="button"
            onClick={() => onNavigate('sales')}
            className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 cursor-pointer"
          >
            {isMr ? 'सर्व पावत्या पहा →' : 'View All Invoices →'}
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 font-semibold">
              <tr>
                <th className="px-4 py-2.5">{isMr ? 'बिल क्र.' : 'Invoice No.'}</th>
                <th className="px-4 py-2.5">{getTranslation('date', currentLang)}</th>
                <th className="px-4 py-2.5">{getTranslation('farmer_name', currentLang)}</th>
                <th className="px-4 py-2.5">{getTranslation('payment_mode', currentLang)}</th>
                <th className="px-4 py-2.5 text-right">{getTranslation('grand_total', currentLang)} (₹)</th>
                <th className="px-4 py-2.5 text-right">{isMr ? 'उधारी बाकी (₹)' : 'Credit Due (₹)'}</th>
                <th className="px-4 py-2.5 text-center">{getTranslation('status', currentLang)}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {metrics.recent_sales.map((sale) => (
                <tr key={sale.id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="px-4 py-3 font-mono font-bold text-slate-900">
                    {sale.invoice_no}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {formatDate(sale.invoice_date)}
                  </td>
                  <td className="px-4 py-3 font-medium text-slate-800">
                    {sale.customer_name} {sale.customer_village ? `(${sale.customer_village})` : ''}
                  </td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-700 border border-slate-200">
                      {sale.payment_mode === 'Cash' && (isMr ? 'रोख' : 'Cash')}
                      {sale.payment_mode === 'UPI' && 'UPI'}
                      {sale.payment_mode === 'Credit' && (isMr ? 'उधारी' : 'Credit')}
                      {sale.payment_mode === 'Split' && (isMr ? 'विभाजित' : 'Split')}
                      {!['Cash', 'UPI', 'Credit', 'Split'].includes(sale.payment_mode) && sale.payment_mode}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-bold text-slate-900">
                    {formatINR(sale.grand_total)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono">
                    {sale.credit_amount > 0 ? (
                      <span className="text-rose-600 font-semibold">{formatINR(sale.credit_amount)}</span>
                    ) : (
                      <span className="text-slate-400">0.00</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1 w-fit mx-auto">
                      <CheckCircle2 className="w-3 h-3" />
                      <span>{sale.status === 'Completed' ? (isMr ? 'पूर्ण' : 'Completed') : (isMr ? 'रद्द' : 'Cancelled')}</span>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
