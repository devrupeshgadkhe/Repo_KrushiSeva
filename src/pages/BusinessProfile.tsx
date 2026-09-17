import React, { useState, useEffect } from 'react';
import { 
  Building2, 
  Save, 
  CheckCircle2, 
  AlertCircle, 
  FileText, 
  MapPin, 
  Phone, 
  CreditCard, 
  ShieldCheck, 
  Scale, 
  Printer,
  RefreshCw
} from 'lucide-react';
import { AppLanguage, BusinessSettings, InvoiceSettings } from '../types';
import { getTranslation } from '../i18n';
import { dbService } from '../services/api';

interface BusinessProfileProps {
  currentLang: AppLanguage;
  onSettingsSaved?: () => void;
}

export const BusinessProfile: React.FC<BusinessProfileProps> = ({ currentLang, onSettingsSaved }) => {
  const isMr = currentLang === 'mr';

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const [business, setBusiness] = useState<BusinessSettings>({
    shop_name: '',
    shop_name_mr: '',
    proprietor: '',
    owner_name: '',
    partner_name: '',
    address: '',
    village_city: '',
    taluka: '',
    district: '',
    state: 'Maharashtra',
    pincode: '',
    jurisdiction_city: '',
    mobile: '',
    mobile_secondary: '',
    email: '',
    gstin: '',
    cot_licence: '',
    fertilizer_licence: '',
    fert_licence_r: '',
    seed_licence: '',
    pesticide_licence: '',
    bank_name: '',
    bank_account_no: '',
    bank_ifsc: '',
    upi_id: '',
  });

  const [invoice, setInvoice] = useState<InvoiceSettings>({
    invoice_prefix: 'INV-2026-',
    starting_number: 1001,
    print_format: 'A4',
    show_hsn: true,
    show_mrp: true,
    show_discount: true,
    terms_conditions: '',
    terms_conditions_mr: '',
    footer_message: '',
  });

  useEffect(() => {
    loadProfileData();
  }, []);

  const loadProfileData = async () => {
    setLoading(true);
    try {
      const [bizData, invData] = await Promise.all([
        dbService.getBusinessSettings(),
        dbService.getInvoiceSettings()
      ]);
      setBusiness(bizData);
      setInvoice(invData);
    } catch (err) {
      console.error('Failed to load business profile:', err);
      setErrorMsg(isMr ? 'माहिती लोड करण्यात त्रुटी आली' : 'Failed to load business details');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSuccessMsg('');
    setErrorMsg('');

    try {
      await dbService.saveBusinessSettings({
        ...business,
        proprietor: business.proprietor || business.owner_name,
        jurisdiction_city: business.jurisdiction_city || business.taluka || business.district || 'Local',
      });
      await dbService.saveInvoiceSettings(invoice);

      setSuccessMsg(
        isMr 
          ? 'व्यवसाय प्रोफाइल व परवाना तपशील यशस्वीरीत्या जतन केले!' 
          : 'Business details & statutory licenses saved successfully!'
      );
      if (onSettingsSaved) onSettingsSaved();

      setTimeout(() => {
        setSuccessMsg('');
      }, 4000);
    } catch (err: any) {
      console.error('Save failed:', err);
      setErrorMsg(isMr ? 'जतन करताना त्रुटी आली' : 'Failed to save business details');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 p-8 flex items-center justify-center text-slate-500">
        <RefreshCw className="w-6 h-6 animate-spin mr-2" />
        <span>{isMr ? 'व्यवसाय माहिती लोड होत आहे...' : 'Loading business profile...'}</span>
      </div>
    );
  }

  return (
    <div className="flex-1 p-6 overflow-y-auto space-y-6 max-w-6xl mx-auto">
      {/* Top Banner */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-emerald-600/10 text-emerald-700 flex items-center justify-center font-bold text-2xl border border-emerald-200/50">
            <Building2 className="w-7 h-7" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">
              {isMr ? 'व्यवसाय प्रोफाइल आणि कायदेशीर तपशील' : 'Business Profile & Statutory Details'}
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">
              {isMr 
                ? 'दुकान नाव, अधिकृत परवाने, पत्ता, बँक तपशील व पावती नियम व्यवस्थापित करा'
                : 'Manage shop identity, agricultural licenses, address, banking info and tax invoice rules'}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-semibold flex items-center gap-2 cursor-pointer shadow-sm transition-all"
        >
          {saving ? (
            <RefreshCw className="w-4 h-4 animate-spin" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          <span>{isMr ? 'माहिती सेव्ह करा' : 'Save Details'}</span>
        </button>
      </div>

      {successMsg && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm font-medium flex items-center gap-2 animate-fade-in">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm font-medium flex items-center gap-2 animate-fade-in">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        {/* Section 1: Business Identity */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
          <div className="px-6 py-4 bg-slate-50 border-b border-slate-100 flex items-center gap-2">
            <Building2 className="w-4 h-4 text-emerald-600" />
            <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
              {isMr ? '१. कृषी केंद्र / दुकानाची प्राथमिक ओळख' : '1. Store Identity & Owner Details'}
            </h2>
          </div>
          <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                {isMr ? 'दुकानाचे नाव (इंग्रजी - बिलावर छापण्यासाठी)' : 'Shop Name (English - As on Invoice)'} *
              </label>
              <input
                type="text"
                required
                value={business.shop_name}
                onChange={(e) => setBusiness({ ...business, shop_name: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                placeholder="e.g. Shree Samarth Krushi Seva Kendra"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                {isMr ? 'दुकानाचे नाव (मराठी)' : 'Shop Name (Marathi)'} *
              </label>
              <input
                type="text"
                required
                value={business.shop_name_mr}
                onChange={(e) => setBusiness({ ...business, shop_name_mr: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                placeholder="उदा. श्री समर्थ कृषी सेवा केंद्र"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                {isMr ? 'मालकाचे / प्रोप्रायटर नाव' : 'Proprietor / Owner Name'} *
              </label>
              <input
                type="text"
                required
                value={business.proprietor}
                onChange={(e) => setBusiness({ ...business, proprietor: e.target.value, owner_name: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                placeholder="e.g. Sanjay A. Patil"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                {isMr ? 'भागीदार / मॅनेजर नाव (पर्यायी)' : 'Partner / Manager Name (Optional)'}
              </label>
              <input
                type="text"
                value={business.partner_name || ''}
                onChange={(e) => setBusiness({ ...business, partner_name: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                placeholder="e.g. Pravin Kadam"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                {isMr ? 'प्राथमिक संपर्क मोबाईल' : 'Primary Mobile No.'} *
              </label>
              <div className="relative">
                <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="text"
                  required
                  value={business.mobile}
                  onChange={(e) => setBusiness({ ...business, mobile: e.target.value })}
                  className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  placeholder="e.g. 9822334455"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                {isMr ? 'दुय्यम मोबाईल (बिलाच्या उजव्या बाजूला छापण्यासाठी)' : 'Secondary Mobile No.'}
              </label>
              <div className="relative">
                <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="text"
                  value={business.mobile_secondary || ''}
                  onChange={(e) => setBusiness({ ...business, mobile_secondary: e.target.value })}
                  className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  placeholder="e.g. 9890112233"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                {isMr ? 'अधिकृत ईमेल' : 'Official Email Address'}
              </label>
              <input
                type="email"
                value={business.email}
                onChange={(e) => setBusiness({ ...business, email: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                placeholder="agro@gmail.com"
              />
            </div>
          </div>
        </div>

        {/* Section 2: Address & Jurisdiction */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
          <div className="px-6 py-4 bg-slate-50 border-b border-slate-100 flex items-center gap-2">
            <MapPin className="w-4 h-4 text-emerald-600" />
            <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
              {isMr ? '२. दुकान पत्ता आणि न्यायालयीन अधिकार क्षेत्र' : '2. Location & Jurisdiction'}
            </h2>
          </div>
          <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                {isMr ? 'दुकानाचा रस्ता / गाळा पत्ता' : 'Street Address / Shop No.'} *
              </label>
              <input
                type="text"
                required
                value={business.address}
                onChange={(e) => setBusiness({ ...business, address: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                placeholder="Station Road, Main Market"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                {isMr ? 'गाव / शहर' : 'Village / City'} *
              </label>
              <input
                type="text"
                required
                value={business.village_city}
                onChange={(e) => setBusiness({ ...business, village_city: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                placeholder="Baramati"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                {isMr ? 'तालुका (TQ.)' : 'Taluka (TQ.)'} *
              </label>
              <input
                type="text"
                required
                value={business.taluka || ''}
                onChange={(e) => setBusiness({ ...business, taluka: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                placeholder="e.g. Baramati"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                {isMr ? 'जिल्हा (DIST.)' : 'District (DIST.)'} *
              </label>
              <input
                type="text"
                required
                value={business.district}
                onChange={(e) => setBusiness({ ...business, district: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                placeholder="e.g. Pune"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                {isMr ? 'पिनकोड' : 'Pincode'} *
              </label>
              <input
                type="text"
                required
                value={business.pincode}
                onChange={(e) => setBusiness({ ...business, pincode: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                placeholder="413102"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                {isMr 
                  ? 'न्यायालयीन अधिकार क्षेत्र (बिलाच्या माथ्यावर छापण्यासाठी: Subject to ... Jurisdiction Only)' 
                  : 'Jurisdiction Court City (Printed at top: Subject to ... Jurisdiction Only)'} *
              </label>
              <div className="relative">
                <Scale className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="text"
                  required
                  value={business.jurisdiction_city || ''}
                  onChange={(e) => setBusiness({ ...business, jurisdiction_city: e.target.value })}
                  className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-medium"
                  placeholder="e.g. Baramati"
                />
              </div>
              <p className="text-2xs text-slate-500 mt-1">
                {isMr 
                  ? 'पावतीच्या वर छापले जाईल: Subject to \'' + (business.jurisdiction_city || '...') + '\' Jurisdiction Only. E.&.O.E.'
                  : 'Will print on top: Subject to \'' + (business.jurisdiction_city || '...') + '\' Jurisdiction Only. E.&.O.E.'}
              </p>
            </div>
          </div>
        </div>

        {/* Section 3: Statutory Licences */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
          <div className="px-6 py-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
                {isMr ? '३. कृषी कायदेशीर परवाने आणि GSTIN' : '3. Statutory Licences & GSTIN'}
              </h2>
            </div>
            <span className="text-2xs font-semibold text-emerald-700 bg-emerald-100/80 px-2.5 py-1 rounded-full">
              {isMr ? 'शासकीय तपासणी सुसंगत' : 'Govt Compliance Ready'}
            </span>
          </div>
          <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                {isMr ? 'कापूस बियाणे परवाना (COT Lic No.)' : 'Cotton Seed Licence (COT Lic No.)'}
              </label>
              <input
                type="text"
                value={business.cot_licence || ''}
                onChange={(e) => setBusiness({ ...business, cot_licence: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-mono"
                placeholder="e.g. COT/PUN/2022/104"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                {isMr ? 'कीटकनाशक परवाना (Pest Lic No.)' : 'Pesticide Licence (Pest Lic No.)'} *
              </label>
              <input
                type="text"
                required
                value={business.pesticide_licence}
                onChange={(e) => setBusiness({ ...business, pesticide_licence: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-mono"
                placeholder="e.g. IL/PUN/2023/1932"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                {isMr ? 'बियाणे परवाना (Seed Lic No.)' : 'Seed Licence (Seed Lic No.)'} *
              </label>
              <input
                type="text"
                required
                value={business.seed_licence}
                onChange={(e) => setBusiness({ ...business, seed_licence: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-mono"
                placeholder="e.g. SL/PUN/2021/4102"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                {isMr ? 'खत किरकोळ परवाना (Fert Lic No.(R))' : 'Fertilizer Retail Licence (Fert Lic No.(R))'} *
              </label>
              <input
                type="text"
                required
                value={business.fert_licence_r || business.fertilizer_licence}
                onChange={(e) => setBusiness({ ...business, fert_licence_r: e.target.value, fertilizer_licence: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-mono"
                placeholder="e.g. LCFRD0220240690AMV"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                {isMr ? 'GSTIN क्रमांक (GST NO)' : 'GSTIN Number (GST NO)'} *
              </label>
              <input
                type="text"
                required
                value={business.gstin}
                onChange={(e) => setBusiness({ ...business, gstin: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-mono uppercase"
                placeholder="27AABCS1429B1Z8"
              />
            </div>
          </div>
        </div>

        {/* Section 4: Bank Details */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
          <div className="px-6 py-4 bg-slate-50 border-b border-slate-100 flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-emerald-600" />
            <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
              {isMr ? '४. बँक खाते आणि डिजिटल पेमेंट तपशील' : '4. Bank Account & Digital Payments'}
            </h2>
          </div>
          <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                {isMr ? 'बँकेचे नाव' : 'Bank Name'}
              </label>
              <input
                type="text"
                value={business.bank_name}
                onChange={(e) => setBusiness({ ...business, bank_name: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                placeholder="State Bank of India"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                {isMr ? 'खाते क्रमांक' : 'Account Number'}
              </label>
              <input
                type="text"
                value={business.bank_account_no}
                onChange={(e) => setBusiness({ ...business, bank_account_no: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-mono"
                placeholder="60123456789"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                {isMr ? 'IFSC कोड' : 'IFSC Code'}
              </label>
              <input
                type="text"
                value={business.bank_ifsc}
                onChange={(e) => setBusiness({ ...business, bank_ifsc: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-mono uppercase"
                placeholder="SBIN0001234"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                {isMr ? 'UPI ID / VPA' : 'UPI ID / VPA'}
              </label>
              <input
                type="text"
                value={business.upi_id}
                onChange={(e) => setBusiness({ ...business, upi_id: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-mono"
                placeholder="shop@upi"
              />
            </div>
          </div>
        </div>

        {/* Section 5: Statutory Declarations on Bill */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
          <div className="px-6 py-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-emerald-600" />
              <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
                {isMr ? '५. विक्री बिलावरील कायदेशीर सूचना व अटी' : '5. Statutory Declarations on Sales Bill'}
              </h2>
            </div>
            <span className="text-2xs text-slate-500 font-medium">
              {isMr ? 'बिलाच्या डाव्या खालील भागात छापल्या जाणाऱ्या ५ वैधानिक सूचना' : '5 Statutory notices printed on bottom-left of invoice'}
            </span>
          </div>

          <div className="p-6 space-y-4">
            <div className="p-4 bg-amber-50/70 border border-amber-200/80 rounded-xl space-y-2 text-xs text-amber-900 leading-relaxed">
              <div className="font-bold flex items-center gap-1.5 text-amber-950">
                <span>{isMr ? 'बिलावर स्वयंचलित छापल्या जाणाऱ्या कृषी नियमावली सूचना:' : 'Standard Agricultural Declarations automatically printed:'}</span>
              </div>
              <ol className="list-decimal pl-5 space-y-1">
                <li>
                  {isMr 
                    ? 'विषारी औषधाने प्रक्रिया केलेले बियाणे, खाण्यासाठी, तेलासाठी किंवा पशु खाद्यासाठी वापरू नये.'
                    : 'Seeds treated with poisonous chemicals must not be used for food, oil, or animal feed.'}
                </li>
                <li>
                  {isMr 
                    ? 'पेरणीपूर्वी उगवण शक्तीची चाचणी करून घ्यावी. सुयोग्य बुरशी नाशकाने बियाणे प्रक्रिया करावी.'
                    : 'Germination test should be checked before sowing. Seed treatment with suitable fungicide is advised.'}
                </li>
                <li>
                  {isMr 
                    ? 'कीटकनाशके वापरण्यापूर्वी लेबल व माहिती वाचून खबरदारीच्या सर्व सूचनांचे पालन करावे.'
                    : 'Read label and instructions before using pesticides and strictly follow safety precautions.'}
                </li>
                <li>
                  {isMr ? 'फक्त शेती उपयोगीसाठी.' : 'For agricultural use only.'}
                </li>
                <li>
                  {isMr 
                    ? `फक्त ${business.jurisdiction_city || business.taluka || 'स्थानिक'} न्यायालयाच्या अंतर्गत (भूल चूक - घेणे देणे).`
                    : `Subject to ${business.jurisdiction_city || business.taluka || 'Local'} jurisdiction only (E.&.O.E.).`}
                </li>
              </ol>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                {isMr ? 'बिलाचा तळटीप संदेश (Footer Message)' : 'Footer Greeting Message'}
              </label>
              <input
                type="text"
                value={invoice.footer_message}
                onChange={(e) => setInvoice({ ...invoice, footer_message: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                placeholder={isMr ? 'आमच्याकडे दर्जेदार खते, बियाणे व औषधे खात्रीशीर मिळतील.' : 'Quality fertilizers, seeds and agrochemicals guaranteed.'}
              />
            </div>
          </div>
        </div>

        {/* Bottom Save Action */}
        <div className="flex justify-end gap-3 pt-2">
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-semibold flex items-center gap-2 cursor-pointer shadow-md transition-all"
          >
            {saving ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            <span>{isMr ? 'सर्व बदल डेटाबेसमध्ये जतन करा' : 'Save All Changes to Database'}</span>
          </button>
        </div>
      </form>
    </div>
  );
};
