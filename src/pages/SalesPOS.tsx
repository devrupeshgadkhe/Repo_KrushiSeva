import React, { useState, useEffect, useRef } from 'react';
import { 
  Plus, 
  Trash2, 
  Printer, 
  Save, 
  PauseCircle, 
  PlayCircle, 
  X, 
  Search, 
  User, 
  Barcode, 
  AlertCircle, 
  Check, 
  Sparkles, 
  CreditCard,
  Percent,
  Calendar,
  Layers,
  ArrowDown
} from 'lucide-react';
import { 
  AppLanguage, 
  Product, 
  ProductBatch, 
  Customer, 
  SaleItem, 
  PaymentMode, 
  BusinessSettings, 
  InvoiceSettings 
} from '../types';
import { getTranslation } from '../i18n';
import { formatINR, calculateLineGst, formatDate } from '../utils/formatters';
import { dbService } from '../services/api';
import { PrintInvoiceModal } from '../components/common/PrintInvoiceModal';

interface SalesPOSProps {
  currentLang: AppLanguage;
  onSaleCompleted: () => void;
}

export const SalesPOS: React.FC<SalesPOSProps> = ({ currentLang, onSaleCompleted }) => {
  const isMr = currentLang === 'mr';

  // Master data
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [businessSettings, setBusinessSettings] = useState<BusinessSettings | null>(null);
  const [invoiceSettings, setInvoiceSettings] = useState<InvoiceSettings | null>(null);

  // Cart / Bill State
  const [items, setItems] = useState<SaleItem[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customerSearch, setCustomerSearch] = useState('');
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);

  // Bill Header & Payment
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentMode, setPaymentMode] = useState<PaymentMode>('Cash');
  const [paidAmount, setPaidAmount] = useState<number>(0);
  const [notes, setNotes] = useState('');
  const [heldBills, setHeldBills] = useState<{ id: string; time: string; customer: string; items: SaleItem[] }[]>([]);

  // Product Search / Barcode Input
  const [productQuery, setProductQuery] = useState('');
  const [searchedProducts, setSearchedProducts] = useState<Product[]>([]);
  const [showProductDropdown, setShowProductDropdown] = useState(false);

  // Batch Selection Modal / Popover
  const [batchModalOpen, setBatchModalOpen] = useState(false);
  const [pendingProduct, setPendingProduct] = useState<Product | null>(null);
  const [availableBatches, setAvailableBatches] = useState<ProductBatch[]>([]);

  // Print Modal
  const [completedSale, setCompletedSale] = useState<any | null>(null);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const barcodeInputRef = useRef<HTMLInputElement>(null);

  // Load Initial Settings & Customers
  useEffect(() => {
    const initPOS = async () => {
      try {
        const [allProds, allCusts, bSettings, iSettings] = await Promise.all([
          dbService.getProducts(),
          dbService.getCustomers(),
          dbService.getBusinessSettings(),
          dbService.getInvoiceSettings(),
        ]);
        setProducts(allProds);
        setCustomers(allCusts);
        setBusinessSettings(bSettings);
        setInvoiceSettings(iSettings);
      } catch (e) {
        console.error('POS initialization error:', e);
      }
    };
    initPOS();
  }, []);

  // Keyboard Shortcuts (F2, F4, Ctrl+S, Ctrl+P)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F2') {
        e.preventDefault();
        barcodeInputRef.current?.focus();
      } else if (e.key === 'F4') {
        e.preventDefault();
        setShowCustomerDropdown(true);
      } else if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleSaveBill(false);
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
        e.preventDefault();
        handleSaveBill(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [items, selectedCustomer, paymentMode, paidAmount]);

  // Search Products as user types
  useEffect(() => {
    if (!productQuery.trim()) {
      setSearchedProducts([]);
      setShowProductDropdown(false);
      return;
    }

    const q = productQuery.toLowerCase();
    const filtered = products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.name_mr && p.name_mr.toLowerCase().includes(q)) ||
        p.product_code.toLowerCase().includes(q) ||
        (p.barcode && p.barcode.includes(q))
    );

    // Exact barcode match auto-add
    const exactBarcodeMatch = products.find((p) => p.barcode && p.barcode === productQuery.trim());
    if (exactBarcodeMatch && exactBarcodeMatch.barcode === productQuery.trim()) {
      selectProductForCart(exactBarcodeMatch);
      setProductQuery('');
      setShowProductDropdown(false);
      return;
    }

    setSearchedProducts(filtered);
    setShowProductDropdown(true);
  }, [productQuery, products]);

  // When user clicks a product in search results or scans
  const selectProductForCart = async (product: Product) => {
    try {
      const batches = await dbService.getProductBatches(product.id);
      const inStockBatches = batches.filter((b) => b.current_qty > 0);

      if (inStockBatches.length === 0) {
        setErrorMsg(
          isMr 
            ? `${product.name_mr || product.name} चा साठा उपलब्ध नाही.` 
            : `${product.name} has no available stock.`
        );
        setTimeout(() => setErrorMsg(''), 3000);
        return;
      }

      if (inStockBatches.length === 1) {
        addItemToCart(product, inStockBatches[0]);
      } else {
        setPendingProduct(product);
        setAvailableBatches(inStockBatches);
        setBatchModalOpen(true);
      }

      setProductQuery('');
      setShowProductDropdown(false);
    } catch (err) {
      console.error(err);
    }
  };

  // Add Item to Bill
  const addItemToCart = (product: Product, batch: ProductBatch, quantity = 1) => {
    const existingIndex = items.findIndex(
      (it) => it.product_id === product.id && it.batch_id === batch.id
    );

    if (existingIndex > -1) {
      // Increase qty
      const existing = items[existingIndex];
      const newQty = existing.quantity + quantity;
      const calc = calculateLineGst(
        newQty,
        existing.rate,
        existing.discount_percent,
        existing.gst_rate
      );

      const newItems = [...items];
      newItems[existingIndex] = {
        ...existing,
        quantity: newQty,
        ...calc,
      };
      setItems(newItems);
    } else {
      // New line item
      const rate = batch.selling_rate || product.selling_rate;
      const calc = calculateLineGst(quantity, rate, 0, product.gst_rate);

      const newItem: SaleItem = {
        product_id: product.id,
        product_name: isMr && product.name_mr ? product.name_mr : product.name,
        product_code: product.product_code,
        hsn_code: product.hsn_code,
        batch_id: batch.id,
        batch_number: batch.batch_number,
        expiry_date: batch.expiry_date,
        unit: product.unit,
        pack_size: product.pack_size,
        quantity,
        rate,
        mrp: batch.mrp || product.mrp,
        discount_percent: 0,
        ...calc,
      };

      setItems([...items, newItem]);
    }

    setBatchModalOpen(false);
    setPendingProduct(null);
    barcodeInputRef.current?.focus();
  };

  const updateItemRow = (
    index: number,
    field: 'quantity' | 'rate' | 'discount_percent',
    value: number
  ) => {
    const newItems = [...items];
    const target = { ...newItems[index] };

    if (field === 'quantity') {
      target.quantity = Math.max(0.1, value);
    } else if (field === 'rate') {
      target.rate = Math.max(0, value);
    } else if (field === 'discount_percent') {
      target.discount_percent = Math.min(100, Math.max(0, value));
    }

    const calc = calculateLineGst(
      target.quantity,
      target.rate,
      target.discount_percent,
      target.gst_rate
    );

    newItems[index] = {
      ...target,
      ...calc,
    };
    setItems(newItems);
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  // Calculations
  const subtotal = items.reduce((acc, item) => acc + item.lineTotal, 0);
  const totalDiscount = items.reduce((acc, item) => acc + item.discountAmount, 0);
  const taxableAmount = items.reduce((acc, item) => acc + item.taxableValue, 0);
  const totalTax = items.reduce((acc, item) => acc + item.totalTax, 0);
  const cgstAmount = totalTax / 2;
  const sgstAmount = totalTax / 2;
  const rawGrandTotal = taxableAmount + totalTax;
  const grandTotal = Math.round(rawGrandTotal);
  const roundOff = Math.round((grandTotal - rawGrandTotal) * 100) / 100;

  // Auto-set paid amount if Cash/UPI and not manually altered
  useEffect(() => {
    if (paymentMode === 'Cash' || paymentMode === 'UPI' || paymentMode === 'Card') {
      setPaidAmount(grandTotal);
    } else if (paymentMode === 'Credit') {
      setPaidAmount(0);
    }
  }, [grandTotal, paymentMode]);

  const creditDue = Math.max(0, grandTotal - paidAmount);

  // Check Credit Limit Warning
  const isCreditExceeded =
    selectedCustomer &&
    paymentMode === 'Credit' &&
    selectedCustomer.current_balance + creditDue > selectedCustomer.credit_limit;

  // Save Sale Transaction
  const handleSaveBill = async (shouldPrint = false) => {
    if (items.length === 0) {
      setErrorMsg(isMr ? 'कृपया बिलामध्ये किमान एक उत्पादन जोडा.' : 'Please add at least 1 item to the bill.');
      setTimeout(() => setErrorMsg(''), 3000);
      return;
    }

    if (paymentMode === 'Credit' && !selectedCustomer) {
      setErrorMsg(isMr ? 'उधारी बिलासाठी शेतकरी निवडणे बंधनकारक आहे.' : 'Selecting a customer is mandatory for credit sale.');
      setTimeout(() => setErrorMsg(''), 3000);
      return;
    }

    setLoading(true);
    setErrorMsg('');

    try {
      const salePayload = {
        invoice_no: '',
        invoice_date: invoiceDate,
        customer_id: selectedCustomer?.id || 0,
        customer_name: selectedCustomer?.name || (isMr ? 'रोख ग्राहक' : 'Walk-in Customer'),
        customer_mobile: selectedCustomer?.mobile || '',
        customer_village: selectedCustomer?.village || '',
        payment_mode: paymentMode,
        subtotal,
        discount_amount: totalDiscount,
        taxable_amount: taxableAmount,
        cgst_amount: cgstAmount,
        sgst_amount: sgstAmount,
        igst_amount: 0,
        total_tax: totalTax,
        round_off: roundOff,
        grand_total: grandTotal,
        paid_amount: paidAmount,
        credit_amount: creditDue,
        status: 'Completed' as const,
        notes: notes.trim() || undefined,
        items,
      };

      const result = await dbService.createSale(salePayload);
      const fullSale = await dbService.getSaleById(result.id);

      onSaleCompleted();

      if (shouldPrint) {
        setCompletedSale(fullSale);
        setShowPrintModal(true);
      }

      // Reset Bill for next customer
      setItems([]);
      setSelectedCustomer(null);
      setCustomerSearch('');
      setPaidAmount(0);
      setNotes('');
      setPaymentMode('Cash');
      barcodeInputRef.current?.focus();
    } catch (err: any) {
      console.error('Error saving bill:', err);
      setErrorMsg(err.message || (isMr ? 'पावती साठवताना त्रुटी आली.' : 'Error saving invoice.'));
    } finally {
      setLoading(false);
    }
  };

  // Hold / Resume Bill
  const handleHoldBill = () => {
    if (items.length === 0) return;
    const holdItem = {
      id: String(Date.now()),
      time: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
      customer: selectedCustomer?.name || (isMr ? 'रोख ग्राहक' : 'Walk-in'),
      items: [...items],
    };
    setHeldBills([...heldBills, holdItem]);
    setItems([]);
    setSelectedCustomer(null);
  };

  const handleResumeBill = (held: typeof heldBills[0]) => {
    setItems(held.items);
    setHeldBills(heldBills.filter((b) => b.id !== held.id));
  };

  const paymentModesList = [
    { mode: 'Cash' as PaymentMode, label: isMr ? 'रोख' : 'Cash' },
    { mode: 'UPI' as PaymentMode, label: isMr ? 'ऑनलाइन / UPI' : 'Online / UPI' },
    { mode: 'Credit' as PaymentMode, label: isMr ? 'उधारी' : 'Credit' },
    { mode: 'Card' as PaymentMode, label: isMr ? 'कार्ड' : 'Card' },
    { mode: 'Bank Transfer' as PaymentMode, label: isMr ? 'बँक' : 'Bank' },
    { mode: 'Mixed' as PaymentMode, label: isMr ? 'मिश्र' : 'Mixed' },
  ];

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-slate-100">
      {/* Top POS Action Toolbar */}
      <div className="bg-white border-b border-slate-200 px-4 py-2.5 flex items-center justify-between gap-4 z-10 shrink-0">
        <div className="flex items-center gap-3 flex-1">
          {/* Barcode & Product Search Input */}
          <div className="relative flex-1 max-w-lg">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
              <Barcode className="w-4 h-4 text-emerald-600" />
            </div>
            <input
              ref={barcodeInputRef}
              type="text"
              value={productQuery}
              onChange={(e) => setProductQuery(e.target.value)}
              placeholder={getTranslation('scan_or_search_product', currentLang)}
              className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-slate-300 bg-slate-50 focus:bg-white focus:border-emerald-600 focus:outline-none text-xs font-semibold text-slate-800 placeholder-slate-400"
            />

            {/* Dropdown Suggestions */}
            {showProductDropdown && searchedProducts.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-lg shadow-xl border border-slate-200 max-h-64 overflow-y-auto z-50">
                {searchedProducts.map((prod) => (
                  <div
                    key={prod.id}
                    onClick={() => selectProductForCart(prod)}
                    className="px-3 py-2 hover:bg-emerald-50 border-b border-slate-100 cursor-pointer flex items-center justify-between text-xs"
                  >
                    <div>
                      <div className="font-bold text-slate-800">
                        {isMr && prod.name_mr ? prod.name_mr : prod.name}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {prod.category} • {prod.pack_size}
                      </div>
                    </div>
                    <div className="text-right font-mono font-bold text-emerald-700">
                      {formatINR(prod.selling_rate)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Customer / Farmer Selector */}
          <div className="relative w-64">
            <div className="flex items-center border border-slate-300 bg-slate-50 rounded-lg px-2.5 py-1.5 text-xs">
              <User className="w-3.5 h-3.5 text-blue-600 mr-2 shrink-0" />
              {selectedCustomer ? (
                <div className="flex-1 truncate font-semibold text-slate-800">
                  {selectedCustomer.name} ({selectedCustomer.village})
                </div>
              ) : (
                <input
                  type="text"
                  value={customerSearch}
                  onChange={(e) => {
                    setCustomerSearch(e.target.value);
                    setShowCustomerDropdown(true);
                  }}
                  onFocus={() => setShowCustomerDropdown(true)}
                  placeholder={getTranslation('select_farmer', currentLang)}
                  className="w-full bg-transparent border-none focus:outline-none text-xs text-slate-800 placeholder-slate-400"
                />
              )}
              {selectedCustomer ? (
                <button
                  type="button"
                  onClick={() => setSelectedCustomer(null)}
                  className="text-slate-400 hover:text-slate-600 ml-1 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              ) : null}
            </div>

            {/* Customer Dropdown */}
            {showCustomerDropdown && !selectedCustomer && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-lg shadow-xl border border-slate-200 max-h-56 overflow-y-auto z-50">
                <div
                  onClick={() => {
                    setSelectedCustomer(null);
                    setShowCustomerDropdown(false);
                  }}
                  className="px-3 py-2 hover:bg-slate-50 border-b border-slate-100 cursor-pointer text-xs font-semibold text-slate-600 italic"
                >
                  {getTranslation('walk_in_customer', currentLang)}
                </div>
                {customers
                  .filter(
                    (c) =>
                      !customerSearch ||
                      c.name.toLowerCase().includes(customerSearch.toLowerCase()) ||
                      (c.name_mr && c.name_mr.includes(customerSearch)) ||
                      c.village.toLowerCase().includes(customerSearch.toLowerCase()) ||
                      c.mobile.includes(customerSearch)
                  )
                  .slice(0, 8)
                  .map((c) => (
                    <div
                      key={c.id}
                      onClick={() => {
                        setSelectedCustomer(c);
                        setShowCustomerDropdown(false);
                      }}
                      className="px-3 py-2 hover:bg-blue-50 border-b border-slate-100 cursor-pointer text-xs flex justify-between items-center"
                    >
                      <div>
                        <div className="font-bold text-slate-800">{c.name}</div>
                        <div className="text-[10px] text-slate-500">
                          {isMr ? 'गाव' : 'Village'}: {c.village} • {c.mobile}
                        </div>
                      </div>
                      <div className="text-right">
                        <span className={`text-[10px] font-bold ${c.current_balance > 0 ? 'text-rose-600' : 'text-slate-500'}`}>
                          {isMr ? 'बाकी:' : 'Due:'} {formatINR(c.current_balance)}
                        </span>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Status / Hold count */}
        <div className="flex items-center gap-2">
          {heldBills.length > 0 && (
            <div className="flex items-center gap-1.5 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded text-xs text-amber-800">
              <PauseCircle className="w-3.5 h-3.5 text-amber-600" />
              <span>{isMr ? 'होल्ड बिले' : 'Held Bills'}: <strong>{heldBills.length}</strong></span>
              {heldBills.map((hb) => (
                <button
                  key={hb.id}
                  onClick={() => handleResumeBill(hb)}
                  className="px-1.5 py-0.5 bg-amber-200 hover:bg-amber-300 rounded font-bold text-[10px] ml-1 cursor-pointer"
                >
                  {isMr ? 'उघडा' : 'Open'} ({hb.customer})
                </button>
              ))}
            </div>
          )}

          <button
            type="button"
            onClick={handleHoldBill}
            disabled={items.length === 0}
            className="px-2.5 py-1 rounded border border-slate-300 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-semibold flex items-center gap-1 disabled:opacity-40 cursor-pointer"
          >
            <PauseCircle className="w-3.5 h-3.5" />
            <span>{isMr ? 'होल्ड' : 'Hold'}</span>
          </button>
        </div>
      </div>

      {/* Error / Alert banner if any */}
      {errorMsg && (
        <div className="bg-rose-50 border-b border-rose-200 px-4 py-2 text-xs font-bold text-rose-800 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Credit Limit Alert Banner */}
      {isCreditExceeded && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-1.5 text-xs font-bold text-amber-900 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
          <span>
            {getTranslation('credit_sale_warning', currentLang)} {isMr ? 'मर्यादा' : 'Limit'}: {formatINR(selectedCustomer?.credit_limit)}, {isMr ? 'चालू बाकी' : 'Balance'}: {formatINR(selectedCustomer?.current_balance)}.
          </span>
        </div>
      )}

      {/* Main Billing Workspace: Split Screen */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-0 overflow-hidden">
        {/* Left 8 Cols: Invoice Items Table */}
        <div className="lg:col-span-8 flex flex-col bg-white border-r border-slate-200 overflow-hidden">
          {/* Table Header */}
          <div className="overflow-x-auto flex-1">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200 sticky top-0 z-10">
                <tr>
                  <th className="px-3 py-2 w-8 text-center">#</th>
                  <th className="px-3 py-2">{getTranslation('item_name', currentLang)}</th>
                  <th className="px-3 py-2 text-center">{getTranslation('batch', currentLang)}</th>
                  <th className="px-3 py-2 text-center w-20">{getTranslation('qty', currentLang)}</th>
                  <th className="px-3 py-2 text-right w-24">{getTranslation('rate', currentLang)}</th>
                  <th className="px-3 py-2 text-right w-16">{getTranslation('discount', currentLang)}</th>
                  <th className="px-3 py-2 text-right w-14">GST</th>
                  <th className="px-3 py-2 text-right w-24">{getTranslation('amount', currentLang)}</th>
                  <th className="px-3 py-2 text-center w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-24 text-center text-slate-400">
                      <Barcode className="w-12 h-12 mx-auto mb-2 text-slate-300" />
                      <div className="text-sm font-semibold text-slate-600">
                        {isMr ? 'पावतीमध्ये वस्तूंची नोंद नाही' : 'Bill is empty'}
                      </div>
                      <div className="text-xs mt-1">
                        {isMr ? 'बारकोड स्कॅन करा किंवा वरून उत्पादन निवडा' : 'Scan barcode or search product above'}
                      </div>
                    </td>
                  </tr>
                ) : (
                  items.map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-3 py-2 text-center font-mono text-slate-400">{idx + 1}</td>
                      <td className="px-3 py-2">
                        <div className="font-bold text-slate-900">{item.product_name}</div>
                        <div className="text-[10px] text-slate-500 font-mono">
                          {item.pack_size} • HSN: {item.hsn_code}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-center">
                        <span className="font-mono text-[11px] bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded border border-slate-200">
                          {item.batch_number || '-'}
                        </span>
                        {item.expiry_date && (
                          <div className="text-[9px] text-slate-400">{formatDate(item.expiry_date)}</div>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          step="any"
                          min="0.1"
                          value={item.quantity}
                          onChange={(e) => updateItemRow(idx, 'quantity', parseFloat(e.target.value) || 1)}
                          className="w-16 px-1.5 py-1 text-center font-mono font-bold bg-slate-50 border border-slate-300 rounded focus:bg-white focus:outline-emerald-600 text-xs"
                        />
                      </td>
                      <td className="px-3 py-2 text-right">
                        <input
                          type="number"
                          step="any"
                          min="0"
                          value={item.rate}
                          onChange={(e) => updateItemRow(idx, 'rate', parseFloat(e.target.value) || 0)}
                          className="w-20 px-1.5 py-1 text-right font-mono bg-slate-50 border border-slate-300 rounded focus:bg-white focus:outline-emerald-600 text-xs"
                        />
                      </td>
                      <td className="px-3 py-2 text-right">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={item.discount_percent}
                          onChange={(e) => updateItemRow(idx, 'discount_percent', parseFloat(e.target.value) || 0)}
                          className="w-12 px-1 py-1 text-right font-mono bg-slate-50 border border-slate-300 rounded focus:bg-white focus:outline-emerald-600 text-xs"
                        />
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-[11px] text-slate-500">
                        {item.gst_rate}%
                      </td>
                      <td className="px-3 py-2 text-right font-mono font-bold text-slate-900">
                        {formatINR(item.total_amount)}
                      </td>
                      <td className="px-3 py-2 text-center">
                        <button
                          type="button"
                          onClick={() => removeItem(idx)}
                          className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
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

          {/* Items Summary Bar */}
          <div className="p-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600">
            <div>
              {isMr ? 'एकूण वस्तू' : 'Items'}: <strong className="text-slate-800">{items.length}</strong> | 
              {isMr ? ' एकूण नग' : ' Total Qty'}: <strong className="text-slate-800">{items.reduce((a, b) => a + b.quantity, 0)}</strong>
            </div>
            <div className="flex items-center gap-4">
              <span>{isMr ? 'करपात्र मूल्य' : 'Taxable Value'}: <strong className="font-mono text-slate-800">{formatINR(taxableAmount)}</strong></span>
              <span>{isMr ? 'एकूण जीएसटी' : 'Total GST'}: <strong className="font-mono text-slate-800">{formatINR(totalTax)}</strong></span>
            </div>
          </div>
        </div>

        {/* Right 4 Cols: Payment Calculation & Final Checkout */}
        <div className="lg:col-span-4 bg-slate-50 p-4 flex flex-col justify-between overflow-y-auto border-l border-slate-200">
          <div className="space-y-4">
            {/* Grand Total Display Card */}
            <div className="bg-emerald-950 text-white p-4 rounded-xl shadow-xs border border-emerald-900">
              <div className="text-[11px] font-semibold text-emerald-300 uppercase tracking-wider">
                {getTranslation('grand_total', currentLang)}
              </div>
              <div className="text-3xl font-black font-mono tracking-tight text-white mt-1">
                {formatINR(grandTotal)}
              </div>
              <div className="text-[10px] text-emerald-300/70 mt-1 flex justify-between">
                <span>{isMr ? 'उपएकूण' : 'Subtotal'}: {formatINR(subtotal)}</span>
                {totalDiscount > 0 && <span>{isMr ? 'सूट' : 'Discount'}: -{formatINR(totalDiscount)}</span>}
                {roundOff !== 0 && <span>{isMr ? 'राउंड ऑफ' : 'Round off'}: {roundOff}</span>}
              </div>
            </div>

            {/* Payment Mode Selection */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                {getTranslation('payment_mode', currentLang)}
              </label>
              <div className="grid grid-cols-3 gap-1.5">
                {paymentModesList.map((item) => (
                  <button
                    key={item.mode}
                    type="button"
                    onClick={() => setPaymentMode(item.mode)}
                    className={`py-2 px-1 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                      paymentMode === item.mode
                        ? 'bg-emerald-700 text-white border-emerald-800 shadow-xs'
                        : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Amount Paid & Balance Credit */}
            <div className="bg-white p-3 rounded-xl border border-slate-200 space-y-3">
              <div>
                <div className="flex justify-between text-xs font-bold text-slate-700 mb-1">
                  <span>{getTranslation('paid_amount', currentLang)} (₹):</span>
                  <button
                    type="button"
                    onClick={() => setPaidAmount(grandTotal)}
                    className="text-[10px] text-emerald-700 hover:underline cursor-pointer font-bold"
                  >
                    {isMr ? 'पूर्ण रक्कम' : 'Full Amount'}
                  </button>
                </div>
                <input
                  type="number"
                  step="any"
                  value={paidAmount || ''}
                  onChange={(e) => setPaidAmount(parseFloat(e.target.value) || 0)}
                  placeholder="0"
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-300 font-mono font-bold text-slate-900 focus:outline-emerald-600 text-sm"
                />
              </div>

              {creditDue > 0 && (
                <div className="flex justify-between items-center text-xs p-2 rounded bg-rose-50 border border-rose-200">
                  <span className="font-bold text-rose-800">{getTranslation('balance_credit', currentLang)}:</span>
                  <span className="font-mono font-bold text-rose-600 text-sm">{formatINR(creditDue)}</span>
                </div>
              )}
            </div>

            {/* Date & Optional Notes */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  {getTranslation('date', currentLang)}:
                </label>
                <input
                  type="date"
                  value={invoiceDate}
                  onChange={(e) => setInvoiceDate(e.target.value)}
                  className="w-full px-2 py-1 rounded border border-slate-300 bg-white text-xs font-mono"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  {getTranslation('description', currentLang)}:
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder=""
                  className="w-full px-2 py-1 rounded border border-slate-300 bg-white text-xs"
                />
              </div>
            </div>
          </div>

          {/* Action Buttons (Save, Print, Cancel) */}
          <div className="pt-4 space-y-2">
            <button
              type="button"
              onClick={() => handleSaveBill(true)}
              disabled={loading || items.length === 0}
              className="w-full py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-xs transition-colors cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>{getTranslation('save_and_print', currentLang)}</span>
            </button>

            <button
              type="button"
              onClick={() => handleSaveBill(false)}
              disabled={loading || items.length === 0}
              className="w-full py-2 rounded-xl bg-slate-800 hover:bg-slate-900 disabled:opacity-50 text-white font-semibold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>{getTranslation('save_bill', currentLang)}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                if (items.length > 0 && confirm(isMr ? 'चालू पावती रद्द करायची आहे का?' : 'Discard current bill?')) {
                  setItems([]);
                  setSelectedCustomer(null);
                  setPaidAmount(0);
                  setNotes('');
                }
              }}
              className="w-full py-1.5 text-center text-[11px] text-slate-500 hover:text-rose-600 cursor-pointer font-medium"
            >
              {getTranslation('cancel_bill', currentLang)}
            </button>
          </div>
        </div>
      </div>

      {/* FEFO Batch Selection Modal */}
      {batchModalOpen && pendingProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95">
            <div className="px-4 py-3 bg-slate-800 text-white flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold">{isMr && pendingProduct.name_mr ? pendingProduct.name_mr : pendingProduct.name}</h3>
                <p className="text-[11px] text-emerald-300">
                  {isMr ? 'बॅच निवडा (मुदत संपण्याच्या क्रमाने)' : 'Select Batch (First Expiry First Out)'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setBatchModalOpen(false);
                  setPendingProduct(null);
                }}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-2 max-h-80 overflow-y-auto">
              {availableBatches.map((b, idx) => (
                <div
                  key={b.id}
                  onClick={() => addItemToCart(pendingProduct, b)}
                  className={`p-3 rounded-lg border cursor-pointer flex items-center justify-between transition-all ${
                    idx === 0
                      ? 'bg-emerald-50/70 border-emerald-300 hover:bg-emerald-100/70'
                      : 'bg-white border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-slate-900 text-xs">
                        {b.batch_number}
                      </span>
                      {idx === 0 && (
                        <span className="text-[10px] font-bold bg-emerald-600 text-white px-1.5 py-0.2 rounded flex items-center gap-1">
                          <Sparkles className="w-2.5 h-2.5" />
                          <span>{isMr ? 'शिफारस' : 'Recommended'}</span>
                        </span>
                      )}
                      {b.status === 'Near Expiry' && (
                        <span className="text-[10px] font-semibold bg-amber-100 text-amber-800 px-1 rounded">
                          {isMr ? `मुदत संपणार (${b.days_to_expiry} दिवस)` : `Expiring soon (${b.days_to_expiry} days)`}
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      {isMr ? 'मुदत' : 'Expiry'}: {formatDate(b.expiry_date)} • {isMr ? 'शिल्लक' : 'Stock'}: <strong className="text-slate-800">{b.current_qty} {pendingProduct.unit}</strong>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="font-mono font-bold text-emerald-700 text-xs">
                      {formatINR(b.selling_rate)}
                    </div>
                    <div className="text-[10px] text-slate-400">MRP: {formatINR(b.mrp)}</div>
                  </div>
                </div>
              ))}
            </div>

            <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button
                type="button"
                onClick={() => {
                  setBatchModalOpen(false);
                  setPendingProduct(null);
                }}
                className="px-3 py-1.5 rounded bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-semibold cursor-pointer"
              >
                {getTranslation('cancel', currentLang)}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Print Invoice Modal */}
      {showPrintModal && completedSale && businessSettings && invoiceSettings && (
        <PrintInvoiceModal
          sale={completedSale}
          businessSettings={businessSettings}
          invoiceSettings={invoiceSettings}
          currentLang={currentLang}
          onClose={() => {
            setShowPrintModal(false);
            setCompletedSale(null);
          }}
        />
      )}
    </div>
  );
};
