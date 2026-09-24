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
  ShieldCheck,
  RefreshCw,
  ExternalLink,
  Activity,
  Lock,
  Clock,
  AlertTriangle,
  Trash2,
  X
} from 'lucide-react';
import { AppLanguage, BusinessSettings, InvoiceSettings, User } from '../types';
import { getTranslation } from '../i18n';
import { dbService } from '../services/api';
import { useFeedback } from '../components/common/FeedbackContext';
import { updateService, UpdateState } from '../services/updateService';

interface SettingsProps {
  currentLang: AppLanguage;
  onSettingsSaved?: () => void;
}

export const Settings: React.FC<SettingsProps> = ({ currentLang, onSettingsSaved }) => {
  const { showToast } = useFeedback();
  const isMr = currentLang === 'mr';

  const [activeTab, setActiveTab] = useState<'shop' | 'invoice' | 'users' | 'audit' | 'updates' | 'danger'>('shop');
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  // Hard Reset Modal State
  const [showResetModal, setShowResetModal] = useState(false);
  const [wipeProducts, setWipeProducts] = useState(true);
  const [wipeCustomers, setWipeCustomers] = useState(false);
  const [wipeSuppliers, setWipeSuppliers] = useState(false);
  const [confirmedCheck, setConfirmedCheck] = useState(false);
  const [confirmInput, setConfirmInput] = useState('');
  const [resetting, setResetting] = useState(false);

  // Desktop App & Update State
  const [updateState, setUpdateState] = useState<UpdateState>(updateService.getState());
  const isElectron = updateState.isElectron;
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [updateStatusMsg, setUpdateStatusMsg] = useState<string | null>(null);

  useEffect(() => {
    const unsub = updateService.subscribe(setUpdateState);
    return unsub;
  }, []);

  const handleCheckForUpdates = async () => {
    setCheckingUpdate(true);
    setUpdateStatusMsg(null);
    try {
      const state = await updateService.checkForUpdates(isElectron);
      if (!state.isElectron) {
        setUpdateStatusMsg(
          isMr 
            ? `सध्या तुम्ही वेब प्रिव्ह्यू मोडमध्ये आहात (v${state.currentVersion}). अधिकृत विन्डोज डेस्कटॉप ॲप (.exe) स्वयंचलितपणे बॅकग्राऊंडमध्ये अपडेट होते.`
            : `Currently in Web Preview mode (v${state.currentVersion}). The Windows Desktop app automatically updates in the background.`
        );
      } else if (state.hasUpdate) {
        setUpdateStatusMsg(
          isMr 
            ? `नवीन व्हर्जन v${state.latestVersion} उपलब्ध आहे! बॅकग्राऊंडमध्ये ऑटो-डाऊनलोड सुरू झाले आहे.`
            : `New version v${state.latestVersion} detected! Auto-download initiated in background.`
        );
      } else {
        setUpdateStatusMsg(
          isMr 
            ? `तुमचे सॉफ्टवेअर नवीनतम व्हर्जन (v${state.currentVersion}) वर अद्ययावत आहे.`
            : `Your software is already on the latest version (v${state.currentVersion}).`
        );
      }
    } catch (err: any) {
      setUpdateStatusMsg(err.message || 'Update check failed');
    } finally {
      setCheckingUpdate(false);
    }
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
      showToast(isMr ? 'दुकानाची माहिती यशस्वीरित्या सेव्ह झाली.' : 'Business details saved successfully.', 'success');
      setTimeout(() => setSuccessMsg(''), 3000);
      onSettingsSaved?.();
    } catch (err: any) {
      showToast((isMr ? 'माहिती सेव्ह करताना त्रुटी आली: ' : 'Error saving business settings: ') + err.message, 'error');
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
      showToast(isMr ? 'पावती प्रिंटिंग सेटिंग्ज यशस्वीरित्या सेव्ह झाली.' : 'Invoice settings saved successfully.', 'success');
      setTimeout(() => setSuccessMsg(''), 3000);
      onSettingsSaved?.();
    } catch (err: any) {
      showToast((isMr ? 'सेटिंग्ज सेव्ह करताना त्रुटी आली: ' : 'Error saving invoice settings: ') + err.message, 'error');
    }
  };

  const handleExecuteHardReset = async () => {
    if (!confirmedCheck || confirmInput.trim().toUpperCase() !== 'RESET') {
      showToast(isMr ? 'कृपया तपासणी बॉक्स निवडा आणि "RESET" टाईप करा.' : 'Please check the box and type "RESET" to confirm.', 'error');
      return;
    }

    setResetting(true);
    try {
      await dbService.hardResetDatabase({
        wipeProducts,
        wipeCustomers,
        wipeSuppliers,
      });
      showToast(
        isMr 
          ? 'हार्ड रीसेट यशस्वीरित्या पूर्ण झाले. निवडलेला डेटा नष्ट करण्यात आला आहे.' 
          : 'Hard reset completed successfully. Selected data has been wiped.', 
        'success'
      );
      setShowResetModal(false);
      setConfirmInput('');
      setConfirmedCheck(false);
      onSettingsSaved?.();
      // Reload page to refresh all active queries and in-memory caches cleanly
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (err: any) {
      showToast((isMr ? 'रीसेट करताना त्रुटी आली: ' : 'Error during hard reset: ') + err.message, 'error');
    } finally {
      setResetting(false);
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

          <div className="flex items-center gap-2">
            {successMsg && (
              <div className="px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-300 text-xs font-bold flex items-center gap-1.5 animate-in fade-in">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>{successMsg}</span>
              </div>
            )}
            <button
              type="button"
              onClick={() => {
                setShowResetModal(true);
                setConfirmInput('');
                setConfirmedCheck(false);
              }}
              className="px-3.5 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold text-xs flex items-center gap-1.5 cursor-pointer transition-colors shadow-2xs"
            >
              <AlertTriangle className="w-4 h-4 text-rose-600" />
              <span>{isMr ? 'हार्ड रीसेट' : 'Hard Reset'}</span>
            </button>
          </div>
        </div>

        {/* Tab Selection */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 text-xs">
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
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>{isMr ? 'सिस्टीम व अपडेट्स' : 'System & Updates'}</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('danger')}
            className={`px-3 py-1.5 rounded-lg font-bold transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'danger'
                ? 'bg-rose-700 text-white'
                : 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
            <span>{isMr ? 'धोकादायक क्षेत्र / हार्ड रीसेट' : 'Danger Zone / Hard Reset'}</span>
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

      {/* System Status & Continuous Updates Tab */}
      {activeTab === 'updates' && (
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-2xs space-y-6 text-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-emerald-600/10 text-emerald-700 flex items-center justify-center font-bold text-xl border border-emerald-200/50">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-slate-800 flex items-center gap-2">
                  <span>{isMr ? 'सिस्टीम स्थिती व स्वयंचलित अपडेट केंद्र' : 'System Status & Continuous Update Center'}</span>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse"></span>
                    {isMr ? 'सक्रिय' : 'Live'}
                  </span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {isMr 
                    ? 'सुरक्षित व अखंडित स्वयंचलित अद्ययावतीकरण (Continuous Automated Updates) व सुरक्षा प्रमाणपत्र' 
                    : 'Continuous automated updates with 256-bit encrypted data integrity and security certifications'}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleCheckForUpdates}
              disabled={checkingUpdate}
              className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 active:scale-95 disabled:opacity-50 text-white rounded-xl font-bold flex items-center gap-2 cursor-pointer shadow-xs transition-all"
            >
              <RefreshCw className={`w-4 h-4 ${checkingUpdate ? 'animate-spin' : ''}`} />
              <span>{checkingUpdate ? (isMr ? 'तपासत आहे...' : 'Checking...') : (isMr ? 'अपडेट तपासा' : 'Check for Updates')}</span>
            </button>
          </div>

          {updateStatusMsg && (
            <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex items-center gap-2 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span className="font-medium">{updateStatusMsg}</span>
            </div>
          )}

          {/* System Status Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-emerald-600" />
                <span>{isMr ? 'प्रणाली दर्जा व सुरक्षा' : 'System Security'}</span>
              </span>
              <div className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                <span>{isMr ? 'अधिकृत प्रमाणित आवृत्ती' : 'Official Certified Edition'}</span>
              </div>
              <p className="text-[11px] text-slate-500">
                {isMr ? 'स्थानिक ऑफलाइन सुरक्षित एनक्रिप्शन सक्रिय' : 'Local encrypted offline storage active'}
              </p>
            </div>

            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-emerald-600" />
                <span>{isMr ? 'सध्याची आवृत्ती' : 'Installed Version'}</span>
              </span>
              <div className="text-sm font-bold font-mono text-emerald-800">
                v{updateState.currentVersion}
                {updateState.latestVersion && updateState.hasUpdate && (
                  <span className="ml-2 text-xs text-amber-600 font-bold">
                    ➔ v{updateState.latestVersion} ({isMr ? 'नवीन' : 'New'})
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-500">
                {updateState.hasUpdate 
                  ? (isMr ? 'नवीन सुरक्षित अपडेट उपलब्ध आहे' : 'New secure update available')
                  : (isMr ? 'नवीनतम अधिकृत रिलीज कार्यरत' : 'Running latest official release')}
              </p>
            </div>

            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-emerald-600" />
                <span>{isMr ? 'स्वयंचलित तपासणी' : 'Continuous Monitor'}</span>
              </span>
              <div className="text-xs font-bold text-emerald-800 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <span>{isMr ? 'पार्श्वभूमीत अविरत सुरू (३० सेकंद)' : 'Active (Every 30 Seconds)'}</span>
              </div>
              <p className="text-[11px] text-slate-500">
                {updateState.lastCheckedTime ? (
                  <span>{isMr ? 'शेवटची तपासणी: ' : 'Last verified: '} 
                    <strong className="font-mono text-slate-700">
                      {new Date(updateState.lastCheckedTime).toLocaleTimeString(isMr ? 'mr-IN' : 'en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </strong>
                  </span>
                ) : (
                  <span>{isMr ? 'पार्श्वभूमी पडताळणी कार्यरत' : 'Background monitoring active'}</span>
                )}
              </p>
            </div>
          </div>

          {/* Security & Continuous Update Architecture Banner */}
          <div className="p-5 rounded-2xl bg-emerald-950 text-white space-y-4">
            <div className="flex items-center gap-2 font-bold text-sm text-emerald-300">
              <Lock className="w-4 h-4 text-emerald-400" />
              <span>{isMr ? 'स्वयंचलित सुरक्षितता व अखंडित अद्ययावतीकरण धोरण' : 'Automated Security & Continuous Update Policy'}</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs text-emerald-100">
              <div className="p-3 bg-emerald-900/60 rounded-xl border border-emerald-800/80 space-y-1">
                <div className="font-bold text-white text-[12px] flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                  <span>{isMr ? '१. अखंडित पार्श्वभूमी तपासणी' : '1. Continuous Auto-Monitoring'}</span>
                </div>
                <p className="text-[11px] text-emerald-200">
                  {isMr 
                    ? 'अप्लिकेशन चालू असताना दर ३० सेकंदांनी, इंटरनेट सक्रिय होताच आणि विंडो सुरू झाल्यावर नवीन सुधारणांची स्वयंचलित पडताळणी होते.'
                    : 'System continuously checks for official updates every 30 seconds, on network restoration, and on window focus.'}
                </p>
              </div>

              <div className="p-3 bg-emerald-900/60 rounded-xl border border-emerald-800/80 space-y-1">
                <div className="font-bold text-white text-[12px] flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                  <span>{isMr ? '२. शून्य-व्यत्यय सुरक्षित डाऊनलोड' : '2. Zero-Interruption Update'}</span>
                </div>
                <p className="text-[11px] text-emerald-200">
                  {isMr 
                    ? 'नवीन सुधारणा उपलब्ध झाल्यास चालू बिलिंग अथवा हिशोबात कोणताही अडथळा न आणता सुरक्षित पॅच पार्श्वभूमीत डाऊनलोड होतो.'
                    : 'Updates download securely in the background without disturbing active billing or accounting operations.'}
                </p>
              </div>

              <div className="p-3 bg-emerald-900/60 rounded-xl border border-emerald-800/80 space-y-1">
                <div className="font-bold text-white text-[12px] flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                  <span>{isMr ? '३. संपूर्ण डेटा एनक्रिप्शन व सुरक्षितता' : '3. Total Data Encryption'}</span>
                </div>
                <p className="text-[11px] text-emerald-200">
                  {isMr 
                    ? 'सर्व ग्राहक, साठा आणि आर्थिक व्यवहार स्थानिक पातळीवर १००% सुरक्षित एनक्रिप्शनसह जतन केले जातात. बाह्य धोका नाही.'
                    : 'All customer records, stock inventory, and fiscal accounts remain fully encrypted with zero unauthorized exposure.'}
                </p>
              </div>
            </div>

            <div className="pt-2 border-t border-emerald-800/80 text-[11px] text-emerald-300 flex flex-wrap items-center justify-between gap-2">
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>
                  {isMr 
                    ? 'डेटा सुरक्षितता मानके: 256-Bit SSL/TLS सुरक्षित डेटा ट्रान्सफर व एनक्रिप्टेड स्थानिक साठा' 
                    : 'Data Security Standard: 256-Bit SSL/TLS Protected Transfer & Encrypted Local Storage'}
                </span>
              </span>
              <span className="text-white bg-emerald-900 px-2 py-0.5 rounded border border-emerald-700 font-semibold">
                {isMr ? 'सुरक्षित व प्रमाणित' : 'Protected & Certified'}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Danger Zone / Hard Reset Tab */}
      {activeTab === 'danger' && (
        <div className="bg-white p-6 rounded-xl border border-rose-200 shadow-2xs space-y-6 text-xs">
          <div className="flex items-start gap-4 p-4 rounded-xl bg-rose-50 border border-rose-200">
            <div className="p-3 bg-rose-100 rounded-full text-rose-700 shrink-0">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold text-rose-900">
                {isMr ? 'धोकादायक क्षेत्र: सिस्टम हार्ड रीसेट (Hard Reset)' : 'Danger Zone: System Hard Reset'}
              </h3>
              <p className="text-xs text-rose-800 leading-relaxed">
                {isMr 
                  ? 'हार्ड रीसेट केल्याने तुमच्या स्थानिक डेटाबेसमधील सर्व विक्री नोंदी (Sales Invoices), स्टॉक आणि बॅचेस (Inventory Batches), खरेदी (Purchases), खर्च आणि उत्पादने कायमची नष्ट होतील. हा बदल पूर्ववत करता येणार नाही.'
                  : 'Hard reset permanently purges sales invoices, stock inventory batches, purchases, expenses and product catalog directly from the local SQLite database. This action is irreversible.'}
              </p>
            </div>
          </div>

          <div className="border border-slate-200 rounded-xl p-5 space-y-4">
            <h4 className="font-bold text-sm text-slate-800">
              {isMr ? 'डेटा रीसेट पर्याय व सुरक्षितता नियम:' : 'Data Reset Guidelines & Safety Standards:'}
            </h4>
            <ul className="space-y-2 text-slate-600 list-disc pl-5">
              <li>{isMr ? 'सर्व जुने बिलिंग, जीएसटी नोंदी आणि विक्री इतिहास नष्ट होतो.' : 'All billing, GST records and sales invoices are removed.'}</li>
              <li>{isMr ? 'गोदाम साठा, बॅचेस व एक्सपायरी ट्रॅकिंग रीसेट होते.' : 'Godown inventory, batches and stock ledger are wiped.'}</li>
              <li>{isMr ? 'तुम्ही उत्पादने आणि शेतकरी खात्यांचे पर्याय हवे असल्यास सुरक्षित ठेवू शकता.' : 'You can optionally retain farmer khata or product catalog.'}</li>
              <li>{isMr ? 'विंडोज अ‍ॅप्लिकेशन ब्लॉक न करता सुरक्षित इन-अ‍ॅप मोडल पुष्टीकरण वापरले जाते.' : 'Uses a non-blocking in-app modal verification designed for desktop ERP.'}</li>
            </ul>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
              <div>
                <span className="font-bold text-slate-800 block text-xs">
                  {isMr ? 'संपूर्ण सिस्टीम पूर्ववत रीसेट करा' : 'Reset System Data to Clean State'}
                </span>
                <span className="text-[11px] text-slate-500">
                  {isMr ? 'डेटा हटवण्यापूर्वी मोडलमध्ये पुष्टीकरण विचारले जाईल.' : 'A secure confirmation modal will appear before wiping.'}
                </span>
              </div>

              <button
                type="button"
                onClick={() => {
                  setShowResetModal(true);
                  setConfirmInput('');
                  setConfirmedCheck(false);
                }}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 active:scale-95 text-white font-bold rounded-lg flex items-center gap-2 cursor-pointer shadow-xs transition-all"
              >
                <Trash2 className="w-4 h-4" />
                <span>{isMr ? 'हार्ड रीसेट सुरू करा' : 'Initiate Hard Reset'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Non-Blocking Custom Modal Confirmation Dialog */}
      {showResetModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full overflow-hidden text-xs">
            {/* Modal Header */}
            <div className="bg-rose-600 px-5 py-4 text-white flex items-center justify-between">
              <div className="flex items-center gap-2 font-bold text-sm">
                <AlertTriangle className="w-5 h-5 text-rose-200" />
                <span>{isMr ? 'सिस्टम हार्ड रीसेट पुष्टीकरण' : 'System Hard Reset Confirmation'}</span>
              </div>
              <button
                type="button"
                onClick={() => setShowResetModal(false)}
                className="text-white/80 hover:text-white p-1 rounded-md hover:bg-rose-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 space-y-4">
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-900 text-xs">
                <strong>{isMr ? 'सावधानता:' : 'Warning:'}</strong>{' '}
                {isMr 
                  ? 'ही कृती अपरिवर्तनीय आहे. निवडलेला डेटा स्थानिक SQLite डेटाबेसमधून कायमचा डिलीट केला जाईल.' 
                  : 'This action is permanent and cannot be reversed. Selected data will be permanently wiped from the SQLite database.'}
              </div>

              <div className="space-y-2">
                <span className="font-bold text-slate-800 block">
                  {isMr ? 'कोणता डेटा डिलीट करायचा ते निवडा:' : 'Select data to delete:'}
                </span>

                <div className="space-y-2 bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <label className="flex items-center gap-2 cursor-pointer font-semibold text-slate-800">
                    <input
                      type="checkbox"
                      checked={true}
                      disabled
                      className="w-4 h-4 rounded text-rose-600 border-slate-300"
                    />
                    <span>{isMr ? 'विक्री नोंदी व बिले (Sales & Invoices) [अनिवार्य]' : 'Sales Invoices & Line Items [Mandatory]'}</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer font-semibold text-slate-800">
                    <input
                      type="checkbox"
                      checked={true}
                      disabled
                      className="w-4 h-4 rounded text-rose-600 border-slate-300"
                    />
                    <span>{isMr ? 'साठा, बॅचेस व लेजर (Inventory & Stock Ledger) [अनिवार्य]' : 'Inventory Batches & Stock Ledger [Mandatory]'}</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer font-semibold text-slate-800">
                    <input
                      type="checkbox"
                      checked={wipeProducts}
                      onChange={(e) => setWipeProducts(e.target.checked)}
                      className="w-4 h-4 rounded text-rose-600 border-slate-300"
                    />
                    <span>{isMr ? 'उत्पादने मास्टर डेटा (Products Master Catalog)' : 'Products Master Catalog'}</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer text-slate-700">
                    <input
                      type="checkbox"
                      checked={wipeCustomers}
                      onChange={(e) => setWipeCustomers(e.target.checked)}
                      className="w-4 h-4 rounded text-rose-600 border-slate-300"
                    />
                    <span>{isMr ? 'शेतकरी / ग्राहक खाती (Farmers & Customer Khata)' : 'Farmers & Customer Khata'}</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer text-slate-700">
                    <input
                      type="checkbox"
                      checked={wipeSuppliers}
                      onChange={(e) => setWipeSuppliers(e.target.checked)}
                      className="w-4 h-4 rounded text-rose-600 border-slate-300"
                    />
                    <span>{isMr ? 'सप्लायर खाती व खरेदी (Suppliers & Purchases)' : 'Suppliers & Purchases'}</span>
                  </label>
                </div>
              </div>

              {/* Confirmation Checkbox */}
              <label className="flex items-start gap-2 cursor-pointer p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-xs">
                <input
                  type="checkbox"
                  checked={confirmedCheck}
                  onChange={(e) => setConfirmedCheck(e.target.checked)}
                  className="w-4 h-4 rounded text-rose-600 border-amber-400 mt-0.5"
                />
                <span className="font-semibold">
                  {isMr 
                    ? 'मला समजले आहे की हा डेटा कायमचा नष्ट होईल आणि पूर्ववत करता येणार नाही.' 
                    : 'I understand that this action is irreversible and the selected data will be permanently wiped.'}
                </span>
              </label>

              {/* Verification Text Input */}
              <div className="space-y-1">
                <label className="font-bold text-slate-700 block">
                  {isMr ? 'पुष्टी करण्यासाठी खाली "RESET" टाइप करा:' : 'Type "RESET" below to confirm:'}
                </label>
                <input
                  type="text"
                  value={confirmInput}
                  onChange={(e) => setConfirmInput(e.target.value)}
                  placeholder="RESET"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono font-bold tracking-wider focus:outline-rose-500 bg-slate-50 uppercase"
                />
              </div>
            </div>

            {/* Modal Actions Footer */}
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowResetModal(false)}
                disabled={resetting}
                className="px-4 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs cursor-pointer transition-colors"
              >
                {isMr ? 'रद्द करा' : 'Cancel'}
              </button>

              <button
                type="button"
                onClick={handleExecuteHardReset}
                disabled={!confirmedCheck || confirmInput.trim().toUpperCase() !== 'RESET' || resetting}
                className="px-5 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-xs flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                <span>
                  {resetting 
                    ? (isMr ? 'डेटा नष्ट करत आहे...' : 'Resetting...') 
                    : (isMr ? 'कायमचा डेटा नष्ट करा' : 'Permanently Wipe Data')}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
