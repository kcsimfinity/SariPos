import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { FlatList, KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { CheckoutModal } from '../components/CheckoutModal';
import { ReceiptModal } from '../components/ReceiptModal';
import { usePOS } from '../context/POSContext';
import { getTheme } from '../theme/theme';
import { Product, Sale } from '../types';

export const POSScreen: React.FC = () => {
  const {
    products, categories, cart, selectedCategory, searchQuery, transactionDiscount, settings,
    setSearchQuery, setSelectedCategory, addToCart, updateCartQuantity, updateCartDiscount,
    removeFromCart, setTransactionDiscount, clearCart
  } = usePOS();

  const theme = getTheme(settings.theme === 'dark');
  const { width, height } = useWindowDimensions();
  const isPortrait = height > width;

  const [checkoutVisible, setCheckoutVisible] = useState(false);
  const [completedSale, setCompletedSale] = useState<Sale | null>(null);
  const [cartModalVisible, setCartModalVisible] = useState(false); // For portrait mode
  const [globalDiscountInput, setGlobalDiscountInput] = useState(transactionDiscount > 0 ? transactionDiscount.toString() : '');

  const cartSubtotal = cart.reduce((acc, item) => acc + (item.unitPrice * item.quantity), 0);
  const totalItemDiscounts = cart.reduce((acc, item) => acc + item.discount, 0);
  const finalTotal = Math.max(0, cartSubtotal - totalItemDiscounts - transactionDiscount);

  const filteredProducts = products.filter(p => {
    const matchesCategory = selectedCategory ? p.category_id === selectedCategory : true;
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (p.barcode && p.barcode.includes(searchQuery));
    return matchesCategory && matchesSearch;
  });

  const handleGlobalDiscountChange = (val: string) => {
    setGlobalDiscountInput(val);
    const parsed = parseFloat(val);
    if (!isNaN(parsed) && parsed >= 0) {
      setTransactionDiscount(parsed);
    } else {
      setTransactionDiscount(0);
    }
  };

  const renderProduct = ({ item }: { item: Product }) => {
    const isLowStock = item.stock_pieces <= item.min_stock_pieces;
    const isOutOfStock = item.stock_pieces < 1;
    const hasPack = item.pricing_type === 'PACK' && item.pieces_per_pack > 0;
    const outOfStockPack = hasPack && item.stock_pieces < item.pieces_per_pack;

    return (
      <View style={[styles.productRow, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <View style={{ flex: 1, paddingRight: 8 }}>
          <Text style={[styles.productName, { color: theme.textPrimary }]} numberOfLines={2}>
            {item.name}
          </Text>
          <View style={{ marginTop: 4, alignSelf: 'flex-start' }}>
            <View style={[styles.stockBadge, { backgroundColor: isOutOfStock ? theme.dangerGlow : isLowStock ? theme.warningGlow : theme.surfaceElevated }]}>
              <Text style={[styles.stockBadgeText, { color: isOutOfStock ? theme.danger : isLowStock ? theme.warning : theme.textSecondary }]}>
                Stock {item.stock_pieces}
              </Text>
            </View>
          </View>
        </View>
        
        <View style={styles.unitOptionsGroup}>
          <TouchableOpacity
            style={[styles.unitBtn, { backgroundColor: theme.bg, borderColor: theme.border }, isOutOfStock && styles.disabledBtn]}
            disabled={isOutOfStock}
            onPress={() => addToCart(item, 'PIECE')}
            activeOpacity={0.7}
          >
            <Text style={[styles.unitBtnLabel, { color: theme.textSecondary }]} numberOfLines={1}>{item.unit_piece_name || 'Pc'}</Text>
            <Text style={[styles.unitBtnPrice, { color: theme.textPrimary }]}>₱{item.selling_price_piece.toFixed(2)}</Text>
          </TouchableOpacity>

          {hasPack && (
            <TouchableOpacity
              style={[styles.unitBtn, { backgroundColor: theme.bg, borderColor: theme.border }, outOfStockPack && styles.disabledBtn]}
              disabled={outOfStockPack}
              onPress={() => addToCart(item, 'PACK')}
              activeOpacity={0.7}
            >
              <Text style={[styles.unitBtnLabel, { color: theme.textSecondary }]} numberOfLines={1}>{item.unit_pack_name || 'Pk'}</Text>
              <Text style={[styles.unitBtnPrice, { color: theme.textPrimary }]}>₱{item.selling_price_pack.toFixed(2)}</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  const CartContent = () => (
    <View style={styles.cartContainer}>
      <View style={[styles.cartHeader, { borderBottomColor: theme.border }]}>
        <Text style={[styles.cartTitle, { color: theme.textPrimary }]}>Cart · {cart.length} items</Text>
        <TouchableOpacity onPress={() => { clearCart(); setGlobalDiscountInput(''); }} disabled={cart.length === 0} style={{ padding: 4 }}>
          <Text style={[styles.clearText, cart.length === 0 && { opacity: 0.4 }]}>Clear</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={cart}
        keyExtractor={item => item.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ flexGrow: 1, paddingVertical: 4 }}
        ListEmptyComponent={
          <View style={styles.emptyCart}>
            <Ionicons name="cart-outline" size={32} color={theme.textMuted} />
            <Text style={[styles.emptyCartText, { color: theme.textMuted }]}>Cart empty</Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={[styles.cartRow, { borderBottomColor: theme.border }]}>
            <View style={styles.cartRowTop}>
              <View style={{ flex: 1, paddingRight: 6 }}>
                <Text style={[styles.cartItemName, { color: theme.textPrimary }]} numberOfLines={2}>
                  {item.product.name}
                </Text>
                <Text style={[styles.cartItemMeta, { color: theme.textSecondary }]}>
                  {item.unitType === 'PACK' ? (item.product.unit_pack_name || 'Pack') : (item.product.unit_piece_name || 'Piece')} • ₱{item.unitPrice.toFixed(2)}
                </Text>
              </View>

              <View style={styles.cartQtyControls}>
                <TouchableOpacity style={[styles.qtyBtn, { backgroundColor: theme.surfaceElevated }]} onPress={() => updateCartQuantity(item.id, item.quantity - 1)}>
                  <Ionicons name="remove" size={14} color={theme.textPrimary} />
                </TouchableOpacity>
                <Text style={[styles.qtyText, { color: theme.textPrimary }]}>{item.quantity}</Text>
                <TouchableOpacity style={[styles.qtyBtn, { backgroundColor: theme.surfaceElevated }]} onPress={() => updateCartQuantity(item.id, item.quantity + 1)}>
                  <Ionicons name="add" size={14} color={theme.textPrimary} />
                </TouchableOpacity>
              </View>

              <Text style={[styles.cartItemTotal, { color: theme.textPrimary }]}>
                ₱{((item.unitPrice * item.quantity) - item.discount).toFixed(2)}
              </Text>
            </View>
          </View>
        )}
      />

      <View style={[styles.checkoutSummary, { borderTopColor: theme.border, backgroundColor: theme.surface }]}>
        <View style={styles.summaryRow}>
          <Text style={{ color: theme.textSecondary, fontSize: 12 }}>Subtotal</Text>
          <Text style={{ color: theme.textPrimary, fontSize: 13, fontWeight: '700' }}>₱{cartSubtotal.toFixed(2)}</Text>
        </View>
        
        <View style={styles.globalDiscountRow}>
          <Text style={{ color: theme.textSecondary, fontSize: 12 }}>Discount (₱)</Text>
          <TextInput
            style={[styles.globalDiscountInput, { backgroundColor: theme.bg, color: theme.danger, borderColor: theme.border }]}
            keyboardType="numeric"
            placeholder="0.00"
            placeholderTextColor={theme.textMuted}
            value={globalDiscountInput}
            onChangeText={handleGlobalDiscountChange}
          />
        </View>

        <View style={[styles.summaryRow, styles.totalRow, { borderTopColor: theme.border }]}>
          <Text style={{ color: theme.textPrimary, fontSize: 14, fontWeight: '800' }}>TOTAL</Text>
          <Text style={{ color: theme.success, fontSize: 18, fontWeight: '800' }}>₱{finalTotal.toFixed(2)}</Text>
        </View>

        <TouchableOpacity
          style={[styles.checkoutBtn, { backgroundColor: theme.success }, cart.length === 0 && styles.disabledBtn]}
          disabled={cart.length === 0}
          onPress={() => {
            if (isPortrait) setCartModalVisible(false);
            setCheckoutVisible(true);
          }}
          activeOpacity={0.8}
        >
          <Text style={styles.checkoutBtnText}>CHECKOUT</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.bg, flexDirection: isPortrait ? 'column' : 'row' }]}>
      
      {/* CATALOG AREA */}
      <View style={[styles.catalogSection, !isPortrait && { borderRightColor: theme.border, borderRightWidth: 1 }]}>
        <View style={[styles.searchBar, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Ionicons name="search" size={18} color={theme.textSecondary} />
          <TextInput
            style={[styles.searchInput, { color: theme.textPrimary }]}
            placeholder="Search item or barcode..."
            placeholderTextColor={theme.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery !== '' && (
            <TouchableOpacity style={{ padding: 4 }} onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={16} color={theme.textMuted} />
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.categoryWrapper}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryScroll}>
            <TouchableOpacity
              style={[
                styles.chip,
                { backgroundColor: theme.surface, borderColor: theme.border },
                selectedCategory === null && { backgroundColor: theme.primary, borderColor: theme.primary }
              ]}
              onPress={() => setSelectedCategory(null)}
            >
              <Text style={[styles.chipText, { color: selectedCategory === null ? '#ffffff' : theme.textSecondary }]}>All</Text>
            </TouchableOpacity>

            {categories.map(cat => (
              <TouchableOpacity
                key={cat.id}
                style={[
                  styles.chip,
                  { backgroundColor: theme.surface, borderColor: theme.border },
                  selectedCategory === cat.id && { backgroundColor: theme.primary, borderColor: theme.primary }
                ]}
                onPress={() => setSelectedCategory(cat.id)}
              >
                <Text style={[styles.chipText, { color: selectedCategory === cat.id ? '#ffffff' : theme.textSecondary }]}>
                  {cat.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        <FlatList
          data={filteredProducts}
          keyExtractor={item => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: isPortrait ? 100 : 24, paddingHorizontal: 4 }}
          renderItem={renderProduct}
        />
      </View>

      {/* CART AREA */}
      {!isPortrait ? (
        <View style={[styles.cartSection, { backgroundColor: theme.surface, width: 280 }]}>
          <CartContent />
        </View>
      ) : (
        /* Floating Cart Summary for Portrait */
        <View style={[styles.floatingCart, { backgroundColor: theme.surface, borderTopColor: theme.border }]}>
          <TouchableOpacity style={styles.floatingCartBtn} onPress={() => setCartModalVisible(true)} activeOpacity={0.8}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Ionicons name="cart" size={24} color={cart.length > 0 ? theme.primary : theme.textMuted} />
              <Text style={{ fontSize: 16, fontWeight: '700', color: theme.textPrimary }}>
                {cart.length} items
              </Text>
              <Text style={{ fontSize: 16, color: theme.textMuted }}>·</Text>
              <Text style={[styles.floatingTotal, { color: theme.textPrimary }]}>₱{finalTotal.toFixed(2)}</Text>
            </View>
            <View style={[styles.checkoutActionBtn, { backgroundColor: cart.length > 0 ? theme.primary : theme.border }]}>
              <Text style={{ color: cart.length > 0 ? '#fff' : theme.textMuted, fontWeight: '800' }}>Review</Text>
            </View>
          </TouchableOpacity>
        </View>
      )}

      {/* Cart Modal for Portrait */}
      <Modal visible={cartModalVisible} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={[styles.cartModal, { backgroundColor: theme.surface }]}>
            <View style={styles.cartModalHandle} />
            <View style={styles.cartModalHeader}>
              <TouchableOpacity onPress={() => setCartModalVisible(false)} style={{ padding: 4 }}>
                <Ionicons name="close" size={24} color={theme.textPrimary} />
              </TouchableOpacity>
            </View>
            <CartContent />
          </KeyboardAvoidingView>
        </View>
      </Modal>

      <CheckoutModal
        visible={checkoutVisible}
        totalAmount={finalTotal}
        onClose={() => setCheckoutVisible(false)}
        onSuccess={sale => {
          setCheckoutVisible(false);
          setCompletedSale(sale);
        }}
      />

      <ReceiptModal sale={completedSale} onClose={() => setCompletedSale(null)} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  catalogSection: { flex: 1, padding: 10 },
  searchBar: { flexDirection: 'row', alignItems: 'center', borderRadius: 12, paddingHorizontal: 12, height: 48, borderWidth: 1, marginBottom: 12 },
  searchInput: { flex: 1, marginLeft: 8, fontSize: 15 },
  categoryWrapper: { marginBottom: 12 },
  categoryScroll: { gap: 8, alignItems: 'center' },
  chip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
  chipText: { fontSize: 13, fontWeight: '700' },
  
  productRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginVertical: 4, borderRadius: 8, padding: 8, paddingLeft: 12, borderWidth: 1, minHeight: 56 },
  productName: { fontSize: 14, fontWeight: '700' },
  unitOptionsGroup: { flexDirection: 'row', gap: 6 },
  unitBtn: { width: 64, height: 48, borderRadius: 6, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
  unitBtnLabel: { fontSize: 11, fontWeight: '600', marginBottom: 2 },
  unitBtnPrice: { fontSize: 13, fontWeight: '800' },
  stockBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  stockBadgeText: { fontSize: 10, fontWeight: '800' },
  disabledBtn: { opacity: 0.4 },
  
  cartSection: { padding: 0 },
  cartContainer: { flex: 1, padding: 12 },
  cartHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 8, borderBottomWidth: 1 },
  cartTitle: { fontSize: 15, fontWeight: '800' },
  clearText: { color: '#ef4444', fontSize: 13, fontWeight: 'bold' },
  emptyCart: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12, minHeight: 200 },
  emptyCartText: { fontSize: 15, fontWeight: '600' },
  
  cartRow: { paddingVertical: 8, borderBottomWidth: 1 },
  cartRowTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cartItemName: { fontSize: 13, fontWeight: '700', lineHeight: 16 },
  cartItemMeta: { fontSize: 12, marginTop: 1 },
  cartQtyControls: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  qtyBtn: { width: 24, height: 24, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  qtyText: { fontSize: 13, fontWeight: '800', minWidth: 16, textAlign: 'center' },
  cartItemTotal: { fontSize: 13, fontWeight: '800', width: 60, textAlign: 'right' },
  
  checkoutSummary: { paddingTop: 10, marginTop: 'auto', gap: 6 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  globalDiscountRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginVertical: 4 },
  globalDiscountInput: { width: 100, height: 36, borderRadius: 6, borderWidth: 1, paddingHorizontal: 10, fontSize: 15, fontWeight: '800', textAlign: 'right' },
  totalRow: { paddingTop: 8, borderTopWidth: 1, marginTop: 4 },
  
  checkoutBtn: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, paddingVertical: 12, borderRadius: 8, marginTop: 8 },
  checkoutBtnText: { color: '#ffffff', fontSize: 14, fontWeight: '800', letterSpacing: 0.5 },
  checkoutActionBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 },
  
  floatingCart: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 12, borderTopWidth: 1, elevation: 10 },
  floatingCartBtn: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 8 },
  floatingBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
  floatingBadgeText: { color: '#fff', fontSize: 14, fontWeight: '900' },
  floatingTotal: { fontSize: 18, fontWeight: '900' },
  
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  cartModal: { height: '80%', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 0 },
  cartModalHandle: { width: 40, height: 4, backgroundColor: '#cbd5e1', borderRadius: 2, alignSelf: 'center', marginTop: 12 },
  cartModalHeader: { flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: 16, paddingTop: 4 },
});