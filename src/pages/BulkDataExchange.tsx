import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { 
  FileSpreadsheet, 
  Upload, 
  Download, 
  CheckCircle2, 
  AlertTriangle, 
  FileText, 
  Users, 
  ShoppingBag, 
  Package, 
  RefreshCw, 
  Check, 
  X,
  FileCheck,
  Building2,
  Info
} from 'lucide-react';
import { AppLanguage, ProductCategory } from '../types';
import { getTranslation } from '../i18n';
import { formatINR, safeNumber, parseExcelDate } from '../utils/formatters';
import { dbService } from '../services/api';
import { useFeedback } from '../components/common/FeedbackContext';

interface BulkDataExchangeProps {
  currentLang: AppLanguage;
  onRefreshData?: () => void;
}

type TabType = 'products' | 'farmers' | 'suppliers' | 'sales';

// Category normalization supporting all agriculture categories & Marathi keywords
export const normalizeProductCategory = (cat: any): ProductCategory => {
  const c = String(cat || '').trim().toLowerCase();
  if (c.includes('fert') || c.includes('खत') || c.includes('उर्वरक')) {
    if (c.includes('bio') || c.includes('सेंद्रिय') || c.includes('जैविक')) return 'Bio Fertilizers';
    return 'Fertilizers';
  }
  if (c.includes('fungi') || c.includes('बुरशी')) return 'Fungicide';
  if (c.includes('herbi') || c.includes('weed') || c.includes('तण')) return 'Herbicide';
  if (c.includes('insect') || c.includes('कीटक')) return 'Insecticide';
  if (c.includes('pest') || c.includes('औषध')) return 'Pesticides';
  if (c.includes('seed') || c.includes('बिया') || c.includes('बीज')) return 'Seeds';
  if (c.includes('micro') || c.includes('सूक्ष्म') || c.includes('zinc') || c.includes('boron')) return 'Micronutrients';
  if (c.includes('pgr') || c.includes('संजीवक') || c.includes('growth') || c.includes('tonic') || c.includes('टॉनिक')) return 'PGR';
  if (c.includes('spray') || c.includes('tool') || c.includes('यंत्र') || c.includes('औजार') || c.includes('उपकरण')) return 'Sprayers & Tools';
  if (c.includes('bio') || c.includes('organic') || c.includes('सेंद्रिय') || c.includes('जैविक')) return 'Bio Fertilizers';
  if (c === 'other' || c === 'इतर') return 'Other';
  return 'Fertilizers';
};

// Flexible column value extractor that matches case, whitespace, brackets, punctuation, and language variations
const getVal = (row: any, ...keys: string[]): any => {
  if (!row) return '';
  for (const k of keys) {
    if (row[k] !== undefined && row[k] !== null && String(row[k]).trim() !== '') {
      return row[k];
    }
  }
  const rowKeys = Object.keys(row);
  for (const target of keys) {
    const cleanTarget = target.toLowerCase().replace(/[^a-z0-9\u0900-\u097F]/g, '');
    for (const rk of rowKeys) {
      const cleanRk = rk.toLowerCase().replace(/[^a-z0-9\u0900-\u097F]/g, '');
      if (cleanRk === cleanTarget && row[rk] !== undefined && row[rk] !== null && String(row[rk]).trim() !== '') {
        return row[rk];
      }
    }
  }
  return '';
};

