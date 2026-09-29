export interface Category {
  id: string;
  name: string;
}

export type UnitType = 'PIECE' | 'PACK';
export type PricingType = 'PIECE' | 'PACK';
export type AppTheme = 'dark' | 'light';

export interface Product {
  id: string;
  barcode?: string;
  name: string;
  category_id: string;
  category_name?: string;
  pricing_type: PricingType;
  unit_piece_name: string;
  unit_pack_name: string;
  pieces_per_pack: number;
  buying_price_piece: number;
  buying_price_pack: number;
  selling_price_piece: number;
  selling_price_pack: number;
  stock_pieces: number;
  min_stock_pieces: number;
  is_active: number;
  created_at?: string;
  updated_at?: string;
}

export interface CartItem {
  id: string;
  product: Product;
  unitType: UnitType;
  quantity: number;
  unitPrice: number;
  discount: number;
  itemSubtotal: number;
}

export interface Sale {
  id: string;
  transaction_no: string;
  timestamp: string;
  subtotal: number;
  item_discounts: number;
  transaction_discount: number;
  total: number;
  // FIXED: Aligned with Utang logic ('CASH' or 'CREDIT' or 'UTANG_PAYMENT' for history display)
  payment_method: 'CASH' | 'CREDIT' | 'UTANG_PAYMENT'; 
  amount_paid: number;
  change_amount: number;
  total_cogs: number;
  gross_profit: number;
  // FIXED: Added customer_name to track who owes Utang
  customer_name?: string; 
  customer_id?: string;
  is_legacy?: number;
  remaining_balance?: number;
  items?: SaleItem[];
}

export interface SaleItem {
  id: string;
  sale_id: string;
  product_id: string;
  product_name: string;
  unit_type: UnitType;
  buying_price_unit: number;
  selling_price_unit: number;
  quantity: number;
  discount: number;
  subtotal: number;
}

export interface StockAdjustment {
  id: string;
  product_id: string;
  previous_stock_pieces: number;
  change_qty_pieces: number;
  new_stock_pieces: number;
  reason: string;
  timestamp: string;
}

export interface StoreSettings {
  store_name: string;
  store_address: string;
  store_phone: string;
  receipt_header: string;
  receipt_footer: string;
  currency_symbol: string;
  theme: AppTheme;
  low_stock_threshold: string;
  tax_rate: string;
  default_opening_cash?: string;
}

export interface CashDrawerSession {
  id: string;
  opened_at: string;
  closed_at: string | null;
  opening_cash: number;
  expected_cash: number;
  actual_cash: number;
  variance: number;
  status: 'OPEN' | 'CLOSED';
}

export interface StoreExpense {
  id: string;
  type: 'EXPENSE' | 'WITHDRAWAL' | 'CASH_IN' | 'ADJUSTMENT';
  amount: number;
  description: string;
  timestamp: string;
  cash_drawer_session_id: string | null;
}