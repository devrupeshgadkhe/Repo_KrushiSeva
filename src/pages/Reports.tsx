import React, { useState, useEffect, useMemo } from 'react';
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
  RefreshCw,
  Search,
  Filter,
  ArrowUpDown,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Percent,
  Wallet,
  Building2,
  CalendarRange
} from 'lucide-react';
import { AppLanguage, BusinessSettings, Sale, Purchase, Customer, Product, ProductBatch, Supplier } from '../types';
import { getTranslation } from '../i18n';
import { formatINR, formatDate, exportToCSV } from '../utils/formatters';
import { dbService } from '../services/api';
import { sqliteEngine } from '../db/sqliteEngine';

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

interface ProfitReportItem {
  product_id: number;
  product_name: string;
  category: string;
  company: string;
  unit: string;
  pack_size: string;
  qty_sold: number;
  total_revenue: number;
  total_cost: number;
  gross_profit: number;
  margin_pct: number;
}

interface GstReportItem {
  invoice_no: string;
  invoice_date: string;
  customer_name: string;
  customer_mobile: string;
  gstin?: string;
  is_gst_bill: boolean;
  taxable_amount: number;
  cgst_amount: number;
  sgst_amount: number;
  igst_amount: number;
  total_tax: number;
  grand_total: number;
  payment_mode: string;
}

