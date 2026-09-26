import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  TextInput,
  StyleSheet,
  Alert,
  BackHandler
} from 'react-native';
import { usePOS } from '../context/POSContext';
import { Product, Category } from '../types';
import { dbService } from '../database/databaseService';
import { ProductModal } from '../components/ProductModal';
import { CategoryModal } from '../components/CategoryModal';
import { StockModal } from '../components/StockModal';
import { Ionicons } from '@expo/vector-icons';
import { getTheme } from '../theme/theme';

interface Props {
  category: Category | 'ALL';
  onBack: () => void;
}

export const CategoryProductsScreen: React.FC<Props> = ({ category, onBack }) => {
  const { products, settings, refreshInventory } = usePOS();
  const theme = getTheme(settings.theme === 'dark');

  const [searchQuery, setSearchQuery] = useState('');
  const [productModalVisible, setProductModalVisible] = useState(false);
  const [categoryModalVisible, setCategoryModalVisible] = useState(false);
  const [stockModalVisible, setStockModalVisible] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  const categoryName = category === 'ALL' ? 'All Products' : category.name;

  useEffect(() => {
    const backAction = () => {
      onBack();
      return true;
    };
    const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);
    return () => backHandler.remove();
  }, [onBack]);

  const categoryProducts = products.filter(p => {
    const matchesCategory = category === 'ALL' ? true : p.category_id === category.id;
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (p.barcode && p.barcode.includes(searchQuery));
    return matchesCategory && matchesSearch;
  });

  const handleDelete = (id: string, name: string) => {
    Alert.alert('Delete Product', `Are you sure you want to delete "${name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await dbService.deleteProduct(id);
          await refreshInventory();
        }
      }
    ]);
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      
      {/* 1. TOP HEADER BAR */}
      <View style={[styles.topHeaderBar, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <TouchableOpacity 
          style={styles.backArrowBtn} 
          onPress={onBack}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={24} color={theme.textPrimary} />
        </TouchableOpacity>

        <View style={styles.titleInfoGroup}>
          <View style={[styles.categoryIconBadge, { backgroundColor: theme.primaryGlow }]}>
            <Ionicons name="folder-open" size={22} color={theme.accent} />
          </View>
          <View style={styles.textContainer}>
            <Text style={[styles.categoryTitle, { color: theme.textPrimary }]} numberOfLines={1}>
              {categoryName}
            </Text>
            <Text style={[styles.categorySub, { color: theme.textSecondary }]}>
              {categoryProducts.length} {categoryProducts.length === 1 ? 'Product Listed' : 'Products Listed'}
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.addProductBtn, { backgroundColor: theme.primary }]}
          onPress={() => { setSelectedProduct(null); setProductModalVisible(true); }}
          activeOpacity={0.8}
        >
          <Ionicons name="add" size={18} color="#ffffff" />
          <Text style={styles.addProductBtnText}>Add Product</Text>
        </TouchableOpacity>
      </View>

      {/* 2. SEARCH BAR */}
      <View style={[styles.searchBar, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <Ionicons name="search" size={18} color={theme.textSecondary} />
        <TextInput
          style={[styles.searchInput, { color: theme.textPrimary }]}
          placeholder={`Search products inside ${categoryName}...`}
          placeholderTextColor={theme.textMuted}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery !== '' && (
          <TouchableOpacity onPress={() => setSearchQuery('')} style={{ padding: 4 }}>
            <Ionicons name="close-circle" size={18} color={theme.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      {/* 3. PRODUCT CATALOG DATA GRID */}
      {categoryProducts.length === 0 ? (
        <View style={[styles.emptyStateCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Ionicons name="cube-outline" size={48} color={theme.textMuted} />
          <Text style={[styles.emptyTitle, { color: theme.textPrimary }]}>
            No products found in "{categoryName}"
          </Text>
          <Text style={[styles.emptySub, { color: theme.textSecondary }]}>
            Tap the "Add Product" button on the top right to add items here.
          </Text>
        </View>
      ) : (
        <FlatList
          data={categoryProducts}
          keyExtractor={item => item.id}
          contentContainerStyle={{ paddingBottom: 24 }}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => {
            const isLow = item.stock_pieces <= item.min_stock_pieces && item.stock_pieces > 0;
            const isOut = item.stock_pieces < 1;

            const pieceProfit = item.selling_price_piece - item.buying_price_piece;
            const marginPct = item.selling_price_piece > 0 ? ((pieceProfit / item.selling_price_piece) * 100).toFixed(0) : '0';

            return (
              <View style={[styles.productCardRow, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                
                {/* Product Info */}
                <View style={{ flex: 2.5 }}>
                  <Text style={[styles.prodName, { color: theme.textPrimary }]} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <Text style={[styles.prodMeta, { color: theme.textSecondary }]}>
                    {item.pricing_type === 'PACK' ? `${item.pieces_per_pack} ${item.unit_piece_name}s/${item.unit_pack_name}` : `Single ${item.unit_piece_name}`}
                    {item.barcode ? ` • Barcode: ${item.barcode}` : ''}
                  </Text>
                </View>

                {/* Pricing & Profit Margin */}
                <View style={{ flex: 1.5 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={[styles.priceText, { color: theme.textPrimary }]}>
                      Piece: ₱{item.selling_price_piece.toFixed(2)}
                    </Text>
                    <View style={[styles.marginBadge, { backgroundColor: theme.successGlow }]}>
                      <Text style={[styles.marginText, { color: theme.success }]}>+{marginPct}%</Text>
                    </View>
                  </View>

                  {item.pricing_type === 'PACK' && (
                    <Text style={[styles.priceSubText, { color: theme.textSecondary }]}>
                      Pack: ₱{item.selling_price_pack.toFixed(2)}
                    </Text>
                  )}
                </View>

                {/* Stock Status Badge */}
                <View style={{ flex: 1, alignItems: 'center' }}>
                  <View style={[styles.statusBadge, { backgroundColor: isOut ? theme.dangerGlow : isLow ? theme.warningGlow : theme.successGlow }]}>
                    <Text style={[styles.statusBadgeText, { color: isOut ? theme.danger : isLow ? theme.warning : theme.success }]}>
                      {item.stock_pieces} {item.unit_piece_name}s
                    </Text>
                  </View>
                </View>

                {/* Quick Actions */}
                <View style={styles.actions}>
                  <TouchableOpacity
                    style={[styles.stockAdjBtn, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}
                    onPress={() => { setSelectedProduct(item); setStockModalVisible(true); }}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="bar-chart" size={16} color={theme.accent} />
                    <Text style={[styles.stockAdjText, { color: theme.textPrimary }]}>± Stock</Text>
                  </TouchableOpacity>

                  <TouchableOpacity onPress={() => { setSelectedProduct(item); setProductModalVisible(true); }} style={{ padding: 6 }}>
                    <Ionicons name="create-outline" size={22} color={theme.accent} />
                  </TouchableOpacity>

                  <TouchableOpacity onPress={() => handleDelete(item.id, item.name)} style={{ padding: 6 }}>
                    <Ionicons name="trash-outline" size={22} color={theme.danger} />
                  </TouchableOpacity>
                </View>
              </View>
            );
          }}
        />
      )}

      {/* Modals */}
      <ProductModal
        visible={productModalVisible}
        product={selectedProduct}
        defaultCategoryId={category === 'ALL' ? undefined : category.id}
        onClose={() => setProductModalVisible(false)}
        onOpenCategoryModal={() => setCategoryModalVisible(true)}
      />
      <CategoryModal visible={categoryModalVisible} onClose={() => setCategoryModalVisible(false)} />
      <StockModal visible={stockModalVisible} product={selectedProduct} onClose={() => setStockModalVisible(false)} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 14 },
  
  topHeaderBar: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 14,
    width: '100%',
  },
  backArrowBtn: {
    marginRight: 14,
    padding: 4,
  },
  titleInfoGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    marginRight: 16,
  },
  categoryIconBadge: { width: 42, height: 42, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  textContainer: { flex: 1 },
  categoryTitle: { fontSize: 16, fontWeight: 'bold' },
  categorySub: { fontSize: 13, marginTop: 2 },
  
  addProductBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 10,
    marginLeft: 'auto',
  },
  addProductBtnText: { color: '#ffffff', fontSize: 14, fontWeight: 'bold' },
  
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 46,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 14,
    marginBottom: 14,
  },
  searchInput: { flex: 1, marginLeft: 10, fontSize: 14 },
  
  emptyStateCard: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
    padding: 40,
  },
  emptyTitle: { fontSize: 16, fontWeight: 'bold' },
  emptySub: { fontSize: 14, textAlign: 'center' },
  
  productCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
  },
  prodName: { fontSize: 16, fontWeight: 'bold' },
  prodMeta: { fontSize: 13, marginTop: 4 },
  
  priceText: { fontSize: 14, fontWeight: 'bold' },
  priceSubText: { fontSize: 12, marginTop: 4 },
  
  marginBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  marginText: { fontSize: 12, fontWeight: 'bold' },
  
  statusBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
  statusBadgeText: { fontSize: 12, fontWeight: 'bold' },
  
  actions: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  stockAdjBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  stockAdjText: { fontSize: 12, fontWeight: 'bold' },
});