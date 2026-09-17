import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Plus, 
  Search, 
  Download, 
  Wallet, 
  CreditCard, 
  Printer, 
  Edit, 
  FileText, 
  CheckCircle2, 
  RefreshCw,
  ArrowDownRight,
  ArrowUpRight
} from 'lucide-react';
import { AppLanguage, Customer, LedgerEntry, PaymentMode } from '../types';
import { getTranslation } from '../i18n';
import { formatINR, formatDate, exportToCSV } from '../utils/formatters';
import { dbService } from '../services/api';

interface FarmersProps {
  currentLang: AppLanguage;
  onRefreshData?: () => void;
  preselectedId?: number;
}

export const Farmers: React.FC<FarmersProps> = ({ currentLang, onRefreshData, preselectedId }) => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState('');
  const [villageFilter, setVillageFilter] = useState('All');
  const [onlyBalance, setOnlyBalance] = useState(false);
  const [loading, setLoading] = useState(false);

  // Selected Farmer Ledger View
  const [selectedFarmer, setSelectedFarmer] = useState<Customer | null>(null);
  const [ledgerEntries, setLedgerEntries] = useState<LedgerEntry[]>([]);

  // Add/Edit Farmer Modal
  const [showFarmerModal, setShowFarmerModal] = useState(false);
  const [editingFarmer, setEditingFarmer] = useState<Customer | null>(null);
  const [name, setName] = useState('');
  const [nameMr, setNameMr] = useState('');
  const [mobile, setMobile] = useState('');
  const [village, setVillage] = useState('');
  const [taluka, setTaluka] = useState('');
  const [landAcreage, setLandAcreage] = useState<number>(0);
  const [cropsGrown, setCropsGrown] = useState('');
  const [creditLimit, setCreditLimit] = useState<number>(0);
  const [openingBalance, setOpeningBalance] = useState<number>(0);

  // Collect Payment Modal
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [paymentMode, setPaymentMode] = useState<PaymentMode>('Cash');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);

  const loadCustomers = async () => {
    setLoading(true);
    try {
      const list = await dbService.getCustomers(search, villageFilter);
      setCustomers(list);

      if (preselectedId) {
        const match = list.find((c) => c.id === preselectedId);
        if (match) handleSelectFarmer(match);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCustomers();
  }, [search, villageFilter]);

  const handleSelectFarmer = async (farmer: Customer) => {
    setSelectedFarmer(farmer);
    try {
      const ledger = await dbService.getCustomerLedger(farmer.id);
      setLedgerEntries(ledger);
    } catch (e) {
      console.error(e);
    }
  };

  const handleOpenAdd = () => {
    setEditingFarmer(null);
    setName('');
    setNameMr('');
    setMobile('');
    setVillage('');
    setTaluka('');
    setLandAcreage(0);
    setCropsGrown('');
    setCreditLimit(0);
    setOpeningBalance(0);
    setShowFarmerModal(true);
  };

  const handleOpenEdit = (f: Customer) => {
    setEditingFarmer(f);
    setName(f.name);
    setNameMr(f.name_mr || '');
    setMobile(f.mobile);
    setVillage(f.village);
    setTaluka(f.taluka || '');
    setLandAcreage(f.land_acreage || 0);
    setCropsGrown(f.crops_grown || '');
    setCreditLimit(f.credit_limit);
    setOpeningBalance(f.opening_balance);
    setShowFarmerModal(true);
  };

  const handleSaveFarmer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !mobile.trim()) {
      alert(currentLang === 'mr' ? 'कृपया नाव व मोबाईल नंबर भरा.' : 'Please enter name and mobile number.');
      return;
    }

    try {
      const payload: Partial<Customer> = {
        name: name.trim(),
        name_mr: nameMr.trim() || undefined,
        mobile: mobile.trim(),
        village: village.trim(),
        taluka: taluka.trim() || undefined,
        land_acreage: landAcreage,
        crops_grown: cropsGrown.trim() || undefined,
        credit_limit: creditLimit,
        opening_balance: openingBalance,
      };

      if (editingFarmer) {
        await dbService.updateCustomer(editingFarmer.id, payload);
      } else {
        await dbService.createCustomer(payload);
      }

      setShowFarmerModal(false);
      loadCustomers();
      onRefreshData?.();
    } catch (err: any) {
      alert(err.message || (currentLang === 'mr' ? 'शेतकरी माहिती साठवताना त्रुटी आली.' : 'Error saving customer.'));
    }
  };

  // Record Khata Payment from farmer
  const handleRecordPayment = async () => {
    if (!selectedFarmer || paymentAmount <= 0) {
      alert(currentLang === 'mr' ? 'कृपया योग्य रक्कम प्रविष्ट करा.' : 'Please enter a valid amount.');
      return;
    }

    try {
      await dbService.recordCustomerPayment(
        selectedFarmer.id,
        paymentAmount,
        paymentMode,
        paymentNotes,
        paymentDate
      );

      setShowPaymentModal(false);
      setPaymentAmount(0);
      setPaymentNotes('');

      // Refresh customer and ledger
      const updatedCust = await dbService.getCustomerById(selectedFarmer.id);
      setSelectedFarmer(updatedCust);
      const ledger = await dbService.getCustomerLedger(selectedFarmer.id);
      setLedgerEntries(ledger);
      loadCustomers();
      onRefreshData?.();
      alert(currentLang === 'mr' ? 'उधारी जमा यशस्वीरित्या नोंदवली गेली.' : 'Payment successfully recorded.');
    } catch (err: any) {
      alert(err.message || (currentLang === 'mr' ? 'जमा नोंदवताना त्रुटी आली.' : 'Error recording payment.'));
    }
  };

  const filteredCustomers = customers.filter(
    (c) => !onlyBalance || c.current_balance > 0
  );

  const totalOutstanding = customers.reduce((acc, c) => acc + c.current_balance, 0);

  const handleExportCSV = () => {
    const data = filteredCustomers.map((c) => ({
      Name: c.name,
      'Marathi Name': c.name_mr || '',
      Mobile: c.mobile,
      Village: c.village,
      Taluka: c.taluka || '',
      'Credit Limit': c.credit_limit,
      'Current Balance': c.current_balance,
      Acreage: c.land_acreage || '',
      Crops: c.crops_grown || '',
    }));
    exportToCSV(`Farmers_Khata_List_${new Date().toISOString().slice(0, 10)}`, data);
  };

  const paymentModes = [
    { value: 'Cash', mr: 'रोख', en: 'Cash' },
    { value: 'UPI', mr: 'ऑनलाइन / UPI', en: 'Online / UPI' },
    { value: 'Bank Transfer', mr: 'बँक ट्रान्सफर', en: 'Bank Transfer' },
  ];

  return (
    <div className="flex-1 p-6 overflow-y-auto space-y-4">
      {/* Top Header */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-800">
              {getTranslation('nav_farmers', currentLang)}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {currentLang === 'mr' 
                ? 'खातेवही, उधारी मर्यादा, पीक माहिती व वसुली पावती नोंद'
                : 'Ledger accounts, credit limits, crop details and payment receipts'}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="bg-rose-50 border border-rose-200 px-3 py-1.5 rounded-lg text-xs">
              <span className="text-rose-700 font-semibold">{getTranslation('total_outstanding', currentLang)}: </span>
              <strong className="font-mono text-rose-950 font-bold text-sm">{formatINR(totalOutstanding)}</strong>
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
              <span>{getTranslation('add_farmer_btn', currentLang)}</span>
            </button>
          </div>
        </div>

        {/* Filter Toolbar */}
        <div className="flex flex-col sm:flex-row items-center gap-3 pt-2 border-t border-slate-100">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={getTranslation('search_farmer_placeholder', currentLang)}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:outline-emerald-600 font-medium"
            />
          </div>

          <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={onlyBalance}
              onChange={(e) => setOnlyBalance(e.target.checked)}
              className="rounded text-emerald-600 focus:ring-emerald-500"
            />
            <span>{getTranslation('only_with_balance', currentLang)}</span>
          </label>
        </div>
      </div>

      {/* Main Grid: Farmer List on Left, Selected Ledger on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left Column: Customer List */}
        <div className="lg:col-span-6 bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
          <div className="p-3 bg-slate-50 border-b border-slate-200 font-bold text-xs text-slate-700 flex justify-between">
            <span>{getTranslation('farmer_list_header', currentLang)}</span>
            <span className="font-mono text-slate-500">({filteredCustomers.length})</span>
          </div>
          <div className="max-h-[600px] overflow-y-auto divide-y divide-slate-100">
            {filteredCustomers.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-400">
                {getTranslation('no_farmers_found', currentLang)}
              </div>
            ) : (
              filteredCustomers.map((c) => {
                const isSelected = selectedFarmer?.id === c.id;
                return (
                  <div
                    key={c.id}
                    onClick={() => handleSelectFarmer(c)}
                    className={`p-3 cursor-pointer transition-colors flex items-center justify-between ${
                      isSelected
                        ? 'bg-emerald-50/80 border-l-4 border-emerald-600'
                        : 'hover:bg-slate-50'
                    }`}
                  >
                    <div>
                      <div className="font-bold text-xs text-slate-900">
                        {currentLang === 'mr' && c.name_mr ? c.name_mr : c.name}
                        {c.name_mr && currentLang === 'en' && <span className="text-slate-500 ml-1">({c.name_mr})</span>}
                        {c.name && currentLang === 'mr' && <span className="text-slate-400 text-[11px] ml-1">({c.name})</span>}
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        {getTranslation('village', currentLang)}: <span className="font-medium text-slate-700">{c.village}</span> • {getTranslation('mobile', currentLang)}: <span className="font-mono">{c.mobile}</span>
                      </div>
                      {c.crops_grown && (
                        <div className="text-[10px] text-emerald-800 mt-0.5 font-medium">
                          {getTranslation('crops', currentLang)}: {c.crops_grown}
                        </div>
                      )}
                    </div>

                    <div className="text-right">
                      <div className="text-[10px] text-slate-400 uppercase font-semibold">
                        {getTranslation('balance', currentLang)}
                      </div>
                      <div className={`font-mono font-bold text-xs ${c.current_balance > 0 ? 'text-rose-600' : 'text-emerald-700'}`}>
                        {formatINR(c.current_balance)}
                      </div>
                      {c.credit_limit > 0 && (
                        <div className="text-[10px] text-slate-400 mt-0.5 font-mono">
                          {getTranslation('limit', currentLang)}: {formatINR(c.credit_limit)}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Customer Khata Ledger View */}
        <div className="lg:col-span-6">
          {selectedFarmer ? (
            <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden space-y-4 p-4">
              {/* Profile Card */}
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-sm text-slate-900">
                      {currentLang === 'mr' && selectedFarmer.name_mr ? selectedFarmer.name_mr : selectedFarmer.name}
                    </h3>
                    <button
                      onClick={() => handleOpenEdit(selectedFarmer)}
                      className="p-1 text-slate-400 hover:text-emerald-700 rounded cursor-pointer"
                      title={getTranslation('edit', currentLang)}
                    >
                      <Edit className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    {selectedFarmer.village} {selectedFarmer.taluka ? `, ${selectedFarmer.taluka}` : ''} • {getTranslation('mobile', currentLang)}: <span className="font-mono">{selectedFarmer.mobile}</span>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-slate-600 mt-2">
                    <div>
                      {getTranslation('land_acreage', currentLang)}: <strong className="font-mono">{selectedFarmer.land_acreage || 0}</strong>
                    </div>
                    <div>
                      {getTranslation('credit_limit', currentLang)}: <strong className="font-mono">{formatINR(selectedFarmer.credit_limit)}</strong>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col items-end gap-2 w-full sm:w-auto">
                  <div className="text-right">
                    <div className="text-[10px] text-slate-500 uppercase font-semibold">
                      {getTranslation('current_udhaar_balance', currentLang)}
                    </div>
                    <div className="text-lg font-black font-mono text-rose-600">
                      {formatINR(selectedFarmer.current_balance)}
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      setPaymentAmount(selectedFarmer.current_balance > 0 ? selectedFarmer.current_balance : 0);
                      setShowPaymentModal(true);
                    }}
                    className="w-full sm:w-auto px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-lg text-xs flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
                  >
                    <Wallet className="w-3.5 h-3.5" />
                    <span>{getTranslation('collect_payment_btn', currentLang)}</span>
                  </button>
                </div>
              </div>

              {/* Ledger Statement */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <div className="bg-slate-100 p-2.5 px-3 flex items-center justify-between text-xs font-bold text-slate-700">
                  <span>{getTranslation('khata_ledger_statement', currentLang)}</span>
                  <button 
                    onClick={() => window.print()}
                    className="text-slate-600 hover:text-slate-900 flex items-center gap-1 text-[11px] cursor-pointer"
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
                          <td className="p-2.5 text-right font-mono font-bold text-rose-600">
                            {le.debit_amount > 0 ? formatINR(le.debit_amount) : '-'}
                          </td>
                          <td className="p-2.5 text-right font-mono font-bold text-emerald-700">
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
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-400 shadow-2xs">
              <FileText className="w-12 h-12 mx-auto mb-2 text-slate-300" />
              <div className="text-sm font-semibold text-slate-600">{getTranslation('select_farmer_to_view_ledger', currentLang)}</div>
              <div className="text-xs text-slate-400 mt-1">{getTranslation('ledger_instruction', currentLang)}</div>
            </div>
          )}
        </div>
      </div>

      {/* Add / Edit Farmer Modal */}
      {showFarmerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden my-6">
            <div className="px-5 py-3.5 bg-slate-800 text-white flex items-center justify-between">
              <h3 className="font-bold text-sm">
                {editingFarmer ? getTranslation('edit_farmer_title', currentLang) : getTranslation('add_farmer_title', currentLang)}
              </h3>
              <button 
                type="button" 
                onClick={() => setShowFarmerModal(false)} 
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveFarmer} className="p-5 space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  {getTranslation('farmer_name', currentLang)} *
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder=""
                  className="w-full p-2 border border-slate-300 rounded focus:outline-emerald-600"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  {getTranslation('farmer_name_mr', currentLang)}
                </label>
                <input
                  type="text"
                  value={nameMr}
                  onChange={(e) => setNameMr(e.target.value)}
                  placeholder=""
                  className="w-full p-2 border border-slate-300 rounded focus:outline-emerald-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
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

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    {getTranslation('village', currentLang)} *
                  </label>
                  <input
                    type="text"
                    required
                    value={village}
                    onChange={(e) => setVillage(e.target.value)}
                    placeholder=""
                    className="w-full p-2 border border-slate-300 rounded"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    {getTranslation('land_acreage', currentLang)}
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={landAcreage || ''}
                    onChange={(e) => setLandAcreage(parseFloat(e.target.value) || 0)}
                    placeholder="0"
                    className="w-full p-2 border border-slate-300 rounded font-mono"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    {getTranslation('credit_limit', currentLang)} (₹)
                  </label>
                  <input
                    type="number"
                    value={creditLimit || ''}
                    onChange={(e) => setCreditLimit(parseFloat(e.target.value) || 0)}
                    placeholder="0"
                    className="w-full p-2 border border-slate-300 rounded font-mono font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  {getTranslation('crops', currentLang)}
                </label>
                <input
                  type="text"
                  value={cropsGrown}
                  onChange={(e) => setCropsGrown(e.target.value)}
                  placeholder=""
                  className="w-full p-2 border border-slate-300 rounded"
                />
              </div>

              {!editingFarmer && (
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    {getTranslation('opening_balance', currentLang)} (₹)
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
                  onClick={() => setShowFarmerModal(false)}
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

      {/* Record Khata Payment Modal */}
      {showPaymentModal && selectedFarmer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95">
            <div className="px-5 py-3.5 bg-emerald-800 text-white flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm">{getTranslation('collect_payment_modal_title', currentLang)}</h3>
                <p className="text-[11px] text-emerald-200">
                  {currentLang === 'mr' && selectedFarmer.name_mr ? selectedFarmer.name_mr : selectedFarmer.name} ({selectedFarmer.village})
                </p>
              </div>
              <button 
                type="button" 
                onClick={() => setShowPaymentModal(false)} 
                className="text-emerald-200 hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <div className="bg-rose-50 p-2.5 rounded-lg border border-rose-200 flex justify-between items-center">
                <span className="text-rose-800 font-semibold">{getTranslation('current_udhaar_balance', currentLang)}:</span>
                <span className="font-mono font-bold text-rose-700 text-sm">{formatINR(selectedFarmer.current_balance)}</span>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  {getTranslation('amount_received', currentLang)} (₹) *
                </label>
                <input
                  type="number"
                  step="any"
                  value={paymentAmount || ''}
                  onChange={(e) => setPaymentAmount(parseFloat(e.target.value) || 0)}
                  placeholder="0"
                  className="w-full p-2 border border-slate-300 rounded font-mono font-black text-slate-900 text-base focus:outline-emerald-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    {getTranslation('payment_mode', currentLang)}
                  </label>
                  <select
                    value={paymentMode}
                    onChange={(e) => setPaymentMode(e.target.value as PaymentMode)}
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
                    value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
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
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  placeholder=""
                  className="w-full p-2 border border-slate-300 rounded"
                />
              </div>
            </div>

            <div className="px-5 py-3 bg-slate-100 border-t border-slate-200 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowPaymentModal(false)}
                className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded text-xs font-semibold cursor-pointer"
              >
                {getTranslation('cancel', currentLang)}
              </button>
              <button
                type="button"
                onClick={handleRecordPayment}
                className="px-4 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <Wallet className="w-4 h-4" />
                <span>{getTranslation('save_payment_btn', currentLang)}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
