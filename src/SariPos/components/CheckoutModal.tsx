import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  Modal, 
  TextInput, 
  TouchableOpacity, 
  StyleSheet, 
  Alert, 
  ScrollView
} from 'react-native';
import { usePOS } from '../context/POSContext';
import { dbService } from '../database/databaseService';
import { Sale } from '../types';
import { Ionicons } from '@expo/vector-icons';
import { getTheme } from '../theme/theme';

interface Props {
  visible: boolean;
  totalAmount: number;
  onClose: () => void;
  onSuccess: (sale: Sale) => void;
}

export const CheckoutModal: React.FC<Props> = ({ visible, totalAmount, onClose, onSuccess }) => {
  const { checkout, settings } = usePOS();
  const theme = getTheme(settings.theme === 'dark');

  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'CREDIT'>('CASH');
  const [cashGiven, setCashGiven] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [downpayment, setDownpayment] = useState('');
  
  const [utangCustomers, setUtangCustomers] = useState<any[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);

  useEffect(() => {
    if (visible) {
      dbService.getUtangCustomers().then(list => setUtangCustomers(list || []));
    } else {
      setCashGiven('');
      setCustomerName('');
      setDownpayment('');
      setPaymentMethod('CASH');
      setShowDropdown(false);
    }
  }, [visible]);

  const handleSubmit = async () => {
    if (paymentMethod === 'CASH') {
      const amountPaid = parseFloat(cashGiven) || 0;
      if (amountPaid < totalAmount) {
        Alert.alert('Payment Error', 'Cash received is less than total amount due.');
        return;
      }
      const sale = await checkout('CASH', amountPaid);
      if (sale) {
        onSuccess(sale);
      }
    } else {
      if (!customerName.trim()) {
        Alert.alert('Missing Borrower Name', 'Please enter the name of the customer getting this on Utang.');
        return;
      }
      const initialPaid = parseFloat(downpayment) || 0;
      
      if (initialPaid >= totalAmount) {
        Alert.alert('Invalid Downpayment', 'Downpayment cannot be equal to or greater than the total amount due. Process as a Cash payment instead.');
        return;
      }

      const sale = await checkout('CREDIT', initialPaid, customerName.trim());
      if (sale) {
        onSuccess(sale);
      }
    }
  };

  const cashNum = parseFloat(cashGiven) || 0;
  const changeVal = Math.max(0, cashNum - totalAmount);
  const dpNum = parseFloat(downpayment) || 0;
  const utangAdded = Math.max(0, totalAmount - dpNum);

  const filteredNames = utangCustomers
    .map(c => c.customer_name)
    .filter(name => name.toLowerCase().includes(customerName.toLowerCase()));

  const isDropdownVisible = showDropdown && filteredNames.length > 0;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={[styles.header, { borderBottomColor: theme.border }]}>
            <Text style={[styles.title, { color: theme.textPrimary }]}>Complete Checkout</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
              <Ionicons name="close" size={24} color={theme.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView 
            contentContainerStyle={{ gap: 14, paddingVertical: 16 }} 
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <View style={[styles.amountBanner, { backgroundColor: theme.bg, borderColor: theme.border }]}>
              <Text style={[styles.amountLabel, { color: theme.textSecondary }]}>TOTAL AMOUNT DUE</Text>
              <Text style={[styles.amountVal, { color: theme.success }]}>₱{totalAmount.toFixed(2)}</Text>
            </View>

            <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>SELECT PAYMENT METHOD</Text>
            <View style={styles.methodRow}>
              <TouchableOpacity
                style={[
                  styles.methodBtn,
                  { backgroundColor: theme.bg, borderColor: theme.border },
                  paymentMethod === 'CASH' && { backgroundColor: theme.primary, borderColor: theme.primary }
                ]}
                onPress={() => setPaymentMethod('CASH')}
                activeOpacity={0.8}
              >
                <Ionicons name="cash-outline" size={20} color={paymentMethod === 'CASH' ? '#ffffff' : theme.textSecondary} />
                <Text style={[styles.methodText, { color: paymentMethod === 'CASH' ? '#ffffff' : theme.textSecondary }]}>
                  Cash Payment
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.methodBtn,
                  { backgroundColor: theme.bg, borderColor: theme.border },
                  paymentMethod === 'CREDIT' && { backgroundColor: theme.danger, borderColor: theme.danger }
                ]}
                onPress={() => {
                  setPaymentMethod('CREDIT');
                  setShowDropdown(false);
                }}
                activeOpacity={0.8}
              >
                <Ionicons name="book-outline" size={20} color={paymentMethod === 'CREDIT' ? '#ffffff' : theme.textSecondary} />
                <Text style={[styles.methodText, { color: paymentMethod === 'CREDIT' ? '#ffffff' : theme.textSecondary }]}>
                  Utang / Credit
                </Text>
              </TouchableOpacity>
            </View>

            {paymentMethod === 'CASH' ? (
              <View style={styles.inputGroup}>
                <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>CASH RECEIVED (₱) *</Text>
                <TextInput
                  style={[styles.bigInput, { backgroundColor: theme.bg, color: theme.textPrimary, borderColor: theme.border }]}
                  keyboardType="numeric"
                  placeholder="e.g. 500"
                  placeholderTextColor={theme.textMuted}
                  value={cashGiven}
                  onChangeText={setCashGiven}
                />
                {cashNum >= totalAmount && (
                  <View style={[styles.changeBox, { backgroundColor: theme.successGlow }]}>
                    <Text style={[styles.changeLabel, { color: theme.success }]}>CHANGE TO GIVE:</Text>
                    <Text style={[styles.changeVal, { color: theme.success }]}>₱{changeVal.toFixed(2)}</Text>
                  </View>
                )}
              </View>
            ) : (
              <View style={styles.inputGroup}>
                <View style={{ marginBottom: 4, zIndex: 10 }}>
                  <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>BORROWER'S NAME (UTANG CUSTOMER) *</Text>
                  <TextInput
                    style={[styles.bigInput, { backgroundColor: theme.bg, color: theme.textPrimary, borderColor: theme.border }]}
                    placeholder="e.g. Aling Nena, Pareng Boy"
                    placeholderTextColor={theme.textMuted}
                    value={customerName}
                    onFocus={() => setShowDropdown(true)}
                    onChangeText={text => {
                      setCustomerName(text);
                      setShowDropdown(true);
                    }}
                  />
                  
                  {isDropdownVisible && (
                    <View style={[styles.dropdownContainer, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}>
                      <ScrollView style={{ maxHeight: 150 }} keyboardShouldPersistTaps="handled" nestedScrollEnabled>
                        {filteredNames.map((name, index) => (
                          <TouchableOpacity
                            key={name}
                            style={[
                              styles.dropdownItem,
                              { borderBottomColor: theme.border },
                              index === filteredNames.length - 1 && { borderBottomWidth: 0 }
                            ]}
                            onPress={() => {
                              setCustomerName(name);
                              setShowDropdown(false);
                            }}
                          >
                            <Ionicons name="person-circle-outline" size={16} color={theme.accent} />
                            <Text style={[styles.dropdownItemText, { color: theme.textPrimary }]}>{name}</Text>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    </View>
                  )}
                </View>

                <View style={{ marginBottom: 8, zIndex: 1 }}>
                  <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>PARTIAL DOWNPAYMENT (OPTIONAL) ₱</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: theme.bg, color: theme.textPrimary, borderColor: theme.border }]}
                    keyboardType="numeric"
                    placeholder="0.00"
                    placeholderTextColor={theme.textMuted}
                    value={downpayment}
                    onFocus={() => setShowDropdown(false)}
                    onChangeText={setDownpayment}
                  />
                </View>

                <View style={[styles.utangSummaryBox, { backgroundColor: theme.dangerGlow, borderColor: theme.danger, zIndex: 1 }]}>
                  <Text style={[styles.utangSummaryText, { color: theme.danger }]}>
                    Amount Added to Utang: ₱{utangAdded.toFixed(2)}
                  </Text>
                </View>
              </View>
            )}
          </ScrollView>

          <View style={[styles.actionRow, { borderTopColor: theme.border }]}>
            <TouchableOpacity style={[styles.cancelBtn, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]} onPress={onClose} activeOpacity={0.7}>
              <Text style={[styles.cancelText, { color: theme.textPrimary }]}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.confirmBtn, { backgroundColor: paymentMethod === 'CASH' ? theme.primary : theme.danger }]} onPress={handleSubmit} activeOpacity={0.8}>
              <Ionicons name="checkmark-circle" size={18} color="#ffffff" />
              <Text style={styles.confirmText}>
                {paymentMethod === 'CASH' ? 'Complete Sale' : 'Record Utang'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  card: { width: '90%', maxWidth: 640, borderRadius: 16, borderWidth: 1, padding: 20, maxHeight: '90%' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 14, borderBottomWidth: 1 },
  title: { fontSize: 16, fontWeight: 'bold' },
  closeBtn: { padding: 4 },
  amountBanner: { paddingVertical: 16, borderRadius: 12, borderWidth: 1, alignItems: 'center' },
  amountLabel: { fontSize: 12, fontWeight: 'bold' },
  amountVal: { fontSize: 18, fontWeight: 'bold', marginTop: 4 },
  fieldLabel: { fontSize: 12, fontWeight: 'bold', marginBottom: 6 },
  methodRow: { flexDirection: 'row', gap: 12 },
  methodBtn: { flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, paddingVertical: 14, borderRadius: 10, borderWidth: 1 },
  methodText: { fontWeight: 'bold', fontSize: 14 },
  inputGroup: { gap: 10, marginTop: 6 },
  bigInput: { paddingHorizontal: 16, paddingVertical: 14, borderRadius: 10, borderWidth: 1, fontSize: 14, fontWeight: 'bold' },
  input: { paddingHorizontal: 16, paddingVertical: 12, borderRadius: 10, borderWidth: 1, fontSize: 14 },
  
  // New Dropdown Styles
  dropdownContainer: {
    marginTop: 4,
    borderRadius: 8,
    borderWidth: 1,
    overflow: 'hidden',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  dropdownItemText: {
    fontSize: 14,
    fontWeight: 'bold',
  },

  changeBox: { paddingVertical: 14, borderRadius: 10, alignItems: 'center', marginTop: 6 },
  changeLabel: { fontSize: 12, fontWeight: 'bold' },
  changeVal: { fontSize: 16, fontWeight: 'bold', marginTop: 4 },
  utangSummaryBox: { paddingVertical: 14, borderRadius: 10, borderWidth: 1, alignItems: 'center', marginTop: 6 },
  utangSummaryText: { fontSize: 14, fontWeight: 'bold' },
  actionRow: { flexDirection: 'row', gap: 12, paddingTop: 16, borderTopWidth: 1 },
  cancelBtn: { flex: 1, paddingVertical: 14, borderRadius: 10, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
  cancelText: { fontWeight: 'bold', fontSize: 14, textAlign: 'center' },
  confirmBtn: { flex: 2, paddingVertical: 14, borderRadius: 10, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 },
  confirmText: { color: '#ffffff', fontWeight: 'bold', fontSize: 14, textAlign: 'center' },
});