export const Reports: React.FC<ReportsProps> = ({ currentLang }) => {
  const isMr = currentLang === 'mr';

  // Navigation & Mode
  const [reportType, setReportType] = useState<ReportType>('sales');
  
  // Date Range Filters
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [activeDatePreset, setActiveDatePreset] = useState<string>('this_month');

  // Generic Search
  const [searchQuery, setSearchQuery] = useState('');

  // Specific Filters
  const [paymentModeFilter, setPaymentModeFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [supplierFilter, setSupplierFilter] = useState('all');
  const [villageFilter, setVillageFilter] = useState('all');
  const [stockStatusFilter, setStockStatusFilter] = useState('all');
  const [expiryFilter, setExpiryFilter] = useState('all');
  const [dueAmountFilter, setDueAmountFilter] = useState('all');
  const [taxSlabFilter, setTaxSlabFilter] = useState('all');
  const [billTypeFilter, setBillTypeFilter] = useState('all');

  // Loaded Data
  const [loading, setLoading] = useState(false);
  const [salesData, setSalesData] = useState<Sale[]>([]);
  const [purchasesData, setPurchasesData] = useState<Purchase[]>([]);
  const [stockData, setStockData] = useState<any[]>([]);
  const [customersData, setCustomersData] = useState<Customer[]>([]);
  const [profitData, setProfitData] = useState<ProfitReportItem[]>([]);
  const [gstData, setGstData] = useState<GstReportItem[]>([]);

  // Metadata dropdown options
  const [suppliersList, setSuppliersList] = useState<Supplier[]>([]);
  const [villagesList, setVillagesList] = useState<string[]>([]);
  const [categoriesList, setCategoriesList] = useState<string[]>([]);
  const [businessSettings, setBusinessSettings] = useState<BusinessSettings | null>(null);

  // Initialize Business Settings & Dropdown Lists
  useEffect(() => {
    dbService.getBusinessSettings().then(setBusinessSettings).catch(console.error);
    
    // Load suppliers
    dbService.getSuppliers().then(setSuppliersList).catch(console.error);

    // Load available villages from customers table
    sqliteEngine.getDb().then(() => {
      try {
        const villages = sqliteEngine.query<{ village: string }>(
          "SELECT DISTINCT village FROM customers WHERE village IS NOT NULL AND TRIM(village) != '' ORDER BY village ASC;"
        );
        setVillagesList(villages.map(v => v.village));

        const cats = sqliteEngine.query<{ category: string }>(
          "SELECT DISTINCT category FROM products WHERE category IS NOT NULL AND TRIM(category) != '' ORDER BY category ASC;"
        );
        setCategoriesList(cats.map(c => c.category));
      } catch (e) {
        console.warn('Metadata load error:', e);
      }
    });

    // Default to 'This Month'
    applyDatePreset('this_month');
  }, []);

  // Quick Date Range Preset Selector
  const applyDatePreset = (preset: string) => {
    setActiveDatePreset(preset);
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const toYMD = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

    if (preset === 'today') {
      const todayStr = toYMD(now);
      setFromDate(todayStr);
      setToDate(todayStr);
    } else if (preset === 'yesterday') {
      const y = new Date(now);
      y.setDate(y.getDate() - 1);
      const yStr = toYMD(y);
      setFromDate(yStr);
      setToDate(yStr);
    } else if (preset === 'this_week') {
      const start = new Date(now);
      const day = start.getDay();
      const diff = start.getDate() - day + (day === 0 ? -6 : 1); // Monday
      start.setDate(diff);
      setFromDate(toYMD(start));
      setToDate(toYMD(now));
    } else if (preset === 'this_month') {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      setFromDate(toYMD(firstDay));
      setToDate(toYMD(now));
    } else if (preset === 'last_month') {
      const firstDayPrev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastDayPrev = new Date(now.getFullYear(), now.getMonth(), 0);
      setFromDate(toYMD(firstDayPrev));
      setToDate(toYMD(lastDayPrev));
    } else if (preset === 'this_year') {
      // Indian Financial Year: April 1 to March 31
      const currentYear = now.getFullYear();
      const startYear = now.getMonth() >= 3 ? currentYear : currentYear - 1;
      setFromDate(`${startYear}-04-01`);
      setToDate(`${startYear + 1}-03-31`);
    } else if (preset === 'all') {
      setFromDate('');
      setToDate('');
    }
  };

  // Main Report Data Fetcher
  const loadReportData = async () => {
    setLoading(true);
    try {
      await sqliteEngine.getDb();

      if (reportType === 'sales') {
        const sales = await dbService.getSales('', fromDate, toDate, 5000);
        setSalesData(sales);
      } else if (reportType === 'purchases') {
        const purchases = await dbService.getPurchases('', fromDate, toDate, 5000);
        setPurchasesData(purchases);
      } else if (reportType === 'stock') {
        const batches = await dbService.getInventoryBatches();
        setStockData(batches);
      } else if (reportType === 'expiry') {
        const batches = await dbService.getInventoryBatches();
        setStockData(batches);
      } else if (reportType === 'khata') {
        const custs = await dbService.getCustomers('', villageFilter !== 'all' ? villageFilter : '');
        setCustomersData(custs.filter((c) => (c.current_balance || 0) > 0));
      } else if (reportType === 'profit') {
        // Realized Gross Profit query from sale_items + sales + products + product_batches
        let sql = `
          SELECT 
            p.id as product_id,
            p.name as product_name,
            p.category,
            COALESCE(p.company, p.brand, '') as company,
            p.unit,
            p.pack_size,
            COALESCE(SUM(si.quantity), 0) as qty_sold,
            COALESCE(SUM(si.taxable_value), 0) as total_revenue,
            COALESCE(SUM(si.quantity * COALESCE(pb.purchase_rate, p.purchase_rate, 0)), 0) as total_cost,
            COALESCE(SUM(si.taxable_value - (si.quantity * COALESCE(pb.purchase_rate, p.purchase_rate, 0))), 0) as gross_profit
          FROM sale_items si
          JOIN sales s ON si.sale_id = s.id
          JOIN products p ON si.product_id = p.id
          LEFT JOIN product_batches pb ON si.batch_id = pb.id
          WHERE 1=1
        `;
        const params: any[] = [];
        if (fromDate) {
          sql += ' AND s.invoice_date >= ?';
          params.push(fromDate);
        }
        if (toDate) {
          sql += ' AND s.invoice_date <= ?';
          params.push(toDate);
        }
        sql += ' GROUP BY p.id ORDER BY gross_profit DESC';
        const rows = sqliteEngine.query<any>(sql, params);
        
        const mapped: ProfitReportItem[] = rows.map((r) => {
          const rev = Number(r.total_revenue) || 0;
          const cost = Number(r.total_cost) || 0;
          const profit = Number(r.gross_profit) || 0;
          const margin = cost > 0 ? Math.round((profit / cost) * 100) : (rev > 0 ? 100 : 0);
          return {
            product_id: r.product_id,
            product_name: r.product_name,
            category: r.category || 'General',
            company: r.company || '',
            unit: r.unit || 'Nos',
            pack_size: r.pack_size || '',
            qty_sold: Number(r.qty_sold) || 0,
            total_revenue: rev,
            total_cost: cost,
            gross_profit: profit,
            margin_pct: margin
          };
        });

        // If no sales yet in date range, show products with potential profit margin
        if (mapped.length === 0 && !fromDate && !toDate) {
          const prods = await dbService.getProducts();
          const fallback: ProfitReportItem[] = prods.slice(0, 50).map(p => ({
            product_id: p.id,
            product_name: p.name,
            category: p.category,
            company: p.company || p.brand || '',
            unit: p.unit,
            pack_size: p.pack_size,
            qty_sold: 0,
            total_revenue: p.selling_rate,
            total_cost: p.purchase_rate,
            gross_profit: p.selling_rate - p.purchase_rate,
            margin_pct: p.purchase_rate > 0 ? Math.round(((p.selling_rate - p.purchase_rate) / p.purchase_rate) * 100) : 0
          }));
          setProfitData(fallback);
        } else {
          setProfitData(mapped);
        }
      } else if (reportType === 'gst') {
        const sales = await dbService.getSales('', fromDate, toDate, 5000);
        const mapped: GstReportItem[] = sales.map(s => ({
          invoice_no: s.invoice_no,
          invoice_date: s.invoice_date,
          customer_name: s.customer_name,
          customer_mobile: s.customer_mobile || '-',
          gstin: (s as any).customer_gstin || '-',
          is_gst_bill: Boolean(s.is_gst_bill),
          taxable_amount: s.taxable_amount || 0,
          cgst_amount: s.cgst_amount || 0,
          sgst_amount: s.sgst_amount || 0,
          igst_amount: s.igst_amount || 0,
          total_tax: s.total_tax || (s.cgst_amount + s.sgst_amount + (s.igst_amount || 0)),
          grand_total: s.grand_total,
          payment_mode: s.payment_mode
        }));
        setGstData(mapped);
      }
    } catch (err) {
      console.error('Report loading error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReportData();
  }, [reportType, fromDate, toDate]);

  // Reset Filters Handler
  const handleResetFilters = () => {
    setSearchQuery('');
    setPaymentModeFilter('all');
    setCategoryFilter('all');
    setSupplierFilter('all');
    setVillageFilter('all');
    setStockStatusFilter('all');
    setExpiryFilter('all');
    setDueAmountFilter('all');
    setTaxSlabFilter('all');
    setBillTypeFilter('all');
    applyDatePreset('this_month');
  };

  // Filtered Sales
  const filteredSales = useMemo(() => {
    return salesData.filter((s) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matches = 
          s.invoice_no.toLowerCase().includes(q) ||
          s.customer_name.toLowerCase().includes(q) ||
          (s.customer_mobile && s.customer_mobile.includes(q));
        if (!matches) return false;
      }
      if (paymentModeFilter !== 'all' && s.payment_mode !== paymentModeFilter) {
        return false;
      }
      if (billTypeFilter === 'gst' && !s.is_gst_bill) return false;
      if (billTypeFilter === 'non_gst' && s.is_gst_bill) return false;
      return true;
    });
  }, [salesData, searchQuery, paymentModeFilter, billTypeFilter]);

  // Filtered Purchases
  const filteredPurchases = useMemo(() => {
    return purchasesData.filter((p) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matches = 
          p.purchase_no.toLowerCase().includes(q) ||
          p.supplier_name.toLowerCase().includes(q) ||
          (p.supplier_invoice_no && p.supplier_invoice_no.toLowerCase().includes(q));
        if (!matches) return false;
      }
      if (supplierFilter !== 'all' && p.supplier_name !== supplierFilter) {
        return false;
      }
      if (paymentModeFilter !== 'all' && p.payment_mode !== paymentModeFilter) {
        return false;
      }
      return true;
    });
  }, [purchasesData, searchQuery, supplierFilter, paymentModeFilter]);

  // Filtered Stock
  const filteredStock = useMemo(() => {
    return stockData.filter((b) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matches = 
          (b.product_name && b.product_name.toLowerCase().includes(q)) ||
          (b.batch_number && b.batch_number.toLowerCase().includes(q)) ||
          (b.product_category && b.product_category.toLowerCase().includes(q));
        if (!matches) return false;
      }
      if (categoryFilter !== 'all' && b.product_category !== categoryFilter) {
        return false;
      }
      if (stockStatusFilter === 'in_stock' && b.current_qty <= 0) return false;
      if (stockStatusFilter === 'out_of_stock' && b.current_qty > 0) return false;
      if (stockStatusFilter === 'low_stock' && (b.current_qty <= 0 || b.current_qty > 10)) return false;
      return true;
    });
  }, [stockData, searchQuery, categoryFilter, stockStatusFilter]);

  // Filtered Expiry Tracker
  const filteredExpiry = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return stockData.map((b) => {
      let daysRemaining = 999;
      let isExpired = false;
      if (b.expiry_date) {
        const exp = new Date(b.expiry_date);
        exp.setHours(0, 0, 0, 0);
        daysRemaining = Math.ceil((exp.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        isExpired = daysRemaining <= 0;
      }
      return { ...b, daysRemaining, isExpired };
    }).filter((b) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matches = 
          (b.product_name && b.product_name.toLowerCase().includes(q)) ||
          (b.batch_number && b.batch_number.toLowerCase().includes(q));
        if (!matches) return false;
      }
      if (categoryFilter !== 'all' && b.product_category !== categoryFilter) {
        return false;
      }
      if (expiryFilter === 'expired' && !b.isExpired) return false;
      if (expiryFilter === '30_days' && (b.isExpired || b.daysRemaining > 30)) return false;
      if (expiryFilter === '60_days' && (b.isExpired || b.daysRemaining > 60)) return false;
      if (expiryFilter === '90_days' && (b.isExpired || b.daysRemaining > 90)) return false;
      if (expiryFilter === '180_days' && (b.isExpired || b.daysRemaining > 180)) return false;
      return true;
    }).sort((a, b) => a.daysRemaining - b.daysRemaining);
  }, [stockData, searchQuery, categoryFilter, expiryFilter]);

  // Filtered Khata
  const filteredKhata = useMemo(() => {
    return customersData.filter((c) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matches = 
          c.name.toLowerCase().includes(q) ||
          (c.name_mr && c.name_mr.toLowerCase().includes(q)) ||
          (c.mobile && c.mobile.includes(q)) ||
          (c.village && c.village.toLowerCase().includes(q)) ||
          (c.customer_code && c.customer_code.toLowerCase().includes(q));
        if (!matches) return false;
      }
      if (villageFilter !== 'all' && c.village !== villageFilter) {
        return false;
      }
      const bal = c.current_balance || 0;
      if (dueAmountFilter === '1000' && bal < 1000) return false;
      if (dueAmountFilter === '5000' && bal < 5000) return false;
      if (dueAmountFilter === '10000' && bal < 10000) return false;
      if (dueAmountFilter === '25000' && bal < 25000) return false;
      return true;
    }).sort((a, b) => (b.current_balance || 0) - (a.current_balance || 0));
  }, [customersData, searchQuery, villageFilter, dueAmountFilter]);

  // Filtered Profit
  const filteredProfit = useMemo(() => {
    return profitData.filter((p) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matches = 
          p.product_name.toLowerCase().includes(q) ||
          p.company.toLowerCase().includes(q);
        if (!matches) return false;
      }
      if (categoryFilter !== 'all' && p.category !== categoryFilter) {
        return false;
      }
      return true;
    });
  }, [profitData, searchQuery, categoryFilter]);

  // Filtered GST
  const filteredGst = useMemo(() => {
    return gstData.filter((g) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matches = 
          g.invoice_no.toLowerCase().includes(q) ||
          g.customer_name.toLowerCase().includes(q) ||
          g.customer_mobile.includes(q) ||
          g.gstin?.toLowerCase().includes(q);
        if (!matches) return false;
      }
      if (billTypeFilter === 'b2b' && (!g.gstin || g.gstin === '-')) return false;
      if (billTypeFilter === 'b2c' && (g.gstin && g.gstin !== '-')) return false;
      return true;
    });
  }, [gstData, searchQuery, billTypeFilter]);

  // Metrics Calculations
  const salesMetrics = useMemo(() => {
    const totalSales = filteredSales.reduce((sum, s) => sum + (s.grand_total || 0), 0);
    const totalPaid = filteredSales.reduce((sum, s) => sum + (s.paid_amount || 0), 0);
    const totalCredit = filteredSales.reduce((sum, s) => sum + (s.credit_amount || 0), 0);
    const totalTax = filteredSales.reduce((sum, s) => sum + (s.total_tax || 0), 0);
    return { totalSales, totalPaid, totalCredit, totalTax, count: filteredSales.length };
  }, [filteredSales]);

  const purchaseMetrics = useMemo(() => {
    const totalPurchases = filteredPurchases.reduce((sum, p) => sum + (p.grand_total || 0), 0);
    const totalPaid = filteredPurchases.reduce((sum, p) => sum + (p.paid_amount || 0), 0);
    const totalPayable = filteredPurchases.reduce((sum, p) => sum + (p.credit_amount || 0), 0);
    const totalTax = filteredPurchases.reduce((sum, p) => sum + (p.total_tax || 0), 0);
    return { totalPurchases, totalPaid, totalPayable, totalTax, count: filteredPurchases.length };
  }, [filteredPurchases]);

  const stockMetrics = useMemo(() => {
    let totalCost = 0;
    let totalMrp = 0;
    filteredStock.forEach((b) => {
      const qty = Number(b.current_qty) || 0;
      totalCost += qty * (Number(b.purchase_rate) || 0);
      totalMrp += qty * (Number(b.mrp) || 0);
    });
    const potentialMargin = totalMrp - totalCost;
    return { totalCost, totalMrp, potentialMargin, count: filteredStock.length };
  }, [filteredStock]);

  const expiryMetrics = useMemo(() => {
    const expired = filteredExpiry.filter(b => b.isExpired);
    const within30 = filteredExpiry.filter(b => !b.isExpired && b.daysRemaining <= 30);
    const expiredVal = expired.reduce((s, b) => s + (b.current_qty * b.purchase_rate), 0);
    const within30Val = within30.reduce((s, b) => s + (b.current_qty * b.purchase_rate), 0);
    return { 
      expiredCount: expired.length, 
      expiredVal, 
      within30Count: within30.length, 
      within30Val,
      totalCount: filteredExpiry.length 
    };
  }, [filteredExpiry]);

  const khataMetrics = useMemo(() => {
    const totalDue = filteredKhata.reduce((sum, c) => sum + (c.current_balance || 0), 0);
    const highDuesCount = filteredKhata.filter(c => (c.current_balance || 0) >= 10000).length;
    const avgDue = filteredKhata.length > 0 ? Math.round(totalDue / filteredKhata.length) : 0;
    return { totalDue, highDuesCount, avgDue, count: filteredKhata.length };
  }, [filteredKhata]);

  const profitMetrics = useMemo(() => {
    const totalRev = filteredProfit.reduce((sum, p) => sum + p.total_revenue, 0);
    const totalCost = filteredProfit.reduce((sum, p) => sum + p.total_cost, 0);
    const totalProfit = filteredProfit.reduce((sum, p) => sum + p.gross_profit, 0);
    const avgMargin = totalCost > 0 ? Math.round((totalProfit / totalCost) * 100) : 0;
    return { totalRev, totalCost, totalProfit, avgMargin, count: filteredProfit.length };
  }, [filteredProfit]);

  const gstMetrics = useMemo(() => {
    const totalTaxable = filteredGst.reduce((sum, g) => sum + g.taxable_amount, 0);
    const totalCgst = filteredGst.reduce((sum, g) => sum + g.cgst_amount, 0);
    const totalSgst = filteredGst.reduce((sum, g) => sum + g.sgst_amount, 0);
    const totalTax = filteredGst.reduce((sum, g) => sum + g.total_tax, 0);
    const grandTotal = filteredGst.reduce((sum, g) => sum + g.grand_total, 0);
    return { totalTaxable, totalCgst, totalSgst, totalTax, grandTotal, count: filteredGst.length };
  }, [filteredGst]);

  // Export to CSV Function
  const handleExportCSV = () => {
    const dateStamp = new Date().toISOString().slice(0, 10);
    let exportRows: any[] = [];
    let fileName = `Report_${reportType}_${dateStamp}`;

    if (reportType === 'sales') {
      exportRows = filteredSales.map(s => ({
        'Invoice No': s.invoice_no,
        'Date': s.invoice_date,
        'Farmer Name': s.customer_name,
        'Mobile': s.customer_mobile || '',
        'Payment Mode': s.payment_mode,
        'Taxable (Rs)': s.taxable_amount,
        'CGST (Rs)': s.cgst_amount,
        'SGST (Rs)': s.sgst_amount,
        'Total Tax (Rs)': s.total_tax,
        'Grand Total (Rs)': s.grand_total,
        'Paid Amount (Rs)': s.paid_amount,
        'Credit Due (Rs)': s.credit_amount
      }));
    } else if (reportType === 'purchases') {
      exportRows = filteredPurchases.map(p => ({
        'Purchase No': p.purchase_no,
        'Supplier Invoice': p.supplier_invoice_no,
        'Invoice Date': p.invoice_date,
        'Supplier Name': p.supplier_name,
        'Payment Type': p.payment_mode,
        'Taxable (Rs)': p.taxable_amount,
        'Total Tax (Rs)': p.total_tax,
        'Grand Total (Rs)': p.grand_total,
        'Paid Amount (Rs)': p.paid_amount,
        'Balance Due (Rs)': p.credit_amount
      }));
    } else if (reportType === 'stock') {
      exportRows = filteredStock.map(b => ({
        'Product Name': b.product_name,
        'Category': b.product_category,
        'Batch No': b.batch_number,
        'Expiry Date': b.expiry_date,
        'Available Qty': b.current_qty,
        'Unit': b.unit,
        'Purchase Rate (Rs)': b.purchase_rate,
        'Stock Cost (Rs)': b.current_qty * b.purchase_rate,
        'MRP (Rs)': b.mrp,
        'Stock MRP Value (Rs)': b.current_qty * b.mrp
      }));
    } else if (reportType === 'expiry') {
      exportRows = filteredExpiry.map(b => ({
        'Product Name': b.product_name,
        'Category': b.product_category,
        'Batch No': b.batch_number,
        'Expiry Date': b.expiry_date,
        'Days Remaining': b.daysRemaining,
        'Status': b.isExpired ? 'Expired' : `${b.daysRemaining} Days`,
        'Available Qty': b.current_qty,
        'Cost Rate (Rs)': b.purchase_rate,
        'Value at Risk (Rs)': b.current_qty * b.purchase_rate
      }));
    } else if (reportType === 'khata') {
      exportRows = filteredKhata.map(c => ({
        'Customer Code': c.customer_code,
        'Farmer Name': c.name,
        'Name Marathi': c.name_mr || '',
        'Village': c.village,
        'Mobile': c.mobile,
        'Credit Limit (Rs)': c.credit_limit,
        'Current Due (Rs)': c.current_balance
      }));
    } else if (reportType === 'profit') {
      exportRows = filteredProfit.map(p => ({
        'Product Name': p.product_name,
        'Category': p.category,
        'Company': p.company,
        'Qty Sold': p.qty_sold,
        'Unit': p.unit,
        'Sales Revenue (Rs)': p.total_revenue,
        'Cost of Goods (Rs)': p.total_cost,
        'Gross Profit (Rs)': p.gross_profit,
        'Margin %': `${p.margin_pct}%`
      }));
    } else if (reportType === 'gst') {
      exportRows = filteredGst.map(g => ({
        'Invoice No': g.invoice_no,
        'Invoice Date': g.invoice_date,
        'Customer Name': g.customer_name,
        'GSTIN': g.gstin,
        'Type': g.is_gst_bill ? 'Tax Invoice' : 'Bill of Supply',
        'Taxable Value (Rs)': g.taxable_amount,
        'CGST (Rs)': g.cgst_amount,
        'SGST (Rs)': g.sgst_amount,
        'Total Tax (Rs)': g.total_tax,
        'Grand Total (Rs)': g.grand_total
      }));
    }

    exportToCSV(fileName, exportRows);
  };

  const reportTabs = [
    { id: 'sales', mr: 'विक्री अहवाल', en: 'Sales Report', icon: FileText },
    { id: 'purchases', mr: 'खरेदी अहवाल', en: 'Purchase Report', icon: Truck },
    { id: 'stock', mr: 'साठा मूल्यांकन', en: 'Stock Valuation', icon: Boxes },
    { id: 'expiry', mr: 'मुदत विश्लेषण', en: 'Expiry Tracker', icon: Clock },
    { id: 'khata', mr: 'उधारी बाकी', en: 'Credit Dues', icon: Users },
    { id: 'profit', mr: 'नफा-तोटा', en: 'Profit Margin', icon: TrendingUp },
    { id: 'gst', mr: 'GST विवरण', en: 'GST Report', icon: DollarSign },
  ];

  return (
    <div className="flex-1 p-6 overflow-y-auto space-y-4">
      {/* Top Header Card */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-4 no-print">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-emerald-600" />
              <h1 className="text-lg font-bold text-slate-900">
                {getTranslation('nav_reports', currentLang)}
              </h1>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              {isMr 
                ? 'विक्री, खरेदी, इन्व्हेंटरी साठा, उधारी खाते, नफा व GST अहवाल' 
                : 'Complete business analytics, sales, purchases, stock valuation, credit dues & tax filings'}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={loadReportData}
              title={isMr ? 'रिफ्रेश करा' : 'Refresh'}
              className="p-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-1 cursor-pointer transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-emerald-600' : ''}`} />
              <span className="hidden sm:inline">{isMr ? 'रिफ्रेश' : 'Refresh'}</span>
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>{getTranslation('print', currentLang)}</span>
            </button>
            <button
              type="button"
              onClick={handleExportCSV}
              className="px-3 py-1.5 rounded-lg border border-emerald-600 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <Download className="w-3.5 h-3.5 text-emerald-700" />
              <span>{getTranslation('export_csv', currentLang)}</span>
            </button>
          </div>
        </div>

        {/* Report Selector Ribbon */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 pt-2 border-t border-slate-100 text-xs">
          {reportTabs.map((r) => {
            const Icon = r.icon;
            const isSelected = reportType === r.id;
            return (
              <button
                type="button"
                key={r.id}
                onClick={() => setReportType(r.id as ReportType)}
                className={`p-2.5 rounded-xl font-bold flex flex-col items-center gap-1.5 transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-emerald-700 text-white shadow-sm ring-2 ring-emerald-500/20'
                    : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                <Icon className={`w-4 h-4 ${isSelected ? 'text-white' : 'text-slate-500'}`} />
                <span className="text-[11px] truncate w-full text-center">{isMr ? r.mr : r.en}</span>
              </button>
            );
          })}
        </div>

        {/* Date Range Selector & Presets (Visible on Sales, Purchases, Profit & GST) */}
        {(reportType === 'sales' || reportType === 'purchases' || reportType === 'profit' || reportType === 'gst') && (
          <div className="pt-2 border-t border-slate-100 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs">
                <CalendarRange className="w-4 h-4 text-emerald-700" />
                <span className="font-bold text-slate-700">
                  {isMr ? 'कालावधी निवडा:' : 'Select Period:'}
                </span>
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => {
                    setFromDate(e.target.value);
                    setActiveDatePreset('custom');
                  }}
                  className="px-2.5 py-1 bg-slate-50 border border-slate-300 rounded-lg font-mono text-xs text-slate-800 focus:outline-emerald-600"
                />
                <span className="text-slate-400 font-semibold">{isMr ? 'ते' : 'to'}</span>
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => {
                    setToDate(e.target.value);
                    setActiveDatePreset('custom');
                  }}
                  className="px-2.5 py-1 bg-slate-50 border border-slate-300 rounded-lg font-mono text-xs text-slate-800 focus:outline-emerald-600"
                />
              </div>

              {/* Quick Date Presets */}
              <div className="flex items-center gap-1 flex-wrap text-xs">
                {[
                  { id: 'today', mr: 'आज', en: 'Today' },
                  { id: 'yesterday', mr: 'काल', en: 'Yesterday' },
                  { id: 'this_week', mr: 'हा आठवडा', en: 'This Week' },
                  { id: 'this_month', mr: 'चालू महिना', en: 'This Month' },
                  { id: 'last_month', mr: 'मागील महिना', en: 'Last Month' },
                  { id: 'this_year', mr: 'चालू वर्ष (FY)', en: 'This Year (FY)' },
                  { id: 'all', mr: 'सर्व', en: 'All' },
                ].map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => applyDatePreset(preset.id)}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-semibold cursor-pointer transition-colors ${
                      activeDatePreset === preset.id
                        ? 'bg-emerald-700 text-white shadow-2xs'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                    }`}
                  >
                    {isMr ? preset.mr : preset.en}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Dynamic Contextual Filters Bar */}
        <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center gap-3 text-xs">
          {/* Universal Search Box */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder={
                reportType === 'sales'
                  ? (isMr ? 'बिल क्र., शेतकरी नाव किंवा मोबाईल शोधा...' : 'Search by bill no, farmer name, mobile...')
                  : reportType === 'purchases'
                  ? (isMr ? 'खरेदी क्र., पुरवठादार किंवा बिल क्र. शोधा...' : 'Search purchase no, supplier, invoice...')
                  : reportType === 'khata'
                  ? (isMr ? 'शेतकरी नाव, गाव, खाते क्र. किंवा मोबाईल शोधा...' : 'Search farmer, village, code, phone...')
                  : (isMr ? 'उत्पादन, कंपनी किंवा बॅच क्र. शोधा...' : 'Search product, company or batch...')
              }
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-800 placeholder:text-slate-400 focus:outline-emerald-600 focus:bg-white"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                ✕
              </button>
            )}
          </div>

          {/* Payment Mode Filter (Sales & Purchases) */}
          {(reportType === 'sales' || reportType === 'purchases') && (
            <div className="flex items-center gap-1.5">
              <span className="text-slate-500 font-semibold">{isMr ? 'पेमेंट:' : 'Payment:'}</span>
              <select
                value={paymentModeFilter}
                onChange={(e) => setPaymentModeFilter(e.target.value)}
                className="px-2 py-1.5 bg-slate-50 border border-slate-300 rounded-lg font-medium text-slate-700 text-xs focus:outline-emerald-600"
              >
                <option value="all">{isMr ? 'सर्व पेमेंट पद्धती' : 'All Payment Modes'}</option>
                <option value="Cash">{isMr ? 'रोख (Cash)' : 'Cash'}</option>
                <option value="UPI">{isMr ? 'फोनपे / UPI' : 'PhonePe / UPI'}</option>
                <option value="Credit">{isMr ? 'उधारी (Credit)' : 'Credit'}</option>
                <option value="Bank">{isMr ? 'बँक ट्रान्सफर' : 'Bank Transfer'}</option>
              </select>
            </div>
          )}

          {/* Category Filter (Stock, Expiry, Profit) */}
          {(reportType === 'stock' || reportType === 'expiry' || reportType === 'profit') && (
            <div className="flex items-center gap-1.5">
              <span className="text-slate-500 font-semibold">{isMr ? 'श्रेणी:' : 'Category:'}</span>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="px-2 py-1.5 bg-slate-50 border border-slate-300 rounded-lg font-medium text-slate-700 text-xs focus:outline-emerald-600"
              >
                <option value="all">{isMr ? 'सर्व श्रेणी' : 'All Categories'}</option>
                <option value="खते">{isMr ? 'खते (Fertilizers)' : 'Fertilizers'}</option>
                <option value="बियाणे">{isMr ? 'बियाणे (Seeds)' : 'Seeds'}</option>
                <option value="कीटकनाशके">{isMr ? 'कीटकनाशके (Pesticides)' : 'Pesticides'}</option>
                <option value="इतर">{isMr ? 'इतर / बायो (Other)' : 'Other'}</option>
                {categoriesList.filter(c => !['खते', 'बियाणे', 'कीटकनाशके', 'इतर'].includes(c)).map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
          )}

          {/* Stock Status Filter (Stock Report) */}
          {reportType === 'stock' && (
            <div className="flex items-center gap-1.5">
              <span className="text-slate-500 font-semibold">{isMr ? 'साठा स्थिती:' : 'Status:'}</span>
              <select
                value={stockStatusFilter}
                onChange={(e) => setStockStatusFilter(e.target.value)}
                className="px-2 py-1.5 bg-slate-50 border border-slate-300 rounded-lg font-medium text-slate-700 text-xs focus:outline-emerald-600"
              >
                <option value="all">{isMr ? 'सर्व साठा' : 'All Stock'}</option>
                <option value="in_stock">{isMr ? 'शिल्लक उपलब्ध साठा' : 'In Stock (>0)'}</option>
                <option value="low_stock">{isMr ? 'कमी साठा (१० पेक्षा कमी)' : 'Low Stock (<=10)'}</option>
                <option value="out_of_stock">{isMr ? 'संपलेला साठा (0)' : 'Out of Stock (0)'}</option>
              </select>
            </div>
          )}

          {/* Expiry Timeline Filter (Expiry Tracker) */}
          {reportType === 'expiry' && (
            <div className="flex items-center gap-1.5">
              <span className="text-slate-500 font-semibold">{isMr ? 'मुदत:' : 'Expiry Window:'}</span>
              <select
                value={expiryFilter}
                onChange={(e) => setExpiryFilter(e.target.value)}
                className="px-2 py-1.5 bg-slate-50 border border-slate-300 rounded-lg font-medium text-slate-700 text-xs focus:outline-emerald-600 font-semibold text-amber-900"
              >
                <option value="all">{isMr ? 'सर्व मुदत बॅचेस' : 'All Batches'}</option>
                <option value="expired">{isMr ? '⚠️ मुदत संपलेली (Expired)' : '⚠️ Already Expired'}</option>
                <option value="30_days">{isMr ? '⏳ पुढील ३० दिवसांत संपणारी' : '⏳ Expiring in 30 Days'}</option>
                <option value="60_days">{isMr ? 'पुढील ६० दिवसांत संपणारी' : 'Expiring in 60 Days'}</option>
                <option value="90_days">{isMr ? 'पुढील ९० दिवसांत संपणारी' : 'Expiring in 90 Days'}</option>
                <option value="180_days">{isMr ? 'पुढील ६ महिन्यांत संपणारी' : 'Expiring in 180 Days'}</option>
              </select>
            </div>
          )}

          {/* Supplier Filter (Purchases Report) */}
          {reportType === 'purchases' && (
            <div className="flex items-center gap-1.5">
              <span className="text-slate-500 font-semibold">{isMr ? 'पुरवठादार:' : 'Supplier:'}</span>
              <select
                value={supplierFilter}
                onChange={(e) => setSupplierFilter(e.target.value)}
                className="px-2 py-1.5 bg-slate-50 border border-slate-300 rounded-lg font-medium text-slate-700 text-xs focus:outline-emerald-600 max-w-[180px]"
              >
                <option value="all">{isMr ? 'सर्व पुरवठादार' : 'All Suppliers'}</option>
                {suppliersList.map(s => (
                  <option key={s.id} value={s.name}>{s.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Village Filter (Khata Report) */}
          {reportType === 'khata' && (
            <div className="flex items-center gap-1.5">
              <span className="text-slate-500 font-semibold">{isMr ? 'गाव:' : 'Village:'}</span>
              <select
                value={villageFilter}
                onChange={(e) => setVillageFilter(e.target.value)}
                className="px-2 py-1.5 bg-slate-50 border border-slate-300 rounded-lg font-medium text-slate-700 text-xs focus:outline-emerald-600 max-w-[180px]"
              >
                <option value="all">{isMr ? 'सर्व गावे' : 'All Villages'}</option>
                {villagesList.map(v => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </select>
            </div>
          )}

          {/* Due Amount Threshold Filter (Khata Report) */}
          {reportType === 'khata' && (
            <div className="flex items-center gap-1.5">
              <span className="text-slate-500 font-semibold">{isMr ? 'किमान बाकी:' : 'Min Due:'}</span>
              <select
                value={dueAmountFilter}
                onChange={(e) => setDueAmountFilter(e.target.value)}
                className="px-2 py-1.5 bg-slate-50 border border-slate-300 rounded-lg font-medium text-slate-700 text-xs focus:outline-emerald-600"
              >
                <option value="all">{isMr ? 'सर्व उधारी' : 'All Outstanding'}</option>
                <option value="1000">&gt; ₹1,000</option>
                <option value="5000">&gt; ₹5,000</option>
                <option value="10000">&gt; ₹10,000</option>
                <option value="25000">&gt; ₹25,000</option>
              </select>
            </div>
          )}

          {/* Bill Type Filter (Sales & GST) */}
          {(reportType === 'sales' || reportType === 'gst') && (
            <div className="flex items-center gap-1.5">
              <span className="text-slate-500 font-semibold">{isMr ? 'बिल प्रकार:' : 'Bill Type:'}</span>
              <select
                value={billTypeFilter}
                onChange={(e) => setBillTypeFilter(e.target.value)}
                className="px-2 py-1.5 bg-slate-50 border border-slate-300 rounded-lg font-medium text-slate-700 text-xs focus:outline-emerald-600"
              >
                <option value="all">{isMr ? 'सर्व बिले' : 'All Invoices'}</option>
                <option value="gst">{isMr ? 'फक्त GST टॅक्स बिल' : 'Tax Invoices (GST)'}</option>
                <option value="non_gst">{isMr ? 'साधे बिल / कॅश मेमो' : 'Cash Memos / Non-GST'}</option>
              </select>
            </div>
          )}

          {/* Reset All Filters */}
          <button
            type="button"
            onClick={handleResetFilters}
            className="text-xs font-semibold text-rose-600 hover:text-rose-800 hover:underline cursor-pointer ml-auto"
          >
            {isMr ? 'सर्व फिल्टर रीसेट करा' : 'Reset Filters'}
          </button>
        </div>
      </div>

      {/* KPI Summary Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 no-print">
        {reportType === 'sales' && (
          <>
            <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
              <div className="text-[11px] font-bold text-slate-500 uppercase">{isMr ? 'एकूण विक्री' : 'Total Sales'}</div>
              <div className="text-lg font-extrabold text-slate-900 mt-1">{formatINR(salesMetrics.totalSales)}</div>
              <div className="text-[10px] text-slate-400 mt-0.5">{salesMetrics.count} {isMr ? 'बिले' : 'Invoices'}</div>
            </div>
            <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
              <div className="text-[11px] font-bold text-emerald-600 uppercase">{isMr ? 'जमा रक्कम (Cash/UPI)' : 'Total Collected'}</div>
              <div className="text-lg font-extrabold text-emerald-700 mt-1">{formatINR(salesMetrics.totalPaid)}</div>
              <div className="text-[10px] text-emerald-600/80 mt-0.5">
                {salesMetrics.totalSales > 0 ? Math.round((salesMetrics.totalPaid / salesMetrics.totalSales) * 100) : 0}% {isMr ? 'जमा' : 'Settled'}
              </div>
            </div>
            <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
              <div className="text-[11px] font-bold text-rose-600 uppercase">{isMr ? 'उधारी बाकी' : 'Credit Given'}</div>
              <div className="text-lg font-extrabold text-rose-700 mt-1">{formatINR(salesMetrics.totalCredit)}</div>
              <div className="text-[10px] text-rose-600/80 mt-0.5">{isMr ? 'शेतकऱ्यांकडे येणे बाकी' : 'Receivable'}</div>
            </div>
            <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
              <div className="text-[11px] font-bold text-blue-600 uppercase">{isMr ? 'एकूण GST कर' : 'Total Tax Collected'}</div>
              <div className="text-lg font-extrabold text-blue-700 mt-1">{formatINR(salesMetrics.totalTax)}</div>
              <div className="text-[10px] text-blue-600/80 mt-0.5">CGST + SGST</div>
            </div>
          </>
        )}

        {reportType === 'purchases' && (
          <>
            <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
              <div className="text-[11px] font-bold text-slate-500 uppercase">{isMr ? 'एकूण खरेदी' : 'Total Purchases'}</div>
              <div className="text-lg font-extrabold text-slate-900 mt-1">{formatINR(purchaseMetrics.totalPurchases)}</div>
              <div className="text-[10px] text-slate-400 mt-0.5">{purchaseMetrics.count} {isMr ? 'खरेदी नोंदी' : 'Entries'}</div>
            </div>
            <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
              <div className="text-[11px] font-bold text-emerald-600 uppercase">{isMr ? 'कंपनीला भरलेली रक्कम' : 'Amount Paid'}</div>
              <div className="text-lg font-extrabold text-emerald-700 mt-1">{formatINR(purchaseMetrics.totalPaid)}</div>
              <div className="text-[10px] text-emerald-600/80 mt-0.5">{isMr ? 'अदा केलेली रक्कम' : 'Settled'}</div>
            </div>
            <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
              <div className="text-[11px] font-bold text-amber-600 uppercase">{isMr ? 'पुरवठादारांना बाकी' : 'Balance Payable'}</div>
              <div className="text-lg font-extrabold text-amber-700 mt-1">{formatINR(purchaseMetrics.totalPayable)}</div>
              <div className="text-[10px] text-amber-600/80 mt-0.5">{isMr ? 'देणी बाकी' : 'Pending Payable'}</div>
            </div>
            <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
              <div className="text-[11px] font-bold text-purple-600 uppercase">{isMr ? 'इनपुट टॅक्स (ITC)' : 'Input GST Tax'}</div>
              <div className="text-lg font-extrabold text-purple-700 mt-1">{formatINR(purchaseMetrics.totalTax)}</div>
              <div className="text-[10px] text-purple-600/80 mt-0.5">{isMr ? 'खरेदीवरील एकूण कर' : 'Input Credit'}</div>
            </div>
          </>
        )}

        {reportType === 'stock' && (
          <>
            <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
              <div className="text-[11px] font-bold text-slate-500 uppercase">{isMr ? 'एकूण साठा बॅचेस' : 'Total Stock Batches'}</div>
              <div className="text-lg font-extrabold text-slate-900 mt-1">{stockMetrics.count}</div>
              <div className="text-[10px] text-slate-400 mt-0.5">{isMr ? 'सक्रिय उत्पादने' : 'Active Stock Lines'}</div>
            </div>
            <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
              <div className="text-[11px] font-bold text-emerald-600 uppercase">{isMr ? 'साठा खरेदी मूल्य (Cost)' : 'Stock Cost Value'}</div>
              <div className="text-lg font-extrabold text-emerald-700 mt-1">{formatINR(stockMetrics.totalCost)}</div>
              <div className="text-[10px] text-emerald-600/80 mt-0.5">{isMr ? 'भांडवली गुंतवणूक' : 'Total Investment'}</div>
            </div>
            <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
              <div className="text-[11px] font-bold text-blue-600 uppercase">{isMr ? 'साठा किरकोळ मूल्य (MRP)' : 'Retail Value (MRP)'}</div>
              <div className="text-lg font-extrabold text-blue-700 mt-1">{formatINR(stockMetrics.totalMrp)}</div>
              <div className="text-[10px] text-blue-600/80 mt-0.5">{isMr ? 'एकूण विक्री मूल्य' : 'Max Retail Worth'}</div>
            </div>
            <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
              <div className="text-[11px] font-bold text-purple-600 uppercase">{isMr ? 'अंदाजित संभाव्य नफा' : 'Projected Margin'}</div>
              <div className="text-lg font-extrabold text-purple-700 mt-1">{formatINR(stockMetrics.potentialMargin)}</div>
              <div className="text-[10px] text-purple-600/80 mt-0.5">
                {stockMetrics.totalCost > 0 ? Math.round((stockMetrics.potentialMargin / stockMetrics.totalCost) * 100) : 0}% {isMr ? 'संभाव्य मार्जिन' : 'Gross ROI'}
              </div>
            </div>
          </>
        )}

        {reportType === 'expiry' && (
          <>
            <div className="bg-white p-3.5 rounded-xl border border-rose-200 bg-rose-50/20 shadow-2xs">
              <div className="text-[11px] font-bold text-rose-700 uppercase">{isMr ? 'मुदत संपलेल्या बॅचेस' : 'Expired Batches'}</div>
              <div className="text-lg font-extrabold text-rose-700 mt-1">{expiryMetrics.expiredCount}</div>
              <div className="text-[10px] text-rose-600 mt-0.5">{isMr ? 'त्वरित बाजूला काढा' : 'Do Not Sell'}</div>
            </div>
            <div className="bg-white p-3.5 rounded-xl border border-rose-200 bg-rose-50/20 shadow-2xs">
              <div className="text-[11px] font-bold text-rose-700 uppercase">{isMr ? 'कालबाह्य भांडवल' : 'Expired Stock Value'}</div>
              <div className="text-lg font-extrabold text-rose-700 mt-1">{formatINR(expiryMetrics.expiredVal)}</div>
              <div className="text-[10px] text-rose-600 mt-0.5">{isMr ? 'कंपनीला परत पाठवा' : 'Pending Return'}</div>
            </div>
            <div className="bg-white p-3.5 rounded-xl border border-amber-200 bg-amber-50/20 shadow-2xs">
              <div className="text-[11px] font-bold text-amber-700 uppercase">{isMr ? '३० दिवसांत संपणारा साठा' : 'Expiring in 30 Days'}</div>
              <div className="text-lg font-extrabold text-amber-700 mt-1">{expiryMetrics.within30Count}</div>
              <div className="text-[10px] text-amber-600 mt-0.5">{isMr ? 'अतिदक्षता आवश्यक' : 'Critical Window'}</div>
            </div>
            <div className="bg-white p-3.5 rounded-xl border border-amber-200 bg-amber-50/20 shadow-2xs">
              <div className="text-[11px] font-bold text-amber-700 uppercase">{isMr ? 'जोखमीचे भांडवल' : 'At-Risk Value (30d)'}</div>
              <div className="text-lg font-extrabold text-amber-700 mt-1">{formatINR(expiryMetrics.within30Val)}</div>
              <div className="text-[10px] text-amber-600 mt-0.5">{isMr ? 'लवकर विक्री करा' : 'Priority Sales Target'}</div>
            </div>
          </>
        )}

        {reportType === 'khata' && (
          <>
            <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
              <div className="text-[11px] font-bold text-slate-500 uppercase">{isMr ? 'उधारी ग्राहक संख्या' : 'Credit Customers'}</div>
              <div className="text-lg font-extrabold text-slate-900 mt-1">{khataMetrics.count}</div>
              <div className="text-[10px] text-slate-400 mt-0.5">{isMr ? 'शेतकरी खाती' : 'Farmers with balance'}</div>
            </div>
            <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
              <div className="text-[11px] font-bold text-rose-600 uppercase">{isMr ? 'एकूण येणे बाकी (उधारी)' : 'Total Outstanding'}</div>
              <div className="text-lg font-extrabold text-rose-700 mt-1">{formatINR(khataMetrics.totalDue)}</div>
              <div className="text-[10px] text-rose-600/80 mt-0.5">{isMr ? 'बाजारात अडकलेली रक्कम' : 'Total Receivables'}</div>
            </div>
            <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
              <div className="text-[11px] font-bold text-amber-600 uppercase">{isMr ? 'मोठी बाकी (₹१०,०००+)' : 'High Dues (> ₹10k)'}</div>
              <div className="text-lg font-extrabold text-amber-700 mt-1">{khataMetrics.highDuesCount}</div>
              <div className="text-[10px] text-amber-600/80 mt-0.5">{isMr ? 'प्राधान्याने वसुली' : 'Priority Follow-up'}</div>
            </div>
            <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
              <div className="text-[11px] font-bold text-blue-600 uppercase">{isMr ? 'सरासरी उधारी' : 'Average Due / Farmer'}</div>
              <div className="text-lg font-extrabold text-blue-700 mt-1">{formatINR(khataMetrics.avgDue)}</div>
              <div className="text-[10px] text-blue-600/80 mt-0.5">{isMr ? 'प्रति ग्राहक सरासरी' : 'Per Farmer Average'}</div>
            </div>
          </>
        )}

        {reportType === 'profit' && (
          <>
            <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
              <div className="text-[11px] font-bold text-slate-500 uppercase">{isMr ? 'विक्री महसूल' : 'Sales Revenue'}</div>
              <div className="text-lg font-extrabold text-slate-900 mt-1">{formatINR(profitMetrics.totalRev)}</div>
              <div className="text-[10px] text-slate-400 mt-0.5">{profitMetrics.count} {isMr ? 'उत्पादने' : 'Products'}</div>
            </div>
            <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
              <div className="text-[11px] font-bold text-slate-500 uppercase">{isMr ? 'खरेदी खर्च (COGS)' : 'Cost of Goods'}</div>
              <div className="text-lg font-extrabold text-slate-700 mt-1">{formatINR(profitMetrics.totalCost)}</div>
              <div className="text-[10px] text-slate-400 mt-0.5">{isMr ? 'खरेदी किंमत' : 'Purchase Cost'}</div>
            </div>
            <div className="bg-white p-3.5 rounded-xl border border-emerald-200 bg-emerald-50/20 shadow-2xs">
              <div className="text-[11px] font-bold text-emerald-700 uppercase">{isMr ? 'निव्वळ नफा (Gross Profit)' : 'Gross Profit'}</div>
              <div className="text-lg font-extrabold text-emerald-700 mt-1">{formatINR(profitMetrics.totalProfit)}</div>
              <div className="text-[10px] text-emerald-600 mt-0.5">{isMr ? 'प्रत्यक्ष निव्वळ कमाई' : 'Realized Profit'}</div>
            </div>
            <div className="bg-white p-3.5 rounded-xl border border-emerald-200 bg-emerald-50/20 shadow-2xs">
              <div className="text-[11px] font-bold text-emerald-700 uppercase">{isMr ? 'सरासरी नफा टक्केवारी' : 'Gross Margin %'}</div>
              <div className="text-lg font-extrabold text-emerald-700 mt-1">{profitMetrics.avgMargin}%</div>
              <div className="text-[10px] text-emerald-600 mt-0.5">{isMr ? 'कमाईचा दर' : 'ROI Margin'}</div>
            </div>
          </>
        )}

        {reportType === 'gst' && (
          <>
            <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
              <div className="text-[11px] font-bold text-slate-500 uppercase">{isMr ? 'करपात्र उलाढाल' : 'Taxable Turnover'}</div>
              <div className="text-lg font-extrabold text-slate-900 mt-1">{formatINR(gstMetrics.totalTaxable)}</div>
              <div className="text-[10px] text-slate-400 mt-0.5">{gstMetrics.count} {isMr ? 'बिले' : 'Invoices'}</div>
            </div>
            <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
              <div className="text-[11px] font-bold text-blue-600 uppercase">{isMr ? 'CGST (केंद्रीय कर)' : 'CGST Collected'}</div>
              <div className="text-lg font-extrabold text-blue-700 mt-1">{formatINR(gstMetrics.totalCgst)}</div>
              <div className="text-[10px] text-blue-600/80 mt-0.5">Central GST</div>
            </div>
            <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
              <div className="text-[11px] font-bold text-blue-600 uppercase">{isMr ? 'SGST (राज्य कर)' : 'SGST Collected'}</div>
              <div className="text-lg font-extrabold text-blue-700 mt-1">{formatINR(gstMetrics.totalSgst)}</div>
              <div className="text-[10px] text-blue-600/80 mt-0.5">State GST</div>
            </div>
            <div className="bg-white p-3.5 rounded-xl border border-emerald-200 bg-emerald-50/20 shadow-2xs">
              <div className="text-[11px] font-bold text-emerald-700 uppercase">{isMr ? 'एकूण देय GST कर' : 'Total GST Payable'}</div>
              <div className="text-lg font-extrabold text-emerald-700 mt-1">{formatINR(gstMetrics.totalTax)}</div>
              <div className="text-[10px] text-emerald-600 mt-0.5">{isMr ? 'एकूण विक्री ₹' : 'Turnover: ₹'}{formatINR(gstMetrics.grandTotal)}</div>
            </div>
          </>
        )}
      </div>

      {/* Clean Header for Physical Print / PDF Export */}
      <div className="hidden print:block mb-4 border-b-2 border-slate-900 pb-3">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-lg font-black text-slate-900">
              {isMr && businessSettings?.shop_name_mr ? businessSettings.shop_name_mr : (businessSettings?.shop_name || 'कृषी सेवा केंद्र')}
            </h1>
            <p className="text-xs text-slate-700">{businessSettings?.address}, {businessSettings?.village_city}, {businessSettings?.district}</p>
            <p className="text-[11px] text-slate-600 font-mono">GSTIN: {businessSettings?.gstin || '-'} | Phone: {businessSettings?.mobile}</p>
          </div>
          <div className="text-right">
            <div className="text-sm font-black uppercase text-emerald-950">
              {reportTabs.find(r => r.id === reportType)?.[isMr ? 'mr' : 'en']}
            </div>
            <div className="text-xs text-slate-600">
              {isMr ? 'तारीख:' : 'Date:'} {new Date().toLocaleDateString('en-IN')}
            </div>
            {(fromDate || toDate) && (
              <div className="text-xs text-slate-700 font-mono font-bold">
                {fromDate || 'Start'} to {toDate || 'Today'}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Data Tables Section */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden print:border-none print:shadow-none">
        {/* Record count banner */}
        <div className="px-4 py-2 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs text-slate-500 no-print">
          <span className="font-medium">
            {isMr ? 'एकूण नोंदी:' : 'Total Records:'}{' '}
            <strong className="text-slate-800 font-bold font-mono">
              {reportType === 'sales' && filteredSales.length}
              {reportType === 'purchases' && filteredPurchases.length}
              {reportType === 'stock' && filteredStock.length}
              {reportType === 'expiry' && filteredExpiry.length}
              {reportType === 'khata' && filteredKhata.length}
              {reportType === 'profit' && filteredProfit.length}
              {reportType === 'gst' && filteredGst.length}
            </strong>
          </span>
          {loading && (
            <span className="flex items-center gap-1.5 text-emerald-600 font-semibold">
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              {isMr ? 'डेटा लोड होत आहे...' : 'Loading live data...'}
            </span>
          )}
        </div>

        <div className="overflow-x-auto">
          {/* 1. SALES REPORT TABLE */}
          {reportType === 'sales' && (
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-100/75 text-slate-700 font-bold border-b border-slate-200">
                <tr>
                  <th className="p-3">{isMr ? 'बिल क्र.' : 'Invoice No.'}</th>
                  <th className="p-3">{getTranslation('date', currentLang)}</th>
                  <th className="p-3">{getTranslation('farmer_name', currentLang)}</th>
                  <th className="p-3">{isMr ? 'मोबाईल' : 'Mobile'}</th>
                  <th className="p-3">{getTranslation('payment_mode', currentLang)}</th>
                  <th className="p-3 text-right">{getTranslation('taxable_value', currentLang)}</th>
                  <th className="p-3 text-right">{getTranslation('gst_rate', currentLang)}</th>
                  <th className="p-3 text-right">{isMr ? 'एकूण विक्री (₹)' : 'Total Sale (₹)'}</th>
                  <th className="p-3 text-right">{isMr ? 'जमा रक्कम' : 'Paid Amount'}</th>
                  <th className="p-3 text-right">{isMr ? 'उधारी बाकी' : 'Credit Due'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredSales.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="p-8 text-center text-slate-400">
                      {isMr ? 'या फिल्टरनुसार कोणतीही विक्री नोंद आढळली नाही.' : 'No sales records found for this filter.'}
                    </td>
                  </tr>
                ) : (
                  filteredSales.map((s) => (
                    <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                      <td className="p-3 font-mono font-bold text-slate-900">
                        {s.invoice_no}
                        {s.is_gst_bill && (
                          <span className="ml-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800">GST</span>
                        )}
                      </td>
                      <td className="p-3 font-mono text-slate-600">{formatDate(s.invoice_date)}</td>
                      <td className="p-3 font-semibold text-slate-800">{s.customer_name}</td>
                      <td className="p-3 font-mono text-slate-500">{s.customer_mobile || '-'}</td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          s.payment_mode === 'Cash' 
                            ? 'bg-emerald-100 text-emerald-800'
                            : s.payment_mode === 'Credit'
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-blue-100 text-blue-800'
                        }`}>
                          {s.payment_mode}
                        </span>
                      </td>
                      <td className="p-3 text-right font-mono text-slate-700">{formatINR(s.taxable_amount)}</td>
                      <td className="p-3 text-right font-mono text-slate-700">{formatINR(s.total_tax)}</td>
                      <td className="p-3 text-right font-mono font-bold text-slate-900">{formatINR(s.grand_total)}</td>
                      <td className="p-3 text-right font-mono text-emerald-700 font-semibold">{formatINR(s.paid_amount)}</td>
                      <td className="p-3 text-right font-mono font-bold text-rose-700">
                        {s.credit_amount > 0 ? formatINR(s.credit_amount) : '-'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}

          {/* 2. PURCHASES REPORT TABLE */}
          {reportType === 'purchases' && (
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-100/75 text-slate-700 font-bold border-b border-slate-200">
                <tr>
                  <th className="p-3">{isMr ? 'खरेदी क्र.' : 'Purchase No.'}</th>
                  <th className="p-3">{isMr ? 'सप्लायर बिल क्र.' : 'Supplier Inv #'}</th>
                  <th className="p-3">{isMr ? 'खरेदी दिनांक' : 'Invoice Date'}</th>
                  <th className="p-3">{isMr ? 'पुरवठादार / कंपनी' : 'Supplier / Firm'}</th>
                  <th className="p-3">{isMr ? 'पेमेंट प्रकार' : 'Payment Type'}</th>
                  <th className="p-3 text-right">{isMr ? 'करपात्र रक्कम' : 'Taxable Amt'}</th>
                  <th className="p-3 text-right">{isMr ? 'कर (GST)' : 'Tax (ITC)'}</th>
                  <th className="p-3 text-right">{isMr ? 'एकूण बिल (₹)' : 'Grand Total (₹)'}</th>
                  <th className="p-3 text-right">{isMr ? 'भरलेली रक्कम' : 'Paid Amt'}</th>
                  <th className="p-3 text-right">{isMr ? 'देणे बाकी' : 'Balance Due'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredPurchases.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="p-8 text-center text-slate-400">
                      {isMr ? 'या फिल्टरनुसार कोणतीही खरेदी नोंद आढळली नाही.' : 'No purchase records found for this filter.'}
                    </td>
                  </tr>
                ) : (
                  filteredPurchases.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                      <td className="p-3 font-mono font-bold text-slate-900">{p.purchase_no}</td>
                      <td className="p-3 font-mono text-slate-600">{p.supplier_invoice_no || '-'}</td>
                      <td className="p-3 font-mono text-slate-600">{formatDate(p.invoice_date || p.purchase_date)}</td>
                      <td className="p-3 font-semibold text-slate-800">{p.supplier_name}</td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          p.payment_mode === 'Cash' || p.payment_mode === 'Paid'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}>
                          {p.payment_mode || 'Credit'}
                        </span>
                      </td>
                      <td className="p-3 text-right font-mono text-slate-700">{formatINR(p.taxable_amount)}</td>
                      <td className="p-3 text-right font-mono text-purple-700">{formatINR(p.total_tax)}</td>
                      <td className="p-3 text-right font-mono font-bold text-slate-900">{formatINR(p.grand_total)}</td>
                      <td className="p-3 text-right font-mono text-emerald-700 font-semibold">{formatINR(p.paid_amount)}</td>
                      <td className="p-3 text-right font-mono font-bold text-amber-700">
                        {p.credit_amount > 0 ? formatINR(p.credit_amount) : '-'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}

          {/* 3. STOCK VALUATION TABLE */}
          {reportType === 'stock' && (
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-100/75 text-slate-700 font-bold border-b border-slate-200">
                <tr>
                  <th className="p-3">{getTranslation('product_name', currentLang)}</th>
                  <th className="p-3">{getTranslation('category', currentLang)}</th>
                  <th className="p-3">{isMr ? 'कंपनी / ब्रँड' : 'Company / Brand'}</th>
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
                {filteredStock.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="p-8 text-center text-slate-400">
                      {isMr ? 'कोणतेही उत्पादन किंवा साठा बॅच आढळली नाही.' : 'No stock batches found for this filter.'}
                    </td>
                  </tr>
                ) : (
                  filteredStock.map((b, idx) => (
                    <tr key={idx} className="hover:bg-slate-50 transition-colors">
                      <td className="p-3 font-bold text-slate-900">{b.product_name}</td>
                      <td className="p-3 text-slate-600">{b.product_category}</td>
                      <td className="p-3 text-slate-600">{b.company || b.brand || '-'}</td>
                      <td className="p-3 font-mono font-medium text-slate-700">{b.batch_number}</td>
                      <td className="p-3 text-center font-mono text-slate-600">{formatDate(b.expiry_date)}</td>
                      <td className="p-3 text-center font-mono font-bold text-slate-900">
                        {b.current_qty} {b.unit}
                      </td>
                      <td className="p-3 text-right font-mono text-slate-700">{formatINR(b.purchase_rate)}</td>
                      <td className="p-3 text-right font-mono font-bold text-emerald-700">
                        {formatINR(b.current_qty * b.purchase_rate)}
                      </td>
                      <td className="p-3 text-right font-mono text-slate-700">{formatINR(b.mrp)}</td>
                      <td className="p-3 text-right font-mono font-bold text-blue-700">
                        {formatINR(b.current_qty * b.mrp)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}

          {/* 4. EXPIRY TRACKER TABLE */}
          {reportType === 'expiry' && (
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-100/75 text-slate-700 font-bold border-b border-slate-200">
                <tr>
                  <th className="p-3">{getTranslation('product_name', currentLang)}</th>
                  <th className="p-3">{getTranslation('category', currentLang)}</th>
                  <th className="p-3">{getTranslation('batch_number', currentLang)}</th>
                  <th className="p-3 text-center">{getTranslation('expiry_date', currentLang)}</th>
                  <th className="p-3 text-center">{isMr ? 'उर्वरित दिवस / स्थिती' : 'Days Left / Status'}</th>
                  <th className="p-3 text-center">{isMr ? 'शिल्लक साठा' : 'Stock Qty'}</th>
                  <th className="p-3 text-right">{isMr ? 'खरेदी दर' : 'Purchase Cost'}</th>
                  <th className="p-3 text-right">{isMr ? 'अडकलेले भांडवल (₹)' : 'Value at Risk (₹)'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredExpiry.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-slate-400">
                      {isMr ? 'निवडलेल्या निकषानुसार कोणतीही कालबाह्य बॅच आढळली नाही.' : 'No expiring batches found for this criteria.'}
                    </td>
                  </tr>
                ) : (
                  filteredExpiry.map((b, idx) => (
                    <tr key={idx} className={`hover:bg-slate-50 transition-colors ${b.isExpired ? 'bg-rose-50/30' : b.daysRemaining <= 30 ? 'bg-amber-50/20' : ''}`}>
                      <td className="p-3 font-bold text-slate-900">{b.product_name}</td>
                      <td className="p-3 text-slate-600">{b.product_category}</td>
                      <td className="p-3 font-mono font-medium text-slate-700">{b.batch_number}</td>
                      <td className="p-3 text-center font-mono font-bold text-slate-700">{formatDate(b.expiry_date)}</td>
                      <td className="p-3 text-center">
                        {b.isExpired ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-600 text-white animate-pulse">
                            {isMr ? 'कालबाह्य (Expired)' : 'EXPIRED'}
                          </span>
                        ) : b.daysRemaining <= 30 ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500 text-white">
                            {b.daysRemaining} {isMr ? 'दिवस बाकी' : 'days left'}
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-700">
                            {b.daysRemaining} {isMr ? 'दिवस' : 'days'}
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-center font-mono font-bold text-slate-900">{b.current_qty} {b.unit}</td>
                      <td className="p-3 text-right font-mono text-slate-700">{formatINR(b.purchase_rate)}</td>
                      <td className="p-3 text-right font-mono font-bold text-rose-700">
                        {formatINR(b.current_qty * b.purchase_rate)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}

          {/* 5. KHATA (CREDIT DUES) TABLE */}
          {reportType === 'khata' && (
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-100/75 text-slate-700 font-bold border-b border-slate-200">
                <tr>
                  <th className="p-3">{isMr ? 'खाते कोड' : 'Farmer Code'}</th>
                  <th className="p-3">{getTranslation('farmer_name', currentLang)}</th>
                  <th className="p-3">{getTranslation('village', currentLang)}</th>
                  <th className="p-3">{getTranslation('mobile', currentLang)}</th>
                  <th className="p-3 text-right">{getTranslation('credit_limit', currentLang)}</th>
                  <th className="p-3 text-right font-bold text-rose-700">{isMr ? 'एकूण येणे बाकी (₹)' : 'Outstanding Credit (₹)'}</th>
                  <th className="p-3 text-center">{isMr ? 'जोखीम स्तर' : 'Risk Status'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredKhata.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-slate-400">
                      {isMr ? 'निवडलेल्या निकषानुसार कोणतीही उधारी बाकी आढळली नाही.' : 'No outstanding credit records found for this filter.'}
                    </td>
                  </tr>
                ) : (
                  filteredKhata.map((c) => {
                    const bal = c.current_balance || 0;
                    const limit = c.credit_limit || 50000;
                    const isOverLimit = bal > limit;
                    return (
                      <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                        <td className="p-3 font-mono text-slate-500 font-medium">{c.customer_code || `#${c.id}`}</td>
                        <td className="p-3 font-bold text-slate-900">
                          {isMr ? (c.name_mr || c.name) : c.name}
                        </td>
                        <td className="p-3 font-medium text-slate-700">{c.village || '-'}</td>
                        <td className="p-3 font-mono text-slate-600">{c.mobile || '-'}</td>
                        <td className="p-3 text-right font-mono text-slate-600">{formatINR(limit)}</td>
                        <td className="p-3 text-right font-mono font-extrabold text-rose-700 text-sm">
                          {formatINR(bal)}
                        </td>
                        <td className="p-3 text-center">
                          {isOverLimit ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800">
                              {isMr ? 'मर्यादेबाहेर' : 'Over Limit'}
                            </span>
                          ) : bal >= 10000 ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                              {isMr ? 'मोठी बाकी' : 'High Due'}
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-700">
                              {isMr ? 'सामान्य' : 'Normal'}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          )}

          {/* 6. PROFIT & LOSS / MARGIN TABLE */}
          {reportType === 'profit' && (
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-100/75 text-slate-700 font-bold border-b border-slate-200">
                <tr>
                  <th className="p-3">{getTranslation('product_name', currentLang)}</th>
                  <th className="p-3">{getTranslation('category', currentLang)}</th>
                  <th className="p-3">{isMr ? 'कंपनी' : 'Company'}</th>
                  <th className="p-3 text-center">{isMr ? 'विक्री नग' : 'Qty Sold'}</th>
                  <th className="p-3 text-right">{isMr ? 'विक्री महसूल (₹)' : 'Sales Revenue (₹)'}</th>
                  <th className="p-3 text-right">{isMr ? 'खरेदी खर्च (₹)' : 'Cost of Goods (₹)'}</th>
                  <th className="p-3 text-right text-emerald-700">{isMr ? 'निव्वळ नफा (₹)' : 'Gross Profit (₹)'}</th>
                  <th className="p-3 text-right text-emerald-800">{isMr ? 'नफा टक्केवारी' : 'Margin %'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredProfit.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-slate-400">
                      {isMr ? 'निवडलेल्या कालावधीत कोणतीही विक्री नोंद झाली नाही.' : 'No sales or profit records found in this date range.'}
                    </td>
                  </tr>
                ) : (
                  filteredProfit.map((p) => (
                    <tr key={p.product_id} className="hover:bg-slate-50 transition-colors">
                      <td className="p-3 font-bold text-slate-900">
                        {p.product_name}
                        {p.pack_size && <span className="text-slate-500 font-normal ml-1">({p.pack_size})</span>}
                      </td>
                      <td className="p-3 text-slate-600">{p.category}</td>
                      <td className="p-3 text-slate-600">{p.company || '-'}</td>
                      <td className="p-3 text-center font-mono font-bold text-slate-800">{p.qty_sold} {p.unit}</td>
                      <td className="p-3 text-right font-mono text-slate-800 font-medium">{formatINR(p.total_revenue)}</td>
                      <td className="p-3 text-right font-mono text-slate-600">{formatINR(p.total_cost)}</td>
                      <td className="p-3 text-right font-mono font-extrabold text-emerald-700">
                        {formatINR(p.gross_profit)}
                      </td>
                      <td className="p-3 text-right font-mono font-bold text-emerald-800">
                        <span className={`px-2 py-0.5 rounded-full text-[11px] ${
                          p.margin_pct >= 20 ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-800'
                        }`}>
                          {p.margin_pct}%
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}

          {/* 7. GST REPORT TABLE */}
          {reportType === 'gst' && (
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-100/75 text-slate-700 font-bold border-b border-slate-200">
                <tr>
                  <th className="p-3">{isMr ? 'बिल क्र.' : 'Invoice No.'}</th>
                  <th className="p-3">{getTranslation('date', currentLang)}</th>
                  <th className="p-3">{isMr ? 'शेतकरी / ग्राहक' : 'Customer Name'}</th>
                  <th className="p-3">GSTIN</th>
                  <th className="p-3 text-center">{isMr ? 'बिल प्रकार' : 'Type'}</th>
                  <th className="p-3 text-right">{isMr ? 'करपात्र रक्कम (₹)' : 'Taxable Value (₹)'}</th>
                  <th className="p-3 text-right">CGST (₹)</th>
                  <th className="p-3 text-right">SGST (₹)</th>
                  <th className="p-3 text-right">{isMr ? 'एकूण कर (₹)' : 'Total GST (₹)'}</th>
                  <th className="p-3 text-right">{isMr ? 'एकूण बिल (₹)' : 'Grand Total (₹)'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredGst.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="p-8 text-center text-slate-400">
                      {isMr ? 'या कालावधीत कोणतीही GST बिल नोंद आढळली नाही.' : 'No GST bill records found for this period.'}
                    </td>
                  </tr>
                ) : (
                  filteredGst.map((g, idx) => (
                    <tr key={idx} className="hover:bg-slate-50 transition-colors">
                      <td className="p-3 font-mono font-bold text-slate-900">{g.invoice_no}</td>
                      <td className="p-3 font-mono text-slate-600">{formatDate(g.invoice_date)}</td>
                      <td className="p-3 font-semibold text-slate-800">{g.customer_name}</td>
                      <td className="p-3 font-mono text-slate-600">{g.gstin}</td>
                      <td className="p-3 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          g.is_gst_bill ? 'bg-blue-100 text-blue-800' : 'bg-slate-100 text-slate-700'
                        }`}>
                          {g.is_gst_bill ? 'B2C Tax' : 'Cash Memo'}
                        </span>
                      </td>
                      <td className="p-3 text-right font-mono text-slate-700">{formatINR(g.taxable_amount)}</td>
                      <td className="p-3 text-right font-mono text-slate-600">{formatINR(g.cgst_amount)}</td>
                      <td className="p-3 text-right font-mono text-slate-600">{formatINR(g.sgst_amount)}</td>
                      <td className="p-3 text-right font-mono font-bold text-blue-700">{formatINR(g.total_tax)}</td>
                      <td className="p-3 text-right font-mono font-extrabold text-slate-900">{formatINR(g.grand_total)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};
