import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { usePOS } from '../context/POSContext';
import { dbService } from '../database/databaseService';
import { getTheme } from '../theme/theme';

type ScreenState = 'LIST' | 'CUSTOMER_DETAIL' | 'TRANSACTION_DETAIL';

export const UtangScreen: React.FC = () => {
  const { settings, lastTransactionTimestamp, cashDrawerSession } = usePOS();
  const theme = getTheme(settings.theme === 'dark');

  // ── Navigation state ─────────────────────────────────────────────────────────
  const [screenState, setScreenState] = useState<ScreenState>('LIST');

  // ── Data ─────────────────────────────────────────────────────────────────────
  const [utangCustomers, setUtangCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const [selectedCustomer, setSelectedCustomer] = useState<any | null>(null);
  const [customerUtangHistory, setCustomerUtangHistory] = useState<any[]>([]);
  const [customerPaymentHistory, setCustomerPaymentHistory] = useState<any[]>([]);

  const [selectedTransaction, setSelectedTransaction] = useState<any | null>(null);
  const [selectedTransactionItems, setSelectedTransactionItems] = useState<any[]>([]);

  // ── Modal state ───────────────────────────────────────────────────────────────
  const [paymentModalVisible, setPaymentModalVisible] = useState(false);
  const [settleAmountInput, setSettleAmountInput] = useState('');

  const [legacyModalVisible, setLegacyModalVisible] = useState(false);
  const [legacyName, setLegacyName] = useState('');
  const [legacyAmount, setLegacyAmount] = useState('');
  const [legacyNotes, setLegacyNotes] = useState('');

  const [mergeModalVisible, setMergeModalVisible] = useState(false);
  const [mergeTargetId, setMergeTargetId] = useState<string | null>(null);

  // ── Data Loading ──────────────────────────────────────────────────────────────
  const loadUtangData = async () => {
    setLoading(true);
    try {
      const list = await dbService.getCustomers();
      setUtangCustomers(list || []);
      if (selectedCustomer) {
        const updated = (list || []).find((c: any) => c.customer_id === selectedCustomer.customer_id);
        if (updated) {
          setSelectedCustomer(updated);
          await refreshCustomerDetails(updated.customer_id);
        } else {
          setScreenState('LIST');
          setSelectedCustomer(null);
        }
      }
    } catch (e) {
      console.error('Utang load error:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadUtangData(); }, [lastTransactionTimestamp]);

  const refreshCustomerDetails = async (customerId: string) => {
    const [history, payments] = await Promise.all([
      dbService.getCustomerUtangHistory(customerId),
      dbService.getCustomerPaymentHistory(customerId),
    ]);
    setCustomerUtangHistory(history || []);
    setCustomerPaymentHistory(payments || []);
  };

  // ── Navigation handlers ───────────────────────────────────────────────────────
  const handleOpenCustomerUtang = async (customer: any) => {
    setSelectedCustomer(customer);
    setScreenState('CUSTOMER_DETAIL');
    await refreshCustomerDetails(customer.customer_id);
  };

  const handleOpenTransaction = async (txn: any) => {
    setSelectedTransaction(txn);
    const items = await dbService.getSaleItemsBySaleId(txn.id);
    setSelectedTransactionItems(items || []);
    setScreenState('TRANSACTION_DETAIL');
  };

  // ── Action handlers ───────────────────────────────────────────────────────────
  const handleSettleDebt = async () => {
    if (!cashDrawerSession) {
      Alert.alert('Shift Closed', 'Please open the Cash Drawer to receive payments.');
      return;
    }
    if (!selectedCustomer) return;
    const amount = parseFloat(settleAmountInput) || 0;
    if (amount <= 0) { Alert.alert('Invalid Amount', 'Enter an amount greater than zero.'); return; }
    if (amount > selectedCustomer.total_balance_owed) {
      Alert.alert('Overpayment', `Customer only owes ₱${selectedCustomer.total_balance_owed.toFixed(2)}.`);
      return;
    }
    try {
      await dbService.settleCustomerUtang(selectedCustomer.customer_id, amount);
      setSettleAmountInput('');
      setPaymentModalVisible(false);
      await loadUtangData();
    } catch (e: any) { Alert.alert('Payment Error', e.message); }
  };

  const handleAddLegacyUtang = async () => {
    if (!legacyName.trim() || !legacyAmount) { Alert.alert('Missing Info', 'Enter a customer name and amount.'); return; }
    const amt = parseFloat(legacyAmount);
    if (isNaN(amt) || amt <= 0) { Alert.alert('Invalid Amount', 'Enter a valid amount.'); return; }
    try {
      await dbService.addLegacyUtang(legacyName.trim(), amt, legacyNotes.trim());
      setLegacyName(''); setLegacyAmount(''); setLegacyNotes('');
      setLegacyModalVisible(false);
      await loadUtangData();
    } catch (e: any) { Alert.alert('Error', e.message); }
  };

  const handleMergeCustomer = () => {
    if (!selectedCustomer || !mergeTargetId) return;
    const target = utangCustomers.find((c: any) => c.customer_id === mergeTargetId);
    if (!target) return;
    Alert.alert(
      'Confirm Merge',
      `Merge "${selectedCustomer.customer_name}" into "${target.customer_name}"?\n\nAll transactions and payments will be moved. This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Merge', style: 'destructive', onPress: async () => {
          try {
            await dbService.mergeCustomers(target.customer_id, selectedCustomer.customer_id);
            setMergeModalVisible(false); setMergeTargetId(null);
            setScreenState('LIST'); setSelectedCustomer(null);
            await loadUtangData();
          } catch (e: any) { Alert.alert('Merge Error', e.message); }
        }},
      ]
    );
  };

  // ── Formatters ────────────────────────────────────────────────────────────────
  const fmt = (val: any) => { const n = Number(val); return isNaN(n) ? '0.00' : n.toFixed(2); };

  const fmtTime = (ts: string) => new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const fmtDate = (ts: string) => {
    if (!ts || ts.length < 5) return '';
    const d = new Date(ts);
    const today = new Date();
    const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);
    if (d.toDateString() === today.toDateString()) return `Today · ${fmtTime(ts)}`;
    if (d.toDateString() === yesterday.toDateString()) return `Yesterday · ${fmtTime(ts)}`;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ` · ${fmtTime(ts)}`;
  };

  // ── Derived ───────────────────────────────────────────────────────────────────
  const totalOwed = utangCustomers.reduce((s, c) => s + (c.total_balance_owed || 0), 0);
  const activeCount = utangCustomers.filter(c => c.total_balance_owed > 0).length;
  const settledCount = utangCustomers.filter(c => c.total_balance_owed <= 0).length;
  const filteredCustomers = utangCustomers.filter(c =>
    (c.customer_name || '').toLowerCase().includes(searchQuery.toLowerCase())
  );
  const afterPayment = Math.max(0, (selectedCustomer?.total_balance_owed || 0) - (parseFloat(settleAmountInput) || 0));

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={[s.root, { backgroundColor: theme.bg }]}>
      {/* ══════════════════════════════════════════════════════════════
          SCREEN 1 — CUSTOMER LIST
      ══════════════════════════════════════════════════════════════ */}
      {screenState === 'LIST' && (
        <View style={s.screen}>

          {/* Header row */}
          <View style={s.headerRow}>
            <View>
              <Text style={[s.pageTitle, { color: theme.textPrimary }]}>UTANG</Text>
              <Text style={[s.pageSub, { color: theme.textSecondary }]}>Customer balances & payment activity</Text>
            </View>
            <TouchableOpacity style={[s.primaryBtn, { backgroundColor: theme.primary }]} onPress={() => setLegacyModalVisible(true)}>
              <Ionicons name="add" size={14} color="#fff" />
              <Text style={s.primaryBtnText}>Old Utang</Text>
            </TouchableOpacity>
          </View>

          {/* Compact metrics bar */}
          <View style={[s.metricsBar, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <View style={s.metricCell}>
              <Text style={[s.metricLabel, { color: theme.textSecondary }]}>TOTAL OUTSTANDING</Text>
              <Text style={[s.metricValue, { color: theme.textPrimary }]}>₱{fmt(totalOwed)}</Text>
            </View>
            <View style={[s.metricDivider, { backgroundColor: theme.border }]} />
            <View style={s.metricCell}>
              <Text style={[s.metricLabel, { color: theme.textSecondary }]}>ACTIVE</Text>
              <Text style={[s.metricValue, { color: theme.primary }]}>{activeCount}</Text>
            </View>
            <View style={[s.metricDivider, { backgroundColor: theme.border }]} />
            <View style={s.metricCell}>
              <Text style={[s.metricLabel, { color: theme.textSecondary }]}>SETTLED</Text>
              <Text style={[s.metricValue, { color: theme.textSecondary }]}>{settledCount}</Text>
            </View>
          </View>

          {/* Search — NOTE: no flex:1 here, fixed height only */}
          <View style={[s.searchBar, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Ionicons name="search" size={15} color={theme.textMuted} />
            <TextInput
              style={[s.searchInput, { color: theme.textPrimary }]}
              placeholder="Search customers..."
              placeholderTextColor={theme.textMuted}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery !== '' && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={15} color={theme.textMuted} />
              </TouchableOpacity>
            )}
          </View>

          <Text style={[s.sectionLabel, { color: theme.textSecondary }]}>CUSTOMER ACCOUNTS</Text>

          {/* ── THE LIST — flex:1 is the critical fix ─────────────── */}
          {loading ? (
            <View style={s.centerFill}>
              <ActivityIndicator size="small" color={theme.primary} />
              <Text style={[s.emptyText, { color: theme.textSecondary, marginTop: 6 }]}>Loading...</Text>
            </View>
          ) : (
            <FlatList
              style={{ flex: 1 }}
              data={filteredCustomers}
              keyExtractor={item => item.customer_id || String(Math.random())}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 8 }}
              ListEmptyComponent={
                <View style={s.centerFill}>
                  <Ionicons name="people-outline" size={28} color={theme.textMuted} />
                  <Text style={[s.emptyText, { color: theme.textSecondary }]}>
                    {searchQuery ? 'No customers found' : 'No customer accounts yet'}
                  </Text>
                  {!searchQuery && (
                    <Text style={[s.emptyHint, { color: theme.textMuted }]}>
                      Tap + Old Utang to add an existing balance
                    </Text>
                  )}
                </View>
              }
              renderItem={({ item }) => {
                const isZero = item.total_balance_owed <= 0;
                const initials = (item.customer_name || '??').substring(0, 2).toUpperCase();
                const lastActivity = item.last_activity_at ? fmtDate(item.last_activity_at) : null;
                return (
                  <TouchableOpacity
                    style={[s.custCard, { backgroundColor: theme.surface, borderColor: theme.border }]}
                    onPress={() => handleOpenCustomerUtang(item)}
                    activeOpacity={0.7}
                  >
                    <View style={[s.custAvatar, { backgroundColor: isZero ? theme.surfaceElevated : theme.primaryGlow }]}>
                      <Text style={[s.custAvatarText, { color: isZero ? theme.textSecondary : theme.primary }]}>{initials}</Text>
                    </View>
                    <View style={{ flex: 1, marginLeft: 10 }}>
                      <View style={s.row}>
                        <Text style={[s.custName, { color: theme.textPrimary }]} numberOfLines={1}>{item.customer_name}</Text>
                        <Text style={[s.custBalance, { color: isZero ? theme.textSecondary : theme.textPrimary }]}>₱{fmt(item.total_balance_owed)}</Text>
                      </View>
                      <View style={s.row}>
                        <Text style={[s.custSub, { color: isZero ? theme.success : theme.textSecondary }]}>
                          {isZero ? 'Settled' : `${item.unpaid_tx_count} unpaid transaction${item.unpaid_tx_count !== 1 ? 's' : ''}`}
                        </Text>
                        <View style={[s.row, { gap: 4 }]}>
                          {lastActivity ? <Text style={[s.custActivity, { color: theme.textMuted }]}>{lastActivity}</Text> : null}
                          <Ionicons name="chevron-forward" size={13} color={theme.textMuted} />
                        </View>
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              }}
            />
          )}
        </View>
      )}

      {/* ══════════════════════════════════════════════════════════════
          SCREEN 2 — CUSTOMER DETAIL
      ══════════════════════════════════════════════════════════════ */}
      {screenState === 'CUSTOMER_DETAIL' && selectedCustomer && (
        <View style={s.screen}>

          {/* Detail header */}
          <View style={s.detailHeader}>
            <TouchableOpacity onPress={() => setScreenState('LIST')} style={s.backBtn} activeOpacity={0.7}>
              <Ionicons name="arrow-back" size={18} color={theme.primary} />
              <Text style={[s.backLabel, { color: theme.primary }]}>Back</Text>
            </TouchableOpacity>
            <View style={{ flex: 1, marginHorizontal: 10 }}>
              <Text style={[s.pageTitle, { color: theme.textPrimary }]} numberOfLines={1}>
                {selectedCustomer.customer_name.toUpperCase()}
              </Text>
            </View>
            <View style={[s.row, { gap: 8 }]}>
              <Text style={[s.balanceLarge, { color: theme.textPrimary }]}>₱{fmt(selectedCustomer.total_balance_owed)}</Text>
              <TouchableOpacity
                style={[s.primaryBtn, { backgroundColor: theme.primary, opacity: selectedCustomer.total_balance_owed > 0 ? 1 : 0.4 }]}
                onPress={() => setPaymentModalVisible(true)}
                disabled={selectedCustomer.total_balance_owed <= 0}
              >
                <Text style={s.primaryBtnText}>Receive Cash</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.iconBtn, { borderColor: theme.border }]}
                onPress={() => { setMergeTargetId(null); setMergeModalVisible(true); }}
              >
                <Ionicons name="git-merge-outline" size={15} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>
          </View>

          <View style={[s.divider, { backgroundColor: theme.border }]} />

          {/* Two-column: Transactions | Payments */}
          <View style={{ flex: 1, flexDirection: 'row', gap: 10 }}>

            {/* LEFT — Account Activity */}
            <View style={{ flex: 1 }}>
              <Text style={[s.sectionLabel, { color: theme.textSecondary }]}>ACCOUNT ACTIVITY</Text>
              <FlatList
                style={{ flex: 1 }}
                data={customerUtangHistory}
                keyExtractor={item => String(item.id)}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 8 }}
                ListEmptyComponent={<Text style={[s.emptyText, { color: theme.textMuted }]}>No transactions</Text>}
                renderItem={({ item: txn }) => (
                  <TouchableOpacity
                    style={[s.txnCard, { backgroundColor: theme.surface, borderColor: theme.border }]}
                    onPress={() => handleOpenTransaction(txn)}
                    activeOpacity={0.7}
                  >
                    <View style={s.row}>
                      <View style={{ flex: 1 }}>
                        <Text style={[s.txnNo, { color: theme.textPrimary }]} numberOfLines={1}>{txn.transaction_no}</Text>
                        <Text style={[s.txnMeta, { color: theme.textSecondary }]}>{fmtDate(txn.timestamp)}</Text>
                        <Text style={[s.txnMeta, { color: theme.textMuted }]}>
                          {txn.item_count || 0} item{txn.item_count !== 1 ? 's' : ''}
                          {txn.is_legacy ? ' · Legacy' : ''}
                        </Text>
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={[s.txnAmt, { color: theme.textPrimary }]}>₱{fmt(txn.total)}</Text>
                        <Text style={[s.txnMeta, { color: theme.textMuted }]}>Remaining</Text>
                        <Text style={[s.txnRemaining, { color: (txn.remaining_balance || 0) > 0 ? theme.danger : theme.success }]}>₱{fmt(txn.remaining_balance)}</Text>
                      </View>
                    </View>
                    <Text style={[s.viewLink, { color: theme.primary, marginTop: 4, textAlign: 'right' }]}>View details →</Text>
                  </TouchableOpacity>
                )}
              />
            </View>

            {/* RIGHT — Payment History */}
            <View style={{ width: '35%' }}>
              <Text style={[s.sectionLabel, { color: theme.textSecondary }]}>PAYMENT HISTORY</Text>
              <FlatList
                style={{ flex: 1 }}
                data={customerPaymentHistory}
                keyExtractor={item => String(item.id)}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 8 }}
                ListEmptyComponent={<Text style={[s.emptyText, { color: theme.textMuted }]}>No payments yet</Text>}
                renderItem={({ item: pmt }) => (
                  <View style={[s.pmtCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                    <View style={s.row}>
                      <View style={{ flex: 1 }}>
                        <Text style={[s.txnMeta, { color: theme.textPrimary }]}>{fmtDate(pmt.timestamp)}</Text>
                        <Text style={[s.txnMeta, { color: theme.textMuted }]}>Payment received</Text>
                      </View>
                      <Text style={[s.pmtAmt, { color: theme.success }]}>+₱{fmt(pmt.amount)}</Text>
                    </View>
                  </View>
                )}
              />
            </View>
          </View>
        </View>
      )}

      {/* ══════════════════════════════════════════════════════════════
          SCREEN 3 — TRANSACTION DETAIL
      ══════════════════════════════════════════════════════════════ */}
      {screenState === 'TRANSACTION_DETAIL' && selectedTransaction && (
        <View style={s.screen}>

          {/* Header */}
          <View style={s.detailHeader}>
            <TouchableOpacity onPress={() => setScreenState('CUSTOMER_DETAIL')} style={s.backBtn} activeOpacity={0.7}>
              <Ionicons name="arrow-back" size={18} color={theme.primary} />
              <Text style={[s.backLabel, { color: theme.primary }]}>Back</Text>
            </TouchableOpacity>
            <View style={{ flex: 1, marginHorizontal: 10 }}>
              <Text style={[s.pageSub, { color: theme.textSecondary }]}>Transaction</Text>
              <Text style={[s.pageTitle, { color: theme.textPrimary }]}>{selectedTransaction.transaction_no}</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={[s.txnMeta, { color: theme.textSecondary }]}>
                {new Date(selectedTransaction.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </Text>
              <Text style={[s.txnMeta, { color: theme.textSecondary }]}>{fmtTime(selectedTransaction.timestamp)}</Text>
              {selectedCustomer && <Text style={[s.txnMeta, { color: theme.textMuted }]}>{selectedCustomer.customer_name}</Text>}
            </View>
          </View>

          <View style={[s.divider, { backgroundColor: theme.border }]} />

          {/* Two columns: Items | Summary */}
          <View style={{ flex: 1, flexDirection: 'row', gap: 14 }}>

            {/* Items */}
            <View style={{ flex: 1 }}>
              <Text style={[s.sectionLabel, { color: theme.textSecondary }]}>ITEMS</Text>
              {selectedTransaction.notes ? (
                <Text style={[s.txnMeta, { color: theme.textMuted, marginBottom: 6 }]}>Note: {selectedTransaction.notes}</Text>
              ) : null}
              <FlatList
                style={{ flex: 1 }}
                data={selectedTransactionItems}
                keyExtractor={item => String(item.id)}
                showsVerticalScrollIndicator={false}
                ListEmptyComponent={
                  <Text style={[s.emptyText, { color: theme.textMuted }]}>
                    {selectedTransaction.is_legacy ? 'Legacy record — no itemized data' : 'No items found'}
                  </Text>
                }
                renderItem={({ item: si }) => (
                  <View style={[s.itemRow, { borderBottomColor: theme.border }]}>
                    <View style={{ flex: 1 }}>
                      <Text style={[s.itemName, { color: theme.textPrimary }]}>{si.product_name}</Text>
                      <Text style={[s.itemMeta, { color: theme.textSecondary }]}>
                        {si.quantity} × {si.unit_type === 'PACK' ? 'Pack' : 'Piece'}
                      </Text>
                    </View>
                    <Text style={[s.itemTotal, { color: theme.textPrimary }]}>₱{fmt(si.subtotal)}</Text>
                  </View>
                )}
              />
            </View>

            {/* Summary */}
            <View style={{ width: 180 }}>
              <Text style={[s.sectionLabel, { color: theme.textSecondary }]}>SUMMARY</Text>
              <View style={[s.summaryBox, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <View style={s.summaryRow}>
                  <Text style={[s.summaryLabel, { color: theme.textSecondary }]}>Net Sales</Text>
                  <Text style={[s.summaryVal, { color: theme.textPrimary }]}>₱{fmt(selectedTransaction.total)}</Text>
                </View>
                <View style={s.summaryRow}>
                  <Text style={[s.summaryLabel, { color: theme.textSecondary }]}>Downpayment</Text>
                  <Text style={[s.summaryVal, { color: theme.textPrimary }]}>₱{fmt(selectedTransaction.amount_paid)}</Text>
                </View>
                <View style={[s.divider, { backgroundColor: theme.border, marginVertical: 8 }]} />
                <View style={s.summaryRow}>
                  <Text style={[s.summaryLabelBold, { color: theme.textPrimary }]}>REMAINING</Text>
                  <Text style={[s.summaryValBold, { color: theme.textPrimary }]}>₱{fmt(selectedTransaction.remaining_balance || 0)}</Text>
                </View>
              </View>
            </View>
          </View>
        </View>
      )}

      {/* ══════════════════════════════════════════════════════════════
          MODAL: RECEIVE PAYMENT
      ══════════════════════════════════════════════════════════════ */}
      <Modal visible={paymentModalVisible} transparent animationType="fade" onRequestClose={() => setPaymentModalVisible(false)}>
        <KeyboardAvoidingView style={s.overlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <TouchableOpacity style={StyleSheet.absoluteFillObject} activeOpacity={1} onPress={() => setPaymentModalVisible(false)} />
          <View style={[s.modalBox, { backgroundColor: theme.surface, borderColor: theme.border }]} onStartShouldSetResponder={() => true}>
            <View style={s.modalTitleRow}>
              <Text style={[s.modalTitle, { color: theme.textPrimary }]}>RECEIVE PAYMENT</Text>
              <TouchableOpacity onPress={() => setPaymentModalVisible(false)}>
                <Ionicons name="close" size={18} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>
            <Text style={[s.pageSub, { color: theme.textSecondary, marginBottom: 14 }]}>{selectedCustomer?.customer_name}</Text>

            <View style={[s.row, { gap: 14, marginBottom: 12 }]}>
              <View style={{ flex: 1 }}>
                <Text style={[s.modalLabel, { color: theme.textSecondary }]}>CURRENT BALANCE</Text>
                <Text style={[s.balanceMedium, { color: theme.textPrimary, marginTop: 4 }]}>₱{fmt(selectedCustomer?.total_balance_owed)}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.modalLabel, { color: theme.textSecondary }]}>AMOUNT RECEIVED</Text>
                <View style={[s.inputBox, { borderColor: theme.border, backgroundColor: theme.bg, marginTop: 4 }]}>
                  <Text style={{ color: theme.textPrimary, fontSize: 14, marginRight: 6 }}>₱</Text>
                  <TextInput
                    style={[s.modalInput, { color: theme.textPrimary }]}
                    placeholder="0.00"
                    placeholderTextColor={theme.textMuted}
                    keyboardType="numeric"
                    value={settleAmountInput}
                    onChangeText={setSettleAmountInput}
                    autoFocus
                  />
                </View>
              </View>
            </View>

            <View style={[s.infoRow, { backgroundColor: theme.bg, borderColor: theme.border }]}>
              <Text style={[s.modalLabel, { color: theme.textSecondary }]}>REMAINING AFTER PAYMENT</Text>
              <Text style={[s.balanceMedium, { color: theme.textPrimary }]}>₱{fmt(afterPayment)}</Text>
            </View>

            <View style={[s.row, { gap: 10, marginTop: 14 }]}>
              <TouchableOpacity style={[s.modalBtnOutline, { flex: 1, borderColor: theme.border }]} onPress={() => setPaymentModalVisible(false)}>
                <Text style={{ color: theme.textPrimary, fontWeight: '600', fontSize: 13 }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.modalBtnSolid, { flex: 1, backgroundColor: theme.primary }]} onPress={handleSettleDebt}>
                <Text style={{ color: '#fff', fontWeight: '600', fontSize: 13 }}>Receive Cash</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ══════════════════════════════════════════════════════════════
          MODAL: OLD UTANG — landscape two-column form
      ══════════════════════════════════════════════════════════════ */}
      <Modal visible={legacyModalVisible} transparent animationType="fade" onRequestClose={() => setLegacyModalVisible(false)}>
        <KeyboardAvoidingView style={s.overlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <TouchableOpacity style={StyleSheet.absoluteFillObject} activeOpacity={1} onPress={() => setLegacyModalVisible(false)} />
          <View style={[s.modalBox, { backgroundColor: theme.surface, borderColor: theme.border }]} onStartShouldSetResponder={() => true}>
            <View style={s.modalTitleRow}>
              <View>
                <Text style={[s.modalTitle, { color: theme.textPrimary }]}>OLD UTANG</Text>
                <Text style={[s.pageSub, { color: theme.textSecondary }]}>Add an existing customer debt</Text>
              </View>
              <TouchableOpacity onPress={() => setLegacyModalVisible(false)}>
                <Ionicons name="close" size={18} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>

            <Text style={[s.modalLabel, { color: theme.textSecondary, marginTop: 14, marginBottom: 6 }]}>CUSTOMER NAME</Text>
            <View style={[s.inputBox, { borderColor: theme.border, backgroundColor: theme.bg }]}>
              <TextInput
                style={[s.modalInput, { color: theme.textPrimary }]}
                placeholder="e.g. Juan Dela Cruz"
                placeholderTextColor={theme.textMuted}
                value={legacyName}
                onChangeText={setLegacyName}
              />
            </View>

            {/* Amount | Notes side-by-side (landscape efficient) */}
            <View style={[s.row, { gap: 12, marginTop: 12 }]}>
              <View style={{ flex: 1 }}>
                <Text style={[s.modalLabel, { color: theme.textSecondary, marginBottom: 6 }]}>AMOUNT</Text>
                <View style={[s.inputBox, { borderColor: theme.border, backgroundColor: theme.bg }]}>
                  <Text style={{ color: theme.textPrimary, fontSize: 14, marginRight: 6 }}>₱</Text>
                  <TextInput
                    style={[s.modalInput, { color: theme.textPrimary }]}
                    placeholder="0.00"
                    keyboardType="numeric"
                    placeholderTextColor={theme.textMuted}
                    value={legacyAmount}
                    onChangeText={setLegacyAmount}
                  />
                </View>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.modalLabel, { color: theme.textSecondary, marginBottom: 6 }]}>NOTES (OPTIONAL)</Text>
                <View style={[s.inputBox, { borderColor: theme.border, backgroundColor: theme.bg }]}>
                  <TextInput
                    style={[s.modalInput, { color: theme.textPrimary }]}
                    placeholder="Optional notes..."
                    placeholderTextColor={theme.textMuted}
                    value={legacyNotes}
                    onChangeText={setLegacyNotes}
                  />
                </View>
              </View>
            </View>

            <View style={[s.row, { gap: 10, marginTop: 14 }]}>
              <TouchableOpacity style={[s.modalBtnOutline, { flex: 1, borderColor: theme.border }]} onPress={() => setLegacyModalVisible(false)}>
                <Text style={{ color: theme.textPrimary, fontWeight: '600', fontSize: 13 }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.modalBtnSolid, { flex: 1, backgroundColor: theme.primary }]} onPress={handleAddLegacyUtang}>
                <Text style={{ color: '#fff', fontWeight: '600', fontSize: 13 }}>Add Old Utang</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ══════════════════════════════════════════════════════════════
          MODAL: MERGE CUSTOMER
      ══════════════════════════════════════════════════════════════ */}
      <Modal visible={mergeModalVisible} transparent animationType="fade" onRequestClose={() => setMergeModalVisible(false)}>
        <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={() => setMergeModalVisible(false)}>
          <View style={[s.modalBox, { backgroundColor: theme.surface, borderColor: theme.border, maxHeight: '85%' }]} onStartShouldSetResponder={() => true}>
            <View style={s.modalTitleRow}>
              <View style={{ flex: 1 }}>
                <Text style={[s.modalTitle, { color: theme.textPrimary }]}>MERGE CUSTOMER</Text>
                <Text style={[s.pageSub, { color: theme.textSecondary }]}>
                  Move all records from "{selectedCustomer?.customer_name}" into:
                </Text>
              </View>
              <TouchableOpacity onPress={() => { setMergeModalVisible(false); setMergeTargetId(null); }}>
                <Ionicons name="close" size={18} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>

            <FlatList
              style={{ maxHeight: 180, marginTop: 10 }}
              data={utangCustomers.filter(c => c.customer_id !== selectedCustomer?.customer_id)}
              keyExtractor={c => c.customer_id}
              showsVerticalScrollIndicator={false}
              ListEmptyComponent={<Text style={[s.emptyText, { color: theme.textMuted }]}>No other customers</Text>}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[s.mergeRow, {
                    backgroundColor: mergeTargetId === item.customer_id ? theme.primaryGlow : 'transparent',
                    borderColor: mergeTargetId === item.customer_id ? theme.primary : theme.border,
                  }]}
                  onPress={() => setMergeTargetId(item.customer_id)}
                >
                  <Ionicons
                    name={mergeTargetId === item.customer_id ? 'radio-button-on' : 'radio-button-off'}
                    size={16}
                    color={mergeTargetId === item.customer_id ? theme.primary : theme.textMuted}
                  />
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={[s.custName, { color: theme.textPrimary }]}>{item.customer_name}</Text>
                    <Text style={[s.txnMeta, { color: theme.textSecondary }]}>₱{fmt(item.total_balance_owed)}</Text>
                  </View>
                </TouchableOpacity>
              )}
            />

            <View style={[s.row, { gap: 10, marginTop: 12 }]}>
              <TouchableOpacity style={[s.modalBtnOutline, { flex: 1, borderColor: theme.border }]} onPress={() => { setMergeModalVisible(false); setMergeTargetId(null); }}>
                <Text style={{ color: theme.textPrimary, fontWeight: '600', fontSize: 13 }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.modalBtnSolid, { flex: 1, backgroundColor: mergeTargetId ? theme.danger : theme.surfaceElevated }]}
                onPress={handleMergeCustomer}
                disabled={!mergeTargetId}
              >
                <Text style={{ color: mergeTargetId ? '#fff' : theme.textMuted, fontWeight: '600', fontSize: 13 }}>Merge</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

    </SafeAreaView>
  );
};
// ─── Styles: Landscape phone optimized ────────────────────────────────────────
const s = StyleSheet.create({
  root: { flex: 1 },

  // Screen wrapper — compact padding for landscape
  screen: { flex: 1, paddingHorizontal: 14, paddingTop: 8, paddingBottom: 6 },

  // Utilities
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  divider: { height: StyleSheet.hairlineWidth, marginBottom: 8 },
  centerFill: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 6 },

  // Header (compact for landscape)
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  pageTitle: { fontSize: 16, fontWeight: '700', letterSpacing: 0.5 },
  pageSub: { fontSize: 11, marginTop: 1 },

  // Metrics bar — horizontal, fixed height
  metricsBar: { flexDirection: 'row', alignItems: 'center', borderRadius: 6, borderWidth: StyleSheet.hairlineWidth, paddingVertical: 8, paddingHorizontal: 12, marginBottom: 8, elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 2 },
  metricCell: { flex: 1, alignItems: 'center' },
  metricLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  metricValue: { fontSize: 15, fontWeight: '600', marginTop: 2 },
  metricDivider: { width: StyleSheet.hairlineWidth, height: 28, marginHorizontal: 8 },

  // Search — CRITICAL: no flex:1, fixed height only
  searchBar: { flexDirection: 'row', alignItems: 'center', height: 36, borderRadius: 6, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 10, marginBottom: 6, gap: 8 },
  searchInput: { flex: 1, fontSize: 13, padding: 0 },

  // Section label
  sectionLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 1, marginBottom: 6 },

  // Empty state
  emptyText: { fontSize: 13, marginTop: 4 },
  emptyHint: { fontSize: 12, marginTop: 2 },

  // Customer cards — compact for landscape
  custCard: { flexDirection: 'row', alignItems: 'center', borderRadius: 6, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 10, paddingVertical: 8, marginBottom: 5, elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.03, shadowRadius: 2 },
  custAvatar: { width: 32, height: 32, borderRadius: 6, justifyContent: 'center', alignItems: 'center' },
  custAvatarText: { fontSize: 12, fontWeight: '700' },
  custName: { fontSize: 13, fontWeight: '600', flex: 1, marginRight: 8 },
  custBalance: { fontSize: 14, fontWeight: '700' },
  custSub: { fontSize: 11 },
  custActivity: { fontSize: 11 },

  // Buttons
  primaryBtn: { flexDirection: 'row', alignItems: 'center', height: 32, paddingHorizontal: 12, borderRadius: 5, gap: 4, justifyContent: 'center' },
  primaryBtnText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  iconBtn: { width: 32, height: 32, borderRadius: 5, borderWidth: StyleSheet.hairlineWidth, justifyContent: 'center', alignItems: 'center' },

  // Detail screens
  detailHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  backLabel: { fontSize: 13, fontWeight: '600' },
  balanceLarge: { fontSize: 17, fontWeight: '700' },
  balanceMedium: { fontSize: 15, fontWeight: '600' },

  // Transaction cards
  txnCard: { padding: 10, borderRadius: 6, borderWidth: StyleSheet.hairlineWidth, marginBottom: 6, elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.03, shadowRadius: 2 },
  txnNo: { fontSize: 11, fontWeight: '600', marginBottom: 2 },
  txnMeta: { fontSize: 11, marginBottom: 1 },
  txnAmt: { fontSize: 13, fontWeight: '600' },
  txnRemaining: { fontSize: 12, fontWeight: '600' },
  viewLink: { fontSize: 11, fontWeight: '600' },

  // Payment cards
  pmtCard: { padding: 10, borderRadius: 6, borderWidth: StyleSheet.hairlineWidth, marginBottom: 6 },
  pmtAmt: { fontSize: 13, fontWeight: '700' },

  // Transaction detail items
  itemRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth },
  itemName: { fontSize: 13, fontWeight: '500', marginBottom: 2 },
  itemMeta: { fontSize: 12 },
  itemTotal: { fontSize: 13, fontWeight: '600' },

  // Summary panel
  summaryBox: { padding: 12, borderRadius: 6, borderWidth: StyleSheet.hairlineWidth },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  summaryLabel: { fontSize: 11, fontWeight: '600' },
  summaryVal: { fontSize: 13, fontWeight: '500' },
  summaryLabelBold: { fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
  summaryValBold: { fontSize: 15, fontWeight: '700' },

  // Modals — max 90% width, compact height for landscape
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalBox: { width: '90%', maxWidth: 620, borderRadius: 10, borderWidth: StyleSheet.hairlineWidth, padding: 18, elevation: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 12 },
  modalTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 2 },
  modalTitle: { fontSize: 13, fontWeight: '700', letterSpacing: 0.5 },
  modalLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderRadius: 6, borderWidth: StyleSheet.hairlineWidth, padding: 10 },
  inputBox: { flexDirection: 'row', alignItems: 'center', height: 38, borderRadius: 5, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 10 },
  modalInput: { flex: 1, fontSize: 14, padding: 0 },
  modalBtnOutline: { height: 36, borderRadius: 5, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
  modalBtnSolid: { height: 36, borderRadius: 5, justifyContent: 'center', alignItems: 'center' },

  // Merge modal
  mergeRow: { flexDirection: 'row', alignItems: 'center', padding: 10, borderRadius: 6, borderWidth: StyleSheet.hairlineWidth, marginBottom: 5 },
});
