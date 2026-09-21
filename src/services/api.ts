import { sqliteEngine } from '../db/sqliteEngine';
import {
  Product,
  ProductBatch,
  Customer,
  CustomerLedgerEntry,
  CustomerCrop,
  Supplier,
  SupplierLedgerEntry,
  Sale,
  SaleItem,
  Purchase,
  PurchaseItem,
  StockMovement,
  Expense,
  CashTransaction,
  Licence,
  PesticideSalesRecord,
  AuditLog,
  BusinessSettings,
  InvoiceSettings,
  InventorySettings,
  DashboardMetrics,
  User,
  StatutoryFertilizerRegisterRow,
  StatutorySeedRegisterRow,
} from '../types';

export const dbService = {
  async init() {
    return sqliteEngine.getDb();
  },

  // ================= PRODUCTS & MASTERS =================
  async getProducts(search = '', category = ''): Promise<Product[]> {
    await sqliteEngine.getDb();
    let sql = 'SELECT * FROM products WHERE active = 1';
    const params: any[] = [];
    if (category && category !== 'ALL') {
      sql += ' AND category = ?';
      params.push(category);
    }
    if (search.trim()) {
      const q = `%${search.trim()}%`;
      sql += ' AND (name LIKE ? OR name_mr LIKE ? OR name_hi LIKE ? OR product_code LIKE ? OR barcode LIKE ? OR brand LIKE ? OR company LIKE ? OR technical_name LIKE ? OR fertilizer_grade LIKE ? OR subcategory LIKE ?)';
      params.push(q, q, q, q, q, q, q, q, q, q);
    }
    sql += ' ORDER BY name ASC';
    return sqliteEngine.query<Product>(sql, params);
  },

  async getProductById(id: number): Promise<Product | null> {
    await sqliteEngine.getDb();
    return sqliteEngine.queryOne<Product>('SELECT * FROM products WHERE id = ?', [id]);
  },

  async saveProduct(product: Partial<Product>, userName = 'Admin'): Promise<number> {
    await sqliteEngine.getDb();
    const cleanBrand = (product.brand?.trim() || product.company?.trim() || 'General');
    const cleanCompany = (product.company?.trim() || product.brand?.trim() || cleanBrand);
    const cleanName = product.name?.trim() || 'Product';
    const cleanNameMr = product.name_mr?.trim() || cleanName;
    const cleanNameHi = product.name_hi?.trim() || cleanName;
    const cleanCategory = product.category || 'Fertilizers';
    const cleanUnit = product.unit || 'Bags';
    const cleanPackSize = product.pack_size?.trim() || '1';
    const cleanHsn = product.hsn_code?.trim() || '0000';
    const cleanPurchase = Number(product.purchase_rate) || 0;
    const cleanMrp = Number(product.mrp) || 0;
    const cleanSelling = Number(product.selling_rate) || 0;
    const cleanDealer = Number(product.dealer_rate) || 0;
    const cleanGst = Number(product.gst_rate) || 0;
    const cleanMinStock = Number(product.min_stock ?? product.low_stock_alert ?? 10);
    const cleanReorder = Number(product.reorder_level ?? product.low_stock_alert ?? 15);
    const cleanTechnicalName = product.technical_name?.trim() || '';
    const cleanProductCode = product.product_code?.trim() || `PRD-${Math.floor(1000 + Math.random() * 9000)}`;

    if (product.id) {
      sqliteEngine.run(
        `UPDATE products SET 
          product_code = ?, barcode = ?, name = ?, name_mr = ?, name_hi = ?, category = ?, 
          subcategory = ?, brand = ?, company = ?, unit = ?, pack_size = ?, mrp = ?, 
          purchase_rate = ?, selling_rate = ?, dealer_rate = ?, gst_rate = ?, hsn_code = ?, 
          batch_required = ?, expiry_required = ?, min_stock = ?, reorder_level = ?, 
          technical_name = ?, fertilizer_grade = ?, npk_ratio = ?, seed_variety = ?, toxicity_class = ?, 
          cib_registration_no = ?, description = ?
        WHERE id = ?`,
        [
          cleanProductCode, product.barcode || '', cleanName, cleanNameMr, cleanNameHi, cleanCategory,
          product.subcategory || '', cleanBrand, cleanCompany, cleanUnit, cleanPackSize, cleanMrp,
          cleanPurchase, cleanSelling, cleanDealer, cleanGst, cleanHsn,
          product.batch_required ? 1 : 0, product.expiry_required ? 1 : 0, cleanMinStock, cleanReorder,
          cleanTechnicalName, product.fertilizer_grade || '', product.npk_ratio || '', product.seed_variety || '', product.toxicity_class || '',
          product.cib_registration_no || '', product.description || '', product.id
        ]
      );
      this.logAudit(userName, 'UPDATE', 'Product', String(product.id), `Updated product ${cleanName}`);
      return product.id;
    } else {
      const res = sqliteEngine.run(
        `INSERT INTO products (
          product_code, barcode, name, name_mr, name_hi, category, subcategory, brand, company, 
          unit, pack_size, mrp, purchase_rate, selling_rate, dealer_rate, gst_rate, hsn_code, 
          batch_required, expiry_required, min_stock, reorder_level, technical_name, fertilizer_grade, npk_ratio, 
          seed_variety, toxicity_class, cib_registration_no, description, active, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, datetime('now'))`,
        [
          cleanProductCode, product.barcode || '', cleanName, cleanNameMr, cleanNameHi, cleanCategory,
          product.subcategory || '', cleanBrand, cleanCompany, cleanUnit, cleanPackSize, cleanMrp,
          cleanPurchase, cleanSelling, cleanDealer, cleanGst, cleanHsn,
          product.batch_required ? 1 : 0, product.expiry_required ? 1 : 0, cleanMinStock, cleanReorder,
          cleanTechnicalName, product.fertilizer_grade || '', product.npk_ratio || '', product.seed_variety || '', product.toxicity_class || '',
          product.cib_registration_no || '', product.description || ''
        ]
      );
      const newProductId = res.lastInsertRowid;

      // Auto-create initial default batch so newly added product is immediately ready for sale in POS
      try {
        const rawStock = (product as any).opening_stock ?? (product as any).current_stock;
        const initialStock = (rawStock !== undefined && rawStock !== null && rawStock !== '') 
          ? Math.max(0, Number(rawStock)) 
          : Math.max(10, cleanMinStock || 10);

        sqliteEngine.run(
          `INSERT INTO product_batches (
            product_id, batch_number, mfg_date, expiry_date, purchase_rate, mrp, selling_rate,
            opening_qty, received_qty, sold_qty, current_qty, status
          ) VALUES (?, 'BATCH-01', date('now'), date('now', '+2 years'), ?, ?, ?, ?, ?, 0, ?, 'Active')`,
          [newProductId, cleanPurchase, cleanMrp, cleanSelling, initialStock, initialStock, initialStock]
        );
      } catch (batchErr) {
        console.warn('Could not create default batch for new product:', batchErr);
      }

      this.logAudit(userName, 'CREATE', 'Product', String(newProductId), `Created product ${cleanName}`);
      return newProductId;
    }
  },

  async createProduct(product: Partial<Product>, userName = 'Admin'): Promise<number> {
    return this.saveProduct(product, userName);
  },

  async updateProduct(id: number, product: Partial<Product>, userName = 'Admin'): Promise<number> {
    return this.saveProduct({ ...product, id }, userName);
  },

  async deactivateProduct(id: number, userName = 'Admin'): Promise<void> {
    await sqliteEngine.getDb();
    sqliteEngine.run('UPDATE products SET active = 0 WHERE id = ?', [id]);
    this.logAudit(userName, 'DEACTIVATE', 'Product', String(id), `Deactivated product ID ${id}`);
  },

  // ================= BATCHES & FEFO INVENTORY =================
  async getBatchesForProduct(productId: number): Promise<ProductBatch[]> {
    await sqliteEngine.getDb();
    const batches = sqliteEngine.query<ProductBatch>(
      `SELECT b.*, p.name as product_name, p.category, l.name as location_name 
       FROM product_batches b
       LEFT JOIN products p ON b.product_id = p.id
       LEFT JOIN locations l ON b.location_id = l.id
       WHERE b.product_id = ? AND b.current_qty > 0
       ORDER BY CASE WHEN b.expiry_date IS NOT NULL AND b.expiry_date != '' THEN b.expiry_date ELSE '9999-12-31' END ASC`,
      [productId]
    );

    // Calculate days to expiry and dynamic status
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return batches.map(b => {
      let days = 999;
      let status = b.status;
      if (b.expiry_date) {
        const exp = new Date(b.expiry_date);
        if (!isNaN(exp.getTime())) {
          exp.setHours(0, 0, 0, 0);
          days = Math.ceil((exp.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
          if (days <= 0) {
            status = 'Expired';
          } else if (days <= 90) {
            status = 'Near Expiry';
          } else {
            status = 'Active';
          }
        }
      }
      return { ...b, days_to_expiry: days, status };
    });
  },

  async getProductBatches(productId: number): Promise<ProductBatch[]> {
    return this.getBatchesForProduct(productId);
  },

  async createDefaultBatch(productId: number, options?: Partial<ProductBatch>): Promise<ProductBatch> {
    await sqliteEngine.getDb();
    const prod = await this.getProductById(productId);
    const purchaseRate = options?.purchase_rate ?? prod?.purchase_rate ?? 0;
    const mrp = options?.mrp ?? prod?.mrp ?? 0;
    const sellingRate = options?.selling_rate ?? prod?.selling_rate ?? 0;
    const qty = options?.current_qty ?? 10;
    const batchNo = options?.batch_number || `BATCH-${Math.floor(100 + Math.random() * 900)}`;

    const res = sqliteEngine.run(
      `INSERT INTO product_batches (
        product_id, batch_number, mfg_date, expiry_date, purchase_rate, mrp, selling_rate,
        opening_qty, received_qty, sold_qty, current_qty, status
      ) VALUES (?, ?, date('now'), date('now', '+2 years'), ?, ?, ?, ?, ?, 0, ?, 'Active')`,
      [productId, batchNo, purchaseRate, mrp, sellingRate, qty, qty, qty]
    );

    return {
      id: res.lastInsertRowid,
      product_id: productId,
      batch_number: batchNo,
      mfg_date: new Date().toISOString().split('T')[0],
      expiry_date: new Date(Date.now() + 2 * 365 * 86400000).toISOString().split('T')[0],
      purchase_rate: purchaseRate,
      mrp,
      selling_rate: sellingRate,
      opening_qty: qty,
      current_qty: qty,
      location_id: 1,
      status: 'Active',
      product_name: prod?.name || '',
      category: prod?.category || '',
      days_to_expiry: 730,
    };
  },

  async getAllBatches(filter = 'ALL'): Promise<ProductBatch[]> {
    await sqliteEngine.getDb();
    let sql = `SELECT b.*, p.name as product_name, p.category, l.name as location_name 
               FROM product_batches b
               JOIN products p ON b.product_id = p.id
               LEFT JOIN locations l ON b.location_id = l.id
               WHERE b.current_qty > 0`;

    const batches = sqliteEngine.query<ProductBatch>(sql);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const mapped = batches.map(b => {
      let days = 999;
      let status = b.status;
      if (b.expiry_date) {
        const exp = new Date(b.expiry_date);
        if (!isNaN(exp.getTime())) {
          exp.setHours(0, 0, 0, 0);
          days = Math.ceil((exp.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
          if (days <= 0) {
            status = 'Expired';
          } else if (days <= 90) {
            status = 'Near Expiry';
          } else {
            status = 'Active';
          }
        }
      }
      return { ...b, days_to_expiry: days, status };
    });

    if (filter === 'NEAR_EXPIRY') {
      return mapped.filter(b => b.status === 'Near Expiry').sort((a, b) => (a.days_to_expiry || 0) - (b.days_to_expiry || 0));
    }
    if (filter === 'EXPIRED') {
      return mapped.filter(b => b.status === 'Expired');
    }
    return mapped.sort((a, b) => (a.days_to_expiry || 0) - (b.days_to_expiry || 0));
  },

  async adjustStock(
    productId: number,
    batchId: number,
    adjustmentQty: number, // positive or negative
    reason: string,
    userName = 'Admin'
  ): Promise<void> {
    await sqliteEngine.getDb();
    sqliteEngine.transaction(() => {
      const batch = sqliteEngine.queryOne<ProductBatch>('SELECT * FROM product_batches WHERE id = ?', [batchId]);
      if (!batch) throw new Error('Batch not found');

      const newQty = Math.max(0, batch.current_qty + adjustmentQty);
      sqliteEngine.run('UPDATE product_batches SET current_qty = ? WHERE id = ?', [newQty, batchId]);

      const product = sqliteEngine.queryOne<Product>('SELECT * FROM products WHERE id = ?', [productId]);

      sqliteEngine.run(
        `INSERT INTO stock_movements (
          date_time, product_id, product_name, batch_id, batch_number, movement_type, 
          quantity, unit, reference_type, reference_id, location_name, user_name, reason
        ) VALUES (datetime('now'), ?, ?, ?, ?, 'Stock Adjustment', ?, ?, 'Adjustment', 'ADJ', 'Main Shop', ?, ?)`,
        [productId, product?.name || '', batchId, batch.batch_number, adjustmentQty, product?.unit || 'Units', userName, reason]
      );

      this.logAudit(userName, 'STOCK_ADJUST', 'Inventory', String(batchId), `Adjusted batch ${batch.batch_number} by ${adjustmentQty}. Reason: ${reason}`);
    });
  },

  async adjustBatchStock(batchId: number, newPhysicalQty: number, reason = '', userName: any = 'Admin'): Promise<void> {
    await sqliteEngine.getDb();
    const batch = sqliteEngine.queryOne<ProductBatch>('SELECT * FROM product_batches WHERE id = ?', [batchId]);
    if (!batch) throw new Error('Batch not found');
    const diff = newPhysicalQty - batch.current_qty;
    return this.adjustStock(batch.product_id, batchId, diff, reason, typeof userName === 'number' ? 'Admin' : userName);
  },

  async getInventoryBatches(filters?: { status?: string; category?: string; search?: string }): Promise<ProductBatch[]> {
    await sqliteEngine.getDb();
    let sql = `SELECT b.*, p.name as product_name, p.category, p.unit, p.min_stock, l.name as location_name 
               FROM product_batches b
               JOIN products p ON b.product_id = p.id
               LEFT JOIN locations l ON b.location_id = l.id
               WHERE 1=1`;
    const params: any[] = [];
    if (filters?.category && filters.category !== 'All' && filters.category !== 'ALL') {
      sql += ' AND p.category = ?';
      params.push(filters.category);
    }
    if (filters?.search && filters.search.trim()) {
      const q = `%${filters.search.trim()}%`;
      sql += ' AND (p.name LIKE ? OR b.batch_number LIKE ?)';
      params.push(q, q);
    }
    sql += ' ORDER BY b.id DESC';
    const batches = sqliteEngine.query<ProductBatch>(sql, params);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const mapped = batches.map(b => {
      let days = 999;
      let status = b.status || 'Active';
      if (b.expiry_date) {
        const exp = new Date(b.expiry_date);
        if (!isNaN(exp.getTime())) {
          exp.setHours(0, 0, 0, 0);
          days = Math.ceil((exp.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
          if (days <= 0) {
            status = 'Expired';
          } else if (days <= 90) {
            status = 'Near Expiry';
          } else {
            status = 'Active';
          }
        }
      }
      return { ...b, days_to_expiry: days, status };
    });

    if (filters?.status === 'low_stock') {
      return mapped.filter(b => b.current_qty <= ((b as any).min_stock || 10));
    }
    if (filters?.status === 'near_expiry') {
      return mapped.filter(b => b.status === 'Near Expiry');
    }
    if (filters?.status === 'expired') {
      return mapped.filter(b => b.status === 'Expired');
    }
    return mapped;
  },

  async getStockMovements(limit = 100): Promise<StockMovement[]> {
    await sqliteEngine.getDb();
    return sqliteEngine.query<StockMovement>(
      'SELECT * FROM stock_movements ORDER BY id DESC LIMIT ?',
      [limit]
    );
  },

  // ================= SALES & POS BILLING =================
  async createSale(sale: Omit<Sale, 'id' | 'created_at'>, userName = 'Admin'): Promise<{ id: number; invoice_no: string }> {
    await sqliteEngine.getDb();
    return sqliteEngine.transaction(() => {
      // 1. Check stock for each item
      const inventorySettings = sqliteEngine.queryOne<any>('SELECT * FROM inventory_settings WHERE id = 1');
      const allowNegative = Boolean(inventorySettings?.allow_negative_stock);

      if (!sale.items || sale.items.length === 0) {
        throw new Error('Invoice must have at least one item');
      }

      for (const item of sale.items) {
        if (item.batch_id) {
          const batch = sqliteEngine.queryOne<ProductBatch>('SELECT * FROM product_batches WHERE id = ?', [item.batch_id]);
          if (!batch) {
            throw new Error(`Batch not found for product: ${item.product_name}`);
          }
          if (!allowNegative && batch.current_qty < item.quantity) {
            throw new Error(`Insufficient stock for ${item.product_name} (Batch: ${batch.batch_number}). Available: ${batch.current_qty}, Requested: ${item.quantity}`);
          }
        }
      }

      // 2. Generate unique invoice number if not provided
      let invoiceNo = sale.invoice_no ? sale.invoice_no.trim() : '';
      if (!invoiceNo) {
        const invSettings = sqliteEngine.queryOne<InvoiceSettings>('SELECT * FROM invoice_settings WHERE id = 1');
        const prefix = invSettings?.invoice_prefix || 'INV-2026-';
        const lastSale = sqliteEngine.queryOne<{ max_id: number }>('SELECT MAX(id) as max_id FROM sales');
        let nextNum = (invSettings?.starting_number || 1001) + (lastSale?.max_id || 0);
        invoiceNo = `${prefix}${String(nextNum).padStart(6, '0')}`;
        while (sqliteEngine.queryOne('SELECT id FROM sales WHERE invoice_no = ?', [invoiceNo])) {
          nextNum++;
          invoiceNo = `${prefix}${String(nextNum).padStart(6, '0')}`;
        }
      }

      // 3. Insert Sale Header
      const subtotal = Number(sale.subtotal) || 0;
      const discountAmount = Number(sale.discount_amount) || 0;
      const taxableAmount = Number(sale.taxable_amount) || 0;
      const cgstAmount = Number(sale.cgst_amount) || 0;
      const sgstAmount = Number(sale.sgst_amount) || 0;
      const igstAmount = Number(sale.igst_amount) || 0;
      const totalTax = Number(sale.total_tax) || 0;
      const roundOff = Number(sale.round_off) || 0;
      const grandTotal = Number(sale.grand_total) || 0;
      const paidAmount = Number(sale.paid_amount) || 0;
      const creditAmount = Number(sale.credit_amount) || 0;
      const customerId = sale.customer_id && Number(sale.customer_id) > 0 ? Number(sale.customer_id) : 0;

      let custAadhar = sale.customer_aadhar || '';
      let prevBal = Number(sale.previous_balance) || 0;
      if (customerId > 0) {
        const custRec = sqliteEngine.queryOne<any>('SELECT current_balance, aadhar_no FROM customers WHERE id = ?', [customerId]);
        if (custRec) {
          prevBal = Number(custRec.current_balance) || 0;
          if (!custAadhar && custRec.aadhar_no) custAadhar = custRec.aadhar_no;
        }
      }
      const docNo = sale.doc_no || String(1000 + ((sale as any).id || 1));
      const docDate = sale.doc_date || sale.invoice_date;
      const outstandingBal = prevBal + creditAmount;

      const saleRes = sqliteEngine.run(
        `INSERT INTO sales (
          invoice_no, invoice_date, doc_no, doc_date, customer_id, customer_name, customer_mobile, customer_village, 
          customer_aadhar, customer_outstanding, previous_balance, payment_mode, subtotal, discount_amount, taxable_amount, 
          cgst_amount, sgst_amount, igst_amount, total_tax, round_off, grand_total, paid_amount, credit_amount, status, 
          notes, user_id, user_name, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Completed', ?, ?, ?, datetime('now'))`,
        [
          invoiceNo, sale.invoice_date, docNo, docDate, customerId, sale.customer_name || 'Walk-in',
          sale.customer_mobile || '', sale.customer_village || '', custAadhar, outstandingBal, prevBal,
          sale.payment_mode, subtotal, discountAmount, taxableAmount, cgstAmount, sgstAmount,
          igstAmount, totalTax, roundOff, grandTotal, paidAmount,
          creditAmount, sale.notes || '', sale.user_id || 1, userName
        ]
      );
      const saleId = saleRes.lastInsertRowid;

      // 4. Insert Items & Decrement Stock & Record Stock Movements
      for (const item of sale.items) {
        let prodInfo: any = null;
        try {
          prodInfo = sqliteEngine.queryOne<any>('SELECT * FROM products WHERE id = ?', [item.product_id]);
        } catch {
          prodInfo = null;
        }
        const itemMfg = item.mfg || prodInfo?.company || prodInfo?.brand || '';
        const itemContent = item.content || prodInfo?.technical_name || prodInfo?.fertilizer_grade || prodInfo?.subcategory || '';
        const itemTechName = (item as any).technical_name || prodInfo?.technical_name || itemContent || '';

        sqliteEngine.run(
          `INSERT INTO sale_items (
            sale_id, product_id, product_name, product_code, hsn_code, mfg, company, content, technical_name, batch_id, batch_number, 
            expiry_date, unit, pack_size, quantity, rate, mrp, discount_percent, discount_amount, 
            taxable_value, gst_rate, cgst_amount, sgst_amount, igst_amount, total_tax, total_amount
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            saleId, item.product_id, item.product_name, item.product_code, item.hsn_code, itemMfg, itemMfg, itemContent, itemTechName,
            item.batch_id || null, item.batch_number || '', item.expiry_date || '', item.unit,
            item.pack_size || '', item.quantity, item.rate, item.mrp, item.discount_percent,
            item.discount_amount, item.taxable_value, item.gst_rate, item.cgst_amount,
            item.sgst_amount, item.igst_amount, item.total_tax, item.total_amount
          ]
        );

        if (item.batch_id) {
          sqliteEngine.run(
            'UPDATE product_batches SET current_qty = current_qty - ? WHERE id = ?',
            [item.quantity, item.batch_id]
          );

          sqliteEngine.run(
            `INSERT INTO stock_movements (
              date_time, product_id, product_name, batch_id, batch_number, movement_type, 
              quantity, unit, reference_type, reference_id, location_name, user_name, reason
            ) VALUES (datetime('now'), ?, ?, ?, ?, 'Sale', ?, ?, 'Sale', ?, 'Main Shop', ?, 'Invoice Billing')`,
            [item.product_id, item.product_name, item.batch_id, item.batch_number, -item.quantity, item.unit, invoiceNo, userName]
          );
        }

        // Statutory Pesticide Record if product is pesticide / insecticide
        const prod = sqliteEngine.queryOne<Product>('SELECT category, cib_registration_no FROM products WHERE id = ?', [item.product_id]);
        if (prod && (prod.category === 'Insecticide' || prod.category === 'Pesticide' || prod.category === 'Fungicide' || prod.category === 'Herbicide')) {
          sqliteEngine.run(
            `INSERT INTO pesticide_sales_records (
              date, invoice_no, farmer_name, farmer_mobile, farmer_village, product_name, 
              batch_number, cib_no, quantity, unit, crop_treated, remarks
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              sale.invoice_date, invoiceNo, sale.customer_name || 'Cash Customer',
              sale.customer_mobile || '', sale.customer_village || '', item.product_name,
              item.batch_number || '', prod.cib_registration_no || '', item.quantity, item.unit,
              'General Field Application', 'Counter Sale'
            ]
          );
        }
      }

      // 5. Update Customer Ledger if Credit / Khata exists
      if (creditAmount > 0 && customerId > 0) {
        const cust = sqliteEngine.queryOne<Customer>('SELECT current_balance FROM customers WHERE id = ?', [customerId]);
        const newBal = (cust?.current_balance || 0) + creditAmount;
        sqliteEngine.run('UPDATE customers SET current_balance = ? WHERE id = ?', [newBal, customerId]);

        sqliteEngine.run(
          `INSERT INTO customer_ledger (
            customer_id, date, reference_type, reference_no, description, debit, credit, balance, created_at
          ) VALUES (?, ?, 'Credit Sale', ?, 'खते व औषधे उधारी खरेदी', ?, 0, ?, datetime('now'))`,
          [customerId, sale.invoice_date, invoiceNo, creditAmount, newBal]
        );
      }

      // 6. Record Cash Transaction if Cash payment was received
      if (sale.paid_amount > 0 && (sale.payment_mode === 'Cash' || sale.payment_mode === 'Mixed')) {
        const cashAmount = sale.payment_mode === 'Cash' ? sale.paid_amount : sale.paid_amount;
        const lastCash = sqliteEngine.queryOne<{ balance_after: number }>('SELECT balance_after FROM cash_transactions ORDER BY id DESC LIMIT 1');
        const newCashBal = (lastCash?.balance_after || 0) + cashAmount;

        sqliteEngine.run(
          `INSERT INTO cash_transactions (
            date_time, type, category, amount, balance_after, reference_id, description, user_name
          ) VALUES (datetime('now'), 'IN', 'Cash Sale', ?, ?, ?, 'रोख विक्री पावती', ?)`,
          [cashAmount, newCashBal, invoiceNo, userName]
        );
      }

      this.logAudit(userName, 'CREATE_SALE', 'Sale', invoiceNo, `Sale invoice created for ${sale.customer_name} of ${sale.grand_total}`);

      return { id: saleId, invoice_no: invoiceNo };
    });
  },

  async getSales(search = '', fromDate = '', toDate = '', limit = 100): Promise<Sale[]> {
    await sqliteEngine.getDb();
    let sql = 'SELECT * FROM sales WHERE 1=1';
    const params: any[] = [];

    if (search.trim()) {
      const q = `%${search.trim()}%`;
      sql += ' AND (invoice_no LIKE ? OR customer_name LIKE ? OR customer_mobile LIKE ?)';
      params.push(q, q, q);
    }
    if (fromDate) {
      sql += ' AND invoice_date >= ?';
      params.push(fromDate);
    }
    if (toDate) {
      sql += ' AND invoice_date <= ?';
      params.push(toDate);
    }
    sql += ' ORDER BY id DESC LIMIT ?';
    params.push(limit);

    return sqliteEngine.query<Sale>(sql, params);
  },

  async getSaleById(id: number): Promise<Sale | null> {
    await sqliteEngine.getDb();
    const sale = sqliteEngine.queryOne<Sale>('SELECT * FROM sales WHERE id = ?', [id]);
    if (!sale) return null;

    const items = sqliteEngine.query<SaleItem>(`
      SELECT si.*, 
             COALESCE(si.mfg, si.company, p.company, p.brand, '') as mfg,
             COALESCE(si.company, p.company, p.brand, '') as company,
             COALESCE(si.company, p.company, p.brand, '') as manufacturer_name,
             COALESCE(si.company, p.company, p.brand, '') as company_name,
             COALESCE(si.technical_name, si.content, p.technical_name, p.fertilizer_grade, p.subcategory, '') as content,
             COALESCE(si.technical_name, si.content, p.technical_name, p.fertilizer_grade, p.subcategory, '') as chemical_content,
             COALESCE(si.technical_name, p.technical_name, '') as technical_name
      FROM sale_items si
      LEFT JOIN products p ON si.product_id = p.id
      WHERE si.sale_id = ?
    `, [id]);

    let outstanding = sale.customer_outstanding;
    if ((outstanding === undefined || outstanding === null || outstanding === 0) && sale.customer_id) {
      const cust = sqliteEngine.queryOne<Customer>('SELECT current_balance, aadhar_no FROM customers WHERE id = ?', [sale.customer_id]);
      if (cust) {
        outstanding = cust.current_balance || 0;
        if (!sale.customer_aadhar && cust.aadhar_no) {
          sale.customer_aadhar = cust.aadhar_no;
        }
      }
    }

    return { 
      ...sale, 
      items, 
      customer_outstanding: outstanding || 0,
      doc_no: sale.doc_no || String(1000 + sale.id),
      doc_date: sale.doc_date || sale.invoice_date,
    };
  },

  async cancelSale(id: number, reason: string, userName = 'Admin'): Promise<void> {
    await sqliteEngine.getDb();
    sqliteEngine.transaction(() => {
      const sale = sqliteEngine.queryOne<Sale>('SELECT * FROM sales WHERE id = ?', [id]);
      if (!sale) throw new Error('Sale invoice not found');
      if (sale.status === 'Cancelled') throw new Error('Sale is already cancelled');

      const items = sqliteEngine.query<SaleItem>('SELECT * FROM sale_items WHERE sale_id = ?', [id]);

      // Revert stock for each item
      for (const item of items) {
        if (item.batch_id) {
          sqliteEngine.run('UPDATE product_batches SET current_qty = current_qty + ? WHERE id = ?', [item.quantity, item.batch_id]);
          sqliteEngine.run(
            `INSERT INTO stock_movements (
              date_time, product_id, product_name, batch_id, batch_number, movement_type, 
              quantity, unit, reference_type, reference_id, location_name, user_name, reason
            ) VALUES (datetime('now'), ?, ?, ?, ?, 'Sales Return', ?, ?, 'Sale Cancel', ?, 'Main Shop', ?, ?)`,
            [item.product_id, item.product_name, item.batch_id, item.batch_number, item.quantity, item.unit, sale.invoice_no, userName, `Bill Cancelled: ${reason}`]
          );
        }
      }

      // Revert customer credit balance if applied
      if (sale.credit_amount > 0 && sale.customer_id) {
        const cust = sqliteEngine.queryOne<Customer>('SELECT current_balance FROM customers WHERE id = ?', [sale.customer_id]);
        const newBal = Math.max(0, (cust?.current_balance || 0) - sale.credit_amount);
        sqliteEngine.run('UPDATE customers SET current_balance = ? WHERE id = ?', [newBal, sale.customer_id]);
        sqliteEngine.run(
          `INSERT INTO customer_ledger (
            customer_id, date, reference_type, reference_no, description, debit, credit, balance, created_at
          ) VALUES (?, date('now'), 'Adjustment', ?, 'रद्द बिलापोटी उधारी वजावट', 0, ?, ?, datetime('now'))`,
          [sale.customer_id, sale.invoice_no, sale.credit_amount, newBal]
        );
      }

      // Adjust cash transaction if cash was received
      if (sale.paid_amount > 0 && sale.payment_mode === 'Cash') {
        const lastCash = sqliteEngine.queryOne<{ balance_after: number }>('SELECT balance_after FROM cash_transactions ORDER BY id DESC LIMIT 1');
        const newCashBal = (lastCash?.balance_after || 0) - sale.paid_amount;
        sqliteEngine.run(
          `INSERT INTO cash_transactions (
            date_time, type, category, amount, balance_after, reference_id, description, user_name
          ) VALUES (datetime('now'), 'OUT', 'Adjustment', ?, ?, ?, 'रद्द बिलापोटी रोख परतावा', ?)`,
          [sale.paid_amount, newCashBal, sale.invoice_no, userName]
        );
      }

      sqliteEngine.run("UPDATE sales SET status = 'Cancelled', notes = notes || ? WHERE id = ?", [` [Cancelled: ${reason}]`, id]);
      this.logAudit(userName, 'CANCEL_SALE', 'Sale', sale.invoice_no, `Cancelled invoice ${sale.invoice_no}. Reason: ${reason}`);
    });
  },

  async updateSale(id: number, sale: Omit<Sale, 'id' | 'created_at'>, userName = 'Admin'): Promise<{ id: number; invoice_no: string }> {
    await sqliteEngine.getDb();
    return sqliteEngine.transaction(() => {
      const existingSale = sqliteEngine.queryOne<Sale>('SELECT * FROM sales WHERE id = ?', [id]);
      if (!existingSale) throw new Error('Sale invoice not found');

      const oldItems = sqliteEngine.query<SaleItem>('SELECT * FROM sale_items WHERE sale_id = ?', [id]);

      // 1. Revert previous stock quantities
      for (const oldItem of oldItems) {
        if (oldItem.batch_id) {
          sqliteEngine.run('UPDATE product_batches SET current_qty = current_qty + ? WHERE id = ?', [oldItem.quantity, oldItem.batch_id]);
          sqliteEngine.run(
            `INSERT INTO stock_movements (
              date_time, product_id, product_name, batch_id, batch_number, movement_type, 
              quantity, unit, reference_type, reference_id, location_name, user_name, reason
            ) VALUES (datetime('now'), ?, ?, ?, ?, 'Stock Adjustment', ?, ?, 'Sale Edit', ?, 'Main Shop', ?, ?)`,
            [oldItem.product_id, oldItem.product_name, oldItem.batch_id, oldItem.batch_number, oldItem.quantity, oldItem.unit, existingSale.invoice_no, userName, 'Reverting stock before bill update']
          );
        }
      }

      // 2. Revert previous customer credit balance if any
      if (Number(existingSale.credit_amount) > 0 && existingSale.customer_id && Number(existingSale.customer_id) > 0) {
        const cust = sqliteEngine.queryOne<Customer>('SELECT current_balance FROM customers WHERE id = ?', [existingSale.customer_id]);
        const revertedBal = Math.max(0, (cust?.current_balance || 0) - Number(existingSale.credit_amount));
        sqliteEngine.run('UPDATE customers SET current_balance = ? WHERE id = ?', [revertedBal, existingSale.customer_id]);
        sqliteEngine.run(
          `INSERT INTO customer_ledger (
            customer_id, date, reference_type, reference_no, description, debit, credit, balance, created_at
          ) VALUES (?, date('now'), 'Adjustment', ?, 'बिल दुरुस्तीपूर्वी उधारी समायोजन', 0, ?, ?, datetime('now'))`,
          [existingSale.customer_id, existingSale.invoice_no, Number(existingSale.credit_amount), revertedBal]
        );
      }

      // 3. Revert previous cash transaction if any
      if (Number(existingSale.paid_amount) > 0 && (existingSale.payment_mode === 'Cash' || existingSale.payment_mode === 'Mixed')) {
        const lastCash = sqliteEngine.queryOne<{ balance_after: number }>('SELECT balance_after FROM cash_transactions ORDER BY id DESC LIMIT 1');
        const newCashBal = (lastCash?.balance_after || 0) - Number(existingSale.paid_amount);
        sqliteEngine.run(
          `INSERT INTO cash_transactions (
            date_time, type, category, amount, balance_after, reference_id, description, user_name
          ) VALUES (datetime('now'), 'OUT', 'Adjustment', ?, ?, ?, 'बिल दुरुस्तीपूर्वी रोख समायोजन', ?)`,
          [Number(existingSale.paid_amount), newCashBal, existingSale.invoice_no, userName]
        );
      }

      // 4. Remove old sale items and old statutory pesticide records
      sqliteEngine.run('DELETE FROM sale_items WHERE sale_id = ?', [id]);
      sqliteEngine.run('DELETE FROM pesticide_sales_records WHERE invoice_no = ?', [existingSale.invoice_no]);

      // 5. Check stock for updated items
      const inventorySettings = sqliteEngine.queryOne<any>('SELECT * FROM inventory_settings WHERE id = 1');
      const allowNegative = Boolean(inventorySettings?.allow_negative_stock);

      if (!sale.items || sale.items.length === 0) {
        throw new Error('Invoice must have at least one item');
      }

      for (const item of sale.items) {
        if (item.batch_id) {
          const batch = sqliteEngine.queryOne<ProductBatch>('SELECT * FROM product_batches WHERE id = ?', [item.batch_id]);
          if (!batch) {
            throw new Error(`Batch not found for product: ${item.product_name}`);
          }
          if (!allowNegative && batch.current_qty < item.quantity) {
            throw new Error(`Insufficient stock for ${item.product_name} (Batch: ${batch.batch_number}). Available: ${batch.current_qty}, Requested: ${item.quantity}`);
          }
        }
      }

      // 6. Update Sale Header
      const invoiceNo = existingSale.invoice_no;
      const subtotal = Number(sale.subtotal) || 0;
      const discountAmount = Number(sale.discount_amount) || 0;
      const taxableAmount = Number(sale.taxable_amount) || 0;
      const cgstAmount = Number(sale.cgst_amount) || 0;
      const sgstAmount = Number(sale.sgst_amount) || 0;
      const igstAmount = Number(sale.igst_amount) || 0;
      const totalTax = Number(sale.total_tax) || 0;
      const roundOff = Number(sale.round_off) || 0;
      const grandTotal = Number(sale.grand_total) || 0;
      const paidAmount = Number(sale.paid_amount) || 0;
      const creditAmount = Number(sale.credit_amount) || 0;
      const customerId = sale.customer_id && Number(sale.customer_id) > 0 ? Number(sale.customer_id) : 0;

      let custAadhar = sale.customer_aadhar || '';
      let prevBal = 0;
      if (customerId > 0) {
        const custRec = sqliteEngine.queryOne<any>('SELECT current_balance, aadhar_no FROM customers WHERE id = ?', [customerId]);
        if (custRec) {
          prevBal = Number(custRec.current_balance) || 0;
          if (!custAadhar && custRec.aadhar_no) custAadhar = custRec.aadhar_no;
        }
      }
      const outstandingBal = prevBal + creditAmount;

      sqliteEngine.run(
        `UPDATE sales SET
          invoice_date = ?, doc_date = ?, customer_id = ?, customer_name = ?, customer_mobile = ?, customer_village = ?,
          customer_aadhar = ?, customer_outstanding = ?, previous_balance = ?, payment_mode = ?, subtotal = ?, 
          discount_amount = ?, taxable_amount = ?, cgst_amount = ?, sgst_amount = ?, igst_amount = ?, total_tax = ?, 
          round_off = ?, grand_total = ?, paid_amount = ?, credit_amount = ?, status = 'Completed', notes = ?, user_name = ?
        WHERE id = ?`,
        [
          sale.invoice_date, sale.doc_date || sale.invoice_date, customerId, sale.customer_name || 'Walk-in',
          sale.customer_mobile || '', sale.customer_village || '', custAadhar, outstandingBal, prevBal,
          sale.payment_mode, subtotal, discountAmount, taxableAmount, cgstAmount, sgstAmount,
          igstAmount, totalTax, roundOff, grandTotal, paidAmount,
          creditAmount, sale.notes || '', userName, id
        ]
      );

      // 7. Insert New Sale Items & Deduct Stock & Update Statutory records
      for (const item of sale.items) {
        let prodInfo: any = null;
        try {
          prodInfo = sqliteEngine.queryOne<any>('SELECT * FROM products WHERE id = ?', [item.product_id]);
        } catch {
          prodInfo = null;
        }
        const itemMfg = item.mfg || prodInfo?.company || prodInfo?.brand || '';
        const itemContent = item.content || prodInfo?.technical_name || prodInfo?.fertilizer_grade || prodInfo?.subcategory || '';
        const itemTechName = (item as any).technical_name || prodInfo?.technical_name || itemContent || '';

        sqliteEngine.run(
          `INSERT INTO sale_items (
            sale_id, product_id, product_name, product_code, hsn_code, mfg, company, content, technical_name, batch_id, batch_number, 
            expiry_date, unit, pack_size, quantity, rate, mrp, discount_percent, discount_amount, 
            taxable_value, gst_rate, cgst_amount, sgst_amount, igst_amount, total_tax, total_amount
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            id, item.product_id, item.product_name, item.product_code, item.hsn_code, itemMfg, itemMfg, itemContent, itemTechName,
            item.batch_id || null, item.batch_number || '', item.expiry_date || '', item.unit,
            item.pack_size || '', item.quantity, item.rate, item.mrp, item.discount_percent,
            item.discount_amount, item.taxable_value, item.gst_rate, item.cgst_amount,
            item.sgst_amount, item.igst_amount, item.total_tax, item.total_amount
          ]
        );

        if (item.batch_id) {
          sqliteEngine.run(
            'UPDATE product_batches SET current_qty = current_qty - ? WHERE id = ?',
            [item.quantity, item.batch_id]
          );

          sqliteEngine.run(
            `INSERT INTO stock_movements (
              date_time, product_id, product_name, batch_id, batch_number, movement_type, 
              quantity, unit, reference_type, reference_id, location_name, user_name, reason
            ) VALUES (datetime('now'), ?, ?, ?, ?, 'Sale', ?, ?, 'Sale', ?, 'Main Shop', ?, 'Updated Invoice Billing')`,
            [item.product_id, item.product_name, item.batch_id, item.batch_number, -item.quantity, item.unit, invoiceNo, userName]
          );
        }

        // Statutory Pesticide Record if pesticide category
        const prod = sqliteEngine.queryOne<Product>('SELECT category, cib_registration_no FROM products WHERE id = ?', [item.product_id]);
        if (prod && (prod.category === 'Insecticide' || prod.category === 'Pesticide' || prod.category === 'Fungicide' || prod.category === 'Herbicide')) {
          sqliteEngine.run(
            `INSERT INTO pesticide_sales_records (
              date, invoice_no, farmer_name, farmer_mobile, farmer_village, product_name, 
              batch_number, cib_no, quantity, unit, crop_treated, remarks
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              sale.invoice_date, invoiceNo, sale.customer_name || 'Cash Customer',
              sale.customer_mobile || '', sale.customer_village || '', item.product_name,
              item.batch_number || '', prod.cib_registration_no || '', item.quantity, item.unit,
              'General Field Application', 'Updated Invoice Sale'
            ]
          );
        }
      }

      // 8. Apply updated Customer Credit Ledger
      if (creditAmount > 0 && customerId > 0) {
        const cust = sqliteEngine.queryOne<Customer>('SELECT current_balance FROM customers WHERE id = ?', [customerId]);
        const newBal = (cust?.current_balance || 0) + creditAmount;
        sqliteEngine.run('UPDATE customers SET current_balance = ? WHERE id = ?', [newBal, customerId]);

        sqliteEngine.run(
          `INSERT INTO customer_ledger (
            customer_id, date, reference_type, reference_no, description, debit, credit, balance, created_at
          ) VALUES (?, ?, 'Credit Sale', ?, 'अद्ययावत बिल उधारी खरेदी', ?, 0, ?, datetime('now'))`,
          [customerId, sale.invoice_date, invoiceNo, creditAmount, newBal]
        );
      }

      // 9. Apply updated Cash Transaction
      if (paidAmount > 0 && (sale.payment_mode === 'Cash' || sale.payment_mode === 'Mixed')) {
        const lastCash = sqliteEngine.queryOne<{ balance_after: number }>('SELECT balance_after FROM cash_transactions ORDER BY id DESC LIMIT 1');
        const newCashBal = (lastCash?.balance_after || 0) + paidAmount;

        sqliteEngine.run(
          `INSERT INTO cash_transactions (
            date_time, type, category, amount, balance_after, reference_id, description, user_name
          ) VALUES (datetime('now'), 'IN', 'Cash Sale', ?, ?, ?, 'अद्ययावत रोख विक्री पावती', ?)`,
          [paidAmount, newCashBal, invoiceNo, userName]
        );
      }

      this.logAudit(userName, 'UPDATE_SALE', 'Sale', invoiceNo, `Sale invoice ${invoiceNo} updated. New total: ${sale.grand_total}`);

      return { id, invoice_no: invoiceNo };
    });
  },

  async deleteSale(id: number, reason = 'Deleted by user', userName = 'Admin'): Promise<void> {
    return this.cancelSale(id, reason, userName);
  },

  // ================= PURCHASES =================
  async createPurchase(purchase: Omit<Purchase, 'id' | 'created_at'>, userName = 'Admin'): Promise<number> {
    await sqliteEngine.getDb();
    return sqliteEngine.transaction(() => {
      // 1. Generate unique purchase number
      const lastPur = sqliteEngine.queryOne<{ max_id: number }>('SELECT MAX(id) as max_id FROM purchases');
      const nextNum = 1001 + (lastPur?.max_id || 0);
      const purchaseNo = `PUR-2026-${String(nextNum).padStart(5, '0')}`;

      // 2. Insert Purchase Header
      const purRes = sqliteEngine.run(
        `INSERT INTO purchases (
          purchase_no, supplier_invoice_no, invoice_date, supplier_id, supplier_name, 
          payment_type, subtotal, discount_amount, taxable_amount, cgst_amount, sgst_amount, 
          igst_amount, total_tax, other_charges, grand_total, paid_amount, credit_amount, 
          status, notes, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Completed', ?, datetime('now'))`,
        [
          purchaseNo, purchase.supplier_invoice_no, purchase.invoice_date, purchase.supplier_id,
          purchase.supplier_name, purchase.payment_type, purchase.subtotal, purchase.discount_amount,
          purchase.taxable_amount, purchase.cgst_amount, purchase.sgst_amount, purchase.igst_amount,
          purchase.total_tax, purchase.other_charges, purchase.grand_total, purchase.paid_amount,
          purchase.credit_amount, purchase.notes || ''
        ]
      );
      const purchaseId = purRes.lastInsertRowid;

      // 3. Process each purchase item: Create / Update Batch, Increase Stock, Record Stock Movement
      if (purchase.items && purchase.items.length) {
        for (const item of purchase.items) {
          sqliteEngine.run(
            `INSERT INTO purchase_items (
              purchase_id, product_id, product_name, batch_number, mfg_date, expiry_date, 
              quantity, free_qty, unit, purchase_rate, mrp, selling_rate, discount_percent, 
              taxable_value, gst_rate, cgst_amount, sgst_amount, igst_amount, total_tax, total_amount
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              purchaseId, item.product_id, item.product_name, item.batch_number, item.mfg_date || '',
              item.expiry_date || '', item.quantity, item.free_qty || 0, item.unit, item.purchase_rate,
              item.mrp, item.selling_rate, item.discount_percent || 0, item.taxable_value,
              item.gst_rate, item.cgst_amount, item.sgst_amount, item.igst_amount || 0,
              item.total_tax, item.total_amount
            ]
          );

          const totalQty = item.quantity + (item.free_qty || 0);

          // Find if batch exists for this product
          let existingBatch = sqliteEngine.queryOne<ProductBatch>(
            'SELECT * FROM product_batches WHERE product_id = ? AND batch_number = ?',
            [item.product_id, item.batch_number]
          );

          let batchId = 0;
          if (existingBatch) {
            batchId = existingBatch.id;
            sqliteEngine.run(
              'UPDATE product_batches SET current_qty = current_qty + ?, purchase_rate = ?, mrp = ?, selling_rate = ? WHERE id = ?',
              [totalQty, item.purchase_rate, item.mrp, item.selling_rate, batchId]
            );
          } else {
            const batchRes = sqliteEngine.run(
              `INSERT INTO product_batches (
                product_id, batch_number, mfg_date, expiry_date, purchase_rate, mrp, selling_rate, 
                opening_qty, current_qty, location_id, supplier_id, status
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, 'Active')`,
              [
                item.product_id, item.batch_number, item.mfg_date || '', item.expiry_date || '',
                item.purchase_rate, item.mrp, item.selling_rate, totalQty, totalQty, purchase.supplier_id
              ]
            );
            batchId = batchRes.lastInsertRowid;
          }

          // Stock movement log
          sqliteEngine.run(
            `INSERT INTO stock_movements (
              date_time, product_id, product_name, batch_id, batch_number, movement_type, 
              quantity, unit, reference_type, reference_id, location_name, user_name, reason
            ) VALUES (datetime('now'), ?, ?, ?, ?, 'Purchase', ?, ?, 'Purchase', ?, 'Main Shop', ?, 'Purchase Inward')`,
            [item.product_id, item.product_name, batchId, item.batch_number, totalQty, item.unit, purchaseNo, userName]
          );
        }
      }

      // 4. Update Supplier Payable Balance and Ledger
      if (purchase.credit_amount > 0 && purchase.supplier_id) {
        const supp = sqliteEngine.queryOne<Supplier>('SELECT current_balance FROM suppliers WHERE id = ?', [purchase.supplier_id]);
        const newBal = (supp?.current_balance || 0) + purchase.credit_amount;
        sqliteEngine.run('UPDATE suppliers SET current_balance = ? WHERE id = ?', [newBal, purchase.supplier_id]);

        sqliteEngine.run(
          `INSERT INTO supplier_ledger (
            supplier_id, date, reference_type, reference_no, description, debit, credit, balance, created_at
          ) VALUES (?, ?, 'Credit Purchase', ?, ?, 0, ?, ?, datetime('now'))`,
          [purchase.supplier_id, purchase.invoice_date, purchaseNo, `खरेदी बिल क्र. ${purchase.supplier_invoice_no}`, purchase.credit_amount, newBal]
        );
      }

      // 5. Deduct Cash if cash payment made
      if (purchase.paid_amount > 0 && purchase.payment_type === 'Cash') {
        const lastCash = sqliteEngine.queryOne<{ balance_after: number }>('SELECT balance_after FROM cash_transactions ORDER BY id DESC LIMIT 1');
        const newCashBal = (lastCash?.balance_after || 0) - purchase.paid_amount;
        sqliteEngine.run(
          `INSERT INTO cash_transactions (
            date_time, type, category, amount, balance_after, reference_id, description, user_name
          ) VALUES (datetime('now'), 'OUT', 'Cash Purchase', ?, ?, ?, ?, ?)`,
          [purchase.paid_amount, newCashBal, purchaseNo, `खरेदी अदा ${purchase.supplier_name}`, userName]
        );
      }

      this.logAudit(userName, 'CREATE_PURCHASE', 'Purchase', purchaseNo, `Purchase entry ${purchaseNo} from ${purchase.supplier_name} of ${purchase.grand_total}`);
      return purchaseId;
    });
  },

  async getPurchases(search = '', limit = 100): Promise<Purchase[]> {
    await sqliteEngine.getDb();
    let sql = 'SELECT * FROM purchases WHERE 1=1';
    const params: any[] = [];
    if (search.trim()) {
      const q = `%${search.trim()}%`;
      sql += ' AND (purchase_no LIKE ? OR supplier_invoice_no LIKE ? OR supplier_name LIKE ?)';
      params.push(q, q, q);
    }
    sql += ' ORDER BY id DESC LIMIT ?';
    params.push(limit);
    return sqliteEngine.query<Purchase>(sql, params);
  },

  async getPurchaseById(id: number): Promise<Purchase | null> {
    await sqliteEngine.getDb();
    const purchase = sqliteEngine.queryOne<Purchase>('SELECT * FROM purchases WHERE id = ?', [id]);
    if (!purchase) return null;
    const items = sqliteEngine.query<PurchaseItem>('SELECT * FROM purchase_items WHERE purchase_id = ?', [id]);
    return { ...purchase, items };
  },

  // ================= FARMERS & KHATA =================
  async getCustomers(search = '', villageFilter = ''): Promise<Customer[]> {
    await sqliteEngine.getDb();
    let sql = 'SELECT * FROM customers WHERE active = 1';
    const params: any[] = [];
    if (search.trim()) {
      const q = `%${search.trim()}%`;
      sql += ' AND (name LIKE ? OR name_mr LIKE ? OR mobile LIKE ? OR village LIKE ? OR customer_code LIKE ?)';
      params.push(q, q, q, q, q);
    }
    if (villageFilter && villageFilter !== 'All' && villageFilter !== 'सर्व गावे') {
      sql += ' AND village = ?';
      params.push(villageFilter);
    }
    sql += ' ORDER BY name ASC';
    return sqliteEngine.query<Customer>(sql, params);
  },

  async getCustomerById(id: number): Promise<Customer | null> {
    await sqliteEngine.getDb();
    return sqliteEngine.queryOne<Customer>('SELECT * FROM customers WHERE id = ?', [id]);
  },

  async saveCustomer(cust: Partial<Customer>, userName = 'Admin'): Promise<number> {
    await sqliteEngine.getDb();
    if (cust.id) {
      sqliteEngine.run(
        `UPDATE customers SET 
          name = ?, name_mr = ?, mobile = ?, alt_mobile = ?, village = ?, taluka = ?, 
          district = ?, address = ?, pincode = ?, credit_limit = ?, notes = ? 
        WHERE id = ?`,
        [
          cust.name, cust.name_mr || '', cust.mobile, cust.alt_mobile || '', cust.village,
          cust.taluka || '', cust.district || '', cust.address || '', cust.pincode || '',
          cust.credit_limit || 50000, cust.notes || '', cust.id
        ]
      );
      this.logAudit(userName, 'UPDATE', 'Customer', String(cust.id), `Updated customer ${cust.name}`);
      return cust.id;
    } else {
      const lastCust = sqliteEngine.queryOne<{ max_id: number }>('SELECT MAX(id) as max_id FROM customers');
      const nextCode = `CUST-${String(101 + (lastCust?.max_id || 0)).padStart(4, '0')}`;

      const res = sqliteEngine.run(
        `INSERT INTO customers (
          customer_code, name, name_mr, mobile, alt_mobile, village, taluka, district, 
          address, pincode, credit_limit, opening_balance, current_balance, notes, active, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, datetime('now'))`,
        [
          nextCode, cust.name, cust.name_mr || '', cust.mobile, cust.alt_mobile || '', cust.village,
          cust.taluka || 'बारामती', cust.district || 'पुणे', cust.address || '', cust.pincode || '',
          cust.credit_limit || 50000, cust.opening_balance || 0, cust.opening_balance || 0, cust.notes || ''
        ]
      );
      const newId = res.lastInsertRowid;

      if ((cust.opening_balance || 0) > 0) {
        sqliteEngine.run(
          `INSERT INTO customer_ledger (
            customer_id, date, reference_type, reference_no, description, debit, credit, balance, created_at
          ) VALUES (?, date('now'), 'Opening Balance', 'OPEN', 'सुरुवातीची बाकी जमा', ?, 0, ?, datetime('now'))`,
          [newId, cust.opening_balance, cust.opening_balance]
        );
      }

      this.logAudit(userName, 'CREATE', 'Customer', String(newId), `Created customer ${cust.name} (${nextCode})`);
      return newId;
    }
  },

  async createCustomer(cust: Partial<Customer>, userName = 'Admin'): Promise<number> {
    return this.saveCustomer(cust, userName);
  },

  async updateCustomer(id: number, cust: Partial<Customer>, userName = 'Admin'): Promise<number> {
    return this.saveCustomer({ ...cust, id }, userName);
  },

  async recordCustomerPayment(
    customerId: number,
    amount: number,
    paymentMode: 'Cash' | 'UPI' | 'Bank' | 'Card',
    referenceNo = '',
    notes = '',
    userName = 'Admin'
  ): Promise<string> {
    await sqliteEngine.getDb();
    return sqliteEngine.transaction(() => {
      const cust = sqliteEngine.queryOne<Customer>('SELECT * FROM customers WHERE id = ?', [customerId]);
      if (!cust) throw new Error('Customer not found');

      const lastPay = sqliteEngine.queryOne<{ max_id: number }>('SELECT MAX(id) as max_id FROM customer_payments');
      const paymentNo = `REC-2026-${String(1001 + (lastPay?.max_id || 0)).padStart(5, '0')}`;

      sqliteEngine.run(
        `INSERT INTO customer_payments (
          payment_no, customer_id, date, amount, payment_mode, reference_no, notes, created_at
        ) VALUES (?, ?, date('now'), ?, ?, ?, ?, datetime('now'))`,
        [paymentNo, customerId, amount, paymentMode, referenceNo, notes]
      );

      const newBalance = Math.max(0, cust.current_balance - amount);
      sqliteEngine.run('UPDATE customers SET current_balance = ? WHERE id = ?', [newBalance, customerId]);

      sqliteEngine.run(
        `INSERT INTO customer_ledger (
          customer_id, date, reference_type, reference_no, description, debit, credit, balance, created_at
        ) VALUES (?, date('now'), 'Payment Received', ?, ?, 0, ?, ?, datetime('now'))`,
        [customerId, paymentNo, `${paymentMode} जमा पावती - ${notes || 'उधारी भरणा'}`, amount, newBalance]
      );

      // If cash received, record in cash transactions
      if (paymentMode === 'Cash') {
        const lastCash = sqliteEngine.queryOne<{ balance_after: number }>('SELECT balance_after FROM cash_transactions ORDER BY id DESC LIMIT 1');
        const newCashBal = (lastCash?.balance_after || 0) + amount;
        sqliteEngine.run(
          `INSERT INTO cash_transactions (
            date_time, type, category, amount, balance_after, reference_id, description, user_name
          ) VALUES (datetime('now'), 'IN', 'Customer Payment', ?, ?, ?, ?, ?)`,
          [amount, newCashBal, paymentNo, `शेतकरी ${cust.name} रोख जमा`, userName]
        );
      }

      this.logAudit(userName, 'CUSTOMER_PAYMENT', 'Payment', paymentNo, `Received ${amount} from ${cust.name} via ${paymentMode}`);
      return paymentNo;
    });
  },

  async getCustomerLedger(customerId: number): Promise<CustomerLedgerEntry[]> {
    await sqliteEngine.getDb();
    return sqliteEngine.query<CustomerLedgerEntry>(
      'SELECT * FROM customer_ledger WHERE customer_id = ? ORDER BY id ASC',
      [customerId]
    );
  },

  async getCustomerCrops(customerId: number): Promise<CustomerCrop[]> {
    await sqliteEngine.getDb();
    return sqliteEngine.query<CustomerCrop>(
      'SELECT * FROM customer_crops WHERE customer_id = ? ORDER BY id DESC',
      [customerId]
    );
  },

  async saveCustomerCrop(crop: Partial<CustomerCrop>): Promise<void> {
    await sqliteEngine.getDb();
    sqliteEngine.run(
      `INSERT INTO customer_crops (customer_id, crop_name, area_acres, season, year) VALUES (?, ?, ?, ?, ?)`,
      [crop.customer_id, crop.crop_name, crop.area_acres, crop.season || 'Kharif', crop.year || 2026]
    );
  },

  // ================= SUPPLIERS =================
  async getSuppliers(search = ''): Promise<Supplier[]> {
    await sqliteEngine.getDb();
    let sql = 'SELECT * FROM suppliers WHERE active = 1';
    const params: any[] = [];
    if (search.trim()) {
      const q = `%${search.trim()}%`;
      sql += ' AND (name LIKE ? OR company LIKE ? OR contact_person LIKE ? OR mobile LIKE ?)';
      params.push(q, q, q, q);
    }
    sql += ' ORDER BY name ASC';
    return sqliteEngine.query<Supplier>(sql, params);
  },

  async saveSupplier(supp: Partial<Supplier>, userName = 'Admin'): Promise<number> {
    await sqliteEngine.getDb();
    if (supp.id) {
      sqliteEngine.run(
        `UPDATE suppliers SET 
          name = ?, company = ?, contact_person = ?, mobile = ?, email = ?, 
          address = ?, city = ?, state = ?, gstin = ?, licence_no = ?, credit_limit = ? 
        WHERE id = ?`,
        [
          supp.name, supp.company, supp.contact_person || '', supp.mobile, supp.email || '',
          supp.address || '', supp.city || '', supp.state || 'Maharashtra', supp.gstin || '',
          supp.licence_no || '', supp.credit_limit || 500000, supp.id
        ]
      );
      this.logAudit(userName, 'UPDATE', 'Supplier', String(supp.id), `Updated supplier ${supp.name}`);
      return supp.id;
    } else {
      const lastSupp = sqliteEngine.queryOne<{ max_id: number }>('SELECT MAX(id) as max_id FROM suppliers');
      const nextCode = `SUP-${String(101 + (lastSupp?.max_id || 0)).padStart(4, '0')}`;

      const res = sqliteEngine.run(
        `INSERT INTO suppliers (
          supplier_code, name, company, contact_person, mobile, email, address, city, 
          state, gstin, licence_no, credit_limit, opening_balance, current_balance, active, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, datetime('now'))`,
        [
          nextCode, supp.name, supp.company, supp.contact_person || '', supp.mobile, supp.email || '',
          supp.address || '', supp.city || 'पुणे', supp.state || 'Maharashtra', supp.gstin || '',
          supp.licence_no || '', supp.credit_limit || 500000, supp.opening_balance || 0, supp.opening_balance || 0
        ]
      );
      this.logAudit(userName, 'CREATE', 'Supplier', String(res.lastInsertRowid), `Created supplier ${supp.name}`);
      return res.lastInsertRowid;
    }
  },

  async createSupplier(supp: Partial<Supplier>, userName = 'Admin'): Promise<number> {
    return this.saveSupplier(supp, userName);
  },

  async updateSupplier(id: number, supp: Partial<Supplier>, userName = 'Admin'): Promise<number> {
    return this.saveSupplier({ ...supp, id }, userName);
  },

  async getSupplierById(id: number): Promise<Supplier | null> {
    await sqliteEngine.getDb();
    return sqliteEngine.queryOne<Supplier>('SELECT * FROM suppliers WHERE id = ?', [id]);
  },

  async recordSupplierPayment(
    supplierId: number,
    amount: number,
    paymentMode: 'Cash' | 'Bank Transfer' | 'UPI',
    referenceNo = '',
    notes = '',
    userName = 'Admin'
  ): Promise<string> {
    await sqliteEngine.getDb();
    return sqliteEngine.transaction(() => {
      const supp = sqliteEngine.queryOne<Supplier>('SELECT * FROM suppliers WHERE id = ?', [supplierId]);
      if (!supp) throw new Error('Supplier not found');

      const lastPay = sqliteEngine.queryOne<{ max_id: number }>('SELECT MAX(id) as max_id FROM supplier_payments');
      const paymentNo = `SPAY-2026-${String(1001 + (lastPay?.max_id || 0)).padStart(5, '0')}`;

      sqliteEngine.run(
        `INSERT INTO supplier_payments (
          payment_no, supplier_id, date, amount, payment_mode, reference_no, notes, created_at
        ) VALUES (?, ?, date('now'), ?, ?, ?, ?, datetime('now'))`,
        [paymentNo, supplierId, amount, paymentMode, referenceNo, notes]
      );

      const newBalance = Math.max(0, supp.current_balance - amount);
      sqliteEngine.run('UPDATE suppliers SET current_balance = ? WHERE id = ?', [newBalance, supplierId]);

      sqliteEngine.run(
        `INSERT INTO supplier_ledger (
          supplier_id, date, reference_type, reference_no, description, debit, credit, balance, created_at
        ) VALUES (?, date('now'), 'Payment Made', ?, ?, ?, 0, ?, datetime('now'))`,
        [supplierId, paymentNo, `${paymentMode} द्वारे अदा - ${notes || 'बिल भरणा'}`, amount, newBalance]
      );

      if (paymentMode === 'Cash') {
        const lastCash = sqliteEngine.queryOne<{ balance_after: number }>('SELECT balance_after FROM cash_transactions ORDER BY id DESC LIMIT 1');
        const newCashBal = (lastCash?.balance_after || 0) - amount;
        sqliteEngine.run(
          `INSERT INTO cash_transactions (
            date_time, type, category, amount, balance_after, reference_id, description, user_name
          ) VALUES (datetime('now'), 'OUT', 'Supplier Payment', ?, ?, ?, ?, ?)`,
          [amount, newCashBal, paymentNo, `पुरवठादार ${supp.name} रोख अदा`, userName]
        );
      }

      this.logAudit(userName, 'SUPPLIER_PAYMENT', 'Payment', paymentNo, `Paid ${amount} to ${supp.name}`);
      return paymentNo;
    });
  },

  async getSupplierLedger(supplierId: number): Promise<SupplierLedgerEntry[]> {
    await sqliteEngine.getDb();
    return sqliteEngine.query<SupplierLedgerEntry>(
      'SELECT * FROM supplier_ledger WHERE supplier_id = ? ORDER BY id ASC',
      [supplierId]
    );
  },

  // ================= EXPENSES & CASH =================
  async getExpenses(fromDate = '', toDate = ''): Promise<Expense[]> {
    await sqliteEngine.getDb();
    let sql = 'SELECT * FROM expenses WHERE 1=1';
    const params: any[] = [];
    if (fromDate) {
      sql += ' AND expense_date >= ?';
      params.push(fromDate);
    }
    if (toDate) {
      sql += ' AND expense_date <= ?';
      params.push(toDate);
    }
    sql += ' ORDER BY id DESC';
    return sqliteEngine.query<Expense>(sql, params);
  },

  async addExpense(expense: Omit<Expense, 'id' | 'created_at'>, userName = 'Admin'): Promise<number> {
    await sqliteEngine.getDb();
    return sqliteEngine.transaction(() => {
      const res = sqliteEngine.run(
        `INSERT INTO expenses (
          expense_date, category, amount, payment_mode, recipient, description, reference_no, user_name, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
        [
          expense.expense_date, expense.category, expense.amount, expense.payment_mode,
          expense.recipient || expense.paid_to || '', expense.description, expense.reference_no || '', userName
        ]
      );
      const expId = res.lastInsertRowid;

      if (expense.payment_mode === 'Cash') {
        const lastCash = sqliteEngine.queryOne<{ balance_after: number }>('SELECT balance_after FROM cash_transactions ORDER BY id DESC LIMIT 1');
        const newCashBal = (lastCash?.balance_after || 0) - expense.amount;
        sqliteEngine.run(
          `INSERT INTO cash_transactions (
            date_time, type, category, amount, balance_after, reference_id, description, user_name
          ) VALUES (datetime('now'), 'OUT', 'Expense', ?, ?, ?, ?, ?)`,
          [expense.amount, newCashBal, `EXP-${expId}`, `खर्च: ${expense.category} - ${expense.description}`, userName]
        );
      }

      this.logAudit(userName, 'CREATE_EXPENSE', 'Expense', String(expId), `Recorded ${expense.category} expense of ${expense.amount}`);
      return expId;
    });
  },

  async getCashTransactions(limit = 100): Promise<CashTransaction[]> {
    await sqliteEngine.getDb();
    return sqliteEngine.query<CashTransaction>(
      'SELECT * FROM cash_transactions ORDER BY id DESC LIMIT ?',
      [limit]
    );
  },

  async getCurrentCashInHand(): Promise<number> {
    await sqliteEngine.getDb();
    const last = sqliteEngine.queryOne<{ balance_after: number }>('SELECT balance_after FROM cash_transactions ORDER BY id DESC LIMIT 1');
    return last?.balance_after || 0;
  },

  async getCashInHand(): Promise<number> {
    return this.getCurrentCashInHand();
  },

  async createExpense(expense: Omit<Expense, 'id' | 'created_at'>, userName = 'Admin'): Promise<number> {
    return this.addExpense(expense, userName);
  },

  // ================= COMPLIANCE & LICENCES =================
  async getLicences(): Promise<Licence[]> {
    await sqliteEngine.getDb();
    const licences = sqliteEngine.query<Licence>('SELECT * FROM licences ORDER BY expiry_date ASC');
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return licences.map(l => {
      let days = 999;
      let status: 'Valid' | 'Expiring Soon' | 'Expired' = 'Valid';
      if (l.expiry_date) {
        const exp = new Date(l.expiry_date);
        if (!isNaN(exp.getTime())) {
          exp.setHours(0, 0, 0, 0);
          days = Math.ceil((exp.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
          if (days <= 0) {
            status = 'Expired';
          } else if (days <= 90) {
            status = 'Expiring Soon';
          }
        }
      }
      return { ...l, days_to_expiry: days, status };
    });
  },

  async saveLicence(lic: Partial<Licence>, userName = 'Admin'): Promise<number> {
    await sqliteEngine.getDb();
    if (lic.id) {
      sqliteEngine.run(
        `UPDATE licences SET licence_type = ?, licence_no = ?, holder_name = ?, issuing_authority = ?, issue_date = ?, expiry_date = ?, notes = ? WHERE id = ?`,
        [lic.licence_type, lic.licence_no, lic.holder_name, lic.issuing_authority, lic.issue_date, lic.expiry_date, lic.notes || '', lic.id]
      );
      this.logAudit(userName, 'UPDATE', 'Licence', String(lic.id), `Updated licence ${lic.licence_no}`);
      return lic.id;
    } else {
      const res = sqliteEngine.run(
        `INSERT INTO licences (licence_type, licence_no, holder_name, issuing_authority, issue_date, expiry_date, notes) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [lic.licence_type, lic.licence_no, lic.holder_name, lic.issuing_authority, lic.issue_date, lic.expiry_date, lic.notes || '']
      );
      this.logAudit(userName, 'CREATE', 'Licence', String(res.lastInsertRowid), `Created licence ${lic.licence_no}`);
      return res.lastInsertRowid;
    }
  },

  async updateLicence(id: number, lic: Partial<Licence>, userName = 'Admin'): Promise<number> {
    return this.saveLicence({ ...lic, id }, userName);
  },

  async getPesticideSalesRecords(search = '', fromDate = '', toDate = '', limit = 100): Promise<PesticideSalesRecord[]> {
    await sqliteEngine.getDb();
    let sql = 'SELECT * FROM pesticide_sales_records WHERE 1=1';
    const params: any[] = [];
    if (search.trim()) {
      const q = `%${search.trim()}%`;
      sql += ' AND (invoice_no LIKE ? OR farmer_name LIKE ? OR product_name LIKE ? OR batch_number LIKE ?)';
      params.push(q, q, q, q);
    }
    if (fromDate) {
      sql += ' AND date >= ?';
      params.push(fromDate);
    }
    if (toDate) {
      sql += ' AND date <= ?';
      params.push(toDate);
    }
    sql += ' ORDER BY id DESC LIMIT ?';
    params.push(limit);
    return sqliteEngine.query<PesticideSalesRecord>(sql, params);
  },

  async getPesticideRegister(search = '', fromDate = '', toDate = '', limit = 100): Promise<PesticideSalesRecord[]> {
    return this.getPesticideSalesRecords(search, fromDate, toDate, limit);
  },

  // ================= DASHBOARD METRICS =================
  async getDashboardMetrics(): Promise<DashboardMetrics> {
    await sqliteEngine.getDb();
    const today = new Date().toISOString().split('T')[0];

    // Today's sales
    const todaySalesRes = sqliteEngine.queryOne<{ total: number }>(
      "SELECT COALESCE(SUM(grand_total), 0) as total FROM sales WHERE invoice_date = ? AND status != 'Cancelled'",
      [today]
    );

    // Month's sales
    const monthPrefix = today.substring(0, 7);
    const monthSalesRes = sqliteEngine.queryOne<{ total: number }>(
      "SELECT COALESCE(SUM(grand_total), 0) as total FROM sales WHERE invoice_date LIKE ? AND status != 'Cancelled'",
      [`${monthPrefix}%`]
    );

    // Today's purchase
    const todayPurRes = sqliteEngine.queryOne<{ total: number }>(
      "SELECT COALESCE(SUM(grand_total), 0) as total FROM purchases WHERE invoice_date = ? AND status != 'Cancelled'",
      [today]
    );

    // Month's purchase
    const monthPurRes = sqliteEngine.queryOne<{ total: number }>(
      "SELECT COALESCE(SUM(grand_total), 0) as total FROM purchases WHERE invoice_date LIKE ? AND status != 'Cancelled'",
      [`${monthPrefix}%`]
    );

    // Customer outstanding
    const custOutRes = sqliteEngine.queryOne<{ total: number }>(
      'SELECT COALESCE(SUM(current_balance), 0) as total FROM customers WHERE active = 1'
    );

    // Supplier outstanding
    const suppOutRes = sqliteEngine.queryOne<{ total: number }>(
      'SELECT COALESCE(SUM(current_balance), 0) as total FROM suppliers WHERE active = 1'
    );

    // Today's collection
    const collectionRes = sqliteEngine.queryOne<{ total: number }>(
      "SELECT COALESCE(SUM(amount), 0) as total FROM customer_payments WHERE date = ?",
      [today]
    );

    // Today's expenses
    const expenseRes = sqliteEngine.queryOne<{ total: number }>(
      "SELECT COALESCE(SUM(amount), 0) as total FROM expenses WHERE expense_date = ?",
      [today]
    );

    // Products & Stock summary
    const prodCountRes = sqliteEngine.queryOne<{ count: number }>('SELECT COUNT(*) as count FROM products WHERE active = 1');
    const stockValRes = sqliteEngine.queryOne<{ total: number }>(
      'SELECT COALESCE(SUM(current_qty * selling_rate), 0) as total FROM product_batches WHERE current_qty > 0'
    );

    // Low stock items count (products where total batch stock <= reorder_level)
    const lowStockRes = sqliteEngine.queryOne<{ count: number }>(`
      SELECT COUNT(*) as count FROM (
        SELECT p.id, p.reorder_level, COALESCE(SUM(b.current_qty), 0) as total_stock
        FROM products p
        LEFT JOIN product_batches b ON p.id = b.product_id
        WHERE p.active = 1
        GROUP BY p.id
        HAVING total_stock <= p.reorder_level
      )
    `);

    // Batches expiring soon (< 90 days) & Expired
    const allBatches = await this.getAllBatches();
    const expiringSoon = allBatches.filter(b => b.status === 'Near Expiry').length;
    const expired = allBatches.filter(b => b.status === 'Expired').length;

    // Recent 5 sales
    const recentSales = sqliteEngine.query<Sale>(
      "SELECT * FROM sales WHERE status != 'Cancelled' ORDER BY id DESC LIMIT 5"
    );

    // Estimated profit (Sales revenue - COGS)
    const profitRes = sqliteEngine.queryOne<{ profit: number }>(`
      SELECT COALESCE(SUM(si.taxable_value - (si.quantity * b.purchase_rate)), 0) as profit
      FROM sale_items si
      JOIN sales s ON si.sale_id = s.id
      LEFT JOIN product_batches b ON si.batch_id = b.id
      WHERE s.status != 'Cancelled' AND s.invoice_date LIKE ?
    `, [`${monthPrefix}%`]);

    // Category-wise sales
    const categorySales = sqliteEngine.query<{ category: string; amount: number }>(`
      SELECT p.category, COALESCE(SUM(si.total_amount), 0) as amount
      FROM sale_items si
      JOIN products p ON si.product_id = p.id
      JOIN sales s ON si.sale_id = s.id
      WHERE s.status != 'Cancelled'
      GROUP BY p.category
      ORDER BY amount DESC
    `);

    // 7-day Sales Trend
    const salesTrend = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const daySales = sqliteEngine.queryOne<{ total: number }>(
        "SELECT COALESCE(SUM(grand_total), 0) as total FROM sales WHERE invoice_date = ? AND status != 'Cancelled'",
        [dateStr]
      );
      salesTrend.push({
        date: dateStr.substring(5), // MM-DD
        sales: daySales?.total || 0,
        profit: (daySales?.total || 0) * 0.12 // Estimated average margin
      });
    }

    return {
      today_sales: todaySalesRes?.total || 0,
      week_sales: (monthSalesRes?.total || 0) * 0.35,
      month_sales: monthSalesRes?.total || 0,
      today_purchases: todayPurRes?.total || 0,
      month_purchases: monthPurRes?.total || 0,
      customer_outstanding: custOutRes?.total || 0,
      supplier_outstanding: suppOutRes?.total || 0,
      today_collection: collectionRes?.total || 0,
      today_expenses: expenseRes?.total || 0,
      estimated_gross_profit: Math.max(0, profitRes?.profit || 0),
      total_products: prodCountRes?.count || 0,
      total_stock_value: stockValRes?.total || 0,
      low_stock_count: lowStockRes?.count || 0,
      expiring_soon_count: expiringSoon,
      expired_count: expired,
      recent_sales: recentSales,
      sales_trend: salesTrend,
      category_sales: categorySales
    };
  },

  // ================= SETTINGS & AUDIT =================
  async getBusinessSettings(): Promise<BusinessSettings> {
    await sqliteEngine.getDb();
    const settings = sqliteEngine.queryOne<BusinessSettings>('SELECT * FROM business_settings WHERE id = 1');
    if (!settings) {
      return {
        shop_name: 'Shree Samarth Krushi Seva Kendra',
        shop_name_mr: 'श्री समर्थ कृषी सेवा केंद्र',
        proprietor: 'संजय आनंदराव पाटील',
        owner_name: 'संजय आनंदराव पाटील',
        partner_name: 'प्रवीण कदम',
        address: 'स्टेशन रोड, मुख्य बाजारपेठ',
        village_city: 'बारामती',
        taluka: 'बारामती',
        district: 'पुणे',
        state: 'महाराष्ट्र',
        pincode: '४१३१०२',
        jurisdiction_city: 'बारामती',
        mobile: '९८२२३३४४५५',
        mobile_secondary: '९८९०११२२३३',
        email: 'samarthagro.baramati@gmail.com',
        gstin: '27AABCS1429B1Z8',
        cot_licence: 'COT/PUN/2022/104',
        fertilizer_licence: 'FL/PUN/2022/8492',
        fert_licence_r: 'LCFRD0220240690AMV',
        seed_licence: 'SL/PUN/2021/4102',
        pesticide_licence: 'IL/PUN/2023/1932',
        bank_name: 'Bank of Maharashtra',
        bank_account_no: '60123456789',
        bank_ifsc: 'MAHB0000123',
        upi_id: '9822334455@upi'
      };
    }
    return {
      ...settings,
      owner_name: settings.owner_name || settings.proprietor,
      taluka: settings.taluka || settings.village_city || '',
      jurisdiction_city: settings.jurisdiction_city || settings.taluka || settings.district || 'Local',
      cot_licence: settings.cot_licence || 'COT/PUN/2022/104',
      fert_licence_r: settings.fert_licence_r || settings.fertilizer_licence || '',
    };
  },

  async saveBusinessSettings(settings: Partial<BusinessSettings>, userName = 'Admin'): Promise<void> {
    await sqliteEngine.getDb();
    sqliteEngine.run(
      `UPDATE business_settings SET 
        shop_name = ?, shop_name_mr = ?, proprietor = ?, partner_name = ?, address = ?, village_city = ?, 
        taluka = ?, district = ?, state = ?, pincode = ?, jurisdiction_city = ?, mobile = ?, 
        mobile_secondary = ?, email = ?, gstin = ?, cot_licence = ?, fertilizer_licence = ?, 
        fert_licence_r = ?, seed_licence = ?, pesticide_licence = ?, bank_name = ?, 
        bank_account_no = ?, bank_ifsc = ?, upi_id = ? 
      WHERE id = 1`,
      [
        settings.shop_name,
        settings.shop_name_mr,
        settings.proprietor || settings.owner_name,
        settings.partner_name || '',
        settings.address,
        settings.village_city,
        settings.taluka || '',
        settings.district,
        settings.state,
        settings.pincode,
        settings.jurisdiction_city || settings.taluka || '',
        settings.mobile,
        settings.mobile_secondary || '',
        settings.email,
        settings.gstin,
        settings.cot_licence || '',
        settings.fertilizer_licence,
        settings.fert_licence_r || '',
        settings.seed_licence,
        settings.pesticide_licence,
        settings.bank_name,
        settings.bank_account_no,
        settings.bank_ifsc,
        settings.upi_id
      ]
    );
    this.logAudit(userName, 'UPDATE_SETTINGS', 'BusinessSettings', '1', 'Updated shop business profile and licences');
  },

  async getInvoiceSettings(): Promise<InvoiceSettings> {
    await sqliteEngine.getDb();
    const inv = sqliteEngine.queryOne<InvoiceSettings>('SELECT * FROM invoice_settings WHERE id = 1');
    return inv || {
      invoice_prefix: 'INV-2026-',
      starting_number: 1001,
      print_format: 'A4',
      show_hsn: true,
      show_mrp: true,
      show_discount: true,
      terms_conditions: '1. Goods once sold will not be taken back without bill.',
      terms_conditions_mr: '१. विकलेला माल पावतीशिवाय परत घेतला जाणार नाही.',
      footer_message: 'आमच्याकडे दर्जेदार खते, बियाणे व औषधे खात्रीशीर मिळतील.'
    };
  },

  async saveInvoiceSettings(settings: Partial<InvoiceSettings>, userName = 'Admin'): Promise<void> {
    await sqliteEngine.getDb();
    sqliteEngine.run(
      `UPDATE invoice_settings SET 
        invoice_prefix = ?, starting_number = ?, print_format = ?, show_hsn = ?, 
        show_mrp = ?, show_discount = ?, terms_conditions = ?, terms_conditions_mr = ?, 
        footer_message = ? 
      WHERE id = 1`,
      [
        settings.invoice_prefix, settings.starting_number, settings.print_format,
        settings.show_hsn ? 1 : 0, settings.show_mrp ? 1 : 0, settings.show_discount ? 1 : 0,
        settings.terms_conditions, settings.terms_conditions_mr, settings.footer_message
      ]
    );
    this.logAudit(userName, 'UPDATE_SETTINGS', 'InvoiceSettings', '1', 'Updated invoice print preferences');
  },

  async updateBusinessSettings(settings: Partial<BusinessSettings>, userName = 'Admin'): Promise<void> {
    return this.saveBusinessSettings(settings, userName);
  },

  async updateInvoiceSettings(settings: Partial<InvoiceSettings>, userName = 'Admin'): Promise<void> {
    return this.saveInvoiceSettings(settings, userName);
  },

  async getInventorySettings(): Promise<InventorySettings> {
    await sqliteEngine.getDb();
    const inv = sqliteEngine.queryOne<any>('SELECT * FROM inventory_settings WHERE id = 1');
    return {
      allow_negative_stock: inv?.allow_negative_stock === 1,
      batch_required_default: inv?.batch_required_default === 1,
      expiry_warning_days: inv?.expiry_warning_days || 90,
      fefo_enabled: inv?.fefo_enabled === 1,
    };
  },

  async saveInventorySettings(settings: InventorySettings, userName = 'Admin'): Promise<void> {
    await sqliteEngine.getDb();
    sqliteEngine.run(
      `UPDATE inventory_settings SET 
        allow_negative_stock = ?, batch_required_default = ?, expiry_warning_days = ?, fefo_enabled = ? 
      WHERE id = 1`,
      [
        settings.allow_negative_stock ? 1 : 0,
        settings.batch_required_default ? 1 : 0,
        settings.expiry_warning_days,
        settings.fefo_enabled ? 1 : 0
      ]
    );
    this.logAudit(userName, 'UPDATE_SETTINGS', 'InventorySettings', '1', 'Updated inventory FEFO & negative stock controls');
  },

  async getUsers(): Promise<User[]> {
    await sqliteEngine.getDb();
    return sqliteEngine.query<User>('SELECT id, username, name, role, phone, active, created_at FROM users WHERE active = 1');
  },

  async authenticateUser(username: string, password: string): Promise<User | null> {
    await sqliteEngine.getDb();
    const user = sqliteEngine.queryOne<User>(
      'SELECT id, username, name, role, phone, active, created_at FROM users WHERE username = ? AND password_hash = ? AND active = 1',
      [username, password]
    );
    if (user) {
      this.logAudit(user.name, 'LOGIN', 'User', String(user.id), `User ${user.username} logged in successfully`);
    }
    return user;
  },

  async getAuditLogs(limit = 100): Promise<AuditLog[]> {
    await sqliteEngine.getDb();
    return sqliteEngine.query<AuditLog>('SELECT * FROM audit_logs ORDER BY id DESC LIMIT ?', [limit]);
  },

  logAudit(userName: string, action: string, entity: string, entityId: string, description: string) {
    try {
      sqliteEngine.run(
        `INSERT INTO audit_logs (date_time, user_name, action, entity, entity_id, description) VALUES (datetime('now'), ?, ?, ?, ?, ?)`,
        [userName, action, entity, entityId, description]
      );
    } catch (e) {
      console.error('Failed to write audit log:', e);
    }
  },

  // ================= STATUTORY REPORTS (DOCUMENT 2 & 3 COMPLIANCE) =================
  async getMonthlyFertilizerRegister(monthStr?: string): Promise<StatutoryFertilizerRegisterRow[]> {
    await sqliteEngine.getDb();
    const currentMonth = monthStr || new Date().toISOString().slice(0, 7);

    // Retrieve fertilizer products from database
    const products = sqliteEngine.query<Product>(`
      SELECT * FROM products 
      WHERE active = 1 AND (
        category = 'Fertilizer' OR 
        category = 'Bio-fertilizer' OR 
        category = 'Micronutrient' OR
        fertilizer_grade IS NOT NULL
      )
      ORDER BY id ASC
    `);

    const rows: StatutoryFertilizerRegisterRow[] = [];
    let sr = 1;

    for (const prod of products) {
      // Metric Tonnes calculation: 1 MT = 1000 Kg = 20 bags of 50kg
      let kgMultiplier = 50;
      const packLower = (prod.pack_size || '').toLowerCase();
      const unitLower = (prod.unit || '').toLowerCase();

      if (unitLower.includes('bag') || unitLower.includes('पोते') || unitLower.includes('बॅग')) {
        const match = packLower.match(/(\d+(\.\d+)?)/);
        kgMultiplier = match ? parseFloat(match[1]) : 50;
      } else if (unitLower.includes('kg') || unitLower.includes('किलो')) {
        kgMultiplier = 1;
      } else if (unitLower.includes('ton') || unitLower.includes('mt')) {
        kgMultiplier = 1000;
      } else if (unitLower.includes('gm') || unitLower.includes('ग्रॅम')) {
        kgMultiplier = 0.001;
      } else if (unitLower.includes('ltr') || unitLower.includes('लिटर')) {
        kgMultiplier = 1.2; // Density approx for liquid fertilizer
      }

      const mtMultiplier = kgMultiplier / 1000;

      // Inward (Purchases in this month)
      const inwardRes = sqliteEngine.queryOne<{ total_qty: number }>(`
        SELECT COALESCE(SUM(pi.quantity), 0) as total_qty
        FROM purchase_items pi
        JOIN purchases p ON pi.purchase_id = p.id
        WHERE pi.product_id = ? AND p.status != 'Cancelled' AND (p.invoice_date LIKE ? OR p.purchase_date LIKE ?)
      `, [prod.id, `${currentMonth}%`, `${currentMonth}%`]);
      const inwardQty = inwardRes?.total_qty || 0;
      const inwardMt = Number((inwardQty * mtMultiplier).toFixed(3));

      // Sales (Sales in this month)
      const salesRes = sqliteEngine.queryOne<{ total_qty: number }>(`
        SELECT COALESCE(SUM(si.quantity), 0) as total_qty
        FROM sale_items si
        JOIN sales s ON si.sale_id = s.id
        WHERE si.product_id = ? AND s.status != 'Cancelled' AND s.invoice_date LIKE ?
      `, [prod.id, `${currentMonth}%`]);
      const salesQty = salesRes?.total_qty || 0;
      const salesMt = Number((salesQty * mtMultiplier).toFixed(3));

      // Stock from batches
      const stockRes = sqliteEngine.queryOne<{ total_stock: number }>(`
        SELECT COALESCE(SUM(current_qty), 0) as total_stock
        FROM product_batches
        WHERE product_id = ?
      `, [prod.id]);
      const currentStock = stockRes?.total_stock || 0;
      const closingMt = Number((currentStock * mtMultiplier).toFixed(3));
      const openingMt = Math.max(0, Number((closingMt - inwardMt + salesMt).toFixed(3)));

      rows.push({
        sr_no: sr++,
        product_id: prod.id,
        product_name: prod.name,
        fertilizer_grade: prod.fertilizer_grade || prod.technical_name || prod.subcategory || prod.name,
        company: prod.company || prod.brand || 'IFFCO',
        opening_stock_mt: openingMt,
        inward_mt: inwardMt,
        sales_mt: salesMt,
        closing_stock_mt: closingMt,
        unit: 'MT'
      });
    }

    return rows;
  },

  async getMonthlySeedRegister(monthStr?: string): Promise<StatutorySeedRegisterRow[]> {
    await sqliteEngine.getDb();
    const currentMonth = monthStr || new Date().toISOString().slice(0, 7);

    // Retrieve seed products from database
    const products = sqliteEngine.query<Product>(`
      SELECT * FROM products 
      WHERE active = 1 AND (category = 'Seed' OR seed_variety IS NOT NULL)
      ORDER BY id ASC
    `);

    const rows: StatutorySeedRegisterRow[] = [];
    let sr = 1;

    for (const prod of products) {
      const isCotton = prod.name.toLowerCase().includes('cotton') || 
                       prod.name.toLowerCase().includes('कापूस') || 
                       (prod.unit || '').toLowerCase().includes('pkt') ||
                       (prod.unit || '').toLowerCase().includes('पाकीट');

      let multiplier = 1;
      let unitLabel = 'Pkt';

      if (isCotton) {
        unitLabel = 'Packet';
        multiplier = 1;
      } else {
        unitLabel = 'Quintal';
        const packLower = (prod.pack_size || '').toLowerCase();
        const match = packLower.match(/(\d+(\.\d+)?)/);
        const bagKg = match ? parseFloat(match[1]) : 30;
        multiplier = bagKg / 100; // 100 Kg = 1 Quintal
      }

      // Inward (Purchases in this month)
      const inwardRes = sqliteEngine.queryOne<{ total_qty: number }>(`
        SELECT COALESCE(SUM(pi.quantity), 0) as total_qty
        FROM purchase_items pi
        JOIN purchases p ON pi.purchase_id = p.id
        WHERE pi.product_id = ? AND p.status != 'Cancelled' AND (p.invoice_date LIKE ? OR p.purchase_date LIKE ?)
      `, [prod.id, `${currentMonth}%`, `${currentMonth}%`]);
      const inwardQty = inwardRes?.total_qty || 0;
      const inward = Number((inwardQty * multiplier).toFixed(2));

      // Sales (Sales in this month)
      const salesRes = sqliteEngine.queryOne<{ total_qty: number }>(`
        SELECT COALESCE(SUM(si.quantity), 0) as total_qty
        FROM sale_items si
        JOIN sales s ON si.sale_id = s.id
        WHERE si.product_id = ? AND s.status != 'Cancelled' AND s.invoice_date LIKE ?
      `, [prod.id, `${currentMonth}%`]);
      const salesQty = salesRes?.total_qty || 0;
      const sales = Number((salesQty * multiplier).toFixed(2));

      // Stock from batches
      const stockRes = sqliteEngine.queryOne<{ total_stock: number }>(`
        SELECT COALESCE(SUM(current_qty), 0) as total_stock
        FROM product_batches
        WHERE product_id = ?
      `, [prod.id]);
      const currentStock = stockRes?.total_stock || 0;
      const closing = Number((currentStock * multiplier).toFixed(2));
      const opening = Math.max(0, Number((closing - inward + sales).toFixed(2)));

      rows.push({
        sr_no: sr++,
        product_id: prod.id,
        crop_name: prod.seed_variety || prod.name,
        seed_variety: prod.seed_variety || prod.name,
        company: prod.company || prod.brand || 'Certified Seeds Ltd',
        opening_stock: opening,
        inward: inward,
        sales: sales,
        closing_stock: closing,
        unit: unitLabel
      });
    }

    return rows;
  }
};
