import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Trash2, 
  Save, 
  Truck, 
  Package, 
  Calendar, 
  Search, 
  Download, 
  CheckCircle2, 
  Eye, 
  ArrowDownLeft,
  DollarSign
} from 'lucide-react';
import { 
  AppLanguage, 
  Purchase, 
  PurchaseItem, 
  Product, 
  Supplier, 
  PaymentMode 
} from '../types';
import { getTranslation } from '../i18n';
import { formatINR, formatDate, exportToCSV } from '../utils/formatters';
import { dbService } from '../services/api';

interface PurchasesProps {
  currentLang: AppLanguage;
  onPurchaseCompleted?: () => void;
}

export const Purchases: React.FC<PurchasesProps> = ({ currentLang, onPurchaseCompleted }) => {
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'list' | 'create'>('list');

  // New Purchase Form State (Clean initial state, NO hardcoded values)
  const [selectedSupplierId, setSelectedSupplierId] = useState<number>(0);
  const [supplierInvoiceNo, setSupplierInvoiceNo] = useState('');
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState('');
  const [paymentMode, setPaymentMode] = useState<PaymentMode>('Credit');
  const [paidAmount, setPaidAmount] = useState(0);
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<PurchaseItem[]>([]);

  // Add Item Row temp states
  const [selectedProdId, setSelectedProdId] = useState<number>(0);
  const [batchNo, setBatchNo] = useState('');
  const [mfgDate, setMfgDate] = useState('');
  const [expDate, setExpDate] = useState('');
  const [qty, setQty] = useState(1);
  const [freeQty, setFreeQty] = useState(0);
  const [purchaseRate, setPurchaseRate] = useState(0);
  const [mrp, setMrp] = useState(0);
  const [sellingRate, setSellingRate] = useState(0);
  const [discountPercent, setDiscountPercent] = useState(0);

  // View purchase modal
  const [viewPurchase, setViewPurchase] = useState<Purchase | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [purchList, suppList, prodList] = await Promise.all([
        dbService.getPurchases(),
        dbService.getSuppliers(),
        dbService.getProducts(),
      ]);
      setPurchases(purchList);
      setSuppliers(suppList);
      setProducts(prodList);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // When product is selected in item row, auto-fill standard rates
  useEffect(() => {
    if (!selectedProdId) return;
    const prod = products.find((p) => p.id === selectedProdId);
    if (prod) {
      setPurchaseRate(prod.purchase_rate);
      setMrp(prod.mrp);
      setSellingRate(prod.selling_rate);
    }
  }, [selectedProdId, products]);

  const handleAddItem = () => {
    if (!selectedProdId) {
      alert(currentLang === 'mr' ? 'कृपया उत्पादन निवडा.' : 'Please select a product.');
      return;
    }
    if (!batchNo.trim()) {
      alert(currentLang === 'mr' ? 'कृपया बॅच क्रमांक टाका.' : 'Please enter batch number.');
      return;
    }
    if (!expDate) {
      alert(currentLang === 'mr' ? 'कृपया मुदत समाप्ती तारीख टाका.' : 'Please enter expiry date.');
      return;
    }
    if (qty <= 0 || purchaseRate <= 0) {
      alert(currentLang === 'mr' ? 'कृपया योग्य संख्या व खरेदी दर भरा.' : 'Please enter valid quantity and purchase rate.');
      return;
    }

    const prod = products.find((p) => p.id === selectedProdId)!;
    const grossRate = purchaseRate * qty;
    const discAmt = (grossRate * discountPercent) / 100;
    const taxable = grossRate - discAmt;
    const totalGst = (taxable * prod.gst_rate) / 100;
    const lineTotal = taxable + totalGst;

    const newItem: PurchaseItem = {
      product_id: prod.id,
      product_name: prod.name,
      batch_number: batchNo.trim().toUpperCase(),
      mfg_date: mfgDate || undefined,
      expiry_date: expDate,
      quantity: qty,
      free_qty: freeQty,
      free_quantity: freeQty,
      unit: prod.unit,
      purchase_rate: purchaseRate,
      mrp: mrp || prod.mrp,
      selling_rate: sellingRate || prod.selling_rate,
      discount_percent: discountPercent,
      taxable_value: taxable,
      taxable_amount: taxable,
      gst_rate: prod.gst_rate,
      cgst_amount: totalGst / 2,
      sgst_amount: totalGst / 2,
      igst_amount: 0,
      total_tax: totalGst,
      total_amount: lineTotal,
    };

    setItems([...items, newItem]);

    // Reset row inputs
    setSelectedProdId(0);
    setBatchNo('');
    setMfgDate('');
    setExpDate('');
    setQty(1);
    setFreeQty(0);
    setPurchaseRate(0);
    setMrp(0);
    setSellingRate(0);
    setDiscountPercent(0);
  };

  const handleRemoveItem = (idx: number) => {
    setItems(items.filter((_, i) => i !== idx));
  };

  // Calculations
  const subtotal = items.reduce((acc, it) => acc + (it.purchase_rate * it.quantity), 0);
  const totalTaxable = items.reduce((acc, it) => acc + it.taxable_amount, 0);
  const totalTax = items.reduce((acc, it) => acc + (it.cgst_amount + it.sgst_amount), 0);
  const grandTotal = Math.round(totalTaxable + totalTax);

  const handleSavePurchase = async () => {
    if (!selectedSupplierId) {
      alert(currentLang === 'mr' ? 'कृपया पुरवठादार निवडा.' : 'Please select a supplier.');
      return;
    }
    if (!supplierInvoiceNo.trim()) {
      alert(currentLang === 'mr' ? 'कृपया पुरवठादार बिल क्रमांक टाका.' : 'Please enter supplier invoice number.');
      return;
    }
    if (items.length === 0) {
      alert(currentLang === 'mr' ? 'कृपया किमान एक उत्पादन जोडा.' : 'Please add at least 1 product item.');
      return;
    }

    try {
      const supp = suppliers.find((s) => s.id === selectedSupplierId)!;
      const payload = {
        purchase_no: '',
        supplier_invoice_no: supplierInvoiceNo.trim(),
        supplier_id: supp.id,
        supplier_name: supp.name,
        purchase_date: purchaseDate,
        due_date: dueDate || undefined,
        payment_mode: paymentMode,
        subtotal: totalTaxable,
        discount_amount: 0,
        taxable_amount: totalTaxable,
        cgst_amount: totalTax / 2,
        sgst_amount: totalTax / 2,
        igst_amount: 0,
        total_tax: totalTax,
        round_off: 0,
        grand_total: grandTotal,
        paid_amount: paidAmount,
        balance_amount: grandTotal - paidAmount,
        status: 'Completed' as const,
        notes: notes.trim() || undefined,
        items,
      };

      await dbService.createPurchase(payload);
      alert(currentLang === 'mr' ? 'खरेदी नोंद यशस्वीरित्या झाली आणि साठा वाढवला गेला.' : 'Purchase entry saved successfully and stock updated.');

      // Reset form
      setItems([]);
      setSupplierInvoiceNo('');
      setSelectedSupplierId(0);
      setPaidAmount(0);
      setActiveTab('list');
      loadData();
      onPurchaseCompleted?.();
    } catch (err: any) {
      alert(err.message || (currentLang === 'mr' ? 'खरेदी नोंद साठवताना त्रुटी आली.' : 'Error saving purchase entry.'));
    }
  };

  const paymentModes = [
    { value: 'Credit', mr: 'उधारी', en: 'Credit' },
    { value: 'Cash', mr: 'रोख', en: 'Cash' },
    { value: 'Bank Transfer', mr: 'बँक ट्रान्सफर', en: 'Bank Transfer' },
    { value: 'UPI', mr: 'ऑनलाइन / UPI', en: 'Online / UPI' },
  ];

  return (
    <div className="flex-1 p-6 overflow-y-auto space-y-4">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
        <div>
          <h2 className="text-base font-bold text-slate-800">
            {getTranslation('nav_purchase', currentLang)}
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {currentLang === 'mr'
              ? 'आवक माल, बॅच, मुदत व देणी व्यवस्थापन'
              : 'Inward goods, batches, expiry and payables management'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {activeTab === 'list' ? (
            <button
              onClick={() => setActiveTab('create')}
              className="px-3.5 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs flex items-center gap-2 shadow-xs transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>{getTranslation('new_purchase_entry', currentLang)}</span>
            </button>
          ) : (
            <button
              onClick={() => setActiveTab('list')}
              className="px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-900 text-white font-semibold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <span>{getTranslation('back_to_purchase_list', currentLang)}</span>
            </button>
          )}
        </div>
      </div>

      {activeTab === 'create' ? (
        /* =================== CREATE PURCHASE FORM =================== */
        <div className="bg-white rounded-xl border border-slate-200 shadow-2xs p-5 space-y-5">
          {/* Header Metadata */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs">
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                {getTranslation('supplier', currentLang)} *
              </label>
              <select
                value={selectedSupplierId}
                onChange={(e) => setSelectedSupplierId(parseInt(e.target.value) || 0)}
                className="w-full p-2 bg-white border border-slate-300 rounded font-medium focus:outline-emerald-600"
              >
                <option value={0}>-- {getTranslation('select_supplier', currentLang)} --</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.company})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">
                {getTranslation('supplier_invoice_no', currentLang)} *
              </label>
              <input
                type="text"
                value={supplierInvoiceNo}
                onChange={(e) => setSupplierInvoiceNo(e.target.value)}
                placeholder=""
                className="w-full p-2 bg-white border border-slate-300 rounded font-mono focus:outline-emerald-600"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">
                {getTranslation('purchase_date', currentLang)}
              </label>
              <input
                type="date"
                value={purchaseDate}
                onChange={(e) => setPurchaseDate(e.target.value)}
                className="w-full p-2 bg-white border border-slate-300 rounded font-mono"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">
                {getTranslation('payment_mode', currentLang)}
              </label>
              <select
                value={paymentMode}
                onChange={(e) => setPaymentMode(e.target.value as PaymentMode)}
                className="w-full p-2 bg-white border border-slate-300 rounded font-semibold"
              >
                {paymentModes.map((pm) => (
                  <option key={pm.value} value={pm.value}>
                    {currentLang === 'mr' ? pm.mr : pm.en}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Add Item Row */}
          <div className="border border-emerald-200 bg-emerald-50/40 p-4 rounded-xl space-y-3">
            <div className="text-xs font-bold text-emerald-900 flex items-center gap-1.5">
              <Package className="w-4 h-4 text-emerald-700" />
              <span>{getTranslation('add_item_details_title', currentLang)}</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 text-xs">
              <div className="col-span-2">
                <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">
                  {getTranslation('product', currentLang)}:
                </label>
                <select
                  value={selectedProdId}
                  onChange={(e) => setSelectedProdId(parseInt(e.target.value) || 0)}
                  className="w-full p-1.5 bg-white border border-slate-300 rounded text-xs"
                >
                  <option value={0}>-- {getTranslation('select_product', currentLang)} --</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {currentLang === 'mr' && p.name_mr ? p.name_mr : p.name} ({p.pack_size})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">
                  {getTranslation('batch_number', currentLang)}:
                </label>
                <input
                  type="text"
                  value={batchNo}
                  onChange={(e) => setBatchNo(e.target.value)}
                  placeholder=""
                  className="w-full p-1.5 bg-white border border-slate-300 rounded font-mono uppercase text-xs"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">
                  {getTranslation('expiry_date', currentLang)}:
                </label>
                <input
                  type="date"
                  value={expDate}
                  onChange={(e) => setExpDate(e.target.value)}
                  className="w-full p-1.5 bg-white border border-slate-300 rounded font-mono text-xs"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">
                  {getTranslation('quantity', currentLang)}:
                </label>
                <input
                  type="number"
                  min="1"
                  value={qty}
                  onChange={(e) => setQty(parseFloat(e.target.value) || 1)}
                  className="w-full p-1.5 bg-white border border-slate-300 rounded font-mono font-bold text-xs"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">
                  {getTranslation('free_qty', currentLang)}:
                </label>
                <input
                  type="number"
                  min="0"
                  value={freeQty}
                  onChange={(e) => setFreeQty(parseFloat(e.target.value) || 0)}
                  className="w-full p-1.5 bg-white border border-slate-300 rounded font-mono text-xs"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">
                  {getTranslation('purchase_rate', currentLang)} (₹):
                </label>
                <input
                  type="number"
                  step="any"
                  value={purchaseRate || ''}
                  onChange={(e) => setPurchaseRate(parseFloat(e.target.value) || 0)}
                  placeholder="0"
                  className="w-full p-1.5 bg-white border border-slate-300 rounded font-mono font-semibold text-xs"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">
                  {getTranslation('mrp', currentLang)} (₹):
                </label>
                <input
                  type="number"
                  step="any"
                  value={mrp || ''}
                  onChange={(e) => setMrp(parseFloat(e.target.value) || 0)}
                  placeholder="0"
                  className="w-full p-1.5 bg-white border border-slate-300 rounded font-mono text-xs"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">
                  {getTranslation('selling_rate', currentLang)} (₹):
                </label>
                <input
                  type="number"
                  step="any"
                  value={sellingRate || ''}
                  onChange={(e) => setSellingRate(parseFloat(e.target.value) || 0)}
                  placeholder="0"
                  className="w-full p-1.5 bg-white border border-slate-300 rounded font-mono text-xs"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">
                  {getTranslation('discount_percent', currentLang)}:
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={discountPercent || ''}
                  onChange={(e) => setDiscountPercent(parseFloat(e.target.value) || 0)}
                  placeholder="0"
                  className="w-full p-1.5 bg-white border border-slate-300 rounded font-mono text-xs"
                />
              </div>

              <div className="col-span-2 flex items-end">
                <button
                  type="button"
                  onClick={handleAddItem}
                  className="w-full py-1.5 px-3 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded text-xs flex items-center justify-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{getTranslation('add_to_invoice', currentLang)}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Items Table */}
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                <tr>
                  <th className="p-2.5">{getTranslation('product', currentLang)}</th>
                  <th className="p-2.5 text-center">{getTranslation('batch_number', currentLang)}</th>
                  <th className="p-2.5 text-center">{getTranslation('expiry_date', currentLang)}</th>
                  <th className="p-2.5 text-center">{getTranslation('quantity', currentLang)}</th>
                  <th className="p-2.5 text-right">{getTranslation('purchase_rate', currentLang)}</th>
                  <th className="p-2.5 text-right">{getTranslation('selling_rate', currentLang)}</th>
                  <th className="p-2.5 text-right">{getTranslation('gst', currentLang)}</th>
                  <th className="p-2.5 text-right">{getTranslation('total_amount', currentLang)} (₹)</th>
                  <th className="p-2.5 text-center"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-slate-400">
                      {getTranslation('no_items_in_purchase', currentLang)}
                    </td>
                  </tr>
                ) : (
                  items.map((it, idx) => (
                    <tr key={idx} className="hover:bg-slate-50">
                      <td className="p-2.5 font-semibold text-slate-900">{it.product_name}</td>
                      <td className="p-2.5 text-center font-mono">{it.batch_number}</td>
                      <td className="p-2.5 text-center font-mono text-slate-600">{formatDate(it.expiry_date)}</td>
                      <td className="p-2.5 text-center font-mono font-bold">
                        {it.quantity} {it.unit} {it.free_quantity ? `(+${it.free_quantity})` : ''}
                      </td>
                      <td className="p-2.5 text-right font-mono">{formatINR(it.purchase_rate)}</td>
                      <td className="p-2.5 text-right font-mono text-emerald-700 font-bold">{formatINR(it.selling_rate)}</td>
                      <td className="p-2.5 text-right font-mono text-slate-500">{it.gst_rate}%</td>
                      <td className="p-2.5 text-right font-mono font-bold text-slate-900">{formatINR(it.total_amount)}</td>
                      <td className="p-2.5 text-center">
                        <button
                          onClick={() => handleRemoveItem(idx)}
                          className="p-1 text-slate-400 hover:text-rose-600 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Bottom Payment & Save */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-col sm:flex-row justify-between items-center gap-4 text-xs">
            <div className="space-y-1">
              <div>{getTranslation('taxable_value', currentLang)}: <strong className="font-mono">{formatINR(totalTaxable)}</strong></div>
              <div>{getTranslation('total_gst', currentLang)}: <strong className="font-mono">{formatINR(totalTax)}</strong></div>
              <div className="text-sm font-black text-slate-900">{getTranslation('grand_total', currentLang)}: <span className="font-mono text-emerald-800">{formatINR(grandTotal)}</span></div>
            </div>

            <div className="flex items-center gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-0.5">
                  {getTranslation('paid_amount', currentLang)} (₹):
                </label>
                <input
                  type="number"
                  value={paidAmount || ''}
                  onChange={(e) => setPaidAmount(parseFloat(e.target.value) || 0)}
                  placeholder="0"
                  className="w-36 p-1.5 bg-white border border-slate-300 rounded font-mono font-bold"
                />
              </div>

              <button
                onClick={handleSavePurchase}
                disabled={items.length === 0}
                className="px-5 py-2.5 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white font-bold rounded-xl text-xs flex items-center gap-2 shadow-xs transition-colors cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>{getTranslation('save_purchase_btn', currentLang)}</span>
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* =================== PURCHASES LIST =================== */
        <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                <tr>
                  <th className="p-3">{getTranslation('purchase_no', currentLang)}</th>
                  <th className="p-3">{getTranslation('supplier_invoice_no', currentLang)}</th>
                  <th className="p-3">{getTranslation('date', currentLang)}</th>
                  <th className="p-3">{getTranslation('supplier', currentLang)}</th>
                  <th className="p-3">{getTranslation('payment_mode', currentLang)}</th>
                  <th className="p-3 text-right">{getTranslation('taxable_value', currentLang)}</th>
                  <th className="p-3 text-right">{getTranslation('total_gst', currentLang)}</th>
                  <th className="p-3 text-right">{getTranslation('grand_total', currentLang)} (₹)</th>
                  <th className="p-3 text-right">{getTranslation('payable_due', currentLang)} (₹)</th>
                  <th className="p-3 text-center">{getTranslation('actions', currentLang)}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {purchases.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-12 text-center text-slate-400">
                      {getTranslation('no_purchases_found', currentLang)}
                    </td>
                  </tr>
                ) : (
                  purchases.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="p-3 font-mono font-bold text-slate-900">{p.purchase_no}</td>
                      <td className="p-3 font-mono font-semibold text-slate-700">{p.supplier_invoice_no}</td>
                      <td className="p-3 font-mono text-slate-600">{formatDate(p.purchase_date)}</td>
                      <td className="p-3 font-bold text-slate-800">{p.supplier_name}</td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-700 border border-slate-200">
                          {p.payment_mode}
                        </span>
                      </td>
                      <td className="p-3 text-right font-mono text-slate-600">{formatINR(p.taxable_amount)}</td>
                      <td className="p-3 text-right font-mono text-slate-600">{formatINR(p.total_tax)}</td>
                      <td className="p-3 text-right font-mono font-bold text-slate-900 text-sm">{formatINR(p.grand_total)}</td>
                      <td className="p-3 text-right font-mono font-semibold text-amber-700">
                        {p.balance_amount > 0 ? formatINR(p.balance_amount) : '0'}
                      </td>
                      <td className="p-3 text-center">
                        <button
                          onClick={async () => {
                            const full = await dbService.getPurchaseById(p.id);
                            setViewPurchase(full);
                          }}
                          className="p-1 rounded text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 cursor-pointer"
                          title={getTranslation('view_details', currentLang)}
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* View Purchase Details Modal */}
      {viewPurchase && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden">
            <div className="px-5 py-3.5 bg-slate-800 text-white flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm">
                  {getTranslation('purchase_details_title', currentLang)}: {viewPurchase.purchase_no}
                </h3>
                <p className="text-[11px] text-emerald-300 mt-0.5">
                  {getTranslation('supplier', currentLang)}: {viewPurchase.supplier_name} • {getTranslation('supplier_invoice_no', currentLang)}: {viewPurchase.supplier_invoice_no}
                </p>
              </div>
              <button 
                type="button" 
                onClick={() => setViewPurchase(null)} 
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-4 space-y-3 max-h-[70vh] overflow-y-auto text-xs">
              <table className="w-full border border-slate-200 text-left">
                <thead className="bg-slate-100 font-bold border-b border-slate-200">
                  <tr>
                    <th className="p-2 border-r border-slate-200">{getTranslation('product', currentLang)}</th>
                    <th className="p-2 border-r border-slate-200 text-center">{getTranslation('batch_number', currentLang)}</th>
                    <th className="p-2 border-r border-slate-200 text-center">{getTranslation('expiry_date', currentLang)}</th>
                    <th className="p-2 border-r border-slate-200 text-center">{getTranslation('quantity', currentLang)}</th>
                    <th className="p-2 border-r border-slate-200 text-right">{getTranslation('purchase_rate', currentLang)}</th>
                    <th className="p-2 border-r border-slate-200 text-right">{getTranslation('selling_rate', currentLang)}</th>
                    <th className="p-2 text-right">{getTranslation('total_amount', currentLang)}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {viewPurchase.items?.map((it, i) => (
                    <tr key={i}>
                      <td className="p-2 border-r border-slate-200 font-medium">{it.product_name}</td>
                      <td className="p-2 border-r border-slate-200 font-mono text-[11px] text-center">{it.batch_number}</td>
                      <td className="p-2 border-r border-slate-200 text-center font-mono text-[11px]">{formatDate(it.expiry_date)}</td>
                      <td className="p-2 border-r border-slate-200 text-center font-mono">{it.quantity} {it.unit}</td>
                      <td className="p-2 border-r border-slate-200 text-right font-mono">{formatINR(it.purchase_rate)}</td>
                      <td className="p-2 border-r border-slate-200 text-right font-mono text-emerald-700 font-bold">{formatINR(it.selling_rate)}</td>
                      <td className="p-2 text-right font-mono font-bold">{formatINR(it.total_amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-right space-y-1">
                <div>{getTranslation('taxable_value', currentLang)}: <strong className="font-mono">{formatINR(viewPurchase.taxable_amount)}</strong></div>
                <div>{getTranslation('total_gst', currentLang)}: <strong className="font-mono">{formatINR(viewPurchase.total_tax)}</strong></div>
                <div className="text-sm font-black text-slate-900">{getTranslation('grand_total', currentLang)}: {formatINR(viewPurchase.grand_total)}</div>
                <div className="text-amber-700 font-bold">{getTranslation('payable_due', currentLang)}: {formatINR(viewPurchase.balance_amount)}</div>
              </div>
            </div>

            <div className="px-4 py-2.5 bg-slate-100 border-t border-slate-200 flex justify-end">
              <button
                type="button"
                onClick={() => setViewPurchase(null)}
                className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded text-xs font-semibold cursor-pointer"
              >
                {getTranslation('close', currentLang)}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
