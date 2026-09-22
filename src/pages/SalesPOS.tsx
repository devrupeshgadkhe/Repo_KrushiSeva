import React, { useState, useEffect, useRef } from 'react';
import { 
  Plus, 
  Minus,
  Trash2, 
  Printer, 
  Save, 
  PauseCircle, 
  X, 
  Search, 
  User, 
  UserPlus,
  Barcode, 
  AlertCircle, 
  Sparkles, 
  Calendar,
  RotateCcw,
  CheckCircle2,
  Edit3,
  FileCheck,
  Receipt
} from 'lucide-react';
import { 
  AppLanguage, 
  Product, 
  ProductBatch, 
  Customer, 
  SaleItem, 
  PaymentMode, 
  BusinessSettings, 
  InvoiceSettings,
  Sale
} from '../types';
import { getTranslation } from '../i18n';
import { formatINR, calculateLineGst, formatDate } from '../utils/formatters';
import { dbService } from '../services/api';
import { cloudBackupService } from '../services/cloudBackupService';
import { PrintInvoiceModal } from '../components/common/PrintInvoiceModal';
import { QuickAddCustomerModal } from '../components/common/QuickAddCustomerModal';
import { useFeedback } from '../components/common/FeedbackContext';

interface SalesPOSProps {
  currentLang: AppLanguage;
  onSaleCompleted: () => void;
  editingSaleId?: number | null;
  onCancelEdit?: () => void;
}

