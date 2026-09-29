import React, { createContext, useContext, useEffect, useState } from 'react';
import { Alert } from 'react-native';
import { dbService } from '../database/databaseService';
import { initDatabase } from '../database/db';
import { CartItem, Category, Product, Sale, StoreSettings, UnitType } from '../types';

interface POSContextType {
  products: Product[];
  categories: Category[];
  cart: CartItem[];
  settings: StoreSettings;
  selectedCategory: string | null;
  searchQuery: string;
  transactionDiscount: number;
  isLoading: boolean;
  setSearchQuery: (q: string) => void;
  setSelectedCategory: (catId: string | null) => void;
  addToCart: (product: Product, unitType: UnitType) => void;
  updateCartQuantity: (cartItemId: string, quantity: number) => void;
  updateCartDiscount: (cartItemId: string, discount: number) => void;
  removeFromCart: (cartItemId: string) => void;
  setTransactionDiscount: (amt: number) => void;
  clearCart: () => void;
  // UPDATED: Checkout signature now supports Utang (CREDIT) and customerName
  checkout: (paymentMethod: 'CASH' | 'CREDIT', amountPaid: number, customerName?: string) => Promise<Sale | null>;
  refreshInventory: () => Promise<void>;
  refreshCategories: () => Promise<void>;
  updateStoreSettings: (newSettings: StoreSettings) => Promise<void>;
  toggleTheme: () => Promise<void>;
  lastTransactionTimestamp: number;
  
  // Cash Drawer
  cashDrawerSession: any | null;
  openCashDrawer: (amount: number) => Promise<void>;
  closeCashDrawer: (expected: number, actual: number, variance: number) => Promise<void>;
  addExpense: (type: 'EXPENSE' | 'WITHDRAWAL' | 'CASH_IN' | 'ADJUSTMENT', amount: number, description: string) => Promise<void>;
}

const defaultSettings: StoreSettings = {
  store_name: 'SariPos Store',
  store_address: 'Barangay Center, PH',
  store_phone: '09123456789',
  receipt_header: 'Welcome to our store!',
  receipt_footer: 'Maraming Salamat Po!',
  currency_symbol: '₱',
  theme: 'dark',
  low_stock_threshold: '10',
  tax_rate: '0',
  default_opening_cash: '0'
};

const POSContext = createContext<POSContextType | undefined>(undefined);

