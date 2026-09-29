import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Modal, Platform, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { usePOS } from '../context/POSContext';
import { dbService } from '../database/databaseService';
import { getTheme } from '../theme/theme';
import { Product } from '../types';

interface Props {
  visible: boolean;
  product: Product | null;
  onClose: () => void;
}

export const StockModal: React.FC<Props> = ({ visible, product, onClose }) => {
  const { settings, refreshInventory } = usePOS();
  const theme = getTheme(settings.theme === 'dark');

  const [mode, setMode] = useState<'ADD' | 'REMOVE'>('ADD');
  const [inputUnit, setInputUnit] = useState<'PACK' | 'PIECE'>('PACK');
  const [qtyInput, setQtyInput] = useState('');
  
  const [buyPriceInput, setBuyPriceInput] = useState('');
  const [reason, setReason] = useState('Stock Received');

  const isPack = product?.pricing_type === 'PACK';
  const piecesPerPack = product?.pieces_per_pack || 1;

  useEffect(() => {
    if (visible && product) {
      setMode('ADD');
      setInputUnit(isPack ? 'PACK' : 'PIECE');
      setQtyInput('');
      setReason('Stock Received');
      
      const defaultBuyPrice = isPack 
        ? (product.buying_price_pack || (product.buying_price_piece * piecesPerPack))
        : product.buying_price_piece;
        
      setBuyPriceInput(defaultBuyPrice ? defaultBuyPrice.toString() : '');
    }
  }, [visible, product]);

  const valQty = parseInt(qtyInput, 10) || 0;
  const addedPieces = inputUnit === 'PACK' ? valQty * piecesPerPack : valQty;
  const oldStockPieces = product?.stock_pieces || 0;
  
  const newStockPreview = mode === 'ADD' 
    ? oldStockPieces + addedPieces 
    : Math.max(0, oldStockPieces - addedPieces);

  const buyCostPerUnit = parseFloat(buyPriceInput) || 0;
  const totalInvestment = buyCostPerUnit * valQty;

  const handleConfirm = async () => {
    if (!product) return;
    if (valQty <= 0) return Alert.alert('Error', 'Enter a quantity.');
    if (mode === 'REMOVE' && oldStockPieces < addedPieces) {
      return Alert.alert('Stock Error', `Cannot deduct ${addedPieces} pieces. Current stock is ${oldStockPieces}.`);
    }

    try {
      let priceUpdates: any = undefined;
      
      if (mode === 'ADD') {
        const unitBuyPiece = inputUnit === 'PACK' ? (buyCostPerUnit / piecesPerPack) : buyCostPerUnit;
        const unitBuyPack = inputUnit === 'PACK' ? buyCostPerUnit : (buyCostPerUnit * piecesPerPack);
        
        priceUpdates = {
          new_buying_price_piece: unitBuyPiece,
          new_buying_price_pack: isPack ? unitBuyPack : undefined
        };
      }

      const finalChangePieces = mode === 'ADD' ? addedPieces : -addedPieces;
      await dbService.adjustStock(product.id, finalChangePieces, reason, priceUpdates);
      await refreshInventory();
      onClose();
    } catch (e: any) {
      Alert.alert('Adjustment Error', e.message);
    }
  };

  if (!product) return null;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="formSheet" onRequestClose={onClose}>
      <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <View style={[styles.header, { backgroundColor: theme.surface, borderBottomColor: theme.border }]}>
            <TouchableOpacity style={styles.backBtn} onPress={onClose}>
              <Ionicons name="close" size={24} color={theme.textPrimary} />
            </TouchableOpacity>
            <View style={styles.headerTitleGroup}>
              <Text style={[styles.title, { color: theme.textPrimary }]}>Stock Adjustment</Text>
              <Text style={[styles.subTitle, { color: theme.textSecondary }]} numberOfLines={1}>{product.name}</Text>
            </View>
            <TouchableOpacity style={[styles.saveBtn, { backgroundColor: theme.primary }]} onPress={handleConfirm}>
              <Text style={styles.saveBtnText}>Save</Text>
            </TouchableOpacity>
          </View>

          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.body}>
            
            <View style={styles.modeToggle}>
              <TouchableOpacity 
                style={[styles.modeBtn, mode === 'ADD' && { backgroundColor: theme.success }]} 
                onPress={() => { setMode('ADD'); setReason('Stock Received'); }}
              >
                <Text style={[styles.modeBtnText, { color: mode === 'ADD' ? '#fff' : theme.textSecondary }]}>Add Stock</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.modeBtn, mode === 'REMOVE' && { backgroundColor: theme.danger }]} 
                onPress={() => { setMode('REMOVE'); setReason('Damaged / Expired'); }}
              >
                <Text style={[styles.modeBtnText, { color: mode === 'REMOVE' ? '#fff' : theme.textSecondary }]}>Remove Stock</Text>
              </TouchableOpacity>
            </View>

            <View style={[styles.section, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <View style={styles.rowBetween}>
                <Text style={[styles.label, { color: theme.textSecondary }]}>ADD AS:</Text>
                {isPack && (
                  <View style={styles.unitToggle}>
                    <TouchableOpacity 
                      style={[styles.unitBtn, inputUnit === 'PIECE' && { backgroundColor: theme.primary }]} 
                      onPress={() => setInputUnit('PIECE')}
                    >
                      <Text style={{ color: inputUnit === 'PIECE' ? '#fff' : theme.textSecondary, fontSize: 13, fontWeight: '700' }}>Pieces</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={[styles.unitBtn, inputUnit === 'PACK' && { backgroundColor: theme.primary }]} 
                      onPress={() => setInputUnit('PACK')}
                    >
                      <Text style={{ color: inputUnit === 'PACK' ? '#fff' : theme.textSecondary, fontSize: 13, fontWeight: '700' }}>Packs</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>

              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.label, { color: theme.textSecondary }]}>QUANTITY</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: theme.bg, color: theme.textPrimary, borderColor: theme.border }]}
                    keyboardType="numeric"
                    placeholder="0"
                    value={qtyInput}
                    onChangeText={setQtyInput}
                  />
                </View>
                {mode === 'ADD' && (
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.label, { color: theme.textSecondary }]}>BUYING COST / {inputUnit}</Text>
                    <TextInput
                      style={[styles.input, { backgroundColor: theme.bg, color: theme.textPrimary, borderColor: theme.border }]}
                      keyboardType="numeric"
                      placeholder="0.00"
                      value={buyPriceInput}
                      onChangeText={setBuyPriceInput}
                    />
                  </View>
                )}
              </View>
              
              {valQty > 0 && (
                <View style={[styles.summaryBox, { backgroundColor: theme.bg, borderColor: theme.border }]}>
                  <Text style={{ color: mode === 'ADD' ? theme.success : theme.danger, fontSize: 14, fontWeight: '800' }}>
                    {mode === 'ADD' ? '+' : '-'}{addedPieces} {product.unit_piece_name || 'pieces'}
                  </Text>
                  <Text style={{ color: theme.textPrimary, fontSize: 14, fontWeight: '800', marginTop: 4 }}>
                    Stock: {oldStockPieces} → {newStockPreview} pieces
                  </Text>
                  {(mode === 'ADD' && buyCostPerUnit > 0) && (
                    <Text style={{ color: theme.textSecondary, fontSize: 12, marginTop: 6 }}>
                      Total Cost: ₱{totalInvestment.toFixed(2)} (Avg Cost will update)
                    </Text>
                  )}
                </View>
              )}
            </View>

            <View style={[styles.section, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <Text style={[styles.label, { color: theme.textSecondary }]}>REASON</Text>
              <TextInput
                style={[styles.input, { backgroundColor: theme.bg, color: theme.textPrimary, borderColor: theme.border }]}
                value={reason}
                onChangeText={setReason}
              />
            </View>

          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1 },
  backBtn: { padding: 4, marginRight: 12 },
  headerTitleGroup: { flex: 1 },
  title: { fontSize: 18, fontWeight: '900' },
  subTitle: { fontSize: 13, fontWeight: '600', marginTop: 2 },
  saveBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 },
  saveBtnText: { color: '#ffffff', fontSize: 14, fontWeight: 'bold' },
  
  body: { padding: 16, gap: 16 },
  
  modeToggle: { flexDirection: 'row', borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: '#334155' },
  modeBtn: { flex: 1, paddingVertical: 12, alignItems: 'center' },
  modeBtnText: { fontSize: 14, fontWeight: '800' },
  
  section: { padding: 16, borderRadius: 12, borderWidth: 1, gap: 12 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  row: { flexDirection: 'row', gap: 12 },
  label: { fontSize: 12, fontWeight: '800', marginBottom: 4 },
  input: { height: 44, borderRadius: 8, borderWidth: 1, paddingHorizontal: 12, fontSize: 15, fontWeight: '600' },
  
  unitToggle: { flexDirection: 'row', borderRadius: 8, overflow: 'hidden', borderWidth: 1, borderColor: '#475569' },
  unitBtn: { paddingHorizontal: 12, paddingVertical: 6 },
  
  summaryBox: { padding: 12, borderRadius: 8, borderWidth: 1, marginTop: 4 }
});