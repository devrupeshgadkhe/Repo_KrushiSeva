import React, { useState, useEffect } from 'react';
import { 
  Boxes, 
  AlertTriangle, 
  Clock, 
  Search, 
  SlidersHorizontal, 
  Download, 
  Plus, 
  CheckCircle2, 
  XCircle, 
  RefreshCw,
  Edit,
  ArrowUpDown
} from 'lucide-react';
import { AppLanguage, ProductBatch } from '../types';
import { getTranslation } from '../i18n';
import { formatINR, formatDate, exportToCSV } from '../utils/formatters';
import { dbService } from '../services/api';
import { useFeedback } from '../components/common/FeedbackContext';

interface InventoryProps {
  currentLang: AppLanguage;
  onRefreshData?: () => void;
}

export const Inventory: React.FC<InventoryProps> = ({ currentLang, onRefreshData }) => {
  const { showToast } = useFeedback();
  const isMr = currentLang === 'mr';

  const [batches, setBatches] = useState<ProductBatch[]>([]);
  const [filterType, setFilterType] = useState<'all' | 'low_stock' | 'near_expiry' | 'expired'>('all');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);

  // Stock Adjustment Modal
  const [adjustBatch, setAdjustBatch] = useState<ProductBatch | null>(null);
  const [newPhysicalQty, setNewPhysicalQty] = useState<number>(0);
  const [adjustReason, setAdjustReason] = useState('Physical Verification');

  const loadBatches = async () => {
    setLoading(true);
    try {
      const list = await dbService.getInventoryBatches({
        status: filterType,
        category: categoryFilter,
        search,
      });
      setBatches(list);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBatches();
  }, [filterType, categoryFilter, search]);

  const handleOpenAdjust = (b: ProductBatch) => {
    setAdjustBatch(b);
    setNewPhysicalQty(b.current_qty);
    setAdjustReason(isMr ? 'प्रत्यक्ष मोजणीत फरक' : 'Physical Verification Difference');
  };

  const confirmStockAdjustment = async () => {
    if (!adjustBatch) return;
    try {
      await dbService.adjustBatchStock(
        adjustBatch.id,
        newPhysicalQty,
        adjustReason,
        1
      );
      setAdjustBatch(null);
      loadBatches();
      onRefreshData?.();
      showToast(isMr ? 'साठा यशस्वीरित्या अद्यतनित केला.' : 'Stock adjusted successfully.', 'success');
    } catch (err: any) {
      showToast(err.message || (isMr ? 'साठा अद्यतनित करताना त्रुटी आली.' : 'Error adjusting stock.'), 'error');
    }
  };

  const handleExportCSV = () => {
    const data = batches.map((b) => ({
      Product: b.product_name,
      Category: b.product_category,
      'Batch Number': b.batch_number,
      'Current Qty': b.current_qty,
      Unit: b.unit,
      'Expiry Date': b.expiry_date,
      'Days to Expiry': b.days_to_expiry,
      Status: b.status,
      'Purchase Rate': b.purchase_rate,
      'Selling Rate': b.selling_rate,
      MRP: b.mrp,
      'Stock Valuation (Cost)': b.current_qty * b.purchase_rate,
      Godown: b.godown_location || '',
    }));
    exportToCSV(`Stock_Batch_Register_${new Date().toISOString().slice(0, 10)}`, data);
  };

  const totalStockQty = batches.reduce((acc, b) => acc + b.current_qty, 0);
  const totalValuationCost = batches.reduce((acc, b) => acc + (b.current_qty * b.purchase_rate), 0);
  const totalValuationMrp = batches.reduce((acc, b) => acc + (b.current_qty * b.mrp), 0);

  const categories = [
    { value: 'All', mr: 'सर्व प्रकार', en: 'All Categories' },
    { value: 'Fertilizers', mr: 'रासायनिक खते', en: 'Fertilizers' },
    { value: 'Seeds', mr: 'बियाणे', en: 'Seeds' },
    { value: 'Pesticides', mr: 'कीटकनाशके', en: 'Pesticides' },
    { value: 'Bio Fertilizers', mr: 'सेंद्रिय खते व टॉनिक', en: 'Bio Fertilizers' },
    { value: 'Equipment', mr: 'कृषी अवजारे व इतर', en: 'Equipment' },
  ];

  const adjustReasons = [
    { mr: 'प्रत्यक्ष मोजणीत फरक', en: 'Physical Verification Difference' },
    { mr: 'नुकसान / गळती', en: 'Damage / Leakage Write-off' },
    { mr: 'मुदत संपल्यामुळे कंपनीला परत', en: 'Expired Return to Supplier' },
    { mr: 'आरंभी साठा दुरुस्ती', en: 'Opening Balance Correction' },
  ];

  return (
    <div className="flex-1 p-6 overflow-y-auto space-y-4">
      {/* Top Header & Valuation KPIs */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-800">
              {getTranslation('nav_inventory', currentLang)}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {isMr 
                ? 'साठा व्यवस्थापन, मुदत समाप्ती प्राधान्य व गोदाम नोंद' 
                : 'Stock batch management, expiry tracking and physical reconciliation'}
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
              onClick={loadBatches}
              className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Valuation Summary Ribbon */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t border-slate-100 text-xs">
          <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
            <span className="text-slate-500">{isMr ? 'एकूण साठा नग:' : 'Total Stock Qty:'} </span>
            <strong className="font-mono text-slate-800 text-sm">{totalStockQty}</strong>
          </div>
          <div className="bg-emerald-50 p-2.5 rounded-lg border border-emerald-200">
            <span className="text-emerald-800 font-semibold">{isMr ? 'खरेदी मूल्यानुसार साठा:' : 'Valuation at Purchase Cost:'} </span>
            <strong className="font-mono text-emerald-950 text-sm">{formatINR(totalValuationCost)}</strong>
          </div>
          <div className="bg-blue-50 p-2.5 rounded-lg border border-blue-200">
            <span className="text-blue-800 font-semibold">{isMr ? 'विक्री दर मूल्यानुसार साठा:' : 'Valuation at Selling Price:'} </span>
            <strong className="font-mono text-blue-950 text-sm">{formatINR(totalValuationMrp)}</strong>
          </div>
        </div>

        {/* Filter Badges & Search */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              type="button"
              onClick={() => setFilterType('all')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                filterType === 'all'
                  ? 'bg-slate-800 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {isMr ? `सर्व बॅच (${batches.length})` : `All Batches (${batches.length})`}
            </button>
            <button
              type="button"
              onClick={() => setFilterType('low_stock')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                filterType === 'low_stock'
                  ? 'bg-rose-600 text-white'
                  : 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200'
              }`}
            >
              {getTranslation('low_stock_badge', currentLang)}
            </button>
            <button
              type="button"
              onClick={() => setFilterType('near_expiry')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                filterType === 'near_expiry'
                  ? 'bg-amber-600 text-white'
                  : 'bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200'
              }`}
            >
              {getTranslation('expiring_status', currentLang)}
            </button>
            <button
              type="button"
              onClick={() => setFilterType('expired')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                filterType === 'expired'
                  ? 'bg-red-700 text-white'
                  : 'bg-red-50 text-red-700 hover:bg-red-100 border border-red-200'
              }`}
            >
              {getTranslation('expired_status', currentLang)}
            </button>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-2.5 py-1 text-xs border border-slate-300 rounded-lg bg-slate-50 font-medium"
            >
              {categories.map((c) => (
                <option key={c.value} value={c.value}>
                  {isMr ? c.mr : c.en}
                </option>
              ))}
            </select>

            <div className="relative w-48">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={getTranslation('search_placeholder', currentLang)}
                className="w-full pl-8 pr-2.5 py-1 text-xs bg-slate-50 border border-slate-300 rounded-lg"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
              <tr>
                <th className="p-3">{getTranslation('product_name', currentLang)}</th>
                <th className="p-3">{getTranslation('category', currentLang)}</th>
                <th className="p-3">{getTranslation('batch_number', currentLang)}</th>
                <th className="p-3 text-center">{getTranslation('expiry_date', currentLang)}</th>
                <th className="p-3 text-center">{isMr ? 'मुदत दिवस' : 'Days to Expiry'}</th>
                <th className="p-3 text-center">{getTranslation('stock', currentLang)}</th>
                <th className="p-3 text-right">{getTranslation('purchase_rate', currentLang)}</th>
                <th className="p-3 text-right">{getTranslation('selling_rate', currentLang)}</th>
                <th className="p-3 text-right">{isMr ? 'साठा मूल्य (₹)' : 'Stock Value (₹)'}</th>
                <th className="p-3 text-center">{getTranslation('status', currentLang)}</th>
                <th className="p-3 text-center">{getTranslation('actions', currentLang)}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {batches.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-12 text-center text-slate-400">
                    {getTranslation('no_records_found', currentLang)}
                  </td>
                </tr>
              ) : (
                batches.map((b) => (
                  <tr key={b.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="p-3">
                      <div className="font-bold text-slate-900">{b.product_name}</div>
                      <div className="text-[10px] text-slate-500">
                        {b.godown_location ? `${isMr ? 'गोदाम' : 'Godown'}: ${b.godown_location}` : ''}
                      </div>
                    </td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-700 border border-slate-200">
                        {b.product_category}
                      </span>
                    </td>
                    <td className="p-3 font-mono font-bold text-slate-800">
                      {b.batch_number}
                    </td>
                    <td className="p-3 text-center font-mono text-slate-600">
                      {formatDate(b.expiry_date)}
                    </td>
                    <td className="p-3 text-center font-mono">
                      {b.days_to_expiry < 0 ? (
                        <span className="text-red-700 font-bold">
                          {isMr ? `मुदत संपली (${Math.abs(b.days_to_expiry)} दिवस आधी)` : `Expired (${Math.abs(b.days_to_expiry)} days ago)`}
                        </span>
                      ) : (
                        <span className={b.days_to_expiry <= 90 ? 'text-amber-600 font-bold' : 'text-slate-600'}>
                          {b.days_to_expiry} {isMr ? 'दिवस' : 'days'}
                        </span>
                      )}
                    </td>
                    <td className="p-3 text-center">
                      <span className={`font-mono font-bold text-xs px-2 py-0.5 rounded ${b.current_qty <= 5 ? 'bg-rose-100 text-rose-800' : 'text-slate-900'}`}>
                        {b.current_qty} {b.unit}
                      </span>
                    </td>
                    <td className="p-3 text-right font-mono text-slate-600">
                      {formatINR(b.purchase_rate)}
                    </td>
                    <td className="p-3 text-right font-mono font-bold text-emerald-700">
                      {formatINR(b.selling_rate)}
                    </td>
                    <td className="p-3 text-right font-mono font-semibold text-slate-900">
                      {formatINR(b.current_qty * b.purchase_rate)}
                    </td>
                    <td className="p-3 text-center">
                      {b.status === 'Active' && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 inline-flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>{getTranslation('active_status', currentLang)}</span>
                        </span>
                      )}
                      {b.status === 'Near Expiry' && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 inline-flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          <span>{getTranslation('expiring_status', currentLang)}</span>
                        </span>
                      )}
                      {b.status === 'Expired' && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-50 text-red-700 border border-red-200 inline-flex items-center gap-1">
                          <XCircle className="w-3 h-3" />
                          <span>{getTranslation('expired_status', currentLang)}</span>
                        </span>
                      )}
                    </td>
                    <td className="p-3 text-center">
                      <button
                        type="button"
                        onClick={() => handleOpenAdjust(b)}
                        title={isMr ? 'साठा दुरुस्ती' : 'Adjust Stock'}
                        className="p-1 rounded text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 cursor-pointer"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Stock Adjustment Modal */}
      {adjustBatch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95">
            <div className="px-5 py-3.5 bg-slate-800 text-white flex items-center justify-between">
              <h3 className="font-bold text-sm">
                {isMr ? 'साठा दुरुस्ती व प्रत्यक्ष मोजणी' : 'Stock Adjustment & Physical Count'}
              </h3>
              <button 
                type="button" 
                onClick={() => setAdjustBatch(null)} 
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <div>
                <div className="font-bold text-slate-900 text-sm">{adjustBatch.product_name}</div>
                <div className="text-slate-500 mt-0.5">
                  {getTranslation('batch', currentLang)}: <span className="font-mono font-bold text-slate-700">{adjustBatch.batch_number}</span> | 
                  {isMr ? ' सध्याचा नोंद साठा:' : ' Current Stock:'} <strong className="text-slate-800">{adjustBatch.current_qty} {adjustBatch.unit}</strong>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  {isMr ? 'प्रत्यक्ष मोजलेला साठा' : 'Physical Verified Stock Qty'} *
                </label>
                <input
                  type="number"
                  step="any"
                  min="0"
                  value={newPhysicalQty}
                  onChange={(e) => setNewPhysicalQty(parseFloat(e.target.value) || 0)}
                  className="w-full p-2 border border-slate-300 rounded font-mono font-bold text-sm focus:outline-emerald-600"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  {isMr ? 'दुरुस्तीचे कारण' : 'Reason for Adjustment'}:
                </label>
                <select
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded font-medium"
                >
                  {adjustReasons.map((r, i) => (
                    <option key={i} value={isMr ? r.mr : r.en}>
                      {isMr ? r.mr : r.en}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="px-5 py-3 bg-slate-100 border-t border-slate-200 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setAdjustBatch(null)}
                className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded text-xs font-semibold cursor-pointer"
              >
                {getTranslation('cancel', currentLang)}
              </button>
              <button
                type="button"
                onClick={confirmStockAdjustment}
                className="px-4 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded text-xs font-bold cursor-pointer"
              >
                {getTranslation('save', currentLang)}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
