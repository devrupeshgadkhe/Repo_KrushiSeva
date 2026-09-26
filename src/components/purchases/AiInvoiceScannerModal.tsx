import React, { useState, useRef } from 'react';
import { 
  X, 
  UploadCloud, 
  Sparkles, 
  FileText, 
  Image as ImageIcon, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  ArrowRight, 
  Building2, 
  Receipt, 
  RefreshCw,
  Eye,
  Check
} from 'lucide-react';
import { AppLanguage, Supplier, Product } from '../../types';
import { formatINR } from '../../utils/formatters';
import { aiInvoiceService, ScannedInvoiceData } from '../../services/aiInvoiceService';

interface AiInvoiceScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentLang: AppLanguage;
  suppliers: Supplier[];
  products: Product[];
  onApplyData: (scanned: ScannedInvoiceData) => void;
  onQuotaExceeded: () => void;
}

export const AiInvoiceScannerModal: React.FC<AiInvoiceScannerModalProps> = ({
  isOpen,
  onClose,
  currentLang,
  suppliers,
  products,
  onApplyData,
  onQuotaExceeded,
}) => {
  const isMr = currentLang === 'mr';
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreviewUrl, setFilePreviewUrl] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [scannedResult, setScannedResult] = useState<ScannedInvoiceData | null>(null);

  if (!isOpen) return null;

  const handleFileChange = (file: File) => {
    setError(null);
    setScannedResult(null);

    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg', 'application/pdf'];
    if (!validTypes.includes(file.type.toLowerCase())) {
      setError(
        isMr
          ? 'कृपया फक्त JPG, PNG, WEBP फोटो किंवा PDF फाईल निवडा.'
          : 'Please select only JPG, PNG, WEBP images or PDF files.'
      );
      return;
    }

    if (file.size > 25 * 1024 * 1024) {
      setError(
        isMr
          ? 'फाईल आकार खूप मोठा आहे (कमाल मर्यादा २५ MB).'
          : 'File size exceeds the 25 MB limit.'
      );
      return;
    }

    setSelectedFile(file);
    if (file.type.startsWith('image/')) {
      const url = URL.createObjectURL(file);
      setFilePreviewUrl(url);
    } else {
      setFilePreviewUrl(null);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileChange(e.dataTransfer.files[0]);
    }
  };

  const handleStartScan = async () => {
    if (!selectedFile) return;

    setLoading(true);
    setError(null);
    setLoadingStep(1);

    const stepInterval = setInterval(() => {
      setLoadingStep((prev) => (prev < 3 ? prev + 1 : prev));
    }, 1800);

    try {
      const reader = new FileReader();
      const base64Promise = new Promise<{ base64: string; mimeType: string }>((resolve, reject) => {
        reader.onload = () => {
          const res = reader.result as string;
          resolve({ base64: res, mimeType: selectedFile.type });
        };
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsDataURL(selectedFile);
      });

      const { base64, mimeType } = await base64Promise;
      const res = await aiInvoiceService.parseInvoice(base64, mimeType);

      clearInterval(stepInterval);

      if (res.quotaExceeded) {
        onQuotaExceeded();
        setError(
          isMr
            ? 'आजचा AI स्कॅनिंग मोफत कोटा पूर्ण झाला आहे. कोटा रीसेट झाल्यावर हे फिचर पुन्हा उपलब्ध होईल.'
            : 'AI scan quota is temporarily exhausted for today. It will resume once reset.'
        );
        return;
      }

      if (!res.success || !res.data) {
        setError(res.error || (isMr ? 'बिल वाचताना अडचण आली.' : 'Failed to parse invoice.'));
        return;
      }

      setScannedResult(res.data);
    } catch (err: any) {
      clearInterval(stepInterval);
      setError(err.message || (isMr ? 'स्कॅनिंग दरम्यान त्रुटी आली.' : 'Error during AI invoice scanning.'));
    } finally {
      clearInterval(stepInterval);
      setLoading(false);
    }
  };

  const handleReset = () => {
    setSelectedFile(null);
    setFilePreviewUrl(null);
    setScannedResult(null);
    setError(null);
    setLoading(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleApply = () => {
    if (!scannedResult) return;
    onApplyData(scannedResult);
    onClose();
  };

  // Helper to check if scanned supplier matches any existing supplier
  const findMatchingSupplier = (suppName: string, gstin?: string) => {
    if (!suppName) return null;
    if (gstin && gstin.trim()) {
      const cleanGstin = gstin.trim().toUpperCase();
      const matched = suppliers.find((s) => s.gstin && s.gstin.trim().toUpperCase() === cleanGstin);
      if (matched) return matched;
    }
    const cleanName = suppName.trim().toLowerCase();
    return suppliers.find(
      (s) =>
        s.name.toLowerCase() === cleanName ||
        (s.company && s.company.toLowerCase() === cleanName) ||
        cleanName.includes(s.name.toLowerCase())
    );
  };

  // Helper to check if product matches store products
  const findMatchingProduct = (itemName: string) => {
    if (!itemName) return null;
    const clean = itemName.trim().toLowerCase();
    return products.find(
      (p) =>
        p.name.toLowerCase() === clean ||
        (p.name_mr && p.name_mr.toLowerCase() === clean) ||
        clean.includes(p.name.toLowerCase()) ||
        p.name.toLowerCase().includes(clean)
    );
  };

  const matchedSupplier = scannedResult
    ? findMatchingSupplier(scannedResult.supplierName, scannedResult.supplierGstin)
    : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-3xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-5 py-4 bg-gradient-to-r from-slate-900 via-indigo-950 to-emerald-950 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-amber-300 shadow-xs">
              <Sparkles className="w-4 h-4 animate-pulse" />
            </div>
            <div>
              <h3 className="font-bold text-sm tracking-wide text-white flex items-center gap-2">
                <span>{isMr ? 'खरेदी बिल AI स्कॅनर' : 'Purchase Bill AI Scanner'}</span>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-[10px] text-emerald-300 font-mono font-bold">
                  Gemini Vision
                </span>
              </h3>
              <p className="text-[11px] text-slate-300/80">
                {isMr
                  ? 'खरेदी बिलाचा फोटो किंवा PDF निवडा, आपोआप सर्व माहिती भरली जाईल'
                  : 'Pure multimodal vision auto-extraction for purchase bills and tax invoices'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg hover:bg-white/10 flex items-center justify-center text-slate-300 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 flex-1 overflow-y-auto space-y-4">
          {error && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2.5 text-xs text-rose-800">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="flex-1">
                <span className="font-bold">{isMr ? 'त्रुटी:' : 'Notice:'}</span> {error}
              </div>
            </div>
          )}

          {!scannedResult ? (
            /* =================== FILE UPLOAD SCREEN =================== */
            <div className="space-y-4">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/jpg,application/pdf"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files.length > 0) {
                    handleFileChange(e.target.files[0]);
                  }
                }}
              />

              {!selectedFile ? (
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragging(true);
                  }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-2xl p-8 sm:p-10 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-3 ${
                    isDragging
                      ? 'border-indigo-500 bg-indigo-50/60 scale-[0.99]'
                      : 'border-slate-300 hover:border-indigo-400 hover:bg-slate-50/80 bg-slate-50/40'
                  }`}
                >
                  <div className="w-14 h-14 rounded-2xl bg-indigo-100 border border-indigo-200 flex items-center justify-center text-indigo-600 shadow-xs">
                    <UploadCloud className="w-7 h-7" />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-slate-800">
                      {isMr ? 'खरेदी बिल किंवा टॅक्स इनव्हॉइस अपलोड करा' : 'Upload Purchase Bill or Tax Invoice'}
                    </h4>
                    <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                      {isMr
                        ? 'येथे फाईल ड्रॅग करा किंवा कॉम्प्युटर / मोबाईलवरून फोटो किंवा PDF निवडा'
                        : 'Drag & drop image or PDF here, or click to browse from device'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 pt-1 text-[11px] text-slate-400 font-mono">
                    <span className="px-2 py-0.5 bg-white border border-slate-200 rounded">JPG</span>
                    <span className="px-2 py-0.5 bg-white border border-slate-200 rounded">PNG</span>
                    <span className="px-2 py-0.5 bg-white border border-slate-200 rounded">WEBP</span>
                    <span className="px-2 py-0.5 bg-white border border-slate-200 rounded">PDF</span>
                  </div>
                </div>
              ) : (
                /* Selected File Preview Box */
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-indigo-100 border border-indigo-200 flex items-center justify-center text-indigo-700 shrink-0">
                        {selectedFile.type === 'application/pdf' ? (
                          <FileText className="w-5 h-5 text-rose-600" />
                        ) : (
                          <ImageIcon className="w-5 h-5 text-indigo-600" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="font-bold text-xs text-slate-900 truncate">
                          {selectedFile.name}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB • {selectedFile.type}
                        </div>
                      </div>
                    </div>
                    {!loading && (
                      <button
                        onClick={handleReset}
                        className="px-2.5 py-1 text-xs text-slate-600 hover:text-slate-900 hover:bg-slate-200 rounded-lg cursor-pointer"
                      >
                        {isMr ? 'बदला' : 'Change'}
                      </button>
                    )}
                  </div>

                  {filePreviewUrl && (
                    <div className="relative rounded-xl overflow-hidden border border-slate-200 bg-white max-h-60 flex items-center justify-center">
                      <img
                        src={filePreviewUrl}
                        alt="Bill Preview"
                        className="max-h-60 object-contain w-auto mx-auto"
                      />
                    </div>
                  )}

                  {loading && (
                    <div className="p-4 bg-indigo-50 border border-indigo-200/80 rounded-xl space-y-3">
                      <div className="flex items-center gap-3">
                        <Loader2 className="w-5 h-5 text-indigo-600 animate-spin" />
                        <div>
                          <div className="text-xs font-bold text-indigo-950">
                            {loadingStep === 1 && (isMr ? '१. Google Gemini Vision सह जोडणी करत आहे...' : '1. Connecting to Gemini Vision API...')}
                            {loadingStep === 2 && (isMr ? '२. पुरवठादार माहिती, GSTIN व बिल क्रमांक शोधत आहे...' : '2. Extracting supplier details, GSTIN & invoice number...')}
                            {loadingStep >= 3 && (isMr ? '३. उत्पादने, बॅचेस, HSN व GST दरांची पडताळणी...' : '3. Reading line items, batch, HSN & GST rates...')}
                          </div>
                          <div className="text-[11px] text-indigo-700/80">
                            {isMr ? 'कृपया काही सेकंद थांबा, बिलातील सर्व माहिती संकलित होत आहे.' : 'Please wait, analyzing multimodal document...'}
                          </div>
                        </div>
                      </div>
                      <div className="w-full bg-indigo-200/60 h-1.5 rounded-full overflow-hidden">
                        <div
                          className="bg-indigo-600 h-full transition-all duration-700 rounded-full"
                          style={{ width: `${loadingStep * 33}%` }}
                        ></div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            /* =================== SCANNED RESULTS REVIEW =================== */
            <div className="space-y-4">
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between text-xs text-emerald-900">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span className="font-bold">
                    {isMr ? 'बिल यशस्वीरित्या स्कॅन झाले!' : 'Invoice Extracted Successfully!'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleReset}
                  className="text-xs text-emerald-700 hover:text-emerald-950 underline cursor-pointer"
                >
                  {isMr ? 'दुसरे बिल स्कॅन करा' : 'Scan another invoice'}
                </button>
              </div>

              {/* Top Summary Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                {/* Supplier Card */}
                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                      <Building2 className="w-3.5 h-3.5 text-indigo-600" />
                      <span>{isMr ? 'पुरवठादार (Supplier)' : 'Supplier Details'}</span>
                    </span>
                    {matchedSupplier ? (
                      <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 text-[10px] font-bold flex items-center gap-1">
                        <Check className="w-3 h-3" />
                        <span>{isMr ? 'सिस्टीममध्ये उपलब्ध' : 'Matched in DB'}</span>
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 text-[10px] font-bold">
                        {isMr ? 'नवीन पुरवठादार' : 'New Supplier'}
                      </span>
                    )}
                  </div>
                  <div className="font-bold text-slate-900 text-sm">{scannedResult.supplierName}</div>
                  {scannedResult.supplierGstin && (
                    <div className="text-slate-600 font-mono text-[11px]">
                      GSTIN: <span className="font-bold text-slate-800">{scannedResult.supplierGstin}</span>
                    </div>
                  )}
                  {scannedResult.supplierPhone && (
                    <div className="text-slate-500 text-[11px]">फोन: {scannedResult.supplierPhone}</div>
                  )}
                </div>

                {/* Invoice Metadata Card */}
                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Receipt className="w-3.5 h-3.5 text-emerald-600" />
                    <span>{isMr ? 'बिल माहिती (Invoice Info)' : 'Invoice Info'}</span>
                  </span>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">{isMr ? 'बिल क्रमांक:' : 'Invoice No:'}</span>
                    <span className="font-mono font-bold text-slate-900">{scannedResult.invoiceNumber}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">{isMr ? 'बिल तारीख:' : 'Invoice Date:'}</span>
                    <span className="font-mono font-bold text-slate-800">{scannedResult.invoiceDate}</span>
                  </div>
                  <div className="flex items-center justify-between pt-1 border-t border-slate-200 font-bold">
                    <span className="text-slate-700">{isMr ? 'एकूण रक्कम:' : 'Grand Total:'}</span>
                    <span className="text-emerald-700 font-mono text-sm">{formatINR(scannedResult.grandTotal)}</span>
                  </div>
                </div>
              </div>

              {/* Items Table */}
              <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                <div className="px-3 py-2 bg-slate-100 border-b border-slate-200 font-bold text-xs text-slate-700 flex items-center justify-between">
                  <span>{isMr ? 'स्कॅन झालेली उत्पादने' : 'Extracted Products'} ({scannedResult.items.length})</span>
                  <span className="text-[11px] text-slate-500 font-normal">
                    {isMr ? 'सर्व आयटम्स आपोआप जोडले जातील' : 'All items mapped to purchase form'}
                  </span>
                </div>
                <div className="overflow-x-auto max-h-64">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] font-bold border-b border-slate-200 sticky top-0">
                      <tr>
                        <th className="px-3 py-2">#</th>
                        <th className="px-3 py-2">{isMr ? 'उत्पादन नाव' : 'Product Name'}</th>
                        <th className="px-3 py-2">HSN</th>
                        <th className="px-3 py-2">{isMr ? 'बॅच' : 'Batch'}</th>
                        <th className="px-3 py-2 text-right">{isMr ? 'संख्या' : 'Qty'}</th>
                        <th className="px-3 py-2 text-right">{isMr ? 'दर' : 'Rate'}</th>
                        <th className="px-3 py-2 text-center">GST</th>
                        <th className="px-3 py-2 text-right">{isMr ? 'एकूण' : 'Total'}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {scannedResult.items.map((it, idx) => {
                        const matchedProd = findMatchingProduct(it.name);
                        return (
                          <tr key={idx} className="hover:bg-slate-50 transition-colors">
                            <td className="px-3 py-2 text-slate-400 font-mono">{idx + 1}</td>
                            <td className="px-3 py-2 font-semibold text-slate-900">
                              <div>{it.name}</div>
                              {matchedProd ? (
                                <span className="inline-block mt-0.5 text-[10px] text-emerald-700 font-medium">
                                  ✓ {matchedProd.name}
                                </span>
                              ) : (
                                <span className="inline-block mt-0.5 text-[10px] text-indigo-600 font-medium">
                                  + {isMr ? 'मास्टरमध्ये नवीन जोडले जाईल' : 'Will register as new product'}
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-2 text-slate-500 font-mono">{it.hsn || '-'}</td>
                            <td className="px-3 py-2 text-slate-600 font-mono">{it.batchNumber || '-'}</td>
                            <td className="px-3 py-2 text-right font-mono font-bold text-slate-800">
                              {it.quantity} {it.unit}
                            </td>
                            <td className="px-3 py-2 text-right font-mono text-slate-700">
                              {formatINR(it.rate)}
                            </td>
                            <td className="px-3 py-2 text-center font-mono text-slate-600">
                              {it.gstRate}%
                            </td>
                            <td className="px-3 py-2 text-right font-mono font-bold text-emerald-800">
                              {formatINR(it.totalAmount)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-200/60 cursor-pointer transition-colors"
          >
            {isMr ? 'रद्द करा' : 'Cancel'}
          </button>

          {!scannedResult ? (
            <button
              type="button"
              disabled={!selectedFile || loading}
              onClick={handleStartScan}
              className={`px-5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all shadow-sm ${
                !selectedFile || loading
                  ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                  : 'bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer active:scale-95'
              }`}
            >
              {loading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>{isMr ? 'AI विश्लेषण सुरू आहे...' : 'Analyzing with Gemini...'}</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                  <span>{isMr ? 'बिल स्कॅन करा' : 'Scan Invoice'}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          ) : (
            <button
              type="button"
              onClick={handleApply}
              className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-2 shadow-sm cursor-pointer transition-all active:scale-95"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{isMr ? 'खरेदी फॉर्ममध्ये लागू करा' : 'Apply to Purchase Form'}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
