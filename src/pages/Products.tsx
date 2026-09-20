import React, { useState, useEffect } from 'react';
import { 
  Package, 
  Plus, 
  Search, 
  Edit, 
  Trash2, 
  Download, 
  Filter, 
  Barcode, 
  CheckCircle2, 
  AlertTriangle,
  Layers,
  Percent
} from 'lucide-react';
import { Product, ProductCategory, AppLanguage } from '../types';
import { getTranslation } from '../i18n';
import { formatINR, exportToCSV } from '../utils/formatters';
import { dbService } from '../services/api';
import { useFeedback } from '../components/common/FeedbackContext';

interface ProductsProps {
  currentLang: AppLanguage;
  onRefreshData?: () => void;
}

export const Products: React.FC<ProductsProps> = ({ currentLang, onRefreshData }) => {
  const { showToast, showConfirm } = useFeedback();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  // Form Fields (Clean initial state, NO hardcoded dummy data)
  const [productCode, setProductCode] = useState('');
  const [name, setName] = useState('');
  const [nameMr, setNameMr] = useState('');
  const [brand, setBrand] = useState('');
  const [category, setCategory] = useState<ProductCategory>('Fertilizers');
  const [hsnCode, setHsnCode] = useState('');
  const [unit, setUnit] = useState('Bags');
  const [packSize, setPackSize] = useState('');
  const [purchaseRate, setPurchaseRate] = useState<number>(0);
  const [mrp, setMrp] = useState<number>(0);
  const [sellingRate, setSellingRate] = useState<number>(0);
  const [gstRate, setGstRate] = useState<number>(0);
  const [lowStockAlert, setLowStockAlert] = useState<number>(0);
  const [barcode, setBarcode] = useState('');
  const [technicalName, setTechnicalName] = useState('');
  const [toxicityColor, setToxicityColor] = useState('');
  const [openingStock, setOpeningStock] = useState<number | ''>(10);

  const loadProducts = async () => {
    setLoading(true);
    try {
      const list = await dbService.getProducts(search, categoryFilter);
      setProducts(list);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProducts();
  }, [search, categoryFilter]);

  const handleOpenAdd = () => {
    setEditingProduct(null);
    setProductCode('');
    setName('');
    setNameMr('');
    setBrand('');
    setCategory('Fertilizers');
    setHsnCode('');
    setUnit('Bags');
    setPackSize('');
    setPurchaseRate(0);
    setMrp(0);
    setSellingRate(0);
    setGstRate(0);
    setLowStockAlert(0);
    setBarcode('');
    setTechnicalName('');
    setToxicityColor('');
    setOpeningStock(10);
    setShowModal(true);
  };

  const handleOpenEdit = (p: Product) => {
    setEditingProduct(p);
    setProductCode(p.product_code);
    setName(p.name);
    setNameMr(p.name_mr || '');
    setBrand(p.brand || p.company || '');
    setCategory(p.category);
    setHsnCode(p.hsn_code);
    setUnit(p.unit);
    setPackSize(p.pack_size);
    setPurchaseRate(p.purchase_rate);
    setMrp(p.mrp);
    setSellingRate(p.selling_rate);
    setGstRate(p.gst_rate);
    setLowStockAlert(p.low_stock_alert);
    setBarcode(p.barcode || '');
    setTechnicalName(p.technical_name || '');
    setToxicityColor(p.toxicity_color || '');
    setShowModal(true);
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      showToast(currentLang === 'mr' ? 'कृपया उत्पादनाचे नाव भरा.' : 'Please enter product name.', 'warning');
      return;
    }

    try {
      const payload: Partial<Product> = {
        product_code: productCode.trim() || `PRD-${Math.floor(1000 + Math.random() * 9000)}`,
        name: name.trim(),
        name_mr: nameMr.trim() || name.trim(),
        brand: brand.trim() || 'General',
        company: brand.trim() || 'General',
        category,
        hsn_code: hsnCode.trim() || '0000',
        unit: unit || 'Bags',
        pack_size: packSize.trim() || '1',
        purchase_rate: Number(purchaseRate) || 0,
        mrp: Number(mrp) || 0,
        selling_rate: Number(sellingRate) || 0,
        gst_rate: Number(gstRate) || 0,
        low_stock_alert: Number(lowStockAlert) || 10,
        min_stock: Number(lowStockAlert) || 10,
        reorder_level: Number(lowStockAlert) ? Number(lowStockAlert) + 5 : 15,
        barcode: barcode.trim() || undefined,
        technical_name: technicalName.trim() || undefined,
        toxicity_color: toxicityColor || undefined,
        ...(!editingProduct && openingStock !== '' ? { opening_stock: Number(openingStock) || 0 } : {}),
      };

      if (editingProduct) {
        await dbService.updateProduct(editingProduct.id, payload);
        showToast(currentLang === 'mr' ? 'उत्पादन माहिती यशस्वीरित्या अद्यतनित केली.' : 'Product updated successfully.', 'success');
      } else {
        await dbService.createProduct(payload);
        showToast(currentLang === 'mr' ? 'नवीन उत्पादन यशस्वीरित्या जोडले.' : 'New product created successfully.', 'success');
      }

      setShowModal(false);
      loadProducts();
      onRefreshData?.();
    } catch (err: any) {
      console.error('Save product error:', err);
      showToast(err.message || (currentLang === 'mr' ? 'उत्पादन साठवताना अडचण आली.' : 'Error saving product.'), 'error');
    }
  };

  const handleDeleteProduct = (p: Product) => {
    showConfirm({
      title: currentLang === 'mr' ? 'उत्पादन निष्क्रिय करा' : 'Deactivate Product',
      message: currentLang === 'mr'
        ? `आपण खात्रीपूर्वक "${p.name}" हे उत्पादन निष्क्रिय करू इच्छिता?`
        : `Are you sure you want to deactivate "${p.name}"?`,
      confirmText: currentLang === 'mr' ? 'होय, निष्क्रिय करा' : 'Yes, Deactivate',
      cancelText: currentLang === 'mr' ? 'रद्द करा' : 'Cancel',
      isDanger: true,
      onConfirm: async () => {
        try {
          await dbService.deactivateProduct(p.id);
          showToast(currentLang === 'mr' ? 'उत्पादन निष्क्रिय केले.' : 'Product deactivated.', 'success');
          loadProducts();
          onRefreshData?.();
        } catch (err: any) {
          showToast(err.message || 'Failed to deactivate product', 'error');
        }
      }
    });
  };

  const handleExportCSV = () => {
    const data = products.map((p) => ({
      Code: p.product_code,
      Name: p.name,
      'Local Name': p.name_mr || '',
      Category: p.category,
      HSN: p.hsn_code,
      Unit: p.unit,
      'Pack Size': p.pack_size,
      'Purchase Rate': p.purchase_rate,
      MRP: p.mrp,
      'Selling Rate': p.selling_rate,
      'GST %': p.gst_rate,
      'Low Stock Alert': p.low_stock_alert,
      Barcode: p.barcode || '',
      Technical: p.technical_name || '',
    }));
    exportToCSV(`Products_Master_${new Date().toISOString().slice(0, 10)}`, data);
  };

  const categoryOptions = [
    { value: 'Fertilizers', mr: 'रासायनिक खते', en: 'Chemical Fertilizers' },
    { value: 'Seeds', mr: 'बियाणे', en: 'Seeds' },
    { value: 'Pesticides', mr: 'कीटकनाशके', en: 'Pesticides' },
    { value: 'Bio Fertilizers', mr: 'सेंद्रिय खते व टॉनिक', en: 'Bio Fertilizers & Tonics' },
    { value: 'Equipment', mr: 'कृषी साधने व उपकरणे', en: 'Equipment & Tools' },
  ];

  const unitOptions = [
    { value: 'Bags', mr: 'पोती', en: 'Bags' },
    { value: 'Bottles', mr: 'बाटली', en: 'Bottles' },
    { value: 'Kg', mr: 'किलो', en: 'Kg' },
    { value: 'Litre', mr: 'लिटर', en: 'Litre' },
    { value: 'Packets', mr: 'पाकीट', en: 'Packets' },
    { value: 'Nos', mr: 'नग', en: 'Nos' },
  ];

  return (
    <div className="flex-1 p-6 overflow-y-auto space-y-4">
      {/* Header */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-800">
              {getTranslation('nav_products', currentLang)}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {currentLang === 'mr' 
                ? 'खते, बियाणे, कीटकनाशके, GST दर व साठा मर्यादा व्यवस्थापन'
                : 'Fertilizers, seeds, pesticides, GST rates and inventory thresholds'}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExportCSV}
              className="px-3 py-1.5 rounded-lg border border-slate-300 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{getTranslation('export_csv', currentLang)}</span>
            </button>
            <button
              onClick={handleOpenAdd}
              className="px-3.5 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs flex items-center gap-2 shadow-xs transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>{getTranslation('add_product_btn', currentLang)}</span>
            </button>
          </div>
        </div>

        {/* Filter Controls */}
        <div className="flex flex-col sm:flex-row items-center gap-3 pt-2 border-t border-slate-100">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={getTranslation('search_product_placeholder', currentLang)}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:outline-emerald-600 font-medium"
            />
          </div>

          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3 py-1.5 text-xs border border-slate-300 rounded-lg bg-slate-50 font-medium w-full sm:w-56"
          >
            <option value="All">{getTranslation('all_categories', currentLang)}</option>
            {categoryOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {currentLang === 'mr' ? opt.mr : opt.en}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
              <tr>
                <th className="p-3">{getTranslation('product_code', currentLang)}</th>
                <th className="p-3">{getTranslation('product_name', currentLang)}</th>
                <th className="p-3">{getTranslation('category', currentLang)}</th>
                <th className="p-3">{getTranslation('pack_size', currentLang)}</th>
                <th className="p-3 text-center">{getTranslation('hsn_code', currentLang)}</th>
                <th className="p-3 text-right">{getTranslation('purchase_rate', currentLang)}</th>
                <th className="p-3 text-right">{getTranslation('mrp', currentLang)}</th>
                <th className="p-3 text-right">{getTranslation('selling_rate', currentLang)}</th>
                <th className="p-3 text-right">{getTranslation('gst_rate', currentLang)}</th>
                <th className="p-3 text-center">{getTranslation('actions', currentLang)}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {products.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-400">
                    {getTranslation('no_products_found', currentLang)}
                  </td>
                </tr>
              ) : (
                products.map((p) => {
                  const catMatch = categoryOptions.find((c) => c.value === p.category);
                  const catLabel = catMatch ? (currentLang === 'mr' ? catMatch.mr : catMatch.en) : p.category;

                  return (
                    <tr key={p.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="p-3 font-mono text-slate-500 font-bold">{p.product_code}</td>
                      <td className="p-3">
                        <div className="font-bold text-slate-900">{currentLang === 'mr' && p.name_mr ? p.name_mr : p.name}</div>
                        {p.name_mr && currentLang === 'en' && <div className="text-[11px] text-slate-500 font-medium">{p.name_mr}</div>}
                        {p.name && currentLang === 'mr' && <div className="text-[10px] text-slate-400 font-medium">{p.name}</div>}
                        {p.technical_name && (
                          <div className="text-[10px] text-slate-500 italic mt-0.5">{p.technical_name}</div>
                        )}
                      </td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-700 border border-slate-200">
                          {catLabel}
                        </span>
                      </td>
                      <td className="p-3 font-medium text-slate-700">{p.pack_size}</td>
                      <td className="p-3 text-center font-mono text-slate-600">{p.hsn_code}</td>
                      <td className="p-3 text-right font-mono text-slate-600">{formatINR(p.purchase_rate)}</td>
                      <td className="p-3 text-right font-mono text-slate-500">{formatINR(p.mrp)}</td>
                      <td className="p-3 text-right font-mono font-bold text-emerald-700 text-sm">
                        {formatINR(p.selling_rate)}
                      </td>
                      <td className="p-3 text-right font-mono text-slate-600">{p.gst_rate}%</td>
                      <td className="p-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => handleOpenEdit(p)}
                            className="p-1 rounded text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 cursor-pointer"
                            title={getTranslation('edit', currentLang)}
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteProduct(p)}
                            className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer"
                            title={currentLang === 'mr' ? 'निष्क्रिय करा' : 'Deactivate'}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Product Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden my-6">
            <div className="px-5 py-3.5 bg-slate-800 text-white flex items-center justify-between">
              <h3 className="font-bold text-sm">
                {editingProduct 
                  ? getTranslation('edit_product_title', currentLang) 
                  : getTranslation('add_product_title', currentLang)}
              </h3>
              <button 
                type="button" 
                onClick={() => setShowModal(false)} 
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveProduct} className="p-5 space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    {getTranslation('product_name', currentLang)} *
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder=""
                    className="w-full p-2 border border-slate-300 rounded focus:outline-emerald-600"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    {getTranslation('product_name_mr', currentLang)}
                  </label>
                  <input
                    type="text"
                    value={nameMr}
                    onChange={(e) => setNameMr(e.target.value)}
                    placeholder=""
                    className="w-full p-2 border border-slate-300 rounded focus:outline-emerald-600"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    {categoryOptions.find(c => c.value === category)?.[currentLang === 'mr' ? 'mr' : 'en']} {currentLang === 'mr' ? 'प्रवर्ग' : 'Category'} *
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as ProductCategory)}
                    className="w-full p-2 border border-slate-300 rounded font-medium"
                  >
                    {categoryOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {currentLang === 'mr' ? opt.mr : opt.en}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    {currentLang === 'mr' ? 'ब्रँड / कंपनी' : 'Brand / Company'}
                  </label>
                  <input
                    type="text"
                    value={brand}
                    onChange={(e) => setBrand(e.target.value)}
                    placeholder={currentLang === 'mr' ? 'उदा. महायको, बायर, आरसीएफ' : 'e.g. Bayer, Mahyco, RCF'}
                    className="w-full p-2 border border-slate-300 rounded focus:outline-emerald-600"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    {getTranslation('hsn_code', currentLang)}
                  </label>
                  <input
                    type="text"
                    value={hsnCode}
                    onChange={(e) => setHsnCode(e.target.value)}
                    placeholder=""
                    className="w-full p-2 border border-slate-300 rounded font-mono"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    {getTranslation('pack_size', currentLang)}
                  </label>
                  <input
                    type="text"
                    value={packSize}
                    onChange={(e) => setPackSize(e.target.value)}
                    placeholder=""
                    className="w-full p-2 border border-slate-300 rounded"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    {getTranslation('unit', currentLang)}
                  </label>
                  <select
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                    className="w-full p-2 border border-slate-300 rounded font-medium"
                  >
                    {unitOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {currentLang === 'mr' ? opt.mr : opt.en}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    {getTranslation('purchase_rate', currentLang)} (₹)
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={purchaseRate || ''}
                    onChange={(e) => setPurchaseRate(parseFloat(e.target.value) || 0)}
                    placeholder="0"
                    className="w-full p-2 border border-slate-300 rounded font-mono"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    {getTranslation('mrp', currentLang)} (₹)
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={mrp || ''}
                    onChange={(e) => setMrp(parseFloat(e.target.value) || 0)}
                    placeholder="0"
                    className="w-full p-2 border border-slate-300 rounded font-mono"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    {getTranslation('selling_rate', currentLang)} (₹) *
                  </label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={sellingRate || ''}
                    onChange={(e) => setSellingRate(parseFloat(e.target.value) || 0)}
                    placeholder="0"
                    className="w-full p-2 border border-slate-300 rounded font-mono font-bold text-emerald-800"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    {getTranslation('gst_rate', currentLang)}
                  </label>
                  <select
                    value={gstRate}
                    onChange={(e) => setGstRate(parseFloat(e.target.value) || 0)}
                    className="w-full p-2 border border-slate-300 rounded font-mono font-bold"
                  >
                    <option value={0}>0%</option>
                    <option value={5}>5%</option>
                    <option value={12}>12%</option>
                    <option value={18}>18%</option>
                    <option value={28}>28%</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    {getTranslation('barcode_label', currentLang)}
                  </label>
                  <input
                    type="text"
                    value={barcode}
                    onChange={(e) => setBarcode(e.target.value)}
                    placeholder=""
                    className="w-full p-2 border border-slate-300 rounded font-mono"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    {getTranslation('low_stock_threshold', currentLang)}
                  </label>
                  <input
                    type="number"
                    value={lowStockAlert || ''}
                    onChange={(e) => setLowStockAlert(parseInt(e.target.value) || 0)}
                    placeholder="0"
                    className="w-full p-2 border border-slate-300 rounded font-mono"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block font-bold text-slate-700 mb-1">
                    {getTranslation('chemical_content', currentLang)}
                  </label>
                  <input
                    type="text"
                    value={technicalName}
                    onChange={(e) => setTechnicalName(e.target.value)}
                    placeholder=""
                    className="w-full p-2 border border-slate-300 rounded"
                  />
                </div>

                {!editingProduct && (
                  <div className="sm:col-span-2 bg-emerald-50/70 p-3 rounded-lg border border-emerald-200 flex items-center justify-between gap-4">
                    <div>
                      <label className="block font-bold text-emerald-900 text-xs">
                        {currentLang === 'mr' ? 'आरंभीचा साठा / प्रारंभिक स्टॉक (Opening Stock)' : 'Opening Stock (Initial Quantity)'}
                      </label>
                      <p className="text-[11px] text-emerald-700">
                        {currentLang === 'mr' ? 'उत्पादन तयार होताच विक्रीसाठी बॅच तयार होईल.' : 'Default batch will be created so product is immediately sellable.'}
                      </p>
                    </div>
                    <input
                      type="number"
                      min="0"
                      value={openingStock}
                      onChange={(e) => setOpeningStock(e.target.value === '' ? '' : parseFloat(e.target.value))}
                      placeholder="10"
                      className="w-28 p-2 bg-white border border-emerald-400 rounded font-mono font-bold text-emerald-900 text-right focus:outline-emerald-600"
                    />
                  </div>
                )}
              </div>

              <div className="px-5 py-3 bg-slate-100 -mx-5 -mb-5 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded text-xs font-semibold cursor-pointer"
                >
                  {getTranslation('cancel', currentLang)}
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded text-xs font-bold cursor-pointer"
                >
                  {getTranslation('save', currentLang)}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
