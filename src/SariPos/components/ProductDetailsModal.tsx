import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Alert, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { usePOS } from '../context/POSContext';
import { dbService } from '../database/databaseService';
import { getTheme } from '../theme/theme';
import { Product } from '../types';

interface Props {
  visible: boolean;
  product: Product | null;
  onClose: () => void;
  onEdit: () => void;
  onAdjustStock: () => void;
  onViewHistory: () => void;
}

export const ProductDetailsModal: React.FC<Props> = ({ visible, product, onClose, onEdit, onAdjustStock, onViewHistory }) => {
  const { settings, refreshInventory } = usePOS();
  const theme = getTheme(settings.theme === 'dark');

  if (!product) return null;

  const isPack = product.pricing_type === 'PACK' && product.pieces_per_pack > 0;
  const packs = isPack ? Math.floor(product.stock_pieces / product.pieces_per_pack) : 0;
  const remainder = isPack ? product.stock_pieces % product.pieces_per_pack : 0;
  const isOut = product.stock_pieces < 1;
  const isLow = product.stock_pieces <= product.min_stock_pieces && !isOut;

  const handleDeactivate = () => {
    Alert.alert('Deactivate Product', `Are you sure you want to deactivate "${product.name}"? It will no longer appear in the POS, but historical sales will be preserved.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Deactivate',
        style: 'destructive',
        onPress: async () => {
          try {
            await dbService.deleteProduct(product.id);
            await refreshInventory();
            onClose();
          } catch (e: any) {
            Alert.alert('Error', e.message);
          }
        }
      }
    ]);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.modalCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={styles.header}>
            <Text style={[styles.title, { color: theme.textPrimary }]} numberOfLines={2}>
              {product.name}
            </Text>
            <TouchableOpacity onPress={onClose} style={{ padding: 4 }}>
              <Ionicons name="close" size={24} color={theme.textSecondary} />
            </TouchableOpacity>
          </View>

          <View style={[styles.body, { flexDirection: 'row', gap: 24 }]}>
            
            <View style={{ flex: 1.2, gap: 12 }}>
              <View style={styles.infoRow}>
                <Text style={[styles.label, { color: theme.textSecondary }]}>CATEGORY</Text>
                <Text style={[styles.val, { color: theme.textPrimary }]}>{product.category_name || 'Uncategorized'}</Text>
              </View>

              <View style={[styles.divider, { backgroundColor: theme.border }]} />

              <View style={styles.infoRow}>
                <Text style={[styles.label, { color: theme.textSecondary }]}>SELLING UNITS</Text>
                <View style={styles.valCol}>
                  <Text style={[styles.val, { color: theme.textPrimary }]}>
                    {product.unit_piece_name || 'Piece'}   ₱{product.selling_price_piece.toFixed(2)}
                  </Text>
                  {isPack && (
                    <>
                      <Text style={[styles.val, { color: theme.textPrimary, marginTop: 4 }]}>
                        {product.unit_pack_name || 'Pack'}   ₱{product.selling_price_pack.toFixed(2)}
                      </Text>
                      <Text style={[styles.subVal, { color: theme.textSecondary }]}>
                        1 {product.unit_pack_name || 'Pack'} = {product.pieces_per_pack} {product.unit_piece_name || 'Pieces'}
                      </Text>
                    </>
                  )}
                </View>
              </View>

              <View style={[styles.divider, { backgroundColor: theme.border }]} />

              <View style={styles.infoRow}>
                <Text style={[styles.label, { color: theme.textSecondary }]}>INVENTORY</Text>
                <View style={styles.valCol}>
                  <Text style={[styles.val, { color: theme.textPrimary }]}>
                    {product.stock_pieces} {product.unit_piece_name || 'Pieces'}
                  </Text>
                  {isPack && (
                    <Text style={[styles.subVal, { color: theme.textSecondary }]}>
                      {packs} {product.unit_pack_name || 'Packs'} {remainder > 0 ? `+ ${remainder} ${product.unit_piece_name || 'Pieces'}` : ''}
                    </Text>
                  )}
                </View>
              </View>

              <View style={styles.infoRow}>
                <Text style={[styles.label, { color: theme.textSecondary }]}>COST</Text>
                <Text style={[styles.val, { color: theme.textPrimary }]}>₱{product.buying_price_piece.toFixed(2)} / {product.unit_piece_name || 'Piece'}</Text>
              </View>

              <View style={styles.infoRow}>
                <Text style={[styles.label, { color: theme.textSecondary }]}>MIN STOCK</Text>
                <Text style={[styles.val, { color: theme.textPrimary }]}>{product.min_stock_pieces} {product.unit_piece_name || 'Pieces'}</Text>
              </View>

              <View style={styles.infoRow}>
                <Text style={[styles.label, { color: theme.textSecondary }]}>STATUS</Text>
                <View style={[styles.badge, { backgroundColor: isOut ? theme.dangerGlow : isLow ? theme.warningGlow : theme.successGlow }]}>
                  <Text style={[styles.badgeText, { color: isOut ? theme.danger : isLow ? theme.warning : theme.success }]}>
                    {isOut ? 'OUT OF STOCK' : isLow ? 'LOW STOCK' : 'IN STOCK'}
                  </Text>
                </View>
              </View>
            </View>

            <View style={[styles.actions, { flex: 1, marginTop: 0 }]}>
              <TouchableOpacity style={[styles.btn, { backgroundColor: theme.primary }]} onPress={() => { onClose(); onEdit(); }}>
                <Ionicons name="create" size={16} color="#ffffff" />
                <Text style={[styles.btnText, { color: '#ffffff' }]}>Edit Product</Text>
              </TouchableOpacity>

              <TouchableOpacity style={[styles.btn, { backgroundColor: theme.surfaceElevated }]} onPress={() => { onClose(); onAdjustStock(); }}>
                <Ionicons name="swap-vertical" size={16} color={theme.textPrimary} />
                <Text style={[styles.btnText, { color: theme.textPrimary }]}>Stock Adjustment</Text>
              </TouchableOpacity>

              <TouchableOpacity style={[styles.btn, { backgroundColor: theme.surfaceElevated }]} onPress={() => { onClose(); onViewHistory(); }}>
                <Ionicons name="time" size={16} color={theme.textPrimary} />
                <Text style={[styles.btnText, { color: theme.textPrimary }]}>Stock History</Text>
              </TouchableOpacity>
              
              <View style={{ flex: 1 }} />

              <TouchableOpacity style={[styles.btn, { backgroundColor: theme.dangerGlow }]} onPress={handleDeactivate}>
                <Ionicons name="trash" size={16} color={theme.danger} />
                <Text style={[styles.btnText, { color: theme.danger }]}>Deactivate</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 16 },
  modalCard: { width: '100%', maxWidth: 600, borderRadius: 16, borderWidth: 1, padding: 20 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  title: { fontSize: 18, fontWeight: '900', flex: 1, paddingRight: 12 },
  body: { gap: 12 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  label: { fontSize: 12, fontWeight: '800', width: 100, marginTop: 2 },
  valCol: { flex: 1, alignItems: 'flex-end' },
  val: { fontSize: 14, fontWeight: '700', textAlign: 'right' },
  subVal: { fontSize: 12, marginTop: 2, textAlign: 'right' },
  divider: { height: 1, marginVertical: 4 },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  badgeText: { fontSize: 11, fontWeight: '800' },
  actions: { marginTop: 16, gap: 8 },
  btn: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, height: 44, borderRadius: 10 },
  btnText: { fontSize: 14, fontWeight: '800' },
});
