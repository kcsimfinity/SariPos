import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { usePOS } from '../context/POSContext';
import { getTheme } from '../theme/theme';
import { Sale } from '../types';

interface Props {
  sale: Sale | null;
  onClose: () => void;
}

export const ReceiptModal: React.FC<Props> = ({ sale, onClose }) => {
  const { settings } = usePOS();
  const theme = getTheme(settings.theme === 'dark');

  if (!sale) return null;

  return (
    <Modal visible={true} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.card, { backgroundColor: theme.surface }]}>
          
          {/* LEFT: Success Status */}
          <View style={styles.leftCol}>
            <View style={[styles.iconBox, { backgroundColor: theme.successGlow }]}>
              <Ionicons name="checkmark" size={36} color={theme.success} />
            </View>
            <Text style={[styles.title, { color: theme.textPrimary }]}>Success!</Text>
            <Text style={[styles.sub, { color: theme.textSecondary }]}>Txn: {sale.transaction_no}</Text>
          </View>

          {/* RIGHT: Details & Action */}
          <View style={styles.rightCol}>
            <View style={[styles.details, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}>
              <View style={styles.row}>
                <Text style={[styles.label, { color: theme.textSecondary }]}>Total</Text>
                <Text style={[styles.val, { color: theme.textPrimary }]}>₱{sale.total.toFixed(2)}</Text>
              </View>
              <View style={styles.row}>
                <Text style={[styles.label, { color: theme.textSecondary }]}>Method</Text>
                <Text style={[styles.val, { color: theme.textPrimary }]}>
                  {sale.payment_method === 'CREDIT' ? 'Utang' : 'Cash'}
                </Text>
              </View>

              {sale.payment_method === 'CASH' && (
                <>
                  <View style={styles.row}>
                    <Text style={[styles.label, { color: theme.textSecondary }]}>Paid</Text>
                    <Text style={[styles.val, { color: theme.textPrimary }]}>₱{sale.amount_paid.toFixed(2)}</Text>
                  </View>
                  <View style={[styles.row, { marginTop: 4, paddingTop: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border }]}>
                    <Text style={[styles.label, { color: theme.textSecondary }]}>Change</Text>
                    <Text style={[styles.val, { color: theme.success, fontSize: 18 }]}>₱{sale.change_amount.toFixed(2)}</Text>
                  </View>
                </>
              )}

              {sale.payment_method === 'CREDIT' && (
                <>
                  <View style={styles.row}>
                    <Text style={[styles.label, { color: theme.textSecondary }]}>Borrower</Text>
                    <Text style={[styles.val, { color: theme.textPrimary }]} numberOfLines={1}>{sale.customer_name}</Text>
                  </View>
                  <View style={styles.row}>
                    <Text style={[styles.label, { color: theme.textSecondary }]}>Downpayment</Text>
                    <Text style={[styles.val, { color: theme.textPrimary }]}>₱{sale.amount_paid.toFixed(2)}</Text>
                  </View>
                  <View style={[styles.row, { marginTop: 4, paddingTop: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border }]}>
                    <Text style={[styles.label, { color: theme.textSecondary }]}>Added to Utang</Text>
                    <Text style={[styles.val, { color: theme.danger, fontSize: 18 }]}>₱{(sale.total - sale.amount_paid).toFixed(2)}</Text>
                  </View>
                </>
              )}
            </View>

            <TouchableOpacity 
              style={[styles.doneBtn, { backgroundColor: theme.primary }]} 
              onPress={onClose}
              activeOpacity={0.8}
            >
              <Text style={styles.doneText}>Next Customer</Text>
            </TouchableOpacity>
          </View>

        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 16 },
  card: { width: '100%', maxWidth: 520, borderRadius: 16, padding: 20, elevation: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 8, flexDirection: 'row', alignItems: 'center', gap: 24 },
  
  leftCol: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  iconBox: { width: 72, height: 72, borderRadius: 36, justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  title: { fontSize: 22, fontWeight: '900', marginBottom: 4 },
  sub: { fontSize: 12 },
  
  rightCol: { flex: 1.4 },
  details: { width: '100%', padding: 14, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, gap: 6 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  label: { fontSize: 12, fontWeight: '700' },
  val: { fontSize: 13, fontWeight: '800' },
  
  doneBtn: { width: '100%', height: 44, marginTop: 16, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  doneText: { color: '#ffffff', fontSize: 14, fontWeight: '800' }
});