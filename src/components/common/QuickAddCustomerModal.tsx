import React, { useState } from 'react';
import { X, UserPlus, Phone, MapPin, CreditCard, ShieldCheck } from 'lucide-react';
import { AppLanguage, Customer } from '../../types';
import { dbService } from '../../services/api';
import { useFeedback } from './FeedbackContext';

interface QuickAddCustomerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCustomerCreated: (customer: Customer) => void;
  currentLang: AppLanguage;
}

export const QuickAddCustomerModal: React.FC<QuickAddCustomerModalProps> = ({
  isOpen,
  onClose,
  onCustomerCreated,
  currentLang,
}) => {
  const { showToast } = useFeedback();
  const isMr = currentLang === 'mr';

  const [name, setName] = useState('');
  const [nameMr, setNameMr] = useState('');
  const [mobile, setMobile] = useState('');
  const [village, setVillage] = useState('');
  const [aadhar, setAadhar] = useState('');
  const [creditLimit, setCreditLimit] = useState(10000);
  const [openingBalance, setOpeningBalance] = useState(0);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      showToast(isMr ? 'कृपया ग्राहकाचे नाव प्रविष्ट करा.' : 'Please enter customer name.', 'warning');
      return;
    }

    if (!mobile.trim() || mobile.trim().length < 10) {
      showToast(isMr ? 'कृपया वैध 10 अंकी मोबाईल नंबर प्रविष्ट करा.' : 'Please enter valid 10-digit mobile number.', 'warning');
      return;
    }

    setLoading(true);
    try {
      const payload: Partial<Customer> = {
        name: name.trim(),
        name_mr: nameMr.trim() || undefined,
        mobile: mobile.trim(),
        village: village.trim() || (isMr ? 'स्थानिक' : 'Local'),
        aadhar_no: aadhar.trim() || undefined,
        credit_limit: creditLimit,
        opening_balance: openingBalance,
        current_balance: openingBalance,
        active: true,
      };

      const newId = await dbService.createCustomer(payload);
      const createdCustomer: Customer = {
        id: newId,
        customer_code: `CUST-${newId}`,
        name: payload.name || '',
        name_mr: payload.name_mr,
        mobile: payload.mobile || '',
        village: payload.village || '',
        taluka: 'बारामती',
        district: 'पुणे',
        aadhar_no: payload.aadhar_no,
        credit_limit: payload.credit_limit || 50000,
        opening_balance: payload.opening_balance || 0,
        current_balance: payload.current_balance || 0,
        active: true,
        created_at: new Date().toISOString(),
      };

      showToast(
        isMr ? `${name} ग्राहक यशस्वीरित्या जोडला!` : `Customer ${name} added successfully!`,
        'success'
      );

      onCustomerCreated(createdCustomer);
      onClose();
    } catch (err: any) {
      console.error(err);
      showToast(err.message || (isMr ? 'ग्राहक जोडताना त्रुटी आली.' : 'Error adding customer.'), 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-400">
              <UserPlus className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm leading-tight">
                {isMr ? 'नवीन शेतकरी / ग्राहक जोडा' : 'Add New Customer / Farmer'}
              </h3>
              <p className="text-[11px] text-slate-400">
                {isMr ? 'विक्री बिलासाठी त्वरित ग्राहक नोंदणी' : 'Quick registration for sales billing'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-3.5">
          {/* Name & Marathi Name */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              {isMr ? 'शेतकऱ्याचे / ग्राहकाचे पूर्ण नाव' : 'Full Name'} <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={isMr ? 'उदा. रमेश ज्ञानोबा पाटील' : 'e.g. Ramesh Patil'}
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:outline-emerald-600 font-semibold text-slate-900"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Mobile */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {isMr ? 'मोबाईल नंबर' : 'Mobile Number'} <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <Phone className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                <input
                  type="tel"
                  required
                  maxLength={10}
                  value={mobile}
                  onChange={(e) => setMobile(e.target.value.replace(/\D/g, ''))}
                  placeholder="98XXXXXXXX"
                  className="w-full pl-8 pr-2.5 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:outline-emerald-600 font-mono font-semibold"
                />
              </div>
            </div>

            {/* Village */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {isMr ? 'गाव / पत्ता' : 'Village / Area'}
              </label>
              <div className="relative">
                <MapPin className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                <input
                  type="text"
                  value={village}
                  onChange={(e) => setVillage(e.target.value)}
                  placeholder={isMr ? 'उदा. लातूर' : 'e.g. Latur'}
                  className="w-full pl-8 pr-2.5 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:outline-emerald-600 text-slate-800"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Aadhar */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                {isMr ? 'आधार नंबर (पर्यायी)' : 'Aadhar No (Optional)'}
              </label>
              <input
                type="text"
                maxLength={12}
                value={aadhar}
                onChange={(e) => setAadhar(e.target.value.replace(/\D/g, ''))}
                placeholder="12 अंकी आधार"
                className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg font-mono"
              />
            </div>

            {/* Credit Limit */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                {isMr ? 'उधारी मर्यादा (₹)' : 'Credit Limit (₹)'}
              </label>
              <input
                type="number"
                step="500"
                value={creditLimit}
                onChange={(e) => setCreditLimit(parseFloat(e.target.value) || 0)}
                className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg font-mono font-bold text-slate-800"
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-2 flex items-center justify-end gap-2.5 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 rounded-lg border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-100 cursor-pointer transition-colors"
            >
              {isMr ? 'रद्द करा' : 'Cancel'}
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white text-xs font-bold shadow-xs cursor-pointer transition-colors flex items-center gap-1.5"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>{loading ? (isMr ? 'जोडत आहे...' : 'Saving...') : (isMr ? 'ग्राहक जोडा आणि निवडा' : 'Add & Select')}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