export const POSProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [settings, setSettings] = useState<StoreSettings>(defaultSettings);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [transactionDiscount, setTransactionDiscount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [lastTransactionTimestamp, setLastTransactionTimestamp] = useState(Date.now());
  
  const [cashDrawerSession, setCashDrawerSession] = useState<any | null>(null);

  const loadData = async () => {
    try {
      setIsLoading(true);
      await initDatabase();
      const [prods, cats, loadedSettings, cdSession] = await Promise.all([
        dbService.getProducts(),
        dbService.getCategories(),
        dbService.getSettings(),
        dbService.getCurrentCashDrawerSession()
      ]);
      setProducts(prods);
      setCategories(cats);
      setCashDrawerSession(cdSession);
      // Only override defaults if the loaded settings object isn't empty
      if (loadedSettings && Object.keys(loadedSettings).length > 0) {
        setSettings(prev => ({ ...prev, ...loadedSettings }));
      }
    } catch (e: any) {
      Alert.alert('Database Error', e.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const openCashDrawer = async (amount: number) => {
    await dbService.openCashDrawerSession(amount);
    await loadData();
  };

  const closeCashDrawer = async (expected: number, actual: number, variance: number) => {
    if (cashDrawerSession) {
      await dbService.closeCashDrawerSession(cashDrawerSession.id, expected, actual, variance);
      await loadData();
    }
  };

  const addExpense = async (type: 'EXPENSE' | 'WITHDRAWAL' | 'CASH_IN' | 'ADJUSTMENT', amount: number, description: string) => {
    await dbService.addStoreExpense(type, amount, description);
    await loadData();
    setLastTransactionTimestamp(Date.now());
  };

  const updateStoreSettings = async (newSettings: StoreSettings) => {
    try {
      await dbService.updateSettings(newSettings);
      setSettings(newSettings);
    } catch (e: any) {
      Alert.alert('Settings Save Error', e.message);
    }
  };

  const toggleTheme = async () => {
    const updatedTheme = settings.theme === 'dark' ? 'light' : 'dark';
    const updated = { ...settings, theme: updatedTheme as 'dark' | 'light' };
    await updateStoreSettings(updated);
  };

  const addToCart = (product: Product, unitType: UnitType) => {
    if (!cashDrawerSession) {
      Alert.alert('Shift Closed', 'Please open the Cash Drawer to start selling.');
      return;
    }

    const requiredPieces = unitType === 'PACK' ? product.pieces_per_pack : 1;

    const currentCartPieces = cart
      .filter(item => item.product.id === product.id)
      .reduce((sum, item) => sum + (item.unitType === 'PACK' ? item.quantity * item.product.pieces_per_pack : item.quantity), 0);

    if (currentCartPieces + requiredPieces > product.stock_pieces) {
      Alert.alert('Stock Limit Reached', `Only ${product.stock_pieces} ${product.unit_piece_name} available in stock.`);
      return;
    }

    const unitPrice = unitType === 'PACK' ? product.selling_price_pack : product.selling_price_piece;
    const cartItemId = `${product.id}_${unitType}`;

    setCart(prevCart => {
      const existing = prevCart.find(item => item.id === cartItemId);
      if (existing) {
        return prevCart.map(item =>
          item.id === cartItemId
            ? { ...item, quantity: item.quantity + 1, itemSubtotal: ((item.quantity + 1) * unitPrice) - item.discount }
            : item
        );
      }
      return [
        ...prevCart,
        { id: cartItemId, product, unitType, quantity: 1, unitPrice, discount: 0, itemSubtotal: unitPrice }
      ];
    });
  };

  const updateCartQuantity = (cartItemId: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(cartItemId);
      return;
    }

    const item = cart.find(i => i.id === cartItemId);
    if (!item) return;

    const otherLinesPieces = cart
      .filter(i => i.product.id === item.product.id && i.id !== cartItemId)
      .reduce((sum, i) => sum + (i.unitType === 'PACK' ? i.quantity * i.product.pieces_per_pack : i.quantity), 0);

    const newPiecesReq = item.unitType === 'PACK' ? quantity * item.product.pieces_per_pack : quantity;

    if (otherLinesPieces + newPiecesReq > item.product.stock_pieces) {
      Alert.alert('Stock Limit Exceeded', `Only ${item.product.stock_pieces} ${item.product.unit_piece_name} available in stock.`);
      return;
    }

    setCart(prevCart =>
      prevCart.map(i =>
        i.id === cartItemId
          ? { ...i, quantity, itemSubtotal: (quantity * i.unitPrice) - i.discount }
          : i
      )
    );
  };

  const updateCartDiscount = (cartItemId: string, discount: number) => {
    setCart(prevCart =>
      prevCart.map(i => {
        if (i.id === cartItemId) {
          const maxDiscount = i.unitPrice * i.quantity;
          const validDiscount = Math.min(Math.max(0, discount), maxDiscount);
          return { ...i, discount: validDiscount, itemSubtotal: (i.unitPrice * i.quantity) - validDiscount };
        }
        return i;
      })
    );
  };

  const removeFromCart = (cartItemId: string) => {
    setCart(prevCart => prevCart.filter(item => item.id !== cartItemId));
  };

  const clearCart = () => {
    setCart([]);
    setTransactionDiscount(0);
  };

  // FIXED: Now supports 'CREDIT' and customerName for the Utang feature
  const checkout = async (
    paymentMethod: 'CASH' | 'CREDIT', 
    amountPaid: number, 
    customerName?: string
  ): Promise<Sale | null> => {
    if (!cashDrawerSession) {
      Alert.alert('Shift Closed', 'Please open the Cash Drawer to process sales.');
      return null;
    }

    try {
      const sale = await dbService.processSale(cart, transactionDiscount, paymentMethod, amountPaid, customerName);
      clearCart();
      await loadData();
      setLastTransactionTimestamp(Date.now());
      return sale;
    } catch (err: any) {
      Alert.alert('Checkout Error', err.message || 'Transaction failed.');
      return null;
    }
  };

  return (
    <POSContext.Provider
      value={{
        products,
        categories,
        cart,
        settings,
        selectedCategory,
        searchQuery,
        transactionDiscount,
        isLoading,
        setSearchQuery,
        setSelectedCategory,
        addToCart,
        updateCartQuantity,
        updateCartDiscount,
        removeFromCart,
        setTransactionDiscount,
        clearCart,
        checkout,
        refreshInventory: loadData,
        refreshCategories: loadData,
        updateStoreSettings,
        toggleTheme,
        lastTransactionTimestamp,
        cashDrawerSession,
        openCashDrawer,
        closeCashDrawer,
        addExpense
      }}
    >
      {children}
    </POSContext.Provider>
  );
};

export const usePOS = () => {
  const ctx = useContext(POSContext);
  if (!ctx) throw new Error('usePOS must be used within POSProvider');
  return ctx;
};