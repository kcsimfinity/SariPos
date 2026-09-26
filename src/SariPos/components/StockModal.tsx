import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView
} from 'react-native';
import { usePOS } from '../context/POSContext';
import { Product } from '../types';
import { dbService } from '../database/databaseService';
import { Ionicons } from '@expo/vector-icons';
import { getTheme } from '../theme/theme';

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

  // Pack & Piece Prices State
  const [buyPricePackInput, setBuyPricePackInput] = useState('');
  const [buyPricePieceInput, setBuyPricePieceInput] = useState('');
  const [sellPricePieceInput, setSellPricePieceInput] = useState('');
  const [sellPricePackInput, setSellPricePackInput] = useState('');

  const [reason, setReason] = useState('Stock Received');

  const isPackType = product?.pricing_type === 'PACK';
  const piecesPerPack = product?.pieces_per_pack || 1;

  useEffect(() => {
    if (visible && product) {
      setMode('ADD');
      setInputUnit(product.pricing_type === 'PACK' ? 'PACK' : 'PIECE');
      setQtyInput('');
      setReason('Stock Received');

      const bPack = product.buying_price_pack || 0;
      const bPiece = product.buying_price_piece || 0;
      const sPiece = product.selling_price_piece || 0;
      const sPack = product.selling_price_pack || 0;

      setBuyPricePackInput(bPack ? bPack.toString() : '');
      setBuyPricePieceInput(bPiece ? bPiece.toString() : '');
      setSellPricePieceInput(sPiece ? sPiece.toString() : '');
      setSellPricePackInput(sPack ? sPack.toString() : '');
    }
  }, [visible, product]);

  const parsedQty = parseInt(qtyInput, 10);
  const valQty = isNaN(parsedQty) ? 0 : Math.abs(parsedQty);

  // Computes total pieces being added regardless of if user typed packs or pieces
  const addedPieces = inputUnit === 'PACK' ? valQty * piecesPerPack : valQty;
  const oldStockPieces = product?.stock_pieces || 0;

  const newStockPreview = mode === 'ADD'
    ? oldStockPieces + addedPieces
    : Math.max(0, oldStockPieces - addedPieces);

  // Calculates real-time total investment based on buy price per piece
  const buyCostPerPiece = parseFloat(buyPricePieceInput) || 0;
  const totalRestockInvestment = buyCostPerPiece * addedPieces;

  const reasons = ['Stock Received', 'Damaged / Expired', 'Inventory Loss', 'Manual Audit'];

  const handleBuyPricePackChange = (text: string) => {
    setBuyPricePackInput(text);
    const num = parseFloat(text);
    if (!isNaN(num) && piecesPerPack > 0) {
      setBuyPricePieceInput((num / piecesPerPack).toFixed(2));
    }
  };

  const handleBuyPricePieceChange = (text: string) => {
    setBuyPricePieceInput(text);
    const num = parseFloat(text);
    if (!isNaN(num) && isPackType) {
      setBuyPricePackInput((num * piecesPerPack).toFixed(2));
    }
  };

  // RESTORED MISSING FUNCTION
  const handleSellPricePieceChange = (text: string) => {
    setSellPricePieceInput(text);
    const num = parseFloat(text);
    if (!isNaN(num) && isPackType) {
      setSellPricePackInput((num * piecesPerPack).toFixed(2));
    }
  };

  const handleBack = () => {
    Alert.alert(
      'Discard Changes?',
      'Are you sure you want to go back? Any unsaved restock changes will be lost.',
      [
        { text: 'Keep Editing', style: 'cancel' },
        { text: 'Discard', style: 'destructive', onPress: onClose }
      ]
    );
  };

  const handleConfirm = async () => {
    if (!product) return;

    if (valQty <= 0) {
      Alert.alert('Missing Quantity', 'Please enter how many items or packs you want to add or deduct.');
      return;
    }

    const finalChangePieces = mode === 'ADD' ? addedPieces : -addedPieces;

    if (mode === 'REMOVE' && oldStockPieces < addedPieces) {
      Alert.alert(
        'Stock Error',
        `Cannot deduct ${valQty} ${inputUnit.toLowerCase()}s. Current stock is only ${oldStockPieces} pieces.`
      );
      return;
    }

    try {
      let priceUpdates: any = undefined;

      if (mode === 'ADD') {
        const userBuyPiece = parseFloat(buyPricePieceInput) || 0;
        const userBuyPack = parseFloat(buyPricePackInput) || (userBuyPiece * piecesPerPack);
        const userSellPiece = parseFloat(sellPricePieceInput) || 0;
        const userSellPack = parseFloat(sellPricePackInput) || (userSellPiece * piecesPerPack);

        priceUpdates = {
          new_buying_price_piece: userBuyPiece,
          new_buying_price_pack: userBuyPack,
          new_selling_price_piece: userSellPiece,
          new_selling_price_pack: userSellPack
        };
      }

      await dbService.adjustStock(product.id, finalChangePieces, reason, priceUpdates);
      await refreshInventory();
      onClose();
    } catch (e: any) {
      Alert.alert('Adjustment Error', e.message || 'Failed to update stock.');
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={handleBack}
    >
      <SafeAreaView style={[styles.fullScreenContainer, { backgroundColor: theme.bg }]}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
        >
          {/* TOP NAVIGATION HEADER */}
          <View style={[styles.header, { backgroundColor: theme.surface, borderBottomColor: theme.border }]}>
            <TouchableOpacity style={styles.backBtn} onPress={handleBack} activeOpacity={0.7}>
              <Ionicons name="arrow-back" size={24} color={theme.textPrimary} />
            </TouchableOpacity>

            <View style={styles.headerTitleGroup}>
              <Text style={[styles.title, { color: theme.textPrimary }]}>Restock / Adjust Item</Text>
              <Text style={[styles.sub, { color: theme.textSecondary }]} numberOfLines={1}>
                {product?.name || 'Select Product'} ({isPackType ? `1 Pack = ${piecesPerPack} ${product?.unit_piece_name}s` : 'Piece Mode'})
              </Text>
            </View>

            <TouchableOpacity style={[styles.saveHeaderBtn, { backgroundColor: theme.primary }]} onPress={handleConfirm} activeOpacity={0.8}>
              <Ionicons name="checkmark-sharp" size={16} color="#ffffff" />
              <Text style={styles.saveHeaderBtnText}>Save Stock</Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollBody}
          >
            {/* LIVE STOCK BANNER */}
            <View style={[styles.stockBanner, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <View style={styles.stockCol}>
                <Text style={[styles.stockLabel, { color: theme.textSecondary }]}>CURRENT STOCK</Text>
                <Text style={[styles.stockVal, { color: theme.textPrimary }]}>
                  {oldStockPieces} {product?.unit_piece_name || 'pcs'}
                </Text>
              </View>

              <Ionicons
                name={mode === 'ADD' ? 'arrow-forward-circle' : 'arrow-back-circle'}
                size={28}
                color={mode === 'ADD' ? theme.success : theme.danger}
              />

              <View style={styles.stockCol}>
                <Text style={[styles.stockLabel, { color: theme.textSecondary }]}>NEW TOTAL STOCK</Text>
                <Text style={[styles.stockVal, { color: mode === 'ADD' ? theme.success : theme.danger }]}>
                  {newStockPreview} {product?.unit_piece_name || 'pcs'}
                </Text>
              </View>
            </View>

            {/* STEP 1: SELECT ACTION */}
            <View style={styles.sectionBox}>
              <Text style={[styles.stepLabel, { color: theme.textSecondary }]}>STEP 1: SELECT ACTION</Text>
              <View style={styles.modeContainer}>
                <TouchableOpacity
                  style={[
                    styles.modeTab,
                    { backgroundColor: theme.surface, borderColor: theme.border },
                    mode === 'ADD' && { backgroundColor: theme.success, borderColor: theme.success }
                  ]}
                  onPress={() => setMode('ADD')}
                  activeOpacity={0.8}
                >
                  <Ionicons name="add-circle" size={20} color={mode === 'ADD' ? '#ffffff' : theme.textSecondary} />
                  <Text style={[styles.modeText, { color: mode === 'ADD' ? '#ffffff' : theme.textSecondary }]}>
                    + Add New Stock
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.modeTab,
                    { backgroundColor: theme.surface, borderColor: theme.border },
                    mode === 'REMOVE' && { backgroundColor: theme.danger, borderColor: theme.danger }
                  ]}
                  onPress={() => setMode('REMOVE')}
                  activeOpacity={0.8}
                >
                  <Ionicons name="remove-circle" size={20} color={mode === 'REMOVE' ? '#ffffff' : theme.textSecondary} />
                  <Text style={[styles.modeText, { color: mode === 'REMOVE' ? '#ffffff' : theme.textSecondary }]}>
                    - Deduct Stock
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* STEP 2: QUANTITY INPUT WITH PACK/PIECE UNIT TOGGLE */}
            <View style={styles.sectionBox}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={[styles.stepLabel, { color: theme.textSecondary }]}>
                  STEP 2: ENTER QUANTITY
                </Text>
                {isPackType && (
                  <View style={{ flexDirection: 'row', gap: 6 }}>
                    <TouchableOpacity
                      style={[styles.unitChip, inputUnit === 'PACK' && { backgroundColor: theme.primary }]}
                      onPress={() => setInputUnit('PACK')}
                    >
                      <Text style={[styles.unitChipText, inputUnit === 'PACK' && { color: '#ffffff' }]}>By Packs</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.unitChip, inputUnit === 'PIECE' && { backgroundColor: theme.primary }]}
                      onPress={() => setInputUnit('PIECE')}
                    >
                      <Text style={[styles.unitChipText, inputUnit === 'PIECE' && { color: '#ffffff' }]}>By Pieces</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>

              <TextInput
                style={[styles.bigInput, { backgroundColor: theme.surface, color: theme.textPrimary, borderColor: theme.border }]}
                placeholder={inputUnit === 'PACK' ? 'Type number of packs (e.g. 5)' : 'Type number of pieces (e.g. 10)'}
                keyboardType="numeric"
                placeholderTextColor={theme.textMuted}
                value={qtyInput}
                onChangeText={setQtyInput}
              />

              {valQty > 0 && (
                <View style={[styles.computationBox, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                  <Text style={{ color: theme.accent, fontSize: 12, fontWeight: 'bold' }}>
                    = Restocking {addedPieces} single {product?.unit_piece_name}s
                  </Text>
                  {mode === 'ADD' && buyCostPerPiece > 0 && (
                    <Text style={{ color: theme.success, fontSize: 12, fontWeight: 'bold', marginTop: 2 }}>
                      Total Cost: ₱{totalRestockInvestment.toFixed(2)} (₱{buyCostPerPiece.toFixed(2)} per {product?.unit_piece_name})
                    </Text>
                  )}
                </View>
              )}
            </View>

            {/* STEP 3: COST & PRICE REVIEW */}
            {mode === 'ADD' && (
              <View style={[styles.sectionBox, styles.priceBox, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <Text style={[styles.stepLabel, { color: theme.textSecondary }]}>
                  STEP 3: COST & PRICE REVIEW
                </Text>

                {isPackType ? (
                  <>
                    <View style={styles.inputRowGroup}>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.subLabel, { color: theme.textSecondary }]}>BUY PRICE / PACK (₱)</Text>
                        <TextInput
                          style={[styles.input, { backgroundColor: theme.bg, color: theme.textPrimary, borderColor: theme.border }]}
                          placeholder="0.00"
                          keyboardType="numeric"
                          placeholderTextColor={theme.textMuted}
                          value={buyPricePackInput}
                          onChangeText={handleBuyPricePackChange}
                        />
                      </View>

                      <View style={{ flex: 1 }}>
                        <Text style={[styles.subLabel, { color: theme.textSecondary }]}>DERIVED BUY COST / PIECE</Text>
                        <TextInput
                          style={[styles.input, { backgroundColor: theme.bg, color: theme.textPrimary, borderColor: theme.border }]}
                          placeholder="0.00"
                          keyboardType="numeric"
                          placeholderTextColor={theme.textMuted}
                          value={buyPricePieceInput}
                          onChangeText={handleBuyPricePieceChange}
                        />
                      </View>
                    </View>

                    <View style={styles.inputRowGroup}>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.subLabel, { color: theme.textSecondary }]}>SELL PRICE / PIECE (₱)</Text>
                        <TextInput
                          style={[styles.input, { backgroundColor: theme.bg, color: theme.textPrimary, borderColor: theme.border }]}
                          placeholder="0.00"
                          keyboardType="numeric"
                          placeholderTextColor={theme.textMuted}
                          value={sellPricePieceInput}
                          onChangeText={handleSellPricePieceChange}
                        />
                      </View>

                      <View style={{ flex: 1 }}>
                        <Text style={[styles.subLabel, { color: theme.textSecondary }]}>SELL PRICE / PACK (₱)</Text>
                        <TextInput
                          style={[styles.input, { backgroundColor: theme.bg, color: theme.textPrimary, borderColor: theme.border }]}
                          placeholder="0.00"
                          keyboardType="numeric"
                          placeholderTextColor={theme.textMuted}
                          value={sellPricePackInput}
                          onChangeText={setSellPricePackInput}
                        />
                      </View>
                    </View>
                  </>
                ) : (
                  <View style={styles.inputRowGroup}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.subLabel, { color: theme.textSecondary }]}>BUY PRICE / PIECE (₱)</Text>
                      <TextInput
                        style={[styles.input, { backgroundColor: theme.bg, color: theme.textPrimary, borderColor: theme.border }]}
                        placeholder="0.00"
                        keyboardType="numeric"
                        placeholderTextColor={theme.textMuted}
                        value={buyPricePieceInput}
                        onChangeText={setBuyPricePieceInput}
                      />
                    </View>

                    <View style={{ flex: 1 }}>
                      <Text style={[styles.subLabel, { color: theme.textSecondary }]}>SELL PRICE / PIECE (₱)</Text>
                      <TextInput
                        style={[styles.input, { backgroundColor: theme.bg, color: theme.textPrimary, borderColor: theme.border }]}
                        placeholder="0.00"
                        keyboardType="numeric"
                        placeholderTextColor={theme.textMuted}
                        value={sellPricePieceInput}
                        onChangeText={setSellPricePieceInput}
                      />
                    </View>
                  </View>
                )}
              </View>
            )}

            {/* STEP 4: REASON SELECTOR */}
            <View style={styles.sectionBox}>
              <Text style={[styles.stepLabel, { color: theme.textSecondary }]}>STEP 4: REASON FOR ADJUSTMENT</Text>
              <View style={styles.reasonsRow}>
                {reasons.map(r => (
                  <TouchableOpacity
                    key={r}
                    style={[
                      styles.reasonChip,
                      { backgroundColor: theme.surface, borderColor: theme.border },
                      reason === r && { backgroundColor: theme.primary, borderColor: theme.primary }
                    ]}
                    onPress={() => setReason(r)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.reasonText, { color: reason === r ? '#ffffff' : theme.textSecondary }]}>
                      {r}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  fullScreenContainer: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, gap: 12 },
  backBtn: { padding: 4 },
  headerTitleGroup: { flex: 1 },
  title: { fontSize: 16, fontWeight: 'bold' },
  sub: { fontSize: 12, marginTop: 2 },
  saveHeaderBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8 },
  saveHeaderBtnText: { color: '#ffffff', fontSize: 14, fontWeight: 'bold' },
  scrollBody: { padding: 16, gap: 16, paddingBottom: 24 },
  stockBanner: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', padding: 16, borderRadius: 12, borderWidth: 1 },
  stockCol: { alignItems: 'center' },
  stockLabel: { fontSize: 10, fontWeight: 'bold', letterSpacing: 0.6 },
  stockVal: { fontSize: 16, fontWeight: 'bold', marginTop: 4 },
  sectionBox: { gap: 6 },
  stepLabel: { fontSize: 12, fontWeight: 'bold', letterSpacing: 0.6, marginBottom: 2 },
  subLabel: { fontSize: 10, fontWeight: 'bold', letterSpacing: 0.5, marginBottom: 4 },
  modeContainer: { flexDirection: 'row', gap: 12 },
  modeTab: { flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, height: 48, borderRadius: 10, borderWidth: 1 },
  modeText: { fontSize: 14, fontWeight: 'bold' },
  bigInput: { paddingHorizontal: 16, height: 48, borderRadius: 10, borderWidth: 1, fontSize: 16, fontWeight: 'bold' },
  unitChip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  unitChipText: { fontSize: 11, fontWeight: 'bold', color: '#94a3b8' },
  computationBox: { padding: 10, borderRadius: 8, borderWidth: 1, marginTop: 4 },
  priceBox: { padding: 14, borderRadius: 12, borderWidth: 1, gap: 10 },
  inputRowGroup: { flexDirection: 'row', gap: 14 },
  input: { paddingHorizontal: 16, height: 44, borderRadius: 10, borderWidth: 1, fontSize: 14, fontWeight: 'bold' },
  reasonsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  reasonChip: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, borderWidth: 1 },
  reasonText: { fontSize: 12, fontWeight: 'bold' }
});