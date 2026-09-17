import React, { useState, useEffect } from 'react';
import { 
  Settings as SettingsIcon, 
  Store, 
  FileText, 
  Users, 
  Shield, 
  Save, 
  CheckCircle2,
  Building,
  CreditCard,
  DownloadCloud,
  Laptop,
  GitBranch,
  RefreshCw,
  ExternalLink
} from 'lucide-react';
import { AppLanguage, BusinessSettings, InvoiceSettings, User } from '../types';
import { getTranslation } from '../i18n';
import { dbService } from '../services/api';

interface SettingsProps {
  currentLang: AppLanguage;
  onSettingsSaved?: () => void;
}

export const Settings: React.FC<SettingsProps> = ({ currentLang, onSettingsSaved }) => {
  const isMr = currentLang === 'mr';

  const [activeTab, setActiveTab] = useState<'shop' | 'invoice' | 'users' | 'audit' | 'updates'>('shop');
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  // Desktop App & Update State
  const isElectron = typeof window !== 'undefined' && !!window.electronAPI?.isElectron;
  const [appVersion, setAppVersion] = useState<string>('1.0.0');
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [updateStatusMsg, setUpdateStatusMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isElectron && window.electronAPI) {
      window.electronAPI.getAppVersion().then((v) => {
        if (v) setAppVersion(v);
      }).catch(console.error);
    }
  }, [isElectron]);

  const handleCheckForUpdates = async () => {
    setCheckingUpdate(true);
    setUpdateStatusMsg(null);
    if (isElectron && window.electronAPI) {
      try {
        const res = await window.electronAPI.checkForUpdates();
        if (res.status === 'dev_mode') {
          setUpdateStatusMsg(isMr ? 'डेव्हलपमेंट मोडमध्ये आहे. प्रत्यक्ष .exe इन्स्टॉलरमध्ये ऑटो-अपडेट सक्रिय असते.' : 'Running in development mode. Auto-updates activate in production .exe builds.');
        } else if (res.status === 'error') {
          setUpdateStatusMsg(res.message || (isMr ? 'अपडेट तपासताना अडचण आली.' : 'Error checking for updates.'));
        } else {
          setUpdateStatusMsg(isMr ? 'अपडेट तपासणी पूर्ण झाली. नवीन व्हर्जन उपलब्ध असल्यास नोटिफिकेशन दिसेल.' : 'Update check initiated. Notification will appear if an update is available.');
        }
      } catch (err: any) {
        setUpdateStatusMsg(err.message || 'Update check failed');
      }
    } else {
      setTimeout(() => {
        setUpdateStatusMsg(isMr ? 'सध्या तुम्ही वेब मोडमध्ये आहात. डेस्कटॉप ॲप (.exe) विन्डोजवर चालू केल्यावर आपोआप GitHub वरून अपडेट होईल.' : 'Currently running in Web Preview. The desktop (.exe) app will automatically sync updates from GitHub when installed on Windows.');
        setCheckingUpdate(false);
      }, 600);
      return;
    }
    setCheckingUpdate(false);
  };

  // Business Settings State
  const [shopName, setShopName] = useState('');
  const [shopNameMr, setShopNameMr] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [mobile, setMobile] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [villageCity, setVillageCity] = useState('');
  const [district, setDistrict] = useState('');
  const [pincode, setPincode] = useState('');
  const [gstin, setGstin] = useState('');
  const [fertilizerLic, setFertilizerLic] = useState('');
  const [seedLic, setSeedLic] = useState('');
  const [pesticideLic, setPesticideLic] = useState('');
  const [bankName, setBankName] = useState('');
  const [bankAcc, setBankAcc] = useState('');
  const [bankIfsc, setBankIfsc] = useState('');
  const [upiId, setUpiId] = useState('');

  // Invoice Settings State
  const [invoicePrefix, setInvoicePrefix] = useState('');
  const [printFormat, setPrintFormat] = useState<'A4' | 'Thermal'>('A4');
  const [showMarathi, setShowMarathi] = useState(true);
  const [showHsn, setShowHsn] = useState(true);
  const [showBankDetails, setShowBankDetails] = useState(true);
  const [termsMr, setTermsMr] = useState('');
  const [termsEn, setTermsEn] = useState('');
  const [footerMsg, setFooterMsg] = useState('');

  // Users
  const [users, setUsers] = useState<User[]>([]);

  // Audit Logs
  const [auditLogs, setAuditLogs] = useState<any[]>([]);

  useEffect(() => {
    const loadSettings = async () => {
      setLoading(true);
      try {
        const [bSet, iSet, uList, aLogs] = await Promise.all([
          dbService.getBusinessSettings(),
          dbService.getInvoiceSettings(),
          dbService.getUsers(),
          dbService.getAuditLogs(),
        ]);

        if (bSet) {
          setShopName(bSet.shop_name || '');
          setShopNameMr(bSet.shop_name_mr || '');
          setOwnerName(bSet.owner_name || '');
          setMobile(bSet.mobile || '');
          setEmail(bSet.email || '');
          setAddress(bSet.address || '');
          setVillageCity(bSet.village_city || '');
          setDistrict(bSet.district || '');
          setPincode(bSet.pincode || '');
          setGstin(bSet.gstin || '');
          setFertilizerLic(bSet.fertilizer_licence || '');
          setSeedLic(bSet.seed_licence || '');
          setPesticideLic(bSet.pesticide_licence || '');
          setBankName(bSet.bank_name || '');
          setBankAcc(bSet.bank_account_no || '');
          setBankIfsc(bSet.bank_ifsc || '');
          setUpiId(bSet.upi_id || '');
        }

        if (iSet) {
          setInvoicePrefix(iSet.invoice_prefix || '');
          setPrintFormat(iSet.print_format || 'A4');
          setShowMarathi(iSet.show_marathi_name);
          setShowHsn(iSet.show_hsn_code);
          setShowBankDetails(iSet.show_bank_details);
          setTermsMr(iSet.terms_conditions_mr || '');
          setTermsEn(iSet.terms_conditions || '');
          setFooterMsg(iSet.footer_message || '');
        }

        setUsers(uList);
        setAuditLogs(aLogs);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    loadSettings();
  }, []);

  const handleSaveShopSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await dbService.updateBusinessSettings({
        shop_name: shopName,
        shop_name_mr: shopNameMr,
        owner_name: ownerName,
        mobile,
        email,
        address,
        village_city: villageCity,
        district,
        pincode,
        gstin,
        fertilizer_licence: fertilizerLic,
        seed_licence: seedLic,
        pesticide_licence: pesticideLic,
        bank_name: bankName,
        bank_account_no: bankAcc,
        bank_ifsc: bankIfsc,
        upi_id: upiId,
      });

      setSuccessMsg(isMr ? 'दुकानाची माहिती यशस्वीरित्या सेव्ह झाली.' : 'Business details saved successfully.');
      setTimeout(() => setSuccessMsg(''), 3000);
      onSettingsSaved?.();
    } catch (err: any) {
      alert((isMr ? 'माहिती सेव्ह करताना त्रुटी आली: ' : 'Error saving business settings: ') + err.message);
    }
  };

  const handleSaveInvoiceSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await dbService.updateInvoiceSettings({
        invoice_prefix: invoicePrefix,
        print_format: printFormat,
        show_marathi_name: showMarathi,
        show_hsn_code: showHsn,
        show_bank_details: showBankDetails,
        terms_conditions: termsEn,
        terms_conditions_mr: termsMr,
        footer_message: footerMsg,
      });

      setSuccessMsg(isMr ? 'पावती प्रिंटिंग सेटिंग्ज यशस्वीरित्या सेव्ह झाली.' : 'Invoice settings saved successfully.');
      setTimeout(() => setSuccessMsg(''), 3000);
      onSettingsSaved?.();
    } catch (err: any) {
      alert((isMr ? 'सेटिंग्ज सेव्ह करताना त्रुटी आली: ' : 'Error saving invoice settings: ') + err.message);
    }
  };

  return (
    <div className="flex-1 p-6 overflow-y-auto space-y-4">
      {/* Header */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-800">
              {getTranslation('settings_title', currentLang)}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {isMr 
                ? 'दुकान नाव, परवाने, बँक तपशील, पावती फॉरमॅट व कर्मचारी व्यवस्थापन' 
                : 'Store details, licences, banking info, invoice format and user management'}
            </p>
          </div>

          {successMsg && (
            <div className="px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-300 text-xs font-bold flex items-center gap-1.5 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>{successMsg}</span>
            </div>
          )}
        </div>

        {/* Tab Selection */}
        <div className="flex items-center gap-2 pt-2 border-t border-slate-100 text-xs">
          <button
            type="button"
            onClick={() => setActiveTab('shop')}
            className={`px-3 py-1.5 rounded-lg font-bold transition-colors cursor-pointer ${
              activeTab === 'shop'
                ? 'bg-slate-800 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {getTranslation('tab_shop_info', currentLang)}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('invoice')}
            className={`px-3 py-1.5 rounded-lg font-bold transition-colors cursor-pointer ${
              activeTab === 'invoice'
                ? 'bg-slate-800 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {getTranslation('tab_invoice_print', currentLang)}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('users')}
            className={`px-3 py-1.5 rounded-lg font-bold transition-colors cursor-pointer ${
              activeTab === 'users'
                ? 'bg-slate-800 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {getTranslation('tab_users', currentLang)}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('audit')}
            className={`px-3 py-1.5 rounded-lg font-bold transition-colors cursor-pointer ${
              activeTab === 'audit'
                ? 'bg-slate-800 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {getTranslation('tab_audit', currentLang)}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('updates')}
            className={`px-3 py-1.5 rounded-lg font-bold transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'updates'
                ? 'bg-emerald-800 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <Laptop className="w-3.5 h-3.5 text-emerald-400" />
            <span>{isMr ? 'डेस्कटॉप ॲप व अपडेट्स' : 'Desktop & Updates'}</span>
          </button>
        </div>
      </div>

      {/* Tab Panels */}
      {activeTab === 'shop' && (
        <form onSubmit={handleSaveShopSettings} className="bg-white p-6 rounded-xl border border-slate-200 shadow-2xs space-y-6 text-xs">
          {/* Shop Identity */}
          <div className="space-y-3">
            <h3 className="font-bold text-sm text-slate-800 border-b pb-2 flex items-center gap-2">
              <Store className="w-4 h-4 text-emerald-700" />
              <span>{isMr ? 'दुकान नाव व संपर्क तपशील' : 'Business & Contact Information'}</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  {getTranslation('shop_name', currentLang)} *
                </label>
                <input
                  type="text"
                  required
                  value={shopName}
                  onChange={(e) => setShopName(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded font-bold text-slate-900"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  {getTranslation('shop_name_mr', currentLang)}:
                </label>
                <input
                  type="text"
                  value={shopNameMr}
                  onChange={(e) => setShopNameMr(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded font-bold text-slate-900"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  {getTranslation('proprietor_name', currentLang)}:
                </label>
                <input
                  type="text"
                  value={ownerName}
                  onChange={(e) => setOwnerName(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  {getTranslation('mobile', currentLang)} *
                </label>
                <input
                  type="tel"
                  required
                  value={mobile}
                  onChange={(e) => setMobile(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded font-mono"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block font-bold text-slate-700 mb-1">
                  {getTranslation('address', currentLang)} *
                </label>
                <input
                  type="text"
                  required
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  {getTranslation('village', currentLang)}:
                </label>
                <input
                  type="text"
                  value={villageCity}
                  onChange={(e) => setVillageCity(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  {isMr ? 'जिल्हा' : 'District'}:
                </label>
                <input
                  type="text"
                  value={district}
                  onChange={(e) => setDistrict(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded"
                />
              </div>
            </div>
          </div>

          {/* Statutory Licences & GST */}
          <div className="space-y-3 pt-3 border-t">
            <h3 className="font-bold text-sm text-slate-800 border-b pb-2 flex items-center gap-2">
              <Building className="w-4 h-4 text-blue-700" />
              <span>{isMr ? 'शासकीय परवाने व GST तपशील' : 'Statutory Licences & GST'}</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-slate-700 mb-1">GSTIN:</label>
                <input
                  type="text"
                  value={gstin}
                  onChange={(e) => setGstin(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded font-mono uppercase font-bold"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  {getTranslation('fertilizer_licence', currentLang)}:
                </label>
                <input
                  type="text"
                  value={fertilizerLic}
                  onChange={(e) => setFertilizerLic(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded font-mono"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  {getTranslation('seed_licence', currentLang)}:
                </label>
                <input
                  type="text"
                  value={seedLic}
                  onChange={(e) => setSeedLic(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded font-mono"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  {getTranslation('pesticide_licence', currentLang)}:
                </label>
                <input
                  type="text"
                  value={pesticideLic}
                  onChange={(e) => setPesticideLic(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded font-mono"
                />
              </div>
            </div>
          </div>

          {/* Bank & UPI for Bills */}
          <div className="space-y-3 pt-3 border-t">
            <h3 className="font-bold text-sm text-slate-800 border-b pb-2 flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-amber-700" />
              <span>{isMr ? 'बँक खाते व UPI तपशील' : 'Bank Account & UPI Details'}</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  {getTranslation('bank_name', currentLang)}:
                </label>
                <input
                  type="text"
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  placeholder=""
                  className="w-full p-2 border border-slate-300 rounded"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  {getTranslation('bank_acc', currentLang)}:
                </label>
                <input
                  type="text"
                  value={bankAcc}
                  onChange={(e) => setBankAcc(e.target.value)}
                  placeholder=""
                  className="w-full p-2 border border-slate-300 rounded font-mono"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  {getTranslation('bank_ifsc', currentLang)}:
                </label>
                <input
                  type="text"
                  value={bankIfsc}
                  onChange={(e) => setBankIfsc(e.target.value)}
                  placeholder=""
                  className="w-full p-2 border border-slate-300 rounded font-mono uppercase"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  {getTranslation('upi_id', currentLang)}:
                </label>
                <input
                  type="text"
                  value={upiId}
                  onChange={(e) => setUpiId(e.target.value)}
                  placeholder=""
                  className="w-full p-2 border border-slate-300 rounded font-mono"
                />
              </div>
            </div>
          </div>

          <div className="pt-4 flex justify-end">
            <button
              type="submit"
              className="px-6 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl text-xs flex items-center gap-2 shadow-xs transition-colors cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>{getTranslation('save', currentLang)}</span>
            </button>
          </div>
        </form>
      )}

      {activeTab === 'invoice' && (
        <form onSubmit={handleSaveInvoiceSettings} className="bg-white p-6 rounded-xl border border-slate-200 shadow-2xs space-y-5 text-xs">
          <h3 className="font-bold text-sm text-slate-800 border-b pb-2 flex items-center gap-2">
            <FileText className="w-4 h-4 text-emerald-700" />
            <span>{isMr ? 'पावती व प्रिंट कॉन्फिगरेशन' : 'Invoice & Print Preferences'}</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                {getTranslation('invoice_prefix', currentLang)}:
              </label>
              <input
                type="text"
                value={invoicePrefix}
                onChange={(e) => setInvoicePrefix(e.target.value)}
                className="w-full p-2 border border-slate-300 rounded font-mono font-bold"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">
                {getTranslation('print_format', currentLang)}:
              </label>
              <select
                value={printFormat}
                onChange={(e) => setPrintFormat(e.target.value as any)}
                className="w-full p-2 border border-slate-300 rounded font-bold"
              >
                <option value="A4">{getTranslation('print_a4', currentLang)}</option>
                <option value="Thermal">{getTranslation('print_thermal', currentLang)}</option>
              </select>
            </div>

            <div className="sm:col-span-2 space-y-2 pt-2 border-t">
              <label className="flex items-center gap-2 font-semibold text-slate-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showMarathi}
                  onChange={(e) => setShowMarathi(e.target.checked)}
                  className="rounded text-emerald-600"
                />
                <span>{getTranslation('show_marathi_option', currentLang)}</span>
              </label>

              <label className="flex items-center gap-2 font-semibold text-slate-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showHsn}
                  onChange={(e) => setShowHsn(e.target.checked)}
                  className="rounded text-emerald-600"
                />
                <span>{getTranslation('show_hsn_option', currentLang)}</span>
              </label>

              <label className="flex items-center gap-2 font-semibold text-slate-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showBankDetails}
                  onChange={(e) => setShowBankDetails(e.target.checked)}
                  className="rounded text-emerald-600"
                />
                <span>{getTranslation('show_bank_option', currentLang)}</span>
              </label>
            </div>

            <div className="sm:col-span-2">
              <label className="block font-bold text-slate-700 mb-1">
                {getTranslation('terms_marathi', currentLang)}:
              </label>
              <textarea
                rows={2}
                value={termsMr}
                onChange={(e) => setTermsMr(e.target.value)}
                className="w-full p-2 border border-slate-300 rounded text-xs"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block font-bold text-slate-700 mb-1">
                {getTranslation('terms_english', currentLang)}:
              </label>
              <textarea
                rows={2}
                value={termsEn}
                onChange={(e) => setTermsEn(e.target.value)}
                className="w-full p-2 border border-slate-300 rounded text-xs"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block font-bold text-slate-700 mb-1">
                {getTranslation('footer_text', currentLang)}:
              </label>
              <input
                type="text"
                value={footerMsg}
                onChange={(e) => setFooterMsg(e.target.value)}
                className="w-full p-2 border border-slate-300 rounded text-xs"
              />
            </div>
          </div>

          <div className="pt-4 flex justify-end">
            <button
              type="submit"
              className="px-6 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl text-xs flex items-center gap-2 shadow-xs transition-colors cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>{getTranslation('save', currentLang)}</span>
            </button>
          </div>
        </form>
      )}

      {activeTab === 'users' && (
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs space-y-4 text-xs">
          <div className="flex justify-between items-center border-b pb-3">
            <h3 className="font-bold text-sm text-slate-800 flex items-center gap-2">
              <Users className="w-4 h-4 text-emerald-700" />
              <span>{isMr ? 'कर्मचारी खाती व ऑपरेटर' : 'User Accounts & Operators'}</span>
            </h3>
          </div>

          <table className="w-full text-left">
            <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
              <tr>
                <th className="p-2.5">{isMr ? 'नाव' : 'Name'}</th>
                <th className="p-2.5">{isMr ? 'युझरनेम' : 'Username'}</th>
                <th className="p-2.5">{isMr ? 'भूमिका' : 'Role'}</th>
                <th className="p-2.5">{getTranslation('mobile', currentLang)}</th>
                <th className="p-2.5">{getTranslation('status', currentLang)}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-slate-50">
                  <td className="p-2.5 font-bold text-slate-900">{u.name}</td>
                  <td className="p-2.5 font-mono text-slate-600">{u.username}</td>
                  <td className="p-2.5">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-100 text-emerald-800">
                      {u.role}
                    </span>
                  </td>
                  <td className="p-2.5 font-mono text-slate-600">{u.mobile || '-'}</td>
                  <td className="p-2.5 text-emerald-700 font-semibold">
                    {isMr ? 'सक्रिय' : 'Active'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'audit' && (
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs space-y-4 text-xs">
          <h3 className="font-bold text-sm text-slate-800 border-b pb-3 flex items-center gap-2">
            <Shield className="w-4 h-4 text-purple-700" />
            <span>{isMr ? 'सिस्टीम क्रिया नोंद' : 'Security & Activity Logs'}</span>
          </h3>

          <div className="max-h-96 overflow-y-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                <tr>
                  <th className="p-2.5">{isMr ? 'वेळ / दिनांक' : 'Timestamp'}</th>
                  <th className="p-2.5">{isMr ? 'क्रिया' : 'Action'}</th>
                  <th className="p-2.5">{isMr ? 'ऑपरेटर' : 'Operator'}</th>
                  <th className="p-2.5">{getTranslation('description', currentLang)}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {auditLogs.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-slate-400">
                      {getTranslation('no_records_found', currentLang)}
                    </td>
                  </tr>
                ) : (
                  auditLogs.map((a) => (
                    <tr key={a.id} className="hover:bg-slate-50">
                      <td className="p-2.5 font-mono text-slate-600">{a.created_at}</td>
                      <td className="p-2.5 font-semibold text-slate-900">{a.action}</td>
                      <td className="p-2.5 font-mono">{a.user_name || 'Admin'}</td>
                      <td className="p-2.5 text-slate-700">{a.details || '-'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Desktop App & Updates Tab */}
      {activeTab === 'updates' && (
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-2xs space-y-6 text-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-emerald-600/10 text-emerald-700 flex items-center justify-center font-bold text-xl border border-emerald-200/50">
                <Laptop className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-slate-800">
                  {isMr ? 'डेस्कटॉप ॲप्लिकेशन व ऑटो-अपडेट व्यवस्था' : 'Desktop Application & Auto-Update System'}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {isMr 
                    ? 'विन्डोज (.exe) इन्स्टॉलर व GitHub क्लाऊडवरून स्वयंचलित अपडेट्स' 
                    : 'Windows (.exe) installer packaging and automatic updates via GitHub Releases'}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleCheckForUpdates}
              disabled={checkingUpdate}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-95 disabled:opacity-50 text-white rounded-xl font-bold flex items-center gap-2 cursor-pointer shadow-xs transition-all"
            >
              <RefreshCw className={`w-4 h-4 ${checkingUpdate ? 'animate-spin' : ''}`} />
              <span>{checkingUpdate ? (isMr ? 'तपासत आहे...' : 'Checking...') : (isMr ? 'नवीन अपडेट तपासा' : 'Check for Updates')}</span>
            </button>
          </div>

          {updateStatusMsg && (
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-700 text-xs flex items-center gap-2 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{updateStatusMsg}</span>
            </div>
          )}

          {/* System Specs & Git Config */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                {isMr ? 'प्रणाली मोड (Platform)' : 'Platform Mode'}
              </span>
              <div className="text-sm font-bold text-slate-900 flex items-center gap-2">
                {isElectron ? (
                  <>
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                    <span>Windows Desktop App (Electron)</span>
                  </>
                ) : (
                  <>
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span>
                    <span>Web Browser Preview</span>
                  </>
                )}
              </div>
              <p className="text-[11px] text-slate-500">
                {isElectron 
                  ? (isMr ? 'ऑफलाइन स्थानिक डेटाबेस सक्रिय' : 'Local offline database active') 
                  : (isMr ? 'वेब कंटेनर प्रिव्ह्यू चालू आहे' : 'Running in Web Container')}
              </p>
            </div>

            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                {isMr ? 'सध्याची आवृत्ती (Version)' : 'Current Version'}
              </span>
              <div className="text-sm font-bold font-mono text-emerald-800">
                v{appVersion}
              </div>
              <p className="text-[11px] text-slate-500">
                {isMr ? 'नवीनतम अधिकृत रिलीज' : 'Latest official release'}
              </p>
            </div>

            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                {isMr ? 'GitHub रिपॉझिटरी' : 'GitHub Repository'}
              </span>
              <div className="text-xs font-mono font-bold text-slate-800 truncate">
                devrupeshgadkhe/rep_KrushiSevaERP
              </div>
              <p className="text-[11px] text-slate-500">
                {isMr ? 'GitHub Actions CI/CD जोडलेले' : 'Automated release provider'}
              </p>
            </div>
          </div>

          {/* How Update & Cloud Build Works */}
          <div className="p-5 rounded-2xl bg-emerald-950 text-white space-y-4">
            <div className="flex items-center gap-2 font-bold text-sm text-emerald-300">
              <GitBranch className="w-4 h-4 text-emerald-400" />
              <span>{isMr ? 'GitHub द्वारे ऑटोमॅटिक .EXE व अपडेट कसे कार्य करते?' : 'Automated Cloud Build & Auto-Update Workflow'}</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs text-emerald-100">
              <div className="p-3 bg-emerald-900/60 rounded-xl border border-emerald-800/80 space-y-1">
                <div className="font-bold text-white text-[12px]">१. GitHub वर कोड पुश</div>
                <p className="text-[11px] text-emerald-200">
                  {isMr 
                    ? 'गुगल एआय स्टुडिओमधून कोड GitHub वर पुश केल्यानंतर, किंवा नवीन टॅग (उदा. v1.0.1) दिल्यानंतर GitHub Actions आपोआप सुरू होते.'
                    : 'Pushing code or creating a release tag triggers GitHub Actions automatically.'}
                </p>
              </div>

              <div className="p-3 bg-emerald-900/60 rounded-xl border border-emerald-800/80 space-y-1">
                <div className="font-bold text-white text-[12px]">२. क्लाऊडवर .EXE निर्मिती</div>
                <p className="text-[11px] text-emerald-200">
                  {isMr 
                    ? 'GitHub चा विंडोज सर्व्हर आपोआप .exe आणि latest.yml तयार करतो आणि ती थेट Releases मध्ये सुरक्षितपणे पब्लिश करतो.'
                    : 'GitHub Actions builds the Windows installer (.exe) & latest.yml and attaches them to the Release.'}
                </p>
              </div>

              <div className="p-3 bg-emerald-900/60 rounded-xl border border-emerald-800/80 space-y-1">
                <div className="font-bold text-white text-[12px]">३. ॲपमध्ये स्वयंचलित अपडेट</div>
                <p className="text-[11px] text-emerald-200">
                  {isMr 
                    ? 'सर्व ग्राहकांच्या डेस्कटॉपवर नवीन व्हर्जनचे नोटिफिकेशन येते व एका क्लिकवर अपडेट डाऊनलोड होऊन ॲप नवीन व्हर्जनसह रीस्टार्ट होते.'
                    : 'Client desktop apps detect the new release, display an update prompt, and update seamlessly on restart.'}
                </p>
              </div>
            </div>

            <div className="pt-2 border-t border-emerald-800/80 text-[11px] text-emerald-300 flex flex-wrap items-center justify-between gap-2">
              <span>
                {isMr 
                  ? 'स्थानिक विन्डोज बिल्डसाठी कमांड: npm run electron:build' 
                  : 'Manual local command: npm run electron:build (Outputs to release/ folder)'}
              </span>
              <span className="font-mono text-white bg-emerald-900 px-2 py-0.5 rounded border border-emerald-700">
                Target: release/Krushi Seva ERP Setup.exe
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
