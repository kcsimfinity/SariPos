import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { FlatList, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { usePOS } from '../context/POSContext';
import { dbService } from '../database/databaseService';
import { getTheme } from '../theme/theme';
import { Product } from '../types';

interface Props {
  visible: boolean;
  product: Product | null;
  onClose: () => void;
}

export const StockHistoryModal: React.FC<Props> = ({ visible, product, onClose }) => {
  const { settings } = usePOS();
  const theme = getTheme(settings.theme === 'dark');
  const [history, setHistory] = useState<any[]>([]);

  useEffect(() => {
    if (visible && product) {
      dbService.getProductStockHistory(product.id).then(setHistory);
    }
  }, [visible, product]);

  const renderItem = ({ item }: { item: any }) => {
    const date = new Date(item.timestamp);
    const dateStr = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    const isAdded = item.change_qty_pieces > 0;
    const sign = isAdded ? '+' : '';
    
    const isPack = product?.pricing_type === 'PACK' && (product?.pieces_per_pack || 1) > 1;
    let packStr = '';
    if (isPack && item.change_qty_pieces % product!.pieces_per_pack === 0) {
      packStr = `\n${sign}${item.change_qty_pieces / product!.pieces_per_pack} Packs`;
    }

    return (
      <View style={[styles.historyRow, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <View style={styles.rowHeader}>
          <Text style={[styles.dateText, { color: theme.textSecondary }]}>{dateStr} · {timeStr}</Text>
          <Text style={[styles.actionText, { color: isAdded ? theme.success : theme.danger }]}>
            {isAdded ? 'Stock Added' : 'Stock Removed'}
          </Text>
        </View>

        <View style={styles.changeBlock}>
          <Text style={[styles.changeQty, { color: isAdded ? theme.success : theme.danger }]}>
            {sign}{item.change_qty_pieces} pcs{packStr}
          </Text>
          <Text style={[styles.stockFlow, { color: theme.textPrimary }]}>
            {item.previous_stock_pieces} → {item.new_stock_pieces} pcs
          </Text>
        </View>

        <View style={[styles.divider, { backgroundColor: theme.border }]} />
        <Text style={[styles.reason, { color: theme.textSecondary }]}>Reason: {item.reason}</Text>
      </View>
    );
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.modalCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={styles.header}>
            <Text style={[styles.title, { color: theme.textPrimary }]}>STOCK HISTORY</Text>
            <TouchableOpacity onPress={onClose} style={{ padding: 4 }}>
              <Ionicons name="close" size={24} color={theme.textSecondary} />
            </TouchableOpacity>
          </View>
          
          <Text style={[styles.subTitle, { color: theme.textSecondary }]}>{product?.name}</Text>

          <FlatList
            data={history}
            keyExtractor={item => item.id}
            renderItem={renderItem}
            contentContainerStyle={{ paddingBottom: 16 }}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={{ padding: 30, alignItems: 'center' }}>
                <Ionicons name="time-outline" size={32} color={theme.textMuted} />
                <Text style={{ color: theme.textSecondary, marginTop: 8 }}>No history found.</Text>
              </View>
            }
          />
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 16 },
  modalCard: { width: '100%', maxWidth: 440, maxHeight: '80%', borderRadius: 16, borderWidth: 1, padding: 20 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 16, fontWeight: '900', letterSpacing: 0.5 },
  subTitle: { fontSize: 13, fontWeight: '600', marginBottom: 16, marginTop: 4 },
  
  historyRow: { padding: 12, borderRadius: 12, borderWidth: 1, marginBottom: 10 },
  rowHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  dateText: { fontSize: 12, fontWeight: '700' },
  actionText: { fontSize: 12, fontWeight: '900' },
  
  changeBlock: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  changeQty: { fontSize: 15, fontWeight: '900' },
  stockFlow: { fontSize: 13, fontWeight: '700' },
  
  divider: { height: 1, marginVertical: 8 },
  reason: { fontSize: 12, fontWeight: '600', fontStyle: 'italic' }
});
