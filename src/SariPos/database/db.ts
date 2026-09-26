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
    db.execSync(`
      PRAGMA foreign_keys = ON;

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

    // Force-inject Utang column into existing tables
    try {
      db.execSync("ALTER TABLE sales ADD COLUMN customer_name TEXT DEFAULT '';");
    } catch (e) {
      // Safe catch: Column already exists
    }
  } catch (e) {
    console.error('Database Schema Initialization Error:', e);
  }
}