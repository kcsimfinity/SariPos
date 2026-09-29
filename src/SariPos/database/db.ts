import * as SQLite from 'expo-sqlite';

let dbInstance: SQLite.SQLiteDatabase | null = null;

// Exported explicitly for POSContext.tsx
export function initDatabase(): SQLite.SQLiteDatabase {
  if (!dbInstance) {
    dbInstance = SQLite.openDatabaseSync('saripos.db');
    initDatabaseSchema(dbInstance);
  }
  return dbInstance;
}

// Exported explicitly for databaseService.ts
export function getDB(): SQLite.SQLiteDatabase {
  if (!dbInstance) {
    return initDatabase();
  }
  return dbInstance;
}

function initDatabaseSchema(db: SQLite.SQLiteDatabase) {
  try {
    db.execSync('PRAGMA foreign_keys = ON;');

    // 1. Always ensure base tables exist (Safe for V0 databases)
    db.execSync(`
      CREATE TABLE IF NOT EXISTS categories (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS products (
        id TEXT PRIMARY KEY NOT NULL,
        barcode TEXT DEFAULT '',
        name TEXT NOT NULL,
        category_id TEXT DEFAULT '',
        pricing_type TEXT DEFAULT 'PIECE',
        unit_piece_name TEXT DEFAULT 'pc',
        unit_pack_name TEXT DEFAULT 'pack',
        pieces_per_pack INTEGER DEFAULT 1,
        buying_price_piece REAL DEFAULT 0,
        buying_price_pack REAL DEFAULT 0,
        selling_price_piece REAL DEFAULT 0,
        selling_price_pack REAL DEFAULT 0,
        stock_pieces INTEGER DEFAULT 0,
        min_stock_pieces INTEGER DEFAULT 5,
        is_active INTEGER DEFAULT 1,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS sales (
        id TEXT PRIMARY KEY NOT NULL,
        transaction_no TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        subtotal REAL DEFAULT 0,
        item_discounts REAL DEFAULT 0,
        transaction_discount REAL DEFAULT 0,
        total REAL DEFAULT 0,
        payment_method TEXT NOT NULL,
        amount_paid REAL DEFAULT 0,
        change_amount REAL DEFAULT 0,
        total_cogs REAL DEFAULT 0,
        gross_profit REAL DEFAULT 0,
        customer_name TEXT DEFAULT ''
      );

      CREATE TABLE IF NOT EXISTS sale_items (
        id TEXT PRIMARY KEY NOT NULL,
        sale_id TEXT NOT NULL,
        product_id TEXT NOT NULL,
        product_name TEXT NOT NULL,
        unit_type TEXT NOT NULL,
        buying_price_unit REAL DEFAULT 0,
        selling_price_unit REAL DEFAULT 0,
        quantity INTEGER DEFAULT 0,
        discount REAL DEFAULT 0,
        subtotal REAL DEFAULT 0,
        FOREIGN KEY (sale_id) REFERENCES sales (id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS stock_adjustments (
        id TEXT PRIMARY KEY NOT NULL,
        product_id TEXT NOT NULL,
        previous_stock_pieces INTEGER DEFAULT 0,
        change_qty_pieces INTEGER DEFAULT 0,
        new_stock_pieces INTEGER DEFAULT 0,
        reason TEXT DEFAULT '',
        timestamp TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY NOT NULL,
        value TEXT NOT NULL
      );
    `);

    // 2. Perform Migration Steps based on PRAGMA user_version
    const versionRow = db.getFirstSync<{ user_version: number }>('PRAGMA user_version;');
    let currentVersion = versionRow?.user_version || 0;

    // Version 1: Add Utang Customer Name to Sales
    if (currentVersion < 1) {
      try {
        db.execSync("ALTER TABLE sales ADD COLUMN customer_name TEXT DEFAULT '';");
      } catch (e) { /* Column might exist if created manually before versions were tracked */ }
      
      currentVersion = 1;
      db.execSync(`PRAGMA user_version = ${currentVersion};`);
    }

    // Version 2: Cash Drawer, Store Expenses, Utang Payments, and Legacy Utang flag
    if (currentVersion < 2) {
      db.execSync(`
        CREATE TABLE IF NOT EXISTS utang_payments (
          id TEXT PRIMARY KEY NOT NULL,
          sale_id TEXT NOT NULL,
          customer_name TEXT NOT NULL,
          amount REAL DEFAULT 0,
          timestamp TEXT NOT NULL,
          notes TEXT DEFAULT ''
        );

        CREATE TABLE IF NOT EXISTS cash_drawer_sessions (
          id TEXT PRIMARY KEY NOT NULL,
          opened_at TEXT NOT NULL,
          closed_at TEXT,
          opening_cash REAL DEFAULT 0,
          expected_cash REAL DEFAULT 0,
          actual_cash REAL DEFAULT 0,
          variance REAL DEFAULT 0,
          status TEXT DEFAULT 'OPEN'
        );

        CREATE TABLE IF NOT EXISTS store_expenses (
          id TEXT PRIMARY KEY NOT NULL,
          type TEXT DEFAULT 'EXPENSE',
          amount REAL DEFAULT 0,
          description TEXT DEFAULT '',
          timestamp TEXT NOT NULL,
          cash_drawer_session_id TEXT
        );
      `);

      try {
        db.execSync("ALTER TABLE sales ADD COLUMN is_legacy INTEGER DEFAULT 0;");
      } catch (e) {}

      currentVersion = 2;
      db.execSync(`PRAGMA user_version = ${currentVersion};`);
    }

    // Version 3: Customer Identity System
    if (currentVersion < 3) {
      db.execSync(`
        CREATE TABLE IF NOT EXISTS customers (
          id TEXT PRIMARY KEY NOT NULL,
          name TEXT NOT NULL COLLATE NOCASE,
          created_at TEXT NOT NULL
        );
      `);
      
      try { db.execSync("ALTER TABLE sales ADD COLUMN customer_id TEXT DEFAULT '';"); } catch(e){}
      try { db.execSync("ALTER TABLE utang_payments ADD COLUMN customer_id TEXT DEFAULT '';"); } catch(e){}

      // Migrate existing string customers to actual records
      // 1. Find all distinct names from sales and utang_payments
      // 2. Insert into customers
      // 3. Update sales and utang_payments with the new IDs
      const timestamp = new Date().toISOString();
      db.execSync(`
        INSERT INTO customers (id, name, created_at)
        SELECT 'CUS_' || hex(randomblob(4)), name, '${timestamp}'
        FROM (
          SELECT DISTINCT customer_name as name FROM sales WHERE customer_name IS NOT NULL AND customer_name != ''
          UNION
          SELECT DISTINCT customer_name as name FROM utang_payments WHERE customer_name IS NOT NULL AND customer_name != ''
        )
        WHERE name NOT IN (SELECT name FROM customers);
        
        UPDATE sales 
        SET customer_id = (SELECT id FROM customers WHERE customers.name = sales.customer_name)
        WHERE customer_name IS NOT NULL AND customer_name != '' AND (customer_id IS NULL OR customer_id = '');

        UPDATE utang_payments 
        SET customer_id = (SELECT id FROM customers WHERE customers.name = utang_payments.customer_name)
        WHERE customer_name IS NOT NULL AND customer_name != '' AND (customer_id IS NULL OR customer_id = '');
      `);

      currentVersion = 3;
      db.execSync(`PRAGMA user_version = ${currentVersion};`);
    }

    // Version 4: Add notes column to sales for legacy utang descriptions
    if (currentVersion < 4) {
      try { db.execSync("ALTER TABLE sales ADD COLUMN notes TEXT DEFAULT '';"); } catch(e){}
      currentVersion = 4;
      db.execSync(`PRAGMA user_version = ${currentVersion};`);
    }
  } catch (e) {
    console.error('Database Schema Initialization Error:', e);
  }
}