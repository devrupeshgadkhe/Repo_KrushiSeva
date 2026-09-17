import React, { useState, useEffect } from 'react';
import { 
  WalletCards, 
  Plus, 
  Search, 
  Download, 
  ArrowDownLeft, 
  ArrowUpRight, 
  Calendar, 
  DollarSign,
  TrendingDown,
  FileText,
  RefreshCw
} from 'lucide-react';
import { AppLanguage, Expense, CashTransaction } from '../types';
import { getTranslation } from '../i18n';
import { formatINR, formatDate, exportToCSV } from '../utils/formatters';
import { dbService } from '../services/api';

interface ExpensesCashProps {
  currentLang: AppLanguage;
  onRefreshData?: () => void;
}

export const ExpensesCash: React.FC<ExpensesCashProps> = ({ currentLang, onRefreshData }) => {
  const isMr = currentLang === 'mr';

  const [cashBalance, setCashBalance] = useState(0);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [cashLogs, setCashLogs] = useState<CashTransaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'cashbook' | 'expenses'>('cashbook');

  // Expense Categories (Clean translated array)
  const categories = [
    { key: 'hamali', mr: 'हमाली व उतराई', en: 'Hamali / Labor' },
    { key: 'rent', mr: 'दुकान भाडे', en: 'Store Rent' },
    { key: 'electricity', mr: 'लाईट बिल', en: 'Electricity' },
    { key: 'transport', mr: 'वाहतूक खर्च', en: 'Freight & Transport' },
    { key: 'tea_snacks', mr: 'चहा-पाणी व नाश्ता', en: 'Tea & Refreshment' },
    { key: 'salary', mr: 'कर्मचारी पगार', en: 'Staff Salary' },
    { key: 'stationery', mr: 'प्रिंटिंग व स्टेशनरी', en: 'Printing & Stationery' },
    { key: 'misc', mr: 'इतर किरकोळ खर्च', en: 'Miscellaneous' },
  ];

  // New Expense Modal State (Clean, no hardcoded values)
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [expCategory, setExpCategory] = useState(categories[0].mr);
  const [expAmount, setExpAmount] = useState<number>(0);
  const [expDate, setExpDate] = useState(new Date().toISOString().split('T')[0]);
  const [expPayMode, setExpPayMode] = useState<'Cash' | 'Bank' | 'UPI'>('Cash');
  const [expPaidTo, setExpPaidTo] = useState('');
  const [expDescription, setExpDescription] = useState('');

  const loadData = async () => {
    setLoading(true);
    try {
      const [cash, expList, logs] = await Promise.all([
        dbService.getCashInHand(),
        dbService.getExpenses(),
        dbService.getCashTransactions(),
      ]);
      setCashBalance(cash);
      setExpenses(expList);
      setCashLogs(logs);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSaveExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (expAmount <= 0) {
      alert(isMr ? 'कृपया योग्य रक्कम भरा.' : 'Please enter a valid amount.');
      return;
    }

    try {
      await dbService.createExpense({
        expense_date: expDate,
        category: expCategory,
        amount: expAmount,
        payment_mode: expPayMode,
        paid_to: expPaidTo.trim() || undefined,
        description: expDescription.trim() || undefined,
        created_by: 1,
      });

      setShowExpenseModal(false);
      setExpAmount(0);
      setExpPaidTo('');
      setExpDescription('');
      loadData();
      onRefreshData?.();
      alert(isMr ? 'खर्च यशस्वीरित्या नोंदवला गेला.' : 'Expense recorded successfully.');
    } catch (err: any) {
      alert(err.message || (isMr ? 'खर्च नोंदवताना त्रुटी आली.' : 'Error recording expense.'));
    }
  };

  const handleExportCSV = () => {
    if (activeTab === 'cashbook') {
      const data = cashLogs.map((c) => ({
        Date: c.transaction_date,
        Type: c.type,
        Category: c.category,
        Amount: c.amount,
        'Balance After': c.balance_after,
        Description: c.description || '',
      }));
      exportToCSV(`Cashbook_${new Date().toISOString().slice(0, 10)}`, data);
    } else {
      const data = expenses.map((e) => ({
        Date: e.expense_date,
        Category: e.category,
        Amount: e.amount,
        'Payment Mode': e.payment_mode,
        'Paid To': e.paid_to || '',
        Description: e.description || '',
      }));
      exportToCSV(`Expenses_${new Date().toISOString().slice(0, 10)}`, data);
    }
  };

  const totalExpenseMonth = expenses.reduce((acc, e) => acc + e.amount, 0);

  const paymentModes = [
    { value: 'Cash', mr: 'रोख', en: 'Cash' },
    { value: 'UPI', mr: 'ऑनलाइन / UPI', en: 'Online / UPI' },
    { value: 'Bank', mr: 'बँक', en: 'Bank' },
  ];

  return (
    <div className="flex-1 p-6 overflow-y-auto space-y-4">
      {/* Header */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-800">
              {getTranslation('nav_expenses', currentLang)}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {isMr 
                ? 'दुकान खर्च, कॅश जमा-खर्च व रोजकीर्द हिशोब' 
                : 'Store expenses, cash inflows-outflows and daily register'}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* Cash in Hand Pill */}
            <div className="bg-emerald-50 border border-emerald-300 px-3 py-1.5 rounded-lg text-xs flex items-center gap-2">
              <span className="text-emerald-800 font-semibold">{getTranslation('cash_in_hand', currentLang)}:</span>
              <strong className="font-mono text-emerald-950 font-bold text-base">{formatINR(cashBalance)}</strong>
            </div>

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
              onClick={() => {
                setExpAmount(0);
                setExpPaidTo('');
                setExpDescription('');
                setShowExpenseModal(true);
              }}
              className="px-3.5 py-2 rounded-lg bg-rose-700 hover:bg-rose-800 text-white font-bold text-xs flex items-center gap-2 shadow-xs transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>{getTranslation('add_expense', currentLang)}</span>
            </button>
          </div>
        </div>

        {/* Tab Toggle */}
        <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
          <button
            type="button"
            onClick={() => setActiveTab('cashbook')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
              activeTab === 'cashbook'
                ? 'bg-slate-800 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {getTranslation('cash_register_tab', currentLang)}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('expenses')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
              activeTab === 'expenses'
                ? 'bg-slate-800 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {getTranslation('expense_vouchers_tab', currentLang)}
          </button>
        </div>
      </div>

      {/* Tables based on tab */}
      {activeTab === 'cashbook' ? (
        <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
          <div className="p-3 bg-slate-50 border-b border-slate-200 font-bold text-xs text-slate-700 flex justify-between">
            <span>{isMr ? 'कॅश जमा व खर्च नोंदवही' : 'Cash Inflows & Outflows Register'}</span>
            <span className="font-mono text-emerald-800 font-bold">
              {getTranslation('cash_balance', currentLang)}: {formatINR(cashBalance)}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                <tr>
                  <th className="p-3">{getTranslation('date', currentLang)}</th>
                  <th className="p-3">{isMr ? 'प्रकार' : 'Type'}</th>
                  <th className="p-3">{getTranslation('expense_category', currentLang)}</th>
                  <th className="p-3">{getTranslation('description', currentLang)}</th>
                  <th className="p-3 text-right text-emerald-700">{getTranslation('inflow_label', currentLang)}</th>
                  <th className="p-3 text-right text-rose-700">{getTranslation('outflow_label', currentLang)}</th>
                  <th className="p-3 text-right font-mono">{getTranslation('cash_balance', currentLang)} (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {cashLogs.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400">
                      {getTranslation('no_records_found', currentLang)}
                    </td>
                  </tr>
                ) : (
                  cashLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50">
                      <td className="p-3 font-mono text-slate-600">{formatDate(log.transaction_date)}</td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${log.type === 'Inflow' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'}`}>
                          {log.type === 'Inflow' ? (isMr ? '+ जमा' : '+ Inflow') : (isMr ? '- खर्च' : '- Outflow')}
                        </span>
                      </td>
                      <td className="p-3 font-medium text-slate-700">{log.category}</td>
                      <td className="p-3 text-slate-800">{log.description}</td>
                      <td className="p-3 text-right font-mono font-bold text-emerald-700">
                        {log.type === 'Inflow' ? formatINR(log.amount) : '-'}
                      </td>
                      <td className="p-3 text-right font-mono font-bold text-rose-700">
                        {log.type === 'Outflow' ? formatINR(log.amount) : '-'}
                      </td>
                      <td className="p-3 text-right font-mono font-bold text-slate-900">
                        {formatINR(log.balance_after)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
          <div className="p-3 bg-slate-50 border-b border-slate-200 font-bold text-xs text-slate-700 flex justify-between">
            <span>{isMr ? 'दुकान खर्च व्हाऊचर्स' : 'Expense Vouchers'}</span>
            <span className="font-mono text-rose-800 font-bold">
              {isMr ? 'एकूण खर्च:' : 'Total Expense:'} {formatINR(totalExpenseMonth)}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                <tr>
                  <th className="p-3">{getTranslation('date', currentLang)}</th>
                  <th className="p-3">{getTranslation('expense_category', currentLang)}</th>
                  <th className="p-3">{getTranslation('paid_to_label', currentLang)}</th>
                  <th className="p-3">{getTranslation('payment_mode', currentLang)}</th>
                  <th className="p-3">{getTranslation('description', currentLang)}</th>
                  <th className="p-3 text-right font-bold">{getTranslation('expense_amount', currentLang)}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {expenses.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-400">
                      {getTranslation('no_records_found', currentLang)}
                    </td>
                  </tr>
                ) : (
                  expenses.map((e) => (
                    <tr key={e.id} className="hover:bg-slate-50">
                      <td className="p-3 font-mono text-slate-600">{formatDate(e.expense_date)}</td>
                      <td className="p-3 font-bold text-slate-900">{e.category}</td>
                      <td className="p-3 text-slate-700 font-medium">{e.paid_to || '-'}</td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-700 border border-slate-200">
                          {e.payment_mode}
                        </span>
                      </td>
                      <td className="p-3 text-slate-600">{e.description || '-'}</td>
                      <td className="p-3 text-right font-mono font-bold text-rose-700 text-sm">
                        {formatINR(e.amount)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add Expense Modal */}
      {showExpenseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95">
            <div className="px-5 py-3.5 bg-rose-800 text-white flex items-center justify-between">
              <h3 className="font-bold text-sm">
                {isMr ? 'दुकान खर्च नोंद' : 'Record Expense'}
              </h3>
              <button 
                type="button" 
                onClick={() => setShowExpenseModal(false)} 
                className="text-rose-200 hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveExpense} className="p-5 space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  {getTranslation('expense_category', currentLang)} *
                </label>
                <select
                  value={expCategory}
                  onChange={(e) => setExpCategory(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded font-medium"
                >
                  {categories.map((c) => (
                    <option key={c.key} value={isMr ? c.mr : c.en}>
                      {isMr ? c.mr : c.en}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  {getTranslation('expense_amount', currentLang)} *
                </label>
                <input
                  type="number"
                  step="any"
                  required
                  min="1"
                  value={expAmount || ''}
                  onChange={(e) => setExpAmount(parseFloat(e.target.value) || 0)}
                  placeholder="0"
                  className="w-full p-2 border border-slate-300 rounded font-mono font-bold text-rose-700 text-sm focus:outline-rose-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    {getTranslation('payment_mode', currentLang)}:
                  </label>
                  <select
                    value={expPayMode}
                    onChange={(e) => setExpPayMode(e.target.value as any)}
                    className="w-full p-2 border border-slate-300 rounded font-medium"
                  >
                    {paymentModes.map((pm) => (
                      <option key={pm.value} value={pm.value}>
                        {isMr ? pm.mr : pm.en}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    {getTranslation('date', currentLang)}:
                  </label>
                  <input
                    type="date"
                    value={expDate}
                    onChange={(e) => setExpDate(e.target.value)}
                    className="w-full p-2 border border-slate-300 rounded font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  {getTranslation('paid_to_label', currentLang)}:
                </label>
                <input
                  type="text"
                  value={expPaidTo}
                  onChange={(e) => setExpPaidTo(e.target.value)}
                  placeholder=""
                  className="w-full p-2 border border-slate-300 rounded"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  {getTranslation('description', currentLang)}:
                </label>
                <input
                  type="text"
                  value={expDescription}
                  onChange={(e) => setExpDescription(e.target.value)}
                  placeholder=""
                  className="w-full p-2 border border-slate-300 rounded"
                />
              </div>

              <div className="px-5 py-3 bg-slate-100 -mx-5 -mb-5 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowExpenseModal(false)}
                  className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded text-xs font-semibold cursor-pointer"
                >
                  {getTranslation('cancel', currentLang)}
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-rose-700 hover:bg-rose-800 text-white rounded text-xs font-bold cursor-pointer"
                >
                  {getTranslation('save', currentLang)}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
