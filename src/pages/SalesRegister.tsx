import React, { useState, useEffect } from 'react';
import { 
  Search, 
  Printer, 
  Ban, 
  Download, 
  Calendar, 
  FileText, 
  RefreshCw, 
  AlertCircle,
  Eye,
  CheckCircle2,
  XCircle
} from 'lucide-react';
import { AppLanguage, Sale, BusinessSettings, InvoiceSettings } from '../types';
import { getTranslation } from '../i18n';
import { formatINR, formatDate, exportToCSV } from '../utils/formatters';
import { dbService } from '../services/api';
import { PrintInvoiceModal } from '../components/common/PrintInvoiceModal';

interface SalesRegisterProps {
  currentLang: AppLanguage;
  onRefreshData?: () => void;
}

export const SalesRegister: React.FC<SalesRegisterProps> = ({ currentLang, onRefreshData }) => {
  const isMr = currentLang === 'mr';

  const [sales, setSales] = useState<Sale[]>([]);
  const [search, setSearch] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [loading, setLoading] = useState(false);

  // Modals
  const [viewSale, setViewSale] = useState<Sale | null>(null);
  const [printSale, setPrintSale] = useState<Sale | null>(null);
  const [cancelModalSale, setCancelModalSale] = useState<Sale | null>(null);
  const [cancelReason, setCancelReason] = useState('');

  const [businessSettings, setBusinessSettings] = useState<BusinessSettings | null>(null);
  const [invoiceSettings, setInvoiceSettings] = useState<InvoiceSettings | null>(null);

  const loadSales = async () => {
    setLoading(true);
    try {
      const [list, bSet, iSet] = await Promise.all([
        dbService.getSales(search, fromDate, toDate),
        dbService.getBusinessSettings(),
        dbService.getInvoiceSettings(),
      ]);
      setSales(list);
      setBusinessSettings(bSet);
      setInvoiceSettings(iSet);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSales();
  }, [search, fromDate, toDate]);

  const handleOpenCancel = (sale: Sale) => {
    setCancelModalSale(sale);
    setCancelReason('');
  };

  const confirmCancelSale = async () => {
    if (!cancelModalSale) return;
    if (!cancelReason.trim()) {
      alert(isMr ? 'कृपया बिल रद्द करण्याचे कारण प्रविष्ट करा.' : 'Please enter the cancellation reason.');
      return;
    }

    try {
      await dbService.cancelSale(cancelModalSale.id, cancelReason);
      setCancelModalSale(null);
      loadSales();
      onRefreshData?.();
      alert(isMr ? 'पावती यशस्वीरित्या रद्द करण्यात आली.' : 'Invoice cancelled successfully.');
    } catch (e: any) {
      alert(e.message || (isMr ? 'पावती रद्द करताना त्रुटी आली.' : 'Error cancelling sale.'));
    }
  };

  const handleExportCSV = () => {
    const data = sales.map((s) => ({
      'Invoice No': s.invoice_no,
      Date: s.invoice_date,
      Customer: s.customer_name,
      Mobile: s.customer_mobile || '',
      Village: s.customer_village || '',
      'Payment Mode': s.payment_mode,
      Subtotal: s.subtotal,
      Discount: s.discount_amount,
      Taxable: s.taxable_amount,
      GST: s.total_tax,
      'Grand Total': s.grand_total,
      'Paid Amount': s.paid_amount,
      'Credit Due': s.credit_amount,
      Status: s.status,
    }));
    exportToCSV(`Sales_Register_${new Date().toISOString().slice(0, 10)}`, data);
  };

  const handlePrint = async (sale: Sale) => {
    const full = await dbService.getSaleById(sale.id);
    setPrintSale(full);
  };

  const handleView = async (sale: Sale) => {
    const full = await dbService.getSaleById(sale.id);
    setViewSale(full);
  };

  return (
    <div className="flex-1 p-6 overflow-y-auto space-y-4">
      {/* Header & Filter Controls */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-800">
              {getTranslation('nav_sales', currentLang)}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {isMr 
                ? 'सर्व विक्री पावत्यांची यादी, प्रिंट व रद्द करण्याचे व्यवस्थापन' 
                : 'Invoice history, reprints and cancellation records'}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleExportCSV}
              className="px-3 py-1.5 rounded-lg border border-slate-300 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{getTranslation('export_csv', currentLang)}</span>
            </button>
            <button
              type="button"
              onClick={loadSales}
              className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-2 border-t border-slate-100">
          <div className="relative sm:col-span-2">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={getTranslation('search_placeholder', currentLang)}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:outline-emerald-600 font-medium"
            />
          </div>

          <div>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg font-mono"
            />
          </div>

          <div>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg font-mono"
            />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
              <tr>
                <th className="px-4 py-3">{isMr ? 'बिल क्र.' : 'Invoice No.'}</th>
                <th className="px-4 py-3">{getTranslation('date', currentLang)}</th>
                <th className="px-4 py-3">{getTranslation('farmer_name', currentLang)}</th>
                <th className="px-4 py-3">{getTranslation('payment_mode', currentLang)}</th>
                <th className="px-4 py-3 text-right">{getTranslation('taxable_value', currentLang)}</th>
                <th className="px-4 py-3 text-right">{getTranslation('gst_rate', currentLang)}</th>
                <th className="px-4 py-3 text-right">{getTranslation('grand_total', currentLang)} (₹)</th>
                <th className="px-4 py-3 text-right">{isMr ? 'उधारी बाकी (₹)' : 'Credit Due (₹)'}</th>
                <th className="px-4 py-3 text-center">{getTranslation('status', currentLang)}</th>
                <th className="px-4 py-3 text-center">{getTranslation('actions', currentLang)}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sales.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-400">
                    {getTranslation('no_records_found', currentLang)}
                  </td>
                </tr>
              ) : (
                sales.map((sale) => (
                  <tr key={sale.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-4 py-3 font-mono font-bold text-slate-900">
                      {sale.invoice_no}
                    </td>
                    <td className="px-4 py-3 text-slate-600 font-mono">
                      {formatDate(sale.invoice_date)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-bold text-slate-900">{sale.customer_name}</div>
                      <div className="text-[10px] text-slate-500">
                        {sale.customer_village ? `${sale.customer_village} • ` : ''}
                        {sale.customer_mobile || ''}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-700 border border-slate-200">
                        {sale.payment_mode === 'Cash' && (isMr ? 'रोख' : 'Cash')}
                        {sale.payment_mode === 'UPI' && 'UPI'}
                        {sale.payment_mode === 'Credit' && (isMr ? 'उधारी' : 'Credit')}
                        {sale.payment_mode === 'Split' && (isMr ? 'विभाजित' : 'Split')}
                        {!['Cash', 'UPI', 'Credit', 'Split'].includes(sale.payment_mode) && sale.payment_mode}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-slate-600">
                      {formatINR(sale.taxable_amount)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-slate-600">
                      {formatINR(sale.total_tax)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-slate-900 text-sm">
                      {formatINR(sale.grand_total)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono">
                      {sale.credit_amount > 0 ? (
                        <span className="text-rose-600 font-bold">{formatINR(sale.credit_amount)}</span>
                      ) : (
                        <span className="text-slate-400">0.00</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {sale.status === 'Completed' ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 inline-flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>{isMr ? 'पूर्ण' : 'Completed'}</span>
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200 inline-flex items-center gap-1">
                          <XCircle className="w-3 h-3" />
                          <span>{isMr ? 'रद्द' : 'Cancelled'}</span>
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleView(sale)}
                          title={isMr ? 'तपशील पहा' : 'View Details'}
                          className="p-1 rounded text-slate-500 hover:text-slate-800 hover:bg-slate-100 cursor-pointer"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handlePrint(sale)}
                          title={isMr ? 'प्रिंट करा' : 'Print'}
                          className="p-1 rounded text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 cursor-pointer"
                        >
                          <Printer className="w-4 h-4" />
                        </button>
                        {sale.status === 'Completed' && (
                          <button
                            type="button"
                            onClick={() => handleOpenCancel(sale)}
                            title={isMr ? 'बिल रद्द करा' : 'Cancel Bill'}
                            className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer"
                          >
                            <Ban className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* View Bill Details Modal */}
      {viewSale && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden">
            <div className="px-5 py-3.5 bg-slate-800 text-white flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm">
                  {isMr ? 'बिल तपशील' : 'Invoice Details'}: {viewSale.invoice_no}
                </h3>
                <p className="text-[11px] text-emerald-300">
                  {viewSale.customer_name} • {getTranslation('date', currentLang)}: {formatDate(viewSale.invoice_date)}
                </p>
              </div>
              <button 
                type="button" 
                onClick={() => setViewSale(null)} 
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-4 space-y-3 max-h-[70vh] overflow-y-auto text-xs">
              <table className="w-full border text-left">
                <thead className="bg-slate-100 font-bold">
                  <tr>
                    <th className="p-2 border">{getTranslation('product_name', currentLang)}</th>
                    <th className="p-2 border">{getTranslation('batch', currentLang)}</th>
                    <th className="p-2 border text-center">{getTranslation('qty', currentLang)}</th>
                    <th className="p-2 border text-right">{getTranslation('rate', currentLang)} (₹)</th>
                    <th className="p-2 border text-right">{getTranslation('gst_rate', currentLang)}</th>
                    <th className="p-2 border text-right">{getTranslation('amount', currentLang)} (₹)</th>
                  </tr>
                </thead>
                <tbody>
                  {viewSale.items?.map((it, i) => (
                    <tr key={i} className="border-b">
                      <td className="p-2 border font-medium">{it.product_name}</td>
                      <td className="p-2 border font-mono text-[11px]">{it.batch_number}</td>
                      <td className="p-2 border text-center font-mono">{it.quantity} {it.unit}</td>
                      <td className="p-2 border text-right font-mono">{formatINR(it.rate)}</td>
                      <td className="p-2 border text-right font-mono">{it.gst_rate}%</td>
                      <td className="p-2 border text-right font-mono font-bold">{formatINR(it.total_amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 flex justify-between">
                <div>
                  <div>{getTranslation('payment_mode', currentLang)}: <strong>{viewSale.payment_mode}</strong></div>
                  <div>{isMr ? 'दिलेली रक्कम:' : 'Paid Amount:'} <strong className="text-emerald-700">{formatINR(viewSale.paid_amount)}</strong></div>
                  {viewSale.credit_amount > 0 && (
                    <div className="text-rose-700 font-bold">{isMr ? 'उधारी बाकी:' : 'Credit Balance:'} {formatINR(viewSale.credit_amount)}</div>
                  )}
                  {viewSale.notes && <div className="text-slate-500 mt-1">{getTranslation('notes', currentLang)}: {viewSale.notes}</div>}
                </div>
                <div className="text-right">
                  <div className="text-slate-500">{getTranslation('taxable_value', currentLang)}: {formatINR(viewSale.taxable_amount)}</div>
                  <div className="text-slate-500">{isMr ? 'एकूण जीएसटी:' : 'Total GST:'} {formatINR(viewSale.total_tax)}</div>
                  <div className="text-base font-black text-slate-900 mt-1">{getTranslation('grand_total', currentLang)}: {formatINR(viewSale.grand_total)}</div>
                </div>
              </div>
            </div>

            <div className="px-4 py-2.5 bg-slate-100 border-t border-slate-200 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setViewSale(null);
                  handlePrint(viewSale);
                }}
                className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded text-xs font-bold flex items-center gap-1 cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>{getTranslation('print', currentLang)}</span>
              </button>
              <button
                type="button"
                onClick={() => setViewSale(null)}
                className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded text-xs font-semibold cursor-pointer"
              >
                {getTranslation('cancel', currentLang)}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Bill Confirmation Modal */}
      {cancelModalSale && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-rose-200 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95">
            <div className="px-5 py-3.5 bg-rose-800 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-rose-200" />
                <h3 className="font-bold text-sm">
                  {isMr ? 'बिल रद्द करण्याची पुष्टी' : 'Confirm Invoice Cancellation'}
                </h3>
              </div>
              <button 
                type="button" 
                onClick={() => setCancelModalSale(null)} 
                className="text-rose-200 hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-5 space-y-3 text-xs">
              <p className="text-slate-700 leading-relaxed">
                {isMr ? (
                  <>तुम्ही बिल क्र. <strong className="text-slate-900 font-mono">{cancelModalSale.invoice_no}</strong> ({formatINR(cancelModalSale.grand_total)}) रद्द करत आहात.</>
                ) : (
                  <>You are cancelling invoice <strong className="text-slate-900 font-mono">{cancelModalSale.invoice_no}</strong> ({formatINR(cancelModalSale.grand_total)}).</>
                )}
              </p>
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-900 text-[11px] space-y-1">
                <div className="font-bold">{isMr ? 'पुढील बदल स्वयंचलित होतील:' : 'The following changes will occur automatically:'}</div>
                <div>• {isMr ? 'बिलातील सर्व वस्तूंचा साठा पुन्हा गोदामात जमा केला जाईल.' : 'Items will be returned to inventory stock.'}</div>
                <div>• {isMr ? 'शेतकरी उधारी खात्यातून रक्कम वजा केली जाईल.' : 'Customer credit ledger will be adjusted.'}</div>
                <div>• {isMr ? 'रोख भरणा असल्यास रोख नोंदवहीत परतावा नोंदवला जाईल.' : 'Cash register will record the reversal.'}</div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {isMr ? 'रद्द करण्याचे कारण' : 'Cancellation Reason'} *:
                </label>
                <textarea
                  rows={2}
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder=""
                  className="w-full p-2 border border-slate-300 rounded focus:outline-rose-600 text-xs"
                />
              </div>
            </div>

            <div className="px-5 py-3 bg-slate-100 border-t border-slate-200 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setCancelModalSale(null)}
                className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded text-xs font-semibold cursor-pointer"
              >
                {getTranslation('cancel', currentLang)}
              </button>
              <button
                type="button"
                onClick={confirmCancelSale}
                className="px-4 py-1.5 bg-rose-700 hover:bg-rose-800 text-white rounded text-xs font-bold flex items-center gap-1 cursor-pointer"
              >
                <Ban className="w-3.5 h-3.5" />
                <span>{isMr ? 'बिल रद्द करा' : 'Confirm Cancel'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Print Modal */}
      {printSale && businessSettings && invoiceSettings && (
        <PrintInvoiceModal
          currentLang={currentLang}
          sale={printSale}
          businessSettings={businessSettings}
          invoiceSettings={invoiceSettings}
          onClose={() => setPrintSale(null)}
        />
      )}
    </div>
  );
};
