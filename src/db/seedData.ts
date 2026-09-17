export const SEED_DATA_SQL = `
-- Default Users
INSERT OR IGNORE INTO users (id, username, password_hash, name, role, phone, active, created_at) VALUES 
(1, 'admin', 'admin123', 'संजय पाटील (Admin)', 'admin', '9822334455', 1, datetime('now')),
(2, 'cashier', 'cashier123', 'प्रवीण कदम (Cashier)', 'cashier', '9890112233', 1, datetime('now')),
(3, 'manager', 'manager123', 'अमित देशमुख (Manager)', 'manager', '9763445566', 1, datetime('now'));

-- Business Profile Settings
INSERT OR REPLACE INTO business_settings (id, shop_name, shop_name_mr, proprietor, address, village_city, district, state, pincode, mobile, email, gstin, fertilizer_licence, seed_licence, pesticide_licence, bank_name, bank_account_no, bank_ifsc, upi_id) VALUES 
(1, 'Shree Samarth Krushi Seva Kendra', 'श्री समर्थ कृषी सेवा केंद्र', 'संजय आनंदराव पाटील', 'स्टेशन रोड, मुख्य बाजारपेठ, बारामती', 'बारामती', 'पुणे', 'महाराष्ट्र', '४१३१०२', '९८२२३३४४५५', 'samarthagro.baramati@gmail.com', '27AABCS1429B1Z8', 'FL/PUN/2022/8492', 'SL/PUN/2021/4102', 'IL/PUN/2023/1932', 'Bank of Maharashtra', '60123456789', 'MAHB0000123', '9822334455@upi');

-- Invoice Configuration
INSERT OR REPLACE INTO invoice_settings (id, invoice_prefix, starting_number, print_format, show_hsn, show_mrp, show_discount, terms_conditions, terms_conditions_mr, footer_message) VALUES 
(1, 'INV-2026-', 1001, 'A4', 1, 1, 1, 
'1. Goods once sold will not be taken back without original bill. 2. Subject to Baramati Jurisdiction.', 
'१. विकलेला माल पावतीशिवाय परत घेतला जाणार नाही. २. सर्व वाद बारामती न्यायालयाच्या कक्षेत.', 
'आमच्याकडे दर्जेदार खते, बियाणे व औषधे खात्रीशीर मिळतील. भेट दिल्याबद्दल धन्यवाद!');

-- Inventory Configuration
INSERT OR REPLACE INTO inventory_settings (id, allow_negative_stock, batch_required_default, expiry_warning_days, fefo_enabled) VALUES 
(1, 0, 1, 90, 1);

-- Categories
INSERT OR IGNORE INTO categories (id, name, name_mr, name_hi, description, active) VALUES 
(1, 'Fertilizer', 'रासायनिक खते', 'उर्वरक', 'Chemical & Mineral Fertilizers', 1),
(2, 'Seed', 'बियाणे', 'बीज', 'Certified Crop & Vegetable Seeds', 1),
(3, 'Insecticide', 'कीटकनाशके', 'कीटनाशक', 'Insect & Pest Control Chemicals', 1),
(4, 'Fungicide', 'बुरशीनाशके', 'फफूंदनाशक', 'Fungus & Spore Management', 1),
(5, 'Herbicide', 'तणनाशके', 'खरपतवारनाशक', 'Weed Control Products', 1),
(6, 'Micronutrient', 'सूक्ष्म अन्नद्रव्ये', 'सूक्ष्म पोषक', 'Zinc, Boron, Ferrous, Multimicronutrients', 1),
(7, 'Bio-fertilizer', 'जैविक खते', 'जैव उर्वरक', 'Organic & Bacterial Inputs', 1),
(8, 'Plant Growth Regulator', 'टॉनिक / वाढ नियंत्रक', 'वृद्धि नियंत्रक', 'PGR & Flowering stimulants', 1);

-- Locations
INSERT OR IGNORE INTO locations (id, name, code, is_primary) VALUES 
(1, 'Main Shop (दुकान)', 'SHOP-01', 1),
(2, 'Godown 1 - MIDC (गोदाम १)', 'GDN-01', 0),
(3, 'Godown 2 - Market Yard (गोदाम २)', 'GDN-02', 0);

-- Units
INSERT OR IGNORE INTO units (id, name, symbol, is_decimal) VALUES 
(1, 'Bag / पोते', 'Bag', 0),
(2, 'Kilogram / किलो', 'Kg', 1),
(3, 'Gram / ग्रॅम', 'gm', 1),
(4, 'Litre / लिटर', 'Ltr', 1),
(5, 'Millilitre / मिली', 'ml', 1),
(6, 'Packet / पाकीट', 'Pkt', 0),
(7, 'Bottle / बाटली', 'Btl', 0);

-- Crops
INSERT OR IGNORE INTO crops (id, name, name_mr, name_hi, season) VALUES 
(1, 'Sugarcane', 'ऊस', 'गन्ना', 'Annual'),
(2, 'Soybean', 'सोयाबीन', 'सोयाबीन', 'Kharif'),
(3, 'Cotton', 'कापूस', 'कपास', 'Kharif'),
(4, 'Onion', 'कांदा', 'प्याज', 'Rabi'),
(5, 'Wheat', 'गहू', 'गेहूँ', 'Rabi'),
(6, 'Pomegranate', 'डाळिंब', 'अनार', 'Annual'),
(7, 'Maize', 'मका', 'मक्का', 'Kharif');

-- Expense Categories
INSERT OR IGNORE INTO expense_categories (id, name, name_mr) VALUES 
(1, 'Hamali / Labor', 'हमाली व मजुरी'),
(2, 'Transport / Freight', 'वाहतूक खर्च'),
(3, 'Shop Rent', 'दुकान भाडे'),
(4, 'Electricity Bill', 'लाईट बिल'),
(5, 'Staff Salary', 'पगार / मानधन'),
(6, 'Tea & Refreshment', 'चहा-पाणी व नाष्टा'),
(7, 'Office & Stationery', 'स्टेशनरी व प्रिंटिंग'),
(8, 'Miscellaneous', 'इतर किरकोळ खर्च');

-- Suppliers
INSERT OR IGNORE INTO suppliers (id, supplier_code, name, company, contact_person, mobile, email, address, city, state, gstin, licence_no, credit_limit, opening_balance, current_balance, active, created_at) VALUES 
(1, 'SUP-001', 'Deepak Fertilisers Ltd', 'Deepak Fertilisers & Petrochemicals Corp', 'गणेश शिंदे', '9822100200', 'deepak.agro@smartchem.com', 'Sai Chambers, Pune-Mumbai Road', 'पुणे', 'महाराष्ट्र', '27AAACD1111A1Z1', 'FL/PUN/8821', 1000000, 0, 85000, 1, datetime('now')),
(2, 'SUP-002', 'Mahadhan Agro Distributors', 'Mahadhan Smart Chem', 'सुनील मोहिते', '9850112244', 'mahadhan.dist@gmail.com', 'MIDC Phase II', 'बारामती', 'महाराष्ट्र', '27BBDCE2222B2Z2', 'FL/BAR/4412', 800000, 0, 42500, 1, datetime('now')),
(3, 'SUP-003', 'Bayer CropScience Ltd', 'Bayer India Ltd', 'विकास जोशी', '9881003355', 'bayer.pune@bayer.com', 'Hiranandani Estate', 'ठाणे', 'महाराष्ट्र', '27AABCB3333C1Z3', 'IL/MAH/9912', 500000, 0, 18000, 1, datetime('now')),
(4, 'SUP-004', 'Mahyco Seeds Ltd', 'Maharashtra Hybrid Seeds Co', 'सतीश पवार', '9422556677', 'sales@mahyco.com', 'Jalna Road', 'जालना', 'महाराष्ट्र', '27AAACM4444D1Z4', 'SL/MAH/1290', 600000, 0, 0, 1, datetime('now'));

-- Products
INSERT OR IGNORE INTO products (id, product_code, barcode, name, name_mr, name_hi, category, subcategory, brand, company, unit, pack_size, mrp, purchase_rate, selling_rate, dealer_rate, gst_rate, hsn_code, batch_required, expiry_required, min_stock, max_stock, reorder_level, fertilizer_grade, npk_ratio, seed_variety, toxicity_class, cib_registration_no, description, active, created_at) VALUES 
(1, 'PRD-001', '8901001001', 'Neem Coated Urea 45kg', 'निम कोटेड युरिया ४५ किलो', 'नीम लेपित यूरिया ४५ किग्रा', 'Fertilizer', 'Nitrogenous', 'IFFCO', 'IFFCO India', 'Bag', '45 Kg', 266.50, 245.00, 266.50, 255.00, 5, '31021000', 1, 0, 50, 500, 80, 'Urea 46% N', '46:0:0', '', '', '', 'Government subsidized Neem Coated Urea', 1, datetime('now')),
(2, 'PRD-002', '8901001002', 'Mahadhan DAP 18:46:0 50kg', 'महाधन डीएपी १८:४६:० ५० किलो', 'महाधन डीएपी १८:४६:० ५० किग्रा', 'Fertilizer', 'Phosphatic', 'Mahadhan', 'Smartchem Technologies', 'Bag', '50 Kg', 1350.00, 1280.00, 1350.00, 1310.00, 5, '31053000', 1, 0, 30, 400, 50, '18:46:0', '18:46:0', '', '', '', 'Di-Ammonium Phosphate High Grade Fertilizer', 1, datetime('now')),
(3, 'PRD-003', '8901001003', 'Mahadhan 10:26:26 NPK 50kg', 'महाधन १०:२६:२६ एनपीके ५० किलो', 'महाधन १०:२६:२६ ५० किग्रा', 'Fertilizer', 'Complex', 'Mahadhan', 'Smartchem Technologies', 'Bag', '50 Kg', 1470.00, 1390.00, 1470.00, 1420.00, 5, '31052000', 1, 0, 25, 300, 40, '10:26:26', '10:26:26', '', '', '', 'Balanced complex fertilizer for sugarcane and vegetables', 1, datetime('now')),
(4, 'PRD-004', '8901001004', 'FMC Coragen 18.5% SC 60ml', 'एफएमसी कोराजन ६० मिली', 'एफएमसी कोराजन ६० मिली', 'Insecticide', 'Anthranilic Diamide', 'FMC', 'FMC India Pvt Ltd', 'Bottle', '60 ml', 980.00, 840.00, 930.00, 880.00, 18, '38089190', 1, 1, 15, 100, 20, '', '', '', 'Green (Cautionary)', 'CIR-65432/2012', 'Systemic insecticide for stem borer, fruit borer in sugarcane and soyabean', 1, datetime('now')),
(5, 'PRD-005', '8901001005', 'Bayer Confidor 17.8% SL 100ml', 'बायर कॉन्फिडोर १०० मिली', 'बायर कॉन्फिडोर १०० मिली', 'Insecticide', 'Neonicotinoid', 'Bayer', 'Bayer CropScience', 'Bottle', '100 ml', 340.00, 280.00, 320.00, 300.00, 18, '38089190', 1, 1, 20, 150, 25, '', '', '', 'Blue (Danger)', 'CIR-43210/2010', 'Systemic insecticide for sucking pests, thrips, aphids, whiteflies', 1, datetime('now')),
(6, 'PRD-006', '8901001006', 'Roundup Glyphosate 41% SL 1L', 'राउंडअप तणनाशक १ लिटर', 'राउंडअप खरपतवारनाशक १ लीटर', 'Herbicide', 'Non-selective', 'Bayer', 'Bayer CropScience', 'Bottle', '1 Litre', 580.00, 480.00, 540.00, 510.00, 18, '38089340', 1, 1, 15, 120, 20, '', '', '', 'Yellow (Warning)', 'CIR-19283/2008', 'Post-emergence non-selective systemic herbicide', 1, datetime('now')),
(7, 'PRD-007', '8901001007', 'UPL Saaf Fungicide 500g', 'यूपीएल साफ बुरशीनाशक ५०० ग्रॅम', 'यूपीएल साफ ५०० ग्राम', 'Fungicide', 'Broad Spectrum', 'UPL', 'UPL Ltd', 'Packet', '500 gm', 380.00, 310.00, 350.00, 330.00, 18, '38089290', 1, 1, 20, 150, 25, '', '', '', 'Blue (Danger)', 'CIR-88771/2014', 'Carbendazim 12% + Mancozeb 63% WP systemic and contact fungicide', 1, datetime('now')),
(8, 'PRD-008', '8901001008', 'Mahyco Soybean JS-335 30kg', 'माहिको सोयाबीन बियाणे जेएस-३३५', 'माहिको सोयाबीन बीज जेएस-३३५', 'Seed', 'Oilseed', 'Mahyco', 'Mahyco Seeds', 'Bag', '30 Kg', 2400.00, 2150.00, 2350.00, 2250.00, 0, '12099990', 1, 1, 10, 80, 15, '', '', 'JS-335 (Certified)', '', '', 'High yielding certified soybean seeds with 75%+ germination', 1, datetime('now')),
(9, 'PRD-009', '8901001009', 'Rasi RCH-659 BG II Cotton Seed', 'रासी आरसीएच-६५९ बीजी २ कापूस', 'रासी आरसीएच-६५९ बीजी २ कपास', 'Seed', 'Fibre', 'Rasi', 'Rasi Seeds', 'Packet', '450 gm', 864.00, 780.00, 864.00, 820.00, 0, '12099990', 1, 1, 25, 200, 30, '', '', 'RCH-659 Bollgard II', '', '', 'High resistance to bollworms with big boll size', 1, datetime('now')),
(10, 'PRD-010', '8901001010', 'Chelated Zinc 12% EDTA 500g', 'चिलेटेड झिंक १२% ५०० ग्रॅम', 'चिलेटेड जिंक १२% ५०० ग्राम', 'Micronutrient', 'Chelated', 'Anand Agro', 'Anand Agro Care', 'Packet', '500 gm', 420.00, 320.00, 390.00, 350.00, 12, '28332990', 1, 1, 15, 100, 20, 'Zinc 12%', '', '', '', '', '100% water soluble chelated zinc for chlorosis prevention', 1, datetime('now'));

-- Product Batches (Configured with realistic dates and FEFO sequence)
INSERT OR IGNORE INTO product_batches (id, product_id, batch_number, mfg_date, expiry_date, purchase_rate, mrp, selling_rate, opening_qty, current_qty, location_id, supplier_id, status) VALUES 
(1, 1, 'IFF-2601', '2026-01-10', '2028-01-09', 245.00, 266.50, 266.50, 150, 132, 1, 1, 'Active'),
(2, 2, 'MD-DAP-88', '2026-02-01', '2028-02-01', 1280.00, 1350.00, 1350.00, 80, 68, 1, 2, 'Active'),
(3, 3, 'MD-1026-45', '2026-01-15', '2028-01-15', 1390.00, 1470.00, 1470.00, 60, 45, 1, 2, 'Active'),
-- Near expiry batch (under 60 days) to showcase FEFO warning and automatic selection!
(4, 4, 'FMC-CRG-25A', '2025-05-10', '2026-10-15', 840.00, 980.00, 930.00, 40, 12, 1, 3, 'Near Expiry'),
(5, 4, 'FMC-CRG-26B', '2026-03-01', '2027-08-30', 850.00, 980.00, 930.00, 50, 48, 1, 3, 'Active'),
(6, 5, 'BYR-CF-901', '2025-08-20', '2027-08-19', 280.00, 340.00, 320.00, 50, 38, 1, 3, 'Active'),
(7, 6, 'BYR-RD-112', '2025-11-10', '2027-11-09', 480.00, 580.00, 540.00, 40, 34, 1, 3, 'Active'),
(8, 7, 'UPL-SF-44', '2025-09-05', '2027-09-04', 310.00, 380.00, 350.00, 60, 52, 1, 3, 'Active'),
(9, 8, 'MHY-SB-335', '2026-04-10', '2027-01-10', 2150.00, 2400.00, 2350.00, 50, 40, 1, 4, 'Active'),
(10, 9, 'RSI-COT-659', '2026-03-15', '2026-12-15', 780.00, 864.00, 864.00, 80, 65, 1, 4, 'Active'),
(11, 10, 'ANA-ZN-101', '2026-01-20', '2028-01-19', 320.00, 420.00, 390.00, 30, 24, 1, 2, 'Active');

-- Farmers / Customers
INSERT OR IGNORE INTO customers (id, customer_code, name, name_mr, mobile, alt_mobile, village, taluka, district, address, pincode, credit_limit, opening_balance, current_balance, notes, active, created_at) VALUES 
(1, 'CUST-001', 'Ramesh Babanrao Jagtap', 'रमेश बबनराव जगताप', '9822114455', '9822114456', 'माळेगाव बु.', 'बारामती', 'पुणे', 'मु. पो. माळेगाव बुद्रुक, विठ्ठल मंदिर जवळ', '४१३११५', 75000, 0, 18450, 'ऊस व भाजीपाला बागायतदार, नियमित ग्राहक', 1, datetime('now')),
(2, 'CUST-002', 'Vikas Sambhaji Shinde', 'विकास संभाजी शिंदे', '9890223344', '', 'शिरसुफळ', 'बारामती', 'पुणे', 'मु. पो. शिरसुफळ, ता. बारामती', '४१३१०२', 50000, 0, 7200, 'सोयाबीन व कांदा उत्पादक', 1, datetime('now')),
(3, 'CUST-003', 'Dnyaneshwar Vitthal Kadam', 'ज्ञानेश्वर विठ्ठल कदम', '9763112233', '', 'सुपा', 'बारामती', 'पुणे', 'सुपा फाटा, ता. बारामती', '४१२२०१', 100000, 0, 0, 'प्रगतिशील शेतकरी, डाळिंब व ऊस', 1, datetime('now')),
(4, 'CUST-004', 'Bapusaheb Namdeo Pawar', 'बापूसाहेब नामदेव पवार', '9422001122', '', 'सोनगाव', 'बारामती', 'पुणे', 'मु. पो. सोनगाव, नीरा रोड', '४१३१०२', 60000, 0, 24500, 'कापूस व सोयाबीन लागवड, उधारी बाकी', 1, datetime('now')),
(5, 'CUST-005', 'Santosh Anantrao More', 'संतोष अनंतराव मोरे', '9822998877', '', 'निरा', 'पुरंदर', 'पुणे', 'मु. पो. निरा, ता. पुरंदर', '४१२१०२', 40000, 0, 4800, 'पेरू व भाजीपाला उत्पादक', 1, datetime('now'));

-- Customer Crops
INSERT OR IGNORE INTO customer_crops (id, customer_id, crop_name, area_acres, season, year) VALUES 
(1, 1, 'ऊस (Sugarcane)', 4.5, 'Annual', 2026),
(2, 1, 'कांदा (Onion)', 2.0, 'Rabi', 2026),
(3, 2, 'सोयाबीन (Soybean)', 5.0, 'Kharif', 2026),
(4, 3, 'डाळिंब (Pomegranate)', 3.5, 'Annual', 2026),
(5, 4, 'कापूस (Cotton)', 6.0, 'Kharif', 2026);

-- Customer Ledger Entries (Khata tracking)
INSERT OR IGNORE INTO customer_ledger (id, customer_id, date, reference_type, reference_no, description, debit, credit, balance, created_at) VALUES 
(1, 1, '2026-08-15', 'Credit Sale', 'INV-2026-0980', 'खते व औषधे उधारी खरेदी', 23450, 0, 23450, datetime('now', '-30 days')),
(2, 1, '2026-09-02', 'Payment Received', 'REC-2026-0101', 'फोनपे (UPI) द्वारे जमा पावती', 0, 5000, 18450, datetime('now', '-14 days')),
(3, 2, '2026-08-28', 'Credit Sale', 'INV-2026-0992', 'सोयाबीन बियाणे व खत उधारी', 12200, 0, 12200, datetime('now', '-18 days')),
(4, 2, '2026-09-05', 'Payment Received', 'REC-2026-0104', 'रोख जमा पावती', 0, 5000, 7200, datetime('now', '-11 days')),
(5, 4, '2026-08-20', 'Credit Sale', 'INV-2026-0985', 'डीएपी व कोराजन औषध उधारी', 24500, 0, 24500, datetime('now', '-25 days'));

-- Licences Compliance
INSERT OR IGNORE INTO licences (id, licence_type, licence_no, holder_name, issuing_authority, issue_date, expiry_date, notes) VALUES 
(1, 'Fertilizer', 'FL/PUN/2022/8492', 'श्री समर्थ कृषी सेवा केंद्र (संजय आनंदराव पाटील)', 'जिल्हा अधीक्षक कृषी अधिकारी, पुणे', '2022-05-10', '2027-05-09', 'खते विक्री व साठवणूक अधिकृत परवाना (Class A)'),
(2, 'Seed', 'SL/PUN/2021/4102', 'श्री समर्थ कृषी सेवा केंद्र (संजय आनंदराव पाटील)', 'कृषी संचालक (निविष्ठा व गुणनियंत्रण), महाराष्ट्र राज्य', '2021-06-15', '2026-11-30', 'बियाणे परवाना (लवकर नूतनीकरण आवश्यक - Alert Active)'),
(3, 'Insecticide', 'IL/PUN/2023/1932', 'श्री समर्थ कृषी सेवा केंद्र (संजय आनंदराव पाटील)', 'कृषी उपसंचालक व गुणनियंत्रण निरीक्षक, पुणे', '2023-08-01', '2028-07-31', 'कीटकनाशक व बुरशीनाशक विक्री परवाना');

-- Sample Initial Cash In Hand
INSERT OR IGNORE INTO cash_transactions (id, date_time, type, category, amount, balance_after, reference_id, description, user_name) VALUES 
(1, datetime('now', '-1 day', '08:00:00'), 'IN', 'Opening Cash', 25000, 25000, 'OPEN-01', 'सकाळची रोख शिलकी जमा', 'Admin'),
(2, datetime('now', '-1 day', '11:30:00'), 'IN', 'Cash Sale', 8450, 33450, 'INV-2026-0998', 'काउंटर रोख विक्री पावती', 'Admin'),
(3, datetime('now', '-1 day', '16:00:00'), 'OUT', 'Expense', 600, 32850, 'EXP-01', 'हमाली व मजुरी खर्च', 'Admin');

-- Initial Stock Movements for traceability
INSERT OR IGNORE INTO stock_movements (id, date_time, product_id, product_name, batch_id, batch_number, movement_type, quantity, unit, reference_type, reference_id, location_name, user_name, reason) VALUES 
(1, datetime('now', '-20 days'), 1, 'Neem Coated Urea 45kg', 1, 'IFF-2601', 'Opening Stock', 150, 'Bag', 'Opening', 'OPN-01', 'Main Shop', 'Admin', 'आरंभीचा शिल्लक साठा'),
(2, datetime('now', '-20 days'), 2, 'Mahadhan DAP 18:46:0 50kg', 2, 'MD-DAP-88', 'Opening Stock', 80, 'Bag', 'Opening', 'OPN-02', 'Main Shop', 'Admin', 'आरंभीचा शिल्लक साठा'),
(3, datetime('now', '-20 days'), 4, 'FMC Coragen 18.5% SC 60ml', 4, 'FMC-CRG-25A', 'Opening Stock', 40, 'Bottle', 'Opening', 'OPN-04', 'Main Shop', 'Admin', 'आरंभीचा शिल्लक साठा');

-- Initial Audit Log
INSERT OR IGNORE INTO audit_logs (id, date_time, user_name, action, entity, entity_id, description) VALUES 
(1, datetime('now', '-1 day'), 'Admin', 'System Initialized', 'Database', 'SYSTEM', 'कृषी सेवा केंद्र ईआरपी प्रणाली डेटाबेस सुरू करण्यात आला.');
`;
