import React, { useState, useEffect, useRef } from 'react';
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
  DollarSign,
  X,
  ChevronDown,
  Check,
  Sparkles,
  Camera
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
import { useFeedback } from '../components/common/FeedbackContext';
import { aiInvoiceService, ScannedInvoiceData } from '../services/aiInvoiceService';
import { AiInvoiceScannerModal } from '../components/purchases/AiInvoiceScannerModal';

interface PurchasesProps {
  currentLang: AppLanguage;
  onPurchaseCompleted?: () => void;
}

export const Purchases: React.FC<PurchasesProps> = ({ currentLang, onPurchaseCompleted }) => {
  const { showToast } = useFeedback();
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'list' | 'create'>('list');

  // New Purchase Form State
  const [selectedSupplierId, setSelectedSupplierId] = useState<number>(0);
  const [supplierSearch, setSupplierSearch] = useState('');
  const [isSupplierOpen, setIsSupplierOpen] = useState(false);
  const supplierRef = useRef<HTMLDivElement>(null);

  const [supplierInvoiceNo, setSupplierInvoiceNo] = useState('');
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState('');
  const [paymentMode, setPaymentMode] = useState<PaymentMode>('Credit');
  const [paidAmount, setPaidAmount] = useState(0);
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<PurchaseItem[]>([]);

  // Add Item Row temp states
  const [selectedProdId, setSelectedProdId] = useState<number>(0);
  const [productSearch, setProductSearch] = useState('');
  const [isProductOpen, setIsProductOpen] = useState(false);
  const productRef = useRef<HTMLDivElement>(null);

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

  // AI Bill Scanner states
  const [aiAvailable, setAiAvailable] = useState(false);
  const [isAiScanOpen, setIsAiScanOpen] = useState(false);

  // Monitor Gemini Quota and Credit Availability
  useEffect(() => {
    let mounted = true;
    const checkQuota = async () => {
      try {
        const status = await aiInvoiceService.checkQuotaStatus();
        if (mounted) {
          setAiAvailable(status.available && !status.quotaExceeded);
        }
      } catch {
        if (mounted) setAiAvailable(false);
      }
    };
    checkQuota();

    const unsub = aiInvoiceService.subscribe((status) => {
      if (mounted) {
        setAiAvailable(status.available && !status.quotaExceeded);
      }
    });

    const interval = setInterval(checkQuota, 60 * 1000);
    return () => {
      mounted = false;
      unsub();
      clearInterval(interval);
    };
  }, []);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (supplierRef.current && !supplierRef.current.contains(e.target as Node)) {
        setIsSupplierOpen(false);
      }
      if (productRef.current && !productRef.current.contains(e.target as Node)) {
        setIsProductOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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

  // Apply parsed Gemini invoice data directly to Purchase entry form
  const handleApplyAiScannedData = async (scanned: ScannedInvoiceData) => {
    try {
      // 1. Switch to create tab
      setActiveTab('create');

      // 2. Set invoice number and date
      if (scanned.invoiceNumber) {
        setSupplierInvoiceNo(scanned.invoiceNumber);
      }
      if (scanned.invoiceDate) {
        setPurchaseDate(scanned.invoiceDate);
      }

      // 3. Match or Create Supplier
      let matchedSupp = null;
      const cleanGstin = scanned.supplierGstin?.trim().toUpperCase();
      if (cleanGstin) {
        matchedSupp = suppliers.find((s) => s.gstin && s.gstin.trim().toUpperCase() === cleanGstin);
      }

      if (!matchedSupp && scanned.supplierName) {
        const cleanName = scanned.supplierName.trim().toLowerCase();
        matchedSupp = suppliers.find(
          (s) =>
            s.name.toLowerCase() === cleanName ||
            (s.company && s.company.toLowerCase() === cleanName) ||
            cleanName.includes(s.name.toLowerCase()) ||
            s.name.toLowerCase().includes(cleanName)
        );
      }

      if (matchedSupp) {
        setSelectedSupplierId(matchedSupp.id);
        setSupplierSearch(matchedSupp.name);
      } else if (scanned.supplierName.trim()) {
        // Auto-create supplier in SQLite DB
        try {
          const newSuppId = await dbService.createSupplier({
            name: scanned.supplierName.trim(),
            company: scanned.supplierName.trim(),
            gstin: scanned.supplierGstin?.trim() || undefined,
            address: scanned.supplierAddress?.trim() || undefined,
            mobile: scanned.supplierPhone?.trim() || undefined,
            email: scanned.supplierEmail?.trim() || undefined,
            active: true,
            opening_balance: 0,
            current_balance: 0,
          });
          setSelectedSupplierId(newSuppId);
          setSupplierSearch(scanned.supplierName.trim());
          const updatedSupps = await dbService.getSuppliers();
          setSuppliers(updatedSupps);
        } catch (e) {
          console.warn('Could not auto-create supplier, continuing:', e);
        }
      }

      // 4. Map or auto-register products & create items
      const newItems: PurchaseItem[] = [];
      const currentProds = [...products];

      for (const it of scanned.items) {
        const cleanName = it.name.trim().toLowerCase();
        let prod = currentProds.find(
          (p) =>
            p.name.toLowerCase() === cleanName ||
            (p.name_mr && p.name_mr.toLowerCase() === cleanName) ||
            cleanName.includes(p.name.toLowerCase()) ||
            p.name.toLowerCase().includes(cleanName)
        );

        if (!prod) {
          try {
            const purchaseRate = it.rate > 0 ? it.rate : 100;
            const gstRate = it.gstRate >= 0 ? it.gstRate : 18;
            const sellingRate = Math.round(purchaseRate * 1.15);
            const mrp = Math.round(purchaseRate * 1.25);
            const unit = it.unit || 'PCS';

            const newProdId = await dbService.createProduct({
              name: it.name.trim(),
              name_mr: it.name.trim(),
              category: 'General',
              hsn_code: it.hsn || '',
              unit,
              purchase_rate: purchaseRate,
              selling_rate: sellingRate,
              mrp,
              gst_rate: gstRate,
              active: true,
            });

            prod = {
              id: newProdId,
              name: it.name.trim(),
              name_mr: it.name.trim(),
              category: 'General',
              hsn_code: it.hsn || '',
              unit,
              purchase_rate: purchaseRate,
              selling_rate: sellingRate,
              mrp,
              gst_rate: gstRate,
              active: true,
              created_at: new Date().toISOString(),
            } as unknown as Product;
            currentProds.push(prod);
          } catch (pe) {
            console.warn('Error auto-creating product:', pe);
          }
        }

        const effectiveProdId = prod?.id || 1;
        const effectiveProdName = prod?.name || it.name;
        const effectiveUnit = prod?.unit || it.unit || 'PCS';
        const effectiveGstRate = it.gstRate >= 0 ? it.gstRate : (prod?.gst_rate || 0);
        const qty = it.quantity > 0 ? it.quantity : 1;
        const rate = it.rate > 0 ? it.rate : (prod?.purchase_rate || 0);
        const discAmt = it.discount || 0;
        const taxable = it.taxableAmount > 0 ? it.taxableAmount : Math.max(0, rate * qty - discAmt);
        const totalTax = (taxable * effectiveGstRate) / 100;
        const lineTotal = it.totalAmount > 0 ? it.totalAmount : (taxable + totalTax);

        const batchNumber = it.batchNumber?.trim()
          ? it.batchNumber.trim().toUpperCase()
          : `BATCH-${Date.now().toString().slice(-4)}${Math.floor(10 + Math.random() * 90)}`;

        const expiryDate = it.expiryDate?.trim()
          ? it.expiryDate.trim()
          : new Date(Date.now() + 365 * 86400000).toISOString().split('T')[0];

        newItems.push({
          product_id: effectiveProdId,
          product_name: effectiveProdName,
          batch_number: batchNumber,
          mfg_date: undefined,
          expiry_date: expiryDate,
          quantity: qty,
          free_qty: 0,
          free_quantity: 0,
          unit: effectiveUnit,
          purchase_rate: rate,
          mrp: prod?.mrp || Math.round(rate * 1.25),
          selling_rate: prod?.selling_rate || Math.round(rate * 1.15),
          discount_percent: 0,
          taxable_value: taxable,
          taxable_amount: taxable,
          gst_rate: effectiveGstRate,
          cgst_amount: totalTax / 2,
          sgst_amount: totalTax / 2,
          igst_amount: 0,
          total_tax: totalTax,
          total_amount: lineTotal,
        });
      }

      setProducts(currentProds);
      setItems(newItems);

      showToast(
        currentLang === 'mr'
          ? `बिल यशस्वीरित्या स्कॅन झाले! ${newItems.length} उत्पादने खरेदी फॉर्ममध्ये भरली गेली.`
          : `Invoice scanned successfully! ${newItems.length} items loaded into form.`,
        'success'
      );
    } catch (err: any) {
      showToast(
        err.message || (currentLang === 'mr' ? 'माहिती भरताना अडचण आली.' : 'Error applying scanned data.'),
        'error'
      );
    }
  };

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
      showToast(currentLang === 'mr' ? 'कृपया उत्पादन निवडा.' : 'Please select a product.', 'warning');
      return;
    }
    if (!batchNo.trim()) {
      showToast(currentLang === 'mr' ? 'कृपया बॅच क्रमांक टाका.' : 'Please enter batch number.', 'warning');
      return;
    }
    if (!expDate) {
      showToast(currentLang === 'mr' ? 'कृपया मुदत समाप्ती तारीख टाका.' : 'Please enter expiry date.', 'warning');
      return;
    }
    if (qty <= 0 || purchaseRate <= 0) {
      showToast(currentLang === 'mr' ? 'कृपया योग्य संख्या व खरेदी दर भरा.' : 'Please enter valid quantity and purchase rate.', 'warning');
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
    setProductSearch('');
    setIsProductOpen(false);
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

  // Filtered lists for searchable autocomplete
  const filteredSuppliers = suppliers.filter((s) => {
    if (!supplierSearch.trim()) return true;
    const q = supplierSearch.toLowerCase();
    return (
      s.name.toLowerCase().includes(q) ||
      (s.company && s.company.toLowerCase().includes(q)) ||
      (s.mobile && s.mobile.includes(q)) ||
      (s.gstin && s.gstin.toLowerCase().includes(q))
    );
  });

  const selectedSupplier = suppliers.find((s) => s.id === selectedSupplierId);

  const filteredProducts = products.filter((p) => {
    if (!productSearch.trim()) return true;
    const q = productSearch.toLowerCase();
    return (
      p.name.toLowerCase().includes(q) ||
      (p.name_mr && p.name_mr.toLowerCase().includes(q)) ||
      (p.company && p.company.toLowerCase().includes(q)) ||
      (p.category && p.category.toLowerCase().includes(q)) ||
      (p.pack_size && p.pack_size.toLowerCase().includes(q))
    );
  });

  const selectedProduct = products.find((p) => p.id === selectedProdId);

  // Calculations
  const subtotal = items.reduce((acc, it) => acc + (it.purchase_rate * it.quantity), 0);
  const totalTaxable = items.reduce((acc, it) => acc + it.taxable_amount, 0);
  const totalTax = items.reduce((acc, it) => acc + (it.cgst_amount + it.sgst_amount), 0);
  const grandTotal = Math.round(totalTaxable + totalTax);

  const handleSavePurchase = async () => {
    if (!selectedSupplierId) {
      showToast(currentLang === 'mr' ? 'कृपया पुरवठादार निवडा.' : 'Please select a supplier.', 'warning');
      return;
    }
    if (!supplierInvoiceNo.trim()) {
      showToast(currentLang === 'mr' ? 'कृपया पुरवठादार बिल क्रमांक टाका.' : 'Please enter supplier invoice number.', 'warning');
      return;
    }
    if (items.length === 0) {
      showToast(currentLang === 'mr' ? 'कृपया किमान एक उत्पादन जोडा.' : 'Please add at least 1 product item.', 'warning');
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
      showToast(currentLang === 'mr' ? 'खरेदी नोंद यशस्वीरित्या झाली आणि साठा वाढवला गेला.' : 'Purchase entry saved successfully and stock updated.', 'success');

      // Reset form
      setItems([]);
      setSupplierInvoiceNo('');
      setSelectedSupplierId(0);
      setSupplierSearch('');
      setIsSupplierOpen(false);
      setSelectedProdId(0);
      setProductSearch('');
      setIsProductOpen(false);
      setPaidAmount(0);
      setActiveTab('list');
      loadData();
      onPurchaseCompleted?.();
    } catch (err: any) {
      showToast(err.message || (currentLang === 'mr' ? 'खरेदी नोंद साठवताना त्रुटी आली.' : 'Error saving purchase entry.'), 'error');
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
          {/* Quota-Based Dynamic Scan Button */}
          {aiAvailable && (
            <button
              type="button"
              onClick={() => setIsAiScanOpen(true)}
              className="px-3.5 py-2 rounded-lg bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white font-bold text-xs flex items-center gap-2 shadow-xs transition-all cursor-pointer active:scale-95"
              title={currentLang === 'mr' ? 'खरेदी बिल फोटो / PDF स्कॅन करा' : 'Scan Purchase Bill with AI'}
            >
              <Sparkles className="w-4 h-4 text-amber-300 animate-pulse" />
              <span>{currentLang === 'mr' ? 'बिल स्कॅन करा (AI Scan)' : 'Scan Bill (AI Scan)'}</span>
            </button>
          )}

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
          {/* AI Bill Scanner Quick Banner (Only shown if AI credits/quota available) */}
          {aiAvailable && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 bg-gradient-to-r from-indigo-50/90 via-purple-50/70 to-emerald-50/90 border border-indigo-200/80 rounded-xl shadow-2xs">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-indigo-600 text-white flex items-center justify-center shadow-xs shrink-0">
                  <Sparkles className="w-5 h-5 text-amber-300 animate-pulse" />
                </div>
                <div>
                  <h4 className="font-bold text-xs text-indigo-950 flex items-center gap-1.5">
                    <span>{currentLang === 'mr' ? 'स्मार्ट खरेदी बिल स्कॅनर (Gemini Vision)' : 'Smart Bill Auto-Fill (Gemini Vision)'}</span>
                    <span className="px-1.5 py-0.2 rounded bg-indigo-200/70 text-[10px] text-indigo-800 font-mono font-bold">AI</span>
                  </h4>
                  <p className="text-[11px] text-indigo-700/80">
                    {currentLang === 'mr'
                      ? 'खरेदी पावतीचा फोटो किंवा PDF निवडा — पुरवठादार, उत्पादने, दर आणि GST आपोआप भरले जातील.'
                      : 'Upload invoice photo or PDF — vendor, products, rates & GST will be auto-filled.'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAiScanOpen(true)}
                className="px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs cursor-pointer transition-colors shrink-0"
              >
                <Camera className="w-3.5 h-3.5 text-amber-300" />
                <span>{currentLang === 'mr' ? 'बिल स्कॅन करा' : 'Scan Bill Now'}</span>
              </button>
            </div>
          )}
          {/* Header Metadata */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs">
            {/* Searchable Autocomplete Supplier Dropdown */}
            <div className="relative" ref={supplierRef}>
              <label className="block font-bold text-slate-700 mb-1">
                {getTranslation('supplier', currentLang)} *
              </label>

              {selectedSupplier ? (
                <div className="flex items-center justify-between p-2 bg-emerald-50 border border-emerald-300 rounded-lg text-xs shadow-2xs">
                  <div className="min-w-0 pr-2">
                    <span className="font-bold text-emerald-950 block truncate">
                      {selectedSupplier.name}
                    </span>
                    <span className="text-[11px] text-emerald-700 truncate block">
                      {selectedSupplier.company || (currentLang === 'mr' ? 'पुरवठादार' : 'Supplier')} {selectedSupplier.mobile ? `• ${selectedSupplier.mobile}` : ''}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedSupplierId(0);
                      setSupplierSearch('');
                      setIsSupplierOpen(true);
                    }}
                    className="p-1 hover:bg-emerald-200/70 rounded text-emerald-800 hover:text-emerald-950 cursor-pointer shrink-0"
                    title={currentLang === 'mr' ? 'दुसरा पुरवठादार निवडा' : 'Change Supplier'}
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <div className="relative">
                  <div className="relative flex items-center">
                    <Search className="w-3.5 h-3.5 absolute left-2.5 text-slate-400 pointer-events-none" />
                    <input
                      type="text"
                      value={supplierSearch}
                      onChange={(e) => {
                        setSupplierSearch(e.target.value);
                        setIsSupplierOpen(true);
                      }}
                      onFocus={() => setIsSupplierOpen(true)}
                      placeholder={currentLang === 'mr' ? 'नाव किंवा कंपनीने शोधा...' : 'Search name or company...'}
                      className="w-full pl-8 pr-7 py-2 bg-white border border-slate-300 rounded text-xs font-medium focus:outline-emerald-600 focus:border-emerald-600 shadow-2xs"
                    />
                    {supplierSearch && (
                      <button
                        type="button"
                        onClick={() => {
                          setSupplierSearch('');
                          setIsSupplierOpen(false);
                        }}
                        className="absolute right-2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {isSupplierOpen && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-xl z-50 max-h-56 overflow-y-auto divide-y divide-slate-100">
                      {filteredSuppliers.length > 0 ? (
                        filteredSuppliers.map((s) => (
                          <div
                            key={s.id}
                            onClick={() => {
                              setSelectedSupplierId(s.id);
                              setSupplierSearch('');
                              setIsSupplierOpen(false);
                            }}
                            className="p-2.5 hover:bg-emerald-50 cursor-pointer transition-colors flex items-center justify-between"
                          >
                            <div className="min-w-0 pr-2">
                              <div className="font-bold text-slate-900 text-xs truncate">{s.name}</div>
                              <div className="text-[11px] text-slate-500 truncate">
                                {s.company} {s.mobile ? `• ${s.mobile}` : ''}
                              </div>
                            </div>
                            <span className="text-[11px] font-mono font-semibold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded shrink-0">
                              {formatINR(s.current_balance || 0)}
                            </span>
                          </div>
                        ))
                      ) : (
                        <div className="p-3 text-center text-slate-400 text-xs">
                          {currentLang === 'mr' ? 'कोणताही पुरवठादार सापडला नाही' : 'No suppliers found'}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
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
              {/* Searchable Autocomplete Product Dropdown */}
              <div className="col-span-2 relative" ref={productRef}>
                <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">
                  {getTranslation('product', currentLang)}: *
                </label>

                {selectedProduct ? (
                  <div className="flex items-center justify-between p-1.5 bg-emerald-50 border border-emerald-300 rounded text-xs shadow-2xs">
                    <div className="min-w-0 pr-1">
                      <span className="font-bold text-emerald-950 block truncate">
                        {currentLang === 'mr' && selectedProduct.name_mr ? selectedProduct.name_mr : selectedProduct.name}
                      </span>
                      <span className="text-[10px] text-emerald-700 block truncate">
                        {selectedProduct.pack_size} {selectedProduct.company ? `• ${selectedProduct.company}` : ''}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedProdId(0);
                        setProductSearch('');
                        setIsProductOpen(true);
                      }}
                      className="p-0.5 hover:bg-emerald-200/70 rounded text-emerald-800 hover:text-emerald-950 cursor-pointer shrink-0"
                      title={currentLang === 'mr' ? 'दुसरे उत्पादन निवडा' : 'Change Product'}
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <div className="relative">
                    <div className="relative flex items-center">
                      <Search className="w-3 h-3 absolute left-2 text-slate-400 pointer-events-none" />
                      <input
                        type="text"
                        value={productSearch}
                        onChange={(e) => {
                          setProductSearch(e.target.value);
                          setIsProductOpen(true);
                        }}
                        onFocus={() => setIsProductOpen(true)}
                        placeholder={currentLang === 'mr' ? 'उत्पादन नाव किंवा पॅकने शोधा...' : 'Search product or pack size...'}
                        className="w-full pl-6 pr-6 py-1.5 bg-white border border-slate-300 rounded text-xs focus:outline-emerald-600 focus:border-emerald-600"
                      />
                      {productSearch && (
                        <button
                          type="button"
                          onClick={() => {
                            setProductSearch('');
                            setIsProductOpen(false);
                          }}
                          className="absolute right-1.5 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </div>

                    {isProductOpen && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-2xl z-50 max-h-56 overflow-y-auto divide-y divide-slate-100">
                        {filteredProducts.length > 0 ? (
                          filteredProducts.map((p) => (
                            <div
                              key={p.id}
                              onClick={() => {
                                setSelectedProdId(p.id);
                                setPurchaseRate(p.purchase_rate);
                                setMrp(p.mrp);
                                setSellingRate(p.selling_rate);
                                setProductSearch('');
                                setIsProductOpen(false);
                              }}
                              className="p-2 hover:bg-emerald-50 cursor-pointer transition-colors"
                            >
                              <div className="font-bold text-slate-900 text-xs flex items-center justify-between">
                                <span className="truncate">
                                  {currentLang === 'mr' && p.name_mr ? p.name_mr : p.name}
                                </span>
                                <span className="text-[10px] bg-slate-100 px-1 py-0.5 rounded text-slate-600 font-mono shrink-0 ml-1">
                                  {p.pack_size}
                                </span>
                              </div>
                              <div className="text-[10px] text-slate-500 flex items-center justify-between mt-0.5">
                                <span className="truncate">{p.company || p.category}</span>
                                <span className="font-mono font-medium text-emerald-700 shrink-0 ml-1">
                                  दर: {formatINR(p.purchase_rate)}
                                </span>
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="p-3 text-center text-slate-400 text-xs">
                            {currentLang === 'mr' ? 'कोणतेही उत्पादन सापडले नाही' : 'No products found'}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
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

      {/* AI Invoice Scanner Modal */}
      <AiInvoiceScannerModal
        isOpen={isAiScanOpen}
        onClose={() => setIsAiScanOpen(false)}
        currentLang={currentLang}
        suppliers={suppliers}
        products={products}
        onApplyData={handleApplyAiScannedData}
        onQuotaExceeded={() => setAiAvailable(false)}
      />
    </div>
  );
};
