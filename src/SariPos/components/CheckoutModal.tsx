import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import {
    Alert,
    KeyboardAvoidingView,
    Modal,
    Platform,
    ScrollView,
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

interface Props {
  visible: boolean;
  totalAmount: number;
  onClose: () => void;
  onSuccess: (sale: Sale) => void;
}

export const CheckoutModal: React.FC<Props> = ({ visible, totalAmount, onClose, onSuccess }) => {
  const { checkout, settings, cart, transactionDiscount } = usePOS();
  const theme = getTheme(settings.theme === 'dark');
  const { height } = useWindowDimensions();

  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'CREDIT'>('CASH');
  const [cashGiven, setCashGiven] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [downpayment, setDownpayment] = useState('');
  
  const [utangCustomers, setUtangCustomers] = useState<any[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);

  useEffect(() => {
    if (visible) {
      dbService.getCustomers().then(list => setUtangCustomers(list || []));
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
        Alert.alert('Invalid Downpayment', 'Downpayment cannot be equal to or greater than the total amount due. Process as Cash instead.');
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

  // Derived order totals
  const subtotal = cart.reduce((sum, i) => sum + (i.unitPrice * i.quantity), 0);
  const itemDiscounts = cart.reduce((sum, i) => sum + (i.discount || 0), 0);
  const totalDisc = itemDiscounts + (transactionDiscount || 0);

  const fmt = (v: number) => v.toFixed(2);
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView style={s.overlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <TouchableOpacity style={StyleSheet.absoluteFillObject} activeOpacity={1} onPress={onClose} />
        
        {/* Responsive Card constrained to 95% of available height */}
        <View style={[s.card, { backgroundColor: theme.surface, maxHeight: height * 0.95 }]} onStartShouldSetResponder={() => true}>
          
          {/* HEADER (Always visible) */}
          <View style={[s.header, { borderBottomColor: theme.border }]}>
            <Text style={[s.title, { color: theme.textPrimary }]}>CHECKOUT</Text>
            <TouchableOpacity onPress={onClose} style={s.closeBtn} activeOpacity={0.7}>
              <Ionicons name="close" size={20} color={theme.textPrimary} />
            </TouchableOpacity>
          </View>

          {/* CONTENT (Scrolls if too tall) */}
          <ScrollView 
            style={{ flexShrink: 1 }} 
            contentContainerStyle={s.contentScroll} 
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <View style={s.twoCol}>
              
              {/* LEFT COLUMN: Payment Logic */}
              <View style={s.colLeft}>
                <View>
                  <Text style={[s.sectionLabel, { color: theme.textSecondary }]}>PAYMENT METHOD</Text>
                  <View style={s.methodRow}>
                    <TouchableOpacity
                      style={[s.methodBtn, { backgroundColor: paymentMethod === 'CASH' ? theme.primary : theme.bg, borderColor: paymentMethod === 'CASH' ? theme.primary : theme.border }]}
                      onPress={() => setPaymentMethod('CASH')}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="cash-outline" size={16} color={paymentMethod === 'CASH' ? '#fff' : theme.textPrimary} />
                      <Text style={[s.methodText, { color: paymentMethod === 'CASH' ? '#fff' : theme.textPrimary }]}>Cash</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[s.methodBtn, { backgroundColor: paymentMethod === 'CREDIT' ? theme.danger : theme.bg, borderColor: paymentMethod === 'CREDIT' ? theme.danger : theme.border }]}
                      onPress={() => { setPaymentMethod('CREDIT'); setShowDropdown(false); }}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="book-outline" size={16} color={paymentMethod === 'CREDIT' ? '#fff' : theme.textPrimary} />
                      <Text style={[s.methodText, { color: paymentMethod === 'CREDIT' ? '#fff' : theme.textPrimary }]}>Utang</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {paymentMethod === 'CASH' ? (
                  <View style={{ flexDirection: 'row', gap: 12 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={[s.sectionLabel, { color: theme.textSecondary }]}>AMOUNT RECEIVED (₱)</Text>
                      <View style={[s.inputBox, { backgroundColor: theme.bg, borderColor: theme.border }]}>
                        <Text style={{ color: theme.textPrimary, fontSize: 16, marginRight: 6 }}>₱</Text>
                        <TextInput
                          style={[s.input, { color: theme.textPrimary }]}
                          keyboardType="numeric"
                          placeholder="0.00"
                          placeholderTextColor={theme.textMuted}
                          value={cashGiven}
                          onChangeText={setCashGiven}
                          autoFocus={true}
                        />
                      </View>
                    </View>
                    
                    <View style={{ flex: 1 }}>
                      <Text style={[s.sectionLabel, { color: theme.textSecondary }]}>CHANGE TO GIVE</Text>
                      <View style={[s.changeBox, { backgroundColor: cashNum >= totalAmount ? theme.successGlow : theme.bg, borderColor: cashNum >= totalAmount ? theme.success : theme.border, borderWidth: StyleSheet.hairlineWidth }]}>
                        <Text style={[s.changeVal, { color: cashNum >= totalAmount ? theme.success : theme.textMuted }]}>₱{fmt(changeVal)}</Text>
                      </View>
                    </View>
                  </View>
                ) : (
                  <View style={{ gap: 12 }}>
                    <View style={{ zIndex: 10 }}>
                      <Text style={[s.sectionLabel, { color: theme.textSecondary }]}>BORROWER'S NAME</Text>
                      <View style={[s.inputBox, { backgroundColor: theme.bg, borderColor: theme.border }]}>
                        <TextInput
                          style={[s.input, { color: theme.textPrimary }]}
                          placeholder="e.g. Aling Nena"
                          placeholderTextColor={theme.textMuted}
                          value={customerName}
                          onFocus={() => setShowDropdown(true)}
                          onChangeText={text => { setCustomerName(text); setShowDropdown(true); }}
                          autoFocus={true}
                        />
                      </View>
                      
                      {isDropdownVisible && (
                        <View style={[s.dropdownContainer, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}>
                          {filteredNames.map((name, index) => (
                            <TouchableOpacity
                              key={name}
                              style={[s.dropdownItem, { borderBottomColor: theme.border }, index === filteredNames.length - 1 && { borderBottomWidth: 0 }]}
                              onPress={() => { setCustomerName(name); setShowDropdown(false); }}
                            >
                              <Ionicons name="person-circle-outline" size={16} color={theme.accent} />
                              <Text style={[s.dropdownItemText, { color: theme.textPrimary }]}>{name}</Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      )}
                    </View>

                    <View>
                      <Text style={[s.sectionLabel, { color: theme.textSecondary }]}>DOWNPAYMENT (OPTIONAL) ₱</Text>
                      <View style={[s.inputBox, { backgroundColor: theme.bg, borderColor: theme.border }]}>
                        <Text style={{ color: theme.textPrimary, fontSize: 16, marginRight: 6 }}>₱</Text>
                        <TextInput
                          style={[s.input, { color: theme.textPrimary }]}
                          keyboardType="numeric"
                          placeholder="0.00"
                          placeholderTextColor={theme.textMuted}
                          value={downpayment}
                          onFocus={() => setShowDropdown(false)}
                          onChangeText={setDownpayment}
                        />
                      </View>
                    </View>

                    {dpNum > 0 && (
                      <View style={[s.changeBox, { backgroundColor: theme.dangerGlow, padding: 8 }]}>
                        <Text style={[s.changeLabel, { color: theme.danger }]}>ADDED TO UTANG</Text>
                        <Text style={[s.changeVal, { color: theme.danger, fontSize: 16 }]}>₱{fmt(utangAdded)}</Text>
                      </View>
                    )}
                  </View>
                )}
              </View>

              {/* RIGHT COLUMN: Order Summary */}
              <View style={s.colRight}>
                <Text style={[s.sectionLabel, { color: theme.textSecondary }]}>ORDER SUMMARY</Text>
                
                <View style={[s.cartBox, { borderColor: theme.border }]}>
                  {cart.map(item => (
                    <View key={item.id} style={s.cartRow}>
                      <Text numberOfLines={1} style={[s.cartText, { color: theme.textPrimary }]}>
                        {item.product.name} <Text style={{ color: theme.textMuted }}>x{item.quantity}</Text>
                      </Text>
                      <Text style={[s.cartPrice, { color: theme.textPrimary }]}>₱{fmt(item.unitPrice * item.quantity)}</Text>
                    </View>
                  ))}
                  {cart.length === 0 && <Text style={{ color: theme.textMuted, fontSize: 12, textAlign: 'center' }}>Cart is empty</Text>}
                </View>

                <View style={[s.totalsBox, { borderColor: theme.border, backgroundColor: theme.bg }]}>
                  <View style={s.totalsRow}><Text style={[s.totalsLabel, { color: theme.textSecondary }]}>Subtotal</Text><Text style={[s.totalsVal, { color: theme.textPrimary }]}>₱{fmt(subtotal)}</Text></View>
                  <View style={s.totalsRow}><Text style={[s.totalsLabel, { color: theme.textSecondary }]}>Discount</Text><Text style={[s.totalsVal, { color: theme.warning }]}>-₱{fmt(totalDisc)}</Text></View>
                  <View style={[s.divider, { backgroundColor: theme.border }]} />
                  <View style={[s.totalsRow, { marginBottom: 0 }]}><Text style={[s.totalText, { color: theme.textPrimary }]}>TOTAL</Text><Text style={[s.totalAmount, { color: theme.success }]}>₱{fmt(totalAmount)}</Text></View>
                </View>
              </View>
            </View>
          </ScrollView>

          {/* FOOTER (Always visible) */}
          <View style={[s.footer, { borderTopColor: theme.border }]}>
            <TouchableOpacity style={[s.cancelBtn, { borderColor: theme.border, backgroundColor: theme.surfaceElevated }]} onPress={onClose} activeOpacity={0.7}>
              <Text style={[s.cancelText, { color: theme.textPrimary }]}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.confirmBtn, { backgroundColor: paymentMethod === 'CASH' ? theme.primary : theme.danger }]} onPress={handleSubmit} activeOpacity={0.8}>
              <Ionicons name="checkmark-circle" size={16} color="#ffffff" />
              <Text style={s.confirmText}>
                {paymentMethod === 'CASH' ? 'Complete Sale' : 'Save Utang'}
              </Text>
            </TouchableOpacity>
          </View>

        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};
const s = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 10 },
  card: { width: '100%', maxWidth: 700, borderRadius: 12, elevation: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 8, overflow: 'hidden' },
  
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: StyleSheet.hairlineWidth },
  title: { fontSize: 16, fontWeight: '800', letterSpacing: 0.5 },
  closeBtn: { padding: 4 },
  
  contentScroll: { padding: 16 },
  twoCol: { flexDirection: 'row', gap: 24 },
  colLeft: { flex: 1.2, gap: 16 },
  colRight: { flex: 1, gap: 12 },
  
  sectionLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5, marginBottom: 8 },
  
  methodRow: { flexDirection: 'row', gap: 12 },
  methodBtn: { flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, height: 40, borderRadius: 8, borderWidth: 1 },
  methodText: { fontWeight: '700', fontSize: 13 },
  
  inputBox: { height: 44, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, flexDirection: 'row', alignItems: 'center' },
  input: { flex: 1, fontSize: 15, fontWeight: '700', padding: 0 },
  
  dropdownContainer: { position: 'absolute', top: 68, left: 0, right: 0, borderRadius: 8, borderWidth: 1, zIndex: 100, elevation: 4 },
  dropdownItem: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  dropdownItemText: { fontSize: 14, fontWeight: '600' },
  
  changeBox: { padding: 12, borderRadius: 8, alignItems: 'center', marginTop: 4 },
  changeLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  changeVal: { fontSize: 20, fontWeight: '900', marginTop: 2 },
  
  cartBox: { borderRadius: 8, borderWidth: 1, padding: 10, gap: 8 },
  cartRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cartText: { fontSize: 13, fontWeight: '600', flex: 1, paddingRight: 8 },
  cartPrice: { fontSize: 13, fontWeight: '700' },
  
  totalsBox: { padding: 12, borderRadius: 8, borderWidth: 1 },
  totalsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  totalsLabel: { fontSize: 12, fontWeight: '600' },
  totalsVal: { fontSize: 13, fontWeight: '700' },
  divider: { height: StyleSheet.hairlineWidth, marginVertical: 8 },
  totalText: { fontSize: 14, fontWeight: '900' },
  totalAmount: { fontSize: 18, fontWeight: '900' },
  
  footer: { flexDirection: 'row', gap: 12, padding: 16, borderTopWidth: StyleSheet.hairlineWidth },
  cancelBtn: { flex: 1, height: 44, borderRadius: 8, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
  cancelText: { fontWeight: '700', fontSize: 13 },
  confirmBtn: { flex: 2, height: 44, borderRadius: 8, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6 },
  confirmText: { color: '#ffffff', fontWeight: '800', fontSize: 13 },
});
