import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Printer, X, Download, Share2, Check, FileText, FileCheck, Receipt } from 'lucide-react';
import { Sale, BusinessSettings, InvoiceSettings, AppLanguage } from '../../types';
import { formatINR, formatDate, numberToWords } from '../../utils/formatters';

interface PrintInvoiceModalProps {
  sale: Sale | null;
  businessSettings: BusinessSettings;
  invoiceSettings: InvoiceSettings;
  onClose: () => void;
  currentLang?: AppLanguage;
}

export const PrintInvoiceModal: React.FC<PrintInvoiceModalProps> = ({
  sale,
  businessSettings,
  invoiceSettings,
  onClose,
  currentLang = 'en',
}) => {
  const [printFormat, setPrintFormat] = useState<'A4' | 'Thermal'>(
    invoiceSettings.print_format === 'A4' ? 'A4' : 'Thermal'
  );
  const [copyType, setCopyType] = useState<'ORIGINAL' | 'DUPLICATE' | 'TRIPLICATE'>('ORIGINAL');
  const [copied, setCopied] = useState(false);

  // Initialize GST mode based on sale record or tax amounts
  const [isGstBill, setIsGstBill] = useState<boolean>(() => {
    if (!sale) return true;
    if (sale.is_gst_bill !== undefined && sale.is_gst_bill !== null) {
      return Boolean(sale.is_gst_bill);
    }
    return ((sale.total_tax || 0) > 0 || (sale.cgst_amount || 0) + (sale.sgst_amount || 0) > 0);
  });

  useEffect(() => {
    if (!sale) return;
    if (sale.is_gst_bill !== undefined && sale.is_gst_bill !== null) {
      setIsGstBill(Boolean(sale.is_gst_bill));
    } else {
      setIsGstBill(((sale.total_tax || 0) > 0 || (sale.cgst_amount || 0) + (sale.sgst_amount || 0) > 0));
    }
  }, [sale]);

  useEffect(() => {
    document.body.classList.add('invoice-modal-open');
    if (printFormat === 'Thermal') {
      document.body.classList.add('thermal-print-mode');
    } else {
      document.body.classList.remove('thermal-print-mode');
    }
    return () => {
      document.body.classList.remove('invoice-modal-open');
      document.body.classList.remove('thermal-print-mode');
    };
  }, [printFormat]);

  if (!sale) return null;

  const isMr = currentLang === 'mr';

  const handlePrint = () => {
    const oldTitle = document.title;
    const cleanShop = (businessSettings.shop_name || 'Krushi-Seva').replace(/\s+/g, '-');
    const docType = isGstBill ? 'TaxInvoice' : 'BillOfSupply';
    document.title = `${cleanShop}-${docType}-${sale.doc_no || sale.invoice_no}`;
    window.print();
    setTimeout(() => {
      document.title = oldTitle;
    }, 1000);
  };

  const handleShareWhatsApp = () => {
    const billTypeStr = isGstBill 
      ? (isMr ? 'कर विक्री पावती' : 'Tax Invoice')
      : (isMr ? 'साधे बिल / विक्री पावती' : 'Bill of Supply');

    const text = `*${isMr && businessSettings.shop_name_mr ? businessSettings.shop_name_mr : businessSettings.shop_name}*\n` +
      `*${billTypeStr}*\n` +
      `${isMr ? 'बिल क्र' : 'Invoice No'}: ${sale.doc_no || sale.invoice_no}\n` +
      `${isMr ? 'दिनांक' : 'Date'}: ${formatDate(sale.doc_date || sale.invoice_date)}\n` +
      `${isMr ? 'ग्राहक' : 'Customer'}: ${sale.customer_name} (${sale.customer_village || ''})\n` +
      `${isMr ? 'एकूण रक्कम' : 'Total'}: ${formatINR(sale.grand_total)}\n` +
      `${isMr ? 'दिलेली रक्कम' : 'Paid'}: ${formatINR(sale.paid_amount)}\n` +
      `${isMr ? 'शिल्लक उधारी' : 'Credit Due'}: ${formatINR(sale.credit_amount)}\n` +
      `${isMr ? 'भेट दिल्याबद्दल धन्यवाद!' : 'Thank you for your business!'}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  // Group items by GST rate for HSN/Tax breakdown (GST mode only)
  const taxSummaryMap: Record<number, { taxable: number; cgst: number; sgst: number; totalTax: number }> = {};
  if (isGstBill) {
    sale.items?.forEach((item) => {
      const rate = item.gst_rate || 0;
      const taxable = item.taxable_amount || (item.total_amount - (item.cgst_amount + item.sgst_amount));
      if (!taxSummaryMap[rate]) {
        taxSummaryMap[rate] = { taxable: 0, cgst: 0, sgst: 0, totalTax: 0 };
      }
      taxSummaryMap[rate].taxable += taxable;
      taxSummaryMap[rate].cgst += (item.cgst_amount || 0);
      taxSummaryMap[rate].sgst += (item.sgst_amount || 0);
      taxSummaryMap[rate].totalTax += ((item.cgst_amount || 0) + (item.sgst_amount || 0));
    });
  }

  const prevBalance = sale.customer_prev_balance || sale.previous_balance || 0;
  const totalAccountDue = prevBalance + sale.grand_total;
  const remainingAccountDue = prevBalance + sale.credit_amount;

  return createPortal(
    <div 
      id="invoice-modal-portal" 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-2 sm:p-4 overflow-y-auto"
    >
      <div className="modal-card bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-5xl max-h-[96vh] flex flex-col overflow-hidden">
        {/* Header with Print Controls (Excluded from print) */}
        <div className="px-5 py-3.5 bg-slate-900 text-white flex flex-wrap items-center justify-between gap-3 no-print shrink-0">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-emerald-400" />
            <h2 className="text-sm font-bold">
              {isGstBill 
                ? (isMr ? 'कर पावती पूर्वदृश्य' : 'Tax Invoice Print Preview')
                : (isMr ? 'साधे बिल पूर्वदृश्य' : 'Bill of Supply Print Preview')} — {sale.doc_no || sale.invoice_no}
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* GST / Retail Bill Selector */}
            <div className="flex bg-slate-800 p-0.5 rounded-lg text-xs border border-slate-700">
              <button
                type="button"
                onClick={() => setIsGstBill(true)}
                className={`px-2.5 py-1 rounded-md font-semibold flex items-center gap-1 transition-colors cursor-pointer ${
                  isGstBill ? 'bg-emerald-600 text-white' : 'text-slate-300 hover:text-white'
                }`}
                title={isMr ? 'जीएसटी कर बीजक' : 'GST Tax Invoice'}
              >
                <FileCheck className="w-3.5 h-3.5" />
                <span>{isMr ? 'GST बिल' : 'GST Bill'}</span>
              </button>
              <button
                type="button"
                onClick={() => setIsGstBill(false)}
                className={`px-2.5 py-1 rounded-md font-semibold flex items-center gap-1 transition-colors cursor-pointer ${
                  !isGstBill ? 'bg-emerald-700 text-white' : 'text-slate-300 hover:text-white'
                }`}
                title={isMr ? 'किरकोळ विक्री पावती' : 'Retail Bill'}
              >
                <Receipt className="w-3.5 h-3.5" />
                <span>{isMr ? 'किरकोळ बिल' : 'Retail Bill'}</span>
              </button>
            </div>

            {/* Print Format Selector */}
            <div className="flex bg-slate-800 p-0.5 rounded-lg text-xs border border-slate-700">
              <button
                type="button"
                onClick={() => setPrintFormat('A4')}
                className={`px-3 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                  printFormat === 'A4' ? 'bg-emerald-600 text-white' : 'text-slate-300 hover:text-white'
                }`}
              >
                {isMr ? 'A4 प्रमाणित बिल' : 'A4 Statutory Invoice'}
              </button>
              <button
                type="button"
                onClick={() => setPrintFormat('Thermal')}
                className={`px-3 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                  printFormat === 'Thermal' ? 'bg-emerald-600 text-white' : 'text-slate-300 hover:text-white'
                }`}
              >
                {isMr ? 'थर्मल पावती' : 'Thermal Receipt'}
              </button>
            </div>

            {/* Copy Type Selector */}
            {printFormat === 'A4' && (
              <div className="flex bg-slate-800 p-0.5 rounded-lg text-xs border border-slate-700">
                <button
                  type="button"
                  onClick={() => setCopyType('ORIGINAL')}
                  className={`px-2.5 py-1 rounded-md font-medium cursor-pointer ${
                    copyType === 'ORIGINAL' ? 'bg-emerald-700 text-white' : 'text-slate-300'
                  }`}
                >
                  {isMr ? 'मूळ प्रत' : 'Original'}
                </button>
                <button
                  type="button"
                  onClick={() => setCopyType('DUPLICATE')}
                  className={`px-2.5 py-1 rounded-md font-medium cursor-pointer ${
                    copyType === 'DUPLICATE' ? 'bg-emerald-700 text-white' : 'text-slate-300'
                  }`}
                >
                  {isMr ? 'वाहतूक प्रत' : 'Transporter'}
                </button>
                <button
                  type="button"
                  onClick={() => setCopyType('TRIPLICATE')}
                  className={`px-2.5 py-1 rounded-md font-medium cursor-pointer ${
                    copyType === 'TRIPLICATE' ? 'bg-emerald-700 text-white' : 'text-slate-300'
                  }`}
                >
                  {isMr ? 'कार्यालय प्रत' : 'Supplier'}
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={handleShareWhatsApp}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-emerald-300 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Share2 className="w-3.5 h-3.5" />}
              <span>{copied ? (isMr ? 'कॉपी केले!' : 'Copied!') : (isMr ? 'शेअर' : 'Share')}</span>
            </button>

            <button
              type="button"
              onClick={handlePrint}
              className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
              title={isMr ? 'पीडीएफ म्हणून सेव्ह करा / डाऊनलोड करा' : 'Save as PDF / Download'}
            >
              <Download className="w-4 h-4" />
              <span>{isMr ? 'PDF सेव्ह करा' : 'Save PDF'}</span>
            </button>

            <button
              type="button"
              onClick={handlePrint}
              className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>{isMr ? 'प्रिंट करा' : 'Print Invoice'}</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer ml-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Area */}
        <div className="modal-scroll-area flex-1 overflow-y-auto p-4 md:p-6 bg-slate-100 flex justify-center">
          {printFormat === 'A4' ? (
            /* =================== A4 STATUTORY INVOICE (DOCUMENT 1 COMPLIANT) =================== */
            <div 
              id="invoice-print-container"
              className="bg-white text-slate-900 w-full max-w-[840px] p-6 shadow-sm border border-slate-400 rounded-sm font-sans text-xs min-h-[950px] flex flex-col justify-between print:p-0 print:border-none print:shadow-none"
            >
              <div>
                {/* 1. Top Jurisdiction Bar */}
                <div className="flex justify-between items-center text-[10px] text-slate-700 border-b border-slate-300 pb-1 mb-1 font-medium">
                  <div>
                    Subject to <strong className="uppercase">'{businessSettings.jurisdiction_city || businessSettings.taluka || 'Local'}'</strong> Jurisdiction Only. E.&.O.E.
                  </div>
                  <div className="font-bold tracking-wider uppercase text-emerald-900">
                    {copyType === 'ORIGINAL' && (isMr ? 'मूळ प्रत (खरेदीदारासाठी)' : 'ORIGINAL FOR BUYER')}
                    {copyType === 'DUPLICATE' && (isMr ? 'दुय्यम प्रत (वाहतुकीसाठी)' : 'DUPLICATE FOR TRANSPORTER')}
                    {copyType === 'TRIPLICATE' && (isMr ? 'तृतीय प्रत (विक्रेत्यासाठी)' : 'TRIPLICATE FOR SUPPLIER')}
                  </div>
                </div>

                {/* 2. Three-Column Header (Licences | Shop Identity | Contact & GST) */}
                <div className="border border-slate-400 rounded-xs p-2.5 mb-2 grid grid-cols-12 gap-2 text-slate-800 bg-slate-50/40">
                  {/* Left: Statutory Licences */}
                  <div className="col-span-3 text-[10px] space-y-0.5 border-r border-slate-300 pr-2">
                    <div className="font-semibold text-slate-500 uppercase text-[9px] mb-1">
                      {isMr ? 'कायदेशीर परवाने' : 'Statutory Licences'}
                    </div>
                    <div><span className="font-bold">COT Lic:</span> {businessSettings.cot_licence || '-'}</div>
                    <div><span className="font-bold">Pest Lic:</span> {businessSettings.pesticide_licence || '-'}</div>
                    <div><span className="font-bold">Seed Lic:</span> {businessSettings.seed_licence || '-'}</div>
                    <div><span className="font-bold">Fert Lic(R):</span> {businessSettings.fert_licence_r || businessSettings.fertilizer_licence || '-'}</div>
                  </div>

                  {/* Center: Shop Name, Logo & Address */}
                  <div className="col-span-6 flex flex-col items-center justify-center text-center px-1">
                    <div className="flex items-center justify-center gap-2.5 mb-1">
                      <img 
                        src={businessSettings.logo_url || '/icon.png'} 
                        alt="Logo" 
                        className="w-11 h-11 object-contain rounded-full shadow-2xs border border-emerald-600/30 shrink-0"
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = 'none';
                        }}
                      />
                      <div className="text-center">
                        <h1 className="text-xl font-black text-emerald-950 uppercase tracking-tight leading-tight">
                          {isMr && businessSettings.shop_name_mr ? businessSettings.shop_name_mr : businessSettings.shop_name}
                        </h1>
                        {businessSettings.shop_name_mr && (
                          <h2 className="text-xs font-bold text-slate-700 tracking-wide mt-0.5">
                            {businessSettings.shop_name}
                          </h2>
                        )}
                      </div>
                    </div>
                    <p className="text-[11px] text-slate-700 mt-0.5 leading-snug">
                      {businessSettings.address}, {businessSettings.village_city}, {isMr ? 'ता.' : 'Tal.'} {businessSettings.taluka || businessSettings.village_city}, {isMr ? 'जि.' : 'Dist.'} {businessSettings.district} - {businessSettings.pincode}
                    </p>
                    <p className="text-[10px] text-slate-600 font-medium">
                      {businessSettings.state}
                    </p>
                  </div>

                  {/* Right: Owner, Mobile, GSTIN (GSTIN shown only in GST mode) */}
                  <div className="col-span-3 text-right text-[10px] space-y-0.5 border-l border-slate-300 pl-2">
                    <div className="font-semibold text-slate-500 uppercase text-[9px] mb-1">
                      {isMr ? 'संपर्क माहिती' : 'Dealer Info'}
                    </div>
                    <div className="font-bold text-slate-900 truncate">
                      {businessSettings.proprietor || businessSettings.owner_name}
                    </div>
                    {businessSettings.partner_name && (
                      <div className="text-[9.5px] text-slate-600 truncate">
                        {businessSettings.partner_name}
                      </div>
                    )}
                    <div><span className="font-bold">Mob:</span> {businessSettings.mobile}</div>
                    {businessSettings.mobile_secondary && (
                      <div><span className="font-bold">Mob 2:</span> {businessSettings.mobile_secondary}</div>
                    )}
                    {isGstBill && businessSettings.gstin && (
                      <div className="font-mono font-bold text-emerald-900 text-[10.5px] mt-1 pt-0.5 border-t border-slate-200">
                        GST: {businessSettings.gstin}
                      </div>
                    )}
                  </div>
                </div>

                {/* 3. Invoice Title Banner (Tax Invoice vs Bill of Supply) */}
                <div className={`text-white text-center py-1 font-black text-xs tracking-widest uppercase mb-2 rounded-2xs flex justify-between px-4 items-center ${
                  isGstBill ? 'bg-emerald-950' : 'bg-slate-900'
                }`}>
                  <span>॥ श्री स्वामी समर्थ ॥</span>
                  <span>
                    {isGstBill 
                      ? (isMr ? 'कर विक्री पावती / TAX INVOICE' : 'TAX INVOICE') 
                      : (isMr ? 'किरकोळ विक्री पावती / RETAIL INVOICE' : 'RETAIL INVOICE')}
                  </span>
                  <span>{sale.payment_mode === 'Credit' ? (isMr ? 'उधारी पावती' : 'CREDIT') : (isMr ? 'रोख पावती' : 'CASH')}</span>
                </div>

                {/* 4. Customer Details & Invoice Metadata */}
                <div className="border border-slate-400 rounded-xs p-2.5 mb-2 grid grid-cols-12 gap-2 text-[11px] bg-slate-50/20">
                  {/* Left: Customer Info */}
                  <div className="col-span-7 space-y-0.5 border-r border-slate-300 pr-3">
                    <div className="flex">
                      <span className="w-24 text-slate-500 font-bold">{isMr ? 'ग्राहकाचे नाव:' : 'Customer Name:'}</span>
                      <span className="font-bold text-slate-900 text-xs">{sale.customer_name}</span>
                    </div>
                    <div className="flex">
                      <span className="w-24 text-slate-500 font-bold">{isMr ? 'पत्ता / गाव:' : 'At Post / Village:'}</span>
                      <span className="text-slate-800">{sale.customer_village || '-'}</span>
                    </div>
                    <div className="flex">
                      <span className="w-24 text-slate-500 font-bold">{isMr ? 'तालुका / जिल्हा:' : 'Taluka / Dist:'}</span>
                      <span className="text-slate-800">
                        {[sale.customer_taluka || businessSettings.taluka, businessSettings.district].filter(Boolean).join(', ') || '-'}
                      </span>
                    </div>
                    <div className="flex">
                      <span className="w-24 text-slate-500 font-bold">{isMr ? 'मोबाईल नंबर:' : 'Mobile No:'}</span>
                      <span className="font-mono font-semibold text-slate-900">{sale.customer_mobile || '-'}</span>
                    </div>
                  </div>

                  {/* Right: Bill Info */}
                  <div className="col-span-5 space-y-0.5 pl-2">
                    <div className="flex justify-between">
                      <span className="text-slate-500 font-bold">{isMr ? 'बिल / पावती क्र:' : 'Doc No:'}</span>
                      <span className="font-mono font-bold text-slate-900">{sale.doc_no || sale.invoice_no}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500 font-bold">{isMr ? 'दिनांक:' : 'Doc Date:'}</span>
                      <span className="font-mono font-semibold text-slate-900">{formatDate(sale.doc_date || sale.invoice_date)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500 font-bold">{isMr ? 'पेमेंट प्रकार:' : 'Payment Mode:'}</span>
                      <span className="font-bold text-emerald-800">{sale.payment_mode}</span>
                    </div>
                    <div className="flex justify-between text-[10px]">
                      <span className="text-slate-500">{isMr ? 'आधार / गाडी क्र:' : 'Aadhaar / Vehicle:'}</span>
                      <span className="font-mono text-slate-700">{sale.customer_aadhar || sale.aadhaar_no || sale.vehicle_no || '-'}</span>
                    </div>
                  </div>
                </div>

                {/* 5. Itemized Table (GST Columns shown ONLY in GST Mode) */}
                <table className="w-full border-collapse border border-slate-400 text-[10px] mb-2">
                  <thead>
                    <tr className="bg-slate-100 text-slate-900 border-b border-slate-400 font-bold">
                      <th className="border border-slate-400 px-1.5 py-1 text-center w-7">#</th>
                      <th className="border border-slate-400 px-2 py-1 text-left">{isMr ? 'तपशील / उत्पादन नाव' : 'Particulars & Chemical Content'}</th>
                      <th className="border border-slate-400 px-1.5 py-1 text-left w-24">{isMr ? 'कंपनी / Mfg' : 'Mfg / Company'}</th>
                      <th className="border border-slate-400 px-1 py-1 text-center w-14">HSN</th>
                      <th className="border border-slate-400 px-1 py-1 text-center w-16">{isMr ? 'बॅच क्र.' : 'Batch No'}</th>
                      <th className="border border-slate-400 px-1 py-1 text-center w-14">{isMr ? 'मुदत' : 'Expiry'}</th>
                      <th className="border border-slate-400 px-1 py-1 text-center w-12">{isMr ? 'नग' : 'Qty'}</th>
                      <th className="border border-slate-400 px-1 py-1 text-right w-16">{isMr ? 'दर (₹)' : 'Rate'}</th>
                      {isGstBill ? (
                        <>
                          <th className="border border-slate-400 px-1 py-1 text-right w-16">{isMr ? 'करपात्र (₹)' : 'Taxable'}</th>
                          <th className="border border-slate-400 px-1 py-1 text-center w-10">GST%</th>
                        </>
                      ) : (
                        <th className="border border-slate-400 px-1 py-1 text-right w-14">{isMr ? 'सूट (%)' : 'Disc'}</th>
                      )}
                      <th className="border border-slate-400 px-1.5 py-1 text-right w-20">{isMr ? 'एकूण रक्कम' : 'Total (₹)'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sale.items?.map((item, idx) => (
                      <tr key={idx} className="border-b border-slate-300">
                        <td className="border border-slate-400 px-1.5 py-1 text-center font-mono">{idx + 1}</td>
                        <td className="border border-slate-400 px-2 py-1 font-semibold text-slate-900">
                          <div>
                            {item.product_name} {item.pack_size ? `(${item.pack_size})` : ''}
                          </div>
                          {(item.chemical_content || item.content || item.technical_name) && (
                            <div className="text-[9px] text-slate-500 font-normal">
                              {item.chemical_content || item.content || item.technical_name}
                            </div>
                          )}
                        </td>
                        <td className="border border-slate-400 px-1.5 py-1 text-slate-700 truncate font-medium">
                          {item.manufacturer_name || item.company_name || item.company || item.mfg || '-'}
                        </td>
                        <td className="border border-slate-400 px-1 py-1 text-center font-mono text-[9.5px] text-slate-600">
                          {item.hsn_code || '-'}
                        </td>
                        <td className="border border-slate-400 px-1 py-1 text-center font-mono text-[9.5px] font-bold">
                          {item.batch_number || '-'}
                        </td>
                        <td className="border border-slate-400 px-1 py-1 text-center text-[9px] text-slate-600">
                          {formatDate(item.expiry_date) || '-'}
                        </td>
                        <td className="border border-slate-400 px-1 py-1 text-center font-bold font-mono">
                          {item.quantity} {item.unit}
                        </td>
                        <td className="border border-slate-400 px-1 py-1 text-right font-mono">
                          {item.rate.toFixed(2)}
                        </td>
                        {isGstBill ? (
                          <>
                            <td className="border border-slate-400 px-1 py-1 text-right font-mono">
                              {(item.taxable_amount || (item.total_amount - ((item.cgst_amount || 0) + (item.sgst_amount || 0)))).toFixed(2)}
                            </td>
                            <td className="border border-slate-400 px-1 py-1 text-center font-mono text-[9.5px]">
                              {item.gst_rate}%
                            </td>
                          </>
                        ) : (
                          <td className="border border-slate-400 px-1 py-1 text-right font-mono text-slate-600">
                            {item.discount_percent ? `${item.discount_percent}%` : '-'}
                          </td>
                        )}
                        <td className="border border-slate-400 px-1.5 py-1 text-right font-mono font-bold text-slate-900">
                          {item.total_amount.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-slate-50 font-bold border-t border-slate-400">
                    <tr>
                      <td colSpan={6} className="border border-slate-400 px-2 py-1 text-right uppercase">
                        {isMr ? 'एकूण नगसंख्या:' : 'Total Qty:'}
                      </td>
                      <td className="border border-slate-400 px-1 py-1 text-center font-mono font-bold">
                        {sale.items?.reduce((s, it) => s + it.quantity, 0)}
                      </td>
                      {isGstBill ? (
                        <>
                          <td colSpan={3} className="border border-slate-400 px-2 py-1 text-right uppercase">
                            {isMr ? 'करपात्र एकूण:' : 'Taxable Total:'}
                          </td>
                          <td className="border border-slate-400 px-1.5 py-1 text-right font-mono text-slate-900">
                            {formatINR(sale.taxable_amount)}
                          </td>
                        </>
                      ) : (
                        <>
                          <td colSpan={2} className="border border-slate-400 px-2 py-1 text-right uppercase">
                            {isMr ? 'निव्वळ एकूण रक्कम:' : 'Net Total:'}
                          </td>
                          <td className="border border-slate-400 px-1.5 py-1 text-right font-mono text-slate-900">
                            {formatINR(sale.grand_total)}
                          </td>
                        </>
                      )}
                    </tr>
                  </tfoot>
                </table>

                {/* 6. Tax Summary (GST mode) OR Bill Details (Non-GST mode) + Complete Financial Breakdown */}
                <div className="grid grid-cols-12 gap-2 text-[10px] mb-2">
                  {/* Left Column */}
                  <div className="col-span-6 border border-slate-400 p-2 rounded-xs bg-slate-50/40 flex flex-col justify-between">
                    {isGstBill ? (
                      /* GST Tax Split Table */
                      <div>
                        <div className="font-bold text-slate-800 mb-1 uppercase text-[9px] border-b border-slate-300 pb-0.5">
                          {isMr ? 'जीएसटी कर विभाजन विवरण (GST Tax Summary)' : 'GST Tax Summary'}
                        </div>
                        <table className="w-full text-center border-collapse">
                          <thead>
                            <tr className="border-b border-slate-300 font-semibold text-slate-600">
                              <th className="py-0.5 text-left">GST%</th>
                              <th className="py-0.5 text-right">{isMr ? 'करपात्र' : 'Taxable'}</th>
                              <th className="py-0.5 text-right">CGST</th>
                              <th className="py-0.5 text-right">SGST</th>
                              <th className="py-0.5 text-right">{isMr ? 'एकूण कर' : 'Total Tax'}</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200 font-mono text-[9.5px]">
                            {Object.entries(taxSummaryMap).map(([rate, v]) => (
                              <tr key={rate}>
                                <td className="py-0.5 text-left font-bold">{rate}%</td>
                                <td className="py-0.5 text-right">{v.taxable.toFixed(2)}</td>
                                <td className="py-0.5 text-right">{v.cgst.toFixed(2)}</td>
                                <td className="py-0.5 text-right">{v.sgst.toFixed(2)}</td>
                                <td className="py-0.5 text-right font-bold">{v.totalTax.toFixed(2)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      /* Retail Sales Memo Info Box */
                      <div>
                        <div className="font-bold text-slate-800 mb-1 uppercase text-[9px] border-b border-slate-300 pb-0.5">
                          <span>{isMr ? 'किरकोळ विक्री पावती तपशील' : 'Retail Sales Memo Details'}</span>
                        </div>
                        <p className="text-[10px] text-slate-700 leading-snug">
                          {isMr 
                            ? 'अधिकृत कृषी निविष्ठा किरकोळ विक्री पावती.' 
                            : 'Official agricultural inputs retail sales memo.'}
                        </p>
                      </div>
                    )}

                    {/* Amount in words & Bank Details */}
                    <div>
                      {/* Amount in words */}
                      <div className="mt-2 pt-1 border-t border-slate-300 text-[10px]">
                        <span className="font-bold text-slate-800">{isMr ? 'अक्षरी रक्कम: ' : 'Amount in Words: '}</span>
                        <span className="font-medium text-emerald-950 italic">{numberToWords(sale.grand_total)}</span>
                      </div>

                      {/* Bank Details */}
                      {businessSettings.bank_account_no && (
                        <div className="mt-1.5 p-1.5 rounded bg-emerald-50 border border-emerald-200 text-[9.5px] text-slate-800">
                          <span className="font-bold text-emerald-950">{isMr ? 'बँक माहिती: ' : 'Bank: '}</span>
                          {businessSettings.bank_name}, A/C: {businessSettings.bank_account_no}, IFSC: {businessSettings.bank_ifsc}
                          {businessSettings.upi_id ? ` • UPI: ${businessSettings.upi_id}` : ''}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right: Complete Account Balance Ledger */}
                  <div className="col-span-6 border border-slate-400 p-2 rounded-xs bg-slate-50/40 space-y-1">
                    <div className="font-bold text-slate-800 mb-1 uppercase text-[9px] border-b border-slate-300 pb-0.5">
                      {isMr ? 'खाते हिशेब व बाकी सारांश (Account Ledger)' : 'Payment & Account Balance'}
                    </div>

                    <div className="flex justify-between text-slate-700">
                      <span>{isMr ? 'मागील शिल्लक बाकी (Prev Balance):' : 'Previous Due Balance:'}</span>
                      <span className="font-mono font-semibold">{formatINR(prevBalance)}</span>
                    </div>

                    <div className="flex justify-between text-slate-900 font-bold">
                      <span>{isMr ? 'चालू बिल रक्कम (Current Bill):' : 'Current Bill Total:'}</span>
                      <span className="font-mono text-emerald-900">{formatINR(sale.grand_total)}</span>
                    </div>

                    <div className="flex justify-between border-t border-slate-300 pt-0.5 text-slate-800 font-bold">
                      <span>{isMr ? 'एकूण देय रक्कम (Total Payable):' : 'Total Payable Due:'}</span>
                      <span className="font-mono">{formatINR(totalAccountDue)}</span>
                    </div>

                    <div className="flex justify-between text-emerald-800 font-bold border-t border-slate-300 pt-0.5">
                      <span>{isMr ? 'चालू जमा रक्कम (Received):' : 'Amount Received:'}</span>
                      <span className="font-mono">{formatINR(sale.paid_amount)}</span>
                    </div>

                    <div className="flex justify-between text-rose-800 font-black border-t-2 border-slate-400 pt-0.5 text-xs">
                      <span>{isMr ? 'अखेर शिल्लक बाकी (Net Remaining Due):' : 'Net Remaining Balance:'}</span>
                      <span className="font-mono">{formatINR(remainingAccountDue)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* 7. Statutory Declarations & Signatures */}
              <div className="pt-2 border-t-2 border-slate-400">
                <div className="grid grid-cols-12 gap-3 items-end">
                  {/* Left: 5 Statutory Agricultural Notices */}
                  <div className="col-span-8 text-[9px] text-slate-700 leading-tight space-y-0.5 border border-slate-300 p-2 rounded-2xs bg-slate-50/50">
                    <div className="font-bold text-slate-900 uppercase mb-0.5">
                      {isMr ? 'वैधानिक नियम व अटी:' : 'Statutory Terms & Conditions:'}
                    </div>
                    <p>1. {isMr ? 'विषारी औषधाने प्रक्रिया केलेले बियाणे, खाण्यासाठी, तेलासाठी किंवा पशु खाद्यासाठी वापरू नये.' : 'Seeds treated with poisonous chemicals must not be used for food, oil, or animal feed.'}</p>
                    <p>2. {isMr ? 'पेरणीपूर्वी उगवण शक्तीची चाचणी करून घ्यावी. सुयोग्य बुरशी नाशकाने बियाणे प्रक्रिया करावी.' : 'Check germination percentage before sowing and treat with recommended fungicide.'}</p>
                    <p>3. {isMr ? 'कीटकनाशके वापरण्यापूर्वी लेबल व माहिती वाचून खबरदारीच्या सर्व सूचनांचे पालन करावे.' : 'Read product leaflet/label thoroughly and follow all statutory safety precautions for pesticides.'}</p>
                    <p>4. {isMr ? 'फक्त शेती उपयोगीसाठी.' : 'For agricultural use only.'}</p>
                    <p>5. Subject to <strong className="uppercase">'{businessSettings.jurisdiction_city || businessSettings.taluka || 'Local'}'</strong> Jurisdiction Only. E.&.O.E.</p>
                  </div>

                  {/* Right: Signatures */}
                  <div className="col-span-4 flex flex-col justify-between h-full pl-2">
                    <div className="text-center pt-8">
                      <div className="border-t border-slate-400 pt-1 text-[10px] text-slate-700">
                        {isMr ? 'ग्राहकाची स्वाक्षरी' : 'Customer Signature'}
                      </div>
                    </div>

                    <div className="text-center pt-6">
                      <div className="text-[9.5px] font-bold text-slate-900 truncate">
                        {isMr ? 'करिता: ' : 'For: '}{isMr && businessSettings.shop_name_mr ? businessSettings.shop_name_mr : businessSettings.shop_name}
                      </div>
                      <div className="border-t border-slate-400 pt-1 text-[10px] font-bold text-slate-800">
                        {isMr ? 'अधिकृत स्वाक्षरी' : 'Authorized Signatory'}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="text-center text-[9px] text-slate-500 pt-2 border-t border-slate-200 mt-2">
                  {invoiceSettings.footer_message || (isMr ? 'आमच्याकडे दर्जेदार खते, बियाणे व कीटकनाशके खात्रीशीर मिळतील.' : 'Quality agricultural inputs guaranteed.')}
                </div>
              </div>
            </div>
          ) : (
            /* =================== THERMAL 80mm RECEIPT =================== */
            <div 
              id="invoice-print-container"
              className="bg-white text-black w-80 p-4 shadow-sm border border-slate-300 rounded-sm font-mono text-[11px] leading-tight"
            >
              <div className="text-center border-b border-dashed border-black pb-2 mb-2 flex flex-col items-center">
                <img 
                  src={businessSettings.logo_url || '/icon.png'} 
                  alt="Logo" 
                  className="w-9 h-9 object-contain rounded-full mb-1 border border-black/20"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                />
                <div className="font-bold text-sm tracking-tight">
                  {isMr && businessSettings.shop_name_mr ? businessSettings.shop_name_mr : businessSettings.shop_name}
                </div>
                <div className="text-[10px]">{businessSettings.address}</div>
                <div className="text-[10px]">{businessSettings.village_city}, {businessSettings.district}</div>
                <div className="text-[10px]">{isMr ? 'मोबाईल' : 'Mobile'}: {businessSettings.mobile}</div>
                {isGstBill && businessSettings.gstin && (
                  <div className="text-[9px] mt-1 font-bold">GSTIN: {businessSettings.gstin}</div>
                )}
                <div className="text-[10px] font-bold mt-1 uppercase border border-black/30 px-2 py-0.5 rounded">
                  {isGstBill ? (isMr ? 'कर विक्री पावती' : 'TAX INVOICE') : (isMr ? 'साधे बिल' : 'BILL OF SUPPLY')}
                </div>
              </div>

              <div className="border-b border-dashed border-black pb-2 mb-2 text-[10px]">
                <div>{isMr ? 'पावती क्र' : 'Doc No'}: {sale.doc_no || sale.invoice_no}</div>
                <div>{isMr ? 'दिनांक' : 'Date'}: {formatDate(sale.doc_date || sale.invoice_date)}</div>
                <div>{isMr ? 'ग्राहक' : 'Customer'}: {sale.customer_name} ({sale.customer_village || ''})</div>
                <div>{isMr ? 'पेमेंट' : 'Payment'}: {sale.payment_mode}</div>
              </div>

              {/* Items */}
              <div className="border-b border-dashed border-black pb-2 mb-2">
                <div className="grid grid-cols-12 font-bold border-b border-black pb-1 mb-1 text-[10px]">
                  <div className="col-span-6">{isMr ? 'उत्पादन' : 'Item'}</div>
                  <div className="col-span-2 text-center">{isMr ? 'नग' : 'Qty'}</div>
                  <div className="col-span-4 text-right">{isMr ? 'रक्कम' : 'Amount'}</div>
                </div>
                {sale.items?.map((item, idx) => (
                  <div key={idx} className="py-0.5 text-[10px]">
                    <div className="font-bold truncate">{item.product_name}</div>
                    <div className="grid grid-cols-12 text-slate-700">
                      <div className="col-span-6 text-[9px]">{isMr ? 'बॅच' : 'Batch'}: {item.batch_number}</div>
                      <div className="col-span-2 text-center">{item.quantity}</div>
                      <div className="col-span-4 text-right font-bold">{formatINR(item.total_amount)}</div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Totals */}
              <div className="border-b border-dashed border-black pb-2 mb-2 space-y-1 text-[10.5px]">
                <div className="flex justify-between">
                  <span>{isMr ? 'उपएकूण:' : 'Subtotal:'}</span>
                  <span>{formatINR(sale.subtotal)}</span>
                </div>
                {isGstBill && (sale.total_tax || 0) > 0 && (
                  <div className="flex justify-between text-slate-700">
                    <span>{isMr ? 'जीएसटी कर:' : 'Total GST:'}</span>
                    <span>{formatINR(sale.total_tax)}</span>
                  </div>
                )}
                {prevBalance > 0 && (
                  <div className="flex justify-between text-slate-700">
                    <span>{isMr ? 'मागील बाकी:' : 'Prev Due:'}</span>
                    <span>{formatINR(prevBalance)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-xs pt-1 border-t border-black">
                  <span>{isMr ? 'अंतिम एकूण:' : 'Grand Total:'}</span>
                  <span>{formatINR(sale.grand_total)}</span>
                </div>
                <div className="flex justify-between">
                  <span>{isMr ? 'जमा रक्कम:' : 'Paid:'}</span>
                  <span>{formatINR(sale.paid_amount)}</span>
                </div>
                {remainingAccountDue > 0 && (
                  <div className="flex justify-between font-bold text-rose-800">
                    <span>{isMr ? 'शिल्लक बाकी:' : 'Remaining Due:'}</span>
                    <span>{formatINR(remainingAccountDue)}</span>
                  </div>
                )}
              </div>

              <div className="text-center text-[9px] text-slate-700 pt-1">
                <div>{isMr ? 'धन्यवाद! पुन्हा भेट द्या.' : 'Thank you! Visit again.'}</div>
                <div>(Subject to {businessSettings.jurisdiction_city || 'Local'} Jurisdiction Only)</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};
