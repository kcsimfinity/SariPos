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

export const CashDrawerScreen: React.FC = () => {
  const { settings, cashDrawerSession, openCashDrawer, closeCashDrawer, addExpense, lastTransactionTimestamp } = usePOS();
  const theme = getTheme(settings.theme === 'dark');

  // ── Action State ─────────────────────────────────────────────────────────────
  const [txnModalVisible, setTxnModalVisible] = useState(false);
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseDesc, setExpenseDesc] = useState('');
  const [expenseType, setExpenseType] = useState<'EXPENSE' | 'WITHDRAWAL' | 'CASH_IN' | 'ADJUSTMENT'>('EXPENSE');

  const [closeModalVisible, setCloseModalVisible] = useState(false);
  const [actualCashInput, setActualCashInput] = useState('');

  // ── Data State ───────────────────────────────────────────────────────────────
  const [loading, setLoading] = useState(true);
  const [expensesList, setExpensesList] = useState<any[]>([]);
  const [closedSessions, setClosedSessions] = useState<any[]>([]);
  const [cashCollectedToday, setCashCollectedToday] = useState(0);

  // ── Load Data ────────────────────────────────────────────────────────────────
  const loadSessionData = async () => {
    setLoading(true);
    try {
      if (cashDrawerSession) {
        const expenses = await dbService.getStoreExpensesBySession(cashDrawerSession.id);
        // Sort descending by timestamp
        expenses.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        setExpensesList(expenses);

        const todayStr = new Date().toISOString().split('T')[0];
        const summary = await dbService.getSummaryByDate(todayStr);
        setCashCollectedToday(summary.cashCollected);
      } else {
        const history = await dbService.getClosedCashDrawerSessions();
        history.sort((a, b) => new Date(b.closed_at).getTime() - new Date(a.closed_at).getTime());
        setClosedSessions(history);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadSessionData(); }, [cashDrawerSession, lastTransactionTimestamp]);

  // ── Handlers ─────────────────────────────────────────────────────────────────
  const handleOpenDrawer = () => {
    const amount = parseFloat(settings.default_opening_cash || '0') || 0;
    openCashDrawer(amount);
  };

  const openTxnModal = (type: typeof expenseType) => {
    setExpenseType(type);
    setExpenseAmount('');
    setExpenseDesc('');
    setTxnModalVisible(true);
  };

  const handleAddExpense = () => {
    const amt = parseFloat(expenseAmount);
    if (!amt || amt === 0 || !expenseDesc.trim()) {
      Alert.alert('Missing Info', 'Please enter a valid amount and description.');
      return;
    }
    if (amt < 0 && expenseType !== 'ADJUSTMENT') {
      Alert.alert('Invalid', 'Only Adjustments can be negative.');
      return;
    }
    addExpense(expenseType, amt, expenseDesc.trim());
    setTxnModalVisible(false);
    setExpenseAmount('');
    setExpenseDesc('');
  };

  const handleCloseDrawer = () => {
    const actual = parseFloat(actualCashInput) || 0;
    const v = actual - expectedCash;
    closeCashDrawer(expectedCash, actual, v);
    setCloseModalVisible(false);
    setActualCashInput('');
  };

  // ── Derived Math ─────────────────────────────────────────────────────────────
  const totalCashIn = expensesList.filter(e => e.type === 'CASH_IN').reduce((sum, e) => sum + e.amount, 0);
  const totalExpenses = expensesList.filter(e => e.type === 'EXPENSE').reduce((sum, e) => sum + e.amount, 0);
  const totalWithdrawals = expensesList.filter(e => e.type === 'WITHDRAWAL').reduce((sum, e) => sum + e.amount, 0);
  const totalAdjustments = expensesList.filter(e => e.type === 'ADJUSTMENT').reduce((sum, e) => sum + e.amount, 0);

  const expectedCash = cashDrawerSession
    ? cashDrawerSession.opening_cash + cashCollectedToday + totalCashIn - totalExpenses - totalWithdrawals + totalAdjustments
    : 0;

  const totalMoneyIn = cashDrawerSession ? cashDrawerSession.opening_cash + cashCollectedToday + totalCashIn : 0;
  const totalMoneyOut = totalExpenses + totalWithdrawals;

  const actualInputVal = parseFloat(actualCashInput) || 0;
  const variance = actualInputVal - expectedCash;
  const varianceSign = variance > 0 ? '+' : variance < 0 ? '-' : '';

  // ── Formatters ───────────────────────────────────────────────────────────────
  const fmt = (v: any) => { const n = Number(v); return isNaN(n) ? '0.00' : n.toFixed(2); };
  const fmtTime = (ts: string) => new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const fmtDate = (ts: string) => new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  return (
    <SafeAreaView style={[s.root, { backgroundColor: theme.bg }]}>
      
      {/* ══════════════════════════════════════════════════════════════
          STATE: SHIFT CLOSED
      ══════════════════════════════════════════════════════════════ */}
      {!cashDrawerSession && (
        <View style={s.screen}>
          <View style={{ flex: 1, flexDirection: 'row', gap: 20 }}>
            
            {/* Left: Start Day */}
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
              <Ionicons name="lock-closed" size={56} color={theme.textMuted} />
              <Text style={[s.pageTitle, { color: theme.textPrimary, marginTop: 12 }]}>Shift Closed</Text>
              <Text style={[s.pageSub, { color: theme.textSecondary, marginBottom: 24 }]}>Start a new shift to begin processing sales.</Text>
              
              <View style={[s.startBox, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <Text style={[s.label, { color: theme.textSecondary }]}>DEFAULT OPENING CASH</Text>
                <Text style={[s.expectedVal, { color: theme.textPrimary, marginVertical: 8, fontSize: 24 }]}>
                  ₱{fmt(settings.default_opening_cash || 0)}
                </Text>
                <TouchableOpacity onPress={handleOpenDrawer} style={[s.primaryBtn, { backgroundColor: theme.primary, alignSelf: 'stretch' }]}>
                  <Text style={s.primaryBtnText}>START DAY</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Right: History */}
            <View style={{ flex: 1.2, backgroundColor: theme.surface, borderRadius: 8, borderWidth: StyleSheet.hairlineWidth, borderColor: theme.border, padding: 14 }}>
              <Text style={[s.label, { color: theme.textSecondary, marginBottom: 12 }]}>PREVIOUS CLOSED DAYS</Text>
              <FlatList
                data={closedSessions}
                keyExtractor={item => item.id}
                showsVerticalScrollIndicator={false}
                ListEmptyComponent={<Text style={[s.emptyText, { color: theme.textMuted }]}>No previous closed days.</Text>}
                renderItem={({ item }) => (
                  <View style={[s.historyCard, { backgroundColor: theme.bg, borderColor: theme.border }]}>
                    <View style={s.row}>
                      <View>
                        <Text style={[s.itemMeta, { color: theme.textPrimary, fontWeight: '700' }]}>{fmtDate(item.closed_at)}</Text>
                        <Text style={[s.itemMeta, { color: theme.textMuted }]}>{fmtTime(item.closed_at)}</Text>
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={[s.itemMeta, { color: theme.textSecondary }]}>Expected: ₱{fmt(item.expected_cash)}</Text>
                        <Text style={[s.itemMeta, { color: theme.textPrimary, fontWeight: '700' }]}>Actual: ₱{fmt(item.actual_cash)}</Text>
                      </View>
                    </View>
                    <View style={[s.divider, { backgroundColor: theme.border, marginVertical: 6 }]} />
                    <View style={s.row}>
                      <Text style={[s.itemMeta, { color: theme.textSecondary }]}>Variance</Text>
                      <Text style={[s.itemMeta, { fontWeight: '700', color: item.variance === 0 ? theme.success : item.variance > 0 ? theme.success : theme.danger }]}>
                        {item.variance > 0 ? '+' : ''}₱{fmt(item.variance)}
                      </Text>
                    </View>
                  </View>
                )}
              />
            </View>
          </View>
        </View>
      )}

      {/* ══════════════════════════════════════════════════════════════
          STATE: SHIFT OPEN
      ══════════════════════════════════════════════════════════════ */}
      {cashDrawerSession && (
        <View style={s.screen}>
          
          {/* Header */}
          <View style={s.headerRow}>
            <View>
              <Text style={[s.pageTitle, { color: theme.textPrimary }]}>CASH DRAWER</Text>
              <Text style={[s.pageSub, { color: theme.success }]}>● SHIFT OPEN</Text>
            </View>
          </View>

          {/* 2-Column Landscape Layout */}
          <View style={{ flex: 1, flexDirection: 'row', gap: 16 }}>
            
            {/* LEFT COLUMN: Summary & Actions */}
            <View style={{ width: '42%', gap: 12 }}>
              
              {/* Expected Cash */}
              <View style={[s.expectedBox, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <Text style={[s.label, { color: theme.textSecondary }]}>EXPECTED CASH</Text>
                <Text style={[s.expectedVal, { color: theme.primary }]}>₱{fmt(expectedCash)}</Text>
                <Text style={[s.itemMeta, { color: theme.textMuted }]}>Current drawer balance</Text>
              </View>

              {/* Money In/Out side-by-side */}
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <Text style={[s.label, { color: theme.textSecondary }]}>MONEY IN</Text>
                  <Text style={[s.moneyVal, { color: theme.success }]}>+₱{fmt(totalMoneyIn)}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[s.label, { color: theme.textSecondary }]}>MONEY OUT</Text>
                  <Text style={[s.moneyVal, { color: theme.danger }]}>-₱{fmt(totalMoneyOut)}</Text>
                </View>
              </View>

              <View style={[s.divider, { backgroundColor: theme.border, marginTop: 4 }]} />

              {/* Quick Actions Grid */}
              <Text style={[s.label, { color: theme.textSecondary }]}>QUICK ACTIONS</Text>
              <View style={s.quickActionsGrid}>
                <TouchableOpacity onPress={() => openTxnModal('CASH_IN')} style={[s.actionBtn, { borderColor: theme.border, backgroundColor: theme.surface }]}>
                  <Text style={[s.actionBtnText, { color: theme.success }]}>+ CASH IN</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => openTxnModal('EXPENSE')} style={[s.actionBtn, { borderColor: theme.border, backgroundColor: theme.surface }]}>
                  <Text style={[s.actionBtnText, { color: theme.danger }]}>- EXPENSE</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => openTxnModal('WITHDRAWAL')} style={[s.actionBtn, { borderColor: theme.border, backgroundColor: theme.surface }]}>
                  <Text style={[s.actionBtnText, { color: theme.danger }]}>- WITHDRAWAL</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => openTxnModal('ADJUSTMENT')} style={[s.actionBtn, { borderColor: theme.border, backgroundColor: theme.surface }]}>
                  <Text style={[s.actionBtnText, { color: theme.textPrimary }]}>± ADJUSTMENT</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* RIGHT COLUMN: Activity & Close Shift */}
            <View style={{ flex: 1, backgroundColor: theme.surface, borderRadius: 8, borderWidth: StyleSheet.hairlineWidth, borderColor: theme.border, padding: 14 }}>
              <Text style={[s.label, { color: theme.textSecondary, marginBottom: 8 }]}>TODAY'S MANUAL ACTIVITY</Text>
              
              {loading ? (
                <View style={s.centerFill}>
                  <ActivityIndicator size="small" color={theme.primary} />
                </View>
              ) : (
                <FlatList
                  style={{ flex: 1 }}
                  data={expensesList}
                  keyExtractor={item => item.id}
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={{ paddingBottom: 10 }}
                  ListEmptyComponent={
                    <View style={s.centerFill}>
                      <Text style={[s.emptyText, { color: theme.textMuted }]}>No manual cash activity yet.</Text>
                      <Text style={[s.itemMeta, { color: theme.textMuted, marginTop: 2 }]}>Sales and Utang payments update Expected Cash automatically.</Text>
                    </View>
                  }
                  renderItem={({ item }) => {
                    const isPos = item.type === 'CASH_IN' || (item.type === 'ADJUSTMENT' && item.amount >= 0);
                    const color = isPos ? theme.success : theme.danger;
                    const sign = item.amount >= 0 ? (isPos ? '+' : '') : '';
                    return (
                      <View style={[s.activityRow, { borderBottomColor: theme.border }]}>
                        <View style={{ flex: 1 }}>
                          <Text style={[s.itemMeta, { color: theme.textSecondary }]}>{fmtTime(item.timestamp)} · {item.type.replace('_', ' ')}</Text>
                          <Text style={[s.itemTitle, { color: theme.textPrimary }]} numberOfLines={1}>{item.description}</Text>
                        </View>
                        <Text style={[s.itemAmt, { color }]}>{sign}₱{fmt(item.amount)}</Text>
                      </View>
                    );
                  }}
                />
              )}

              <View style={{ marginTop: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border, paddingTop: 12 }}>
                <TouchableOpacity onPress={() => setCloseModalVisible(true)} style={[s.primaryBtn, { backgroundColor: theme.danger }]}>
                  <Text style={s.primaryBtnText}>CLOSE BUSINESS DAY</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      )}
      {/* ══════════════════════════════════════════════════════════════
          MODAL: ADD TRANSACTION
      ══════════════════════════════════════════════════════════════ */}
      <Modal visible={txnModalVisible} transparent animationType="fade" onRequestClose={() => setTxnModalVisible(false)}>
        <KeyboardAvoidingView style={s.overlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <TouchableOpacity style={StyleSheet.absoluteFillObject} activeOpacity={1} onPress={() => setTxnModalVisible(false)} />
          <View style={[s.modalBox, { backgroundColor: theme.surface, borderColor: theme.border }]} onStartShouldSetResponder={() => true}>
            
            <View style={s.modalTitleRow}>
              <View>
                <Text style={[s.modalTitle, { color: theme.textPrimary }]}>{expenseType.replace('_', ' ')}</Text>
                <Text style={[s.pageSub, { color: theme.textSecondary }]}>Add manual record to cash drawer</Text>
              </View>
              <TouchableOpacity onPress={() => setTxnModalVisible(false)}>
                <Ionicons name="close" size={18} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>

            <View style={{ flexDirection: 'row', gap: 12, marginTop: 14 }}>
              <View style={{ flex: 1 }}>
                <Text style={[s.label, { color: theme.textSecondary, marginBottom: 6 }]}>AMOUNT</Text>
                <View style={[s.inputBox, { borderColor: theme.border, backgroundColor: theme.bg }]}>
                  <Text style={{ color: theme.textPrimary, fontSize: 14, marginRight: 6 }}>₱</Text>
                  <TextInput
                    style={[s.modalInput, { color: theme.textPrimary }]}
                    placeholder="0.00"
                    keyboardType="numeric"
                    placeholderTextColor={theme.textMuted}
                    value={expenseAmount}
                    onChangeText={setExpenseAmount}
                    autoFocus
                  />
                </View>
              </View>
              <View style={{ flex: 1.5 }}>
                <Text style={[s.label, { color: theme.textSecondary, marginBottom: 6 }]}>DESCRIPTION</Text>
                <View style={[s.inputBox, { borderColor: theme.border, backgroundColor: theme.bg }]}>
                  <TextInput
                    style={[s.modalInput, { color: theme.textPrimary }]}
                    placeholder="What was this for?"
                    placeholderTextColor={theme.textMuted}
                    value={expenseDesc}
                    onChangeText={setExpenseDesc}
                  />
                </View>
              </View>
            </View>

            <View style={[s.row, { gap: 10, marginTop: 16 }]}>
              <TouchableOpacity style={[s.modalBtnOutline, { flex: 1, borderColor: theme.border }]} onPress={() => setTxnModalVisible(false)}>
                <Text style={{ color: theme.textPrimary, fontWeight: '600', fontSize: 13 }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.modalBtnSolid, { flex: 1, backgroundColor: theme.primary }]} onPress={handleAddExpense}>
                <Text style={{ color: '#fff', fontWeight: '600', fontSize: 13 }}>Save {expenseType.replace('_', ' ')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ══════════════════════════════════════════════════════════════
          MODAL: CLOSE BUSINESS DAY
      ══════════════════════════════════════════════════════════════ */}
      <Modal visible={closeModalVisible} transparent animationType="fade" onRequestClose={() => setCloseModalVisible(false)}>
        <KeyboardAvoidingView style={s.overlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <TouchableOpacity style={StyleSheet.absoluteFillObject} activeOpacity={1} onPress={() => setCloseModalVisible(false)} />
          <View style={[s.modalBox, { backgroundColor: theme.surface, borderColor: theme.border }]} onStartShouldSetResponder={() => true}>
            
            <View style={s.modalTitleRow}>
              <View>
                <Text style={[s.modalTitle, { color: theme.textPrimary }]}>CLOSE BUSINESS DAY</Text>
                <Text style={[s.pageSub, { color: theme.textSecondary }]}>Count the physical cash in the drawer.</Text>
              </View>
              <TouchableOpacity onPress={() => setCloseModalVisible(false)}>
                <Ionicons name="close" size={18} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>

            <View style={[s.row, { gap: 16, marginTop: 16, alignItems: 'flex-start' }]}>
              
              <View style={{ flex: 1, gap: 14 }}>
                <View>
                  <Text style={[s.label, { color: theme.textSecondary }]}>EXPECTED CASH</Text>
                  <Text style={[s.expectedVal, { color: theme.primary, marginTop: 2, fontSize: 18 }]}>₱{fmt(expectedCash)}</Text>
                </View>
                
                <View>
                  <Text style={[s.label, { color: theme.textSecondary }]}>VARIANCE</Text>
                  <Text style={{ fontSize: 14, fontWeight: '700', color: variance === 0 ? theme.success : variance > 0 ? theme.success : theme.danger, marginTop: 2 }}>
                    {varianceSign}₱{fmt(Math.abs(variance))}
                    <Text style={{ fontWeight: '400', color: theme.textSecondary }}>
                      {variance === 0 ? ' (Balanced)' : variance > 0 ? ' (Over)' : ' (Short)'}
                    </Text>
                  </Text>
                </View>
              </View>
              
              <View style={{ flex: 1 }}>
                <Text style={[s.label, { color: theme.textSecondary, marginBottom: 6 }]}>ACTUAL CASH COUNT (₱)</Text>
                <View style={[s.inputBox, { borderColor: theme.border, backgroundColor: theme.bg, height: 46 }]}>
                  <Text style={{ color: theme.textPrimary, fontSize: 18, marginRight: 6 }}>₱</Text>
                  <TextInput
                    style={[s.modalInput, { color: theme.textPrimary, fontSize: 18, fontWeight: '700' }]}
                    placeholder="0.00"
                    keyboardType="numeric"
                    placeholderTextColor={theme.textMuted}
                    value={actualCashInput}
                    onChangeText={setActualCashInput}
                    autoFocus
                  />
                </View>
              </View>

            </View>

            <View style={[s.row, { gap: 10, marginTop: 20 }]}>
              <TouchableOpacity style={[s.modalBtnOutline, { flex: 1, borderColor: theme.border }]} onPress={() => setCloseModalVisible(false)}>
                <Text style={{ color: theme.textPrimary, fontWeight: '600', fontSize: 13 }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.modalBtnSolid, { flex: 1, backgroundColor: theme.danger }]} onPress={handleCloseDrawer}>
                <Text style={{ color: '#fff', fontWeight: '600', fontSize: 13 }}>Confirm Close Shift</Text>
              </TouchableOpacity>
            </View>

          </View>
        </KeyboardAvoidingView>
      </Modal>

    </SafeAreaView>
  );
};

