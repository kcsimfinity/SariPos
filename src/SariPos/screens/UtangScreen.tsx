import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Modal,
  Alert
} from 'react-native';
import { dbService } from '../database/databaseService';
import { Sale } from '../types';
import { usePOS } from '../context/POSContext';
import { getTheme } from '../theme/theme';
import { Ionicons } from '@expo/vector-icons';

export const UtangScreen: React.FC = () => {
  const { settings } = usePOS();
  const theme = getTheme(settings.theme === 'dark');

  const [utangCustomers, setUtangCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const [selectedCustomer, setSelectedCustomer] = useState<string | null>(null);
  const [customerUtangHistory, setCustomerUtangHistory] = useState<Sale[]>([]);
  const [settleAmountInput, setSettleAmountInput] = useState('');

  const [expandedSaleId, setExpandedSaleId] = useState<string | null>(null);
  const [saleItemsData, setSaleItemsData] = useState<any[]>([]);

  // Legacy Debt State
  const [legacyModalVisible, setLegacyModalVisible] = useState(false);
  const [legacyName, setLegacyName] = useState('');
  const [legacyAmount, setLegacyAmount] = useState('');

  const loadUtangData = async () => {
    setLoading(true);
    try {
      const list = await dbService.getUtangCustomers();
      setUtangCustomers(list || []);
    } catch (e) {
      console.error('Failed to load Utang customers', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUtangData();
  }, []);

  const filteredCustomers = utangCustomers.filter(c =>
    (c.customer_name || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleOpenCustomerUtang = async (customerName: string) => {
    setSelectedCustomer(customerName);
    setSettleAmountInput('');
    setExpandedSaleId(null);
    try {
      const history = await dbService.getCustomerUtangHistory(customerName);
      setCustomerUtangHistory(history || []);
    } catch (e) {
      console.error('Failed to load customer debt history', e);
    }
  };

  const handleSettleDebt = async () => {
    if (!selectedCustomer) return;
    const amount = parseFloat(settleAmountInput) || 0;
    if (amount <= 0) {
      Alert.alert('Validation Error', 'Please enter a valid payment amount.');
      return;
    }

    try {
      // 1. Update their old debt records
      await dbService.settleCustomerUtang(selectedCustomer, amount);
      
      // 2. Log this specific payment so it shows in TODAY's Sales Screen cash drawer!
      // @ts-ignore
      if (dbService.logUtangPayment) {
        // @ts-ignore
        await dbService.logUtangPayment(selectedCustomer, amount);
      }

      Alert.alert('Payment Recorded', `Recorded ₱${amount.toFixed(2)} payment from ${selectedCustomer}.`);
      setSettleAmountInput('');
      setSelectedCustomer(null);
      await loadUtangData();
    } catch (e: any) {
      Alert.alert('Payment Error', e.message || 'Failed to process debt payment.');
    }
  };

  const handleAddLegacyUtang = async () => {
    if (!legacyName.trim()) {
      Alert.alert('Validation Error', 'Please enter the borrower\'s name.');
      return;
    }
    const amt = parseFloat(legacyAmount);
    if (isNaN(amt) || amt <= 0) {
      Alert.alert('Validation Error', 'Please enter a valid debt amount.');
      return;
    }

    try {
      // @ts-ignore
      if (!dbService.addLegacyUtang) {
        Alert.alert('System Error', 'Please add the addLegacyUtang function to your databaseService.ts first!');
        return;
      }
      
      // @ts-ignore
      await dbService.addLegacyUtang(legacyName.trim(), amt);
      Alert.alert('Success', `Recorded ₱${amt.toFixed(2)} legacy debt for ${legacyName}.`);
      setLegacyName('');
      setLegacyAmount('');
      setLegacyModalVisible(false);
      await loadUtangData();
    } catch (e: any) {
      Alert.alert('Database Error', e.message);
    }
  };

  const handleViewItems = async (saleId: string) => {
    if (expandedSaleId === saleId) {
      setExpandedSaleId(null);
      return;
    }
    try {
      // @ts-ignore
      if (dbService.getSaleItemsBySaleId) {
        // @ts-ignore
        const items = await dbService.getSaleItemsBySaleId(saleId);
        setSaleItemsData(items || []);
        setExpandedSaleId(saleId);
      } else {
        Alert.alert('Update DB', 'Please add the getSaleItemsBySaleId function to your databaseService.ts');
      }
    } catch (e) {
      console.log(e);
    }
  };

  const formatMoney = (val: any): string => {
    const num = Number(val);
    return isNaN(num) ? '0.00' : num.toFixed(2);
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      
      {/* HEADER CARD */}
      <View style={[styles.headerCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <View style={styles.headerLeft}>
          <View style={[styles.iconBadge, { backgroundColor: theme.dangerGlow }]}>
            <Ionicons name="book" size={20} color={theme.danger} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.headerTitle, { color: theme.textPrimary }]}>Utang Credit Ledger</Text>
            <Text style={[styles.headerSub, { color: theme.textSecondary }]}>
              {utangCustomers.length} Customers with Unpaid Debt
            </Text>
          </View>
        </View>

        <TouchableOpacity style={[styles.addLegacyBtn, { backgroundColor: theme.primary }]} onPress={() => setLegacyModalVisible(true)} activeOpacity={0.8}>
          <Ionicons name="add" size={16} color="#ffffff" />
          <Text style={{ color: '#ffffff', fontSize: 13, fontWeight: 'bold' }}>Old Utang</Text>
        </TouchableOpacity>
      </View>

      {/* SEARCH BAR */}
      <View style={[styles.searchBar, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <Ionicons name="search" size={18} color={theme.textSecondary} />
        <TextInput
          style={[styles.searchInput, { color: theme.textPrimary }]}
          placeholder="Search borrower by name..."
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

      {/* UTANG CUSTOMER LIST */}
      {loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="small" color={theme.danger} />
          <Text style={[styles.loadingText, { color: theme.textSecondary }]}>Loading Utang Balances...</Text>
        </View>
      ) : filteredCustomers.length === 0 ? (
        <View style={[styles.emptyCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Ionicons name="checkmark-circle-outline" size={42} color={theme.success} />
          <Text style={[styles.emptyTitle, { color: theme.textPrimary }]}>No Outstanding Debt</Text>
          <Text style={[styles.emptySub, { color: theme.textSecondary }]}>
            {searchQuery ? 'No matching borrower found.' : 'All customer debts have been fully paid.'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredCustomers}
          keyExtractor={item => item.customer_name}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 24 }}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.customerCard, { backgroundColor: theme.surface, borderColor: theme.border }]}
              onPress={() => handleOpenCustomerUtang(item.customer_name)}
              activeOpacity={0.75}
            >
              <View style={styles.cardLeft}>
                <View style={[styles.userBadge, { backgroundColor: theme.dangerGlow }]}>
                  <Ionicons name="person" size={18} color={theme.danger} />
                </View>
                <View>
                  <Text style={[styles.customerName, { color: theme.textPrimary }]}>{item.customer_name}</Text>
                  <Text style={[styles.customerSub, { color: theme.textSecondary }]}>
                    {item.unpaid_tx_count} Unpaid Transactions
                  </Text>
                </View>
              </View>

              <View style={styles.cardRight}>
                <Text style={[styles.balanceText, { color: theme.danger }]}>
                  ₱{formatMoney(item.total_balance_owed)}
                </Text>
                <Text style={styles.actionHint}>Tap to view/pay →</Text>
              </View>
            </TouchableOpacity>
          )}
        />
      )}

      {/* CUSTOMER DEBT SETTLEMENT MODAL */}
      <Modal visible={Boolean(selectedCustomer)} transparent animationType="fade" onRequestClose={() => setSelectedCustomer(null)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            
            <View style={[styles.modalHeader, { borderBottomColor: theme.border }]}>
              <View style={styles.modalHeaderTitle}>
                <Ionicons name="person-circle" size={24} color={theme.danger} />
                <Text style={[styles.modalTitle, { color: theme.textPrimary }]}>{selectedCustomer}'s Utang</Text>
              </View>
              <TouchableOpacity onPress={() => setSelectedCustomer(null)} style={{ padding: 4 }}>
                <Ionicons name="close" size={20} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>

            <FlatList
              data={customerUtangHistory}
              keyExtractor={item => item.id}
              style={{ maxHeight: 260, marginVertical: 10 }}
              showsVerticalScrollIndicator={true}
              renderItem={({ item }) => (
                <View style={[styles.debtTxCard, { backgroundColor: theme.bg, borderColor: theme.border }]}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <View>
                      <Text style={[styles.txNo, { color: theme.textPrimary }]}>{item.transaction_no}</Text>
                      <Text style={[styles.txMeta, { color: theme.textSecondary }]}>
                        {new Date(item.timestamp).toLocaleDateString()}
                      </Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={[styles.txTotal, { color: theme.danger }]}>
                        ₱{formatMoney(item.total - item.amount_paid)}
                      </Text>
                      <TouchableOpacity onPress={() => handleViewItems(item.id)} style={{ marginTop: 4 }}>
                        <Text style={{ color: theme.accent, fontSize: 11, fontWeight: 'bold' }}>
                          {expandedSaleId === item.id ? 'Hide Items ↑' : 'View Items ↓'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* DROP DOWN ITEMS VIEW */}
                  {expandedSaleId === item.id && (
                    <View style={[styles.itemsListContainer, { borderTopColor: theme.border }]}>
                      {saleItemsData.length === 0 ? (
                        <Text style={{ color: theme.textSecondary, fontSize: 12, fontStyle: 'italic' }}>Legacy record (no items) or loading...</Text>
                      ) : (
                        saleItemsData.map((sItem: any) => (
                          <View key={sItem.id} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 }}>
                            <Text style={{ color: theme.textPrimary, fontSize: 12 }}>
                              {sItem.quantity}x {sItem.product_name}
                            </Text>
                            <Text style={{ color: theme.textSecondary, fontSize: 12 }}>
                              ₱{formatMoney(sItem.price_at_time * sItem.quantity)}
                            </Text>
                          </View>
                        ))
                      )}
                    </View>
                  )}
                </View>
              )}
            />

            <View style={[styles.settleBox, { backgroundColor: theme.bg, borderColor: theme.border }]}>
              <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>PAY / SETTLE DEBT (₱)</Text>
              <View style={styles.inputRow}>
                <TextInput
                  style={[styles.settleInput, { backgroundColor: theme.surface, color: theme.textPrimary, borderColor: theme.border }]}
                  placeholder="Enter payment amount"
                  placeholderTextColor={theme.textMuted}
                  keyboardType="numeric"
                  value={settleAmountInput}
                  onChangeText={setSettleAmountInput}
                />
                <TouchableOpacity style={[styles.settleBtn, { backgroundColor: theme.success }]} onPress={handleSettleDebt} activeOpacity={0.8}>
                  <Ionicons name="checkmark-sharp" size={18} color="#ffffff" />
                  <Text style={styles.settleBtnText}>Pay Cash</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>

      {/* ADD OLD / LEGACY UTANG MODAL - NOW WITH MUCH LARGER INPUTS */}
      <Modal visible={legacyModalVisible} transparent animationType="fade" onRequestClose={() => setLegacyModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: theme.surface, borderColor: theme.border, maxWidth: 440 }]}>
            
            <View style={[styles.modalHeader, { borderBottomColor: theme.border }]}>
              <View style={styles.modalHeaderTitle}>
                <Ionicons name="time" size={24} color={theme.accent} />
                <Text style={[styles.modalTitle, { color: theme.textPrimary }]}>Record Old Notebook Utang</Text>
              </View>
              <TouchableOpacity onPress={() => setLegacyModalVisible(false)} style={{ padding: 4 }}>
                <Ionicons name="close" size={24} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>

            <View style={{ paddingVertical: 14, gap: 16 }}>
              <View>
                <Text style={[styles.fieldLabel, { color: theme.textSecondary, marginBottom: 8 }]}>BORROWER NAME *</Text>
                <TextInput
                  style={[styles.largeLegacyInput, { backgroundColor: theme.bg, color: theme.textPrimary, borderColor: theme.border }]}
                  placeholder="e.g. Aling Nena"
                  placeholderTextColor={theme.textMuted}
                  value={legacyName}
                  onChangeText={setLegacyName}
                />
              </View>

              <View>
                <Text style={[styles.fieldLabel, { color: theme.textSecondary, marginBottom: 8 }]}>TOTAL DEBT AMOUNT (₱) *</Text>
                <TextInput
                  style={[styles.largeLegacyInput, { backgroundColor: theme.bg, color: theme.textPrimary, borderColor: theme.border }]}
                  placeholder="0.00"
                  keyboardType="numeric"
                  placeholderTextColor={theme.textMuted}
                  value={legacyAmount}
                  onChangeText={setLegacyAmount}
                />
              </View>
            </View>

            <TouchableOpacity style={[styles.saveLegacyBtn, { backgroundColor: theme.primary }]} onPress={handleAddLegacyUtang} activeOpacity={0.8}>
              <Ionicons name="save" size={20} color="#ffffff" />
              <Text style={styles.saveLegacyBtnText}>Save Legacy Debt</Text>
            </TouchableOpacity>

          </View>
        </View>
      </Modal>

    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 14 },
  headerCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14, borderRadius: 12, borderWidth: 1, marginBottom: 12 },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  iconBadge: { width: 42, height: 42, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 16, fontWeight: 'bold' },
  headerSub: { fontSize: 12, marginTop: 2 },
  
  addLegacyBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, height: 42, borderRadius: 8 },
  
  searchBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, height: 46, borderRadius: 10, borderWidth: 1, marginBottom: 12, gap: 10 },
  searchInput: { flex: 1, fontSize: 14, fontWeight: 'bold', height: 46 },
  
  loadingBox: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 8 },
  loadingText: { fontSize: 13, fontWeight: 'bold' },
  emptyCard: { flex: 1, padding: 30, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  emptyTitle: { fontSize: 16, fontWeight: 'bold' },
  emptySub: { fontSize: 12, textAlign: 'center' },
  
  customerCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14, borderRadius: 12, borderWidth: 1, marginBottom: 8 },
  cardLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  userBadge: { width: 40, height: 40, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  customerName: { fontSize: 14, fontWeight: 'bold' },
  customerSub: { fontSize: 12, marginTop: 2 },
  cardRight: { alignItems: 'flex-end' },
  balanceText: { fontSize: 16, fontWeight: 'bold' },
  actionHint: { fontSize: 11, color: '#38bdf8', fontWeight: 'bold', marginTop: 2 },
  
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'center', alignItems: 'center', padding: 16 },
  modalCard: { width: '90%', maxWidth: 520, borderRadius: 14, borderWidth: 1, padding: 16 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 10, borderBottomWidth: 1 },
  modalHeaderTitle: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  modalTitle: { fontSize: 16, fontWeight: 'bold' },
  
  debtTxCard: { padding: 12, borderRadius: 10, borderWidth: 1, marginBottom: 8 },
  txNo: { fontSize: 13, fontWeight: 'bold' },
  txMeta: { fontSize: 12, marginTop: 2 },
  txTotal: { fontSize: 15, fontWeight: 'bold' },
  
  itemsListContainer: { marginTop: 10, paddingTop: 10, borderTopWidth: 1 },
  
  settleBox: { padding: 14, borderRadius: 10, borderWidth: 1, marginTop: 6, gap: 10 },
  fieldLabel: { fontSize: 12, fontWeight: 'bold' },
  inputRow: { flexDirection: 'row', gap: 10 },
  settleInput: { flex: 1, height: 50, paddingHorizontal: 14, borderRadius: 8, borderWidth: 1, fontSize: 16, fontWeight: 'bold' },
  settleBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 20, height: 50, borderRadius: 8, justifyContent: 'center' },
  settleBtnText: { color: '#ffffff', fontWeight: 'bold', fontSize: 14 },
  
  /* LARGER INPUTS FOR LEGACY DEBT */
  largeLegacyInput: { paddingHorizontal: 16, height: 56, borderRadius: 10, borderWidth: 1, fontSize: 16, fontWeight: 'bold' },
  saveLegacyBtn: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, height: 56, borderRadius: 10, marginTop: 12 },
  saveLegacyBtnText: { color: '#ffffff', fontWeight: 'bold', fontSize: 16 },
});