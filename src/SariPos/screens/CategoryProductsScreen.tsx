import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import {
    Alert,
    BackHandler,
    FlatList,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    useWindowDimensions,
    View
} from 'react-native';
import { CategoryModal } from '../components/CategoryModal';
import { ProductModal } from '../components/ProductModal';
import { StockModal } from '../components/StockModal';
import { usePOS } from '../context/POSContext';
import { dbService } from '../database/databaseService';
import { getTheme } from '../theme/theme';
import { Category, Product } from '../types';

interface Props {
  category: Category | 'ALL';
  onBack: () => void;
}

export const CategoryProductsScreen: React.FC<Props> = ({ category, onBack }) => {
  const { products, settings, refreshInventory } = usePOS();
  const theme = getTheme(settings.theme === 'dark');
  const { width, height } = useWindowDimensions();
  const isPortrait = height > width;

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
          <View style={styles.textContainer}>
            <Text style={[styles.categoryTitle, { color: theme.textPrimary }]} numberOfLines={1}>
              {categoryName}
            </Text>
            <Text style={[styles.categorySub, { color: theme.textSecondary }]}>
              {categoryProducts.length} items
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.addProductBtn, { backgroundColor: theme.primary }]}
          onPress={() => { setSelectedProduct(null); setProductModalVisible(true); }}
          activeOpacity={0.8}
        >
          <Ionicons name="add" size={18} color="#ffffff" />
          {!isPortrait && <Text style={styles.addProductBtnText}>Add Product</Text>}
        </TouchableOpacity>
      </View>

      {/* 2. SEARCH BAR */}
      <View style={[styles.searchBar, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <Ionicons name="search" size={18} color={theme.textSecondary} />
        <TextInput
          style={[styles.searchInput, { color: theme.textPrimary }]}
          placeholder={`Search ${categoryName}...`}
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

      {/* 3. PRODUCT LIST */}
      {categoryProducts.length === 0 ? (
        <View style={styles.emptyStateCard}>
          <Ionicons name="cube-outline" size={48} color={theme.textMuted} />
          <Text style={[styles.emptyTitle, { color: theme.textPrimary }]}>No products found</Text>
        </View>
      ) : (
        <FlatList
          data={categoryProducts}
          keyExtractor={item => item.id}
          contentContainerStyle={{ paddingBottom: 24, gap: 8 }}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => {
            const isLow = item.stock_pieces <= item.min_stock_pieces && item.stock_pieces > 0;
            const isOut = item.stock_pieces < 1;

            return (
              <View style={[styles.productCardRow, { backgroundColor: theme.surface, borderColor: theme.border, flexDirection: isPortrait ? 'column' : 'row', alignItems: isPortrait ? 'stretch' : 'center' }]}>
                
                {/* Product Info */}
                <View style={{ flex: isPortrait ? undefined : 2, marginBottom: isPortrait ? 10 : 0 }}>
                  <Text style={[styles.prodName, { color: theme.textPrimary }]} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <Text style={[styles.prodMeta, { color: theme.textSecondary }]}>
                    BP: ₱{item.buying_price_piece.toFixed(2)} | SP: ₱{item.selling_price_piece.toFixed(2)}
                  </Text>
                </View>

                {/* Stock Status Badge */}
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flex: isPortrait ? undefined : 2 }}>
                  <View>
                    <View style={[styles.statusBadge, { backgroundColor: isOut ? theme.dangerGlow : isLow ? theme.warningGlow : theme.successGlow }]}>
                      <Text style={[styles.statusBadgeText, { color: isOut ? theme.danger : isLow ? theme.warning : theme.success }]}>
                        Stock: {item.stock_pieces}
                      </Text>
                    </View>
                    <Text style={{ fontSize: 10, color: theme.textMuted, marginTop: 4, textAlign: 'center' }}>
                      Min: {item.min_stock_pieces}
                    </Text>
                  </View>

                  {/* Quick Actions */}
                  <View style={styles.actions}>
                    <TouchableOpacity
                      style={[styles.stockAdjBtn, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}
                      onPress={() => { setSelectedProduct(item); setStockModalVisible(true); }}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="bar-chart" size={16} color={theme.textPrimary} />
                    </TouchableOpacity>

                    <TouchableOpacity onPress={() => { setSelectedProduct(item); setProductModalVisible(true); }} style={styles.iconBtn}>
                      <Ionicons name="create-outline" size={20} color={theme.accent} />
                    </TouchableOpacity>

                    <TouchableOpacity onPress={() => handleDelete(item.id, item.name)} style={styles.iconBtn}>
                      <Ionicons name="trash-outline" size={20} color={theme.danger} />
                    </TouchableOpacity>
                  </View>
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
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  backArrowBtn: { marginRight: 12, padding: 4 },
  titleInfoGroup: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  textContainer: { flex: 1 },
  categoryTitle: { fontSize: 16, fontWeight: '800' },
  categorySub: { fontSize: 12, fontWeight: '600' },
  
  addProductBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 8 },
  addProductBtnText: { color: '#ffffff', fontSize: 13, fontWeight: '800' },
  
  searchBar: { flexDirection: 'row', alignItems: 'center', height: 46, borderRadius: 10, borderWidth: 1, paddingHorizontal: 14, marginBottom: 12 },
  searchInput: { flex: 1, marginLeft: 10, fontSize: 15 },
  
  emptyStateCard: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  emptyTitle: { fontSize: 16, fontWeight: '800' },
  
  productCardRow: { padding: 14, borderRadius: 12, borderWidth: 1 },
  prodName: { fontSize: 15, fontWeight: '800', marginBottom: 4 },
  prodMeta: { fontSize: 13, fontWeight: '600' },
  
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  statusBadgeText: { fontSize: 12, fontWeight: '800' },
  
  actions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  stockAdjBtn: { padding: 8, borderRadius: 8, borderWidth: 1 },
  iconBtn: { padding: 8 },
});