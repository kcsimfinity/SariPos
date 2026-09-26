import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert, Switch, Platform } from 'react-native';
import { usePOS } from '../context/POSContext';
import { dbService } from '../database/databaseService';
import { StoreSettings } from '../types';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import { Ionicons } from '@expo/vector-icons';
import { getTheme } from '../theme/theme';

export const SettingsScreen: React.FC = () => {
  const { settings, updateStoreSettings, toggleTheme } = usePOS();
  const theme = getTheme(settings.theme === 'dark');

  const [form, setForm] = useState<StoreSettings>(settings);
  const [activeSection, setActiveSection] = useState<'STORE' | 'APPEARANCE' | 'RECEIPT' | 'DATA' | 'RESET'>('STORE');

  const handleSaveStoreInfo = async () => {
    if (!form.store_name.trim()) {
      Alert.alert('Validation Error', 'Store Name cannot be empty.');
      return;
    }
    await updateStoreSettings(form);
    Alert.alert('System Message', 'Store settings updated successfully.');
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
          Alert.alert('Export Successful', 'File written directly to destination folder.');
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
      const fileName = `SariPos_Database_Dump_${Date.now()}`;

      const savedDirectly = await saveToAndroidFolder(fileName, 'application/json', jsonStr);
      if (savedDirectly) return;

      const tempUri = `${FileSystem.documentDirectory}${fileName}.json`;
      await FileSystem.writeAsStringAsync(tempUri, jsonStr);

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(tempUri, { mimeType: 'application/json', dialogTitle: 'Export System JSON Backup' });
      }
    } catch (e: any) {
      Alert.alert('Export Exception', e.message);
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
      '☢️ SYSTEM PURGE WARNING',
      'This operation will permanently purge all stored products, stock histories, and transaction ledgers. Continue?',
      [
        { text: 'Abort', style: 'cancel' },
        {
          text: 'PURGE DATABASE',
          style: 'destructive',
          onPress: async () => {
            try {
              const emptyBackup = JSON.stringify({
                version: 4,
                timestamp: new Date().toISOString(),
                data: { categories: [], products: [], sales: [], saleItems: [], stockAdjustments: [], settings: [] }
              });
              await dbService.importDatabaseJSON(emptyBackup);
              Alert.alert('Purge Executed', 'System reset to factory initial state.');
            } catch (e: any) {
              Alert.alert('Reset Exception', e.message);
            }
          }
        }
      ]
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      
      {/* TOP SUB-NAVIGATION BAR */}
      <View style={[styles.topSubBar, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.topSubScroll}>
          <TouchableOpacity
            style={[
              styles.navTab,
              { backgroundColor: theme.surfaceElevated, borderColor: theme.border },
              activeSection === 'STORE' && { backgroundColor: theme.primary, borderColor: theme.accent }
            ]}
            onPress={() => setActiveSection('STORE')}
            activeOpacity={0.8}
          >
            <Ionicons name="storefront" size={16} color={activeSection === 'STORE' ? '#ffffff' : theme.textSecondary} />
            <Text style={[styles.navTabText, { color: activeSection === 'STORE' ? '#ffffff' : theme.textSecondary }]}>
              STORE PROFILE
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.navTab,
              { backgroundColor: theme.surfaceElevated, borderColor: theme.border },
              activeSection === 'APPEARANCE' && { backgroundColor: theme.primary, borderColor: theme.accent }
            ]}
            onPress={() => setActiveSection('APPEARANCE')}
            activeOpacity={0.8}
          >
            <Ionicons name="color-palette" size={16} color={activeSection === 'APPEARANCE' ? '#ffffff' : theme.textSecondary} />
            <Text style={[styles.navTabText, { color: activeSection === 'APPEARANCE' ? '#ffffff' : theme.textSecondary }]}>
              DISPLAY & THEME
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.navTab,
              { backgroundColor: theme.surfaceElevated, borderColor: theme.border },
              activeSection === 'RECEIPT' && { backgroundColor: theme.primary, borderColor: theme.accent }
            ]}
            onPress={() => setActiveSection('RECEIPT')}
            activeOpacity={0.8}
          >
            <Ionicons name="receipt" size={16} color={activeSection === 'RECEIPT' ? '#ffffff' : theme.textSecondary} />
            <Text style={[styles.navTabText, { color: activeSection === 'RECEIPT' ? '#ffffff' : theme.textSecondary }]}>
              RECEIPT CONFIG
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.navTab,
              { backgroundColor: theme.surfaceElevated, borderColor: theme.border },
              activeSection === 'DATA' && { backgroundColor: theme.primary, borderColor: theme.accent }
            ]}
            onPress={() => setActiveSection('DATA')}
            activeOpacity={0.8}
          >
            <Ionicons name="cloud-download" size={16} color={activeSection === 'DATA' ? '#ffffff' : theme.textSecondary} />
            <Text style={[styles.navTabText, { color: activeSection === 'DATA' ? '#ffffff' : theme.textSecondary }]}>
              REPORTS & BACKUP
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.navTab,
              styles.dangerNavTab,
              activeSection === 'RESET' && { backgroundColor: '#ef4444', borderColor: '#ef4444' }
            ]}
            onPress={() => setActiveSection('RESET')}
            activeOpacity={0.8}
          >
            <Ionicons name="warning" size={16} color={activeSection === 'RESET' ? '#ffffff' : '#ef4444'} />
            <Text style={[styles.navTabText, { color: activeSection === 'RESET' ? '#ffffff' : '#ef4444' }]}>
              DANGER ZONE
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {/* ACTIVE MODULE CONTENT DISPLAY */}
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        {activeSection === 'STORE' && (
          <View style={[styles.cyberCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <View style={styles.cardHeader}>
              <View style={[styles.badgeIcon, { backgroundColor: theme.primaryGlow }]}>
                <Ionicons name="business" size={20} color={theme.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.cardTitle, { color: theme.textPrimary }]}>Store Information & Branding</Text>
                <Text style={[styles.cardSub, { color: theme.textSecondary }]}>Updates store title displayed on receipts and branding headers.</Text>
              </View>
            </View>

            <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>STORE BRAND NAME</Text>
            <TextInput
              style={[styles.cyberInput, { backgroundColor: theme.bg, color: theme.textPrimary, borderColor: theme.border }]}
              value={form.store_name}
              onChangeText={v => setForm({ ...form, store_name: v })}
              placeholder="e.g. Aling Nena Sari-Sari Store"
              placeholderTextColor={theme.textMuted}
            />

            <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>LOCATION ADDRESS LINE</Text>
            <TextInput
              style={[styles.cyberInput, { backgroundColor: theme.bg, color: theme.textPrimary, borderColor: theme.border }]}
              value={form.store_address}
              onChangeText={v => setForm({ ...form, store_address: v })}
              placeholder="e.g. Brgy. San Jose, Angeles City"
              placeholderTextColor={theme.textMuted}
            />

            <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>CONTACT PHONE NUMBER</Text>
            <TextInput
              style={[styles.cyberInput, { backgroundColor: theme.bg, color: theme.textPrimary, borderColor: theme.border }]}
              value={form.store_phone}
              onChangeText={v => setForm({ ...form, store_phone: v })}
              placeholder="e.g. 0917 123 4567"
              placeholderTextColor={theme.textMuted}
            />

            <TouchableOpacity style={[styles.actionBtn, { backgroundColor: theme.primary }]} onPress={handleSaveStoreInfo} activeOpacity={0.8}>
              <Ionicons name="save" size={16} color="#ffffff" />
              <Text style={styles.actionBtnText}>SAVE STORE PROFILE</Text>
            </TouchableOpacity>
          </View>
        )}

        {activeSection === 'APPEARANCE' && (
          <View style={[styles.cyberCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <View style={styles.cardHeader}>
              <View style={[styles.badgeIcon, { backgroundColor: theme.primaryGlow }]}>
                <Ionicons name="moon" size={20} color={theme.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.cardTitle, { color: theme.textPrimary }]}>Display Mode & Visual Matrix</Text>
                <Text style={[styles.cardSub, { color: theme.textSecondary }]}>Switch between Dark Slate Mode and Light Studio Mode.</Text>
              </View>
            </View>

            <View style={[styles.switchRow, { backgroundColor: theme.bg, borderColor: theme.border }]}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.switchTitle, { color: theme.textPrimary }]}>Dark Mode Spectrum</Text>
                <Text style={[styles.switchSub, { color: theme.textSecondary }]}>High contrast slate theme designed for tablet screens.</Text>
              </View>
              <Switch
                value={settings.theme === 'dark'}
                onValueChange={toggleTheme}
                thumbColor="#ffffff"
                trackColor={{ false: '#64748b', true: theme.primary }}
              />
            </View>
          </View>
        )}

        {activeSection === 'RECEIPT' && (
          <View style={[styles.cyberCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <View style={styles.cardHeader}>
              <View style={[styles.badgeIcon, { backgroundColor: theme.primaryGlow }]}>
                <Ionicons name="document-text" size={20} color={theme.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.cardTitle, { color: theme.textPrimary }]}>Receipt Message Config</Text>
                <Text style={[styles.cardSub, { color: theme.textSecondary }]}>Customize top header greeting and footer thank-you message.</Text>
              </View>
            </View>

            <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>HEADER GREETING</Text>
            <TextInput
              style={[styles.cyberInput, { backgroundColor: theme.bg, color: theme.textPrimary, borderColor: theme.border }]}
              value={form.receipt_header}
              onChangeText={v => setForm({ ...form, receipt_header: v })}
              placeholder="e.g. Welcome to our Store!"
              placeholderTextColor={theme.textMuted}
            />

            <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>FOOTER MESSAGE</Text>
            <TextInput
              style={[styles.cyberInput, { backgroundColor: theme.bg, color: theme.textPrimary, borderColor: theme.border }]}
              value={form.receipt_footer}
              onChangeText={v => setForm({ ...form, receipt_footer: v })}
              placeholder="e.g. Thank you for shopping with us!"
              placeholderTextColor={theme.textMuted}
            />

            <TouchableOpacity style={[styles.actionBtn, { backgroundColor: theme.primary }]} onPress={handleSaveStoreInfo} activeOpacity={0.8}>
              <Ionicons name="save" size={16} color="#ffffff" />
              <Text style={styles.actionBtnText}>SAVE RECEIPT CONFIG</Text>
            </TouchableOpacity>
          </View>
        )}

        {activeSection === 'DATA' && (
          <View style={[styles.cyberCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <View style={styles.cardHeader}>
              <View style={[styles.badgeIcon, { backgroundColor: theme.primaryGlow }]}>
                <Ionicons name="cloud-upload" size={20} color={theme.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.cardTitle, { color: theme.textPrimary }]}>Database Pipeline & Reports</Text>
                <Text style={[styles.cardSub, { color: theme.textSecondary }]}>Export transaction history and stock inventory to files.</Text>
              </View>
            </View>

            <View style={{ gap: 10, marginTop: 10 }}>
              <TouchableOpacity style={[styles.exportCard, { backgroundColor: '#10b981' }]} onPress={handleExportCSVReport} activeOpacity={0.8}>
                <Ionicons name="document-text" size={22} color="#ffffff" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.exportTitle}>EXPORT EXCEL / CSV REPORT</Text>
                  <Text style={styles.exportSub}>Itemized sales transaction logs & stock catalog sheet.</Text>
                </View>
                <Ionicons name="download" size={18} color="#ffffff" />
              </TouchableOpacity>

              <TouchableOpacity style={[styles.exportCard, { backgroundColor: '#0284c7' }]} onPress={handleExportJSON} activeOpacity={0.8}>
                <Ionicons name="archive" size={22} color="#ffffff" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.exportTitle}>EXPORT FULL JSON BACKUP</Text>
                  <Text style={styles.exportSub}>Raw database backup for full system restoration.</Text>
                </View>
                <Ionicons name="download" size={18} color="#ffffff" />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {activeSection === 'RESET' && (
          <View style={[styles.cyberCard, { backgroundColor: theme.surface, borderColor: '#ef4444' }]}>
            <View style={styles.cardHeader}>
              <View style={[styles.badgeIcon, { backgroundColor: 'rgba(239, 68, 68, 0.15)' }]}>
                <Ionicons name="alert-circle" size={20} color="#ef4444" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.cardTitle, { color: '#ef4444' }]}>Danger Zone & Database Reset</Text>
                <Text style={[styles.cardSub, { color: theme.textSecondary }]}>Irreversible wipe of all product stock and transaction records.</Text>
              </View>
            </View>

            <TouchableOpacity style={styles.dangerBtn} onPress={handleFactoryReset} activeOpacity={0.8}>
              <Ionicons name="trash" size={16} color="#ffffff" />
              <Text style={styles.actionBtnText}>EXECUTE FACTORY RESET</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  topSubBar: { borderBottomWidth: 1, paddingVertical: 10 },
  topSubScroll: { gap: 10, paddingHorizontal: 14 },
  navTab: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, height: 42, borderRadius: 10, borderWidth: 1 },
  dangerNavTab: { borderColor: 'rgba(239, 68, 68, 0.4)', backgroundColor: 'rgba(239, 68, 68, 0.08)' },
  navTabText: { fontSize: 12, fontWeight: 'bold', letterSpacing: 0.5 },
  
  cyberCard: { padding: 18, borderRadius: 14, borderWidth: 1, gap: 12 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 8 },
  badgeIcon: { width: 42, height: 42, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  cardTitle: { fontSize: 16, fontWeight: 'bold' },
  cardSub: { fontSize: 12, marginTop: 2 },
  
  fieldLabel: { fontSize: 12, fontWeight: 'bold', letterSpacing: 0.5, marginTop: 4 },
  cyberInput: { paddingHorizontal: 14, height: 46, borderRadius: 10, borderWidth: 1, fontSize: 14, fontWeight: 'bold' },
  
  actionBtn: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, paddingVertical: 14, borderRadius: 10, marginTop: 10 },
  actionBtnText: { color: '#ffffff', fontSize: 14, fontWeight: 'bold', letterSpacing: 0.5 },
  
  switchRow: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 12, borderWidth: 1 },
  switchTitle: { fontSize: 14, fontWeight: 'bold' },
  switchSub: { fontSize: 12, marginTop: 2 },
  
  exportCard: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderRadius: 12 },
  exportTitle: { color: '#ffffff', fontSize: 14, fontWeight: 'bold', letterSpacing: 0.5 },
  exportSub: { color: 'rgba(255,255,255,0.85)', fontSize: 12, marginTop: 2 },
  
  dangerBtn: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, backgroundColor: '#ef4444', paddingVertical: 14, borderRadius: 10, marginTop: 12 }
});