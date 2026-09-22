export type AppLanguage = 'mr' | 'en' | 'hi';

export type UserRole = 'admin' | 'manager' | 'cashier' | 'accountant' | 'stock_manager';

export interface User {
  id: number;
  username: string;
  name: string;
  role: UserRole;
  phone?: string;
  active: boolean;
  created_at: string;
}

export type ProductCategory = 
  | 'Fertilizer'
  | 'Seed'
  | 'Insecticide'
  | 'Fungicide'
  | 'Herbicide'
  | 'Pesticide'
  | 'Micronutrient'
  | 'Bio-fertilizer'
  | 'Bio-pesticide'
  | 'Plant Growth Regulator'
  | 'Growth Promoter'
  | 'Organic Input'
  | 'Farm Equipment'
  | 'Other';

export interface Category {
  id: number;
  name: string;
  name_mr?: string;
  name_hi?: string;
  description?: string;
  active: boolean;
}

export interface Unit {
  id: number;
  name: string;
  symbol: string;
  is_decimal: boolean;
}

export interface Brand {
  id: number;
  name: string;
  company?: string;
  contact?: string;
}

export interface Location {
  id: number;
  name: string;
  code: string;
  is_primary: boolean;
}

export interface Product {
  id: number;
  product_code: string;
  barcode: string;
  name: string;
  name_mr: string;
  name_hi: string;
  category: ProductCategory | string;
  subcategory?: string;
  brand: string;
  company?: string;
  unit: string;
  pack_size: string;
  mrp: number;
  purchase_rate: number;
  selling_rate: number;
  dealer_rate?: number;
  gst_rate: number; // 0, 5, 12, 18, 28
  hsn_code: string;
  batch_required: boolean;
  expiry_required: boolean;
  min_stock: number;
  max_stock?: number;
  reorder_level: number;
  low_stock_alert?: number;
  technical_name?: string;
  toxicity_color?: string;
  description?: string;
  active: boolean;
  // Specific agricultural fields
  fertilizer_grade?: string; // e.g. 10:26:26, 18:46:0
  npk_ratio?: string;
  seed_variety?: string;
  seed_germination?: string;
  toxicity_class?: string; // Green, Blue, Yellow, Red (for pesticides)
  cib_registration_no?: string; // Central Insecticides Board
}

export type BatchStatus = 'Active' | 'Near Expiry' | 'Expired' | 'Exhausted' | 'Blocked';

export interface ProductBatch {
  id: number;
  product_id: number;
  product_name?: string;
  category?: string;
  batch_number: string;
  mfg_date?: string;
  expiry_date?: string;
  purchase_rate: number;
  mrp: number;
  selling_rate: number;
  opening_qty: number;
  current_qty: number;
  location_id: number;
  location_name?: string;
  supplier_id?: number;
  supplier_name?: string;
  status: BatchStatus;
  days_to_expiry?: number;
}

export interface Customer {
  id: number;
  customer_code: string;
  name: string;
  name_mr?: string;
  mobile: string;
  alt_mobile?: string;
  aadhar_no?: string;
  village: string;
  taluka: string;
  district: string;
  address?: string;
  pincode?: string;
  credit_limit: number;
  opening_balance: number; // Positive means customer owes shop (debit)
  current_balance: number;
  land_acreage?: number;
  crops_grown?: string;
  notes?: string;
  active: boolean;
  created_at: string;
}

export interface Crop {
  id: number;
  name: string;
  name_mr: string;
  name_hi: string;
  season: 'Kharif' | 'Rabi' | 'Summer' | 'Annual';
}

export interface CustomerCrop {
  id: number;
  customer_id: number;
  crop_name: string;
  area_acres: number;
  season: string;
  year: number;
}

export interface Supplier {
  id: number;
  supplier_code: string;
  name: string;
  company: string;
  contact_person?: string;
  mobile: string;
  email?: string;
  address?: string;
  city?: string;
  state?: string;
  gstin?: string;
  licence_no?: string;
  credit_limit?: number;
  opening_balance: number; // Positive means shop owes supplier (credit)
  current_balance: number;
  active: boolean;
}

export type PaymentMode = 'Cash' | 'UPI' | 'Card' | 'Bank Transfer' | 'Credit' | 'Mixed';

