import React, { useState, useEffect } from 'react';
import { 
  BarChart3, 
  Download, 
  Calendar, 
  FileText, 
  Printer, 
  DollarSign, 
  Boxes, 
  Clock, 
  Users, 
  Truck,
  TrendingUp,
  RefreshCw
} from 'lucide-react';
import { AppLanguage, BusinessSettings } from '../types';
import { getTranslation } from '../i18n';
import { formatINR, formatDate, exportToCSV } from '../utils/formatters';
import { dbService } from '../services/api';

interface ReportsProps {
  currentLang: AppLanguage;
}

type ReportType = 
  | 'sales' 
  | 'purchases' 
  | 'stock' 
  | 'expiry' 
  | 'khata' 
  | 'profit' 
  | 'gst';

export const Reports: React.FC<ReportsProps> = ({ currentLang }) => {
  const isMr = currentLang === 'mr';

  const [reportType, setReportType] = useState<ReportType>('sales');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState<any[]>([]);
  const [businessSettings, setBusinessSettings] = useState<BusinessSettings | null>(null);

  useEffect(() => {
    dbService.getBusinessSettings().then(setBusinessSettings).catch(console.error);
  }, []);

  const loadReport = async () => {
    setLoading(true);
    try {
      if (reportType === 'sales') {
        const sales = await dbService.getSales('', fromDate, toDate);
        setReportData(sales);
      } else if (reportType === 'purchases') {
        const purchases = await dbService.getPurchases();
        setReportData(purchases);
      } else if (reportType === 'stock') {
        const batches = await dbService.getInventoryBatches();
        setReportData(batches);
      } else if (reportType === 'expiry') {
        const batches = await dbService.getInventoryBatches({ status: 'near_expiry' });
        setReportData(batches);
      } else if (reportType === 'khata') {
        const custs = await dbService.getCustomers();
        setReportData(custs.filter((c) => c.current_balance > 0));
      } else if (reportType === 'profit') {
        const prods = await dbService.getProducts();
        setReportData(prods);
      } else if (reportType === 'gst') {
        const sales = await dbService.getSales('', fromDate, toDate);
        setReportData(sales);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReport();
  }, [reportType, fromDate, toDate]);

  const handleExportCSV = () => {
    exportToCSV(`Report_${reportType}_${new Date().toISOString().slice(0, 10)}`, reportData);
  };

  const reportButtons = [
    { id: 'sales', mr: 'विक्री अहवाल', en: 'Sales Report', icon: FileText },
    { id: 'purchases', mr: 'खरेदी अहवाल', en: 'Purchase Report', icon: Truck },
    { id: 'stock', mr: 'साठा मूल्यांकन', en: 'Stock Valuation', icon: Boxes },
    { id: 'expiry', mr: 'मुदत विश्लेषण', en: 'Expiry Tracker', icon: Clock },
    { id: 'khata', mr: 'उधारी बाकी', en: 'Credit Dues', icon: Users },
    { id: 'profit', mr: 'अंदाजित नफा', en: 'Profit Margin', icon: TrendingUp },
    { id: 'gst', mr: 'GST विवरण', en: 'GST Report', icon: DollarSign },
  ];

  return (
    <div className="flex-1 p-6 overflow-y-auto space-y-4">
      {/* Header */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-4 no-print">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-800">
              {getTranslation('nav_reports', currentLang)}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {isMr 
                ? 'विक्री, खरेदी, साठा मूल्यांकन, नफा-तोटा व कर विवरण' 
                : 'Sales, purchases, inventory valuation, profit margins and GST filings'}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => window.print()}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>{getTranslation('print', currentLang)}</span>
            </button>
            <button
              type="button"
              onClick={handleExportCSV}
              className="px-3 py-1.5 rounded-lg border border-slate-300 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{getTranslation('export_csv', currentLang)}</span>
            </button>
          </div>
        </div>

        {/* Report Selector Ribbon */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 pt-2 border-t border-slate-100 text-xs">
          {reportButtons.map((r) => {
            const Icon = r.icon;
            const isSelected = reportType === r.id;
            return (
              <button
                type="button"
                key={r.id}
                onClick={() => setReportType(r.id as ReportType)}
                className={`p-2 rounded-lg font-semibold flex flex-col items-center gap-1 transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-emerald-700 text-white shadow-xs'
                    : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{isMr ? r.mr : r.en}</span>
              </button>
            );
          })}
        </div>

        {/* Date Filter Bar */}
        {(reportType === 'sales' || reportType === 'gst') && (
          <div className="flex items-center gap-3 pt-2 text-xs flex-wrap">
            <span className="font-bold text-slate-600">
              {isMr ? 'कालावधी:' : 'Date Range:'}
            </span>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="px-2 py-1 bg-slate-50 border border-slate-300 rounded font-mono"
            />
            <span>{isMr ? 'ते' : 'to'}</span>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="px-2 py-1 bg-slate-50 border border-slate-300 rounded font-mono"
            />
            <button
              type="button"
              onClick={() => {
                setFromDate('');
                setToDate('');
              }}
              className="text-slate-500 hover:underline cursor-pointer"
            >
              {isMr ? 'रीसेट' : 'Reset'}
            </button>
          </div>
        )}
      </div>

      {/* Clean Print Header for Physical Print / PDF */}
      <div className="hidden print:block mb-3 border-b-2 border-slate-900 pb-2">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-base font-black text-slate-900">
              {isMr && businessSettings?.shop_name_mr ? businessSettings.shop_name_mr : (businessSettings?.shop_name || 'कृषी सेवा केंद्र')}
            </h1>
            <p className="text-[11px] text-slate-700">{businessSettings?.address}, {businessSettings?.village_city}, {businessSettings?.district}</p>
            <p className="text-[10px] text-slate-600">GSTIN: {businessSettings?.gstin || '-'} | Phone: {businessSettings?.mobile}</p>
          </div>
          <div className="text-right">
            <div className="text-xs font-black uppercase text-emerald-950">
              {reportButtons.find(r => r.id === reportType)?.[isMr ? 'mr' : 'en']}
            </div>
            <div className="text-[10px] text-slate-600">
              {isMr ? 'तारीख:' : 'Date:'} {new Date().toLocaleDateString('en-IN')}
            </div>
            {(fromDate || toDate) && (
              <div className="text-[10px] text-slate-600 font-mono">
                {fromDate || 'Start'} to {toDate || 'Today'}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Render Table based on Report Type */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden print:border-none print:shadow-none">
        <div className="overflow-x-auto">
          {reportType === 'sales' && (
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                <tr>
                  <th className="p-3">{isMr ? 'बिल क्र.' : 'Invoice No.'}</th>
                  <th className="p-3">{getTranslation('date', currentLang)}</th>
                  <th className="p-3">{getTranslation('farmer_name', currentLang)}</th>
                  <th className="p-3">{getTranslation('payment_mode', currentLang)}</th>
                  <th className="p-3 text-right">{getTranslation('taxable_value', currentLang)}</th>
                  <th className="p-3 text-right">{getTranslation('gst_rate', currentLang)}</th>
                  <th className="p-3 text-right">{isMr ? 'एकूण विक्री (₹)' : 'Total Sale (₹)'}</th>
                  <th className="p-3 text-right">{isMr ? 'जमा रक्कम' : 'Paid Amount'}</th>
                  <th className="p-3 text-right">{isMr ? 'उधारी बाकी' : 'Credit Due'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {reportData.map((s, idx) => (
                  <tr key={idx} className="hover:bg-slate-50">
                    <td className="p-3 font-mono font-bold text-slate-900">{s.invoice_no}</td>
                    <td className="p-3 font-mono text-slate-600">{formatDate(s.invoice_date)}</td>
                    <td className="p-3 font-semibold text-slate-800">{s.customer_name}</td>
                    <td className="p-3">{s.payment_mode}</td>
                    <td className="p-3 text-right font-mono">{formatINR(s.taxable_amount)}</td>
                    <td className="p-3 text-right font-mono">{formatINR(s.total_tax)}</td>
                    <td className="p-3 text-right font-mono font-bold text-slate-900">{formatINR(s.grand_total)}</td>
                    <td className="p-3 text-right font-mono text-emerald-700">{formatINR(s.paid_amount)}</td>
                    <td className="p-3 text-right font-mono text-rose-700">{formatINR(s.credit_amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {reportType === 'stock' && (
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                <tr>
                  <th className="p-3">{getTranslation('product_name', currentLang)}</th>
                  <th className="p-3">{getTranslation('category', currentLang)}</th>
                  <th className="p-3">{getTranslation('batch_number', currentLang)}</th>
                  <th className="p-3 text-center">{getTranslation('expiry_date', currentLang)}</th>
                  <th className="p-3 text-center">{getTranslation('stock', currentLang)}</th>
                  <th className="p-3 text-right">{getTranslation('purchase_rate', currentLang)}</th>
                  <th className="p-3 text-right">{isMr ? 'साठा मूल्य (खरेदी ₹)' : 'Stock Value (Cost ₹)'}</th>
                  <th className="p-3 text-right">MRP</th>
                  <th className="p-3 text-right">{isMr ? 'साठा मूल्य (MRP ₹)' : 'Stock Value (MRP ₹)'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {reportData.map((b, idx) => (
                  <tr key={idx} className="hover:bg-slate-50">
                    <td className="p-3 font-bold text-slate-900">{b.product_name}</td>
                    <td className="p-3">{b.product_category}</td>
                    <td className="p-3 font-mono">{b.batch_number}</td>
                    <td className="p-3 text-center font-mono text-slate-600">{formatDate(b.expiry_date)}</td>
                    <td className="p-3 text-center font-mono font-bold">{b.current_qty} {b.unit}</td>
                    <td className="p-3 text-right font-mono">{formatINR(b.purchase_rate)}</td>
                    <td className="p-3 text-right font-mono font-bold text-emerald-700">{formatINR(b.current_qty * b.purchase_rate)}</td>
                    <td className="p-3 text-right font-mono">{formatINR(b.mrp)}</td>
                    <td className="p-3 text-right font-mono font-bold text-blue-700">{formatINR(b.current_qty * b.mrp)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {reportType === 'khata' && (
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                <tr>
                  <th className="p-3">{getTranslation('farmer_name', currentLang)}</th>
                  <th className="p-3">{getTranslation('village', currentLang)}</th>
                  <th className="p-3">{getTranslation('mobile', currentLang)}</th>
                  <th className="p-3 text-right">{getTranslation('credit_limit', currentLang)}</th>
                  <th className="p-3 text-right font-bold text-rose-700">{isMr ? 'एकूण येणे बाकी (₹)' : 'Outstanding Credit (₹)'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {reportData.map((c, idx) => (
                  <tr key={idx} className="hover:bg-slate-50">
                    <td className="p-3 font-bold text-slate-900">
                      {isMr ? (c.name_mr || c.name) : c.name}
                    </td>
                    <td className="p-3 font-medium text-slate-700">{c.village}</td>
                    <td className="p-3 font-mono">{c.mobile}</td>
                    <td className="p-3 text-right font-mono text-slate-600">{formatINR(c.credit_limit)}</td>
                    <td className="p-3 text-right font-mono font-bold text-rose-700 text-sm">{formatINR(c.current_balance)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {reportType === 'profit' && (
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                <tr>
                  <th className="p-3">{getTranslation('product_name', currentLang)}</th>
                  <th className="p-3">{getTranslation('category', currentLang)}</th>
                  <th className="p-3 text-right">{isMr ? 'खरेदी दर' : 'Purchase Cost'}</th>
                  <th className="p-3 text-right">{isMr ? 'विक्री दर' : 'Selling Price'}</th>
                  <th className="p-3 text-right text-emerald-700">{isMr ? 'अंदाजित नफा / नग' : 'Profit / Unit'}</th>
                  <th className="p-3 text-right text-emerald-800">{isMr ? 'नफा टक्केवारी' : 'Margin %'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {reportData.map((p, idx) => {
                  const profit = p.selling_rate - p.purchase_rate;
                  const marginPct = p.purchase_rate > 0 ? Math.round((profit / p.purchase_rate) * 100) : 0;
                  return (
                    <tr key={idx} className="hover:bg-slate-50">
                      <td className="p-3 font-bold text-slate-900">{p.name} ({p.pack_size})</td>
                      <td className="p-3">{p.category}</td>
                      <td className="p-3 text-right font-mono">{formatINR(p.purchase_rate)}</td>
                      <td className="p-3 text-right font-mono font-bold">{formatINR(p.selling_rate)}</td>
                      <td className="p-3 text-right font-mono font-bold text-emerald-700">{formatINR(profit)}</td>
                      <td className="p-3 text-right font-mono font-semibold text-emerald-800">{marginPct}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}

          {(reportType === 'purchases' || reportType === 'expiry' || reportType === 'gst') && (
            <div className="p-6 text-center text-slate-500 text-xs">
              {isMr 
                ? `एकूण ${reportData.length} नोंदी उपलब्ध आहेत. सविस्तर माहिती पाहण्यासाठी वरील डाउनलोड किंवा प्रिंट पर्यायाचा वापर करा.`
                : `Total ${reportData.length} records available. Use the export or print buttons above to view details.`
              }
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