// ─── Styles: Landscape phone optimized ────────────────────────────────────────
const s = StyleSheet.create({
  root: { flex: 1 },
  screen: { flex: 1, paddingHorizontal: 14, paddingTop: 8, paddingBottom: 6 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  divider: { height: StyleSheet.hairlineWidth, marginBottom: 8 },
  centerFill: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  
  // Text
  label: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  pageTitle: { fontSize: 16, fontWeight: '700', letterSpacing: 0.5 },
  pageSub: { fontSize: 11, marginTop: 1 },
  emptyText: { fontSize: 13, marginTop: 4 },
  
  // Header
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  
  // Dashboard Boxes
  expectedBox: { padding: 12, borderRadius: 6, borderWidth: StyleSheet.hairlineWidth },
  expectedVal: { fontSize: 22, fontWeight: '800', marginTop: 2, marginBottom: 2 },
  moneyVal: { fontSize: 16, fontWeight: '700', marginTop: 2 },
  startBox: { width: 300, padding: 16, borderRadius: 8, borderWidth: StyleSheet.hairlineWidth, alignItems: 'center' },
  
  // Quick Actions
  quickActionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 },
  actionBtn: { width: '48%', height: 36, borderRadius: 5, borderWidth: StyleSheet.hairlineWidth, justifyContent: 'center', alignItems: 'center' },
  actionBtnText: { fontSize: 11, fontWeight: '700' },
  
  // Lists
  historyCard: { padding: 10, borderRadius: 6, borderWidth: StyleSheet.hairlineWidth, marginBottom: 8 },
  activityRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth },
  itemMeta: { fontSize: 11 },
  itemTitle: { fontSize: 13, fontWeight: '600', marginTop: 2 },
  itemAmt: { fontSize: 13, fontWeight: '700' },
  
  // Buttons
  primaryBtn: { height: 36, borderRadius: 5, justifyContent: 'center', alignItems: 'center' },
  primaryBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  
  // Modals
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalBox: { width: '90%', maxWidth: 500, borderRadius: 10, borderWidth: StyleSheet.hairlineWidth, padding: 18, elevation: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 12 },
  modalTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  modalTitle: { fontSize: 13, fontWeight: '700', letterSpacing: 0.5 },
  inputBox: { flexDirection: 'row', alignItems: 'center', height: 38, borderRadius: 5, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 10 },
  modalInput: { flex: 1, fontSize: 14, padding: 0 },
  modalBtnOutline: { height: 36, borderRadius: 5, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
  modalBtnSolid: { height: 36, borderRadius: 5, justifyContent: 'center', alignItems: 'center' },
});