export interface SaleItem {
  id?: number;
  sale_id?: number;
  product_id: number;
  product_name: string;
  product_code: string;
  hsn_code: string;
  mfg?: string;
  company?: string;
  content?: string;
  batch_id?: number;
  batch_number?: string;
  expiry_date?: string;
  unit: string;
  pack_size?: string;
  quantity: number;
  rate: number;
  mrp: number;
  discount_percent: number;
  discount_amount: number;
  taxable_value: number;
  gst_rate: number;
  cgst_amount: number;
  sgst_amount: number;
  igst_amount: number;
  total_tax: number;
  total_amount: number;
}

export interface Sale {
  id: number;
  invoice_no: string;
  invoice_date: string;
  doc_no?: string;
  doc_date?: string;
  customer_id: number;
  customer_name: string;
  customer_mobile?: string;
  customer_village?: string;
  customer_aadhar?: string;
  customer_outstanding?: number;
  previous_balance?: number;
  payment_mode: PaymentMode;
  subtotal: number;
  discount_amount: number;
  taxable_amount: number;
  cgst_amount: number;
  sgst_amount: number;
  igst_amount: number;
  total_tax: number;
  round_off: number;
  grand_total: number;
  paid_amount: number;
  credit_amount: number;
  status: 'Completed' | 'Cancelled' | 'Returned';
  items?: SaleItem[];
  user_id?: number;
  user_name?: string;
  notes?: string;
  is_gst_bill?: boolean;
  created_at: string;
}

export interface PurchaseItem {
  id?: number;
  purchase_id?: number;
  product_id: number;
  product_name: string;
  batch_number: string;
  mfg_date?: string;
  expiry_date?: string;
  quantity: number;
  free_qty?: number;
  free_quantity?: number;
  unit: string;
  purchase_rate: number;
  mrp: number;
  selling_rate: number;
  discount_percent: number;
  taxable_value?: number;
  taxable_amount?: number;
  gst_rate: number;
  cgst_amount: number;
  sgst_amount: number;
  igst_amount: number;
  total_tax?: number;
  total_amount: number;
}

export interface Purchase {
  id: number;
  purchase_no: string;
  supplier_invoice_no: string;
  invoice_date?: string;
  purchase_date?: string;
  due_date?: string;
  supplier_id: number;
  supplier_name: string;
  supplier_gstin?: string;
  payment_type?: 'Cash' | 'Credit' | 'Bank Transfer';
  payment_mode?: string;
  subtotal: number;
  discount_amount: number;
  taxable_amount: number;
  cgst_amount: number;
  sgst_amount: number;
  igst_amount: number;
  total_tax: number;
  other_charges?: number;
  grand_total: number;
  paid_amount: number;
  credit_amount?: number;
  balance_amount?: number;
  status: 'Completed' | 'Cancelled';
  items?: PurchaseItem[];
  notes?: string;
  created_at: string;
}

export interface StockMovement {
  id: number;
  date_time: string;
  product_id: number;
  product_name: string;
  batch_id?: number;
  batch_number?: string;
  movement_type: 
    | 'Opening Stock'
    | 'Purchase'
    | 'Purchase Return'
    | 'Sale'
    | 'Sales Return'
    | 'Stock Transfer'
    | 'Stock Adjustment'
    | 'Damage'
    | 'Expired'
    | 'Wastage'
    | 'Manual Adjustment';
  quantity: number; // positive or negative
  unit: string;
  reference_type: 'Sale' | 'Purchase' | 'Adjustment' | 'Opening' | 'Return';
  reference_id?: string;
  location_name: string;
  user_name: string;
  reason?: string;
}

export interface CustomerLedgerEntry {
  id: number;
  customer_id: number;
  date: string;
  reference_type: 'Opening Balance' | 'Credit Sale' | 'Payment Received' | 'Sales Return' | 'Adjustment';
  reference_no?: string;
  description: string;
  debit: number; // Customer owes money
  credit: number; // Customer paid money
  balance: number;
}

export interface SupplierLedgerEntry {
  id: number;
  supplier_id: number;
  date: string;
  reference_type: 'Opening Balance' | 'Credit Purchase' | 'Payment Made' | 'Purchase Return' | 'Adjustment';
  reference_no?: string;
  description: string;
  debit: number; // Paid to supplier
  credit: number; // Bill received from supplier
  balance: number;
}

