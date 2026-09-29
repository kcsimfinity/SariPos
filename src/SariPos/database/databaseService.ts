import { CartItem, Category, Product, Sale, StoreSettings } from '../types';
import { getDB } from './db';

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

  async getProductStockHistory(productId: string): Promise<any[]> {
    const db = getDB();
    return await db.getAllAsync(
      'SELECT * FROM stock_adjustments WHERE product_id = ? ORDER BY timestamp DESC',
      [productId]
    );
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

    
    let customerId = '';
    if (paymentMethod === 'CREDIT' && customerName) {
      const cname = customerName.trim();
      const existing = await db.getFirstAsync<{id: string}>('SELECT id FROM customers WHERE name = ? COLLATE NOCASE', [cname]);
      if (existing) {
        customerId = existing.id;
      } else {
        customerId = 'CUS_' + Date.now() + Math.random().toString().slice(2, 6);
        await db.runAsync('INSERT INTO customers (id, name, created_at) VALUES (?, ?, ?)', [customerId, cname, new Date().toISOString()]);
      }
    }
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

      const totalDiscounts = totalItemDiscounts + (transactionDiscount || 0);
      if (totalDiscounts > subtotal) {
        throw new Error('Total discounts cannot exceed the subtotal.');
      }

      const totalNetSales = Math.max(0, subtotal - totalDiscounts);
      const grossProfit = totalNetSales - totalCogs;

      if (paymentMethod === 'CASH' && amountPaid < totalNetSales) {
        throw new Error('Cash received is less than total due.');
      }

      const changeAmount = paymentMethod === 'CASH' ? amountPaid - totalNetSales : 0;
      const saleId = 'SALE_' + Date.now();
      const transactionNo = 'TXN-' + Date.now().toString().slice(-8);
      const timestamp = new Date().toISOString();

      await db.runAsync(
        `INSERT INTO sales (
          id, transaction_no, timestamp, subtotal, item_discounts, transaction_discount, 
          total, payment_method, amount_paid, change_amount, total_cogs, gross_profit, customer_name, customer_id, is_legacy
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
          customerName || '', customerId, 0
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
        customer_name: customerName || '', customer_id: customerId
      };
    });

    if (!createdSale) throw new Error('Transaction execution failed.');
    return createdSale;
  },

  //   // ==========================================
  // UTANG / CREDIT LEDGER QUERIES
  // ==========================================
  
  async getCustomers(): Promise<any[]> {
    const db = getDB();
    const rows = await db.getAllAsync<any>(`
      SELECT 
        c.id as customer_id,
        c.name as customer_name,
        COUNT(CASE WHEN (s.total - COALESCE(s.amount_paid, 0) - COALESCE((SELECT SUM(amount) FROM utang_payments WHERE sale_id = s.id), 0)) > 0.01 THEN s.id END) as unpaid_tx_count,
        COALESCE(SUM(s.total - COALESCE(s.amount_paid, 0) - COALESCE((SELECT SUM(amount) FROM utang_payments WHERE sale_id = s.id), 0)), 0) as total_balance_owed,
        MAX(COALESCE(s.timestamp, '')) as last_sale_at,
        (SELECT MAX(up.timestamp) FROM utang_payments up WHERE up.customer_id = c.id) as last_payment_at
      FROM customers c
      LEFT JOIN sales s ON s.customer_id = c.id AND s.payment_method = 'CREDIT'
      GROUP BY c.id
      ORDER BY 
        CASE WHEN total_balance_owed > 0.01 THEN 0 ELSE 1 END,
        total_balance_owed DESC,
        c.name ASC
    `);
    // Compute last_activity_at as the most recent of last sale or payment
    return rows.map(row => {
      const dates = [row.last_sale_at, row.last_payment_at].filter(d => d && d.length > 5);
      return { ...row, last_activity_at: dates.length > 0 ? [...dates].sort().reverse()[0] : null };
    });
  },

  async mergeCustomers(survivingId: string, mergingId: string): Promise<void> {
    const db = getDB();
    await db.withTransactionAsync(async () => {
      const surviving = await db.getFirstAsync<{name: string}>('SELECT name FROM customers WHERE id = ?', [survivingId]);
      if (!surviving) throw new Error('Surviving customer not found');
      
      await db.runAsync('UPDATE sales SET customer_id = ?, customer_name = ? WHERE customer_id = ?', [survivingId, surviving.name, mergingId]);
      await db.runAsync('UPDATE utang_payments SET customer_id = ?, customer_name = ? WHERE customer_id = ?', [survivingId, surviving.name, mergingId]);
      await db.runAsync('DELETE FROM customers WHERE id = ?', [mergingId]);
    });
  },

  async getCustomerUtangHistory(customerId: string): Promise<any[]> {
    const db = getDB();
    return await db.getAllAsync<any>(`
      SELECT 
        s.*,
        (s.total - COALESCE(s.amount_paid, 0) - COALESCE((SELECT SUM(amount) FROM utang_payments WHERE sale_id = s.id), 0)) as remaining_balance,
        (SELECT COUNT(*) FROM sale_items WHERE sale_id = s.id) as item_count
      FROM sales s
      WHERE s.payment_method = 'CREDIT' 
        AND s.customer_id = ?
      ORDER BY s.timestamp DESC
    `, cleanParams([customerId]));
  },
  
  async getCustomerPaymentHistory(customerId: string): Promise<any[]> {
    const db = getDB();
    return await db.getAllAsync<any>(`
      SELECT * FROM utang_payments 
      WHERE customer_id = ?
      ORDER BY timestamp DESC
    `, cleanParams([customerId]));
  },

  async settleCustomerUtang(customerId: string, paymentAmount: number): Promise<void> {
    const db = getDB();
    await db.withTransactionAsync(async () => {
      const customer = await db.getFirstAsync<{name: string}>('SELECT name FROM customers WHERE id = ?', [customerId]);
      const customerName = customer ? customer.name : '';

      const unpaidSales = await db.getAllAsync<any>(`
        SELECT 
          s.id, 
          s.total, 
          s.amount_paid,
          COALESCE((SELECT SUM(amount) FROM utang_payments WHERE sale_id = s.id), 0) as paid_via_payments
        FROM sales s
        WHERE s.payment_method = 'CREDIT' 
          AND s.customer_id = ? 
        ORDER BY s.timestamp ASC
      `, cleanParams([customerId]));

      let remainingPayment = paymentAmount;
      const timestamp = new Date().toISOString();

      for (const sale of unpaidSales) {
        const amtPaid = sale.amount_paid || 0;
        const balance = sale.total - amtPaid - sale.paid_via_payments;
        if (balance > 0.01 && remainingPayment > 0.01) {
          const paymentForThisSale = Math.min(balance, remainingPayment);
          
          const paymentId = 'UPAY_' + Date.now() + Math.random().toString().slice(2, 6);
          await db.runAsync(
            'INSERT INTO utang_payments (id, sale_id, customer_id, customer_name, amount, timestamp, notes) VALUES (?, ?, ?, ?, ?, ?, ?)',
            cleanParams([paymentId, sale.id, customerId, customerName, paymentForThisSale, timestamp, 'Utang Settlement'])
          );

          remainingPayment -= paymentForThisSale;
        }
        if (remainingPayment <= 0.01) break;
      }
    });
  },

  async addLegacyUtang(customerName: string, amount: number, notes: string = ''): Promise<void> {
    const db = getDB();
    const cname = customerName.trim();
    let customerId = '';
    
    await db.withTransactionAsync(async () => {
      const existing = await db.getFirstAsync<{id: string}>('SELECT id FROM customers WHERE name = ? COLLATE NOCASE', [cname]);
      if (existing) {
        customerId = existing.id;
      } else {
        customerId = 'CUS_' + Date.now() + Math.random().toString().slice(2, 6);
        await db.runAsync('INSERT INTO customers (id, name, created_at) VALUES (?, ?, ?)', [customerId, cname, new Date().toISOString()]);
      }
      
      const id = 'SALE_LEGACY_' + Date.now();
      const txnNo = 'OLD-' + Math.floor(Math.random() * 100000);
      const timestamp = new Date().toISOString();
      
      await db.runAsync(
        `INSERT INTO sales (
          id, transaction_no, timestamp, subtotal, item_discounts, transaction_discount, 
          total, payment_method, amount_paid, change_amount, total_cogs, gross_profit, customer_name, customer_id, is_legacy, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        cleanParams([
          id, txnNo, timestamp, amount, 0, 0, 
          amount, 'CREDIT', 0, 0, 0, 0, cname, customerId, 1, notes || ''
        ])
      );
    });
  },

  async getSaleItemsBySaleId(saleId: string | number): Promise<any[]> {
    const db = getDB();
    return await db.getAllAsync(
      `SELECT * FROM sale_items WHERE sale_id = ?`, 
      cleanParams([saleId])
    );
  },

  async getSalesByDate(dateStr: string): Promise<Sale[]> {
    const db = getDB();
    const sales = await db.getAllAsync<Sale>(`
      SELECT * FROM sales
      WHERE DATE(timestamp) = DATE(?) AND (is_legacy IS NULL OR is_legacy = 0)
      ORDER BY timestamp DESC
    `, cleanParams([dateStr]));
    
    for (const sale of sales) {
      if (sale.payment_method !== 'UTANG_PAYMENT') {
        sale.items = await db.getAllAsync<any>(
          'SELECT * FROM sale_items WHERE sale_id = ?',
          cleanParams([sale.id])
        );
      } else {
        sale.items = [];
      }
    }
    
    const utangPayments = await db.getAllAsync<any>(`
      SELECT id, sale_id, timestamp, amount as amount_paid, customer_name, 'UTANG_PAYMENT' as payment_method
      FROM utang_payments
      WHERE DATE(timestamp) = DATE(?)
      ORDER BY timestamp DESC
    `, cleanParams([dateStr]));
    
    const combined = [...sales, ...utangPayments].sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
    
    return combined;
  },

  async getSummaryByDate(dateStr: string) {
    const db = getDB();

    // ── SALES METRICS ────────────────────────────────────────────────────────
    // Only count real sales (CASH + CREDIT). Exclude legacy UTANG_PAYMENT ghost rows
    // that were inserted by the old architecture — those were not real sales and must
    // not inflate Gross Sales, Net Sales, COGS, or Gross Profit.
    //
    // NOTE: Gross Profit INCLUDES utang/credit sales because the profit is earned
    // when goods leave the store, regardless of when cash is collected. A CREDIT sale
    // deducts inventory and records profit at checkout time — this is standard
    // accrual-basis accounting for a POS. The cash collection happens later and is
    // tracked separately via utang_payments.
    const result = await db.getFirstAsync<{
      gross_sales: number;
      net_sales: number;
      discounts: number;
      cogs: number;
      gross_profit: number;
      cash_from_cash_sales: number;   // amount_paid from CASH method sales only
      cash_from_credit_dp: number;    // downpayments collected at CREDIT checkout
      utang_sales_total: number;
      tx_count: number;
    }>(`
      SELECT 
        COALESCE(SUM(CASE WHEN payment_method IN ('CASH', 'CREDIT') THEN subtotal ELSE 0 END), 0)              AS gross_sales,
        COALESCE(SUM(CASE WHEN payment_method IN ('CASH', 'CREDIT') THEN total    ELSE 0 END), 0)              AS net_sales,
        COALESCE(SUM(CASE WHEN payment_method IN ('CASH', 'CREDIT') THEN item_discounts + transaction_discount ELSE 0 END), 0) AS discounts,
        COALESCE(SUM(CASE WHEN payment_method IN ('CASH', 'CREDIT') THEN total_cogs    ELSE 0 END), 0)         AS cogs,
        COALESCE(SUM(CASE WHEN payment_method IN ('CASH', 'CREDIT') THEN gross_profit  ELSE 0 END), 0)         AS gross_profit,
        COALESCE(SUM(CASE WHEN payment_method = 'CASH'              THEN total         ELSE 0 END), 0)         AS cash_from_cash_sales,
        COALESCE(SUM(CASE WHEN payment_method = 'CREDIT'            THEN amount_paid   ELSE 0 END), 0)         AS cash_from_credit_dp,
        COALESCE(SUM(CASE WHEN payment_method = 'CREDIT'            THEN total         ELSE 0 END), 0)         AS utang_sales_total,
        COUNT(CASE WHEN payment_method IN ('CASH', 'CREDIT') THEN id END)                                      AS tx_count
      FROM sales
      WHERE DATE(timestamp) = DATE(?) AND (is_legacy IS NULL OR is_legacy = 0)
    `, cleanParams([dateStr]));

    // ── UTANG PAYMENT CASH ───────────────────────────────────────────────────
    // Payments against old utang recorded in utang_payments table.
    // These are CASH FLOW (not sales) — they increase the cash drawer but do NOT
    // increase Gross Sales, Net Sales, COGS, or Gross Profit.
    const upResult = await db.getFirstAsync<{ cash_from_utang_payments: number }>(`
      SELECT COALESCE(SUM(amount), 0) AS cash_from_utang_payments
      FROM utang_payments
      WHERE DATE(timestamp) = DATE(?)
    `, cleanParams([dateStr]));

    const itemResult = await db.getFirstAsync<{ total_items: number }>(`
      SELECT COALESCE(SUM(si.quantity), 0) AS total_items
      FROM sale_items si
      JOIN sales s ON si.sale_id = s.id
      WHERE DATE(s.timestamp) = DATE(?) AND s.payment_method IN ('CASH', 'CREDIT') AND (s.is_legacy IS NULL OR s.is_legacy = 0)
    `, cleanParams([dateStr]));

    const cashSales = result?.cash_from_cash_sales ?? 0;
    const utangSales = result?.utang_sales_total ?? 0;
    const utangPayments = upResult?.cash_from_utang_payments ?? 0;

    const cashCollected = cashSales + (result?.cash_from_credit_dp ?? 0) + utangPayments;

    return {
      grossSales:    result?.gross_sales   ?? 0,
      netSales:      result?.net_sales     ?? 0,
      discounts:     result?.discounts     ?? 0,
      cogs:          result?.cogs          ?? 0,
      grossProfit:   result?.gross_profit  ?? 0,
      cashCollected,
      cashSales,
      utangSales,
      utangPayments,
      txCount:       result?.tx_count      ?? 0,
      totalItemsSold: itemResult?.total_items ?? 0,
    };
  },

  async getSales(limit = 50): Promise<any[]> {
    const db = getDB();
    const sales = await db.getAllAsync<any>(`
      SELECT id, transaction_no, timestamp, subtotal, item_discounts, transaction_discount, total, payment_method, amount_paid, change_amount, total_cogs, gross_profit, customer_name
      FROM sales WHERE is_legacy IS NULL OR is_legacy = 0
      UNION ALL
      SELECT id, 'PAY-' || substr(id, 6, 8) as transaction_no, timestamp, 0 as subtotal, 0 as item_discounts, 0 as transaction_discount, 0 as total, 'UTANG_PAYMENT' as payment_method, amount as amount_paid, 0 as change_amount, 0 as total_cogs, 0 as gross_profit, customer_name
      FROM utang_payments
      ORDER BY timestamp DESC LIMIT ?
    `, cleanParams([limit]));

    for (const sale of sales) {
      if (sale.payment_method !== 'UTANG_PAYMENT') {
        sale.items = await db.getAllAsync<any>(
          'SELECT * FROM sale_items WHERE sale_id = ?',
          cleanParams([sale.id])
        );
      } else {
        sale.items = [];
      }
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
    const utangPayments = await db.getAllAsync('SELECT * FROM utang_payments');
    const saleItems = await db.getAllAsync('SELECT * FROM sale_items');
    const stockAdjustments = await db.getAllAsync('SELECT * FROM stock_adjustments');
    const settings = await db.getAllAsync('SELECT * FROM settings');
    const cashDrawerSessions = await db.getAllAsync('SELECT * FROM cash_drawer_sessions');
    const storeExpenses = await db.getAllAsync('SELECT * FROM store_expenses');

    return JSON.stringify({
      version: 5,
      timestamp: new Date().toISOString(),
      data: { categories, products, sales, utangPayments, saleItems, stockAdjustments, settings, cashDrawerSessions, storeExpenses }
    }, null, 2);
  },

  async importDatabaseJSON(jsonStr: string): Promise<void> {
    const parsed = JSON.parse(jsonStr);
    const db = getDB();
    
    // Preliminary validation
    if (!parsed || !parsed.data) throw new Error('Invalid backup file structure.');

    await db.withTransactionAsync(async () => {
      await db.runAsync('DELETE FROM store_expenses');
      await db.runAsync('DELETE FROM cash_drawer_sessions');
      await db.runAsync('DELETE FROM utang_payments');
      await db.runAsync('DELETE FROM sale_items');
      await db.runAsync('DELETE FROM sales');
      await db.runAsync('DELETE FROM stock_adjustments');
      await db.runAsync('DELETE FROM products');
      await db.runAsync('DELETE FROM categories');
      await db.runAsync('DELETE FROM settings');

      if (parsed.data) {
        const { categories = [], products = [], sales = [], utangPayments = [], saleItems = [], stockAdjustments = [], settings = [], cashDrawerSessions = [], storeExpenses = [] } = parsed.data;
        for (const c of categories) await db.runAsync('INSERT INTO categories (id, name) VALUES (?, ?)', cleanParams([c.id, c.name]));
        for (const p of products) await db.runAsync('INSERT INTO products (id, barcode, name, category_id, pricing_type, unit_piece_name, unit_pack_name, pieces_per_pack, buying_price_piece, buying_price_pack, selling_price_piece, selling_price_pack, stock_pieces, min_stock_pieces, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', cleanParams([p.id, p.barcode, p.name, p.category_id, p.pricing_type, p.unit_piece_name, p.unit_pack_name, p.pieces_per_pack, p.buying_price_piece, p.buying_price_pack, p.selling_price_piece, p.selling_price_pack, p.stock_pieces, p.min_stock_pieces, p.is_active]));
        for (const s of sales) await db.runAsync('INSERT INTO sales (id, transaction_no, timestamp, subtotal, item_discounts, transaction_discount, total, payment_method, amount_paid, change_amount, total_cogs, gross_profit, customer_name, customer_id, is_legacy) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', cleanParams([s.id, s.transaction_no, s.timestamp, s.subtotal, s.item_discounts, s.transaction_discount, s.total, s.payment_method, s.amount_paid, s.change_amount, s.total_cogs, s.gross_profit, s.customer_name, s.is_legacy || 0]));
        for (const up of utangPayments) await db.runAsync('INSERT INTO utang_payments (id, sale_id, customer_name, amount, timestamp, notes) VALUES (?, ?, ?, ?, ?, ?)', cleanParams([up.id, up.sale_id, up.customer_name, up.amount, up.timestamp, up.notes]));
        for (const si of saleItems) await db.runAsync('INSERT INTO sale_items (id, sale_id, product_id, product_name, unit_type, buying_price_unit, selling_price_unit, quantity, discount, subtotal) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', cleanParams([si.id, si.sale_id, si.product_id, si.product_name, si.unit_type, si.buying_price_unit, si.selling_price_unit, si.quantity, si.discount, si.subtotal]));
        for (const sa of stockAdjustments) await db.runAsync('INSERT INTO stock_adjustments (id, product_id, previous_stock_pieces, change_qty_pieces, new_stock_pieces, reason, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?)', cleanParams([sa.id, sa.product_id, sa.previous_stock_pieces, sa.change_qty_pieces, sa.new_stock_pieces, sa.reason, sa.timestamp]));
        for (const st of settings) await db.runAsync('INSERT INTO settings (key, value) VALUES (?, ?)', cleanParams([st.key, st.value]));
        for (const cds of cashDrawerSessions) await db.runAsync('INSERT INTO cash_drawer_sessions (id, opened_at, closed_at, opening_cash, expected_cash, actual_cash, variance, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', cleanParams([cds.id, cds.opened_at, cds.closed_at, cds.opening_cash, cds.expected_cash, cds.actual_cash, cds.variance, cds.status]));
        for (const se of storeExpenses) await db.runAsync('INSERT INTO store_expenses (id, type, amount, description, timestamp, cash_drawer_session_id) VALUES (?, ?, ?, ?, ?, ?)', cleanParams([se.id, se.type, se.amount, se.description, se.timestamp, se.cash_drawer_session_id]));
      }
    });
  },

  // ==========================================
  // CASH DRAWER & EXPENSES
  // ==========================================
  async getCurrentCashDrawerSession(): Promise<any | null> {
    const db = getDB();
    return await db.getFirstAsync<any>(
      `SELECT * FROM cash_drawer_sessions WHERE status = 'OPEN' ORDER BY opened_at DESC LIMIT 1`
    );
  },

  async getClosedCashDrawerSessions(): Promise<any[]> {
    const db = getDB();
    return await db.getAllAsync<any>(
      `SELECT * FROM cash_drawer_sessions WHERE status = 'CLOSED' ORDER BY closed_at DESC LIMIT 50`
    );
  },

  async openCashDrawerSession(openingCash: number): Promise<void> {
    const db = getDB();
    const current = await this.getCurrentCashDrawerSession();
    if (current) {
      throw new Error('A cash drawer session is already open.');
    }
    const id = 'CD_' + Date.now();
    await db.runAsync(
      `INSERT INTO cash_drawer_sessions (id, opened_at, opening_cash, expected_cash, actual_cash, variance, status)
       VALUES (?, ?, ?, 0, 0, 0, 'OPEN')`,
      cleanParams([id, new Date().toISOString(), openingCash])
    );
  },

  async closeCashDrawerSession(sessionId: string, expectedCash: number, actualCash: number, variance: number): Promise<void> {
    const db = getDB();
    await db.runAsync(
      `UPDATE cash_drawer_sessions SET closed_at = ?, expected_cash = ?, actual_cash = ?, variance = ?, status = 'CLOSED' WHERE id = ?`,
      cleanParams([new Date().toISOString(), expectedCash, actualCash, variance, sessionId])
    );
  },

  async addStoreExpense(type: 'EXPENSE' | 'WITHDRAWAL' | 'CASH_IN' | 'ADJUSTMENT', amount: number, description: string): Promise<void> {
    const db = getDB();
    const currentSession = await this.getCurrentCashDrawerSession();
    const sessionId = currentSession ? currentSession.id : null;
    const id = 'EXP_' + Date.now();
    
    await db.runAsync(
      `INSERT INTO store_expenses (id, type, amount, description, timestamp, cash_drawer_session_id)
       VALUES (?, ?, ?, ?, ?, ?)`,
      cleanParams([id, type, amount, description, new Date().toISOString(), sessionId])
    );
  },

  async getStoreExpensesBySession(sessionId: string): Promise<any[]> {
    const db = getDB();
    return await db.getAllAsync<any>(
      `SELECT * FROM store_expenses WHERE cash_drawer_session_id = ? ORDER BY timestamp DESC`,
      cleanParams([sessionId])
    );
  },

  async getStoreExpensesByDate(dateStr: string): Promise<any[]> {
    const db = getDB();
    return await db.getAllAsync<any>(
      `SELECT * FROM store_expenses WHERE DATE(timestamp) = DATE(?) ORDER BY timestamp DESC`,
      cleanParams([dateStr])
    );
  }
};