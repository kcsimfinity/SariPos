import React, { useState } from 'react';
import { StatusBar, StyleSheet, useWindowDimensions, View } from 'react-native';
import { NavigationBar } from '../components/NavigationBar';
import { POSProvider, usePOS } from '../context/POSContext';
import { CashDrawerScreen } from '../screens/CashDrawerScreen';
import { InventoryScreen } from '../screens/InventoryScreen';
import { POSScreen } from '../screens/POSScreen';
import { SalesScreen } from '../screens/SalesScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { UtangScreen } from '../screens/UtangScreen';
import { getTheme } from '../theme/theme';

const MainLayout: React.FC = () => {
  const { cart, settings } = usePOS();
  const theme = getTheme(settings.theme === 'dark');
  const { width, height } = useWindowDimensions();
  const isPortrait = height > width;

  const [currentTab, setCurrentTab] = useState<'POS' | 'INVENTORY' | 'SALES' | 'UTANG' | 'SETTINGS' | 'CASH'>('POS');

  const totalCartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <StatusBar hidden={true} />
      
      <View style={[styles.contentWrapper, isPortrait ? styles.contentPortrait : styles.contentLandscape]}>
        {/* Navigation - Sidebar in Landscape, Bottom Bar in Portrait */}
        {!isPortrait && (
          <NavigationBar
            currentTab={currentTab}
            onSelectTab={setCurrentTab}
            cartItemCount={totalCartCount}
            isPortrait={false}
          />
        )}

        {/* Dynamic Screen View */}
        <View style={styles.screenContainer}>
          <View style={[styles.screenWrapper, currentTab === 'POS' ? styles.active : styles.hidden]}>
            <POSScreen />
          </View>
          
          <View style={[styles.screenWrapper, currentTab === 'INVENTORY' ? styles.active : styles.hidden]}>
            <InventoryScreen />
          </View>
          
          <View style={[styles.screenWrapper, currentTab === 'SALES' ? styles.active : styles.hidden]}>
            <SalesScreen />
          </View>
          
          <View style={[styles.screenWrapper, currentTab === 'UTANG' ? styles.active : styles.hidden]}>
            <UtangScreen />
          </View>
          
          <View style={[styles.screenWrapper, currentTab === 'CASH' ? styles.active : styles.hidden]}>
            <CashDrawerScreen />
          </View>
          
          <View style={[styles.screenWrapper, currentTab === 'SETTINGS' ? styles.active : styles.hidden]}>
            <SettingsScreen />
          </View>
        </View>

        {isPortrait && (
          <NavigationBar
            currentTab={currentTab}
            onSelectTab={setCurrentTab}
            cartItemCount={totalCartCount}
            isPortrait={true}
          />
        )}
      </View>
    </View>
  );
};

export default function SariPosApp() {
  return (
    <POSProvider>
      <MainLayout />
    </POSProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentWrapper: {
    flex: 1,
  },
  contentLandscape: {
    flexDirection: 'row',
  },
  contentPortrait: {
    flexDirection: 'column',
  },
  screenContainer: {
    flex: 1,
  },
  screenWrapper: {
    flex: 1,
  },
  active: {
    display: 'flex',
  },
  hidden: {
    display: 'none',
  },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 56,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    zIndex: 10,
  },
  topHeaderTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  settingsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  settingsBtnText: {
    fontSize: 14,
    fontWeight: '700',
  }
});