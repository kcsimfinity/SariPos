import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import React, { useState } from 'react';
import {
  Alert,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions
} from 'react-native';
import { usePOS } from '../context/POSContext';
import { dbService } from '../database/databaseService';
import { getTheme } from '../theme/theme';
import { StoreSettings } from '../types';

export const SettingsScreen: React.FC = () => {
  const { settings, updateStoreSettings, toggleTheme } = usePOS();
  const theme = getTheme(settings.theme === 'dark');
  const { width } = useWindowDimensions();

  const [form, setForm] = useState<StoreSettings>(settings);
  const [activeSection, setActiveSection] = useState<'STORE' | 'APPEARANCE' | 'CASH_DRAWER' | 'DATA' | 'RESET'>('STORE');

  const handleSaveStoreInfo = async () => {
    if (!form.store_name.trim()) {
      Alert.alert('Validation Error', 'Store Name cannot be empty.');
      return;
    }
    await updateStoreSettings(form);
    Alert.alert('Success', 'Settings updated successfully.');
  };

  const saveToAndroidFolder = async (fileName: string, mimeType: string, content: string): Promise<boolean> => {
    if (Platform.OS === 'android') {
      try {
        const permissions = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
        if (permissions.granted) {
          const fileUri = await FileSystem.StorageAccessFramework.createFileAsync(
            permissions.directoryUri,
            fileName,
            mimeType
          );
          await FileSystem.writeAsStringAsync(fileUri, content);
          Alert.alert('Export Successful', 'File saved to destination folder.');
          return true;
        }
      } catch (e: any) {
        console.log('SAF Error:', e.message);
      }
    }
    return false;
  };

  const handleExportJSON = async () => {
    try {
      const jsonStr = await dbService.exportDatabaseJSON();
      const fileName = `SariPos_Backup_${Date.now()}`;

      const savedDirectly = await saveToAndroidFolder(fileName, 'application/json', jsonStr);
      if (savedDirectly) return;

      const tempUri = `${FileSystem.documentDirectory}${fileName}.json`;
      await FileSystem.writeAsStringAsync(tempUri, jsonStr);

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(tempUri, { mimeType: 'application/json', dialogTitle: 'Export System JSON Backup' });
      }
    } catch (e: any) {
      Alert.alert('Export Error', e.message);
    }
  };

  const handleExportCSVReport = async () => {
    try {
      const [products, sales] = await Promise.all([
        dbService.getProducts(),
        dbService.getSales(1000)
      ]);

      let csv = '--- INVENTORY STOCK REPORT ---\nName,Category,Type,Piece Sell,Pack Sell,Stock Pieces\n';
      products.forEach(p => {
        csv += `"${p.name}","${p.category_name || ''}","${p.pricing_type}",${p.selling_price_piece},${p.selling_price_pack},${p.stock_pieces}\n`;
      });

      csv += '\n--- TRANSACTION LEDGER ---\nTxn No,Timestamp,Method,Subtotal,Discount,Total,COGS,Profit\n';
      sales.forEach(s => {
        csv += `"${s.transaction_no}","${s.timestamp}","${s.payment_method}",${s.subtotal},${s.item_discounts + s.transaction_discount},${s.total},${s.total_cogs},${s.gross_profit}\n`;
      });

      const fileName = `SariPos_Ledger_${Date.now()}`;
      const savedDirectly = await saveToAndroidFolder(fileName, 'text/csv', csv);
      if (savedDirectly) return;

      const tempUri = `${FileSystem.documentDirectory}${fileName}.csv`;
      await FileSystem.writeAsStringAsync(tempUri, csv);

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(tempUri, { mimeType: 'text/csv', dialogTitle: 'Export CSV Ledger' });
      }
    } catch (e: any) {
      Alert.alert('CSV Error', e.message);
    }
  };

  const handleFactoryReset = () => {
    Alert.alert(
      'FACTORY RESET WARNING',
      'This will permanently delete ALL products, stock history, and sales records. This cannot be undone. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'ERASE EVERYTHING',
          style: 'destructive',
          onPress: async () => {
            try {
              const emptyBackup = JSON.stringify({
                version: 4,
                timestamp: new Date().toISOString(),
                data: { categories: [], products: [], sales: [], saleItems: [], stockAdjustments: [], settings: [] }
              });
              await dbService.importDatabaseJSON(emptyBackup);
              Alert.alert('Reset Complete', 'System reset to factory defaults.');
            } catch (e: any) {
              Alert.alert('Reset Error', e.message);
            }
          }
        }
      ]
    );
  };
  const NavTab = ({ id, icon, label, isDanger }: any) => {
    const isActive = activeSection === id;
    const color = isDanger ? theme.danger : theme.primary;
    const activeColor = '#ffffff';
    const inactiveColor = isDanger ? theme.danger : theme.textSecondary;

    return (
      <TouchableOpacity
        style={[
          styles.navTab,
          { backgroundColor: isActive ? color : 'transparent' }
        ]}
        onPress={() => setActiveSection(id)}
        activeOpacity={0.8}
      >
        <Ionicons name={icon} size={16} color={isActive ? activeColor : inactiveColor} />
        <Text style={[styles.navTabText, { color: isActive ? activeColor : inactiveColor }]}>{label}</Text>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
      
      {/* HEADER & COMPACT NAVIGATION */}
      <View style={[styles.headerContainer, { backgroundColor: theme.surface, borderBottomColor: theme.border }]}>
        <View style={styles.headerTitleRow}>
          <Text style={[styles.pageTitle, { color: theme.textPrimary }]}>SETTINGS</Text>
          <Text style={[styles.pageSub, { color: theme.textSecondary }]}>Manage your POS configuration</Text>
        </View>
        
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.navScroll}>
          <NavTab id="STORE" icon="storefront" label="Store Profile" />
          <NavTab id="APPEARANCE" icon="color-palette" label="Appearance" />
          <NavTab id="CASH_DRAWER" icon="cash" label="Cash Drawer" />
          <NavTab id="DATA" icon="cloud-download" label="Backup & Reports" />
          <NavTab id="RESET" icon="warning" label="Danger Zone" isDanger />
        </ScrollView>
      </View>

      {/* CONTENT AREA (Scrolls only if necessary) */}
      <View style={styles.contentContainer}>
        <ScrollView contentContainerStyle={styles.contentScroll} showsVerticalScrollIndicator={false}>
          
          {/* STORE TAB */}
          {activeSection === 'STORE' && (
            <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <View style={styles.cardHeader}>
                <View style={[styles.badgeIcon, { backgroundColor: theme.primaryGlow }]}>
                  <Ionicons name="storefront" size={20} color={theme.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.cardTitle, { color: theme.textPrimary }]}>Store Information</Text>
                  <Text style={[styles.cardSub, { color: theme.textSecondary }]}>Basic information used throughout the POS</Text>
                </View>
              </View>

              <View style={styles.horizontalForm}>
                <View style={{ flex: 1, gap: 6 }}>
                  <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>STORE NAME</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: theme.bg, color: theme.textPrimary, borderColor: theme.border }]}
                    value={form.store_name}
                    onChangeText={v => setForm({ ...form, store_name: v })}
                    placeholder="e.g. Aling Nena Sari-Sari Store"
                    placeholderTextColor={theme.textMuted}
                  />
                </View>
                <TouchableOpacity style={[styles.saveBtn, { backgroundColor: theme.primary }]} onPress={handleSaveStoreInfo} activeOpacity={0.8}>
                  <Ionicons name="checkmark" size={16} color="#ffffff" />
                  <Text style={styles.saveBtnText}>SAVE SETTINGS</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* APPEARANCE TAB */}
          {activeSection === 'APPEARANCE' && (
            <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <View style={styles.cardHeader}>
                <View style={[styles.badgeIcon, { backgroundColor: theme.primaryGlow }]}>
                  <Ionicons name="color-palette" size={20} color={theme.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.cardTitle, { color: theme.textPrimary }]}>Appearance</Text>
                  <Text style={[styles.cardSub, { color: theme.textSecondary }]}>Customize how your POS looks</Text>
                </View>
              </View>

              <View style={{ flexDirection: 'row', gap: 16 }}>
                <TouchableOpacity 
                  style={[styles.themeBox, { borderColor: settings.theme === 'light' ? theme.primary : theme.border, backgroundColor: settings.theme === 'light' ? theme.primaryGlow : theme.bg }]}
                  onPress={() => settings.theme === 'dark' && toggleTheme()}
                  activeOpacity={0.8}
                >
                  <Ionicons name="sunny" size={24} color={settings.theme === 'light' ? theme.primary : theme.textSecondary} />
                  <Text style={[styles.themeTitle, { color: settings.theme === 'light' ? theme.primary : theme.textPrimary }]}>LIGHT</Text>
                  <Text style={[styles.themeSub, { color: theme.textSecondary }]}>Light interface</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={[styles.themeBox, { borderColor: settings.theme === 'dark' ? theme.primary : theme.border, backgroundColor: settings.theme === 'dark' ? theme.primaryGlow : theme.bg }]}
                  onPress={() => settings.theme === 'light' && toggleTheme()}
                  activeOpacity={0.8}
                >
                  <Ionicons name="moon" size={24} color={settings.theme === 'dark' ? theme.primary : theme.textSecondary} />
                  <Text style={[styles.themeTitle, { color: settings.theme === 'dark' ? theme.primary : theme.textPrimary }]}>DARK</Text>
                  <Text style={[styles.themeSub, { color: theme.textSecondary }]}>Dark interface</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
          {/* CASH DRAWER TAB */}
          {activeSection === 'CASH_DRAWER' && (
            <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <View style={styles.cardHeader}>
                <View style={[styles.badgeIcon, { backgroundColor: theme.primaryGlow }]}>
                  <Ionicons name="cash" size={20} color={theme.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.cardTitle, { color: theme.textPrimary }]}>Cash Drawer Settings</Text>
                  <Text style={[styles.cardSub, { color: theme.textSecondary }]}>Persistent defaults for shift management</Text>
                </View>
              </View>

              <View style={styles.horizontalForm}>
                <View style={{ flex: 1, gap: 6 }}>
                  <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>DEFAULT OPENING CASH (₱)</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: theme.bg, color: theme.textPrimary, borderColor: theme.border }]}
                    value={form.default_opening_cash}
                    onChangeText={v => setForm({ ...form, default_opening_cash: v })}
                    placeholder="e.g. 2000"
                    keyboardType="numeric"
                    placeholderTextColor={theme.textMuted}
                  />
                  <Text style={{ fontSize: 11, color: theme.textMuted, marginTop: 2 }}>This amount is suggested when starting a new business day.</Text>
                </View>
                <TouchableOpacity style={[styles.saveBtn, { backgroundColor: theme.primary, alignSelf: 'flex-start', marginTop: 20 }]} onPress={handleSaveStoreInfo} activeOpacity={0.8}>
                  <Ionicons name="checkmark" size={16} color="#ffffff" />
                  <Text style={styles.saveBtnText}>SAVE SETTINGS</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* DATA TAB */}
          {activeSection === 'DATA' && (
            <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <View style={styles.cardHeader}>
                <View style={[styles.badgeIcon, { backgroundColor: theme.successGlow }]}>
                  <Ionicons name="cloud-upload" size={20} color={theme.success} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.cardTitle, { color: theme.textPrimary }]}>Data & Backup</Text>
                  <Text style={[styles.cardSub, { color: theme.textSecondary }]}>Manage your POS data</Text>
                </View>
              </View>

              <View style={{ flexDirection: 'row', gap: 16 }}>
                <View style={[styles.dataBox, { backgroundColor: theme.bg, borderColor: theme.border }]}>
                  <Text style={[styles.dataTitle, { color: theme.textPrimary }]}>BACKUP DATABASE</Text>
                  <Text style={[styles.dataSub, { color: theme.textSecondary }]}>Save a complete copy of your POS data</Text>
                  <TouchableOpacity style={[styles.dataBtn, { backgroundColor: theme.primary }]} onPress={handleExportJSON} activeOpacity={0.8}>
                    <Ionicons name="archive" size={16} color="#ffffff" />
                    <Text style={styles.dataBtnText}>EXPORT JSON</Text>
                  </TouchableOpacity>
                </View>
                
                <View style={[styles.dataBox, { backgroundColor: theme.bg, borderColor: theme.border }]}>
                  <Text style={[styles.dataTitle, { color: theme.textPrimary }]}>SALES & INVENTORY</Text>
                  <Text style={[styles.dataSub, { color: theme.textSecondary }]}>Export information for Excel</Text>
                  <TouchableOpacity style={[styles.dataBtn, { backgroundColor: theme.success }]} onPress={handleExportCSVReport} activeOpacity={0.8}>
                    <Ionicons name="list" size={16} color="#ffffff" />
                    <Text style={styles.dataBtnText}>EXPORT CSV</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}

          {/* RESET TAB */}
          {activeSection === 'RESET' && (
            <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.danger }]}>
              <View style={styles.cardHeader}>
                <View style={[styles.badgeIcon, { backgroundColor: theme.dangerGlow }]}>
                  <Ionicons name="warning" size={20} color={theme.danger} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.cardTitle, { color: theme.danger }]}>Factory Reset</Text>
                  <Text style={[styles.cardSub, { color: theme.textSecondary }]}>Permanently remove all POS data.</Text>
                  <Text style={[styles.cardSub, { color: theme.textSecondary, marginTop: 2 }]}>This includes products, sales, customers, Utang, cash drawer history, and settings.</Text>
                </View>
              </View>

              <View style={{ alignItems: 'flex-start', marginTop: 8 }}>
                <TouchableOpacity style={styles.dangerBtn} onPress={handleFactoryReset} activeOpacity={0.8}>
                  <Ionicons name="trash" size={16} color="#ffffff" />
                  <Text style={styles.saveBtnText}>FACTORY RESET</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
          
        </ScrollView>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerContainer: { paddingVertical: 12, borderBottomWidth: 1 },
  headerTitleRow: { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 20, marginBottom: 12, gap: 12 },
  pageTitle: { fontSize: 20, fontWeight: '900', letterSpacing: 0.5 },
  pageSub: { fontSize: 13, fontWeight: '500', marginBottom: 2 },
  
  navScroll: { paddingHorizontal: 16, gap: 4 },
  navTab: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  navTabText: { fontSize: 13, fontWeight: '800' },
  
  contentContainer: { flex: 1 },
  contentScroll: { padding: 20, paddingBottom: 40 },
  
  card: { padding: 20, borderRadius: 12, borderWidth: 1, gap: 20, maxWidth: 800 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  badgeIcon: { width: 44, height: 44, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  cardTitle: { fontSize: 16, fontWeight: '800' },
  cardSub: { fontSize: 12, marginTop: 2 },
  
  horizontalForm: { flexDirection: 'row', alignItems: 'flex-end', gap: 16 },
  fieldLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  input: { height: 44, paddingHorizontal: 14, borderRadius: 8, borderWidth: 1, fontSize: 14, fontWeight: '600' },
  
  saveBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 44, paddingHorizontal: 20, borderRadius: 8 },
  saveBtnText: { color: '#ffffff', fontSize: 13, fontWeight: '800', letterSpacing: 0.5 },
  
  themeBox: { flex: 1, padding: 16, borderRadius: 10, borderWidth: 1, alignItems: 'flex-start' },
  themeTitle: { fontSize: 14, fontWeight: '800', marginTop: 12, marginBottom: 2 },
  themeSub: { fontSize: 12 },
  
  dataBox: { flex: 1, padding: 16, borderRadius: 10, borderWidth: 1, justifyContent: 'space-between' },
  dataTitle: { fontSize: 12, fontWeight: '800', letterSpacing: 0.5 },
  dataSub: { fontSize: 11, marginTop: 4, marginBottom: 16, flex: 1 },
  dataBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 40, borderRadius: 8 },
  dataBtnText: { color: '#ffffff', fontSize: 12, fontWeight: '800', letterSpacing: 0.5 },
  
  dangerBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#ef4444', height: 44, paddingHorizontal: 20, borderRadius: 8 }
});