export const BulkDataExchange: React.FC<BulkDataExchangeProps> = ({ currentLang, onRefreshData }) => {
  const { showToast } = useFeedback();
  const isMr = currentLang === 'mr';
  const [activeTab, setActiveTab] = useState<TabType>('products');
  const [loading, setLoading] = useState(false);
  const [parsedRows, setParsedRows] = useState<any[]>([]);
  const [fileName, setFileName] = useState<string>('');
  const [importReport, setImportReport] = useState<{ success: number; skipped: number; errors: string[] } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Clear loaded file and preview when switching tabs
  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    setParsedRows([]);
    setFileName('');
    setImportReport(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // ================= 1. EXPORT HANDLERS =================

  const handleExportProducts = async () => {
    setLoading(true);
    try {
      const products = await dbService.getProducts('', '');
      const exportData = await Promise.all(products.map(async (p) => {
        let opnStock = 0;
        let batchNo = 'OPN-01';
        let expiryDate = '2028-12-31';
        try {
          const batches = await dbService.getBatchesForProduct(p.id);
          if (batches.length > 0) {
            opnStock = batches.reduce((sum, b) => sum + (b.current_qty || 0), 0);
            batchNo = batches[0].batch_number || 'OPN-01';
            expiryDate = batches[0].expiry_date || '2028-12-31';
          }
        } catch {
          // ignore batch lookup error
        }

        return {
          'Product Code': p.product_code,
          'Product Name': p.name,
          'Marathi / Local Name': p.name_mr || p.name,
          'Category': p.category,
          'Brand / Company': p.brand || p.company || 'General',
          'HSN Code': p.hsn_code || '0000',
          'Unit': p.unit || 'Bags',
          'Pack Size': p.pack_size || '1',
          'Purchase Rate (Rs)': p.purchase_rate,
          'MRP (Rs)': p.mrp,
          'Selling Rate (Rs)': p.selling_rate,
          'GST Rate (%)': p.gst_rate,
          'Low Stock Alert': p.low_stock_alert || p.min_stock || 10,
          'Barcode': p.barcode || '',
          'Technical Name': p.technical_name || '',
          'Opening Stock Qty': opnStock,
          'Opening Batch No': batchNo,
          'Expiry Date (YYYY-MM-DD)': expiryDate,
        };
      }));

      const worksheet = XLSX.utils.json_to_sheet(exportData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Products_Master');
      XLSX.writeFile(workbook, `KrushiSeva_Products_${new Date().toISOString().slice(0, 10)}.xlsx`);
      showToast(isMr ? `${exportData.length} उत्पादने एक्सेलमध्ये एक्सपोर्ट झाली.` : `Exported ${exportData.length} products to Excel.`, 'success');
    } catch (err: any) {
      showToast(err.message || 'Export failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleExportFarmers = async () => {
    setLoading(true);
    try {
      const farmers = await dbService.getCustomers('');
      const exportData = farmers.map((f) => ({
        'Farmer Name': f.name,
        'Marathi Name': f.name_mr || f.name,
        'Mobile': f.mobile,
        'Village': f.village || '',
        'Taluka': f.taluka || '',
        'District': f.district || '',
        'Aadhar No': f.aadhar_no || '',
        '7/12 Land (Acres)': f.land_acreage || 0,
        'Major Crops': f.crops_grown || '',
        'Credit Limit (Rs)': f.credit_limit || 50000,
        'Current Khata Balance (Rs)': f.current_balance || 0,
      }));

      const worksheet = XLSX.utils.json_to_sheet(exportData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Farmers_Directory');
      XLSX.writeFile(workbook, `KrushiSeva_Farmers_${new Date().toISOString().slice(0, 10)}.xlsx`);
      showToast(isMr ? `${exportData.length} शेतकरी खाते एक्सेलमध्ये एक्सपोर्ट झाले.` : `Exported ${exportData.length} farmers to Excel.`, 'success');
    } catch (err: any) {
      showToast(err.message || 'Export failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleExportSuppliers = async () => {
    setLoading(true);
    try {
      const suppliers = await dbService.getSuppliers('');
      const exportData = suppliers.map((s) => ({
        'Supplier Code': s.supplier_code,
        'Company / Supplier Name': s.name,
        'Contact Person': s.contact_person || '',
        'Mobile': s.mobile,
        'Email': s.email || '',
        'GSTIN': s.gstin || '',
        'Licence No': s.licence_no || '',
        'Address': s.address || '',
        'City': s.city || 'पुणे',
        'State': s.state || 'Maharashtra',
        'Credit Limit (Rs)': s.credit_limit || 500000,
        'Current Balance (Rs)': s.current_balance || 0,
      }));

      const worksheet = XLSX.utils.json_to_sheet(exportData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Suppliers_Master');
      XLSX.writeFile(workbook, `KrushiSeva_Suppliers_${new Date().toISOString().slice(0, 10)}.xlsx`);
      showToast(isMr ? `${exportData.length} सप्लायर एक्सेलमध्ये एक्सपोर्ट झाले.` : `Exported ${exportData.length} suppliers to Excel.`, 'success');
    } catch (err: any) {
      showToast(err.message || 'Export failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleExportSales = async () => {
    setLoading(true);
    try {
      const sales = await dbService.getSales();
      const exportData = sales.map((s) => ({
        'Invoice No': s.invoice_no,
        'Date': s.invoice_date,
        'Farmer / Customer': s.customer_name || 'Walk-in Customer',
        'Mobile': s.customer_mobile || '-',
        'Village': s.customer_village || '-',
        'Payment Mode': s.payment_mode,
        'Subtotal (Rs)': s.subtotal,
        'Taxable (Rs)': s.taxable_amount || s.subtotal,
        'CGST (Rs)': s.cgst_amount,
        'SGST (Rs)': s.sgst_amount,
        'Discount (Rs)': s.discount_amount,
        'Total Amount (Rs)': s.grand_total,
        'Paid Amount (Rs)': s.paid_amount,
        'Credit Due (Rs)': s.credit_amount,
      }));

      const worksheet = XLSX.utils.json_to_sheet(exportData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Sales_Register');
      XLSX.writeFile(workbook, `KrushiSeva_Sales_${new Date().toISOString().slice(0, 10)}.xlsx`);
      showToast(isMr ? `${exportData.length} विक्री नोंदी एक्सेलमध्ये एक्सपोर्ट झाल्या.` : `Exported ${exportData.length} sales to Excel.`, 'success');
    } catch (err: any) {
      showToast(err.message || 'Export failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  // ================= 2. SAMPLE TEMPLATE DOWNLOAD =================

  const handleDownloadSample = () => {
    let sampleData: any[] = [];
    let sheetName = '';
    let fileName = '';

    if (activeTab === 'products') {
      sheetName = 'Products_Template';
      fileName = 'KrushiSeva_Products_Template.xlsx';
      sampleData = [
        {
          'Product Code': 'PRD-101',
          'Product Name': 'Urea 46% Nitrogen',
          'Marathi / Local Name': 'युरिया ४६% खत',
          'Category': 'Fertilizers',
          'Subcategory': 'Nitrogenous Fertilizers',
          'Brand / Company': 'RCF',
          'HSN Code': '3102',
          'Unit': 'Bags',
          'Pack Size': '45 Kg',
          'Purchase Rate (Rs)': 242,
          'MRP (Rs)': 266.50,
          'Selling Rate (Rs)': 266.50,
          'Dealer Rate (Rs)': 250,
          'GST Rate (%)': 5,
          'Low Stock Alert': 20,
          'Barcode': '8901234567890',
          'Technical Name': 'Nitrogen 46% Prilled',
          'Fertilizer Grade': '46-0-0',
          'NPK Ratio': '46:0:0',
          'Seed Variety': '',
          'Toxicity Class': '',
          'CIB Registration No': '',
          'Description': 'Standard agricultural nitrogen fertilizer',
          'Opening Stock Qty': 100,
          'Opening Batch No': 'RC-9941',
          'Expiry Date (YYYY-MM-DD)': '2028-12-31',
        },
        {
          'Product Code': 'PRD-102',
          'Product Name': 'Mahyco Hybrid Cotton Seeds 7351',
          'Marathi / Local Name': 'माहिको बीटी कापूस बियाणे',
          'Category': 'Seeds',
          'Subcategory': 'Cotton Seeds',
          'Brand / Company': 'Mahyco',
          'HSN Code': '1209',
          'Unit': 'Packets',
          'Pack Size': '450 gm',
          'Purchase Rate (Rs)': 810,
          'MRP (Rs)': 864,
          'Selling Rate (Rs)': 864,
          'Dealer Rate (Rs)': 825,
          'GST Rate (%)': 0,
          'Low Stock Alert': 15,
          'Barcode': '8909876543210',
          'Technical Name': 'BG-II Cotton Hybrid Seed',
          'Fertilizer Grade': '',
          'NPK Ratio': '',
          'Seed Variety': 'MRC-7351 BG-II',
          'Toxicity Class': '',
          'CIB Registration No': '',
          'Description': 'High yielding bollworm resistant seeds',
          'Opening Stock Qty': 50,
          'Opening Batch No': 'MC-4512',
          'Expiry Date (YYYY-MM-DD)': '2027-06-30',
        },
        {
          'Product Code': 'PRD-103',
          'Product Name': 'Coragen Insecticide',
          'Marathi / Local Name': 'कोराजन कीटकनाशक',
          'Category': 'Pesticides',
          'Subcategory': 'Insecticides',
          'Brand / Company': 'FMC',
          'HSN Code': '3808',
          'Unit': 'Bottles',
          'Pack Size': '150 ml',
          'Purchase Rate (Rs)': 1680,
          'MRP (Rs)': 1950,
          'Selling Rate (Rs)': 1890,
          'Dealer Rate (Rs)': 1750,
          'GST Rate (%)': 18,
          'Low Stock Alert': 10,
          'Barcode': '8901122334455',
          'Technical Name': 'Chlorantraniliprole 18.5% SC',
          'Fertilizer Grade': '',
          'NPK Ratio': '',
          'Seed Variety': '',
          'Toxicity Class': 'Green (Safe)',
          'CIB Registration No': 'CIR-64522/2010',
          'Description': 'Broad spectrum insecticide for caterpillar control',
          'Opening Stock Qty': 25,
          'Opening Batch No': 'FM-8821',
          'Expiry Date (YYYY-MM-DD)': '2028-04-15',
        }
      ];
    } else if (activeTab === 'farmers') {
      sheetName = 'Farmers_Template';
      fileName = 'KrushiSeva_Farmers_Template.xlsx';
      sampleData = [
        {
          'Farmer Code': 'CUST-1001',
          'Farmer Name': 'Ramesh Baburao Patil',
          'Marathi Name': 'रमेश बाबुराव पाटील',
          'Mobile': '9822112233',
          'Alt Mobile': '9822112234',
          'Village': 'Sangvi',
          'Taluka': 'Baramati',
          'District': 'Pune',
          'Address': 'At Post Sangvi, Near Grampanchayat',
          'Pincode': '413102',
          'Aadhar No': '4412-8874-9912',
          '7/12 Land (Acres)': 5.5,
          'Major Crops': 'Soybean, Cotton, Wheat',
          'Credit Limit (Rs)': 50000,
          'Opening Balance (Rs)': 4500,
          'Notes': 'Regular customer',
        },
        {
          'Farmer Code': 'CUST-1002',
          'Farmer Name': 'Ganesh Dnyaneshwar Shinde',
          'Marathi Name': 'गणेश ज्ञानेश्वर शिंदे',
          'Mobile': '9890112244',
          'Alt Mobile': '',
          'Village': 'Nimgaon',
          'Taluka': 'Baramati',
          'District': 'Pune',
          'Address': 'Shinde Vasti, Nimgaon',
          'Pincode': '413102',
          'Aadhar No': '',
          '7/12 Land (Acres)': 8.0,
          'Major Crops': 'Sugarcane, Onion',
          'Credit Limit (Rs)': 75000,
          'Opening Balance (Rs)': 0,
          'Notes': 'Timely payment',
        }
      ];
    } else if (activeTab === 'suppliers') {
      sheetName = 'Suppliers_Template';
      fileName = 'KrushiSeva_Suppliers_Template.xlsx';
      sampleData = [
        {
          'Supplier Code': 'SUP-101',
          'Company / Supplier Name': 'Deepak Fertilisers Ltd',
          'Contact Person': 'Ganesh Shinde',
          'Mobile': '9822100200',
          'Email': 'deepak.agro@smartchem.com',
          'GSTIN': '27AAACD1111A1Z1',
          'Licence No': 'FL/PUN/8821',
          'Address': 'Sai Chambers, Station Road',
          'City': 'पुणे',
          'State': 'Maharashtra',
          'Credit Limit (Rs)': 1000000,
          'Opening Balance (Rs)': 85000,
        },
        {
          'Supplier Code': 'SUP-102',
          'Company / Supplier Name': 'Mahadhan Agro Distributors',
          'Contact Person': 'Sunil Mohite',
          'Mobile': '9850112244',
          'Email': 'mahadhan.dist@gmail.com',
          'GSTIN': '27BBDCE2222B2Z2',
          'Licence No': 'FL/BAR/4412',
          'Address': 'MIDC Phase II',
          'City': 'बारामती',
          'State': 'Maharashtra',
          'Credit Limit (Rs)': 800000,
          'Opening Balance (Rs)': 42500,
        }
      ];
    } else {
      sheetName = 'Sales_Template';
      fileName = 'KrushiSeva_Sales_Template.xlsx';
      sampleData = [
        {
          'Invoice No': 'INV-9001',
          'Date (YYYY-MM-DD)': new Date().toISOString().slice(0, 10),
          'Customer Name': 'Suresh Tukaram Jadhav',
          'Customer Mobile': '9822334455',
          'Customer Village': 'Takli',
          'Payment Mode': 'Cash',
          'Product Code or Name': 'PRD-101',
          'Quantity': 2,
          'Unit Price (Rs)': 266.50,
          'Discount (Rs)': 0,
          'GST %': 5,
          'Paid Amount (Rs)': 533,
        },
        {
          'Invoice No': 'INV-9002',
          'Date (YYYY-MM-DD)': new Date().toISOString().slice(0, 10),
          'Customer Name': 'Anil Vitthal Gaikwad',
          'Customer Mobile': '9850114422',
          'Customer Village': 'Deolali',
          'Payment Mode': 'Credit',
          'Product Code or Name': 'Coragen Insecticide',
          'Quantity': 1,
          'Unit Price (Rs)': 1890,
          'Discount (Rs)': 0,
          'GST %': 18,
          'Paid Amount (Rs)': 500,
        }
      ];
    }

    const worksheet = XLSX.utils.json_to_sheet(sampleData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
    XLSX.writeFile(workbook, fileName);
    showToast(isMr ? 'नमुना एक्सेल टेम्प्लेट यशस्वीरित्या डाऊनलोड झाले.' : 'Sample template downloaded successfully.', 'success');
  };

  // ================= 3. FILE PARSING & VALIDATION =================

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setImportReport(null);
    const reader = new FileReader();

    reader.onload = (evt) => {
      try {
        const buffer = evt.target?.result;
        const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
        
        // Find best sheet matching the active tab or fallback to sheet with data
        let targetSheetName = workbook.SheetNames[0];
        let foundMatch = false;
        for (const name of workbook.SheetNames) {
          const lower = name.toLowerCase();
          if (activeTab === 'products' && (lower.includes('product') || lower.includes('उत्पादन') || lower.includes('item'))) {
            targetSheetName = name;
            foundMatch = true;
            break;
          }
          if (activeTab === 'farmers' && (lower.includes('farmer') || lower.includes('cust') || lower.includes('शेतकरी') || lower.includes('ग्राहक'))) {
            targetSheetName = name;
            foundMatch = true;
            break;
          }
          if (activeTab === 'suppliers' && (lower.includes('supp') || lower.includes('सप्लायर') || lower.includes('पुरवठादार') || lower.includes('कंपनी'))) {
            targetSheetName = name;
            foundMatch = true;
            break;
          }
          if (activeTab === 'sales' && (lower.includes('sale') || lower.includes('विक्री') || lower.includes('bill') || lower.includes('invoice'))) {
            targetSheetName = name;
            foundMatch = true;
            break;
          }
        }

        if (!foundMatch) {
          for (const name of workbook.SheetNames) {
            const ws = workbook.Sheets[name];
            if (ws && ws['!ref']) {
              const testJson = XLSX.utils.sheet_to_json(ws, { defval: '' });
              if (testJson.length > 0) {
                targetSheetName = name;
                break;
              }
            }
          }
        }

        const worksheet = workbook.Sheets[targetSheetName];
        const rawJson: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

        if (!rawJson || rawJson.length === 0) {
          showToast(isMr ? 'निवडलेली एक्सेल फाईल रिकामी आहे.' : 'Selected Excel file contains no data rows.', 'warning');
          setParsedRows([]);
          return;
        }

        // Validate and standardize fields based on active tab
        const validated = rawJson.map((row, idx) => {
          if (activeTab === 'products') {
            const name = String(getVal(row, 'Product Name', 'Name', 'ProductName', 'Item Name', 'नाव', 'उत्पादन नाव', 'उत्पादन')).trim();
            const category = normalizeProductCategory(getVal(row, 'Category', 'विभाग', 'वर्ग', 'Product Category'));
            const purchaseRate = safeNumber(getVal(row, 'Purchase Rate (Rs)', 'Purchase Rate', 'खरेदी दर', 'Purchase Price', 'purchase_rate'), 0);
            const sellingRate = safeNumber(getVal(row, 'Selling Rate (Rs)', 'Selling Rate', 'विक्री दर', 'Selling Price', 'selling_rate'), purchaseRate || 0);
            const mrp = safeNumber(getVal(row, 'MRP (Rs)', 'MRP', 'एमआरपी', 'mrp'), sellingRate || purchaseRate || 0);
            const unit = String(getVal(row, 'Unit', 'एकक', 'UOM', 'unit') || 'Bags').trim();
            const packSize = String(getVal(row, 'Pack Size', 'पॅक साईज', 'Packing', 'पॅकिंग', 'pack_size') || '1').trim();
            const openingStock = safeNumber(getVal(row, 'Opening Stock Qty', 'Opening Stock', 'Stock', 'आरंभी साठा', 'opening_stock', 'Qty'), 0);
            const batchNo = String(getVal(row, 'Opening Batch No', 'Batch No', 'Batch', 'बॅच', 'बॅच क्र', 'batch_number') || 'OPN-01').trim();
            const expiryDate = parseExcelDate(getVal(row, 'Expiry Date (YYYY-MM-DD)', 'Expiry Date', 'Expiry', 'एक्सपायरी तारीख', 'expiry_date'), '2028-12-31');

            const brand = String(getVal(row, 'Brand / Company', 'Brand', 'Company', 'कंपनी', 'ब्रँड', 'brand', 'company') || 'General').trim();
            const hsnCode = String(getVal(row, 'HSN Code', 'HSN', 'एचएसएन', 'hsn_code') || '0000').trim();
            const gstRate = safeNumber(getVal(row, 'GST Rate (%)', 'GST %', 'GST', 'जीएसटी %', 'gst_rate'), 5);
            const lowStockAlert = safeNumber(getVal(row, 'Low Stock Alert', 'Min Stock', 'Minimum Stock', 'किमान साठा', 'low_stock_alert'), 10);
            const barcode = String(getVal(row, 'Barcode', 'Bar Code', 'बारकोड', 'barcode')).trim();
            const technicalName = String(getVal(row, 'Technical Name', 'Technical Content', 'Technical', 'तांत्रिक नाव', 'घटक', 'technical_name')).trim();
            const nameMr = String(getVal(row, 'Marathi / Local Name', 'Local Name', 'Marathi Name', 'नाव (मराठी)', 'name_mr') || name).trim();
            const subcategory = String(getVal(row, 'Subcategory', 'उपविभाग', 'subcategory')).trim();
            const dealerRate = safeNumber(getVal(row, 'Dealer Rate (Rs)', 'Dealer Rate', 'डीलर दर', 'dealer_rate'), 0);
            const fertilizerGrade = String(getVal(row, 'Fertilizer Grade', 'Grade', 'ग्रेड', 'fertilizer_grade')).trim();
            const npkRatio = String(getVal(row, 'NPK Ratio', 'NPK', 'एनपीके', 'npk_ratio')).trim();
            const seedVariety = String(getVal(row, 'Seed Variety', 'Variety', 'वाण', 'seed_variety')).trim();
            const toxicityClass = String(getVal(row, 'Toxicity Class', 'विषारी वर्ग', 'toxicity_class')).trim();
            const cibRegistrationNo = String(getVal(row, 'CIB Registration No', 'CIB No', 'सीआयबी क्र', 'cib_registration_no')).trim();
            const description = String(getVal(row, 'Description', 'वर्णन', 'description')).trim();
            const productCode = String(getVal(row, 'Product Code', 'Code', 'Item Code', 'कोड', 'उत्पादन कोड', 'product_code') || '').trim();

            const isValid = name.length > 0;
            return {
              _index: idx + 1,
              _isValid: isValid,
              _error: !isValid ? (isMr ? 'उत्पादनाचे नाव आवश्यक आहे' : 'Product name is missing') : '',
              productCode: productCode || `PRD-${Math.floor(1000 + Math.random() * 9000)}`,
              name,
              nameMr,
              category,
              brand,
              hsnCode,
              unit,
              packSize,
              purchaseRate,
              mrp,
              sellingRate,
              dealerRate,
              gstRate,
              lowStockAlert,
              barcode,
              technicalName,
              subcategory,
              fertilizerGrade,
              npkRatio,
              seedVariety,
              toxicityClass,
              cibRegistrationNo,
              description,
              openingStock,
              batchNo,
              expiryDate
            };
          } else if (activeTab === 'farmers') {
            const customerCode = String(getVal(row, 'Farmer Code', 'Customer Code', 'Code', 'कोड', 'शेतकरी कोड') || '').trim();
            const name = String(getVal(row, 'Farmer Name', 'Name', 'Customer Name', 'शेतकरी नाव', 'नाव', 'ग्राहक नाव')).trim();
            const nameMr = String(getVal(row, 'Marathi Name', 'Local Name', 'नाव (मराठी)', 'name_mr') || name).trim();
            const mobile = String(getVal(row, 'Mobile', 'Phone', 'मोबाईल', 'फोन')).trim();
            const village = String(getVal(row, 'Village', 'गाव', 'village') || 'गाव').trim();
            const isValid = name.length > 0;

            return {
              _index: idx + 1,
              _isValid: isValid,
              _error: !isValid ? (isMr ? 'शेतकरी नाव आवश्यक आहे' : 'Farmer name is required') : '',
              customerCode,
              name,
              nameMr,
              mobile: mobile || `99${Math.floor(10000000 + Math.random() * 90000000)}`,
              altMobile: String(getVal(row, 'Alt Mobile', 'Alternate Phone', 'पर्यायी मोबाईल')).trim(),
              village,
              taluka: String(getVal(row, 'Taluka', 'तालुका') || 'बारामती').trim(),
              district: String(getVal(row, 'District', 'जिल्हा') || 'पुणे').trim(),
              address: String(getVal(row, 'Address', 'पत्ता') || '').trim(),
              pincode: String(getVal(row, 'Pincode', 'पिनकोड') || '').trim(),
              aadharNo: String(getVal(row, 'Aadhar No', 'Aadhar', 'आधार', 'आधार क्र.')).trim(),
              landAcres: safeNumber(getVal(row, '7/12 Land (Acres)', 'Land', 'जमीन', '7/12 जमीन'), 0),
              majorCrops: String(getVal(row, 'Major Crops', 'Crops', 'पिके', 'मुख्य पिके') || 'Cotton, Soybean').trim(),
              creditLimit: safeNumber(getVal(row, 'Credit Limit (Rs)', 'Credit Limit', 'मर्यादा', 'उधारी मर्यादा'), 50000),
              openingBalance: safeNumber(getVal(row, 'Opening Balance (Rs)', 'Opening Balance', 'आरंभी बाकी', 'बाकी रक्कम'), 0),
              notes: String(getVal(row, 'Notes', 'शेरा', 'notes')).trim(),
            };
          } else if (activeTab === 'suppliers') {
            const name = String(getVal(row, 'Company / Supplier Name', 'Supplier Name', 'Name', 'Company', 'कंपनी नाव', 'सप्लायर नाव')).trim();
            const company = String(getVal(row, 'Company', 'कंपनी') || name).trim();
            const mobile = String(getVal(row, 'Mobile', 'Phone', 'मोबाईल')).trim();
            const isValid = name.length > 0;

            return {
              _index: idx + 1,
              _isValid: isValid,
              _error: !isValid ? (isMr ? 'सप्लायरचे नाव आवश्यक आहे' : 'Supplier name is required') : '',
              supplierCode: String(getVal(row, 'Supplier Code', 'Code', 'सप्लायर कोड') || `SUP-${Math.floor(1000 + Math.random() * 9000)}`).trim(),
              name,
              company,
              contactPerson: String(getVal(row, 'Contact Person', 'संपर्क व्यक्ती')).trim(),
              mobile: mobile || '0000000000',
              email: String(getVal(row, 'Email', 'ईमेल')).trim(),
              gstin: String(getVal(row, 'GSTIN', 'GST', 'जीएसटी')).trim().toUpperCase(),
              licenceNo: String(getVal(row, 'Licence No', 'Licence', 'परवाना क्रमांक')).trim(),
              address: String(getVal(row, 'Address', 'पत्ता')).trim(),
              city: String(getVal(row, 'City', 'शहर') || 'पुणे').trim(),
              state: String(getVal(row, 'State', 'राज्य') || 'Maharashtra').trim(),
              creditLimit: safeNumber(getVal(row, 'Credit Limit (Rs)', 'Credit Limit', 'उधारी मर्यादा'), 500000),
              openingBalance: safeNumber(getVal(row, 'Opening Balance (Rs)', 'Opening Balance', 'आरंभी बाकी'), 0),
            };
          } else {
            // Sales import
            const invoiceNo = String(getVal(row, 'Invoice No', 'Invoice', 'पावती क्र.', 'बिल क्र.') || `INV-${Math.floor(1000 + Math.random() * 9000)}`).trim();
            const customerName = String(getVal(row, 'Customer Name', 'Farmer Name', 'Customer', 'ग्राहक नाव', 'शेतकरी') || 'Walk-in Customer').trim();
            const mobile = String(getVal(row, 'Customer Mobile', 'Mobile', 'मोबाईल')).trim();
            const village = String(getVal(row, 'Customer Village', 'Village', 'गाव')).trim();
            const product = String(getVal(row, 'Product Code or Name', 'Product', 'Item', 'उत्पादन नाव', 'उत्पादन')).trim();
            const qty = safeNumber(getVal(row, 'Quantity', 'Qty', 'नग'), 1);
            const unitPrice = safeNumber(getVal(row, 'Unit Price (Rs)', 'Price', 'Rate', 'दर'), 0);
            const gstRate = safeNumber(getVal(row, 'GST %', 'GST Rate (%)', 'GST', 'जीएसटी %'), 0);
            const paidAmount = safeNumber(getVal(row, 'Paid Amount (Rs)', 'Paid', 'भरलेली रक्कम'), 0);
            const isValid = product.length > 0 && unitPrice > 0;

            return {
              _index: idx + 1,
              _isValid: isValid,
              _error: !isValid ? (isMr ? 'उत्पादन आणि दर आवश्यक आहे' : 'Product name and price are required') : '',
              invoiceNo,
              date: parseExcelDate(getVal(row, 'Date (YYYY-MM-DD)', 'Date', 'तारीख'), new Date().toISOString().slice(0, 10)),
              customerName,
              mobile,
              village,
              paymentMode: String(getVal(row, 'Payment Mode', 'Mode', 'पेमेंट प्रकार') || 'Cash').trim(),
              product,
              qty,
              unitPrice,
              discount: safeNumber(getVal(row, 'Discount (Rs)', 'Discount', 'सूट'), 0),
              gstRate,
              paidAmount
            };
          }
        });

        setParsedRows(validated);
        const validCount = validated.filter(r => r._isValid).length;
        showToast(
          isMr 
            ? `${rawJson.length} ओळी वाचल्या. (${validCount} वैध, ${rawJson.length - validCount} त्रुटी)` 
            : `Read ${rawJson.length} rows (${validCount} valid, ${rawJson.length - validCount} invalid)`,
          'info'
        );
      } catch (err: any) {
        showToast(err.message || 'Failed to read file', 'error');
      }
    };

    reader.readAsArrayBuffer(file);
  };

  // ================= 4. EXECUTE BULK IMPORT =================

  const handleExecuteImport = async () => {
    const validRows = parsedRows.filter(r => r._isValid);
    if (validRows.length === 0) {
      showToast(isMr ? 'इम्पोर्ट करण्यासाठी एकही वैध ओळ उपलब्ध नाही.' : 'No valid rows found to import.', 'warning');
      return;
    }

    setLoading(true);
    let success = 0;
    let skipped = 0;
    const errors: string[] = [];

    try {
      if (activeTab === 'products') {
        for (const row of validRows) {
          try {
            await dbService.saveProduct({
              product_code: row.productCode,
              name: row.name,
              name_mr: row.nameMr || row.name,
              brand: row.brand,
              company: row.brand,
              category: row.category as ProductCategory,
              subcategory: row.subcategory,
              hsn_code: row.hsnCode,
              unit: row.unit,
              pack_size: row.packSize,
              purchase_rate: row.purchaseRate,
              mrp: row.mrp,
              selling_rate: row.sellingRate,
              dealer_rate: row.dealerRate,
              gst_rate: row.gstRate,
              low_stock_alert: row.lowStockAlert,
              barcode: row.barcode,
              technical_name: row.technicalName,
              fertilizer_grade: row.fertilizerGrade,
              npk_ratio: row.npkRatio,
              seed_variety: row.seedVariety,
              toxicity_class: row.toxicityClass,
              cib_registration_no: row.cibRegistrationNo,
              description: row.description,
              opening_stock: row.openingStock,
              batch_number: row.batchNo || 'OPN-01',
              expiry_date: row.expiryDate,
            });
            success++;
          } catch (e: any) {
            skipped++;
            errors.push(`${row.name} (${row.productCode}): ${e.message || 'Import error'}`);
          }
        }
      } else if (activeTab === 'farmers') {
        for (const row of validRows) {
          try {
            await dbService.saveCustomer({
              customer_code: row.customerCode || undefined,
              name: row.name,
              name_mr: row.nameMr || row.name,
              mobile: row.mobile,
              alt_mobile: row.altMobile,
              village: row.village || 'गाव',
              taluka: row.taluka || 'बारामती',
              district: row.district || 'पुणे',
              address: row.address || '',
              pincode: row.pincode || '',
              aadhar_no: row.aadharNo,
              land_acreage: row.landAcres,
              crops_grown: row.majorCrops,
              credit_limit: row.creditLimit,
              opening_balance: row.openingBalance,
              notes: row.notes,
            });
            success++;
          } catch (e: any) {
            skipped++;
            errors.push(`${row.name}: ${e.message || 'Import error'}`);
          }
        }
      } else if (activeTab === 'suppliers') {
        for (const row of validRows) {
          try {
            await dbService.saveSupplier({
              supplier_code: row.supplierCode,
              name: row.name,
              company: row.company,
              contact_person: row.contactPerson,
              mobile: row.mobile,
              email: row.email,
              address: row.address,
              city: row.city,
              state: row.state,
              gstin: row.gstin,
              licence_no: row.licenceNo,
              credit_limit: row.creditLimit,
              opening_balance: row.openingBalance,
            });
            success++;
          } catch (e: any) {
            skipped++;
            errors.push(`${row.name}: ${e.message || 'Import error'}`);
          }
        }
      } else {
        // Sales Import - Groups by invoiceNo
        const invoiceGroups: { [inv: string]: typeof validRows } = {};
        for (const row of validRows) {
          if (!invoiceGroups[row.invoiceNo]) invoiceGroups[row.invoiceNo] = [];
          invoiceGroups[row.invoiceNo].push(row);
        }

        // Cache existing customers and products
        const existingCustomers = await dbService.getCustomers('');
        const existingProducts = await dbService.getProducts('', '');

        for (const invNo of Object.keys(invoiceGroups)) {
          const invRows = invoiceGroups[invNo];
          try {
            const first = invRows[0];

            // 1. Handle Customer
            let customerId = 0;
            if (first.customerName && first.customerName.toLowerCase() !== 'walk-in customer') {
              const cust = existingCustomers.find(
                (c) => (first.mobile && c.mobile === first.mobile) || c.name.toLowerCase() === first.customerName.toLowerCase()
              );

              if (cust) {
                customerId = cust.id;
              } else {
                const newCustId = await dbService.saveCustomer({
                  name: first.customerName,
                  mobile: first.mobile || `99000${Math.floor(10000 + Math.random() * 90000)}`,
                  village: first.village || 'Local',
                  credit_limit: 50000,
                  opening_balance: 0,
                });
                customerId = newCustId;
                const newlyCreatedCust = await dbService.getCustomerById(newCustId);
                if (newlyCreatedCust) existingCustomers.push(newlyCreatedCust);
              }
            }

            // 2. Prepare items
            let subtotal = 0;
            let totalGst = 0;
            const saleItems: any[] = [];

            for (const itemRow of invRows) {
              let prod = existingProducts.find(
                (p) => p.product_code === itemRow.product || p.name.toLowerCase() === itemRow.product.toLowerCase()
              );

              if (!prod) {
                const newProdId = await dbService.saveProduct({
                  product_code: `PRD-${Math.floor(1000 + Math.random() * 9000)}`,
                  name: itemRow.product,
                  name_mr: itemRow.product,
                  brand: 'General',
                  category: 'Fertilizers',
                  hsn_code: '3102',
                  unit: 'Nos',
                  pack_size: '1',
                  purchase_rate: itemRow.unitPrice * 0.85,
                  mrp: itemRow.unitPrice,
                  selling_rate: itemRow.unitPrice,
                  gst_rate: itemRow.gstRate || 0,
                });
                const fetchedProd = await dbService.getProductById(newProdId);
                if (fetchedProd) {
                  prod = fetchedProd;
                  existingProducts.push(prod);
                }
              }

              const lineTotal = itemRow.qty * itemRow.unitPrice - itemRow.discount;
              const gstAmount = (lineTotal * (itemRow.gstRate || 0)) / 100;
              subtotal += lineTotal;
              totalGst += gstAmount;

              saleItems.push({
                product_id: prod ? prod.id : 1,
                product_name: prod ? prod.name : itemRow.product,
                product_code: prod ? prod.product_code : 'PRD',
                hsn_code: prod ? prod.hsn_code : '3102',
                batch_number: 'BULK-IMP',
                unit: prod ? prod.unit : 'Nos',
                quantity: itemRow.qty,
                rate: itemRow.unitPrice,
                mrp: prod ? prod.mrp : itemRow.unitPrice,
                discount_percent: 0,
                discount_amount: itemRow.discount,
                taxable_value: lineTotal,
                gst_rate: itemRow.gstRate || 0,
                cgst_amount: gstAmount / 2,
                sgst_amount: gstAmount / 2,
                igst_amount: 0,
                total_tax: gstAmount,
                total_amount: lineTotal + gstAmount,
              });
            }

            const finalAmount = subtotal + totalGst;
            const paid = first.paidAmount || (first.paymentMode === 'Cash' ? finalAmount : 0);
            const balanceDue = Math.max(0, finalAmount - paid);

            await dbService.createSale({
              invoice_no: invNo,
              invoice_date: first.date || new Date().toISOString().split('T')[0],
              customer_id: customerId,
              customer_name: first.customerName || 'Walk-in Customer',
              customer_mobile: first.mobile,
              customer_village: first.village,
              payment_mode: (first.paymentMode as any) || 'Cash',
              subtotal,
              discount_amount: 0,
              taxable_amount: subtotal,
              cgst_amount: totalGst / 2,
              sgst_amount: totalGst / 2,
              igst_amount: 0,
              total_tax: totalGst,
              round_off: 0,
              grand_total: finalAmount,
              paid_amount: paid,
              credit_amount: balanceDue,
              status: 'Completed',
              items: saleItems,
              notes: 'Imported via Bulk Excel Module'
            });

            success += invRows.length;
          } catch (e: any) {
            skipped += invRows.length;
            errors.push(`Invoice ${invNo}: ${e.message || 'Sale import error'}`);
          }
        }
      }

      setImportReport({ success, skipped, errors });
      setParsedRows([]);
      setFileName('');
      if (fileInputRef.current) fileInputRef.current.value = '';

      showToast(
        isMr 
          ? `बल्क इम्पोर्ट पूर्ण! ${success} नोंदी यशस्वीरित्या सेव्ह झाल्या.` 
          : `Bulk import completed! ${success} records successfully saved.`,
        'success'
      );
      onRefreshData?.();
    } catch (err: any) {
      showToast(err.message || 'Bulk import failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 p-6 overflow-y-auto space-y-4">
      {/* Header Banner */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-100 text-emerald-800">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-800">
                {getTranslation('bulk_data_title', currentLang)}
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                {getTranslation('bulk_data_subtitle', currentLang)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDownloadSample}
              className="px-3.5 py-2 rounded-lg border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold text-xs flex items-center gap-2 cursor-pointer transition-colors"
            >
              <Download className="w-4 h-4" />
              <span>{isMr ? 'नमुना टेम्प्लेट (.xlsx)' : 'Download Sample (.xlsx)'}</span>
            </button>

            <button
              type="button"
              onClick={
                activeTab === 'products' 
                  ? handleExportProducts 
                  : (activeTab === 'farmers' 
                      ? handleExportFarmers 
                      : (activeTab === 'suppliers' ? handleExportSuppliers : handleExportSales))
              }
              disabled={loading}
              className="px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs flex items-center gap-2 cursor-pointer shadow-xs transition-colors disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              <span>{isMr ? 'सर्व डेटा एक्सपोर्ट (.xlsx)' : 'Export Full Data (.xlsx)'}</span>
            </button>
          </div>
        </div>

        {/* Tab Selector */}
        <div className="flex items-center gap-2 pt-2 border-t border-slate-100 text-xs">
          <button
            type="button"
            onClick={() => handleTabChange('products')}
            className={`px-3 py-1.5 rounded-lg font-bold transition-colors cursor-pointer flex items-center gap-2 ${
              activeTab === 'products'
                ? 'bg-emerald-700 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <Package className="w-4 h-4" />
            <span>{isMr ? 'उत्पादने मास्टर' : 'Products Master'}</span>
          </button>

          <button
            type="button"
            onClick={() => handleTabChange('farmers')}
            className={`px-3 py-1.5 rounded-lg font-bold transition-colors cursor-pointer flex items-center gap-2 ${
              activeTab === 'farmers'
                ? 'bg-emerald-700 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>{isMr ? 'शेतकरी / ग्राहक खाते' : 'Farmers & Customers'}</span>
          </button>

          <button
            type="button"
            onClick={() => handleTabChange('suppliers')}
            className={`px-3 py-1.5 rounded-lg font-bold transition-colors cursor-pointer flex items-center gap-2 ${
              activeTab === 'suppliers'
                ? 'bg-emerald-700 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <Building2 className="w-4 h-4" />
            <span>{isMr ? 'सप्लायर / पुरवठादार' : 'Suppliers Master'}</span>
          </button>

          <button
            type="button"
            onClick={() => handleTabChange('sales')}
            className={`px-3 py-1.5 rounded-lg font-bold transition-colors cursor-pointer flex items-center gap-2 ${
              activeTab === 'sales'
                ? 'bg-emerald-700 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <ShoppingBag className="w-4 h-4" />
            <span>{isMr ? 'विक्री नोंदी' : 'Sales History'}</span>
          </button>
        </div>
      </div>

      {/* Upload Box */}
      <div className="bg-white p-6 rounded-xl border-2 border-dashed border-emerald-300 hover:border-emerald-500 transition-colors shadow-2xs text-center space-y-3">
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx, .xls, .csv"
          onChange={handleFileUpload}
          className="hidden"
          id="bulk-excel-input"
        />
        <label
          htmlFor="bulk-excel-input"
          className="cursor-pointer flex flex-col items-center justify-center space-y-2 py-4"
        >
          <div className="p-3 bg-emerald-50 rounded-full text-emerald-700 border border-emerald-200">
            <Upload className="w-6 h-6 animate-bounce" />
          </div>
          <div>
            <span className="font-bold text-sm text-slate-800 hover:text-emerald-700 underline">
              {isMr ? 'येथे क्लिक करून एक्सेल (.xlsx / .csv) फाईल निवडा' : 'Click here to upload Excel (.xlsx / .csv) file'}
            </span>
            <p className="text-xs text-slate-500 mt-1">
              {isMr 
                ? 'किंवा फाईल येथे ड्रॅग करून ड्रॉप करा. नमुना फॉरमॅटसाठी वरील "नमुना टेम्प्लेट" वापरा.' 
                : 'Directly supports Microsoft Excel and CSV spreadsheets.'}
            </p>
          </div>
        </label>

        {fileName && (
          <div className="inline-flex items-center gap-2 bg-emerald-50 border border-emerald-300 text-emerald-900 px-4 py-1.5 rounded-full text-xs font-bold">
            <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
            <span>{fileName}</span>
            <button
              type="button"
              onClick={() => {
                setParsedRows([]);
                setFileName('');
                if (fileInputRef.current) fileInputRef.current.value = '';
              }}
              className="text-emerald-700 hover:text-rose-600 ml-1 cursor-pointer"
            >
              ✕
            </button>
          </div>
        )}
      </div>

      {/* Import Report Banner */}
      {importReport && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 space-y-2 animate-in fade-in">
          <div className="flex items-center gap-2 text-emerald-900 font-bold text-sm">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            <span>
              {isMr 
                ? `इम्पोर्ट अहवाल: ${importReport.success} यशस्वीरित्या समाविष्ट, ${importReport.skipped} वगळले.` 
                : `Import Summary: ${importReport.success} successfully imported, ${importReport.skipped} skipped.`}
            </span>
          </div>
          {importReport.errors.length > 0 && (
            <div className="text-xs text-rose-700 bg-rose-50 p-2.5 rounded-lg border border-rose-200 space-y-1 max-h-32 overflow-y-auto">
              <strong>{isMr ? 'त्रुटी तपशील:' : 'Error details:'}</strong>
              {importReport.errors.map((err, i) => (
                <div key={i}>• {err}</div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Preview Table */}
      {parsedRows.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden space-y-3 p-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-3">
            <div>
              <h3 className="font-bold text-sm text-slate-800 flex items-center gap-2">
                <FileCheck className="w-4 h-4 text-emerald-700" />
                <span>
                  {isMr 
                    ? `एक्सेल डेटा पूर्वावलोकन (${parsedRows.length} ओळी आढळल्या)` 
                    : `Excel Data Preview (${parsedRows.length} rows found)`}
                </span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {isMr 
                  ? 'डेटा तपासून अंतिम इम्पोर्ट बटण दाबा.' 
                  : 'Review columns and verification status before committing to local database.'}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-600 font-semibold">
                {parsedRows.filter(r => r._isValid).length} {isMr ? 'वैध' : 'valid'} / {parsedRows.length}
              </span>

              <button
                type="button"
                onClick={handleExecuteImport}
                disabled={loading || parsedRows.filter(r => r._isValid).length === 0}
                className="px-4 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 active:scale-95 text-white font-bold text-xs flex items-center gap-2 cursor-pointer shadow-xs transition-all disabled:opacity-50"
              >
                <Check className="w-4 h-4" />
                <span>
                  {loading 
                    ? (isMr ? 'डेटा साठवत आहे...' : 'Importing...') 
                    : (isMr ? `डेटाबेसमध्ये सेव्ह करा (${parsedRows.filter(r => r._isValid).length})` : `Confirm & Import (${parsedRows.filter(r => r._isValid).length})`)}
                </span>
              </button>
            </div>
          </div>

          <div className="overflow-x-auto max-h-[400px]">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200 sticky top-0">
                <tr>
                  <th className="p-2.5 text-center">#</th>
                  <th className="p-2.5 text-center">{isMr ? 'स्थिती' : 'Status'}</th>
                  {activeTab === 'products' && (
                    <>
                      <th className="p-2.5">{isMr ? 'कोड' : 'Code'}</th>
                      <th className="p-2.5">{isMr ? 'उत्पादन नाव' : 'Product Name'}</th>
                      <th className="p-2.5">{isMr ? 'स्थानिक नाव' : 'Local Name'}</th>
                      <th className="p-2.5">{isMr ? 'विभाग' : 'Category'}</th>
                      <th className="p-2.5 text-right">{isMr ? 'खरेदी दर' : 'Purchase'}</th>
                      <th className="p-2.5 text-right">{isMr ? 'विक्री दर' : 'Selling'}</th>
                      <th className="p-2.5 text-center">{isMr ? 'GST %' : 'GST %'}</th>
                      <th className="p-2.5 text-center">{isMr ? 'आरंभी साठा' : 'Opening Qty'}</th>
                    </>
                  )}
                  {activeTab === 'farmers' && (
                    <>
                      <th className="p-2.5">{isMr ? 'शेतकरी नाव' : 'Farmer Name'}</th>
                      <th className="p-2.5">{isMr ? 'मोबाईल' : 'Mobile'}</th>
                      <th className="p-2.5">{isMr ? 'गाव' : 'Village'}</th>
                      <th className="p-2.5">{isMr ? 'आधार क्र.' : 'Aadhar'}</th>
                      <th className="p-2.5 text-center">{isMr ? 'जमीन (एकर)' : 'Land (Acres)'}</th>
                      <th className="p-2.5 text-right">{isMr ? 'उधारी मर्यादा' : 'Credit Limit'}</th>
                      <th className="p-2.5 text-right">{isMr ? 'आरंभी बाकी' : 'Opening Bal'}</th>
                    </>
                  )}
                  {activeTab === 'suppliers' && (
                    <>
                      <th className="p-2.5">{isMr ? 'सप्लायर कोड' : 'Supplier Code'}</th>
                      <th className="p-2.5">{isMr ? 'कंपनी / नाव' : 'Company / Name'}</th>
                      <th className="p-2.5">{isMr ? 'संपर्क व्यक्ती' : 'Contact Person'}</th>
                      <th className="p-2.5">{isMr ? 'मोबाईल' : 'Mobile'}</th>
                      <th className="p-2.5">{isMr ? 'GSTIN' : 'GSTIN'}</th>
                      <th className="p-2.5">{isMr ? 'शहर' : 'City'}</th>
                      <th className="p-2.5 text-right">{isMr ? 'उधारी मर्यादा' : 'Credit Limit'}</th>
                      <th className="p-2.5 text-right">{isMr ? 'आरंभी बाकी' : 'Opening Bal'}</th>
                    </>
                  )}
                  {activeTab === 'sales' && (
                    <>
                      <th className="p-2.5">{isMr ? 'पावती क्र.' : 'Invoice No'}</th>
                      <th className="p-2.5">{isMr ? 'तारीख' : 'Date'}</th>
                      <th className="p-2.5">{isMr ? 'ग्राहक / शेतकरी' : 'Customer'}</th>
                      <th className="p-2.5">{isMr ? 'मोबाईल' : 'Mobile'}</th>
                      <th className="p-2.5">{isMr ? 'उत्पादन' : 'Product'}</th>
                      <th className="p-2.5 text-center">{isMr ? 'नग' : 'Qty'}</th>
                      <th className="p-2.5 text-right">{isMr ? 'दर' : 'Unit Price'}</th>
                      <th className="p-2.5 text-center">{isMr ? 'पेमेंट प्रकार' : 'Mode'}</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {parsedRows.map((row, idx) => (
                  <tr key={idx} className={row._isValid ? 'hover:bg-slate-50' : 'bg-rose-50/50'}>
                    <td className="p-2.5 text-center font-mono text-slate-500">{row._index}</td>
                    <td className="p-2.5 text-center">
                      {row._isValid ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                          <Check className="w-3 h-3" />
                          <span>{isMr ? 'वैध' : 'Valid'}</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200" title={row._error}>
                          <X className="w-3 h-3" />
                          <span>{isMr ? 'त्रुटी' : 'Error'}</span>
                        </span>
                      )}
                    </td>

                    {activeTab === 'products' && (
                      <>
                        <td className="p-2.5 font-mono text-slate-600">{row.productCode}</td>
                        <td className="p-2.5 font-bold text-slate-800">{row.name}</td>
                        <td className="p-2.5 text-slate-600">{row.nameMr}</td>
                        <td className="p-2.5 text-slate-600">{row.category}</td>
                        <td className="p-2.5 text-right font-mono text-slate-700">{formatINR(row.purchaseRate)}</td>
                        <td className="p-2.5 text-right font-mono font-bold text-emerald-700">{formatINR(row.sellingRate)}</td>
                        <td className="p-2.5 text-center font-mono text-slate-700">{row.gstRate}%</td>
                        <td className="p-2.5 text-center font-mono font-semibold text-slate-800">
                          {row.openingStock > 0 ? `${row.openingStock} ${row.unit}` : '-'}
                        </td>
                      </>
                    )}

                    {activeTab === 'farmers' && (
                      <>
                        <td className="p-2.5 font-bold text-slate-800">{row.name}</td>
                        <td className="p-2.5 font-mono text-slate-700">{row.mobile}</td>
                        <td className="p-2.5 text-slate-600">{row.village}</td>
                        <td className="p-2.5 font-mono text-slate-500">{row.aadharNo || '-'}</td>
                        <td className="p-2.5 text-center font-mono text-slate-700">{row.landAcres}</td>
                        <td className="p-2.5 text-right font-mono text-slate-700">{formatINR(row.creditLimit)}</td>
                        <td className="p-2.5 text-right font-mono font-bold text-amber-700">{formatINR(row.openingBalance)}</td>
                      </>
                    )}

                    {activeTab === 'suppliers' && (
                      <>
                        <td className="p-2.5 font-mono text-slate-600">{row.supplierCode}</td>
                        <td className="p-2.5 font-bold text-slate-800">{row.name}</td>
                        <td className="p-2.5 text-slate-600">{row.contactPerson || '-'}</td>
                        <td className="p-2.5 font-mono text-slate-700">{row.mobile}</td>
                        <td className="p-2.5 font-mono text-slate-600">{row.gstin || '-'}</td>
                        <td className="p-2.5 text-slate-600">{row.city}</td>
                        <td className="p-2.5 text-right font-mono text-slate-700">{formatINR(row.creditLimit)}</td>
                        <td className="p-2.5 text-right font-mono font-bold text-amber-700">{formatINR(row.openingBalance)}</td>
                      </>
                    )}

                    {activeTab === 'sales' && (
                      <>
                        <td className="p-2.5 font-mono text-slate-700 font-bold">{row.invoiceNo}</td>
                        <td className="p-2.5 font-mono text-slate-600">{row.date}</td>
                        <td className="p-2.5 font-bold text-slate-800">{row.customerName}</td>
                        <td className="p-2.5 font-mono text-slate-600">{row.mobile || '-'}</td>
                        <td className="p-2.5 font-medium text-slate-800">{row.product}</td>
                        <td className="p-2.5 text-center font-mono text-slate-800">{row.qty}</td>
                        <td className="p-2.5 text-right font-mono font-bold text-emerald-700">{formatINR(row.unitPrice)}</td>
                        <td className="p-2.5 text-center">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            row.paymentMode === 'Cash' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                          }`}>
                            {row.paymentMode}
                          </span>
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
