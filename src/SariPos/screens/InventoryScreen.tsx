import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Modal,
  Alert,
  Share
} from 'react-native';
import { usePOS } from '../context/POSContext';
import { Category } from '../types';
import { CategoryModal } from '../components/CategoryModal';
import { CategoryProductsScreen } from './CategoryProductsScreen';
import { Ionicons } from '@expo/vector-icons';
import { getTheme } from '../theme/theme';

export const InventoryScreen: React.FC = () => {
  const { products, categories, settings } = usePOS();
  const theme = getTheme(settings.theme === 'dark');

  const [activeCategoryScreen, setActiveCategoryScreen] = useState<Category | 'ALL' | null>(null);
  const [categoryModalVisible, setCategoryModalVisible] = useState(false);
  const [stockAlertModalVisible, setStockAlertModalVisible] = useState(false);

  // Overall Inventory Stats
  const totalProducts = products.length;
  const lowStockItems = products.filter(p => p.stock_pieces <= p.min_stock_pieces && p.stock_pieces > 0);
  const outOfStockItems = products.filter(p => p.stock_pieces < 1);
  
  // Unified alert list
  const allAlertItems = [...outOfStockItems, ...lowStockItems];
  const inventoryValuation = products.reduce((sum, p) => sum + (p.stock_pieces * p.buying_price_piece), 0);

  const getCategoryProductCount = (catId: string) => {
    return products.filter(p => p.category_id === catId).length;
  };

  // Generate and share beautifully formatted RAW TEXT
  const handleShareStockAlert = async () => {
    try {
      if (allAlertItems.length === 0) {
        Alert.alert('Inventory Healthy', 'There are no low stock or out of stock items to share.');
        return;
      }

      let text = `🏪 *${settings.store_name || 'Store'} - Reorder Report*\n`;
      text += `📅 Date: ${new Date().toLocaleDateString()}\n\n`;

      text += `⚠️ *LOW STOCK ITEMS*\n`;
      if (lowStockItems.length === 0) {
        text += `  • None\n`;
      } else {
        lowStockItems.forEach(p => {
          text += `  • ${p.name}\n`;
        });
      }

      text += `\n❌ *OUT OF STOCK ITEMS*\n`;
      if (outOfStockItems.length === 0) {
        text += `  • None\n`;
      } else {
        outOfStockItems.forEach(p => {
          text += `  • ${p.name}\n`;
        });
      }

      text += `\n------------------------\nGenerated via POS System`;

      // Uses React Native's native Share API to send as plain text message
      await Share.share({
        message: text,
        title: 'Stock Reorder Alert'
      });

    } catch (e: any) {
      Alert.alert('Share Error', e.message);
    }
  };

  if (activeCategoryScreen !== null) {
    return (
      <CategoryProductsScreen
        category={activeCategoryScreen}
        onBack={() => setActiveCategoryScreen(null)}
      />
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      
      {/* 1. TOP ANALYTICS BANNER */}
      <View style={styles.statsBanner}>
        <View style={[styles.statCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[styles.statLabel, { color: theme.textSecondary }]}>TOTAL PRODUCTS</Text>
          <Text style={[styles.statVal, { color: theme.textPrimary }]}>{totalProducts}</Text>
        </View>

        {/* UNIFIED STOCK ALERTS CARD */}
        <TouchableOpacity
          style={[styles.statCard, { backgroundColor: theme.surface, borderColor: allAlertItems.length > 0 ? theme.danger : theme.border }]}
          onPress={() => setStockAlertModalVisible(true)}
          activeOpacity={0.7}
        >
          <View style={styles.statHeaderRow}>
            <Text style={[styles.statLabel, { color: allAlertItems.length > 0 ? theme.danger : theme.textSecondary }]}>
              STOCK ALERTS
            </Text>
            <Ionicons name="alert-circle" size={14} color={allAlertItems.length > 0 ? theme.danger : theme.textSecondary} />
          </View>
          <Text style={[styles.statVal, { color: allAlertItems.length > 0 ? theme.danger : theme.textSecondary }]}>
            {allAlertItems.length}
          </Text>
        </TouchableOpacity>

        <View style={[styles.statCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[styles.statLabel, { color: theme.textSecondary }]}>VALUATION</Text>
          <Text style={[styles.statVal, { color: theme.success }]}>₱{inventoryValuation.toFixed(2)}</Text>
        </View>
      </View>

      {/* 2. DIRECTORY HEADER & TOOLBAR */}
      <View style={[styles.headerBar, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <View style={styles.headerLeftGroup}>
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: theme.primary }]}
            onPress={() => setCategoryModalVisible(true)}
            activeOpacity={0.8}
          >
            <Ionicons name="folder-open" size={16} color="#ffffff" />
            <Text style={styles.actionBtnText}>Category Manager</Text>
          </TouchableOpacity>

          <View style={styles.headerTitleGroup}>
            <Text style={[styles.directoryTitle, { color: theme.textPrimary }]}>CATEGORIES DIRECTORY</Text>
            <Text style={[styles.directorySub, { color: theme.textSecondary }]}>
              Select a category folder to manage inventory
            </Text>
          </View>
        </View>

        <View style={[styles.countBadge, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}>
          <Ionicons name="pricetags-outline" size={16} color={theme.accent} />
          <Text style={[styles.countBadgeText, { color: theme.textPrimary }]}>
            {categories.length} Categories
          </Text>
        </View>
      </View>

      {/* 3. CATEGORY CARDS LIST */}
      <View style={{ flex: 1 }}>
        <TouchableOpacity
          style={[
            styles.rectCard,
            { backgroundColor: theme.surface, borderColor: theme.accent, borderWidth: 2, marginBottom: 12 }
          ]}
          onPress={() => setActiveCategoryScreen('ALL')}
          activeOpacity={0.7}
        >
          <View style={styles.rectLeft}>
            <View style={[styles.rectBadge, { backgroundColor: theme.primaryGlow }]}>
              <Ionicons name="apps" size={20} color={theme.accent} />
            </View>
            <View>
              <Text style={[styles.rectTitle, { color: theme.textPrimary }]}>All Products</Text>
              <Text style={[styles.rectSub, { color: theme.textSecondary }]}>Complete Store Catalog</Text>
            </View>
          </View>

          <View style={styles.rectRight}>
            <View style={[styles.countPill, { backgroundColor: theme.primaryGlow }]}>
              <Text style={[styles.countPillText, { color: theme.accent }]}>{products.length} Items</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={theme.accent} />
          </View>
        </TouchableOpacity>

        <FlatList
          data={categories}
          keyExtractor={cat => cat.id}
          contentContainerStyle={{ paddingBottom: 20, gap: 10 }}
          showsVerticalScrollIndicator={false}
          renderItem={({ item: cat }) => {
            const count = getCategoryProductCount(cat.id);

            return (
              <TouchableOpacity
                style={[styles.rectCard, { backgroundColor: theme.surface, borderColor: theme.border }]}
                onPress={() => setActiveCategoryScreen(cat)}
                activeOpacity={0.7}
              >
                <View style={styles.rectLeft}>
                  <View style={[styles.rectBadge, { backgroundColor: theme.surfaceElevated }]}>
                    <Ionicons name="pricetag" size={18} color={theme.accent} />
                  </View>
                  <View>
                    <Text style={[styles.rectTitle, { color: theme.textPrimary }]}>{cat.name}</Text>
                    <Text style={[styles.rectSub, { color: theme.textSecondary }]}>Category Folder</Text>
                  </View>
                </View>

                <View style={styles.rectRight}>
                  <View style={[styles.countPill, { backgroundColor: theme.surfaceElevated }]}>
                    <Text style={[styles.countPillText, { color: theme.textSecondary }]}>
                      {count} {count === 1 ? 'Item' : 'Items'}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
                </View>
              </TouchableOpacity>
            );
          }}
        />
      </View>

      <CategoryModal visible={categoryModalVisible} onClose={() => setCategoryModalVisible(false)} />

      {/* COMBINED LOW & OUT OF STOCK REORDER MODAL */}
      <Modal visible={stockAlertModalVisible} transparent animationType="fade" onRequestClose={() => setStockAlertModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            
            <View style={[styles.modalHeader, { borderBottomColor: theme.border }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="warning-outline" size={18} color={theme.warning} />
                <Text style={[styles.modalTitle, { color: theme.textPrimary }]}>Inventory Reorder Report</Text>
              </View>
              <TouchableOpacity onPress={() => setStockAlertModalVisible(false)} style={{ padding: 4 }}>
                <Ionicons name="close" size={20} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>

            {allAlertItems.length === 0 ? (
              <View style={{ padding: 30, alignItems: 'center' }}>
                <Ionicons name="checkmark-circle-outline" size={42} color={theme.success} />
                <Text style={{ color: theme.textPrimary, fontSize: 14, fontWeight: 'bold', marginTop: 8 }}>
                  All Stock Levels Healthy!
                </Text>
              </View>
            ) : (
              <FlatList
                data={allAlertItems}
                keyExtractor={p => p.id}
                style={{ maxHeight: 300, marginTop: 8 }}
                showsVerticalScrollIndicator={true}
                renderItem={({ item }) => {
                  const isOut = item.stock_pieces < 1;
                  return (
                    <View style={[styles.alertRow, { backgroundColor: theme.bg, borderColor: theme.border }]}>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.alertProdName, { color: theme.textPrimary }]}>{item.name}</Text>
                        <Text style={[styles.alertProdMeta, { color: theme.textSecondary }]}>
                          Category: {item.category_name || 'General'}
                        </Text>
                      </View>

                      <View style={[styles.alertBadge, { backgroundColor: isOut ? theme.dangerGlow : theme.warningGlow }]}>
                        <Text style={[styles.alertBadgeText, { color: isOut ? theme.danger : theme.warning }]}>
                          {isOut ? 'OUT OF STOCK' : `${item.stock_pieces} ${item.unit_piece_name}s left`}
                        </Text>
                      </View>
                    </View>
                  );
                }}
              />
            )}

            <TouchableOpacity
              style={[styles.shareBtn, { backgroundColor: theme.success }]}
              onPress={handleShareStockAlert}
              activeOpacity={0.8}
            >
              <Ionicons name="share-social" size={16} color="#ffffff" />
              <Text style={styles.shareBtnText}>Send / Share Reorder Text</Text>
            </TouchableOpacity>

          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 14 },
  statsBanner: { flexDirection: 'row', gap: 12, marginBottom: 14 },
  statCard: { flex: 1, padding: 12, borderRadius: 12, borderWidth: 1, justifyContent: 'center' },
  statHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  statLabel: { fontSize: 12, fontWeight: 'bold', letterSpacing: 0.5 },
  statVal: { fontSize: 16, fontWeight: 'bold', marginTop: 4 },
  headerBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, padding: 12, borderRadius: 12, borderWidth: 1 },
  headerLeftGroup: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8 },
  actionBtnText: { color: '#ffffff', fontSize: 14, fontWeight: 'bold' },
  headerTitleGroup: { gap: 2 },
  directoryTitle: { fontSize: 16, fontWeight: 'bold', letterSpacing: 0.5 },
  directorySub: { fontSize: 12 },
  countBadge: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 8, borderWidth: 1 },
  countBadgeText: { fontSize: 14, fontWeight: 'bold' },
  rectCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14, borderRadius: 12, borderWidth: 1 },
  rectLeft: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  rectBadge: { width: 44, height: 44, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  rectTitle: { fontSize: 16, fontWeight: 'bold' },
  rectSub: { fontSize: 12, marginTop: 2 },
  rectRight: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  countPill: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
  countPillText: { fontSize: 12, fontWeight: 'bold' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', padding: 16 },
  modalCard: { width: '90%', maxWidth: 540, borderRadius: 14, borderWidth: 1, padding: 16, gap: 12 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 10, borderBottomWidth: 1 },
  modalTitle: { fontSize: 16, fontWeight: 'bold' },
  alertRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 12, borderRadius: 10, borderWidth: 1, marginBottom: 8 },
  alertProdName: { fontSize: 14, fontWeight: 'bold' },
  alertProdMeta: { fontSize: 12, marginTop: 2 },
  alertBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  alertBadgeText: { fontSize: 12, fontWeight: 'bold' },
  shareBtn: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, paddingVertical: 14, borderRadius: 10, marginTop: 6 },
  shareBtnText: { color: '#ffffff', fontSize: 14, fontWeight: 'bold' }
});