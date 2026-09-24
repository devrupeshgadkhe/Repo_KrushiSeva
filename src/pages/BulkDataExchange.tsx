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
  Info
} from 'lucide-react';
import { AppLanguage, ProductCategory } from '../types';
import { getTranslation } from '../i18n';
import { formatINR } from '../utils/formatters';
import { dbService } from '../services/api';
import { useFeedback } from '../components/common/FeedbackContext';

interface BulkDataExchangeProps {
  currentLang: AppLanguage;
  onRefreshData?: () => void;
}

type TabType = 'products' | 'farmers' | 'sales';

export const BulkDataExchange: React.FC<BulkDataExchangeProps> = ({ currentLang, onRefreshData }) => {
  const { showToast, showConfirm } = useFeedback();
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
      const exportData = products.map((p) => ({
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
        'Low Stock Alert': p.low_stock_alert,
        'Barcode': p.barcode || '',
        'Technical Name': p.technical_name || '',
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
        'Mobile': f.mobile,
        'Village': f.village || '',
        'Aadhar No': f.aadhar_no || '',
        '7/12 Land (Acres)': f.land_acreage || 0,
        'Credit Limit (Rs)': f.credit_limit || 0,
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
          'Brand / Company': 'RCF',
          'HSN Code': '3102',
          'Unit': 'Bags',
          'Pack Size': '45 Kg',
          'Purchase Rate (Rs)': 242,
          'MRP (Rs)': 266.50,
          'Selling Rate (Rs)': 266.50,
          'GST Rate (%)': 5,
          'Low Stock Alert': 20,
          'Barcode': '8901234567890',
          'Technical Name': 'Nitrogen 46% Prilled',
          'Opening Stock Qty': 100,
          'Opening Batch No': 'RC-9941',
          'Expiry Date (YYYY-MM-DD)': '2028-12-31',
        },
        {
          'Product Code': 'PRD-102',
          'Product Name': 'Mahyco Hybrid Cotton Seeds 7351',
          'Marathi / Local Name': 'माहिको बीटी कापूस बियाणे',
          'Category': 'Seeds',
          'Brand / Company': 'Mahyco',
          'HSN Code': '1209',
          'Unit': 'Packets',
          'Pack Size': '450 gm',
          'Purchase Rate (Rs)': 810,
          'MRP (Rs)': 864,
          'Selling Rate (Rs)': 864,
          'GST Rate (%)': 0,
          'Low Stock Alert': 15,
          'Barcode': '',
          'Technical Name': 'BG-II Cotton Hybrid Seed',
          'Opening Stock Qty': 50,
          'Opening Batch No': 'MC-4512',
          'Expiry Date (YYYY-MM-DD)': '2027-06-30',
        },
        {
          'Product Code': 'PRD-103',
          'Product Name': 'Coragen Insecticide',
          'Marathi / Local Name': 'कोराजन कीटकनाशक',
          'Category': 'Pesticides',
          'Brand / Company': 'FMC',
          'HSN Code': '3808',
          'Unit': 'Bottles',
          'Pack Size': '150 ml',
          'Purchase Rate (Rs)': 1680,
          'MRP (Rs)': 1950,
          'Selling Rate (Rs)': 1890,
          'GST Rate (%)': 18,
          'Low Stock Alert': 10,
          'Barcode': '',
          'Technical Name': 'Chlorantraniliprole 18.5% SC',
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
          'Farmer Name': 'Ramesh Baburao Patil',
          'Mobile': '9822112233',
          'Village': 'Sangvi',
          'Aadhar No': '4412-8874-9912',
          '7/12 Land (Acres)': 5.5,
          'Major Crops': 'Soybean, Cotton, Wheat',
          'Credit Limit (Rs)': 50000,
          'Opening Balance (Rs)': 4500,
        },
        {
          'Farmer Name': 'Ganesh Dnyaneshwar Shinde',
          'Mobile': '9890112244',
          'Village': 'Nimgaon',
          'Aadhar No': '',
          '7/12 Land (Acres)': 8.0,
          'Major Crops': 'Sugarcane, Onion',
          'Credit Limit (Rs)': 75000,
          'Opening Balance (Rs)': 0,
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
        const bstr = evt.target?.result;
        const workbook = XLSX.read(bstr, { type: 'binary', cellDates: true });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const rawJson: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

        if (!rawJson || rawJson.length === 0) {
          showToast(isMr ? 'निवडलेली एक्सेल फाईल रिकामी आहे.' : 'Selected Excel file contains no data rows.', 'warning');
          setParsedRows([]);
          return;
        }

        // Validate and standardize fields based on active tab
        const validated = rawJson.map((row, idx) => {
          if (activeTab === 'products') {
            const name = (row['Product Name'] || row['Name'] || row['नाव'] || row['उत्पादन नाव'] || '').toString().trim();
            const category = (row['Category'] || row['विभाग'] || 'Fertilizers').toString().trim();
            const purchaseRate = parseFloat(row['Purchase Rate (Rs)'] || row['Purchase Rate'] || row['खरेदी दर'] || 0) || 0;
            const sellingRate = parseFloat(row['Selling Rate (Rs)'] || row['Selling Rate'] || row['विक्री दर'] || 0) || 0;
            const mrp = parseFloat(row['MRP (Rs)'] || row['MRP'] || row['एमआरपी'] || sellingRate) || sellingRate;
            const unit = (row['Unit'] || row['एकक'] || 'Bags').toString().trim();
            const packSize = (row['Pack Size'] || row['पॅक साईज'] || '1').toString().trim();
            const openingStock = parseFloat(row['Opening Stock Qty'] || row['Opening Stock'] || row['आरंभी साठा'] || 0) || 0;
            const batchNo = (row['Opening Batch No'] || row['Batch No'] || row['बॅच'] || `OPN-${Math.floor(100 + Math.random() * 900)}`).toString().trim();
            const expiryDate = (row['Expiry Date (YYYY-MM-DD)'] || row['Expiry Date'] || '2028-12-31').toString().trim();

            const isValid = name.length > 0;
            return {
              _index: idx + 1,
              _isValid: isValid,
              _error: !isValid ? (isMr ? 'उत्पादनाचे नाव आवश्यक आहे' : 'Product name is missing') : '',
              productCode: (row['Product Code'] || row['Code'] || row['कोड'] || `PRD-${Math.floor(1000 + Math.random() * 9000)}`).toString().trim(),
              name,
              nameMr: (row['Marathi / Local Name'] || row['Local Name'] || row['नाव (मराठी)'] || name).toString().trim(),
              category,
              brand: (row['Brand / Company'] || row['Brand'] || row['Company'] || row['कंपनी'] || 'General').toString().trim(),
              hsnCode: (row['HSN Code'] || row['HSN'] || '0000').toString().trim(),
              unit,
              packSize,
              purchaseRate,
              mrp,
              sellingRate,
              gstRate: parseFloat(row['GST Rate (%)'] || row['GST %'] || row['GST'] || 0) || 0,
              lowStockAlert: parseFloat(row['Low Stock Alert'] || row['Min Stock'] || 10) || 10,
              barcode: (row['Barcode'] || '').toString().trim(),
              technicalName: (row['Technical Name'] || row['Technical'] || '').toString().trim(),
              openingStock,
              batchNo,
              expiryDate
            };
          } else if (activeTab === 'farmers') {
            const name = (row['Farmer Name'] || row['Name'] || row['शेतकरी नाव'] || row['नाव'] || '').toString().trim();
            const mobile = (row['Mobile'] || row['Phone'] || row['मोबाईल'] || '').toString().trim();
            const village = (row['Village'] || row['गाव'] || '').toString().trim();
            const isValid = name.length > 0 && mobile.length >= 8;

            return {
              _index: idx + 1,
              _isValid: isValid,
              _error: !isValid 
                ? (isMr ? 'नाव आणि वैध मोबाईल आवश्यक आहे' : 'Farmer name and valid mobile are required') 
                : '',
              name,
              mobile,
              village,
              aadharNo: (row['Aadhar No'] || row['Aadhar'] || row['आधार'] || '').toString().trim(),
              landAcres: parseFloat(row['7/12 Land (Acres)'] || row['Land'] || row['जमीन'] || 0) || 0,
              majorCrops: (row['Major Crops'] || row['Crops'] || row['पिके'] || 'Cotton, Soybean').toString().trim(),
              creditLimit: parseFloat(row['Credit Limit (Rs)'] || row['Credit Limit'] || row['मर्यादा'] || 50000) || 50000,
              openingBalance: parseFloat(row['Opening Balance (Rs)'] || row['Opening Balance'] || row['आरंभी बाकी'] || 0) || 0,
            };
          } else {
            // Sales import
            const invoiceNo = (row['Invoice No'] || row['Invoice'] || row['पावती क्र.'] || `INV-${Math.floor(1000 + Math.random() * 9000)}`).toString().trim();
            const customerName = (row['Customer Name'] || row['Farmer Name'] || row['ग्राहक नाव'] || 'Walk-in Customer').toString().trim();
            const mobile = (row['Customer Mobile'] || row['Mobile'] || '').toString().trim();
            const village = (row['Customer Village'] || row['Village'] || '').toString().trim();
            const product = (row['Product Code or Name'] || row['Product'] || row['उत्पादन'] || '').toString().trim();
            const qty = parseFloat(row['Quantity'] || row['Qty'] || row['नग'] || 1) || 1;
            const unitPrice = parseFloat(row['Unit Price (Rs)'] || row['Price'] || row['दर'] || 0) || 0;
            const gstRate = parseFloat(row['GST %'] || row['GST'] || 0) || 0;
            const paidAmount = parseFloat(row['Paid Amount (Rs)'] || row['Paid'] || 0) || 0;
            const isValid = product.length > 0 && unitPrice > 0;

            return {
              _index: idx + 1,
              _isValid: isValid,
              _error: !isValid ? (isMr ? 'उत्पादन आणि दर आवश्यक आहे' : 'Product name and price are required') : '',
              invoiceNo,
              date: (row['Date (YYYY-MM-DD)'] || row['Date'] || new Date().toISOString().slice(0, 10)).toString().trim(),
              customerName,
              mobile,
              village,
              paymentMode: (row['Payment Mode'] || row['Mode'] || 'Cash').toString().trim(),
              product,
              qty,
              unitPrice,
              discount: parseFloat(row['Discount (Rs)'] || row['Discount'] || 0) || 0,
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

    reader.readAsBinaryString(file);
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
            const productId = await dbService.saveProduct({
              product_code: row.productCode,
              name: row.name,
              name_mr: row.nameMr || row.name,
              brand: row.brand,
              company: row.brand,
              category: row.category as ProductCategory,
              hsn_code: row.hsnCode,
              unit: row.unit,
              pack_size: row.packSize,
              purchase_rate: row.purchaseRate,
              mrp: row.mrp,
              selling_rate: row.sellingRate,
              gst_rate: row.gstRate,
              low_stock_alert: row.lowStockAlert,
              barcode: row.barcode,
              technical_name: row.technicalName,
            });

            // If opening stock provided, create an opening batch
            if (row.openingStock > 0 && productId) {
              await dbService.createDefaultBatch(productId, {
                batch_number: row.batchNo || 'BULK-OPN',
                expiry_date: row.expiryDate || '2027-12-31',
                current_qty: row.openingStock,
                opening_qty: row.openingStock,
                purchase_rate: row.purchaseRate,
                mrp: row.mrp,
                selling_rate: row.sellingRate,
              });
            }
            success++;
          } catch (e: any) {
            skipped++;
            errors.push(`${row.name}: ${e.message}`);
          }
        }
      } else if (activeTab === 'farmers') {
        for (const row of validRows) {
          try {
            await dbService.saveCustomer({
              name: row.name,
              mobile: row.mobile,
              village: row.village,
              aadhar_no: row.aadharNo,
              land_acreage: row.landAcres,
              crops_grown: row.majorCrops,
              credit_limit: row.creditLimit,
              current_balance: row.openingBalance,
            });
            success++;
          } catch (e: any) {
            skipped++;
            errors.push(`${row.name}: ${e.message}`);
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

            // 1. Handle Customer: Match or create
            let customerId = 0;
            if (first.customerName && first.customerName.toLowerCase() !== 'walk-in customer') {
              const cust = existingCustomers.find(
                (c) => (first.mobile && c.mobile === first.mobile) || c.name.toLowerCase() === first.customerName.toLowerCase()
              );

              if (cust) {
                customerId = cust.id;
              } else {
                // Automatically create customer seamlessly
                const newCustId = await dbService.saveCustomer({
                  name: first.customerName,
                  mobile: first.mobile || `99000${Math.floor(10000 + Math.random() * 90000)}`,
                  village: first.village || 'Local',
                  credit_limit: 50000,
                  current_balance: 0,
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
              // Match product
              let prod = existingProducts.find(
                (p) => p.product_code === itemRow.product || p.name.toLowerCase() === itemRow.product.toLowerCase()
              );

              if (!prod) {
                // Auto create generic product if not found
                const newProdId = await dbService.saveProduct({
                  product_code: `PRD-${Math.floor(1000 + Math.random() * 9000)}`,
                  name: itemRow.product,
                  name_mr: itemRow.product,
                  brand: 'General',
                  category: 'Fertilizer',
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
                product_id: prod ? prod.id : 0,
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
            errors.push(`Invoice ${invNo}: ${e.message}`);
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
                  : (activeTab === 'farmers' ? handleExportFarmers : handleExportSales)
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
