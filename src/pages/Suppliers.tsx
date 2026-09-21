import React, { useState, useEffect } from 'react';
import { 
  Truck, 
  Plus, 
  Search, 
  Download, 
  Wallet, 
  Edit, 
  FileText, 
  RefreshCw,
  ArrowUpRight,
  Printer
} from 'lucide-react';
import { AppLanguage, Supplier, LedgerEntry, PaymentMode, BusinessSettings } from '../types';
import { getTranslation } from '../i18n';
import { formatINR, formatDate, exportToCSV } from '../utils/formatters';
import { dbService } from '../services/api';
import { useFeedback } from '../components/common/FeedbackContext';

interface SuppliersProps {
  currentLang: AppLanguage;
  onRefreshData?: () => void;
  preselectedId?: number;
}

export const Suppliers: React.FC<SuppliersProps> = ({ currentLang, onRefreshData, preselectedId }) => {
  const isMr = currentLang === 'mr';
  const { showToast } = useFeedback();
  const [businessSettings, setBusinessSettings] = useState<BusinessSettings | null>(null);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);

  useEffect(() => {
    dbService.getBusinessSettings().then(setBusinessSettings).catch(console.error);
  }, []);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);

  // Selected Supplier & Ledger
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [ledgerEntries, setLedgerEntries] = useState<LedgerEntry[]>([]);

  // Add / Edit Modal
  const [showModal, setShowModal] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [name, setName] = useState('');
  const [company, setCompany] = useState('');
  const [mobile, setMobile] = useState('');
  const [email, setEmail] = useState('');
  const [gstin, setGstin] = useState('');
  const [city, setCity] = useState('');
  const [openingBalance, setOpeningBalance] = useState<number>(0);

  // Pay Supplier Modal
  const [showPayModal, setShowPayModal] = useState(false);
  const [payAmount, setPayAmount] = useState<number>(0);
  const [payMode, setPayMode] = useState<PaymentMode>('Bank Transfer');
  const [payNotes, setPayNotes] = useState('');
  const [payDate, setPayDate] = useState(new Date().toISOString().split('T')[0]);

  const loadSuppliers = async () => {
    setLoading(true);
    try {
      const list = await dbService.getSuppliers(search);
      setSuppliers(list);

      if (preselectedId) {
        const match = list.find((s) => s.id === preselectedId);
        if (match) handleSelectSupplier(match);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSuppliers();
  }, [search]);

  const handleSelectSupplier = async (sup: Supplier) => {
    setSelectedSupplier(sup);
    try {
      const ledger = await dbService.getSupplierLedger(sup.id);
      setLedgerEntries(ledger);
    } catch (e) {
      console.error(e);
    }
  };

  const handleOpenAdd = () => {
    setEditingSupplier(null);
    setName('');
    setCompany('');
    setMobile('');
    setEmail('');
    setGstin('');
    setCity('');
    setOpeningBalance(0);
    setShowModal(true);
  };

  const handleOpenEdit = (s: Supplier) => {
    setEditingSupplier(s);
    setName(s.name);
    setCompany(s.company);
    setMobile(s.mobile);
    setEmail(s.email || '');
    setGstin(s.gstin || '');
    setCity(s.city || '');
    setOpeningBalance(s.opening_balance);
    setShowModal(true);
  };

  const handleSaveSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !company.trim()) {
      showToast(currentLang === 'mr' ? 'कृपया संपर्क व्यक्ती व कंपनीचे नाव भरा.' : 'Please enter contact person and company name.', 'warning');
      return;
    }

    try {
      const payload: Partial<Supplier> = {
        name: name.trim(),
        company: company.trim(),
        mobile: mobile.trim(),
        email: email.trim() || undefined,
        gstin: gstin.trim().toUpperCase() || undefined,
        city: city.trim() || undefined,
        opening_balance: openingBalance,
      };

      if (editingSupplier) {
        await dbService.updateSupplier(editingSupplier.id, payload);
        showToast(currentLang === 'mr' ? 'पुरवठादार माहिती अद्यतनित केली.' : 'Supplier updated successfully.', 'success');
      } else {
        await dbService.createSupplier(payload);
        showToast(currentLang === 'mr' ? 'नवीन पुरवठादार नोंदवला गेला.' : 'New supplier added successfully.', 'success');
      }

      setShowModal(false);
      loadSuppliers();
      onRefreshData?.();
    } catch (err: any) {
      showToast(err.message || (currentLang === 'mr' ? 'पुरवठादार माहिती साठवताना त्रुटी आली.' : 'Error saving supplier.'), 'error');
    }
  };

  const handleRecordPayment = async () => {
    if (!selectedSupplier || payAmount <= 0) {
      showToast(currentLang === 'mr' ? 'कृपया योग्य रक्कम प्रविष्ट करा.' : 'Please enter a valid payment amount.', 'warning');
      return;
    }

    try {
      await dbService.recordSupplierPayment(
        selectedSupplier.id,
        payAmount,
        payMode,
        payNotes,
        payDate
      );

      setShowPayModal(false);
      setPayAmount(0);
      setPayNotes('');

      const updated = await dbService.getSupplierById(selectedSupplier.id);
      setSelectedSupplier(updated);
      const ledger = await dbService.getSupplierLedger(selectedSupplier.id);
      setLedgerEntries(ledger);
      loadSuppliers();
      onRefreshData?.();
      showToast(currentLang === 'mr' ? 'पुरवठादार देयक नोंद यशस्वीरित्या पूर्ण झाली.' : 'Supplier payment recorded successfully.', 'success');
    } catch (err: any) {
      showToast(err.message || (currentLang === 'mr' ? 'पेमेंट नोंदवताना त्रुटी आली.' : 'Error recording supplier payment.'), 'error');
    }
  };

  const totalPayable = suppliers.reduce((acc, s) => acc + s.current_balance, 0);

  const handleExportCSV = () => {
    const data = suppliers.map((s) => ({
      Name: s.name,
      Company: s.company,
      Mobile: s.mobile,
      Email: s.email || '',
      GSTIN: s.gstin || '',
      City: s.city || '',
      'Payable Balance': s.current_balance,
    }));
    exportToCSV(`Suppliers_List_${new Date().toISOString().slice(0, 10)}`, data);
  };

  const paymentModes = [
    { value: 'Bank Transfer', mr: 'बँक ट्रान्सफर', en: 'Bank Transfer' },
    { value: 'Cash', mr: 'रोख', en: 'Cash' },
    { value: 'UPI', mr: 'ऑनलाइन / UPI', en: 'Online / UPI' },
  ];

  return (
    <div className="flex-1 p-6 overflow-y-auto space-y-4">
      {/* Header */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-4 no-print">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-800">
              {getTranslation('nav_suppliers', currentLang)}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {currentLang === 'mr' 
                ? 'कंपन्या, डीलर खाती, GSTIN व देयकांचा हिशोब'
                : 'Companies, dealer accounts, GSTIN and payable accounts'}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-lg text-xs">
              <span className="text-amber-800 font-semibold">{getTranslation('total_payables', currentLang)}: </span>
              <strong className="font-mono text-amber-950 font-bold text-sm">{formatINR(totalPayable)}</strong>
            </div>

            <button
              onClick={handleExportCSV}
              className="px-3 py-1.5 rounded-lg border border-slate-300 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{getTranslation('export_csv', currentLang)}</span>
            </button>

            <button
              onClick={handleOpenAdd}
              className="px-3.5 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs flex items-center gap-2 shadow-xs transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>{getTranslation('add_supplier_btn', currentLang)}</span>
            </button>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="relative pt-2 border-t border-slate-100">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-4.5" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={getTranslation('search_supplier_placeholder', currentLang)}
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:outline-emerald-600 font-medium"
          />
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left Column: Suppliers List */}
        <div className="lg:col-span-6 bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden no-print">
          <div className="p-3 bg-slate-50 border-b border-slate-200 font-bold text-xs text-slate-700 flex justify-between">
            <span>{getTranslation('supplier_list_header', currentLang)}</span>
            <span className="font-mono text-slate-500">({suppliers.length})</span>
          </div>
          <div className="max-h-[600px] overflow-y-auto divide-y divide-slate-100">
            {suppliers.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-400">
                {getTranslation('no_suppliers_found', currentLang)}
              </div>
            ) : (
              suppliers.map((s) => {
                const isSelected = selectedSupplier?.id === s.id;
                return (
                  <div
                    key={s.id}
                    onClick={() => handleSelectSupplier(s)}
                    className={`p-3 cursor-pointer transition-colors flex items-center justify-between ${
                      isSelected
                        ? 'bg-amber-50/80 border-l-4 border-amber-600'
                        : 'hover:bg-slate-50'
                    }`}
                  >
                    <div>
                      <div className="font-bold text-xs text-slate-900">{s.company}</div>
                      <div className="text-[11px] text-slate-600 mt-0.5">
                        {getTranslation('contact_person', currentLang)}: <span className="font-medium text-slate-800">{s.name}</span> • {getTranslation('mobile', currentLang)}: <span className="font-mono">{s.mobile}</span>
                      </div>
                      <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                        {s.city ? `${s.city} • ` : ''}GSTIN: {s.gstin || '-'}
                      </div>
                    </div>

                    <div className="text-right">
                      <div className={`font-mono font-bold text-xs ${s.current_balance > 0 ? 'text-amber-700' : 'text-slate-600'}`}>
                        {formatINR(s.current_balance)}
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenEdit(s);
                        }}
                        className="text-[10px] text-slate-400 hover:text-emerald-700 underline mt-0.5 cursor-pointer block"
                      >
                        {getTranslation('edit', currentLang)}
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Ledger Statement & Payment */}
        <div className="lg:col-span-6 print:col-span-12 print:w-full flex flex-col gap-4">
          {selectedSupplier ? (
            <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden flex flex-col print:border-none print:shadow-none">
              {/* Clean Print Header for Physical Print / PDF */}
              <div className="hidden print:block mb-3 border-b-2 border-slate-900 pb-2">
                <div className="flex justify-between items-start">
                  <div>
                    <h1 className="text-base font-black text-slate-900">
                      {isMr && businessSettings?.shop_name_mr ? businessSettings.shop_name_mr : (businessSettings?.shop_name || 'कृषी सेवा केंद्र')}
                    </h1>
                    <p className="text-[11px] text-slate-700">{businessSettings?.address}, {businessSettings?.village_city}, {businessSettings?.district}</p>
                    <p className="text-[10px] text-slate-600">GSTIN: {businessSettings?.gstin || '-'} | Phone: {businessSettings?.mobile || '-'}</p>
                  </div>
                  <div className="text-right">
                    <div className="text-xs font-black uppercase text-emerald-950">
                      {isMr ? 'कंपनी / पुरवठादार खातेवही लेजर' : 'SUPPLIER / COMPANY LEDGER STATEMENT'}
                    </div>
                    <div className="text-[10px] text-slate-600">
                      {isMr ? 'तारीख:' : 'Date:'} {new Date().toLocaleDateString('en-IN')}
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-slate-800 text-white flex items-center justify-between print:bg-white print:text-black print:border-b-2 print:border-slate-800">
                <div>
                  <h3 className="font-bold text-sm text-white print:text-black">{selectedSupplier.company}</h3>
                  <p className="text-[11px] text-amber-300 mt-0.5 print:text-slate-700">
                    {selectedSupplier.name} • <span className="font-mono">{selectedSupplier.mobile}</span> • GSTIN: {selectedSupplier.gstin || '-'}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <div className="text-right mr-2">
                    <div className="text-[10px] text-slate-400 print:text-slate-600">{getTranslation('payable_due', currentLang)}:</div>
                    <div className="font-mono font-bold text-base text-amber-300 print:text-rose-700">
                      {formatINR(selectedSupplier.current_balance)}
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      setPayAmount(selectedSupplier.current_balance > 0 ? selectedSupplier.current_balance : 0);
                      setShowPayModal(true);
                    }}
                    className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-lg text-xs flex items-center gap-1.5 shadow-xs cursor-pointer no-print"
                  >
                    <Wallet className="w-3.5 h-3.5" />
                    <span>{getTranslation('pay_supplier_btn', currentLang)}</span>
                  </button>
                </div>
              </div>

              {/* Ledger Statement */}
              <div className="p-3 print:p-0">
                <div className="border border-slate-200 rounded-xl overflow-hidden print:border-slate-400">
                  <div className="bg-slate-100 p-2.5 px-3 flex items-center justify-between text-xs font-bold text-slate-700 print:bg-slate-200">
                    <span>{getTranslation('supplier_ledger_statement', currentLang)}</span>
                    <button 
                      onClick={() => window.print()}
                      className="text-slate-600 hover:text-slate-900 flex items-center gap-1 text-[11px] cursor-pointer no-print"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      <span>{getTranslation('print', currentLang)}</span>
                    </button>
                  </div>

                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                      <tr>
                        <th className="p-2.5">{getTranslation('date', currentLang)}</th>
                        <th className="p-2.5">{getTranslation('description', currentLang)}</th>
                        <th className="p-2.5 text-right">{getTranslation('debit', currentLang)}</th>
                        <th className="p-2.5 text-right">{getTranslation('credit', currentLang)}</th>
                        <th className="p-2.5 text-right">{getTranslation('balance', currentLang)}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {ledgerEntries.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-8 text-center text-slate-400">
                            {getTranslation('no_transactions_found', currentLang)}
                          </td>
                        </tr>
                      ) : (
                        ledgerEntries.map((le) => (
                          <tr key={le.id} className="hover:bg-slate-50">
                            <td className="p-2.5 font-mono text-slate-600">{formatDate(le.entry_date)}</td>
                            <td className="p-2.5">
                              <div className="font-semibold text-slate-800">{le.description}</div>
                              {le.reference_no && <div className="text-[10px] text-slate-500 font-mono">{le.reference_no}</div>}
                            </td>
                            <td className="p-2.5 text-right font-mono font-bold text-emerald-700">
                              {le.debit_amount > 0 ? formatINR(le.debit_amount) : '-'}
                            </td>
                            <td className="p-2.5 text-right font-mono font-bold text-amber-700">
                              {le.credit_amount > 0 ? formatINR(le.credit_amount) : '-'}
                            </td>
                            <td className="p-2.5 text-right font-mono font-bold text-slate-900">
                              {formatINR(le.running_balance)}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-400 shadow-2xs">
              <Truck className="w-12 h-12 mx-auto mb-2 text-slate-300" />
              <div className="text-sm font-semibold text-slate-600">{getTranslation('select_supplier_to_view_ledger', currentLang)}</div>
              <div className="text-xs text-slate-400 mt-1">{getTranslation('supplier_ledger_instruction', currentLang)}</div>
            </div>
          )}
        </div>
      </div>

      {/* Add / Edit Supplier Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden my-6">
            <div className="px-5 py-3.5 bg-slate-800 text-white flex items-center justify-between">
              <h3 className="font-bold text-sm">
                {editingSupplier ? getTranslation('edit_supplier_title', currentLang) : getTranslation('add_supplier_title', currentLang)}
              </h3>
              <button 
                type="button" 
                onClick={() => setShowModal(false)} 
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveSupplier} className="p-5 space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  {getTranslation('company_name', currentLang)} *
                </label>
                <input
                  type="text"
                  required
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  placeholder=""
                  className="w-full p-2 border border-slate-300 rounded focus:outline-emerald-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    {getTranslation('contact_person', currentLang)} *
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder=""
                    className="w-full p-2 border border-slate-300 rounded"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    {getTranslation('mobile', currentLang)} *
                  </label>
                  <input
                    type="tel"
                    required
                    value={mobile}
                    onChange={(e) => setMobile(e.target.value)}
                    placeholder=""
                    className="w-full p-2 border border-slate-300 rounded font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    {getTranslation('gstin', currentLang)}
                  </label>
                  <input
                    type="text"
                    value={gstin}
                    onChange={(e) => setGstin(e.target.value)}
                    placeholder=""
                    className="w-full p-2 border border-slate-300 rounded font-mono uppercase"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    {getTranslation('city', currentLang)}
                  </label>
                  <input
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder=""
                    className="w-full p-2 border border-slate-300 rounded"
                  />
                </div>
              </div>

              {!editingSupplier && (
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    {getTranslation('opening_payable', currentLang)} (₹)
                  </label>
                  <input
                    type="number"
                    value={openingBalance || ''}
                    onChange={(e) => setOpeningBalance(parseFloat(e.target.value) || 0)}
                    placeholder="0"
                    className="w-full p-2 border border-slate-300 rounded font-mono"
                  />
                </div>
              )}

              <div className="px-5 py-3 bg-slate-100 -mx-5 -mb-5 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded text-xs font-semibold cursor-pointer"
                >
                  {getTranslation('cancel', currentLang)}
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded text-xs font-bold cursor-pointer"
                >
                  {getTranslation('save', currentLang)}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Record Payment to Supplier Modal */}
      {showPayModal && selectedSupplier && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95">
            <div className="px-5 py-3.5 bg-amber-800 text-white flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm">{getTranslation('pay_supplier_modal_title', currentLang)}</h3>
                <p className="text-[11px] text-amber-200">{selectedSupplier.company}</p>
              </div>
              <button 
                type="button" 
                onClick={() => setShowPayModal(false)} 
                className="text-amber-200 hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <div className="bg-amber-50 p-2.5 rounded-lg border border-amber-200 flex justify-between items-center">
                <span className="text-amber-900 font-semibold">{getTranslation('payable_due', currentLang)}:</span>
                <span className="font-mono font-bold text-amber-800 text-sm">{formatINR(selectedSupplier.current_balance)}</span>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  {getTranslation('paid_amount', currentLang)} (₹) *
                </label>
                <input
                  type="number"
                  step="any"
                  value={payAmount || ''}
                  onChange={(e) => setPayAmount(parseFloat(e.target.value) || 0)}
                  placeholder="0"
                  className="w-full p-2 border border-slate-300 rounded font-mono font-black text-slate-900 text-base focus:outline-amber-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    {getTranslation('payment_mode', currentLang)}
                  </label>
                  <select
                    value={payMode}
                    onChange={(e) => setPayMode(e.target.value as PaymentMode)}
                    className="w-full p-2 border border-slate-300 rounded font-semibold"
                  >
                    {paymentModes.map((pm) => (
                      <option key={pm.value} value={pm.value}>
                        {currentLang === 'mr' ? pm.mr : pm.en}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    {getTranslation('date', currentLang)}
                  </label>
                  <input
                    type="date"
                    value={payDate}
                    onChange={(e) => setPayDate(e.target.value)}
                    className="w-full p-2 border border-slate-300 rounded font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  {getTranslation('payment_notes', currentLang)}
                </label>
                <input
                  type="text"
                  value={payNotes}
                  onChange={(e) => setPayNotes(e.target.value)}
                  placeholder=""
                  className="w-full p-2 border border-slate-300 rounded"
                />
              </div>
            </div>

            <div className="px-5 py-3 bg-slate-100 border-t border-slate-200 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowPayModal(false)}
                className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded text-xs font-semibold cursor-pointer"
              >
                {getTranslation('cancel', currentLang)}
              </button>
              <button
                type="button"
                onClick={handleRecordPayment}
                className="px-4 py-1.5 bg-amber-700 hover:bg-amber-800 text-white rounded text-xs font-bold cursor-pointer"
              >
                {getTranslation('save_payment_btn', currentLang)}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
