import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import {
  FlatList,
  Modal,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View
} from 'react-native';
import { usePOS } from '../context/POSContext';
import { dbService } from '../database/databaseService';
import { getTheme } from '../theme/theme';
import { Sale } from '../types';

const fmt = (val: any): string => {
  const n = Number(val);
  return isNaN(n) ? '0.00' : n.toFixed(2);
};

const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

const fmtDateDisplay = (d: Date) =>
  d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });

export const SalesScreen: React.FC = () => {
  const { settings, lastTransactionTimestamp } = usePOS();
  const theme = getTheme(settings.theme === 'dark');
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;

  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [summary, setSummary] = useState<any>(null);
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);

  // Accordion state
  const [expandedSaleId, setExpandedSaleId] = useState<string | null>(null);

  // Filter & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMethod, setFilterMethod] = useState<'ALL' | 'CASH' | 'CREDIT' | 'UTANG_PAYMENT'>('ALL');
  const [filterModalVisible, setFilterModalVisible] = useState(false);

  // Date Picker Modal State
  const [dateModalVisible, setDateModalVisible] = useState(false);
  const [tempDate, setTempDate] = useState<Date>(new Date());

  const dateStr = [
    selectedDate.getFullYear(),
    String(selectedDate.getMonth() + 1).padStart(2, '0'),
    String(selectedDate.getDate()).padStart(2, '0'),
  ].join('-');

  const loadData = async () => {
    setLoading(true);
    try {
      const [sum, hist] = await Promise.all([
        dbService.getSummaryByDate(dateStr),
        dbService.getSalesByDate(dateStr),
      ]);
      setSummary(sum ?? {});
      setSales(hist ?? []);
    } catch (e) {
      console.error('SalesScreen load error:', e);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => { loadData(); }, [dateStr, lastTransactionTimestamp]);

  const changeDate = (days: number) => {
    const next = new Date(selectedDate);
    next.setDate(selectedDate.getDate() + days);
    if (next <= new Date()) setSelectedDate(next);
  };

  const handleApplyDate = (d: Date) => {
    if (d <= new Date()) {
      setSelectedDate(d);
    }
    setDateModalVisible(false);
  };

  const filteredSales = sales.filter(s => {
    if (filterMethod !== 'ALL' && s.payment_method !== filterMethod) {
      return false;
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchTx = s.transaction_no?.toLowerCase().includes(q);
      const matchCust = s.customer_name?.toLowerCase().includes(q);
      const matchItems = s.items?.some(i => i.product_name?.toLowerCase().includes(q));
      if (!matchTx && !matchCust && !matchItems) {
        return false;
      }
    }
    return true;
  });

  const toggleExpand = (id: string) => {
    setExpandedSaleId(prev => (prev === id ? null : id));
  };

  // ---------------------------------------------------------------------------
  // SIDE SUMMARY
  // ---------------------------------------------------------------------------
  const SummaryView = () => (
    <View style={[isLandscape ? s.sideSummaryLandscape : s.sideSummaryPortrait]}>
      {/* 1. SALES SUMMARY */}
      <View style={[s.summaryBox, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <Text style={[s.summarySectionTitle, { color: theme.textSecondary }]}>SALES SUMMARY</Text>
        <View style={s.summaryRow}>
          <Text style={[s.summaryLabel, { color: theme.textSecondary }]}>Gross Sales</Text>
          <Text style={[s.summaryValue, { color: theme.textPrimary }]}>₱{fmt(summary?.grossSales)}</Text>
        </View>
        <View style={s.summaryRow}>
          <Text style={[s.summaryLabel, { color: theme.textSecondary }]}>Discounts</Text>
          <Text style={[s.summaryValue, { color: theme.warning }]}>-₱{fmt(summary?.discounts)}</Text>
        </View>
        <View style={[s.summaryRow, s.summaryDivider, { borderTopColor: theme.border }]}>
          <Text style={[s.summaryLabelBold, { color: theme.textPrimary }]}>Net Sales</Text>
          <Text style={[s.summaryValueBold, { color: theme.textPrimary }]}>₱{fmt(summary?.netSales)}</Text>
        </View>
        <View style={s.summaryRow}>
          <Text style={[s.summaryLabel, { color: theme.textSecondary }]}>COGS</Text>
          <Text style={[s.summaryValue, { color: theme.textSecondary }]}>₱{fmt(summary?.cogs)}</Text>
        </View>
        <View style={s.summaryRow}>
          <Text style={[s.summaryLabelBold, { color: theme.success }]}>Gross Profit</Text>
          <Text style={[s.summaryValueBold, { color: theme.success }]}>₱{fmt(summary?.grossProfit)}</Text>
        </View>
      </View>

      {/* 2. CASH & CREDIT */}
      <View style={[s.summaryBox, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <Text style={[s.summarySectionTitle, { color: theme.textSecondary }]}>CASH & CREDIT</Text>
        <View style={s.summaryRow}>
          <Text style={[s.summaryLabelBold, { color: theme.textPrimary }]}>Cash Sales</Text>
          <Text style={[s.summaryValueBold, { color: theme.textPrimary }]}>₱{fmt(summary?.cashSales)}</Text>
        </View>
        <View style={s.summaryRow}>
          <Text style={[s.summaryLabel, { color: theme.danger }]}>Utang Sales</Text>
          <Text style={[s.summaryValue, { color: theme.danger }]}>₱{fmt(summary?.utangSales)}</Text>
        </View>
        <View style={[s.summaryRow, { marginTop: 8 }]}>
          <Text style={[s.summaryLabel, { color: theme.accent }]}>Utang Payments</Text>
          <Text style={[s.summaryValue, { color: theme.accent }]}>₱{fmt(summary?.utangPayments)}</Text>
        </View>
      </View>
    </View>
  );

  // ---------------------------------------------------------------------------
  // LIST HEADER
  // ---------------------------------------------------------------------------
  const ListHeader = () => (
    <View style={s.headerContainer}>
      <View style={s.headerControls}>
        <View style={[s.dateNav, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <TouchableOpacity style={s.dateNavBtn} onPress={() => changeDate(-1)}>
            <Ionicons name="chevron-back" size={20} color={theme.textPrimary} />
          </TouchableOpacity>
          <TouchableOpacity 
            style={s.dateNavCenter} 
            activeOpacity={0.7} 
            onPress={() => { setTempDate(selectedDate); setDateModalVisible(true); }}
          >
            <Ionicons name="calendar-outline" size={16} color={theme.accent} />
            <Text style={[s.dateNavText, { color: theme.textPrimary }]}>{fmtDateDisplay(selectedDate)}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.dateNavBtn} onPress={() => changeDate(1)}>
            <Ionicons name="chevron-forward" size={20} color={theme.textPrimary} />
          </TouchableOpacity>
        </View>
      </View>

      {!isLandscape && <SummaryView />}

      <View style={s.searchFilterRow}>
        <View style={[s.searchBar, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Ionicons name="search" size={16} color={theme.textMuted} />
          <TextInput
            style={[s.searchInput, { color: theme.textPrimary }]}
            placeholder="Search transaction, product, customer..."
            placeholderTextColor={theme.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery !== '' && (
            <TouchableOpacity onPress={() => setSearchQuery('')} style={{ padding: 4 }}>
              <Ionicons name="close-circle" size={16} color={theme.textMuted} />
            </TouchableOpacity>
          )}
        </View>
        
        <TouchableOpacity 
          style={[s.filterBtn, { backgroundColor: filterMethod !== 'ALL' ? theme.primary : theme.surface, borderColor: filterMethod !== 'ALL' ? theme.primary : theme.border }]} 
          onPress={() => setFilterModalVisible(true)}
        >
          <Ionicons name="filter" size={18} color={filterMethod !== 'ALL' ? '#fff' : theme.textPrimary} />
          <Text style={[{ fontSize: 13, fontWeight: '700', marginLeft: 4, color: filterMethod !== 'ALL' ? '#fff' : theme.textPrimary }]}>
            {filterMethod === 'ALL' ? 'Filter' : filterMethod === 'CREDIT' ? 'Utang' : filterMethod === 'UTANG_PAYMENT' ? 'Payment' : 'Cash'}
          </Text>
        </TouchableOpacity>
      </View>

      <Text style={[s.txCount, { color: theme.textSecondary }]}>
        {filteredSales.length} TRANSACTIONS
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={[s.root, { backgroundColor: theme.bg }]}>
      <View style={[s.mainLayout, isLandscape && { flexDirection: 'row' }]}>
        <View style={isLandscape ? s.mainColumn : { flex: 1 }}>
          <FlatList
            data={filteredSales}
            keyExtractor={item => item.id}
            ListHeaderComponent={<ListHeader />}
            contentContainerStyle={s.listContent}
            showsVerticalScrollIndicator={false}
            refreshing={loading}
            onRefresh={loadData}
            ListEmptyComponent={
              !loading ? (
                <View style={s.empty}>
                  <Ionicons name="receipt-outline" size={48} color={theme.textMuted} />
                  <Text style={[s.emptyTitle, { color: theme.textPrimary }]}>No transactions found</Text>
                </View>
              ) : null
            }
            renderItem={({ item }) => {
              const isPayment = item.payment_method === 'UTANG_PAYMENT';
              const isCredit  = item.payment_method === 'CREDIT';
              const isExpanded = expandedSaleId === item.id;
              
              let icon = 'cash-outline';
              let color = theme.success;
              let methodLabel = 'CASH';
              
              if (isPayment) {
                icon = 'log-in-outline';
                color = theme.accent;
                methodLabel = 'PAYMENT';
              } else if (isCredit) {
                icon = 'book-outline';
                color = theme.danger;
                methodLabel = 'UTANG';
              }

              return (
                <View style={[s.txCardContainer, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                  <TouchableOpacity 
                    style={s.txCardRow}
                    onPress={() => toggleExpand(item.id)}
                    activeOpacity={0.7}
                  >
                    <View style={[s.txIconBox, { backgroundColor: color + '20' }]}>
                      <Ionicons name={icon as any} size={20} color={color} />
                    </View>
                    
                    <View style={s.txCenter}>
                      <Text style={[s.txNo, { color: theme.textPrimary }]} numberOfLines={1}>
                        {item.transaction_no} {item.customer_name ? `• ${item.customer_name}` : ''}
                      </Text>
                      <Text style={[s.txTime, { color: theme.textSecondary }]}>
                        {fmtTime(item.timestamp)} {item.items && item.items.length > 0 ? `• ${item.items.reduce((a,b)=>a+b.quantity,0)} items` : ''}
                      </Text>
                    </View>

                    <View style={s.txRight}>
                      <Text style={[s.txAmt, { color: theme.textPrimary }]}>
                        {isPayment ? '+' : ''}₱{fmt(isPayment ? item.amount_paid : item.total)}
                      </Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <Text style={[s.txMethod, { color }]}>{methodLabel}</Text>
                        <Ionicons name={isExpanded ? "chevron-up" : "chevron-down"} size={14} color={theme.textMuted} />
                      </View>
                    </View>
                  </TouchableOpacity>

                  {/* TRANSACTION DETAIL ACCORDION */}
                  {isExpanded && (
                    <View style={[s.accordionContent, { borderTopColor: theme.border }]}>
                      {item.payment_method !== 'UTANG_PAYMENT' && item.items && item.items.length > 0 && (
                        <View style={s.itemsSection}>
                          {item.items.map(si => (
                            <View key={si.id} style={s.accordionItemRow}>
                              <View style={s.accordionItemLeft}>
                                <Text style={[s.accItemName, { color: theme.textPrimary }]}>{si.product_name}</Text>
                                <Text style={[s.accItemMeta, { color: theme.textSecondary }]}>
                                  {si.quantity} × {si.unit_type === 'PACK' ? 'Pack' : 'Piece'}
                                </Text>
                                <View style={{ flexDirection: 'row', gap: 12, marginTop: 2 }}>
                                  <Text style={{ fontSize: 11, color: theme.textSecondary }}>Selling ₱{fmt(si.selling_price_unit)}</Text>
                                  <Text style={{ fontSize: 11, color: theme.textMuted }}>Cost ₱{fmt(si.buying_price_unit)}</Text>
                                  {si.discount > 0 && (
                                    <Text style={{ fontSize: 11, color: theme.warning }}>Disc ₱{fmt(si.discount)}</Text>
                                  )}
                                </View>
                              </View>
                              <View style={s.accordionItemRight}>
                                <Text style={[s.accItemTotal, { color: theme.textPrimary }]}>₱{fmt(si.subtotal)}</Text>
                              </View>
                            </View>
                          ))}
                        </View>
                      )}

                      {/* Detail Totals */}
                      {item.payment_method !== 'UTANG_PAYMENT' ? (
                        <View style={s.accTotalsContainer}>
                          <View style={s.accTotalsCol}>
                            <Text style={[s.accTotalsHeader, { color: theme.textSecondary }]}>SALES</Text>
                            <View style={s.accTotalLine}><Text style={[s.accLabel, { color: theme.textSecondary }]}>Gross Sales</Text><Text style={[s.accVal, { color: theme.textPrimary }]}>₱{fmt(item.subtotal)}</Text></View>
                            <View style={s.accTotalLine}><Text style={[s.accLabel, { color: theme.textSecondary }]}>Discounts</Text><Text style={[s.accVal, { color: theme.warning }]}>-₱{fmt((item.item_discounts || 0) + (item.transaction_discount || 0))}</Text></View>
                            <View style={s.accTotalLine}><Text style={[s.accLabelBold, { color: theme.textPrimary }]}>Net Sales</Text><Text style={[s.accValBold, { color: theme.textPrimary }]}>₱{fmt(item.total)}</Text></View>
                            <View style={s.accTotalLine}><Text style={[s.accLabel, { color: theme.textSecondary }]}>COGS</Text><Text style={[s.accVal, { color: theme.textSecondary }]}>₱{fmt(item.total_cogs)}</Text></View>
                            <View style={s.accTotalLine}><Text style={[s.accLabelBold, { color: theme.success }]}>Gross Profit</Text><Text style={[s.accValBold, { color: theme.success }]}>₱{fmt(item.gross_profit)}</Text></View>
                          </View>
                          
                          <View style={s.accTotalsCol}>
                            <Text style={[s.accTotalsHeader, { color: theme.textSecondary }]}>PAYMENT</Text>
                            <View style={s.accTotalLine}><Text style={[s.accLabel, { color: theme.textSecondary }]}>{isCredit ? 'Downpayment' : 'Cash Received'}</Text><Text style={[s.accVal, { color: theme.textPrimary }]}>₱{fmt(item.amount_paid)}</Text></View>
                            {isCredit ? (
                              <View style={s.accTotalLine}><Text style={[s.accLabelBold, { color: theme.danger }]}>Balance</Text><Text style={[s.accValBold, { color: theme.danger }]}>₱{fmt(item.total - item.amount_paid)}</Text></View>
                            ) : (
                              <View style={s.accTotalLine}><Text style={[s.accLabel, { color: theme.textSecondary }]}>Change</Text><Text style={[s.accVal, { color: theme.textSecondary }]}>₱{fmt(item.change_amount)}</Text></View>
                            )}
                          </View>
                        </View>
                      ) : (
                        <View style={{ padding: 12 }}>
                          <Text style={{ fontSize: 14, color: theme.textPrimary, fontWeight: '600' }}>Payment Received: ₱{fmt(item.amount_paid)}</Text>
                        </View>
                      )}
                    </View>
                  )}
                </View>
              );
            }}
          />
        </View>

        {isLandscape && (
          <View style={s.sideColumn}>
            <SummaryView />
          </View>
        )}
      </View>

      {/* --------------------------------------------------------------------------- */}
      {/* MODALS */}
      {/* --------------------------------------------------------------------------- */}

      {/* FILTER MODAL */}
      <Modal visible={filterModalVisible} transparent animationType="fade" onRequestClose={() => setFilterModalVisible(false)}>
        <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={() => setFilterModalVisible(false)}>
          <View style={[s.pickerBox, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <View style={[s.pickerHeader, { borderBottomColor: theme.border }]}>
              <Text style={[s.pickerTitle, { color: theme.textPrimary }]}>Filter by Payment Method</Text>
              <TouchableOpacity onPress={() => setFilterModalVisible(false)}>
                <Ionicons name="close" size={24} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>
            <View style={{ paddingVertical: 8 }}>
              {(['ALL', 'CASH', 'CREDIT', 'UTANG_PAYMENT'] as const).map(m => (
                <TouchableOpacity 
                  key={m} 
                  style={[s.pickerRow, filterMethod === m && { backgroundColor: theme.primaryGlow }]}
                  onPress={() => { setFilterMethod(m); setFilterModalVisible(false); }}
                >
                  <Ionicons name={filterMethod === m ? "radio-button-on" : "radio-button-off"} size={20} color={filterMethod === m ? theme.primary : theme.textMuted} />
                  <Text style={[s.pickerRowText, { color: theme.textPrimary }]}>
                    {m === 'ALL' ? 'All Transactions' : m === 'CASH' ? 'Cash Sales' : m === 'CREDIT' ? 'Utang Sales' : 'Utang Payments'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* DATE PICKER MODAL (SIMPLE) */}
      <Modal visible={dateModalVisible} transparent animationType="fade" onRequestClose={() => setDateModalVisible(false)}>
        <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={() => setDateModalVisible(false)}>
          <View style={[s.pickerBox, { backgroundColor: theme.surface, borderColor: theme.border, padding: 20 }]}>
            <Text style={[s.pickerTitle, { color: theme.textPrimary, marginBottom: 16, textAlign: 'center' }]}>Select Date</Text>
            
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <TouchableOpacity style={s.dateNavBtn} onPress={() => { const d = new Date(tempDate); d.setMonth(d.getMonth() - 1); setTempDate(d); }}>
                <Ionicons name="chevron-back" size={24} color={theme.textPrimary} />
              </TouchableOpacity>
              
              <Text style={{ fontSize: 18, fontWeight: '700', color: theme.textPrimary }}>
                {tempDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
              </Text>
              
              <TouchableOpacity style={s.dateNavBtn} onPress={() => { const d = new Date(tempDate); d.setMonth(d.getMonth() + 1); setTempDate(d); }}>
                <Ionicons name="chevron-forward" size={24} color={theme.textPrimary} />
              </TouchableOpacity>
            </View>
            
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <TouchableOpacity style={s.dateNavBtn} onPress={() => { const d = new Date(tempDate); d.setDate(d.getDate() - 1); setTempDate(d); }}>
                <Ionicons name="remove-circle-outline" size={28} color={theme.textPrimary} />
              </TouchableOpacity>
              
              <Text style={{ fontSize: 24, fontWeight: '900', color: theme.accent }}>
                {tempDate.getDate()}
              </Text>
              
              <TouchableOpacity style={s.dateNavBtn} onPress={() => { const d = new Date(tempDate); d.setDate(d.getDate() + 1); setTempDate(d); }}>
                <Ionicons name="add-circle-outline" size={28} color={theme.textPrimary} />
              </TouchableOpacity>
            </View>

            <View style={{ flexDirection: 'row', gap: 12 }}>
              <TouchableOpacity style={[s.actionBtn, { flex: 1, backgroundColor: theme.surfaceElevated, borderColor: theme.border }]} onPress={() => setDateModalVisible(false)}>
                <Text style={{ color: theme.textPrimary, fontWeight: '700' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.actionBtn, { flex: 1, backgroundColor: theme.primary, borderColor: theme.primary }]} onPress={() => handleApplyDate(tempDate)}>
                <Text style={{ color: '#fff', fontWeight: '700' }}>Apply</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

    </SafeAreaView>
  );
};

const s = StyleSheet.create({
  root: { flex: 1 },
  mainLayout: { flex: 1 },
  mainColumn: { flex: 2, paddingRight: 8 },
  sideColumn: { flex: 1, paddingLeft: 8, paddingTop: 14, paddingRight: 14 },
  
  listContent: { padding: 14 },
  
  headerContainer: { marginBottom: 12 },
  headerControls: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  
  dateNav: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', height: 44, borderRadius: 12, borderWidth: 1, paddingHorizontal: 4, flex: 1, maxWidth: 300 },
  dateNavBtn: { padding: 8 },
  dateNavCenter: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1, justifyContent: 'center' },
  dateNavText: { fontSize: 15, fontWeight: '800' },
  
  sideSummaryPortrait: { marginBottom: 16 },
  sideSummaryLandscape: { },
  
  summaryBox: { padding: 16, borderRadius: 12, borderWidth: 1, marginBottom: 12 },
  summarySectionTitle: { fontSize: 12, fontWeight: '800', letterSpacing: 1, marginBottom: 10 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  summaryDivider: { paddingTop: 6, marginTop: 4, borderTopWidth: 1 },
  summaryLabel: { fontSize: 13, fontWeight: '600' },
  summaryValue: { fontSize: 14, fontWeight: '700' },
  summaryLabelBold: { fontSize: 14, fontWeight: '800' },
  summaryValueBold: { fontSize: 15, fontWeight: '800' },
  
  searchFilterRow: { flexDirection: 'row', gap: 8, marginBottom: 16, marginTop: 4 },
  searchBar: { flex: 1, flexDirection: 'row', alignItems: 'center', height: 44, borderRadius: 10, borderWidth: 1, paddingHorizontal: 12 },
  searchInput: { flex: 1, marginLeft: 8, fontSize: 14 },
  filterBtn: { flexDirection: 'row', alignItems: 'center', height: 44, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1, justifyContent: 'center' },
  
  txCount: { fontSize: 12, fontWeight: '800', letterSpacing: 1, marginLeft: 4, marginBottom: 8 },
  
  empty: { alignItems: 'center', justifyContent: 'center', marginTop: 40, gap: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '700' },
  
  txCardContainer: { borderRadius: 12, borderWidth: 1, marginBottom: 10, overflow: 'hidden' },
  txCardRow: { flexDirection: 'row', alignItems: 'center', padding: 14 },
  txIconBox: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  txCenter: { flex: 1, justifyContent: 'center' },
  txNo: { fontSize: 14, fontWeight: '800', marginBottom: 2 },
  txTime: { fontSize: 12 },
  txRight: { alignItems: 'flex-end', justifyContent: 'center' },
  txAmt: { fontSize: 15, fontWeight: '900', marginBottom: 2 },
  txMethod: { fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
  
  accordionContent: { borderTopWidth: 1, backgroundColor: 'rgba(0,0,0,0.01)' },
  itemsSection: { padding: 14, paddingBottom: 6 },
  accordionItemRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  accordionItemLeft: { flex: 1, paddingRight: 12 },
  accItemName: { fontSize: 13, fontWeight: '700', marginBottom: 2 },
  accItemMeta: { fontSize: 12 },
  accordionItemRight: { justifyContent: 'flex-start' },
  accItemTotal: { fontSize: 13, fontWeight: '800' },
  
  accTotalsContainer: { flexDirection: 'row', padding: 14, paddingTop: 4, gap: 20 },
  accTotalsCol: { flex: 1 },
  accTotalsHeader: { fontSize: 11, fontWeight: '800', letterSpacing: 0.5, marginBottom: 6 },
  accTotalLine: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  accLabel: { fontSize: 12, fontWeight: '500' },
  accVal: { fontSize: 12, fontWeight: '600' },
  accLabelBold: { fontSize: 12, fontWeight: '800' },
  accValBold: { fontSize: 12, fontWeight: '800' },
  
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 16 },
  pickerBox: { width: '100%', maxWidth: 360, borderRadius: 16, borderWidth: 1, overflow: 'hidden' },
  pickerHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1 },
  pickerTitle: { fontSize: 16, fontWeight: '900' },
  pickerRow: { flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 0.5, borderBottomColor: 'rgba(0,0,0,0.05)' },
  pickerRowText: { fontSize: 15, fontWeight: '600', marginLeft: 12 },
  
  actionBtn: { height: 44, borderRadius: 10, borderWidth: 1, justifyContent: 'center', alignItems: 'center' }
});
