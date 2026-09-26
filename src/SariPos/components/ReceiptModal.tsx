import React from 'react';
import { View, Text, Modal, TouchableOpacity, StyleSheet } from 'react-native';
import { Sale } from '../types';
import { Ionicons } from '@expo/vector-icons';
import { usePOS } from '../context/POSContext';
import { getTheme } from '../theme/theme';

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
        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          
          <Ionicons 
            name="checkmark-circle" 
            size={48} 
            color={theme.success} 
            style={{ alignSelf: 'center', marginBottom: 8 }} 
          />
          
          <Text style={[styles.title, { color: theme.textPrimary }]}>
            Transaction Successful!
          </Text>
          <Text style={[styles.sub, { color: theme.textSecondary }]}>
            Txn No: {sale.transaction_no}
          </Text>

          <View style={[styles.details, { backgroundColor: theme.bg, borderColor: theme.border }]}>
            <Text style={[styles.line, { color: theme.textPrimary }]}>
              Total Due: ₱{sale.total.toFixed(2)}
            </Text>
            
            <Text style={[styles.line, { color: theme.textPrimary }]}>
              Method: {sale.payment_method === 'CREDIT' ? 'UTANG / CREDIT' : 'CASH'}
            </Text>

            {sale.payment_method === 'CASH' && (
              <>
                <Text style={[styles.line, { color: theme.textPrimary }]}>
                  Amount Given: ₱{sale.amount_paid.toFixed(2)}
                </Text>
                <Text style={[styles.line, { color: theme.success }]}>
                  Change: ₱{sale.change_amount.toFixed(2)}
                </Text>
              </>
            )}

            {sale.payment_method === 'CREDIT' && (
              <>
                <Text style={[styles.line, { color: theme.textPrimary }]}>
                  Borrower: {sale.customer_name}
                </Text>
                <Text style={[styles.line, { color: theme.textPrimary }]}>
                  Downpayment: ₱{sale.amount_paid.toFixed(2)}
                </Text>
                <Text style={[styles.line, { color: theme.danger }]}>
                  Added to Utang: ₱{(sale.total - sale.amount_paid).toFixed(2)}
                </Text>
              </>
            )}
          </View>

          <TouchableOpacity 
            style={[styles.doneBtn, { backgroundColor: theme.primary }]} 
            onPress={onClose}
            activeOpacity={0.8}
          >
            <Text style={styles.doneText}>Done / Next Customer</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: { 
    flex: 1, 
    backgroundColor: 'rgba(0,0,0,0.75)', 
    justifyContent: 'center', 
    alignItems: 'center',
    padding: 24
  },
  card: { 
    width: '90%', 
    maxWidth: 480, 
    borderRadius: 14, 
    borderWidth: 1,
    padding: 20 
  },
  title: { 
    fontSize: 16, 
    fontWeight: 'bold', 
    textAlign: 'center' 
  },
  sub: { 
    fontSize: 12, 
    textAlign: 'center', 
    marginBottom: 16 
  },
  details: { 
    padding: 14, 
    borderRadius: 10, 
    borderWidth: 1,
    gap: 8 
  },
  line: { 
    fontSize: 14, 
    fontWeight: 'bold' 
  },
  doneBtn: { 
    width: '100%', 
    marginTop: 20, 
    paddingVertical: 14, 
    borderRadius: 10, 
    alignItems: 'center',
    justifyContent: 'center'
  },
  doneText: { 
    color: '#ffffff', 
    fontSize: 14,
    fontWeight: 'bold' 
  }
});