export type LedgerEntry = {
  id: number;
  date: string;
  reference_type?: string;
  reference_no?: string;
  description: string;
  debit: number;
  credit: number;
  balance: number;
  customer_id?: number;
  supplier_id?: number;
  created_at?: string;
};

export interface ExpenseCategory {
  id: number;
  name: string;
  name_mr: string;
}

export interface Expense {
  id: number;
  expense_date: string;
  category: string;
  amount: number;
  payment_mode: 'Cash' | 'UPI' | 'Bank';
  recipient?: string;
  paid_to?: string;
  description?: string;
  reference_no?: string;
  user_name?: string;
  created_by?: number | string;
  created_at: string;
}

export interface CashTransaction {
  id: number;
  date_time: string;
  type: 'IN' | 'OUT';
  category: 'Cash Sale' | 'Customer Payment' | 'Cash Purchase' | 'Supplier Payment' | 'Expense' | 'Adjustment' | 'Opening Cash';
  amount: number;
  balance_after: number;
  reference_id?: string;
  description: string;
  user_name: string;
}

export interface Licence {
  id: number;
  licence_type: 'Fertilizer' | 'Seed' | 'Insecticide' | 'Other';
  licence_no: string;
  holder_name: string;
  issuing_authority: string;
  issue_date: string;
  expiry_date: string;
  days_to_expiry?: number;
  status: 'Valid' | 'Expiring Soon' | 'Expired';
  notes?: string;
}

export interface PesticideSalesRecord {
  id: number;
  date: string;
  invoice_no: string;
  farmer_name: string;
  farmer_mobile: string;
  farmer_village: string;
  product_name: string;
  batch_number: string;
  cib_no?: string;
  quantity: number;
  unit: string;
  crop_treated?: string;
  remarks?: string;
}

export type StatutoryLicence = Licence;
export type PesticideRegisterRecord = PesticideSalesRecord;

export interface AuditLog {
  id: number;
  date_time: string;
  user_name: string;
  action: string;
  entity: string;
  entity_id: string;
  description: string;
}

export interface BusinessSettings {
  shop_name: string;
  shop_name_mr: string;
  proprietor: string;
  owner_name?: string;
  partner_name?: string;
  address: string;
  village_city: string;
  taluka?: string;
  district: string;
  state: string;
  pincode: string;
  jurisdiction_city?: string;
  mobile: string;
  mobile_secondary?: string;
  email: string;
  gstin: string;
  cot_licence?: string;
  fertilizer_licence: string;
  fert_licence_r?: string;
  seed_licence: string;
  pesticide_licence: string;
  bank_name: string;
  bank_account_no: string;
  bank_ifsc: string;
  upi_id: string;
}

export interface StatutoryFertilizerRegisterRow {
  sr_no: number;
  product_id: number;
  product_name: string;
  fertilizer_grade: string;
  company: string;
  opening_stock_mt: number;
  inward_mt: number;
  sales_mt: number;
  closing_stock_mt: number;
  unit: string;
}

export interface StatutorySeedRegisterRow {
  sr_no: number;
  product_id: number;
  crop_name: string;
  seed_variety: string;
  company: string;
  opening_stock: number;
  inward: number;
  sales: number;
  closing_stock: number;
  unit: string;
}

export interface InvoiceSettings {
  invoice_prefix: string;
  starting_number: number;
  print_format: 'A4' | 'Thermal_80mm' | 'Thermal_58mm';
  show_hsn: boolean;
  show_hsn_code?: boolean;
  show_mrp: boolean;
  show_discount: boolean;
  show_marathi_name?: boolean;
  show_bank_details?: boolean;
  terms_conditions: string;
  terms_conditions_mr: string;
  footer_message: string;
}

export interface InventorySettings {
  allow_negative_stock: boolean;
  batch_required_default: boolean;
  expiry_warning_days: number;
  fefo_enabled: boolean;
}

export interface DashboardMetrics {
  today_sales: number;
  week_sales: number;
  month_sales: number;
  today_purchases: number;
  month_purchases: number;
  customer_outstanding: number;
  supplier_outstanding: number;
  today_collection: number;
  today_expenses: number;
  estimated_gross_profit: number;
  total_products: number;
  total_stock_value: number;
  low_stock_count: number;
  expiring_soon_count: number;
  expired_count: number;
  recent_sales: Sale[];
  sales_trend: { date: string; sales: number; profit: number }[];
  category_sales: { category: string; amount: number }[];
}
