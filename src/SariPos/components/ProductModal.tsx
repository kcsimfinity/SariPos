import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { usePOS } from '../context/POSContext';
import { Product, PricingType } from '../types';
import { dbService } from '../database/databaseService';
import { Ionicons } from '@expo/vector-icons';
import { getTheme } from '../theme/theme';

interface Props {
  visible: boolean;
  product: Product | null;
  defaultCategoryId?: string;
  onClose: () => void;
  onOpenCategoryModal: () => void;
}

export const ProductModal: React.FC<Props> = ({
  visible,
  product,
  defaultCategoryId,
  onClose,
  onOpenCategoryModal
}) => {
  const { categories, settings, refreshInventory } = usePOS();
  const theme = getTheme(settings.theme === 'dark');

  const [pricingType, setPricingType] = useState<PricingType>('PIECE');
  const [name, setName] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [unitPieceName, setUnitPieceName] = useState('pc');
  const [unitPackName, setUnitPackName] = useState('pack');
  const [piecesPerPack, setPiecesPerPack] = useState('12');

  const [buyingPricePiece, setBuyingPricePiece] = useState('');
  const [buyingPricePack, setBuyingPricePack] = useState('');
  const [sellingPricePiece, setSellingPricePiece] = useState('');
  const [sellingPricePack, setSellingPricePack] = useState('');

  const [stockInput, setStockInput] = useState('');
  const [minStockInput, setMinStockInput] = useState('2');
  const [barcode, setBarcode] = useState('');

  useEffect(() => {
    if (product) {
      const pType = product.pricing_type || 'PIECE';
      setPricingType(pType);
      setName(product.name);
      setCategoryId(product.category_id);
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

      setBarcode(product.barcode || '');
    } else {
      setPricingType('PIECE');
      setName('');
      setCategoryId(defaultCategoryId || categories[0]?.id || '');
      setUnitPieceName('pc');
      setUnitPackName('pack');
      setPiecesPerPack('12');
      setBuyingPricePiece('');
      setBuyingPricePack('');
      setSellingPricePiece('');
      setSellingPricePack('');
      setStockInput('');
      setMinStockInput('2');
      setBarcode('');
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
    Alert.alert(
      'Discard Changes?',
      'Are you sure you want to go back? Any unsaved changes will be lost.',
      [
        { text: 'Keep Editing', style: 'cancel' },
        { text: 'Discard', style: 'destructive', onPress: onClose }
      ]
    );
  };

  const handleSave = async () => {
    if (!categoryId) {
      Alert.alert('Category Required', 'Please select or create a category first.');
      return;
    }

    if (!name.trim()) {
      Alert.alert('Validation Error', 'Please enter Product Name.');
      return;
    }

    if (pricingType === 'PIECE') {
      if (!buyingPricePiece || !sellingPricePiece) {
        Alert.alert('Validation Error', 'Please enter Buying Price and Selling Price for Per Piece product.');
        return;
      }
    } else {
      if (!buyingPricePack || !sellingPricePiece || !sellingPricePack) {
        Alert.alert('Validation Error', 'Please enter Buy Price (Pack), Sell Price (Piece), and Sell Price (Pack).');
        return;
      }
    }

    try {
      const bPricePiece = pricingType === 'PIECE'
        ? parseFloat(buyingPricePiece) || 0
        : (parseFloat(buyingPricePack) || 0) / pPerPackNum;

      const bPricePack = pricingType === 'PACK' ? (parseFloat(buyingPricePack) || 0) : bPricePiece;
      const sPricePiece = parseFloat(sellingPricePiece) || 0;
      const sPricePack = pricingType === 'PACK' ? (parseFloat(sellingPricePack) || 0) : 0;

      const prodData = {
        name: name.trim(),
        category_id: categoryId,
        pricing_type: pricingType,
        unit_piece_name: unitPieceName.trim() || 'pc',
        unit_pack_name: pricingType === 'PACK' ? (unitPackName.trim() || 'pack') : '',
        pieces_per_pack: pricingType === 'PACK' ? pPerPackNum : 1,
        buying_price_piece: bPricePiece,
        buying_price_pack: bPricePack,
        selling_price_piece: sPricePiece,
        selling_price_pack: sPricePack,
        stock_pieces: computedStockPieces,
        min_stock_pieces: computedMinStockPieces,
        barcode: barcode.trim()
      };

      if (product) {
        await dbService.updateProduct({ ...product, ...prodData });
      } else {
        await dbService.addProduct(prodData);
      }

      await refreshInventory();
      onClose();
    } catch (e: any) {
      Alert.alert('Save Error', e.message);
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
          {/* 1. TOP NAVIGATION HEADER */}
          <View style={[styles.header, { backgroundColor: theme.surface, borderBottomColor: theme.border }]}>
            <TouchableOpacity style={styles.backBtn} onPress={handleBack} activeOpacity={0.7}>
              <Ionicons name="arrow-back" size={24} color={theme.textPrimary} />
            </TouchableOpacity>

            <View style={styles.headerTitleGroup}>
              <Text style={[styles.title, { color: theme.textPrimary }]}>
                {product ? 'Edit Product Catalog' : 'Add New Inventory Product'}
              </Text>
              <Text style={[styles.sub, { color: theme.textSecondary }]} numberOfLines={1}>
                Configure prices, pack conversions, and stock levels.
              </Text>
            </View>

            <TouchableOpacity style={[styles.saveHeaderBtn, { backgroundColor: theme.primary }]} onPress={handleSave} activeOpacity={0.8}>
              <Ionicons name="checkmark-sharp" size={16} color="#ffffff" />
              <Text style={styles.saveHeaderBtnText}>Save</Text>
            </TouchableOpacity>
          </View>

          {/* 2. SCROLLABLE PAGE BODY */}
          <ScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollBody}
          >
            {/* PRICING MODE SELECTOR */}
            <View style={styles.sectionBox}>
              <Text style={[styles.stepLabel, { color: theme.textSecondary }]}>1. SELECT PRODUCT PRICING MODE</Text>
              <View style={styles.typeGrid}>
                <TouchableOpacity
                  style={[
                    styles.typeCard,
                    { backgroundColor: theme.surface, borderColor: theme.border },
                    pricingType === 'PIECE' && { borderColor: theme.primary, backgroundColor: theme.primaryGlow }
                  ]}
                  onPress={() => setPricingType('PIECE')}
                  activeOpacity={0.8}
                >
                  <Ionicons name="cube-outline" size={24} color={pricingType === 'PIECE' ? theme.accent : theme.textSecondary} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.typeCardTitle, { color: theme.textPrimary }]}>Per Piece Only</Text>
                    <Text style={[styles.typeCardSub, { color: theme.textSecondary }]}>Items sold as single units (canned goods, drinks).</Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.typeCard,
                    { backgroundColor: theme.surface, borderColor: theme.border },
                    pricingType === 'PACK' && { borderColor: theme.success, backgroundColor: theme.successGlow }
                  ]}
                  onPress={() => setPricingType('PACK')}
                  activeOpacity={0.8}
                >
                  <Ionicons name="layers-outline" size={24} color={pricingType === 'PACK' ? theme.success : theme.textSecondary} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.typeCardTitle, { color: theme.textPrimary }]}>Per Pack & Piece</Text>
                    <Text style={[styles.typeCardSub, { color: theme.textSecondary }]}>Items bought in packs, sold as pieces or packs.</Text>
                  </View>
                </TouchableOpacity>
              </View>
            </View>

            {/* PRODUCT IDENTITY */}
            <View style={styles.sectionBox}>
              <Text style={[styles.stepLabel, { color: theme.textSecondary }]}>2. PRODUCT IDENTITY</Text>

              <View style={styles.inputGroup}>
                <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>PRODUCT NAME *</Text>
                <TextInput
                  style={[styles.bigInput, { backgroundColor: theme.surface, color: theme.textPrimary, borderColor: theme.border }]}
                  placeholder="e.g. Lucky Me Pancit Canton Chilimansi"
                  placeholderTextColor={theme.textMuted}
                  value={name}
                  onChangeText={setName}
                />
              </View>

              <View style={styles.inputGroup}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>
                    CATEGORY {defaultCategoryId && defaultCategoryId !== 'ALL' ? '(LOCKED TO CURRENT PAGE)' : '*'}
                  </Text>
                  {!defaultCategoryId && (
                    <TouchableOpacity onPress={() => { onClose(); onOpenCategoryModal(); }}>
                      <Text style={{ color: theme.accent, fontSize: 12, fontWeight: 'bold' }}>+ New Category</Text>
                    </TouchableOpacity>
                  )}
                </View>

                {categories.length === 0 ? (
                  <TouchableOpacity
                    style={[styles.emptyCatBtn, { borderColor: theme.danger }]}
                    onPress={() => { onClose(); onOpenCategoryModal(); }}
                  >
                    <Text style={{ color: theme.danger, fontSize: 12, fontWeight: 'bold' }}>No Categories. Click to Create One.</Text>
                  </TouchableOpacity>
                ) : (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                    {categories.map(c => {
                      const isLocked = defaultCategoryId && defaultCategoryId !== 'ALL' && defaultCategoryId === c.id;
                      const isDisabled = defaultCategoryId && defaultCategoryId !== 'ALL' && defaultCategoryId !== c.id;

                      if (isDisabled) return null;

                      return (
                        <TouchableOpacity
                          key={c.id}
                          style={[
                            styles.chip,
                            { backgroundColor: theme.surface, borderColor: theme.border },
                            (categoryId === c.id || isLocked) && { backgroundColor: theme.primary, borderColor: theme.primary }
                          ]}
                          disabled={Boolean(isLocked)}
                          onPress={() => setCategoryId(c.id)}
                        >
                          <Text style={[styles.chipText, { color: (categoryId === c.id || isLocked) ? '#ffffff' : theme.textSecondary }]}>
                            {c.name} {isLocked ? '✓' : ''}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                )}
              </View>

              <View style={styles.flexRow}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>PIECE UNIT NAME</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: theme.surface, color: theme.textPrimary, borderColor: theme.border }]}
                    placeholder="e.g. pc, sachet"
                    placeholderTextColor={theme.textMuted}
                    value={unitPieceName}
                    onChangeText={setUnitPieceName}
                  />
                </View>

                {pricingType === 'PACK' && (
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>PACK UNIT NAME</Text>
                    <TextInput
                      style={[styles.input, { backgroundColor: theme.surface, color: theme.textPrimary, borderColor: theme.border }]}
                      placeholder="e.g. pack, box"
                      placeholderTextColor={theme.textMuted}
                      value={unitPackName}
                      onChangeText={setUnitPackName}
                    />
                  </View>
                )}
              </View>

              <View style={styles.inputGroup}>
                <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>BARCODE (OPTIONAL)</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.surface, color: theme.textPrimary, borderColor: theme.border }]}
                  placeholder="Scan or enter barcode"
                  placeholderTextColor={theme.textMuted}
                  value={barcode}
                  onChangeText={setBarcode}
                />
              </View>
            </View>

            {/* PRICING & MARGINS */}
            <View style={styles.sectionBox}>
              <Text style={[styles.stepLabel, { color: theme.textSecondary }]}>3. PRICING & MARGINS</Text>

              {pricingType === 'PIECE' ? (
                <View style={styles.flexRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>BUY PRICE / PIECE (₱) *</Text>
                    <TextInput
                      style={[styles.input, { backgroundColor: theme.surface, color: theme.textPrimary, borderColor: theme.border }]}
                      placeholder="12.00"
                      keyboardType="numeric"
                      placeholderTextColor={theme.textMuted}
                      value={buyingPricePiece}
                      onChangeText={setBuyingPricePiece}
                    />
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>SELL PRICE / PIECE (₱) *</Text>
                    <TextInput
                      style={[styles.input, { backgroundColor: theme.surface, color: theme.textPrimary, borderColor: theme.border }]}
                      placeholder="15.00"
                      keyboardType="numeric"
                      placeholderTextColor={theme.textMuted}
                      value={sellingPricePiece}
                      onChangeText={setSellingPricePiece}
                    />
                  </View>
                </View>
              ) : (
                <>
                  <View style={styles.flexRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>PIECES IN 1 PACK *</Text>
                      <TextInput
                        style={[styles.input, { backgroundColor: theme.surface, color: theme.textPrimary, borderColor: theme.border }]}
                        placeholder="12"
                        keyboardType="numeric"
                        placeholderTextColor={theme.textMuted}
                        value={piecesPerPack}
                        onChangeText={setPiecesPerPack}
                      />
                    </View>

                    <View style={{ flex: 1 }}>
                      <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>BUY PRICE / PACK (₱) *</Text>
                      <TextInput
                        style={[styles.input, { backgroundColor: theme.surface, color: theme.textPrimary, borderColor: theme.border }]}
                        placeholder="120.00"
                        keyboardType="numeric"
                        placeholderTextColor={theme.textMuted}
                        value={buyingPricePack}
                        onChangeText={setBuyingPricePack}
                      />
                    </View>
                  </View>

                  <View style={styles.flexRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>SELL PRICE / PIECE (₱) *</Text>
                      <TextInput
                        style={[styles.input, { backgroundColor: theme.surface, color: theme.textPrimary, borderColor: theme.border }]}
                        placeholder="12.00"
                        keyboardType="numeric"
                        placeholderTextColor={theme.textMuted}
                        value={sellingPricePiece}
                        onChangeText={setSellingPricePiece}
                      />
                    </View>

                    <View style={{ flex: 1 }}>
                      <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>SELL PRICE / PACK (₱) *</Text>
                      <TextInput
                        style={[styles.input, { backgroundColor: theme.surface, color: theme.textPrimary, borderColor: theme.border }]}
                        placeholder="130.00"
                        keyboardType="numeric"
                        placeholderTextColor={theme.textMuted}
                        value={sellingPricePack}
                        onChangeText={setSellingPricePack}
                      />
                    </View>
                  </View>
                </>
              )}

              {/* PROFIT MARGIN ESTIMATOR */}
              <View style={[styles.profitWidget, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <Text style={[styles.profitTitle, { color: theme.textSecondary }]}>ESTIMATED MARGINS</Text>
                <View style={styles.flexRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.profitSub, { color: theme.textSecondary }]}>Piece Profit:</Text>
                    <Text style={[styles.profitVal, { color: pieceProfit >= 0 ? theme.success : theme.danger }]}>
                      ₱{pieceProfit.toFixed(2)} ({pieceMargin}%)
                    </Text>
                  </View>

                  {pricingType === 'PACK' && (
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.profitSub, { color: theme.textSecondary }]}>Pack Profit:</Text>
                      <Text style={[styles.profitVal, { color: packProfit >= 0 ? theme.success : theme.danger }]}>
                        ₱{packProfit.toFixed(2)} ({packMargin}%)
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            </View>

            {/* STOCK LEVELS */}
            <View style={styles.sectionBox}>
              <Text style={[styles.stepLabel, { color: theme.textSecondary }]}>
                4. STOCK LEVELS ({pricingType === 'PACK' ? 'IN PACKS' : 'IN PIECES'})
              </Text>
              <View style={styles.flexRow}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>
                    INITIAL STOCK ({pricingType === 'PACK' ? `PACKS` : `PIECES`})
                  </Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: theme.surface, color: theme.textPrimary, borderColor: theme.border }]}
                    placeholder={pricingType === 'PACK' ? 'e.g. 10 packs' : 'e.g. 120 pcs'}
                    keyboardType="numeric"
                    placeholderTextColor={theme.textMuted}
                    value={stockInput}
                    onChangeText={setStockInput}
                  />
                  {pricingType === 'PACK' && (
                    <Text style={[styles.conversionText, { color: theme.accent }]}>
                      = {computedStockPieces} total {unitPieceName}s
                    </Text>
                  )}
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>
                    LOW STOCK ALERT ({pricingType === 'PACK' ? `PACKS` : `PIECES`})
                  </Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: theme.surface, color: theme.textPrimary, borderColor: theme.border }]}
                    placeholder="2"
                    keyboardType="numeric"
                    placeholderTextColor={theme.textMuted}
                    value={minStockInput}
                    onChangeText={setMinStockInput}
                  />
                  {pricingType === 'PACK' && (
                    <Text style={[styles.conversionText, { color: theme.warning }]}>
                      = {computedMinStockPieces} total {unitPieceName}s
                    </Text>
                  )}
                </View>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  fullScreenContainer: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    gap: 12,
  },
  backBtn: {
    padding: 4,
  },
  headerTitleGroup: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  sub: {
    fontSize: 12,
    marginTop: 2,
  },
  saveHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  saveHeaderBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  scrollBody: {
    padding: 16,
    gap: 16,
    paddingBottom: 24,
  },
  sectionBox: {
    gap: 8,
  },
  stepLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    letterSpacing: 0.6,
    marginBottom: 2,
  },
  fieldLabel: {
    fontSize: 10,
    fontWeight: 'bold',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  typeGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  typeCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
  },
  typeCardTitle: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  typeCardSub: {
    fontSize: 11,
    marginTop: 2,
  },
  inputGroup: {
    gap: 4,
  },
  bigInput: {
    paddingHorizontal: 16,
    height: 48,
    borderRadius: 10,
    borderWidth: 1,
    fontSize: 14,
    fontWeight: 'bold',
  },
  input: {
    paddingHorizontal: 16,
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    fontSize: 14,
    fontWeight: 'bold',
  },
  flexRow: {
    flexDirection: 'row',
    gap: 12,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
  },
  chipText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  emptyCatBtn: {
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
  },
  profitWidget: {
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    gap: 8,
  },
  profitTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  profitSub: {
    fontSize: 12,
  },
  profitVal: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  conversionText: {
    fontSize: 11,
    fontWeight: 'bold',
    marginTop: 4,
  },
});