export const SalesPOS: React.FC<SalesPOSProps> = ({ 
  currentLang, 
  onSaleCompleted,
  editingSaleId,
  onCancelEdit
}) => {
  const { showToast, showConfirm } = useFeedback();
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
  const [isQuickAddCustomerOpen, setIsQuickAddCustomerOpen] = useState(false);

  // GST vs Non-GST Billing Mode (Persisted in localStorage)
  const [isGstBill, setIsGstBill] = useState<boolean>(() => {
    const saved = localStorage.getItem('pos_billing_is_gst');
    return saved !== null ? saved === 'true' : true;
  });

  const toggleGstBillingMode = (newMode: boolean) => {
    setIsGstBill(newMode);
    localStorage.setItem('pos_billing_is_gst', String(newMode));
    // Recalculate all cart items with updated tax mode
    setItems((prevItems) => {
      return prevItems.map((item) => {
        const prod = products.find((p) => p.id === item.product_id);
        const effectiveGstRate = newMode ? (prod?.gst_rate || item.gst_rate || 0) : 0;
        const calc = calculateLineGst(
          item.quantity,
          item.rate,
          item.discount_percent,
          effectiveGstRate
        );
        return {
          ...item,
          gst_rate: effectiveGstRate,
          ...calc,
        };
      });
    });
  };

  // Walk-in customer custom inputs
  const [isWalkIn, setIsWalkIn] = useState(true);
  const [walkInName, setWalkInName] = useState('');
  const [walkInMobile, setWalkInMobile] = useState('');
  const [walkInVillage, setWalkInVillage] = useState('');

  // Bill Header & Payment
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState('');
  const [paymentMode, setPaymentMode] = useState<PaymentMode>('Cash');
  const [paidAmount, setPaidAmount] = useState<number>(0);
  const [notes, setNotes] = useState('');
  const [heldBills, setHeldBills] = useState<{ id: string; time: string; customer: string; items: SaleItem[] }[]>([]);

  // Product Selection & FEFO Batch modal
  const [productQuery, setProductQuery] = useState('');
  const [searchedProducts, setSearchedProducts] = useState<Product[]>([]);
  const [showProductDropdown, setShowProductDropdown] = useState(false);
  const [batchModalOpen, setBatchModalOpen] = useState(false);
  const [pendingProduct, setPendingProduct] = useState<Product | null>(null);
  const [availableBatches, setAvailableBatches] = useState<ProductBatch[]>([]);

  // Print Modal
  const [completedSale, setCompletedSale] = useState<Sale | null>(null);
  const [showPrintModal, setShowPrintModal] = useState(false);

  // State flags
  const [loading, setLoading] = useState(false);
  const [loadingEditSale, setLoadingEditSale] = useState(false);
  const [editingInvoiceNo, setEditingInvoiceNo] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  const barcodeInputRef = useRef<HTMLInputElement>(null);
  const customerInputRef = useRef<HTMLInputElement>(null);

  // Load Initial Settings & Master Data
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

  // Handle Editing Sale Initialization if editingSaleId is provided
  useEffect(() => {
    if (!editingSaleId) {
      setEditingInvoiceNo(null);
      return;
    }

    const loadSaleForEdit = async () => {
      setLoadingEditSale(true);
      try {
        const sale = await dbService.getSaleById(editingSaleId);
        if (!sale) {
          showToast(isMr ? 'बिल सापडले नाही.' : 'Bill not found.', 'error');
          if (onCancelEdit) onCancelEdit();
          return;
        }

        setEditingInvoiceNo(sale.invoice_no);
        setInvoiceDate(sale.invoice_date);
        setPaymentMode(sale.payment_mode);
        setPaidAmount(sale.paid_amount);
        setNotes(sale.notes || '');

        if (sale.is_gst_bill !== undefined && sale.is_gst_bill !== null) {
          setIsGstBill(Boolean(sale.is_gst_bill));
        } else {
          setIsGstBill(((sale.total_tax || 0) > 0 || (sale.cgst_amount || 0) + (sale.sgst_amount || 0) > 0));
        }

        if (sale.customer_id && sale.customer_id > 0) {
          const cust = customers.find((c) => c.id === sale.customer_id);
          if (cust) {
            setSelectedCustomer(cust);
            setIsWalkIn(false);
          } else {
            setSelectedCustomer(null);
            setIsWalkIn(true);
            setWalkInName(sale.customer_name);
            setWalkInMobile(sale.customer_mobile || '');
            setWalkInVillage(sale.customer_village || '');
          }
        } else {
          setSelectedCustomer(null);
          setIsWalkIn(true);
          setWalkInName(sale.customer_name !== 'Walk-in' && sale.customer_name !== 'रोख ग्राहक' ? sale.customer_name : '');
          setWalkInMobile(sale.customer_mobile || '');
          setWalkInVillage(sale.customer_village || '');
        }

        // Set items
        if (sale.items && sale.items.length > 0) {
          setItems(sale.items);
        }

        showToast(
          isMr 
            ? `बिल क्र. ${sale.invoice_no} संपादनासाठी उघडले आहे.` 
            : `Invoice ${sale.invoice_no} loaded for editing.`, 
          'info'
        );
      } catch (err: any) {
        console.error('Failed to load sale for edit:', err);
        showToast(err.message || 'Error loading bill for edit', 'error');
      } finally {
        setLoadingEditSale(false);
      }
    };

    loadSaleForEdit();
  }, [editingSaleId, customers]);

  // Keyboard Shortcuts (F2, F4, Ctrl+S, Ctrl+P)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F2') {
        e.preventDefault();
        barcodeInputRef.current?.focus();
      } else if (e.key === 'F4') {
        e.preventDefault();
        setShowCustomerDropdown(true);
        customerInputRef.current?.focus();
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
  }, [items, selectedCustomer, paymentMode, paidAmount, editingSaleId]);

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
        (p.name && p.name.toLowerCase().includes(q)) ||
        (p.name_mr && p.name_mr.toLowerCase().includes(q)) ||
        (p.name_hi && p.name_hi.toLowerCase().includes(q)) ||
        (p.product_code && p.product_code.toLowerCase().includes(q)) ||
        (p.company && p.company.toLowerCase().includes(q)) ||
        (p.brand && p.brand.toLowerCase().includes(q)) ||
        (p.technical_name && p.technical_name.toLowerCase().includes(q)) ||
        (p.fertilizer_grade && p.fertilizer_grade.toLowerCase().includes(q)) ||
        (p.category && p.category.toLowerCase().includes(q)) ||
        (p.subcategory && p.subcategory.toLowerCase().includes(q)) ||
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

    if (filtered.length > 0) {
      setSearchedProducts(filtered);
      setShowProductDropdown(true);
    } else {
      // If not found in cached list, query database directly to find newly created products
      dbService.getProducts(productQuery.trim()).then((dbProds) => {
        if (dbProds && dbProds.length > 0) {
          setSearchedProducts(dbProds);
          setShowProductDropdown(true);
          // Merge newly found products into master state
          setProducts((prev) => {
            const existingIds = new Set(prev.map((p) => p.id));
            const newOnes = dbProds.filter((p) => !existingIds.has(p.id));
            return [...newOnes, ...prev];
          });
        } else {
          setSearchedProducts([]);
          setShowProductDropdown(false);
        }
      }).catch(console.warn);
    }
  }, [productQuery, products]);

  // When user selects a product
  const selectProductForCart = async (product: Product) => {
    try {
      let batches = await dbService.getProductBatches(product.id);

      // If product has no batch yet, auto-create default batch immediately so user is never blocked from billing
      if (!batches || batches.length === 0) {
        try {
          const newBatch = await dbService.createDefaultBatch(product.id, {
            selling_rate: product.selling_rate,
            purchase_rate: product.purchase_rate,
            mrp: product.mrp,
            current_qty: 10,
          });
          batches = [newBatch];
        } catch (e) {
          console.warn('Could not auto-create batch:', e);
        }
      }

      const inStockBatches = (batches || []).filter((b) => b.current_qty > 0);

      if (inStockBatches.length === 0) {
        if (batches && batches.length > 0) {
          addItemToCart(product, batches[0]);
        } else {
          try {
            const newBatch = await dbService.createDefaultBatch(product.id, {
              selling_rate: product.selling_rate,
              purchase_rate: product.purchase_rate,
              mrp: product.mrp,
              current_qty: 10,
            });
            addItemToCart(product, newBatch);
          } catch {
            addItemToCart(product, {
              id: 0,
              product_id: product.id,
              batch_number: 'BATCH-01',
              purchase_rate: product.purchase_rate || 0,
              mrp: product.mrp || 0,
              selling_rate: product.selling_rate || 0,
              current_qty: 10,
            } as any);
          }
        }
      } else if (inStockBatches.length === 1) {
        addItemToCart(product, inStockBatches[0]);
      } else {
        setPendingProduct(product);
        setAvailableBatches(inStockBatches);
        setBatchModalOpen(true);
      }

      setProductQuery('');
      setShowProductDropdown(false);
    } catch (err) {
      console.error('Error selecting product for cart:', err);
      addItemToCart(product, {
        id: 0,
        product_id: product.id,
        batch_number: 'BATCH-01',
        purchase_rate: product.purchase_rate || 0,
        mrp: product.mrp || 0,
        selling_rate: product.selling_rate || 0,
        current_qty: 10,
      } as any);
      setProductQuery('');
      setShowProductDropdown(false);
    }
  };

  // Add Item to Bill
  const addItemToCart = (product: Product, batch: ProductBatch, quantity = 1) => {
    const existingIndex = items.findIndex(
      (it) => it.product_id === product.id && it.batch_id === batch.id
    );

    const effectiveGstRate = isGstBill ? (product.gst_rate || 0) : 0;

    if (existingIndex > -1) {
      // Increase qty
      const existing = items[existingIndex];
      const newQty = Math.round((existing.quantity + quantity) * 100) / 100;
      const calc = calculateLineGst(
        newQty,
        existing.rate,
        existing.discount_percent,
        effectiveGstRate
      );

      const updated = [...items];
      updated[existingIndex] = {
        ...existing,
        quantity: newQty,
        gst_rate: effectiveGstRate,
        ...calc,
      };
      setItems(updated);
    } else {
      // New line item
      const rate = batch.selling_rate || product.selling_rate;
      const discountPercent = 0;
      const calc = calculateLineGst(quantity, rate, discountPercent, effectiveGstRate);

      const newItem: SaleItem = {
        product_id: product.id,
        product_name: isMr && product.name_mr ? product.name_mr : product.name,
        product_code: product.product_code,
        hsn_code: product.hsn_code,
        mfg: product.company || '',
        company: product.company || '',
        content: product.technical_name || product.fertilizer_grade || '',
        batch_id: batch.id,
        batch_number: batch.batch_number,
        expiry_date: batch.expiry_date,
        unit: product.unit,
        pack_size: product.pack_size,
        quantity,
        rate,
        mrp: batch.mrp || product.mrp,
        discount_percent: discountPercent,
        ...calc,
        gst_rate: effectiveGstRate,
      };

      setItems([...items, newItem]);
    }

    setBatchModalOpen(false);
    setPendingProduct(null);
  };

  // Update item field in cart (quantity, rate, discount)
  const updateItemRow = (
    index: number,
    field: 'quantity' | 'rate' | 'discount_percent',
    value: number
  ) => {
    const newItems = [...items];
    const target = { ...newItems[index] };

    if (field === 'quantity') {
      target.quantity = Math.max(0.01, value);
    } else if (field === 'rate') {
      target.rate = Math.max(0, value);
    } else if (field === 'discount_percent') {
      target.discount_percent = Math.min(100, Math.max(0, value));
    }

    const effectiveGstRate = isGstBill ? (target.gst_rate || 0) : 0;
    const calc = calculateLineGst(
      target.quantity,
      target.rate,
      target.discount_percent,
      effectiveGstRate
    );

    newItems[index] = {
      ...target,
      ...calc,
      gst_rate: effectiveGstRate,
    };
    setItems(newItems);
  };

  // Step quantity by +1 or -1
  const stepQuantity = (index: number, delta: number) => {
    const current = items[index].quantity;
    const nextVal = Math.max(1, Math.round((current + delta) * 100) / 100);
    updateItemRow(index, 'quantity', nextVal);
  };

  // Remove individual item
  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  // Calculations
  const subtotal = items.reduce((acc, item) => acc + item.lineTotal, 0);
  const totalDiscount = items.reduce((acc, item) => acc + item.discountAmount, 0);
  const taxableAmount = isGstBill 
    ? items.reduce((acc, item) => acc + item.taxableValue, 0) 
    : (subtotal - totalDiscount);
  const totalTax = isGstBill ? items.reduce((acc, item) => acc + item.totalTax, 0) : 0;
  const cgstAmount = isGstBill ? totalTax / 2 : 0;
  const sgstAmount = isGstBill ? totalTax / 2 : 0;
  const rawGrandTotal = isGstBill ? (taxableAmount + totalTax) : (subtotal - totalDiscount);
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

  // Save Sale Transaction (Create or Update)
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
      // Determine customer details
      let customerName = isMr ? 'रोख ग्राहक' : 'Walk-in Customer';
      let customerMobile = '';
      let customerVillage = '';

      if (selectedCustomer) {
        customerName = selectedCustomer.name;
        customerMobile = selectedCustomer.mobile || '';
        customerVillage = selectedCustomer.village || '';
      } else if (isWalkIn && walkInName.trim()) {
        customerName = walkInName.trim();
        customerMobile = walkInMobile.trim();
        customerVillage = walkInVillage.trim();
      }

      const salePayload = {
        is_gst_bill: isGstBill,
        invoice_no: editingInvoiceNo || '',
        invoice_date: invoiceDate,
        doc_date: invoiceDate,
        customer_id: selectedCustomer?.id || 0,
        customer_name: customerName,
        customer_mobile: customerMobile,
        customer_village: customerVillage,
        customer_aadhar: selectedCustomer?.aadhar_no || '',
        previous_balance: selectedCustomer?.current_balance || 0,
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

      let resultId: number;
      if (editingSaleId) {
        // Update existing sale
        const res = await dbService.updateSale(editingSaleId, salePayload);
        resultId = res.id;
        showToast(
          isMr 
            ? `बिल क्र. ${res.invoice_no} यशस्वीरित्या अद्ययावत (अपडेट) केले!` 
            : `Invoice ${res.invoice_no} updated successfully!`, 
          'success'
        );
      } else {
        // Create new sale
        const res = await dbService.createSale(salePayload);
        resultId = res.id;
        showToast(
          isMr 
            ? `विक्री बिल क्र. ${res.invoice_no} तयार झाले!` 
            : `Sale bill ${res.invoice_no} generated successfully!`, 
          'success'
        );
      }

      const fullSale = await dbService.getSaleById(resultId);
      onSaleCompleted();
      cloudBackupService.triggerBackup(false).catch(console.warn);

      if (shouldPrint && fullSale) {
        setCompletedSale(fullSale);
        setShowPrintModal(true);
      }

      // Reset Bill for next customer if not editing
      if (!editingSaleId) {
        setItems([]);
        setSelectedCustomer(null);
        setCustomerSearch('');
        setIsWalkIn(true);
        setWalkInName('');
        setWalkInMobile('');
        setWalkInVillage('');
        setPaidAmount(0);
        setNotes('');
        setPaymentMode('Cash');
        barcodeInputRef.current?.focus();
      } else if (onCancelEdit) {
        onCancelEdit();
      }
    } catch (err: any) {
      console.error('Error saving bill:', err);
      setErrorMsg(err.message || (isMr ? 'पावती साठवताना त्रुटी आली.' : 'Error saving invoice.'));
      showToast(err.message || (isMr ? 'पावती साठवताना त्रुटी आली.' : 'Error saving invoice.'), 'error');
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
      customer: selectedCustomer?.name || (walkInName.trim() ? walkInName : (isMr ? 'रोख ग्राहक' : 'Walk-in')),
      items: [...items],
    };
    setHeldBills([...heldBills, holdItem]);
    setItems([]);
    setSelectedCustomer(null);
    setWalkInName('');
    showToast(isMr ? 'बिल होल्ड केले गेले.' : 'Bill held successfully.', 'info');
  };

  const handleResumeBill = (held: typeof heldBills[0]) => {
    setItems(held.items);
    setHeldBills(heldBills.filter((b) => b.id !== held.id));
    showToast(isMr ? 'होल्ड बिल पूर्ववत उघडले.' : 'Held bill resumed.', 'info');
  };

  const paymentModesList = [
    { mode: 'Cash' as PaymentMode, label: isMr ? 'रोख' : 'Cash' },
    { mode: 'UPI' as PaymentMode, label: isMr ? 'ऑनलाइन / UPI' : 'Online / UPI' },
    { mode: 'Credit' as PaymentMode, label: isMr ? 'उधारी' : 'Credit' },
    { mode: 'Card' as PaymentMode, label: isMr ? 'कार्ड' : 'Card' },
    { mode: 'Bank Transfer' as PaymentMode, label: isMr ? 'बँक' : 'Bank' },
    { mode: 'Mixed' as PaymentMode, label: isMr ? 'मिश्र' : 'Mixed' },
  ];

  const filteredCustomers = customers.filter((c) => {
    if (!customerSearch) return true;
    const q = customerSearch.toLowerCase();
    return (
      c.name.toLowerCase().includes(q) ||
      (c.name_mr && c.name_mr.includes(customerSearch)) ||
      c.village.toLowerCase().includes(q) ||
      c.mobile.includes(customerSearch) ||
      (c.aadhar_no && c.aadhar_no.includes(customerSearch))
    );
  });

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-slate-100">
      {/* Editing Banner if in Edit Mode */}
      {editingSaleId && (
        <div className="bg-amber-500 text-slate-950 px-4 py-2 text-xs font-bold flex items-center justify-between shadow-xs z-20">
          <div className="flex items-center gap-2">
            <Edit3 className="w-4 h-4 animate-pulse" />
            <span>
              {isMr ? 'बिल संपादन मोड चालू आहे: ' : 'Invoice Editing Mode Active: '}
              <span className="font-mono underline">{editingInvoiceNo}</span>
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              if (onCancelEdit) onCancelEdit();
            }}
            className="px-2.5 py-1 bg-slate-900 text-white rounded-md text-[11px] hover:bg-slate-800 cursor-pointer"
          >
            {isMr ? 'संपादन रद्द करा' : 'Cancel Edit'}
          </button>
        </div>
      )}

      {/* Top POS Action Toolbar */}
      <div className="bg-white border-b border-slate-200 px-4 py-2.5 flex items-center justify-between gap-3 z-10 shrink-0">
        <div className="flex items-center gap-2.5 flex-1">
          {/* Barcode & Product Search Input with Dropdown */}
          <div className="relative flex-1 max-w-md">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
              <Barcode className="w-4 h-4 text-emerald-600" />
            </div>
            <input
              ref={barcodeInputRef}
              type="text"
              value={productQuery}
              onFocus={async () => {
                try {
                  const p = await dbService.getProducts();
                  setProducts(p);
                } catch (e) {
                  console.error(e);
                }
              }}
              onChange={(e) => setProductQuery(e.target.value)}
              placeholder={getTranslation('scan_or_search_product', currentLang)}
              className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-slate-300 bg-slate-50 focus:bg-white focus:border-emerald-600 focus:outline-none text-xs font-semibold text-slate-800 placeholder-slate-400 shadow-2xs"
            />

            {/* Product Suggestions Dropdown */}
            {showProductDropdown && searchedProducts.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl shadow-2xl border border-slate-200 max-h-72 overflow-y-auto z-50 divide-y divide-slate-100">
                {searchedProducts.map((prod) => (
                  <div
                    key={prod.id}
                    onClick={() => selectProductForCart(prod)}
                    className="px-3.5 py-2.5 hover:bg-emerald-50/80 cursor-pointer flex items-center justify-between text-xs transition-colors"
                  >
                    <div>
                      <div className="font-bold text-slate-900">
                        {isMr && prod.name_mr ? prod.name_mr : prod.name}
                      </div>
                      <div className="text-[11px] text-slate-500 flex items-center gap-2 mt-0.5">
                        <span className="font-medium bg-slate-100 px-1.5 py-0.5 rounded text-slate-600 text-[10px]">
                          {prod.category}
                        </span>
                        {prod.pack_size && <span>{prod.pack_size}</span>}
                        {(prod.company || prod.brand) && <span>• {prod.company || prod.brand}</span>}
                        {prod.technical_name && (
                          <span className="text-emerald-700 font-medium">({prod.technical_name})</span>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-mono font-bold text-emerald-700 text-xs">
                        {formatINR(prod.selling_rate)}
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        MRP: {formatINR(prod.mrp)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Customer / Farmer Selector with Autocomplete */}
          <div className="relative w-80">
            {selectedCustomer ? (
              <div className="flex items-center justify-between border border-emerald-300 bg-emerald-50/80 rounded-lg px-2.5 py-1.5 text-xs">
                <div className="flex items-center gap-2 truncate">
                  <div className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-[11px] shrink-0">
                    {selectedCustomer.name.charAt(0)}
                  </div>
                  <div className="truncate">
                    <div className="font-bold text-slate-900 leading-tight truncate">
                      {selectedCustomer.name}
                    </div>
                    <div className="text-[10px] text-slate-600 truncate">
                      {selectedCustomer.village} • {selectedCustomer.mobile}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 pl-2 shrink-0">
                  <span className={`text-[10px] font-bold font-mono ${selectedCustomer.current_balance > 0 ? 'text-rose-600' : 'text-emerald-700'}`}>
                    {formatINR(selectedCustomer.current_balance)}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedCustomer(null);
                      setIsWalkIn(true);
                    }}
                    title={isMr ? 'ग्राहक बदला' : 'Change customer'}
                    className="text-slate-400 hover:text-rose-600 p-0.5 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ) : (
              <div className="relative">
                <div className="flex items-center border border-slate-300 bg-slate-50 rounded-lg px-2.5 py-1.5 text-xs focus-within:bg-white focus-within:border-blue-600">
                  <Search className="w-3.5 h-3.5 text-blue-600 mr-2 shrink-0" />
                  <input
                    ref={customerInputRef}
                    type="text"
                    value={customerSearch}
                    onChange={(e) => {
                      setCustomerSearch(e.target.value);
                      setShowCustomerDropdown(true);
                    }}
                    onFocus={() => setShowCustomerDropdown(true)}
                    placeholder={isMr ? 'शेतकरी शोधा (नाव, गाव, फोन)...' : 'Search customer/farmer...'}
                    className="w-full bg-transparent border-none focus:outline-none text-xs text-slate-800 placeholder-slate-400"
                  />
                  {customerSearch && (
                    <button
                      type="button"
                      onClick={() => setCustomerSearch('')}
                      className="text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Autocomplete Dropdown */}
                {showCustomerDropdown && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl shadow-2xl border border-slate-200 max-h-64 overflow-y-auto z-50 divide-y divide-slate-100">
                    {/* Walk-in Customer Option */}
                    <div
                      onClick={() => {
                        setSelectedCustomer(null);
                        setIsWalkIn(true);
                        setShowCustomerDropdown(false);
                      }}
                      className="px-3.5 py-2.5 hover:bg-slate-100 cursor-pointer text-xs flex items-center justify-between bg-slate-50/50"
                    >
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-slate-500" />
                        <div>
                          <div className="font-bold text-slate-800">
                            {getTranslation('walk_in_customer', currentLang)}
                          </div>
                          <div className="text-[10px] text-slate-500">
                            {isMr ? 'नोंदणी नसलेला रोख ग्राहक' : 'Unregistered Cash Customer'}
                          </div>
                        </div>
                      </div>
                      <span className="text-[10px] bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded font-medium">
                        {isMr ? 'रोख' : 'Cash'}
                      </span>
                    </div>

                    {/* Filtered Customer List */}
                    {filteredCustomers.slice(0, 15).map((c) => (
                      <div
                        key={c.id}
                        onClick={() => {
                          setSelectedCustomer(c);
                          setIsWalkIn(false);
                          setShowCustomerDropdown(false);
                          setCustomerSearch('');
                        }}
                        className="px-3.5 py-2 hover:bg-blue-50/80 cursor-pointer text-xs flex justify-between items-center transition-colors"
                      >
                        <div>
                          <div className="font-bold text-slate-900">{c.name}</div>
                          <div className="text-[10px] text-slate-500">
                            {c.village ? `${c.village} • ` : ''}{c.mobile}
                          </div>
                        </div>
                        <div className="text-right">
                          <span className={`text-[10px] font-bold font-mono ${c.current_balance > 0 ? 'text-rose-600' : 'text-slate-500'}`}>
                            {isMr ? 'बाकी:' : 'Due:'} {formatINR(c.current_balance)}
                          </span>
                        </div>
                      </div>
                    ))}

                    {filteredCustomers.length === 0 && (
                      <div className="px-3 py-3 text-center text-slate-400 text-xs">
                        {isMr ? 'शेतकरी सापडला नाही' : 'No customer found'}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Quick Add Customer Button */}
          <button
            type="button"
            onClick={() => setIsQuickAddCustomerOpen(true)}
            className="px-2.5 py-1.5 rounded-lg border border-blue-200 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-xs flex items-center gap-1.5 shrink-0 transition-colors cursor-pointer"
            title={isMr ? 'नवीन शेतकरी / ग्राहक जोडा' : 'Add New Customer'}
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>{isMr ? '+ नवीन ग्राहक' : '+ New Customer'}</span>
          </button>
        </div>

        {/* Right Status / Held bills & GST Switcher Toolbar */}
        <div className="flex items-center gap-2">
          {/* GST / Non-GST Mode Switcher */}
          <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-300 text-xs shadow-2xs">
            <button
              type="button"
              onClick={() => toggleGstBillingMode(true)}
              className={`px-2.5 py-1 rounded-md font-bold flex items-center gap-1 transition-all cursor-pointer ${
                isGstBill
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title={isMr ? 'जीएसटी कर बीजक मोड (GST Tax Invoice)' : 'GST Tax Invoice Mode'}
            >
              <FileCheck className="w-3.5 h-3.5" />
              <span>{isMr ? 'GST बिल' : 'GST Bill'}</span>
            </button>
            <button
              type="button"
              onClick={() => toggleGstBillingMode(false)}
              className={`px-2.5 py-1 rounded-md font-bold flex items-center gap-1 transition-all cursor-pointer ${
                !isGstBill
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title={isMr ? 'साधे बिल / Non-GST पावती मोड (Bill of Supply)' : 'Non-GST / Bill of Supply Mode'}
            >
              <Receipt className="w-3.5 h-3.5" />
              <span>{isMr ? 'Non-GST बिल' : 'Non-GST Bill'}</span>
            </button>
          </div>

          {heldBills.length > 0 && (
            <div className="flex items-center gap-1.5 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-lg text-xs text-amber-800">
              <PauseCircle className="w-3.5 h-3.5 text-amber-600" />
              <span>{isMr ? 'होल्ड बिले' : 'Held'}: <strong>{heldBills.length}</strong></span>
              {heldBills.map((hb) => (
                <button
                  key={hb.id}
                  onClick={() => handleResumeBill(hb)}
                  className="px-1.5 py-0.5 bg-amber-200 hover:bg-amber-300 rounded font-bold text-[10px] ml-1 cursor-pointer"
                >
                  {hb.customer}
                </button>
              ))}
            </div>
          )}

          <button
            type="button"
            onClick={handleHoldBill}
            disabled={items.length === 0}
            className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-semibold flex items-center gap-1 disabled:opacity-40 cursor-pointer"
          >
            <PauseCircle className="w-3.5 h-3.5" />
            <span>{isMr ? 'होल्ड' : 'Hold'}</span>
          </button>

          {items.length > 0 && (
            <button
              type="button"
              onClick={() => {
                showConfirm({
                  title: isMr ? 'सर्व आयटम हटवा' : 'Clear All Items',
                  message: isMr ? 'पावतीतील सर्व आयटम काढून टाकायचे आहेत का?' : 'Remove all items from current bill?',
                  confirmText: isMr ? 'होय, हटवा' : 'Yes, Clear',
                  cancelText: isMr ? 'नाही' : 'Cancel',
                  isDanger: true,
                  onConfirm: () => setItems([]),
                });
              }}
              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer"
              title={isMr ? 'सर्व उत्पादने हटवा' : 'Clear items'}
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Walk-in Customer details input bar if no permanent customer selected */}
      {!selectedCustomer && (
        <div className="bg-slate-50 border-b border-slate-200 px-4 py-1.5 flex items-center gap-3 text-xs">
          <span className="font-semibold text-slate-600 shrink-0 flex items-center gap-1">
            <User className="w-3.5 h-3.5 text-slate-500" />
            {isMr ? 'रोख ग्राहक माहिती (पर्यायी):' : 'Walk-in Details (Optional):'}
          </span>
          <input
            type="text"
            value={walkInName}
            onChange={(e) => setWalkInName(e.target.value)}
            placeholder={isMr ? 'ग्राहकाचे नाव (बिलावर छापण्यासाठी)' : 'Customer Name for invoice'}
            className="px-2.5 py-1 bg-white border border-slate-300 rounded text-xs w-56 focus:outline-emerald-600"
          />
          <input
            type="tel"
            maxLength={10}
            value={walkInMobile}
            onChange={(e) => setWalkInMobile(e.target.value.replace(/\D/g, ''))}
            placeholder={isMr ? 'मोबाईल नंबर' : 'Mobile Number'}
            className="px-2.5 py-1 bg-white border border-slate-300 rounded text-xs w-36 font-mono focus:outline-emerald-600"
          />
          <input
            type="text"
            value={walkInVillage}
            onChange={(e) => setWalkInVillage(e.target.value)}
            placeholder={isMr ? 'गाव' : 'Village'}
            className="px-2.5 py-1 bg-white border border-slate-300 rounded text-xs w-36 focus:outline-emerald-600"
          />
        </div>
      )}

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
                  <th className="px-3 py-2 text-center w-32">{getTranslation('qty', currentLang)}</th>
                  <th className="px-3 py-2 text-right w-24">{getTranslation('rate', currentLang)}</th>
                  <th className="px-3 py-2 text-right w-16">{getTranslation('discount', currentLang)}</th>
                  {isGstBill && <th className="px-3 py-2 text-right w-14">GST</th>}
                  <th className="px-3 py-2 text-right w-24">{getTranslation('amount', currentLang)}</th>
                  <th className="px-3 py-2 text-center w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={isGstBill ? 9 : 8} className="py-24 text-center text-slate-400">
                      <Barcode className="w-12 h-12 mx-auto mb-2 text-slate-300" />
                      <div className="text-sm font-semibold text-slate-600">
                        {isMr ? 'पावतीमध्ये वस्तूंची नोंद नाही' : 'Bill is empty'}
                      </div>
                      <div className="text-xs mt-1 text-slate-400">
                        {isMr ? 'बारकोड स्कॅन करा किंवा वरून उत्पादन निवडा (F2)' : 'Scan barcode or search product above (F2)'}
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
                          {item.pack_size} {item.hsn_code ? `• HSN: ${item.hsn_code}` : ''}
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
                      {/* Quantity Stepper Input */}
                      <td className="px-3 py-2">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            onClick={() => stepQuantity(idx, -1)}
                            className="w-5 h-6 rounded bg-slate-200 hover:bg-slate-300 text-slate-700 flex items-center justify-center font-bold cursor-pointer"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <input
                            type="number"
                            step="any"
                            min="0.01"
                            value={item.quantity}
                            onChange={(e) => updateItemRow(idx, 'quantity', parseFloat(e.target.value) || 1)}
                            className="w-14 px-1 py-1 text-center font-mono font-bold bg-slate-50 border border-slate-300 rounded focus:bg-white focus:outline-emerald-600 text-xs"
                          />
                          <button
                            type="button"
                            onClick={() => stepQuantity(idx, 1)}
                            className="w-5 h-6 rounded bg-slate-200 hover:bg-slate-300 text-slate-700 flex items-center justify-center font-bold cursor-pointer"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                      </td>
                      {/* Rate Input */}
                      <td className="px-3 py-2 text-right">
                        <input
                          type="number"
                          step="any"
                          min="0"
                          value={item.rate}
                          onChange={(e) => updateItemRow(idx, 'rate', parseFloat(e.target.value) || 0)}
                          className="w-20 px-1.5 py-1 text-right font-mono bg-slate-50 border border-slate-300 rounded focus:bg-white focus:outline-emerald-600 text-xs font-semibold"
                        />
                      </td>
                      {/* Discount % */}
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
                      {isGstBill && (
                        <td className="px-3 py-2 text-right font-mono text-[11px] text-slate-500">
                          {item.gst_rate}%
                        </td>
                      )}
                      <td className="px-3 py-2 text-right font-mono font-bold text-slate-900">
                        {formatINR(item.total_amount)}
                      </td>
                      {/* Delete Item Row */}
                      <td className="px-3 py-2 text-center">
                        <button
                          type="button"
                          onClick={() => removeItem(idx)}
                          title={isMr ? 'आयटम काढा' : 'Remove item'}
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
              {isGstBill ? (
                <>
                  <span>{isMr ? 'करपात्र मूल्य' : 'Taxable Value'}: <strong className="font-mono text-slate-800">{formatINR(taxableAmount)}</strong></span>
                  <span>{isMr ? 'एकूण जीएसटी' : 'Total GST'}: <strong className="font-mono text-slate-800">{formatINR(totalTax)}</strong></span>
                </>
              ) : (
                <span className="bg-amber-100 text-amber-900 font-bold px-2 py-0.5 rounded text-[11px] border border-amber-300">
                  {isMr ? 'विना-जीएसटी साधे बिल (Bill of Supply)' : 'Non-GST Bill of Supply'}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Right 4 Cols: Payment Calculation & Final Checkout */}
        <div className="lg:col-span-4 bg-slate-50 p-4 flex flex-col justify-between overflow-y-auto border-l border-slate-200">
          <div className="space-y-3.5">
            {/* Grand Total Display Card */}
            <div className={`p-4 rounded-xl shadow-xs border ${
              isGstBill 
                ? 'bg-emerald-950 text-white border-emerald-900' 
                : 'bg-slate-900 text-white border-slate-800'
            }`}>
              <div className="flex items-center justify-between">
                <div className={`text-[11px] font-semibold uppercase tracking-wider ${
                  isGstBill ? 'text-emerald-300' : 'text-amber-400'
                }`}>
                  {getTranslation('grand_total', currentLang)}
                </div>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                  isGstBill ? 'bg-emerald-800 text-emerald-200' : 'bg-amber-700 text-amber-100'
                }`}>
                  {isGstBill ? (isMr ? 'GST कर बिल' : 'GST Invoice') : (isMr ? 'साधे बिल' : 'Bill of Supply')}
                </span>
              </div>
              <div className="text-3xl font-black font-mono tracking-tight text-white mt-1">
                {formatINR(grandTotal)}
              </div>
              <div className="text-[10px] text-slate-300 mt-1 flex justify-between">
                <span>{isMr ? 'उपएकूण' : 'Subtotal'}: {formatINR(subtotal)}</span>
                {totalDiscount > 0 && <span>{isMr ? 'सूट' : 'Discount'}: -{formatINR(totalDiscount)}</span>}
                {roundOff !== 0 && <span>{isMr ? 'राउंड ऑफ' : 'Round off'}: {roundOff}</span>}
              </div>
            </div>

            {/* Date Selection */}
            <div className="bg-white p-3 rounded-xl border border-slate-200 space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-emerald-600" />
                  <span>{isMr ? 'बिल तारीख (Date)' : 'Invoice Date'}</span>
                </label>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setInvoiceDate(new Date().toISOString().split('T')[0])}
                    className="px-2 py-0.5 rounded text-[10px] bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium cursor-pointer"
                  >
                    {isMr ? 'आज' : 'Today'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const d = new Date();
                      d.setDate(d.getDate() - 1);
                      setInvoiceDate(d.toISOString().split('T')[0]);
                    }}
                    className="px-2 py-0.5 rounded text-[10px] bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium cursor-pointer"
                  >
                    {isMr ? 'काल' : 'Yesterday'}
                  </button>
                </div>
              </div>
              <input
                type="date"
                value={invoiceDate}
                onChange={(e) => setInvoiceDate(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-slate-50 text-xs font-mono font-bold focus:bg-white focus:outline-emerald-600"
              />
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
                    {isMr ? 'पूर्ण रक्कम (Full)' : 'Full Amount'}
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

            {/* Optional Notes */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                {getTranslation('description', currentLang)} / {isMr ? 'टीप' : 'Notes'}:
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={isMr ? 'उदा. रोख पावती, उर्वरित पुढील आठवड्यात...' : 'e.g. Remarks'}
                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-xs"
              />
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
              <span>
                {editingSaleId 
                  ? (isMr ? 'बदल जतन करा व प्रिंट करा' : 'Update & Print Bill') 
                  : getTranslation('save_and_print', currentLang)}
              </span>
            </button>

            <button
              type="button"
              onClick={() => handleSaveBill(false)}
              disabled={loading || items.length === 0}
              className="w-full py-2 rounded-xl bg-slate-800 hover:bg-slate-900 disabled:opacity-50 text-white font-semibold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>
                {editingSaleId 
                  ? (isMr ? 'बिल अद्ययावत करा (Update Bill)' : 'Update Bill') 
                  : getTranslation('save_bill', currentLang)}
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                if (editingSaleId && onCancelEdit) {
                  onCancelEdit();
                  return;
                }
                if (items.length === 0) return;
                showConfirm({
                  title: isMr ? 'पावती रद्द करा' : 'Discard Bill',
                  message: isMr ? 'चालू पावती रद्द करायची आहे का? सर्व निवडलेली उत्पादने हटवली जातील.' : 'Discard current bill? All selected items will be removed.',
                  confirmText: isMr ? 'होय, रद्द करा' : 'Yes, Discard',
                  cancelText: isMr ? 'मागे जा' : 'Cancel',
                  isDanger: true,
                  onConfirm: () => {
                    setItems([]);
                    setSelectedCustomer(null);
                    setPaidAmount(0);
                    setNotes('');
                    showToast(isMr ? 'पावती रद्द केली.' : 'Bill discarded.', 'info');
                  }
                });
              }}
              className="w-full py-1.5 text-center text-[11px] text-slate-500 hover:text-rose-600 cursor-pointer font-medium"
            >
              {editingSaleId 
                ? (isMr ? 'संपादन रद्द करा' : 'Cancel Editing') 
                : getTranslation('cancel_bill', currentLang)}
            </button>
          </div>
        </div>
      </div>

      {/* FEFO Batch Selection Modal */}
      {batchModalOpen && pendingProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in zoom-in-95">
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

      {/* Quick Add Customer Modal */}
      <QuickAddCustomerModal
        isOpen={isQuickAddCustomerOpen}
        onClose={() => setIsQuickAddCustomerOpen(false)}
        currentLang={currentLang}
        onCustomerCreated={(newCust) => {
          setCustomers((prev) => [newCust, ...prev]);
          setSelectedCustomer(newCust);
          setIsWalkIn(false);
        }}
      />

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
