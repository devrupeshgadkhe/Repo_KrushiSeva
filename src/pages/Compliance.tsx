import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  AlertTriangle, 
  Calendar, 
  Download, 
  FileText, 
  Clock, 
  Plus, 
  Edit, 
  Printer,
  CheckCircle2,
  XCircle,
  Sprout,
  Wheat,
  Layers,
  Building2,
  RefreshCw,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { 
  AppLanguage, 
  StatutoryLicence, 
  PesticideRegisterRecord, 
  StatutoryFertilizerRegisterRow, 
  StatutorySeedRegisterRow, 
  BusinessSettings 
} from '../types';
import { getTranslation } from '../i18n';
import { formatDate, exportToCSV } from '../utils/formatters';
import { dbService } from '../services/api';

interface ComplianceProps {
  currentLang: AppLanguage;
}

export const Compliance: React.FC<ComplianceProps> = ({ currentLang }) => {
  const isMr = currentLang === 'mr';

  const [activeTab, setActiveTab] = useState<'licences' | 'fertilizer' | 'seeds' | 'pesticides'>('licences');
  const [loading, setLoading] = useState(false);

  // Business settings from database
  const [bizSettings, setBizSettings] = useState<BusinessSettings | null>(null);

  // Month selector for registers (YYYY-MM)
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    return new Date().toISOString().slice(0, 7);
  });

  // Data sets
  const [licences, setLicences] = useState<StatutoryLicence[]>([]);
  const [fertilizerRows, setFertilizerRows] = useState<StatutoryFertilizerRegisterRow[]>([]);
  const [seedRows, setSeedRows] = useState<StatutorySeedRegisterRow[]>([]);
  const [pesticideRegister, setPesticideRegister] = useState<PesticideRegisterRecord[]>([]);

  // Edit licence modal
  const [editingLicence, setEditingLicence] = useState<StatutoryLicence | null>(null);
  const [licenceNo, setLicenceNo] = useState('');
  const [issueDate, setIssueDate] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [issuingAuthority, setIssuingAuthority] = useState('');

  const loadData = async () => {
    setLoading(true);
    try {
      const [biz, lics, ferts, seeds, pestReg] = await Promise.all([
        dbService.getBusinessSettings(),
        dbService.getLicences(),
        dbService.getMonthlyFertilizerRegister(selectedMonth),
        dbService.getMonthlySeedRegister(selectedMonth),
        dbService.getPesticideRegister(),
      ]);
      setBizSettings(biz);
      setLicences(lics);
      setFertilizerRows(ferts);
      setSeedRows(seeds);
      setPesticideRegister(pestReg);
    } catch (e) {
      console.error('Error loading compliance data:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedMonth]);

  const handleMonthChange = (offset: number) => {
    const parts = selectedMonth.split('-');
    const curYear = parseInt(parts[0], 10);
    const curMonth = parseInt(parts[1], 10);
    const d = new Date(curYear, curMonth - 1 + offset, 1);
    const newMonthStr = d.toISOString().slice(0, 7);
    setSelectedMonth(newMonthStr);
  };

  const handleOpenEditLicence = (lic: StatutoryLicence) => {
    setEditingLicence(lic);
    setLicenceNo(lic.licence_no);
    setIssueDate(lic.issue_date || '');
    setExpiryDate(lic.expiry_date);
    setIssuingAuthority(lic.issuing_authority || '');
  };

  const handleSaveLicence = async () => {
    if (!editingLicence) return;
    try {
      await dbService.updateLicence(editingLicence.id, {
        licence_no: licenceNo.trim(),
        issue_date: issueDate || undefined,
        expiry_date: expiryDate,
        issuing_authority: issuingAuthority.trim() || undefined,
      });
      setEditingLicence(null);
      loadData();
      alert(isMr ? 'परवाना तपशील अद्यतनित केले गेले.' : 'Licence updated successfully.');
    } catch (err: any) {
      alert(err.message || (isMr ? 'परवाना अद्यतनित करताना त्रुटी आली.' : 'Error updating licence.'));
    }
  };

  // CSV Exporters
  const handleExportFertilizerCSV = () => {
    const data = fertilizerRows.map((r, i) => ({
      'Sr No': i + 1,
      'Fertilizer Grade': r.fertilizer_grade,
      'Company': r.company,
      'Opening Stock (MT)': r.opening_stock_mt,
      'Inward (MT)': r.inward_mt,
      'Total Available (MT)': Number((r.opening_stock_mt + r.inward_mt).toFixed(3)),
      'Sales (MT)': r.sales_mt,
      'Closing Stock (MT)': r.closing_stock_mt,
      'Unit': r.unit,
      'Month': selectedMonth
    }));
    exportToCSV(`Fertilizer_Register_${selectedMonth}`, data);
  };

  const handleExportSeedsCSV = () => {
    const data = seedRows.map((r, i) => ({
      'Sr No': i + 1,
      'Crop / Seed Variety': r.crop_name,
      'Variety / Type': r.seed_variety,
      'Company': r.company,
      'Opening Stock': r.opening_stock,
      'Inward': r.inward,
      'Total Available': Number((r.opening_stock + r.inward).toFixed(2)),
      'Sales': r.sales,
      'Closing Stock': r.closing_stock,
      'Unit': r.unit,
      'Month': selectedMonth
    }));
    exportToCSV(`Seed_Crop_Register_${selectedMonth}`, data);
  };

  const handleExportPesticidesCSV = () => {
    const data = pesticideRegister.map((p, i) => ({
      'Sr No': i + 1,
      'Date': p.invoice_date,
      'Invoice No': p.invoice_no,
      'Farmer Name': p.customer_name,
      'Village': p.customer_village || '',
      'Mobile': p.customer_mobile || '',
      'Crop': p.crop || '',
      'Pest': p.pest || '',
      'Pesticide Name': p.product_name,
      'Batch No': p.batch_number,
      'Expiry Date': p.expiry_date,
      'Quantity': `${p.quantity} ${p.unit}`,
    }));
    exportToCSV(`Pesticide_Sales_Register_${selectedMonth}`, data);
  };

  // Fertilizer totals
  const totalFertOpening = fertilizerRows.reduce((s, r) => s + r.opening_stock_mt, 0);
  const totalFertInward = fertilizerRows.reduce((s, r) => s + r.inward_mt, 0);
  const totalFertSales = fertilizerRows.reduce((s, r) => s + r.sales_mt, 0);
  const totalFertClosing = fertilizerRows.reduce((s, r) => s + r.closing_stock_mt, 0);

  // Seed totals
  const totalSeedOpening = seedRows.reduce((s, r) => s + r.opening_stock, 0);
  const totalSeedInward = seedRows.reduce((s, r) => s + r.inward, 0);
  const totalSeedSales = seedRows.reduce((s, r) => s + r.sales, 0);
  const totalSeedClosing = seedRows.reduce((s, r) => s + r.closing_stock, 0);

  return (
    <div className="flex-1 p-6 overflow-y-auto space-y-4">
      {/* Top Header Card */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-4 no-print">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-emerald-600/10 text-emerald-700 flex items-center justify-center font-bold text-xl border border-emerald-200/50">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900">
                {isMr ? 'वैधानिक कृषी नोंदवह्या व अहवाल' : 'Statutory Agricultural Registers & Compliance'}
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                {isMr 
                  ? 'खते, बियाणे आणि कीटकनाशके यांच्या शासकीय तपासणीसाठी अधिकृत अहवाल' 
                  : 'Official registers for Fertilizers, Seeds and Agrochemicals for departmental inspection'}
              </p>
            </div>
          </div>

          {/* Action buttons (Month Selector, Print, Export) */}
          <div className="flex flex-wrap items-center gap-2">
            {(activeTab === 'fertilizer' || activeTab === 'seeds') && (
              <div className="flex items-center bg-slate-100 rounded-xl p-1 border border-slate-200">
                <button
                  type="button"
                  onClick={() => handleMonthChange(-1)}
                  className="p-1.5 hover:bg-white rounded-lg text-slate-600 cursor-pointer transition-colors"
                  title={isMr ? 'मागील महिना' : 'Previous Month'}
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <div className="px-2 font-mono text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-emerald-600" />
                  <span>{selectedMonth}</span>
                </div>
                <button
                  type="button"
                  onClick={() => handleMonthChange(1)}
                  className="p-1.5 hover:bg-white rounded-lg text-slate-600 cursor-pointer transition-colors"
                  title={isMr ? 'पुढील महिना' : 'Next Month'}
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={() => window.print()}
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 active:scale-95 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-2xs transition-all"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>{isMr ? 'प्रिंट अहवाल' : 'Print Register'}</span>
            </button>

            {activeTab === 'fertilizer' && (
              <button
                type="button"
                onClick={handleExportFertilizerCSV}
                className="px-3.5 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 active:scale-95 text-slate-700 text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-2xs transition-all"
              >
                <Download className="w-3.5 h-3.5" />
                <span>{getTranslation('export_csv', currentLang)}</span>
              </button>
            )}

            {activeTab === 'seeds' && (
              <button
                type="button"
                onClick={handleExportSeedsCSV}
                className="px-3.5 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 active:scale-95 text-slate-700 text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-2xs transition-all"
              >
                <Download className="w-3.5 h-3.5" />
                <span>{getTranslation('export_csv', currentLang)}</span>
              </button>
            )}

            {activeTab === 'pesticides' && (
              <button
                type="button"
                onClick={handleExportPesticidesCSV}
                className="px-3.5 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 active:scale-95 text-slate-700 text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-2xs transition-all"
              >
                <Download className="w-3.5 h-3.5" />
                <span>{getTranslation('export_csv', currentLang)}</span>
              </button>
            )}
          </div>
        </div>

        {/* Tab Selection */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
          <button
            type="button"
            onClick={() => setActiveTab('licences')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'licences'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>{isMr ? 'शासकीय परवाने व नूतनीकरण' : 'Statutory Licences'}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('fertilizer')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'fertilizer'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <Layers className="w-3.5 h-3.5 text-amber-400" />
            <span>{isMr ? 'खते साठा व विक्री नोंदवही' : 'Fertilizer Stock & Sales Register'}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('seeds')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'seeds'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <Wheat className="w-3.5 h-3.5 text-emerald-400" />
            <span>{isMr ? 'बियाणे साठा व विक्री अहवाल' : 'Seed Stock & Sales Register'}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('pesticides')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'pesticides'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <Sprout className="w-3.5 h-3.5 text-rose-400" />
            <span>{getTranslation('pesticide_register', currentLang)}</span>
          </button>
        </div>
      </div>

      {loading && (
        <div className="p-8 text-center text-slate-500 flex items-center justify-center gap-2">
          <RefreshCw className="w-5 h-5 animate-spin" />
          <span className="text-xs">{isMr ? 'डेटा लोड होत आहे...' : 'Loading register data...'}</span>
        </div>
      )}

      {/* =================== TAB 1: LICENCES =================== */}
      {!loading && activeTab === 'licences' && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {licences.map((lic) => {
            const daysLeft = Math.ceil(
              (new Date(lic.expiry_date).getTime() - new Date().getTime()) / (1000 * 3600 * 24)
            );
            const isNearExpiry = daysLeft <= 90 && daysLeft > 0;
            const isExpired = daysLeft <= 0;

            let licName = lic.licence_name;
            if (isMr) {
              if (lic.licence_name.includes('Fertilizer')) licName = 'खत विक्री परवाना';
              else if (lic.licence_name.includes('Seed')) licName = 'बियाणे विक्री परवाना';
              else if (lic.licence_name.includes('Pesticide') || lic.licence_name.includes('Insecticide')) licName = 'कीटकनाशक विक्री परवाना';
            } else {
              if (lic.licence_name.includes('खत')) licName = 'Fertilizer Licence';
              else if (lic.licence_name.includes('बियाणे')) licName = 'Seed Licence';
              else if (lic.licence_name.includes('कीटकनाशक')) licName = 'Pesticide Licence';
            }

            return (
              <div
                key={lic.id}
                className={`bg-white p-5 rounded-2xl border shadow-2xs flex flex-col justify-between ${
                  isExpired
                    ? 'border-rose-300'
                    : isNearExpiry
                    ? 'border-amber-300'
                    : 'border-slate-200'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="p-2 rounded-xl bg-emerald-50 text-emerald-700">
                      <ShieldCheck className="w-5 h-5" />
                    </div>
                    {isExpired ? (
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-300">
                        {getTranslation('expired_status', currentLang)}
                      </span>
                    ) : isNearExpiry ? (
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                        {getTranslation('expiring_status', currentLang)} ({daysLeft} {isMr ? 'दिवस' : 'days'})
                      </span>
                    ) : (
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                        {getTranslation('active_status', currentLang)} ({daysLeft} {isMr ? 'दिवस' : 'days'})
                      </span>
                    )}
                  </div>

                  <h3 className="font-bold text-sm text-slate-900">{licName}</h3>
                  <div className="text-xs font-mono font-bold text-emerald-800 mt-1">
                    {lic.licence_no}
                  </div>

                  <div className="text-xs text-slate-600 space-y-1 mt-4 pt-3 border-t border-slate-100">
                    <div>
                      {getTranslation('issue_date', currentLang)}: <span className="font-mono">{formatDate(lic.issue_date || '')}</span>
                    </div>
                    <div>
                      {getTranslation('valid_upto', currentLang)}: <strong className="font-mono text-slate-900">{formatDate(lic.expiry_date)}</strong>
                    </div>
                    <div>
                      {getTranslation('issuing_authority', currentLang)}: <span className="text-slate-700">{lic.issuing_authority || (isMr ? 'जिल्हा कृषी अधीक्षक अधिकारी' : 'District Agricultural Officer')}</span>
                    </div>
                  </div>
                </div>

                <div className="pt-4 mt-4 border-t border-slate-100 flex justify-end">
                  <button
                    type="button"
                    onClick={() => handleOpenEditLicence(lic)}
                    className="px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer transition-colors"
                  >
                    {getTranslation('edit_licence', currentLang)}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* =================== TAB 2: FERTILIZER REGISTER (DOCUMENT 2) =================== */}
      {!loading && activeTab === 'fertilizer' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden print:border-none print:shadow-none">
          {/* Statutory Formal Header for Register */}
          <div className="p-4 bg-emerald-950 text-white space-y-2 border-b border-emerald-900">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <span className="text-2xs font-semibold uppercase tracking-wider text-emerald-400">
                  {isMr ? 'महाराष्ट्र खते (नियंत्रण) आदेश, १९८५ व FCO १९५७ अंतर्गत' : 'Fertilizer (Control) Order 1985 & FCO 1957 Statutory Register'}
                </span>
                <h2 className="text-base font-bold text-white">
                  {isMr ? 'खते मासिक साठा व विक्री नोंदवही' : 'Monthly Fertilizer Stock & Sales Register'}
                </h2>
              </div>
              <div className="text-right text-xs">
                <span className="text-emerald-300 font-medium">{isMr ? 'कालावधी / महिना:' : 'Period / Month:'} </span>
                <strong className="font-mono text-white text-sm">{selectedMonth}</strong>
              </div>
            </div>

            {bizSettings && (
              <div className="pt-2 border-t border-emerald-800/80 flex flex-wrap items-center justify-between text-[11px] text-emerald-200 gap-x-4 gap-y-1">
                <div>
                  <span className="font-bold text-white">{isMr && bizSettings.shop_name_mr ? bizSettings.shop_name_mr : bizSettings.shop_name}</span>
                  <span> • {bizSettings.address}, {bizSettings.taluka || bizSettings.village_city}, {bizSettings.district}</span>
                </div>
                <div className="font-mono text-[10.5px]">
                  <span>{isMr ? 'खत परवाना क्र: ' : 'Fert Lic No.(R): '}<strong>{bizSettings.fert_licence_r || bizSettings.fertilizer_licence}</strong></span>
                  <span className="ml-3">GSTIN: <strong>{bizSettings.gstin}</strong></span>
                </div>
              </div>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse">
              <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200 text-[11px]">
                <tr>
                  <th className="p-2.5 text-center w-10 border-r border-slate-200">#</th>
                  <th className="p-2.5 border-r border-slate-200">{isMr ? 'खताचा प्रकार व ग्रेड' : 'Fertilizer Grade / Name'}</th>
                  <th className="p-2.5 border-r border-slate-200">{isMr ? 'उत्पादक / पुरवठादार कंपनी' : 'Manufacturer / Company'}</th>
                  <th className="p-2.5 text-right border-r border-slate-200 bg-slate-100/50">{isMr ? 'मागील शिल्लक (MT)' : 'Opening Stock (MT)'}</th>
                  <th className="p-2.5 text-right border-r border-slate-200 bg-emerald-50/50 text-emerald-900">{isMr ? 'चालू आवक (MT)' : 'Inward (MT)'}</th>
                  <th className="p-2.5 text-right border-r border-slate-200 font-bold bg-slate-100/60">{isMr ? 'एकूण उपलब्ध (MT)' : 'Total Stock (MT)'}</th>
                  <th className="p-2.5 text-right border-r border-slate-200 bg-amber-50/50 text-amber-900">{isMr ? 'चालू विक्री (MT)' : 'Sales (MT)'}</th>
                  <th className="p-2.5 text-right border-r border-slate-200 font-bold bg-blue-50/50 text-blue-900">{isMr ? 'अखेर शिल्लक (MT)' : 'Closing Stock (MT)'}</th>
                  <th className="p-2.5 text-center w-24">{isMr ? 'शेरा / शेती वापर' : 'Remarks'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {fertilizerRows.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-slate-400">
                      {isMr ? 'या महिन्यासाठी खतांची कोणतीही नोंद आढळली नाही.' : 'No fertilizer records found for this month.'}
                    </td>
                  </tr>
                ) : (
                  fertilizerRows.map((r, idx) => {
                    const totalAvailable = Number((r.opening_stock_mt + r.inward_mt).toFixed(3));
                    return (
                      <tr key={r.product_id} className="hover:bg-slate-50 transition-colors">
                        <td className="p-2.5 text-center font-mono text-slate-500 border-r border-slate-100">{idx + 1}</td>
                        <td className="p-2.5 font-bold text-slate-900 border-r border-slate-100">
                          <div>{r.fertilizer_grade}</div>
                          {r.product_name !== r.fertilizer_grade && (
                            <div className="text-[10px] text-slate-500 font-normal">{r.product_name}</div>
                          )}
                        </td>
                        <td className="p-2.5 text-slate-700 border-r border-slate-100 font-medium">
                          {r.company}
                        </td>
                        <td className="p-2.5 text-right font-mono text-slate-700 border-r border-slate-100 bg-slate-50/30">
                          {r.opening_stock_mt.toFixed(3)}
                        </td>
                        <td className="p-2.5 text-right font-mono font-semibold text-emerald-800 border-r border-slate-100 bg-emerald-50/30">
                          {r.inward_mt.toFixed(3)}
                        </td>
                        <td className="p-2.5 text-right font-mono font-bold text-slate-900 border-r border-slate-100 bg-slate-100/30">
                          {totalAvailable.toFixed(3)}
                        </td>
                        <td className="p-2.5 text-right font-mono font-semibold text-amber-800 border-r border-slate-100 bg-amber-50/30">
                          {r.sales_mt.toFixed(3)}
                        </td>
                        <td className="p-2.5 text-right font-mono font-bold text-blue-900 border-r border-slate-100 bg-blue-50/30">
                          {r.closing_stock_mt.toFixed(3)}
                        </td>
                        <td className="p-2.5 text-center text-slate-500 text-[10px] italic">
                          {isMr ? 'शेती वापर' : 'Agri Use'}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
              {fertilizerRows.length > 0 && (
                <tfoot className="bg-slate-100 text-slate-900 font-bold border-t-2 border-slate-300 text-xs">
                  <tr>
                    <td colSpan={3} className="p-2.5 text-right uppercase tracking-wider">
                      {isMr ? 'एकूण मेट्रिक टन (MT):' : 'TOTAL METRIC TONNES (MT):'}
                    </td>
                    <td className="p-2.5 text-right font-mono">{totalFertOpening.toFixed(3)}</td>
                    <td className="p-2.5 text-right font-mono text-emerald-800">{totalFertInward.toFixed(3)}</td>
                    <td className="p-2.5 text-right font-mono text-slate-950">{(totalFertOpening + totalFertInward).toFixed(3)}</td>
                    <td className="p-2.5 text-right font-mono text-amber-800">{totalFertSales.toFixed(3)}</td>
                    <td className="p-2.5 text-right font-mono text-blue-900">{totalFertClosing.toFixed(3)}</td>
                    <td className="p-2.5"></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>

          {/* Statutory Signatures & Footer Note */}
          <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row justify-between items-end gap-6 text-xs text-slate-700">
            <div className="space-y-1">
              <div className="font-semibold text-slate-800">
                {isMr ? 'वैधानिक घोषणापत्र:' : 'Statutory Declaration:'}
              </div>
              <p className="text-[11px] text-slate-500 max-w-xl">
                {isMr 
                  ? 'सदर अहवालातील खते विक्री व साठा प्रत्यक्ष दुकानाच्या रोजकीर्द व बिलांशी तंतोतंत जुळणारा असून तो शासन नियमानुसार ठेवण्यात आलेला आहे.'
                  : 'The above stock and sales report corresponds accurately to the counter sales and inventory registers maintained under FCO 1985.'}
              </p>
            </div>

            <div className="text-center w-56 shrink-0">
              <div className="h-10"></div>
              <div className="border-t border-slate-400 pt-1 font-bold text-slate-900 text-xs">
                {isMr ? 'विक्रेत्याची स्वाक्षरी व शिक्का' : 'Dealer Signature & Seal'}
              </div>
              <div className="text-[10px] text-slate-500">
                {bizSettings?.shop_name}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =================== TAB 3: SEEDS REGISTER (DOCUMENT 3) =================== */}
      {!loading && activeTab === 'seeds' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden print:border-none print:shadow-none">
          {/* Statutory Formal Header for Register */}
          <div className="p-4 bg-emerald-950 text-white space-y-2 border-b border-emerald-900">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <span className="text-2xs font-semibold uppercase tracking-wider text-emerald-400">
                  {isMr ? 'बियाणे कायदा, १९६६ व बियाणे (नियंत्रण) आदेश, १९८३ अंतर्गत' : 'Seeds Act 1966 & Seeds (Control) Order 1983 Statutory Register'}
                </span>
                <h2 className="text-base font-bold text-white">
                  {isMr ? 'बियाणे मासिक साठा व विक्री अहवाल' : 'Monthly Seeds Stock & Sales Register'}
                </h2>
              </div>
              <div className="text-right text-xs">
                <span className="text-emerald-300 font-medium">{isMr ? 'कालावधी / महिना:' : 'Period / Month:'} </span>
                <strong className="font-mono text-white text-sm">{selectedMonth}</strong>
              </div>
            </div>

            {bizSettings && (
              <div className="pt-2 border-t border-emerald-800/80 flex flex-wrap items-center justify-between text-[11px] text-emerald-200 gap-x-4 gap-y-1">
                <div>
                  <span className="font-bold text-white">{isMr && bizSettings.shop_name_mr ? bizSettings.shop_name_mr : bizSettings.shop_name}</span>
                  <span> • {bizSettings.address}, {bizSettings.taluka || bizSettings.village_city}, {bizSettings.district}</span>
                </div>
                <div className="font-mono text-[10.5px]">
                  <span>{isMr ? 'बियाणे परवाना: ' : 'Seed Lic No: '}<strong>{bizSettings.seed_licence}</strong></span>
                  <span className="ml-3">{isMr ? 'कापूस बियाणे: ' : 'COT Lic: '}<strong>{bizSettings.cot_licence || '-'}</strong></span>
                  <span className="ml-3">GSTIN: <strong>{bizSettings.gstin}</strong></span>
                </div>
              </div>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse">
              <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200 text-[11px]">
                <tr>
                  <th className="p-2.5 text-center w-10 border-r border-slate-200">#</th>
                  <th className="p-2.5 border-r border-slate-200">{isMr ? 'पिकाचे नाव व वाण' : 'Crop & Seed Variety'}</th>
                  <th className="p-2.5 border-r border-slate-200">{isMr ? 'बियाणे उत्पादक कंपनी' : 'Producer / Seed Company'}</th>
                  <th className="p-2.5 text-center border-r border-slate-200 w-20">{isMr ? 'एकक' : 'Unit'}</th>
                  <th className="p-2.5 text-right border-r border-slate-200 bg-slate-100/50">{isMr ? 'मागील शिल्लक' : 'Opening Stock'}</th>
                  <th className="p-2.5 text-right border-r border-slate-200 bg-emerald-50/50 text-emerald-900">{isMr ? 'चालू आवक' : 'Inward'}</th>
                  <th className="p-2.5 text-right border-r border-slate-200 font-bold bg-slate-100/60">{isMr ? 'एकूण साठा' : 'Total Available'}</th>
                  <th className="p-2.5 text-right border-r border-slate-200 bg-amber-50/50 text-amber-900">{isMr ? 'चालू विक्री' : 'Sales'}</th>
                  <th className="p-2.5 text-right border-r border-slate-200 font-bold bg-blue-50/50 text-blue-900">{isMr ? 'अखेर शिल्लक' : 'Closing Stock'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {seedRows.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-slate-400">
                      {isMr ? 'या महिन्यासाठी बियाण्यांची कोणतीही नोंद आढळली नाही.' : 'No seed records found for this month.'}
                    </td>
                  </tr>
                ) : (
                  seedRows.map((r, idx) => {
                    const totalAvailable = Number((r.opening_stock + r.inward).toFixed(2));
                    return (
                      <tr key={r.product_id} className="hover:bg-slate-50 transition-colors">
                        <td className="p-2.5 text-center font-mono text-slate-500 border-r border-slate-100">{idx + 1}</td>
                        <td className="p-2.5 font-bold text-slate-900 border-r border-slate-100">
                          <div>{r.crop_name}</div>
                          {r.seed_variety !== r.crop_name && (
                            <div className="text-[10px] text-slate-500 font-normal">{r.seed_variety}</div>
                          )}
                        </td>
                        <td className="p-2.5 text-slate-700 border-r border-slate-100 font-medium">
                          {r.company}
                        </td>
                        <td className="p-2.5 text-center font-mono text-[11px] text-slate-600 border-r border-slate-100">
                          <span className="px-2 py-0.5 rounded bg-slate-100 font-semibold">{r.unit}</span>
                        </td>
                        <td className="p-2.5 text-right font-mono text-slate-700 border-r border-slate-100 bg-slate-50/30">
                          {r.opening_stock.toFixed(2)}
                        </td>
                        <td className="p-2.5 text-right font-mono font-semibold text-emerald-800 border-r border-slate-100 bg-emerald-50/30">
                          {r.inward.toFixed(2)}
                        </td>
                        <td className="p-2.5 text-right font-mono font-bold text-slate-900 border-r border-slate-100 bg-slate-100/30">
                          {totalAvailable.toFixed(2)}
                        </td>
                        <td className="p-2.5 text-right font-mono font-semibold text-amber-800 border-r border-slate-100 bg-amber-50/30">
                          {r.sales.toFixed(2)}
                        </td>
                        <td className="p-2.5 text-right font-mono font-bold text-blue-900 border-r border-slate-100 bg-blue-50/30">
                          {r.closing_stock.toFixed(2)}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
              {seedRows.length > 0 && (
                <tfoot className="bg-slate-100 text-slate-900 font-bold border-t-2 border-slate-300 text-xs">
                  <tr>
                    <td colSpan={4} className="p-2.5 text-right uppercase tracking-wider">
                      {isMr ? 'एकूण प्रमाण:' : 'TOTAL QUANTITY:'}
                    </td>
                    <td className="p-2.5 text-right font-mono">{totalSeedOpening.toFixed(2)}</td>
                    <td className="p-2.5 text-right font-mono text-emerald-800">{totalSeedInward.toFixed(2)}</td>
                    <td className="p-2.5 text-right font-mono text-slate-950">{(totalSeedOpening + totalSeedInward).toFixed(2)}</td>
                    <td className="p-2.5 text-right font-mono text-amber-800">{totalSeedSales.toFixed(2)}</td>
                    <td className="p-2.5 text-right font-mono text-blue-900">{totalSeedClosing.toFixed(2)}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>

          {/* Statutory Signatures & Footer Note */}
          <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row justify-between items-end gap-6 text-xs text-slate-700">
            <div className="space-y-1">
              <div className="font-semibold text-slate-800">
                {isMr ? 'वैधानिक घोषणापत्र:' : 'Statutory Declaration:'}
              </div>
              <p className="text-[11px] text-slate-500 max-w-xl">
                {isMr 
                  ? 'सदर बियाणे विक्री ही बियाणे कायदा, १९६६ मधील तरतुदींनुसार प्रमाणित व पॅकबंद स्थितीत करण्यात आलेली आहे.'
                  : 'Seeds reported herein are sold strictly in sealed/certified containers in accordance with Seeds Act 1966.'}
              </p>
            </div>

            <div className="text-center w-56 shrink-0">
              <div className="h-10"></div>
              <div className="border-t border-slate-400 pt-1 font-bold text-slate-900 text-xs">
                {isMr ? 'अधिकृत विक्रेत्याची स्वाक्षरी' : 'Authorized Signatory'}
              </div>
              <div className="text-[10px] text-slate-500">
                {bizSettings?.shop_name}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =================== TAB 4: PESTICIDE REGISTER =================== */}
      {!loading && activeTab === 'pesticides' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden print:border-none print:shadow-none">
          <div className="p-4 bg-emerald-950 text-white font-bold text-xs flex justify-between items-center">
            <span>{isMr ? 'कीटकनाशके नियम, १९७१ - अनुसूची २ अन्वये वैधानिक नोंदवही' : 'Statutory Pesticides Register - Schedule II (Insecticide Act, 1971)'}</span>
            <span className="text-[11px] text-emerald-300">
              {isMr ? 'कृषी विभाग तपासणीसाठी प्रमाणित' : 'Certified for Agricultural Inspection'}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200 text-[11px]">
                <tr>
                  <th className="p-2.5 text-center">#</th>
                  <th className="p-2.5">{getTranslation('date', currentLang)}</th>
                  <th className="p-2.5">{isMr ? 'पावती क्र.' : 'Invoice No.'}</th>
                  <th className="p-2.5">{isMr ? 'शेतकऱ्याचे नाव व गाव' : 'Farmer & Village'}</th>
                  <th className="p-2.5">{getTranslation('mobile', currentLang)}</th>
                  <th className="p-2.5">{getTranslation('crop_used', currentLang)}</th>
                  <th className="p-2.5">{getTranslation('pest_targeted', currentLang)}</th>
                  <th className="p-2.5">{isMr ? 'कीटकनाशकाचे नाव' : 'Product Name'}</th>
                  <th className="p-2.5 text-center">{getTranslation('batch', currentLang)}</th>
                  <th className="p-2.5 text-center">{getTranslation('expiry', currentLang)}</th>
                  <th className="p-2.5 text-center">{getTranslation('qty', currentLang)}</th>
                  <th className="p-2.5 text-center">{isMr ? 'स्वाक्षरी' : 'Signature'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pesticideRegister.length === 0 ? (
                  <tr>
                    <td colSpan={12} className="py-12 text-center text-slate-400">
                      {getTranslation('no_records_found', currentLang)}
                    </td>
                  </tr>
                ) : (
                  pesticideRegister.map((p, idx) => (
                    <tr key={idx} className="hover:bg-slate-50">
                      <td className="p-2.5 text-center font-mono text-slate-500">{idx + 1}</td>
                      <td className="p-2.5 font-mono text-slate-700">{formatDate(p.invoice_date)}</td>
                      <td className="p-2.5 font-mono font-bold text-slate-900">{p.invoice_no}</td>
                      <td className="p-2.5">
                        <div className="font-bold text-slate-900">{p.customer_name}</div>
                        <div className="text-[10px] text-slate-500">{p.customer_village}</div>
                      </td>
                      <td className="p-2.5 font-mono text-slate-600">{p.customer_mobile || '-'}</td>
                      <td className="p-2.5 font-medium text-emerald-800">{p.crop || '-'}</td>
                      <td className="p-2.5 text-slate-700">{p.pest || '-'}</td>
                      <td className="p-2.5 font-bold text-slate-900">{p.product_name}</td>
                      <td className="p-2.5 text-center font-mono text-[10px]">{p.batch_number}</td>
                      <td className="p-2.5 text-center font-mono text-[10px] text-slate-600">{formatDate(p.expiry_date)}</td>
                      <td className="p-2.5 text-center font-bold font-mono">{p.quantity} {p.unit}</td>
                      <td className="p-2.5 text-center text-[10px] text-slate-400 italic">
                        {isMr ? 'नोंद केली' : 'Signed'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Edit Licence Modal */}
      {editingLicence && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95">
            <div className="px-5 py-3.5 bg-slate-800 text-white flex items-center justify-between">
              <h3 className="font-bold text-sm">
                {isMr ? 'परवाना माहिती अद्यतनित करा' : 'Update Licence'}: {editingLicence.licence_name}
              </h3>
              <button 
                type="button" 
                onClick={() => setEditingLicence(null)} 
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-5 space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  {getTranslation('licence_no', currentLang)} *
                </label>
                <input
                  type="text"
                  value={licenceNo}
                  onChange={(e) => setLicenceNo(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded-lg font-mono font-bold"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  {getTranslation('valid_upto', currentLang)} *
                </label>
                <input
                  type="date"
                  value={expiryDate}
                  onChange={(e) => setExpiryDate(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded-lg font-mono font-bold"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  {getTranslation('issue_date', currentLang)}:
                </label>
                <input
                  type="date"
                  value={issueDate}
                  onChange={(e) => setIssueDate(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded-lg font-mono"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  {getTranslation('issuing_authority', currentLang)}:
                </label>
                <input
                  type="text"
                  value={issuingAuthority}
                  onChange={(e) => setIssuingAuthority(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded-lg"
                />
              </div>
            </div>

            <div className="px-5 py-3 bg-slate-100 border-t border-slate-200 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditingLicence(null)}
                className="px-3.5 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-xs font-semibold cursor-pointer"
              >
                {getTranslation('cancel', currentLang)}
              </button>
              <button
                type="button"
                onClick={handleSaveLicence}
                className="px-4 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-bold cursor-pointer"
              >
                {getTranslation('save', currentLang)}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
