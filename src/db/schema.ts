export const INITIAL_SCHEMA_SQL = `
-- Schema Version 1.0 for Krushi Seva ERP

CREATE TABLE IF NOT EXISTS schema_migrations (
  version INTEGER PRIMARY KEY,
  applied_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'cashier',
  phone TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS business_settings (
  id INTEGER PRIMARY KEY DEFAULT 1,
  shop_name TEXT NOT NULL,
  shop_name_mr TEXT NOT NULL,
  proprietor TEXT NOT NULL,
  partner_name TEXT,
  address TEXT NOT NULL,
  village_city TEXT NOT NULL,
  taluka TEXT,
  district TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'Maharashtra',
  pincode TEXT NOT NULL,
  jurisdiction_city TEXT,
  mobile TEXT NOT NULL,
  mobile_secondary TEXT,
  email TEXT,
  gstin TEXT,
  cot_licence TEXT,
  fertilizer_licence TEXT,
  fert_licence_r TEXT,
  seed_licence TEXT,
  pesticide_licence TEXT,
  bank_name TEXT,
  bank_account_no TEXT,
  bank_ifsc TEXT,
  upi_id TEXT
);

CREATE TABLE IF NOT EXISTS invoice_settings (
  id INTEGER PRIMARY KEY DEFAULT 1,
  invoice_prefix TEXT NOT NULL DEFAULT 'INV-2026-',
  starting_number INTEGER NOT NULL DEFAULT 1001,
  print_format TEXT NOT NULL DEFAULT 'A4',
  show_hsn INTEGER NOT NULL DEFAULT 1,
  show_mrp INTEGER NOT NULL DEFAULT 1,
  show_discount INTEGER NOT NULL DEFAULT 1,
  terms_conditions TEXT,
  terms_conditions_mr TEXT,
  footer_message TEXT
);

CREATE TABLE IF NOT EXISTS inventory_settings (
  id INTEGER PRIMARY KEY DEFAULT 1,
  allow_negative_stock INTEGER NOT NULL DEFAULT 0,
  batch_required_default INTEGER NOT NULL DEFAULT 1,
  expiry_warning_days INTEGER NOT NULL DEFAULT 90,
  fefo_enabled INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,
  name_mr TEXT,
  name_hi TEXT,
  description TEXT,
  active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS brands (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,
  company TEXT,
  contact TEXT
);

CREATE TABLE IF NOT EXISTS units (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  symbol TEXT UNIQUE NOT NULL,
  is_decimal INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS crops (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  name_mr TEXT NOT NULL,
  name_hi TEXT NOT NULL,
  season TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS locations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,
  code TEXT UNIQUE NOT NULL,
  is_primary INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_code TEXT UNIQUE NOT NULL,
  barcode TEXT,
  name TEXT NOT NULL,
  name_mr TEXT NOT NULL,
  name_hi TEXT NOT NULL,
  category TEXT NOT NULL,
  subcategory TEXT,
  brand TEXT NOT NULL,
  company TEXT,
  unit TEXT NOT NULL,
  pack_size TEXT NOT NULL,
  mrp REAL NOT NULL,
  purchase_rate REAL NOT NULL,
  selling_rate REAL NOT NULL,
  dealer_rate REAL,
  gst_rate REAL NOT NULL DEFAULT 5,
  hsn_code TEXT NOT NULL,
  batch_required INTEGER NOT NULL DEFAULT 1,
  expiry_required INTEGER NOT NULL DEFAULT 1,
  min_stock REAL NOT NULL DEFAULT 10,
  max_stock REAL DEFAULT 500,
  reorder_level REAL NOT NULL DEFAULT 15,
  fertilizer_grade TEXT,
  npk_ratio TEXT,
  seed_variety TEXT,
  seed_germination TEXT,
  toxicity_class TEXT,
  cib_registration_no TEXT,
  description TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS product_batches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL,
  batch_number TEXT NOT NULL,
  mfg_date TEXT,
  expiry_date TEXT,
  purchase_rate REAL NOT NULL,
  mrp REAL NOT NULL,
  selling_rate REAL NOT NULL,
  opening_qty REAL NOT NULL DEFAULT 0,
  current_qty REAL NOT NULL DEFAULT 0,
  location_id INTEGER NOT NULL DEFAULT 1,
  supplier_id INTEGER,
  status TEXT NOT NULL DEFAULT 'Active',
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  FOREIGN KEY (location_id) REFERENCES locations(id)
);

CREATE TABLE IF NOT EXISTS customers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  name_mr TEXT,
  mobile TEXT NOT NULL,
  alt_mobile TEXT,
  village TEXT NOT NULL,
  taluka TEXT NOT NULL,
  district TEXT NOT NULL,
  address TEXT,
  pincode TEXT,
  credit_limit REAL NOT NULL DEFAULT 50000,
  opening_balance REAL NOT NULL DEFAULT 0,
  current_balance REAL NOT NULL DEFAULT 0,
  notes TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS customer_crops (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id INTEGER NOT NULL,
  crop_name TEXT NOT NULL,
  area_acres REAL NOT NULL,
  season TEXT NOT NULL,
  year INTEGER NOT NULL,
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS customer_ledger (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id INTEGER NOT NULL,
  date TEXT NOT NULL,
  reference_type TEXT NOT NULL,
  reference_no TEXT,
  description TEXT NOT NULL,
  debit REAL NOT NULL DEFAULT 0,
  credit REAL NOT NULL DEFAULT 0,
  balance REAL NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  FOREIGN KEY (customer_id) REFERENCES customers(id)
);

CREATE TABLE IF NOT EXISTS customer_payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  payment_no TEXT UNIQUE NOT NULL,
  customer_id INTEGER NOT NULL,
  date TEXT NOT NULL,
  amount REAL NOT NULL,
  payment_mode TEXT NOT NULL,
  reference_no TEXT,
  notes TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (customer_id) REFERENCES customers(id)
);

CREATE TABLE IF NOT EXISTS suppliers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  supplier_code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  company TEXT NOT NULL,
  contact_person TEXT,
  mobile TEXT NOT NULL,
  email TEXT,
  address TEXT,
  city TEXT,
  state TEXT DEFAULT 'Maharashtra',
  gstin TEXT,
  licence_no TEXT,
  credit_limit REAL DEFAULT 500000,
  opening_balance REAL NOT NULL DEFAULT 0,
  current_balance REAL NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS supplier_ledger (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  supplier_id INTEGER NOT NULL,
  date TEXT NOT NULL,
  reference_type TEXT NOT NULL,
  reference_no TEXT,
  description TEXT NOT NULL,
  debit REAL NOT NULL DEFAULT 0,
  credit REAL NOT NULL DEFAULT 0,
  balance REAL NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  FOREIGN KEY (supplier_id) REFERENCES suppliers(id)
);

CREATE TABLE IF NOT EXISTS supplier_payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  payment_no TEXT UNIQUE NOT NULL,
  supplier_id INTEGER NOT NULL,
  date TEXT NOT NULL,
  amount REAL NOT NULL,
  payment_mode TEXT NOT NULL,
  reference_no TEXT,
  notes TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (supplier_id) REFERENCES suppliers(id)
);

CREATE TABLE IF NOT EXISTS purchases (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  purchase_no TEXT UNIQUE NOT NULL,
  supplier_invoice_no TEXT NOT NULL,
  invoice_date TEXT NOT NULL,
  supplier_id INTEGER NOT NULL,
  supplier_name TEXT NOT NULL,
  payment_type TEXT NOT NULL DEFAULT 'Credit',
  subtotal REAL NOT NULL,
  discount_amount REAL NOT NULL DEFAULT 0,
  taxable_amount REAL NOT NULL,
  cgst_amount REAL NOT NULL DEFAULT 0,
  sgst_amount REAL NOT NULL DEFAULT 0,
  igst_amount REAL NOT NULL DEFAULT 0,
  total_tax REAL NOT NULL,
  other_charges REAL NOT NULL DEFAULT 0,
  grand_total REAL NOT NULL,
  paid_amount REAL NOT NULL DEFAULT 0,
  credit_amount REAL NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'Completed',
  notes TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (supplier_id) REFERENCES suppliers(id)
);

CREATE TABLE IF NOT EXISTS purchase_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  purchase_id INTEGER NOT NULL,
  product_id INTEGER NOT NULL,
  product_name TEXT NOT NULL,
  batch_number TEXT NOT NULL,
  mfg_date TEXT,
  expiry_date TEXT,
  quantity REAL NOT NULL,
  free_qty REAL NOT NULL DEFAULT 0,
  unit TEXT NOT NULL,
  purchase_rate REAL NOT NULL,
  mrp REAL NOT NULL,
  selling_rate REAL NOT NULL,
  discount_percent REAL NOT NULL DEFAULT 0,
  taxable_value REAL NOT NULL,
  gst_rate REAL NOT NULL,
  cgst_amount REAL NOT NULL,
  sgst_amount REAL NOT NULL,
  igst_amount REAL NOT NULL DEFAULT 0,
  total_tax REAL NOT NULL,
  total_amount REAL NOT NULL,
  FOREIGN KEY (purchase_id) REFERENCES purchases(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id)
);

CREATE TABLE IF NOT EXISTS sales (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  invoice_no TEXT UNIQUE NOT NULL,
  invoice_date TEXT NOT NULL,
  customer_id INTEGER NOT NULL,
  customer_name TEXT NOT NULL,
  customer_mobile TEXT,
  customer_village TEXT,
  payment_mode TEXT NOT NULL DEFAULT 'Cash',
  subtotal REAL NOT NULL,
  discount_amount REAL NOT NULL DEFAULT 0,
  taxable_amount REAL NOT NULL,
  cgst_amount REAL NOT NULL DEFAULT 0,
  sgst_amount REAL NOT NULL DEFAULT 0,
  igst_amount REAL NOT NULL DEFAULT 0,
  total_tax REAL NOT NULL,
  round_off REAL NOT NULL DEFAULT 0,
  grand_total REAL NOT NULL,
  paid_amount REAL NOT NULL DEFAULT 0,
  credit_amount REAL NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'Completed',
  notes TEXT,
  user_id INTEGER,
  user_name TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sale_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sale_id INTEGER NOT NULL,
  product_id INTEGER NOT NULL,
  product_name TEXT NOT NULL,
  product_code TEXT NOT NULL,
  hsn_code TEXT NOT NULL,
  batch_id INTEGER,
  batch_number TEXT,
  expiry_date TEXT,
  unit TEXT NOT NULL,
  pack_size TEXT,
  quantity REAL NOT NULL,
  rate REAL NOT NULL,
  mrp REAL NOT NULL,
  discount_percent REAL NOT NULL DEFAULT 0,
  discount_amount REAL NOT NULL DEFAULT 0,
  taxable_value REAL NOT NULL,
  gst_rate REAL NOT NULL,
  cgst_amount REAL NOT NULL,
  sgst_amount REAL NOT NULL,
  igst_amount REAL NOT NULL DEFAULT 0,
  total_tax REAL NOT NULL,
  total_amount REAL NOT NULL,
  FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id)
);

CREATE TABLE IF NOT EXISTS sales_returns (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  return_no TEXT UNIQUE NOT NULL,
  original_sale_id INTEGER NOT NULL,
  original_invoice_no TEXT NOT NULL,
  return_date TEXT NOT NULL,
  customer_id INTEGER NOT NULL,
  customer_name TEXT NOT NULL,
  refund_amount REAL NOT NULL DEFAULT 0,
  credit_adjusted_amount REAL NOT NULL DEFAULT 0,
  reason TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sales_return_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  return_id INTEGER NOT NULL,
  product_id INTEGER NOT NULL,
  batch_id INTEGER,
  quantity REAL NOT NULL,
  rate REAL NOT NULL,
  amount REAL NOT NULL,
  return_to_stock INTEGER NOT NULL DEFAULT 1,
  FOREIGN KEY (return_id) REFERENCES sales_returns(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS stock_movements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date_time TEXT NOT NULL,
  product_id INTEGER NOT NULL,
  product_name TEXT NOT NULL,
  batch_id INTEGER,
  batch_number TEXT,
  movement_type TEXT NOT NULL,
  quantity REAL NOT NULL,
  unit TEXT NOT NULL,
  reference_type TEXT NOT NULL,
  reference_id TEXT,
  location_name TEXT NOT NULL DEFAULT 'Main Shop',
  user_name TEXT NOT NULL DEFAULT 'Admin',
  reason TEXT,
  FOREIGN KEY (product_id) REFERENCES products(id)
);

CREATE TABLE IF NOT EXISTS expense_categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,
  name_mr TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS expenses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  expense_date TEXT NOT NULL,
  category TEXT NOT NULL,
  amount REAL NOT NULL,
  payment_mode TEXT NOT NULL DEFAULT 'Cash',
  recipient TEXT,
  description TEXT NOT NULL,
  reference_no TEXT,
  user_name TEXT NOT NULL DEFAULT 'Admin',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS cash_transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date_time TEXT NOT NULL,
  type TEXT NOT NULL, -- 'IN' or 'OUT'
  category TEXT NOT NULL,
  amount REAL NOT NULL,
  balance_after REAL NOT NULL,
  reference_id TEXT,
  description TEXT NOT NULL,
  user_name TEXT NOT NULL DEFAULT 'Admin'
);

CREATE TABLE IF NOT EXISTS licences (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  licence_type TEXT NOT NULL,
  licence_no TEXT NOT NULL,
  holder_name TEXT NOT NULL,
  issuing_authority TEXT NOT NULL,
  issue_date TEXT NOT NULL,
  expiry_date TEXT NOT NULL,
  notes TEXT
);

CREATE TABLE IF NOT EXISTS pesticide_sales_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,
  invoice_no TEXT NOT NULL,
  farmer_name TEXT NOT NULL,
  farmer_mobile TEXT NOT NULL,
  farmer_village TEXT NOT NULL,
  product_name TEXT NOT NULL,
  batch_number TEXT NOT NULL,
  cib_no TEXT,
  quantity REAL NOT NULL,
  unit TEXT NOT NULL,
  crop_treated TEXT,
  remarks TEXT
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date_time TEXT NOT NULL,
  user_name TEXT NOT NULL,
  action TEXT NOT NULL,
  entity TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  description TEXT NOT NULL
);

-- Essential Performance Indexes
CREATE INDEX IF NOT EXISTS idx_products_name ON products(name);
CREATE INDEX IF NOT EXISTS idx_products_code ON products(product_code);
CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_batches_product ON product_batches(product_id);
CREATE INDEX IF NOT EXISTS idx_batches_batchno ON product_batches(batch_number);
CREATE INDEX IF NOT EXISTS idx_batches_expiry ON product_batches(expiry_date);
CREATE INDEX IF NOT EXISTS idx_customers_mobile ON customers(mobile);
CREATE INDEX IF NOT EXISTS idx_customers_name ON customers(name);
CREATE INDEX IF NOT EXISTS idx_sales_invoice ON sales(invoice_no);
CREATE INDEX IF NOT EXISTS idx_sales_date ON sales(invoice_date);
CREATE INDEX IF NOT EXISTS idx_stock_product ON stock_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_batch ON stock_movements(batch_id);
`;
