import React, { useState, useEffect, useRef } from 'react';
import { Search, X, Package, User, FileText, Truck, ArrowRight } from 'lucide-react';
import { AppLanguage, Product, Customer, Sale, Supplier } from '../../types';
import { getTranslation } from '../../i18n';
import { dbService } from '../../services/api';
import { formatINR } from '../../utils/formatters';

interface GlobalSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentLang: AppLanguage;
  onNavigate: (tab: any, id?: number) => void;
}

export const GlobalSearchModal: React.FC<GlobalSearchModalProps> = ({
  isOpen,
  onClose,
  currentLang,
  onNavigate,
}) => {
  const isMr = currentLang === 'mr';
  const [query, setQuery] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setQuery('');
      setProducts([]);
      setCustomers([]);
      setSales([]);
      setSuppliers([]);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!query.trim() || query.length < 2) {
      setProducts([]);
      setCustomers([]);
      setSales([]);
      setSuppliers([]);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const [prods, custs, salesList, supps] = await Promise.all([
          dbService.getProducts(query),
          dbService.getCustomers(query),
          dbService.getSales(query),
          dbService.getSuppliers(query),
        ]);
        setProducts(prods.slice(0, 5));
        setCustomers(custs.slice(0, 5));
        setSales(salesList.slice(0, 5));
        setSuppliers(supps.slice(0, 5));
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [query]);

  if (!isOpen) return null;

  const hasResults = products.length > 0 || customers.length > 0 || sales.length > 0 || suppliers.length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 bg-black/60 backdrop-blur-xs p-4">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-100">
        {/* Search Input Box */}
        <div className="flex items-center px-4 py-3 border-b border-slate-200 bg-slate-50 gap-3">
          <Search className="w-5 h-5 text-emerald-600" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={getTranslation('search_placeholder', currentLang)}
            className="flex-1 bg-transparent border-none text-slate-800 placeholder-slate-400 focus:outline-none text-sm font-medium"
          />
          {query && (
            <button 
              type="button"
              onClick={() => setQuery('')} 
              className="text-slate-400 hover:text-slate-600"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <kbd className="text-[10px] bg-slate-200 text-slate-600 px-2 py-0.5 rounded border border-slate-300">
            ESC
          </kbd>
        </div>

        {/* Results Area */}
        <div className="max-h-96 overflow-y-auto p-3 space-y-4">
          {loading && (
            <div className="py-8 text-center text-xs text-slate-500">
              {isMr ? 'शोधत आहे...' : 'Searching records...'}
            </div>
          )}

          {!loading && query.length >= 2 && !hasResults && (
            <div className="py-8 text-center text-xs text-slate-500">
              {isMr ? `"${query}" साठी कोणतीही नोंद आढळली नाही.` : `No records found matching "${query}".`}
            </div>
          )}

          {/* Products */}
          {products.length > 0 && (
            <div>
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-2 mb-1.5 flex items-center gap-1.5">
                <Package className="w-3.5 h-3.5 text-emerald-600" />
                <span>{getTranslation('nav_products', currentLang)}</span>
              </div>
              <div className="space-y-1">
                {products.map((p) => (
                  <div
                    key={p.id}
                    onClick={() => {
                      onClose();
                      onNavigate('products', p.id);
                    }}
                    className="flex items-center justify-between p-2 rounded-lg hover:bg-emerald-50 cursor-pointer border border-transparent hover:border-emerald-200 transition-colors"
                  >
                    <div>
                      <div className="text-xs font-semibold text-slate-800">
                        {isMr ? (p.name_mr || p.name) : p.name}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {p.category} • {p.pack_size} • MRP: {formatINR(p.mrp)}
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-bold text-emerald-700 font-mono">
                        {formatINR(p.selling_rate)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Customers / Farmers */}
          {customers.length > 0 && (
            <div>
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-2 mb-1.5 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-blue-600" />
                <span>{getTranslation('nav_farmers', currentLang)}</span>
              </div>
              <div className="space-y-1">
                {customers.map((c) => (
                  <div
                    key={c.id}
                    onClick={() => {
                      onClose();
                      onNavigate('farmers', c.id);
                    }}
                    className="flex items-center justify-between p-2 rounded-lg hover:bg-blue-50 cursor-pointer border border-transparent hover:border-blue-200 transition-colors"
                  >
                    <div>
                      <div className="text-xs font-semibold text-slate-800">
                        {isMr ? (c.name_mr || c.name) : c.name}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {isMr ? 'गाव' : 'Village'}: {c.village} • {isMr ? 'मोबाईल' : 'Mobile'}: {c.mobile}
                      </div>
                    </div>
                    <div className="text-right">
                      <span className={`text-xs font-semibold font-mono ${c.current_balance > 0 ? 'text-rose-600' : 'text-slate-600'}`}>
                        {isMr ? 'बाकी' : 'Balance'}: {formatINR(c.current_balance)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Sales Invoices */}
          {sales.length > 0 && (
            <div>
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-2 mb-1.5 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-purple-600" />
                <span>{getTranslation('nav_sales', currentLang)}</span>
              </div>
              <div className="space-y-1">
                {sales.map((s) => (
                  <div
                    key={s.id}
                    onClick={() => {
                      onClose();
                      onNavigate('sales', s.id);
                    }}
                    className="flex items-center justify-between p-2 rounded-lg hover:bg-purple-50 cursor-pointer border border-transparent hover:border-purple-200 transition-colors"
                  >
                    <div>
                      <div className="text-xs font-semibold text-slate-800">
                        {s.invoice_no} — {s.customer_name}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {s.invoice_date} • {s.payment_mode}
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-bold text-slate-900 font-mono">
                        {formatINR(s.grand_total)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Suppliers */}
          {suppliers.length > 0 && (
            <div>
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-2 mb-1.5 flex items-center gap-1.5">
                <Truck className="w-3.5 h-3.5 text-amber-600" />
                <span>{getTranslation('nav_suppliers', currentLang)}</span>
              </div>
              <div className="space-y-1">
                {suppliers.map((sup) => (
                  <div
                    key={sup.id}
                    onClick={() => {
                      onClose();
                      onNavigate('suppliers', sup.id);
                    }}
                    className="flex items-center justify-between p-2 rounded-lg hover:bg-amber-50 cursor-pointer border border-transparent hover:border-amber-200 transition-colors"
                  >
                    <div>
                      <div className="text-xs font-semibold text-slate-800">
                        {sup.name} ({sup.company})
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {sup.city} • GST: {sup.gstin || '-'}
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-semibold text-amber-700 font-mono">
                        {isMr ? 'बाकी' : 'Balance'}: {formatINR(sup.current_balance)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2 bg-slate-100 border-t border-slate-200 flex justify-between items-center text-[11px] text-slate-500">
          <span>{isMr ? 'पाहण्यासाठी कोणत्याही नोंदीवर क्लिक करा' : 'Click any result to view details'}</span>
          <button
            type="button"
            onClick={onClose}
            className="px-2.5 py-1 rounded bg-slate-200 hover:bg-slate-300 text-slate-700 font-medium cursor-pointer"
          >
            {getTranslation('cancel', currentLang)}
          </button>
        </div>
      </div>
    </div>
  );
};
