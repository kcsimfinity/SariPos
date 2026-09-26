import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  ScrollView
} from 'react-native';
import { dbService } from '../database/databaseService';
import { Sale } from '../types';
import { usePOS } from '../context/POSContext';
import { getTheme } from '../theme/theme';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native'; // Auto-Refresh Trigger

export const SalesScreen: React.FC = () => {
  const { settings } = usePOS();
  const theme = getTheme(settings.theme === 'dark');

  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [showDatePickerModal, setShowDatePickerModal] = useState(false);

  const [pickerYear, setPickerYear] = useState(selectedDate.getFullYear());
  const [pickerMonth, setPickerMonth] = useState(selectedDate.getMonth());

  const [summary, setSummary] = useState<any>(null);
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);

  const yearStr = selectedDate.getFullYear();
  const monthStr = String(selectedDate.getMonth() + 1).padStart(2, '0');
  const dayStr = String(selectedDate.getDate()).padStart(2, '0');
  const dateStr = `${yearStr}-${monthStr}-${dayStr}`;

  const loadSalesData = async () => {
    setLoading(true);
    try {
      const [sum, history] = await Promise.all([
        dbService.getSummaryByDate(dateStr),
        dbService.getSalesByDate(dateStr)
      ]);
      setSummary(sum || {});
      setSales(history || []);
    } catch (err) {
      console.error('Failed to load sales summary for date:', dateStr, err);
    } finally {
      setLoading(false);
    }
  };

  // Automatically refresh when you switch back to this tab
  useFocusEffect(
    useCallback(() => {
      loadSalesData();
    }, [dateStr])
  );

  const handleOpenPicker = () => {
    setPickerYear(selectedDate.getFullYear());
    setPickerMonth(selectedDate.getMonth());
    setShowDatePickerModal(true);
  };

  const handleSelectDay = (dayNum: number) => {
    const chosen = new Date(pickerYear, pickerMonth, dayNum);
    const today = new Date();
    if (chosen > today) setSelectedDate(today);
    else setSelectedDate(chosen);
    setShowDatePickerModal(false);
  };

  const formatMoney = (val: any): string => {
    const num = Number(val);
    return isNaN(num) ? '0.00' : num.toFixed(2);
  };

  const formatDateDisplay = (d: Date) => {
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  };

  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const daysInMonth = new Date(pickerYear, pickerMonth + 1, 0).getDate();
  const firstDayOfWeek = new Date(pickerYear, pickerMonth, 1).getDay();

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      
      {/* CENTERED TAPPABLE DATE BAR */}
      <View style={styles.dateBarWrapper}>
        <TouchableOpacity style={[styles.datePickerBtn, { backgroundColor: theme.surface, borderColor: theme.border }]} onPress={handleOpenPicker} activeOpacity={0.75}>
          <Ionicons name="calendar" size={16} color={theme.accent} />
          <Text style={[styles.datePickerText, { color: theme.textPrimary }]}>{formatDateDisplay(selectedDate)}</Text>
          <Ionicons name="chevron-down" size={16} color={theme.textSecondary} />
        </TouchableOpacity>
      </View>

      {/* 3-METRIC SUMMARY BANNER */}
      <View style={styles.metricsRow}>
        <View style={[styles.metricCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={styles.metricHeader}>
            <Ionicons name="cash-outline" size={14} color={theme.textSecondary} />
            <Text style={[styles.metricLabel, { color: theme.textSecondary }]}>Gross Sales</Text>
          </View>
          <Text style={[styles.metricVal, { color: theme.textPrimary }]}>₱{formatMoney(summary?.grossSales)}</Text>
        </View>

        <View style={[styles.metricCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={styles.metricHeader}>
            <Ionicons name="receipt-outline" size={14} color={theme.textSecondary} />
            <Text style={[styles.metricLabel, { color: theme.textSecondary }]}>COGS (Cost)</Text>
          </View>
          <Text style={[styles.metricVal, { color: theme.textPrimary }]}>₱{formatMoney(summary?.cogs)}</Text>
        </View>

        <View style={[styles.metricCard, { backgroundColor: theme.surface, borderColor: theme.success }]}>
          <View style={styles.metricHeader}>
            <Ionicons name="trending-up-outline" size={14} color={theme.success} />
            <Text style={[styles.metricLabel, { color: theme.textSecondary }]}>Gross Profit</Text>
          </View>
          <Text style={[styles.metricVal, { color: theme.success }]}>₱{formatMoney(summary?.grossProfit)}</Text>
        </View>
      </View>

      {/* TRANSACTION HISTORY */}
      <View style={styles.historyContainer}>
        <View style={styles.historyHeaderRow}>
          <View>
            <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>
              Transaction History ({sales.length})
            </Text>
            <Text style={[styles.sectionSub, { color: theme.textSecondary }]}>
              {summary?.txCount || 0} Txns • {summary?.totalItemsSold || 0} Items
            </Text>
          </View>
          <TouchableOpacity onPress={loadSalesData} style={{ padding: 4 }}>
            <Ionicons name="refresh" size={18} color={theme.accent} />
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="small" color={theme.primary} />
            <Text style={[styles.loadingText, { color: theme.textSecondary }]}>Loading Transactions...</Text>
          </View>
        ) : sales.length === 0 ? (
          <View style={[styles.emptyCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Ionicons name="receipt-outline" size={32} color={theme.textMuted} />
            <Text style={[styles.emptyTitle, { color: theme.textPrimary }]}>No transactions found</Text>
            <Text style={[styles.emptySub, { color: theme.textSecondary }]}>
              There were no POS checkout sales recorded on {formatDateDisplay(selectedDate)}.
            </Text>
          </View>
        ) : (
          <FlatList
            data={sales}
            keyExtractor={item => item.id}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 24 }}
            refreshing={loading}
            onRefresh={loadSalesData}
            renderItem={({ item }) => {
              const totalDiscount = (item.item_discounts || 0) + (item.transaction_discount || 0);

              return (
                <View style={[styles.historyCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                  <View style={styles.historyCardLeft}>
                    <Text style={[styles.txNo, { color: theme.textPrimary }]}>
                      {item.transaction_no} {item.payment_method === 'CREDIT' ? `(${item.customer_name || 'Utang'})` : ''}
                    </Text>
                    <Text style={[styles.txMeta, { color: theme.textSecondary }]}>
                      {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {item.payment_method}
                    </Text>
                    {totalDiscount > 0 && (
                      <Text style={{ fontSize: 11, color: theme.warning, marginTop: 2, fontWeight: 'bold' }}>
                        Discount Given: ₱{formatMoney(totalDiscount)}
                      </Text>
                    )}
                  </View>

                  <View style={styles.historyCardRight}>
                    <Text style={[styles.txTotal, { color: theme.success }]}>
                      ₱{formatMoney(item.total)}
                    </Text>
                    
                    {/* Utang Split Display */}
                    {item.payment_method === 'CREDIT' && (
                      <Text style={{ fontSize: 11, color: theme.danger, marginTop: 2, fontWeight: 'bold' }}>
                        DP: ₱{formatMoney(item.amount_paid)} | Utang: ₱{formatMoney(item.total - item.amount_paid)}
                      </Text>
                    )}

                    <Text style={[styles.txProfit, { color: theme.textSecondary, marginTop: item.payment_method === 'CREDIT' ? 2 : 4 }]}>
                      Profit: ₱{formatMoney(item.gross_profit)}
                    </Text>
                  </View>
                </View>
              )
            }}
          />
        )}
      </View>

      {/* COMPACT CALENDAR MODAL */}
      <Modal visible={showDatePickerModal} transparent animationType="fade" onRequestClose={() => setShowDatePickerModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <View style={[styles.modalHeader, { borderBottomColor: theme.border }]}>
              <Text style={[styles.modalTitle, { color: theme.textPrimary }]}>Select Sales Date</Text>
              <TouchableOpacity style={styles.closeBtn} onPress={() => setShowDatePickerModal(false)} activeOpacity={0.7}>
                <Ionicons name="close" size={20} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ flexShrink: 1 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 4 }}>
              <View style={styles.monthHeaderRow}>
                <TouchableOpacity style={[styles.monthNavBtn, { backgroundColor: theme.bg, borderColor: theme.border }]} onPress={() => { if (pickerMonth === 0) { setPickerMonth(11); setPickerYear(pickerYear - 1); } else { setPickerMonth(pickerMonth - 1); } }}>
                  <Ionicons name="chevron-back" size={14} color={theme.textPrimary} />
                </TouchableOpacity>

                <Text style={[styles.monthTitleText, { color: theme.textPrimary }]}>{months[pickerMonth]} {pickerYear}</Text>

                <TouchableOpacity style={[styles.monthNavBtn, { backgroundColor: theme.bg, borderColor: theme.border }]} onPress={() => { if (pickerMonth === 11) { setPickerMonth(0); setPickerYear(pickerYear + 1); } else { setPickerMonth(pickerMonth + 1); } }}>
                  <Ionicons name="chevron-forward" size={14} color={theme.textPrimary} />
                </TouchableOpacity>
              </View>

              <View style={styles.weekdaysRow}>
                {weekdays.map(w => <Text key={w} style={[styles.weekdayText, { color: theme.textSecondary }]}>{w}</Text>)}
              </View>

              <View style={styles.calendarGrid}>
                {Array.from({ length: firstDayOfWeek }).map((_, idx) => <View key={`empty-${idx}`} style={styles.calendarCell} />)}

                {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(dayNum => {
                  const isSelected = selectedDate.getDate() === dayNum && selectedDate.getMonth() === pickerMonth && selectedDate.getFullYear() === pickerYear;
                  return (
                    <TouchableOpacity key={dayNum} style={[styles.calendarCell, isSelected && { backgroundColor: theme.primary, borderRadius: 6 }]} onPress={() => handleSelectDay(dayNum)} activeOpacity={0.7}>
                      <Text style={[styles.calendarDayText, { color: isSelected ? '#ffffff' : theme.textPrimary }]}>{dayNum}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>

            <TouchableOpacity style={[styles.todayResetBtn, { backgroundColor: theme.primaryGlow }]} onPress={() => { setSelectedDate(new Date()); setShowDatePickerModal(false); }} activeOpacity={0.8}>
              <Ionicons name="time-outline" size={14} color={theme.accent} />
              <Text style={[styles.todayResetBtnText, { color: theme.accent }]}>Jump to Today</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 14 },
  dateBarWrapper: { alignItems: 'center', marginBottom: 14 },
  datePickerBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 20, height: 48, borderRadius: 12, borderWidth: 1, width: '100%', maxWidth: 360 },
  datePickerText: { fontSize: 14, fontWeight: 'bold' },
  metricsRow: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  metricCard: { flex: 1, paddingHorizontal: 12, paddingVertical: 12, borderRadius: 12, borderWidth: 1, justifyContent: 'center' },
  metricHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  metricLabel: { fontSize: 12, fontWeight: 'bold' },
  metricVal: { fontSize: 16, fontWeight: 'bold', marginTop: 4 },
  historyContainer: { flex: 1 },
  historyHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 10 },
  sectionTitle: { fontSize: 16, fontWeight: 'bold' },
  sectionSub: { fontSize: 12, marginTop: 2 },
  loadingBox: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 6 },
  loadingText: { fontSize: 13, fontWeight: 'bold' },
  emptyCard: { flex: 1, padding: 24, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  emptyTitle: { fontSize: 14, fontWeight: 'bold' },
  emptySub: { fontSize: 12, textAlign: 'center' },
  historyCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12, borderRadius: 10, borderWidth: 1, marginBottom: 8, minHeight: 52 },
  historyCardLeft: { justifyContent: 'center', flex: 1 },
  txNo: { fontSize: 14, fontWeight: 'bold' },
  txMeta: { fontSize: 12, marginTop: 2 },
  historyCardRight: { alignItems: 'flex-end', justifyContent: 'center' },
  txTotal: { fontSize: 15, fontWeight: 'bold' },
  txProfit: { fontSize: 12 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'center', alignItems: 'center', padding: 12 },
  modalCard: { width: '90%', maxWidth: 320, maxHeight: '90%', borderRadius: 12, borderWidth: 1, padding: 14, gap: 8 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 8, borderBottomWidth: 1, marginBottom: 4 },
  modalTitle: { fontSize: 14, fontWeight: 'bold' },
  closeBtn: { padding: 4 },
  monthHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 2 },
  monthNavBtn: { width: 32, height: 32, borderRadius: 8, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
  monthTitleText: { fontSize: 13, fontWeight: 'bold' },
  weekdaysRow: { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 2 },
  weekdayText: { width: 36, textAlign: 'center', fontSize: 11, fontWeight: 'bold' },
  calendarGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-start' },
  calendarCell: { width: '14.28%', height: 34, justifyContent: 'center', alignItems: 'center', marginVertical: 1 }, 
  calendarDayText: { fontSize: 12, fontWeight: 'bold' },
  todayResetBtn: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, height: 38, borderRadius: 8, marginTop: 4 },
  todayResetBtnText: { fontSize: 13, fontWeight: 'bold' },
});