import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet, ScrollView } from 'react-native';
import { usePOS } from '../context/POSContext';
import { Sale } from '../types';
import { CheckoutModal } from '../components/CheckoutModal';
import { ReceiptModal } from '../components/ReceiptModal';
import { Ionicons } from '@expo/vector-icons';
import { getTheme } from '../theme/theme';

export const POSScreen: React.FC = () => {
  const {
    products,
    categories,
    cart,
    selectedCategory,
    searchQuery,
    transactionDiscount,
    settings,
    setSearchQuery,
    setSelectedCategory,
    addToCart,
    updateCartQuantity,
    removeFromCart,
    clearCart
  } = usePOS();

  const theme = getTheme(settings.theme === 'dark');

  const [checkoutVisible, setCheckoutVisible] = useState(false);
  const [completedSale, setCompletedSale] = useState<Sale | null>(null);

  // Cart Calculations
  const cartSubtotal = cart.reduce((acc, item) => acc + (item.unitPrice * item.quantity), 0);
  const totalItemDiscounts = cart.reduce((acc, item) => acc + item.discount, 0);
  const finalTotal = Math.max(0, cartSubtotal - totalItemDiscounts - transactionDiscount);

  // Filter Logic
  const filteredProducts = products.filter(p => {
    const matchesCategory = selectedCategory ? p.category_id === selectedCategory : true;
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (p.barcode && p.barcode.includes(searchQuery));
    return matchesCategory && matchesSearch;
  });

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      
      {/* LEFT CATALOG PANEL */}
      <View style={[styles.leftSection, { borderRightColor: theme.border }]}>
        
        {/* Search Bar */}
        <View style={[styles.searchBar, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Ionicons name="search" size={16} color={theme.textSecondary} />
          <TextInput
            style={[styles.searchInput, { color: theme.textPrimary }]}
            placeholder="Search products by name or barcode..."
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

        {/* Category Pills */}
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
              <Text style={[styles.chipText, { color: selectedCategory === null ? '#ffffff' : theme.textSecondary }]}>
                All Items
              </Text>
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

        {/* Product Cards Grid */}
        <FlatList
          data={filteredProducts}
          keyExtractor={item => item.id}
          numColumns={3}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 16 }}
          renderItem={({ item }) => {
            const isLowStock = item.stock_pieces <= item.min_stock_pieces;
            const isOutOfStock = item.stock_pieces < 1;

            return (
              <View style={[styles.productCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <View style={styles.cardHeader}>
                  <Text style={[styles.categoryLabel, { color: theme.textSecondary }]} numberOfLines={1}>
                    {item.category_name || 'General'}
                  </Text>
                  <View style={[styles.stockPill, { backgroundColor: isOutOfStock ? theme.dangerGlow : isLowStock ? theme.warningGlow : theme.successGlow }]}>
                    <Text style={[styles.stockPillText, { color: isOutOfStock ? theme.danger : isLowStock ? theme.warning : theme.success }]}>
                      {item.stock_pieces} {item.unit_piece_name}s
                    </Text>
                  </View>
                </View>

                <Text style={[styles.productName, { color: theme.textPrimary }]} numberOfLines={2}>
                  {item.name}
                </Text>

                {/* Quick Add Buttons */}
                <View style={styles.actionRow}>
                  <TouchableOpacity
                    style={[styles.addBtn, { backgroundColor: theme.primary }, isOutOfStock && styles.disabledBtn]}
                    disabled={isOutOfStock}
                    onPress={() => addToCart(item, 'PIECE')}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.addBtnTitle}>+ {item.unit_piece_name || 'pc'}</Text>
                    <Text style={styles.addBtnPrice}>₱{item.selling_price_piece.toFixed(2)}</Text>
                  </TouchableOpacity>

                  {item.pricing_type === 'PACK' && item.selling_price_pack > 0 && (
                    <TouchableOpacity
                      style={[
                        styles.addBtn,
                        { backgroundColor: theme.success },
                        item.stock_pieces < item.pieces_per_pack && styles.disabledBtn
                      ]}
                      disabled={item.stock_pieces < item.pieces_per_pack}
                      onPress={() => addToCart(item, 'PACK')}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.addBtnTitle}>+ {item.unit_pack_name || 'pack'}</Text>
                      <Text style={styles.addBtnPrice}>₱{item.selling_price_pack.toFixed(2)}</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            );
          }}
        />
      </View>

      {/* RIGHT ORDER CART PANEL (Narrowed to 320px) */}
      <View style={[styles.rightSection, { backgroundColor: theme.surface, borderLeftColor: theme.border }]}>
        <View style={[styles.cartHeader, { borderBottomColor: theme.border }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Ionicons name="receipt-outline" size={16} color={theme.accent} />
            <Text style={[styles.cartTitle, { color: theme.textPrimary }]}>Current Order</Text>
          </View>

          <TouchableOpacity onPress={clearCart} disabled={cart.length === 0} style={{ padding: 4 }}>
            <Text style={[styles.clearText, cart.length === 0 && { opacity: 0.4 }]}>Clear</Text>
          </TouchableOpacity>
        </View>

        <FlatList
          data={cart}
          keyExtractor={item => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ flexGrow: 1, paddingVertical: 8 }}
          renderItem={({ item }) => (
            <View style={[styles.cartRow, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}>
              <View style={{ flex: 1, paddingRight: 6 }}>
                <Text style={[styles.cartItemName, { color: theme.textPrimary }]} numberOfLines={2}>
                  {item.product.name}
                </Text>
                <Text style={[styles.cartItemMeta, { color: theme.textSecondary }]}>
                  {item.unitType} • ₱{item.unitPrice.toFixed(2)}
                </Text>
              </View>

              <View style={[styles.qtyBox, { backgroundColor: theme.bg, borderColor: theme.border }]}>
                <TouchableOpacity style={styles.qtyBtn} onPress={() => updateCartQuantity(item.id, item.quantity - 1)}>
                  <Ionicons name="remove" size={14} color={theme.textPrimary} />
                </TouchableOpacity>

                <Text style={[styles.qtyText, { color: theme.textPrimary }]}>{item.quantity}</Text>

                <TouchableOpacity style={styles.qtyBtn} onPress={() => updateCartQuantity(item.id, item.quantity + 1)}>
                  <Ionicons name="add" size={14} color={theme.textPrimary} />
                </TouchableOpacity>
              </View>

              <TouchableOpacity style={styles.deleteBtn} onPress={() => removeFromCart(item.id)}>
                <Ionicons name="trash-outline" size={16} color={theme.danger} />
              </TouchableOpacity>
            </View>
          )}
        />

        {/* Calculations & Checkout */}
        <View style={[styles.checkoutSummary, { borderTopColor: theme.border }]}>
          <View style={styles.summaryRow}>
            <Text style={{ color: theme.textSecondary, fontSize: 13, fontWeight: 'bold' }}>Subtotal</Text>
            <Text style={{ color: theme.textPrimary, fontSize: 13, fontWeight: 'bold' }}>₱{cartSubtotal.toFixed(2)}</Text>
          </View>
          
          {totalItemDiscounts > 0 && (
            <View style={styles.summaryRow}>
              <Text style={{ color: theme.textSecondary, fontSize: 13, fontWeight: 'bold' }}>Discounts</Text>
              <Text style={{ color: theme.danger, fontSize: 13, fontWeight: 'bold' }}>-₱{totalItemDiscounts.toFixed(2)}</Text>
            </View>
          )}

          <View style={[styles.summaryRow, { marginTop: 4 }]}>
            <Text style={{ color: theme.textPrimary, fontSize: 14, fontWeight: 'bold' }}>TOTAL DUE</Text>
            <Text style={{ color: theme.success, fontSize: 16, fontWeight: 'bold' }}>₱{finalTotal.toFixed(2)}</Text>
          </View>

          <TouchableOpacity
            style={[styles.checkoutBtn, { backgroundColor: theme.success }, cart.length === 0 && styles.disabledBtn]}
            disabled={cart.length === 0}
            onPress={() => setCheckoutVisible(true)}
            activeOpacity={0.8}
          >
            <Ionicons name="card" size={16} color="#ffffff" />
            <Text style={styles.checkoutBtnText}>COMPLETE CHECKOUT</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Modals */}
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
  container: { flex: 1, flexDirection: 'row' },
  
  /* Left Catalog Section */
  leftSection: { flex: 1, padding: 12, borderRightWidth: 1 },
  searchBar: { flexDirection: 'row', alignItems: 'center', borderRadius: 10, paddingHorizontal: 12, height: 42, borderWidth: 1, marginBottom: 12 },
  searchInput: { flex: 1, marginLeft: 8, fontSize: 14, fontWeight: 'bold' },
  categoryWrapper: { height: 38, marginBottom: 12 },
  categoryScroll: { gap: 8, alignItems: 'center' },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 16, borderWidth: 1 },
  chipText: { fontSize: 13, fontWeight: 'bold' },
  
  /* Product Cards */
  productCard: { flex: 1 / 3, margin: 4, borderRadius: 10, padding: 10, borderWidth: 1, justifyContent: 'space-between', minHeight: 110 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  categoryLabel: { fontSize: 11, fontWeight: 'bold', flex: 1 },
  stockPill: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 },
  stockPillText: { fontSize: 11, fontWeight: 'bold' },
  productName: { fontSize: 14, fontWeight: 'bold', marginVertical: 6, lineHeight: 18 },
  actionRow: { flexDirection: 'row', gap: 6, marginTop: 4 },
  addBtn: { flex: 1, paddingVertical: 8, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  addBtnTitle: { color: '#ffffff', fontSize: 13, fontWeight: 'bold' },
  addBtnPrice: { color: 'rgba(255,255,255,0.9)', fontSize: 12, marginTop: 2 },
  disabledBtn: { opacity: 0.35 },
  
  /* Right Cart Section - Narrowed Width */
  rightSection: { width: 320, padding: 12, borderLeftWidth: 1, justifyContent: 'space-between' },
  cartHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 10, borderBottomWidth: 1 },
  cartTitle: { fontSize: 16, fontWeight: 'bold' },
  clearText: { color: '#ef4444', fontSize: 13, fontWeight: 'bold' },
  
  /* Cart Rows */
  cartRow: { flexDirection: 'row', alignItems: 'center', padding: 10, borderRadius: 8, borderWidth: 1, marginBottom: 8 },
  cartItemName: { fontSize: 13, fontWeight: 'bold', lineHeight: 18 },
  cartItemMeta: { fontSize: 12, marginTop: 2 },
  qtyBox: { flexDirection: 'row', alignItems: 'center', borderRadius: 6, borderWidth: 1, paddingHorizontal: 4, height: 32, gap: 6 },
  qtyBtn: { padding: 4 },
  qtyText: { fontSize: 14, fontWeight: 'bold', minWidth: 18, textAlign: 'center' },
  deleteBtn: { padding: 6, marginLeft: 2 },
  
  /* Checkout Area */
  checkoutSummary: { paddingTop: 10, borderTopWidth: 1, gap: 6 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  checkoutBtn: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, paddingVertical: 12, borderRadius: 10, marginTop: 6 },
  checkoutBtnText: { color: '#ffffff', fontSize: 14, fontWeight: 'bold' }
});