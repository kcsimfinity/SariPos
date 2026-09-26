import { getDB } from './db';
import { Product, Category, Sale, CartItem, StoreSettings } from '../types';

/**
 * Sanitizes input parameters before execution to prevent Android SQLite driver
 * crashes caused by `undefined` or `NaN` values reaching NativeDatabase.prepareAsync.
 */
function cleanParams(params: any[]): any[] {
  return params.map(p => {
    if (p === undefined || p === null) return '';
    if (typeof p === 'number' && isNaN(p)) return 0;
    return p;
  });
}

export const dbService = {
  // ==========================================
  // CATEGORIES MANAGEMENT
  // ==========================================
  async getCategories(): Promise<Category[]> {
    const db = getDB();
    return await db.getAllAsync<Category>('SELECT * FROM categories ORDER BY name ASC');
  },

  async addCategory(name: string): Promise<void> {
    const db = getDB();
    const id = 'CAT_' + Date.now();
    await db.runAsync(
      'INSERT INTO categories (id, name) VALUES (?, ?)',
      cleanParams([id, name.trim()])
    );
  },

  async updateCategory(id: string, newName: string): Promise<void> {
    const db = getDB();
    await db.runAsync(
      'UPDATE categories SET name = ? WHERE id = ?',
      cleanParams([newName.trim(), id])
    );
  },

  async deleteCategory(id: string): Promise<void> {
    const db = getDB();
    await db.runAsync(
      'DELETE FROM categories WHERE id = ?',
      cleanParams([id])
    );
  },

  // ==========================================
  // PRODUCTS MANAGEMENT
  // ==========================================
  async getProducts(): Promise<Product[]> {
    const db = getDB();
    return await db.getAllAsync<Product>(`
      SELECT p.*, c.name as category_name 
      FROM products p 
      LEFT JOIN categories c ON p.category_id = c.id 
      WHERE p.is_active = 1 
      ORDER BY p.name ASC
    `);
  },

  async addProduct(product: Omit<Product, 'id' | 'is_active'>): Promise<void> {
    const db = getDB();
    const id = 'PROD_' + Date.now();
    await db.runAsync(
      `INSERT INTO products (
        id, barcode, name, category_id, pricing_type, unit_piece_name, unit_pack_name, 
        pieces_per_pack, buying_price_piece, buying_price_pack, selling_price_piece, selling_price_pack, 
        stock_pieces, min_stock_pieces, is_active
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
      cleanParams([
        id,
        product.barcode || '',
        product.name || '',
        product.category_id || '',
        product.pricing_type || 'PIECE',
        product.unit_piece_name || 'pc',
        product.unit_pack_name || 'pack',
        product.pieces_per_pack || 1,
        product.buying_price_piece || 0,
        product.buying_price_pack || 0,
        product.selling_price_piece || 0,
        product.selling_price_pack || 0,
        product.stock_pieces || 0,
        product.min_stock_pieces || 5
      ])
    );
  },

  async updateProduct(product: Product): Promise<void> {
    const db = getDB();
    await db.runAsync(
      `UPDATE products 
       SET barcode = ?, name = ?, category_id = ?, pricing_type = ?, unit_piece_name = ?, unit_pack_name = ?,
           pieces_per_pack = ?, buying_price_piece = ?, buying_price_pack = ?, selling_price_piece = ?, selling_price_pack = ?,
           stock_pieces = ?, min_stock_pieces = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      cleanParams([
        product.barcode || '',
        product.name || '',
        product.category_id || '',
        product.pricing_type || 'PIECE',
        product.unit_piece_name || 'pc',
        product.unit_pack_name || 'pack',
        product.pieces_per_pack || 1,
        product.buying_price_piece || 0,
        product.buying_price_pack || 0,
        product.selling_price_piece || 0,
        product.selling_price_pack || 0,
        product.stock_pieces || 0,
        product.min_stock_pieces || 5,
        product.id
      ])
    );
  },

  async deleteProduct(id: string): Promise<void> {
    const db = getDB();
    await db.runAsync(
      'UPDATE products SET is_active = 0 WHERE id = ?',
      cleanParams([id])
    );
  },

  // ==========================================
  // DYNAMIC STOCK ADJUSTMENT & COGS ACCOUNTING
  // ==========================================
  async adjustStock(
    productId: string,
    changeQtyPieces: number,
    reason: string,
    priceUpdates?: {
      new_buying_price_piece?: number;
      new_buying_price_pack?: number;
      new_selling_price_piece?: number;
      new_selling_price_pack?: number;
    }
  ): Promise<void> {
    const db = getDB();
    await db.withTransactionAsync(async () => {
      const prod = await db.getFirstAsync<Product>(
        'SELECT * FROM products WHERE id = ?',
        cleanParams([productId])
      );
      if (!prod) throw new Error('Product not found');

      const prevStockPieces = prod.stock_pieces || 0;
      const newStockPieces = prevStockPieces + changeQtyPieces;

      if (newStockPieces < 0) throw new Error('Stock cannot drop below 0 pieces');

      const pPerPack = prod.pieces_per_pack || 1;

      let finalBuyPricePiece = prod.buying_price_piece || 0;
      let finalBuyPricePack = prod.buying_price_pack || 0;
      let finalSellPricePiece = prod.selling_price_piece || 0;
      let finalSellPricePack = prod.selling_price_pack || 0;

      if (changeQtyPieces > 0 && priceUpdates) {
        const batchBuyPricePiece = priceUpdates.new_buying_price_piece ?? prod.buying_price_piece;

        if (newStockPieces > 0 && batchBuyPricePiece > 0) {
          finalBuyPricePiece =
            ((prevStockPieces * (prod.buying_price_piece || 0)) + (changeQtyPieces * batchBuyPricePiece)) / newStockPieces;
        }

        finalBuyPricePack = priceUpdates.new_buying_price_pack ?? (finalBuyPricePiece * pPerPack);

        if (priceUpdates.new_selling_price_piece !== undefined && priceUpdates.new_selling_price_piece > 0) {
          finalSellPricePiece = priceUpdates.new_selling_price_piece;
        }

        if (priceUpdates.new_selling_price_pack !== undefined && priceUpdates.new_selling_price_pack > 0) {
          finalSellPricePack = priceUpdates.new_selling_price_pack;
        } else {
          finalSellPricePack = finalSellPricePiece * pPerPack;
        }
      }

      await db.runAsync(
        `UPDATE products 
         SET stock_pieces = ?, buying_price_piece = ?, buying_price_pack = ?, selling_price_piece = ?, selling_price_pack = ?, updated_at = CURRENT_TIMESTAMP 
         WHERE id = ?`,
        cleanParams([newStockPieces, finalBuyPricePiece, finalBuyPricePack, finalSellPricePiece, finalSellPricePack, productId])
      );

      const adjId = 'ADJ_' + Date.now();
      const logNote = priceUpdates 
        ? ` (Avg Cost Updated: ₱${finalBuyPricePiece.toFixed(2)}/pc)` 
        : '';

      await db.runAsync(
        `INSERT INTO stock_adjustments (id, product_id, previous_stock_pieces, change_qty_pieces, new_stock_pieces, reason, timestamp)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        cleanParams([
          adjId,
          productId,
          prevStockPieces,
          changeQtyPieces,
          newStockPieces,
          (reason || 'Adjustment') + logNote,
          new Date().toISOString()
        ])
      );
    });
  },

  // ==========================================
  // POS CHECKOUT & UTANG TRANSACTION PROCESSING
  // ==========================================
  async processSale(
    cart: CartItem[],
    transactionDiscount: number,
    paymentMethod: 'CASH' | 'CREDIT',
    amountPaid: number,
    customerName?: string
  ): Promise<Sale> {
    const db = getDB();
    let createdSale: Sale | null = null;

    await db.withTransactionAsync(async () => {
      let subtotal = 0;
      let totalItemDiscounts = 0;
      let totalCogs = 0;

      const requiredPiecesMap: { [productId: string]: number } = {};
      for (const item of cart) {
        const linePieces = item.unitType === 'PACK' ? item.quantity * item.product.pieces_per_pack : item.quantity;
        requiredPiecesMap[item.product.id] = (requiredPiecesMap[item.product.id] || 0) + linePieces;
      }

      for (const [prodId, reqPieces] of Object.entries(requiredPiecesMap)) {
        const freshProd = await db.getFirstAsync<Product>(
          'SELECT stock_pieces, name FROM products WHERE id = ?',
          cleanParams([prodId])
        );
        if (!freshProd || freshProd.stock_pieces < reqPieces) {
          throw new Error(`Insufficient stock for ${freshProd?.name || 'Product'}. Available: ${freshProd?.stock_pieces || 0} pieces.`);
        }
      }

      for (const item of cart) {
        const lineSubtotal = item.unitPrice * item.quantity;
        subtotal += lineSubtotal;
        totalItemDiscounts += item.discount || 0;

        const unitBuyingCost = item.unitType === 'PACK'
          ? (item.product.buying_price_pack || 0)
          : (item.product.buying_price_piece || 0);

        totalCogs += unitBuyingCost * item.quantity;
      }

      const totalNetSales = subtotal - totalItemDiscounts - (transactionDiscount || 0);
      const grossProfit = totalNetSales - totalCogs;

      if (paymentMethod === 'CASH' && amountPaid < totalNetSales) {
        throw new Error('Cash received is less than total due.');
      }

      const changeAmount = paymentMethod === 'CASH' ? amountPaid - totalNetSales : 0;
      const saleId = 'SALE_' + Date.now();
      const transactionNo = 'TXN-' + Date.now().toString().slice(-8);
      const timestamp = new Date().toISOString();

      await db.runAsync(
        `INSERT INTO sales (id, transaction_no, timestamp, subtotal, item_discounts, transaction_discount, total, payment_method, amount_paid, change_amount, total_cogs, gross_profit, customer_name)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        cleanParams([
          saleId,
          transactionNo,
          timestamp,
          subtotal,
          totalItemDiscounts,
          transactionDiscount || 0,
          totalNetSales,
          paymentMethod,
          amountPaid,
          changeAmount,
          totalCogs,
          grossProfit,
          customerName || ''
        ])
      );

      for (const item of cart) {
        const saleItemId = 'ITEM_' + Date.now() + Math.random().toString().slice(2, 6);
        const itemNetSubtotal = (item.unitPrice * item.quantity) - (item.discount || 0);
        const unitBuyingCost = item.unitType === 'PACK'
          ? (item.product.buying_price_pack || 0)
          : (item.product.buying_price_piece || 0);

        const piecesToDeduct = item.unitType === 'PACK' ? item.quantity * item.product.pieces_per_pack : item.quantity;

        await db.runAsync(
          `INSERT INTO sale_items (id, sale_id, product_id, product_name, unit_type, buying_price_unit, selling_price_unit, quantity, discount, subtotal)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          cleanParams([
            saleItemId,
            saleId,
            item.product.id,
            item.product.name,
            item.unitType,
            unitBuyingCost,
            item.unitPrice,
            item.quantity,
            item.discount || 0,
            itemNetSubtotal
          ])
        );

        await db.runAsync(
          `UPDATE products SET stock_pieces = stock_pieces - ? WHERE id = ?`,
          cleanParams([piecesToDeduct, item.product.id])
        );
      }

      createdSale = {
        id: saleId,
        transaction_no: transactionNo,
        timestamp,
        subtotal,
        item_discounts: totalItemDiscounts,
        transaction_discount: transactionDiscount || 0,
        total: totalNetSales,
        payment_method: paymentMethod,
        amount_paid: amountPaid,
        change_amount: changeAmount,
        total_cogs: totalCogs,
        gross_profit: grossProfit,
        customer_name: customerName || ''
      };
    });

    if (!createdSale) throw new Error('Transaction execution failed.');
    return createdSale;
  },

  // ==========================================
  // UTANG / CREDIT LEDGER QUERIES
  // ==========================================
  async getUtangCustomers(): Promise<any[]> {
    const db = getDB();
    return await db.getAllAsync<any>(`
      SELECT 
        customer_name,
        COUNT(id) as unpaid_tx_count,
        SUM(total - amount_paid) as total_balance_owed
      FROM sales
      WHERE payment_method = 'CREDIT' AND (total - amount_paid) > 0.01
      GROUP BY customer_name
      HAVING total_balance_owed > 0.01
      ORDER BY total_balance_owed DESC
    `);
  },

  async getCustomerUtangHistory(customerName: string): Promise<Sale[]> {
    const db = getDB();
    return await db.getAllAsync<Sale>(`
      SELECT * FROM sales
      WHERE payment_method = 'CREDIT' 
        AND customer_name = ?
        AND (total - amount_paid) > 0.01
      ORDER BY timestamp DESC
    `, cleanParams([customerName]));
  },

  async settleCustomerUtang(customerName: string, paymentAmount: number): Promise<void> {
    const db = getDB();
    await db.withTransactionAsync(async () => {
      const unpaidSales = await db.getAllAsync<Sale>(`
        SELECT * FROM sales 
        WHERE payment_method = 'CREDIT' 
          AND customer_name = ? 
          AND (total - amount_paid) > 0.01 
        ORDER BY timestamp ASC
      `, cleanParams([customerName]));

      let remainingPayment = paymentAmount;
      for (const sale of unpaidSales) {
        if (remainingPayment <= 0) break;
        const balance = sale.total - sale.amount_paid;
        const paymentForThisSale = Math.min(balance, remainingPayment);
        const newAmountPaid = sale.amount_paid + paymentForThisSale;

        await db.runAsync(
          'UPDATE sales SET amount_paid = ? WHERE id = ?',
          cleanParams([newAmountPaid, sale.id])
        );

        remainingPayment -= paymentForThisSale;
      }
    });
  },

  async addLegacyUtang(customerName: string, amount: number): Promise<void> {
    const db = getDB();
    const id = 'SALE_LEGACY_' + Date.now();
    const txnNo = 'OLD-' + Math.floor(Math.random() * 100000);
    const timestamp = new Date().toISOString();
    
    await db.runAsync(
      `INSERT INTO sales (
        id, transaction_no, timestamp, subtotal, item_discounts, transaction_discount, 
        total, payment_method, amount_paid, change_amount, total_cogs, gross_profit, customer_name
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      cleanParams([
        id, txnNo, timestamp, amount, 0, 0, 
        amount, 'CREDIT', 0, 0, 0, 0, customerName.trim()
      ])
    );
  },

  async logUtangPayment(customerName: string, amount: number): Promise<void> {
    const db = getDB();
    const id = 'SALE_PAY_' + Date.now();
    const txnNo = 'PAY-' + Math.floor(Math.random() * 100000);
    const timestamp = new Date().toISOString();
    
    await db.runAsync(
      `INSERT INTO sales (
        id, transaction_no, timestamp, subtotal, item_discounts, transaction_discount, 
        total, payment_method, amount_paid, change_amount, total_cogs, gross_profit, customer_name
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      cleanParams([
        id, txnNo, timestamp, 0, 0, 0, 
        0, 'UTANG_PAYMENT', amount, 0, 0, 0, customerName.trim()
      ])
    );
  },

  async getSaleItemsBySaleId(saleId: string | number): Promise<any[]> {
    const db = getDB();
    return await db.getAllAsync(
      `SELECT * FROM sale_items WHERE sale_id = ?`, 
      cleanParams([saleId])
    );
  },

  // ==========================================
  // DATE-BASED SALES REPORTS (RESTORED getSummaryByDate)
  // ==========================================
  async getSalesByDate(dateStr: string): Promise<Sale[]> {
    const db = getDB();
    const sales = await db.getAllAsync<Sale>(
      `SELECT * FROM sales WHERE DATE(timestamp) = DATE(?) ORDER BY timestamp DESC`,
      cleanParams([dateStr])
    );

    for (const sale of sales) {
      sale.items = await db.getAllAsync<any>(
        'SELECT * FROM sale_items WHERE sale_id = ?',
        cleanParams([sale.id])
      );
    }
    return sales;
  },

  async getSummaryByDate(dateStr: string) {
    const db = getDB();

    const result = await db.getFirstAsync<{
      gross_sales: number;
      discounts: number;
      net_sales: number;
      cogs: number;
      gross_profit: number;
      tx_count: number;
    }>(`
      SELECT 
        COALESCE(SUM(subtotal), 0) as gross_sales,
        COALESCE(SUM(item_discounts + transaction_discount), 0) as discounts,
        COALESCE(SUM(total), 0) as net_sales,
        COALESCE(SUM(total_cogs), 0) as cogs,
        COALESCE(SUM(gross_profit), 0) as gross_profit,
        COUNT(id) as tx_count
      FROM sales 
      WHERE DATE(timestamp) = DATE(?)
    `, cleanParams([dateStr]));

    const itemResult = await db.getFirstAsync<{ total_items: number }>(`
      SELECT COALESCE(SUM(si.quantity), 0) as total_items
      FROM sale_items si
      JOIN sales s ON si.sale_id = s.id
      WHERE DATE(s.timestamp) = DATE(?)
    `, cleanParams([dateStr]));

    return {
      grossSales: result?.gross_sales ?? 0,
      discounts: result?.discounts ?? 0,
      netSales: result?.net_sales ?? 0,
      cogs: result?.cogs ?? 0,
      grossProfit: result?.gross_profit ?? 0,
      txCount: result?.tx_count ?? 0,
      totalItemsSold: itemResult?.total_items ?? 0
    };
  },

  async getSales(limit = 50): Promise<Sale[]> {
    const db = getDB();
    const sales = await db.getAllAsync<Sale>(
      `SELECT * FROM sales ORDER BY timestamp DESC LIMIT ?`,
      cleanParams([limit])
    );

    for (const sale of sales) {
      sale.items = await db.getAllAsync<any>(
        'SELECT * FROM sale_items WHERE sale_id = ?',
        cleanParams([sale.id])
      );
    }
    return sales;
  },

  async getTodaySummary() {
    const today = new Date().toISOString().split('T')[0];
    return await this.getSummaryByDate(today);
  },

  // ==========================================
  // STORE SETTINGS & DATABASE BACKUP
  // ==========================================
  async getSettings(): Promise<StoreSettings> {
    const db = getDB();
    const rows = await db.getAllAsync<{ key: string; value: string }>('SELECT * FROM settings');
    const settings: any = {};
    rows.forEach(r => settings[r.key] = r.value);
    return settings as StoreSettings;
  },

  async getStoreSettings(): Promise<StoreSettings> {
    const db = getDB();
    const rows = await db.getAllAsync<{ key: string; value: string }>('SELECT * FROM settings');
    const settings: any = {};
    rows.forEach(r => settings[r.key] = r.value);
    return settings as StoreSettings;
  },

  async updateSettings(settings: StoreSettings): Promise<void> {
    const db = getDB();
    for (const [key, value] of Object.entries(settings)) {
      await db.runAsync(
        'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
        cleanParams([key, value])
      );
    }
  },

  async updateStoreSettings(settings: StoreSettings): Promise<void> {
    const db = getDB();
    for (const [key, value] of Object.entries(settings)) {
      await db.runAsync(
        'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
        cleanParams([key, value])
      );
    }
  },

  async exportDatabaseJSON(): Promise<string> {
    const db = getDB();
    const categories = await db.getAllAsync('SELECT * FROM categories');
    const products = await db.getAllAsync('SELECT * FROM products');
    const sales = await db.getAllAsync('SELECT * FROM sales');
    const saleItems = await db.getAllAsync('SELECT * FROM sale_items');
    const stockAdjustments = await db.getAllAsync('SELECT * FROM stock_adjustments');
    const settings = await db.getAllAsync('SELECT * FROM settings');

    return JSON.stringify({
      version: 4,
      timestamp: new Date().toISOString(),
      data: { categories, products, sales, saleItems, stockAdjustments, settings }
    }, null, 2);
  },

  async importDatabaseJSON(jsonStr: string): Promise<void> {
    const parsed = JSON.parse(jsonStr);
    const db = getDB();
    await db.withTransactionAsync(async () => {
      await db.runAsync('DELETE FROM sale_items');
      await db.runAsync('DELETE FROM sales');
      await db.runAsync('DELETE FROM stock_adjustments');
      await db.runAsync('DELETE FROM products');
      await db.runAsync('DELETE FROM categories');
      await db.runAsync('DELETE FROM settings');

      if (parsed.data) {
        const { categories = [], products = [], sales = [], saleItems = [], stockAdjustments = [], settings = [] } = parsed.data;
        for (const c of categories) await db.runAsync('INSERT INTO categories (id, name) VALUES (?, ?)', cleanParams([c.id, c.name]));
        for (const p of products) await db.runAsync('INSERT INTO products (id, barcode, name, category_id, pricing_type, unit_piece_name, unit_pack_name, pieces_per_pack, buying_price_piece, buying_price_pack, selling_price_piece, selling_price_pack, stock_pieces, min_stock_pieces, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', cleanParams([p.id, p.barcode, p.name, p.category_id, p.pricing_type, p.unit_piece_name, p.unit_pack_name, p.pieces_per_pack, p.buying_price_piece, p.buying_price_pack, p.selling_price_piece, p.selling_price_pack, p.stock_pieces, p.min_stock_pieces, p.is_active]));
        for (const s of sales) await db.runAsync('INSERT INTO sales (id, transaction_no, timestamp, subtotal, item_discounts, transaction_discount, total, payment_method, amount_paid, change_amount, total_cogs, gross_profit, customer_name) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', cleanParams([s.id, s.transaction_no, s.timestamp, s.subtotal, s.item_discounts, s.transaction_discount, s.total, s.payment_method, s.amount_paid, s.change_amount, s.total_cogs, s.gross_profit, s.customer_name]));
        for (const si of saleItems) await db.runAsync('INSERT INTO sale_items (id, sale_id, product_id, product_name, unit_type, buying_price_unit, selling_price_unit, quantity, discount, subtotal) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', cleanParams([si.id, si.sale_id, si.product_id, si.product_name, si.unit_type, si.buying_price_unit, si.selling_price_unit, si.quantity, si.discount, si.subtotal]));
        for (const sa of stockAdjustments) await db.runAsync('INSERT INTO stock_adjustments (id, product_id, previous_stock_pieces, change_qty_pieces, new_stock_pieces, reason, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?)', cleanParams([sa.id, sa.product_id, sa.previous_stock_pieces, sa.change_qty_pieces, sa.new_stock_pieces, sa.reason, sa.timestamp]));
        for (const st of settings) await db.runAsync('INSERT INTO settings (key, value) VALUES (?, ?)', cleanParams([st.key, st.value]));
      }
    });
  }
};