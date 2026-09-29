import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Modal, Platform, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { usePOS } from '../context/POSContext';
import { dbService } from '../database/databaseService';
import { getTheme } from '../theme/theme';
import { PricingType, Product } from '../types';

interface Props {
  visible: boolean;
  product: Product | null;
  defaultCategoryId?: string;
  onClose: () => void;
  onOpenCategoryModal: () => void;
}

export const ProductModal: React.FC<Props> = ({ visible, product, defaultCategoryId, onClose, onOpenCategoryModal }) => {
  const { categories, settings, refreshInventory } = usePOS();
  const theme = getTheme(settings.theme === 'dark');

  const [categoryPickerVisible, setCategoryPickerVisible] = useState(false);
  const [pricingType, setPricingType] = useState<PricingType>('PIECE');
  const [name, setName] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [barcode, setBarcode] = useState('');
  
  const [unitPieceName, setUnitPieceName] = useState('pc');
  const [unitPackName, setUnitPackName] = useState('pack');
  const [piecesPerPack, setPiecesPerPack] = useState('12');

  const [buyingPricePiece, setBuyingPricePiece] = useState('');
  const [buyingPricePack, setBuyingPricePack] = useState('');
  const [sellingPricePiece, setSellingPricePiece] = useState('');
  const [sellingPricePack, setSellingPricePack] = useState('');

  const [stockInput, setStockInput] = useState('');
  const [minStockInput, setMinStockInput] = useState('2');

  useEffect(() => {
    if (product) {
      const pType = product.pricing_type || 'PIECE';
      setPricingType(pType);
      setName(product.name);
      setCategoryId(product.category_id);
      setBarcode(product.barcode || '');
      
      setUnitPieceName(product.unit_piece_name || 'pc');
      setUnitPackName(product.unit_pack_name || 'pack');
      const pPerPack = product.pieces_per_pack || 12;
      setPiecesPerPack(pPerPack.toString());

      setBuyingPricePiece(product.buying_price_piece ? product.buying_price_piece.toString() : '');
      setBuyingPricePack(product.buying_price_pack ? product.buying_price_pack.toString() : '');
      setSellingPricePiece(product.selling_price_piece ? product.selling_price_piece.toString() : '');
      setSellingPricePack(product.selling_price_pack ? product.selling_price_pack.toString() : '');

      if (pType === 'PACK') {
        const packCount = Math.floor((product.stock_pieces || 0) / pPerPack);
        const minPackCount = Math.floor((product.min_stock_pieces || 0) / pPerPack);
        setStockInput(packCount > 0 ? packCount.toString() : '');
        setMinStockInput(minPackCount > 0 ? minPackCount.toString() : '2');
      } else {
        setStockInput(product.stock_pieces ? product.stock_pieces.toString() : '');
        setMinStockInput(product.min_stock_pieces ? product.min_stock_pieces.toString() : '10');
      }
    } else {
      setPricingType('PIECE');
      setName('');
      // Do not auto-select index 0. User must explicitly choose.
      setCategoryId(defaultCategoryId || '');
      setBarcode('');
      setUnitPieceName('Piece');
      setUnitPackName('Pack');
      setPiecesPerPack('12');
      setBuyingPricePiece('');
      setBuyingPricePack('');
      setSellingPricePiece('');
      setSellingPricePack('');
      setStockInput('');
      setMinStockInput('2');
    }
  }, [product, visible, categories, defaultCategoryId]);

  const pPerPackNum = Math.max(1, parseInt(piecesPerPack, 10) || 12);
  const stockNum = parseInt(stockInput, 10) || 0;
  const minStockNum = parseInt(minStockInput, 10) || 0;

  const computedStockPieces = pricingType === 'PACK' ? stockNum * pPerPackNum : stockNum;
  const computedMinStockPieces = pricingType === 'PACK' ? minStockNum * pPerPackNum : minStockNum;

  const bPieceNum = pricingType === 'PIECE'
    ? parseFloat(buyingPricePiece) || 0
    : (parseFloat(buyingPricePack) || 0) / pPerPackNum;

  const sPieceNum = parseFloat(sellingPricePiece) || 0;
  const pieceProfit = sPieceNum - bPieceNum;
  const pieceMargin = sPieceNum > 0 ? ((pieceProfit / sPieceNum) * 100).toFixed(1) : '0';

  const bPackNum = parseFloat(buyingPricePack) || 0;
  const sPackNum = parseFloat(sellingPricePack) || 0;
  const packProfit = sPackNum - bPackNum;
  const packMargin = sPackNum > 0 ? ((packProfit / sPackNum) * 100).toFixed(1) : '0';

  const handleBack = () => {
    Alert.alert('Discard Changes?', 'Are you sure you want to discard unsaved changes?', [
      { text: 'Keep Editing', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: onClose }
    ]);
  };

  const handleSave = async () => {
    if (!categoryId) return Alert.alert('Validation Error', 'Please select a category.');
    if (!name.trim()) return Alert.alert('Error', 'Please enter Product Name.');

    if (pricingType === 'PIECE') {
      if (!buyingPricePiece || !sellingPricePiece) return Alert.alert('Error', 'Enter Buying and Selling Price for Piece.');
    } else {
      if (!buyingPricePack || !sellingPricePiece || !sellingPricePack) return Alert.alert('Error', 'Enter Buying Price (Pack) and Selling Prices.');
    }

    try {
      const bPricePiece = pricingType === 'PIECE' ? parseFloat(buyingPricePiece) || 0 : (parseFloat(buyingPricePack) || 0) / pPerPackNum;
      const bPricePack = pricingType === 'PACK' ? parseFloat(buyingPricePack) || 0 : bPricePiece;
      const sPricePiece = parseFloat(sellingPricePiece) || 0;
      const sPricePack = pricingType === 'PACK' ? parseFloat(sellingPricePack) || 0 : 0;

      const prodData = {
        name: name.trim(),
        category_id: categoryId,
        pricing_type: pricingType,
        unit_piece_name: unitPieceName.trim() || 'Piece',
        unit_pack_name: pricingType === 'PACK' ? (unitPackName.trim() || 'Pack') : '',
        pieces_per_pack: pricingType === 'PACK' ? pPerPackNum : 1,
        buying_price_piece: bPricePiece,
        buying_price_pack: bPricePack,
        selling_price_piece: sPricePiece,
        selling_price_pack: sPricePack,
        stock_pieces: computedStockPieces,
        min_stock_pieces: computedMinStockPieces,
        barcode: barcode.trim()
      };

      if (product) await dbService.updateProduct({ ...product, ...prodData });
      else await dbService.addProduct(prodData);

      await refreshInventory();
      onClose();
    } catch (e: any) {
      Alert.alert('Save Error', e.message);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={handleBack}>
      <SafeAreaView style={[styles.fullScreenContainer, { backgroundColor: theme.bg }]}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <View style={[styles.header, { backgroundColor: theme.surface, borderBottomColor: theme.border }]}>
            <TouchableOpacity style={styles.backBtn} onPress={handleBack}>
              <Ionicons name="arrow-back" size={24} color={theme.textPrimary} />
            </TouchableOpacity>
            <Text style={[styles.title, { color: theme.textPrimary }]}>{product ? 'Edit Product' : 'Add Product'}</Text>
            <TouchableOpacity style={[styles.saveHeaderBtn, { backgroundColor: theme.primary }]} onPress={handleSave}>
              <Text style={styles.saveHeaderBtnText}>Save</Text>
            </TouchableOpacity>
          </View>

          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollBody}>
            {/* 1. PRODUCT SECTION */}
            <View style={[styles.sectionBox, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>1. Product</Text>
              <TextInput
                style={[styles.input, { backgroundColor: theme.bg, color: theme.textPrimary, borderColor: theme.border }]}
                placeholder="Product Name (e.g. Coca-Cola 1.5L)"
                placeholderTextColor={theme.textMuted}
                value={name}
                onChangeText={setName}
              />
              <View style={styles.row}>
                <TouchableOpacity 
                  style={[styles.input, { backgroundColor: theme.bg, borderColor: theme.border, flex: 1, justifyContent: 'center' }]} 
                  onPress={() => setCategoryPickerVisible(true)}
                >
                  <Text style={{ color: categoryId ? theme.textPrimary : theme.textMuted, fontSize: 15, fontWeight: '600' }}>
                    {categoryId ? categories.find(c => c.id === categoryId)?.name || 'Select Category...' : 'Select Category ▼'}
                  </Text>
                </TouchableOpacity>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.bg, color: theme.textPrimary, borderColor: theme.border, flex: 1 }]}
                  placeholder="Barcode (Optional)"
                  placeholderTextColor={theme.textMuted}
                  value={barcode}
                  onChangeText={setBarcode}
                />
              </View>
            </View>

            {/* 2. SELLING UNITS */}
            <View style={[styles.sectionBox, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <View style={styles.row}>
                <Text style={[styles.sectionTitle, { color: theme.textPrimary, flex: 1 }]}>2. Selling Units</Text>
                <View style={styles.typeToggle}>
                  <TouchableOpacity 
                    style={[styles.typeBtn, pricingType === 'PIECE' && { backgroundColor: theme.primary }]} 
                    onPress={() => setPricingType('PIECE')}
                  >
                    <Text style={[styles.typeBtnText, { color: pricingType === 'PIECE' ? '#fff' : theme.textSecondary }]}>Piece Only</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={[styles.typeBtn, pricingType === 'PACK' && { backgroundColor: theme.success }]} 
                    onPress={() => setPricingType('PACK')}
                  >
                    <Text style={[styles.typeBtnText, { color: pricingType === 'PACK' ? '#fff' : theme.textSecondary }]}>Piece + Pack</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.unitRow}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>Piece Name</Text>
                  <TextInput style={[styles.input, { backgroundColor: theme.bg, color: theme.textPrimary, borderColor: theme.border }]} value={unitPieceName} onChangeText={setUnitPieceName} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>Selling Price</Text>
                  <TextInput style={[styles.input, { backgroundColor: theme.bg, color: theme.textPrimary, borderColor: theme.border }]} placeholder="₱0.00" keyboardType="numeric" value={sellingPricePiece} onChangeText={setSellingPricePiece} />
                </View>
              </View>

              {pricingType === 'PACK' && (
                <View style={[styles.unitRow, { marginTop: 8 }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>Pack Name</Text>
                    <TextInput style={[styles.input, { backgroundColor: theme.bg, color: theme.textPrimary, borderColor: theme.border }]} value={unitPackName} onChangeText={setUnitPackName} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>Pcs per Pack</Text>
                    <TextInput style={[styles.input, { backgroundColor: theme.bg, color: theme.textPrimary, borderColor: theme.border }]} keyboardType="numeric" value={piecesPerPack} onChangeText={setPiecesPerPack} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>Selling Price</Text>
                    <TextInput style={[styles.input, { backgroundColor: theme.bg, color: theme.textPrimary, borderColor: theme.border }]} placeholder="₱0.00" keyboardType="numeric" value={sellingPricePack} onChangeText={setSellingPricePack} />
                  </View>
                </View>
              )}
            </View>

            {/* 3. INVENTORY & COSTS */}
            <View style={[styles.sectionBox, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>3. Inventory & Costs</Text>
              
              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>{pricingType === 'PACK' ? 'Buying Cost / Pack' : 'Buying Cost / Piece'}</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: theme.bg, color: theme.textPrimary, borderColor: theme.border }]}
                    placeholder="₱0.00"
                    keyboardType="numeric"
                    value={pricingType === 'PACK' ? buyingPricePack : buyingPricePiece}
                    onChangeText={pricingType === 'PACK' ? setBuyingPricePack : setBuyingPricePiece}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>Initial {pricingType === 'PACK' ? 'Packs' : 'Pieces'}</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: theme.bg, color: theme.textPrimary, borderColor: theme.border }]}
                    placeholder="0"
                    keyboardType="numeric"
                    value={stockInput}
                    onChangeText={setStockInput}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>Min Alert {pricingType === 'PACK' ? 'Packs' : 'Pieces'}</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: theme.bg, color: theme.textPrimary, borderColor: theme.border }]}
                    placeholder="0"
                    keyboardType="numeric"
                    value={minStockInput}
                    onChangeText={setMinStockInput}
                  />
                </View>
              </View>

              {/* Compact Margin Info */}
              {(sPieceNum > 0 && bPieceNum > 0) && (
                <View style={{ flexDirection: 'row', gap: 12, marginTop: 8 }}>
                  <Text style={{ color: pieceProfit >= 0 ? theme.success : theme.danger, fontSize: 12, fontWeight: '700' }}>
                    Piece Margin: {pieceMargin}%
                  </Text>
                  {pricingType === 'PACK' && sPackNum > 0 && (
                    <Text style={{ color: packProfit >= 0 ? theme.success : theme.danger, fontSize: 12, fontWeight: '700' }}>
                      Pack Margin: {packMargin}%
                    </Text>
                  )}
                </View>
              )}
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>

      {/* CATEGORY PICKER MODAL */}
      <Modal visible={categoryPickerVisible} transparent animationType="fade" onRequestClose={() => setCategoryPickerVisible(false)}>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setCategoryPickerVisible(false)}>
          <View style={[styles.pickerBox, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <View style={[styles.pickerHeader, { borderBottomColor: theme.border }]}>
              <Text style={[styles.pickerTitle, { color: theme.textPrimary }]}>Select Category</Text>
              <TouchableOpacity onPress={() => setCategoryPickerVisible(false)}>
                <Ionicons name="close" size={24} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>
            
            {categories.length === 0 ? (
              <View style={{ padding: 20, alignItems: 'center' }}>
                <Text style={{ color: theme.textSecondary, marginBottom: 12 }}>No categories available.</Text>
                <TouchableOpacity onPress={() => { setCategoryPickerVisible(false); onOpenCategoryModal(); }}>
                  <Text style={{ color: theme.accent, fontWeight: 'bold' }}>+ Add Category</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <ScrollView style={{ maxHeight: 300 }}>
                {categories.map(c => (
                  <TouchableOpacity 
                    key={c.id} 
                    style={[styles.pickerRow, categoryId === c.id && { backgroundColor: theme.primaryGlow }]}
                    onPress={() => {
                      setCategoryId(c.id);
                      setCategoryPickerVisible(false);
                    }}
                  >
                    <Ionicons 
                      name={categoryId === c.id ? "checkmark-circle" : "ellipse-outline"} 
                      size={20} 
                      color={categoryId === c.id ? theme.primary : theme.textMuted} 
                    />
                    <Text style={[styles.pickerRowText, { color: theme.textPrimary }, categoryId === c.id && { fontWeight: '800' }]}>
                      {c.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
          </View>
        </TouchableOpacity>
      </Modal>
    </Modal>
  );
};

const styles = StyleSheet.create({
  fullScreenContainer: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1 },
  backBtn: { padding: 4, marginRight: 12 },
  title: { fontSize: 18, fontWeight: '900', flex: 1 },
  saveHeaderBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 },
  saveHeaderBtnText: { color: '#ffffff', fontSize: 14, fontWeight: 'bold' },
  
  scrollBody: { padding: 12, gap: 12 },
  sectionBox: { padding: 16, borderRadius: 12, borderWidth: 1, gap: 12 },
  sectionTitle: { fontSize: 15, fontWeight: '800' },
  
  row: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  unitRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-end' },
  
  input: { height: 44, borderRadius: 8, borderWidth: 1, paddingHorizontal: 12, fontSize: 15, fontWeight: '600' },
  fieldLabel: { fontSize: 11, fontWeight: '800', marginBottom: 4 },
  
  typeToggle: { flexDirection: 'row', borderRadius: 8, overflow: 'hidden', borderWidth: 1, borderColor: '#475569' },
  typeBtn: { paddingHorizontal: 12, paddingVertical: 6 },
  typeBtnText: { fontSize: 12, fontWeight: '800' },

  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 16 },
  pickerBox: { width: '100%', maxWidth: 360, borderRadius: 12, borderWidth: 1, overflow: 'hidden' },
  pickerHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1 },
  pickerTitle: { fontSize: 16, fontWeight: '900' },
  pickerRow: { flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 0.5, borderBottomColor: '#334155' },
  pickerRowText: { fontSize: 15, fontWeight: '600', marginLeft: 12 },
});