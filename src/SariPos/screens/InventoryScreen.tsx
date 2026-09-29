import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Alert, FlatList, Modal, ScrollView, Share, StyleSheet, Text, TextInput, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { CategoryModal } from '../components/CategoryModal';
import { ProductDetailsModal } from '../components/ProductDetailsModal';
import { ProductModal } from '../components/ProductModal';
import { StockHistoryModal } from '../components/StockHistoryModal';
import { StockModal } from '../components/StockModal';
import { usePOS } from '../context/POSContext';
import { getTheme } from '../theme/theme';
import { Product } from '../types';

export const InventoryScreen: React.FC = () => {
  const { products, settings } = usePOS();
  const theme = getTheme(settings.theme === 'dark');
  const { width } = useWindowDimensions();
  const isLandscape = width > 700;

  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'ALL' | 'LOW_STOCK' | 'OUT_OF_STOCK' | 'CATEGORY'>('ALL');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  
  const [productModalVisible, setProductModalVisible] = useState(false);
  const [stockModalVisible, setStockModalVisible] = useState(false);
  const [detailsModalVisible, setDetailsModalVisible] = useState(false);
  const [historyModalVisible, setHistoryModalVisible] = useState(false);
  const [categoryModalVisible, setCategoryModalVisible] = useState(false);
  
  const [addMenuVisible, setAddMenuVisible] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  const totalProducts = products.length;
  const lowStockItems = products.filter(p => p.stock_pieces <= p.min_stock_pieces && p.stock_pieces > 0);
  const outOfStockItems = products.filter(p => p.stock_pieces < 1);
  const inventoryValuation = products.reduce((sum, p) => sum + (p.stock_pieces * p.buying_price_piece), 0);

  const filteredProducts = products.filter(p => {
    let matchesFilter = true;
    if (filterType === 'LOW_STOCK') matchesFilter = p.stock_pieces <= p.min_stock_pieces && p.stock_pieces > 0;
    else if (filterType === 'OUT_OF_STOCK') matchesFilter = p.stock_pieces < 1;
    else if (filterType === 'CATEGORY' && selectedCategoryId) matchesFilter = p.category_id === selectedCategoryId;

    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (p.barcode && p.barcode.includes(searchQuery));
                          
    return matchesFilter && matchesSearch;
  });

  const handleShareAlerts = async () => {
    try {
      let text = `SariPOS Inventory Alerts\n\nLow Stock: ${lowStockItems.length}\nOut of Stock: ${outOfStockItems.length}\n\n`;
      text += `LOW STOCK\n`;
      if (lowStockItems.length === 0) text += `- None\n`;
      lowStockItems.forEach(p => text += `- ${p.name} — ${p.stock_pieces} pcs\n`);
      text += `\nOUT OF STOCK\n`;
      if (outOfStockItems.length === 0) text += `- None\n`;
      outOfStockItems.forEach(p => text += `- ${p.name} — 0 pcs\n`);

      await Share.share({ message: text });
    } catch (e: any) {
      Alert.alert('Share Error', e.message);
    }
  };

  const renderProduct = ({ item }: { item: Product }) => {
    const isPack = item.pricing_type === 'PACK' && item.pieces_per_pack > 0;
    const packs = isPack ? Math.floor(item.stock_pieces / item.pieces_per_pack) : 0;
    const remainder = isPack ? item.stock_pieces % item.pieces_per_pack : 0;
    
    const stockText = isPack 
      ? `${item.stock_pieces} ${item.unit_piece_name || 'pcs'} • ${packs} ${item.unit_pack_name || 'packs'}${remainder > 0 ? ` + ${remainder}` : ''}`
      : `${item.stock_pieces} ${item.unit_piece_name || 'pcs'}`;

    const priceText = isPack
      ? `Piece ₱${item.selling_price_piece.toFixed(2)} • Pack ₱${item.selling_price_pack.toFixed(2)}`
      : `Piece ₱${item.selling_price_piece.toFixed(2)}`;

    const isOut = item.stock_pieces < 1;
    const isLow = item.stock_pieces <= item.min_stock_pieces && !isOut;

    return (
      <View style={[styles.productRow, { backgroundColor: theme.surface, borderColor: theme.border, flex: isLandscape ? 0.5 : 1, marginHorizontal: isLandscape ? 4 : 0 }]}>
        <View style={styles.productInfo}>
          <Text style={[styles.productName, { color: theme.textPrimary }]} numberOfLines={1}>{item.name}</Text>
          
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginVertical: 4 }}>
            <Text style={[styles.productStock, { color: isOut ? theme.danger : isLow ? theme.warning : theme.success }]}>
              {stockText}
            </Text>
          </View>
          
          <Text style={[styles.productPrices, { color: theme.textSecondary }]}>{priceText}</Text>
          <Text style={[styles.productCost, { color: theme.textMuted }]}>Cost ₱{item.buying_price_piece.toFixed(2)}/pc</Text>
        </View>

        <View style={styles.actionCol}>
          <TouchableOpacity 
            style={[styles.btnMenu, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]} 
            onPress={() => { setSelectedProduct(item); setDetailsModalVisible(true); }}
            activeOpacity={0.7}
          >
            <Text style={[styles.btnMenuText, { color: theme.textPrimary }]} numberOfLines={1}>Adjustments</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      {/* HEADER ROW */}
      <View style={styles.headerRow}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
          <Text style={[styles.screenTitle, { color: theme.textPrimary }]}>INVENTORY</Text>
          <Text style={[styles.summaryText, { color: theme.textSecondary }]}>Products: {totalProducts}   Value: ₱{inventoryValuation.toFixed(2)}</Text>
        </View>
        <View style={styles.headerActions}>
          <View style={[styles.searchBar, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Ionicons name="search" size={16} color={theme.textSecondary} />
            <TextInput
              style={[styles.searchInput, { color: theme.textPrimary }]}
              placeholder="Search products..."
              placeholderTextColor={theme.textMuted}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery !== '' && (
              <TouchableOpacity onPress={() => setSearchQuery('')} style={{ padding: 4 }}>
                <Ionicons name="close-circle" size={14} color={theme.textMuted} />
              </TouchableOpacity>
            )}
          </View>
          <TouchableOpacity 
            style={[styles.btnAdd, { backgroundColor: theme.primary }]}
            onPress={() => setAddMenuVisible(true)}
          >
            <Ionicons name="add" size={18} color="#fff" />
            <Text style={styles.btnAddText}>Add ▾</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ALERTS CONTAINER */}
      <View style={[styles.alertsContainer, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
          <Text style={[styles.alertsTitle, { color: theme.textPrimary }]}>INVENTORY ALERTS</Text>
          <TouchableOpacity onPress={() => setFilterType('LOW_STOCK')} style={styles.alertChip}>
            <Text style={{ color: theme.warning, fontSize: 13, fontWeight: '700' }}>🔶 Low Stock   {lowStockItems.length}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setFilterType('OUT_OF_STOCK')} style={styles.alertChip}>
            <Text style={{ color: theme.danger, fontSize: 13, fontWeight: '700' }}>🔴 Out of Stock   {outOfStockItems.length}</Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity style={{ padding: 6 }} onPress={handleShareAlerts}>
          <Ionicons name="share-outline" size={20} color={theme.accent} />
        </TouchableOpacity>
      </View>

      {/* FILTERS */}
      <View style={{ marginBottom: 12, zIndex: 10 }}>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false} 
          contentContainerStyle={[styles.filterRow, { paddingRight: 16, paddingVertical: 4 }]}
          keyboardShouldPersistTaps="handled"
        >
          <TouchableOpacity 
            style={[styles.filterChip, filterType === 'ALL' && { backgroundColor: theme.primary, borderColor: theme.primary }]} 
            onPress={() => setFilterType('ALL')}
            activeOpacity={0.7}
          >
            <Text style={[styles.filterText, filterType === 'ALL' ? { color: '#fff' } : { color: theme.textSecondary }]}>All</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.filterChip, filterType === 'LOW_STOCK' && { backgroundColor: theme.primary, borderColor: theme.primary }]} 
            onPress={() => setFilterType('LOW_STOCK')}
            activeOpacity={0.7}
          >
            <Text style={[styles.filterText, filterType === 'LOW_STOCK' ? { color: '#fff' } : { color: theme.textSecondary }]}>Low Stock</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.filterChip, filterType === 'OUT_OF_STOCK' && { backgroundColor: theme.primary, borderColor: theme.primary }]} 
            onPress={() => setFilterType('OUT_OF_STOCK')}
            activeOpacity={0.7}
          >
            <Text style={[styles.filterText, filterType === 'OUT_OF_STOCK' ? { color: '#fff' } : { color: theme.textSecondary }]}>Out of Stock</Text>
          </TouchableOpacity>

          <View style={{ width: 1, height: '60%', backgroundColor: theme.border, marginHorizontal: 4, alignSelf: 'center' }} />

          {usePOS().categories.map(c => (
            <TouchableOpacity 
              key={c.id}
              style={[styles.filterChip, (filterType === 'CATEGORY' && selectedCategoryId === c.id) ? { backgroundColor: theme.primary, borderColor: theme.primary } : { backgroundColor: theme.surface, borderColor: theme.border }]} 
              onPress={() => { setFilterType('CATEGORY'); setSelectedCategoryId(c.id); }}
              activeOpacity={0.7}
            >
              <Text style={[styles.filterText, (filterType === 'CATEGORY' && selectedCategoryId === c.id) ? { color: '#fff' } : { color: theme.textSecondary }]}>{c.name}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* PRODUCT LIST */}
      <FlatList
        key={isLandscape ? '2col' : '1col'}
        numColumns={isLandscape ? 2 : 1}
        data={filteredProducts}
        keyExtractor={item => item.id}
        renderItem={renderProduct}
        contentContainerStyle={{ paddingBottom: 24, gap: isLandscape ? 8 : 10 }}
        columnWrapperStyle={isLandscape ? { gap: 8 } : undefined}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={{ padding: 40, alignItems: 'center' }}>
            <Ionicons name="cube-outline" size={48} color={theme.textMuted} />
            <Text style={{ color: theme.textSecondary, marginTop: 12, fontSize: 16 }}>No products found.</Text>
          </View>
        }
      />

      {/* ADD MENU MODAL */}
      <Modal visible={addMenuVisible} transparent animationType="fade" onRequestClose={() => setAddMenuVisible(false)}>
        <TouchableOpacity style={styles.menuOverlay} activeOpacity={1} onPress={() => setAddMenuVisible(false)}>
          <View style={[styles.menuBox, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <TouchableOpacity style={styles.menuItem} onPress={() => { setAddMenuVisible(false); setSelectedProduct(null); setProductModalVisible(true); }}>
              <Ionicons name="cube-outline" size={20} color={theme.textPrimary} />
              <Text style={[styles.menuItemText, { color: theme.textPrimary }]}>Add Product</Text>
            </TouchableOpacity>
            <View style={{ height: 1, backgroundColor: theme.border }} />
            <TouchableOpacity style={styles.menuItem} onPress={() => { setAddMenuVisible(false); setCategoryModalVisible(true); }}>
              <Ionicons name="folder-outline" size={20} color={theme.textPrimary} />
              <Text style={[styles.menuItemText, { color: theme.textPrimary }]}>Add Category</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      <ProductDetailsModal 
        visible={detailsModalVisible} 
        product={selectedProduct} 
        onClose={() => setDetailsModalVisible(false)} 
        onEdit={() => setProductModalVisible(true)}
        onAdjustStock={() => setStockModalVisible(true)}
        onViewHistory={() => setHistoryModalVisible(true)}
      />
      <ProductModal visible={productModalVisible} product={selectedProduct} onClose={() => setProductModalVisible(false)} onOpenCategoryModal={() => setCategoryModalVisible(true)} />
      <StockModal visible={stockModalVisible} product={selectedProduct} onClose={() => setStockModalVisible(false)} />
      <StockHistoryModal visible={historyModalVisible} product={selectedProduct} onClose={() => setHistoryModalVisible(false)} />
      <CategoryModal visible={categoryModalVisible} onClose={() => setCategoryModalVisible(false)} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 14 },
  
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  screenTitle: { fontSize: 18, fontWeight: '900', letterSpacing: 0.5 },
  summaryText: { fontSize: 13, fontWeight: '700' },
  headerActions: { flexDirection: 'row', gap: 8, flex: 1, justifyContent: 'flex-end', marginLeft: 16 },
  searchBar: { flexDirection: 'row', alignItems: 'center', height: 40, borderRadius: 8, borderWidth: 1, paddingHorizontal: 10, flex: 1, maxWidth: 300 },
  searchInput: { flex: 1, marginLeft: 8, fontSize: 14 },
  btnAdd: { flexDirection: 'row', alignItems: 'center', height: 40, paddingHorizontal: 12, borderRadius: 8, gap: 6 },
  btnAddText: { color: '#fff', fontSize: 13, fontWeight: '800' },
  
  alertsContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1, marginBottom: 12 },
  alertsTitle: { fontSize: 12, fontWeight: '800', letterSpacing: 0.5 },
  alertChip: { paddingHorizontal: 8, paddingVertical: 4 },
  
  filterRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  filterChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16, borderWidth: 1, borderColor: '#334155' },
  filterText: { fontSize: 13, fontWeight: '700' },

  productRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 12, borderRadius: 12, borderWidth: 1 },
  productInfo: { flex: 1 },
  productName: { fontSize: 15, fontWeight: '800' },
  productStock: { fontSize: 14, fontWeight: '800' },
  productPrices: { fontSize: 13, marginBottom: 2 },
  productCost: { fontSize: 12 },

  actionCol: { flexDirection: 'row', marginLeft: 16 },
  btnMenu: { minWidth: 140, paddingHorizontal: 20, paddingVertical: 8, borderRadius: 8, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
  btnMenuText: { fontSize: 13, fontWeight: '800' },

  menuOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'flex-start', alignItems: 'flex-end', padding: 50 },
  menuBox: { width: 180, borderRadius: 12, borderWidth: 1, overflow: 'hidden', elevation: 5 },
  menuItem: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12 },
  menuItemText: { fontSize: 14, fontWeight: '700' }
});
