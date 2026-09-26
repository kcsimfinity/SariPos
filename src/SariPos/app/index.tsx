import React, { useState } from 'react';
import { View, StyleSheet, StatusBar } from 'react-native';
import { POSProvider, usePOS } from '../context/POSContext';
import { NavigationBar } from '../components/NavigationBar';
import { POSScreen } from '../screens/POSScreen';
import { InventoryScreen } from '../screens/InventoryScreen';
import { SalesScreen } from '../screens/SalesScreen';
import { UtangScreen } from '../screens/UtangScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { getTheme } from '../theme/theme';

const MainLayout: React.FC = () => {
  const { cart, settings } = usePOS();
  const theme = getTheme(settings.theme === 'dark');

  const [currentTab, setCurrentTab] = useState<'POS' | 'INVENTORY' | 'SALES' | 'UTANG' | 'SETTINGS'>('POS');

  const totalCartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      {/* Absolute Full Screen Kiosk Mode */}
      <StatusBar hidden={true} />
      
      <View style={styles.contentRow}>
        {/* Navigation Sidebar */}
        <NavigationBar
          currentTab={currentTab}
          onSelectTab={setCurrentTab}
          cartItemCount={totalCartCount}
        />

        {/* Dynamic Screen View - Uses display toggling to prevent state loss on tab switch */}
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
          
          <View style={[styles.screenWrapper, currentTab === 'SETTINGS' ? styles.active : styles.hidden]}>
            <SettingsScreen />
          </View>
        </View>
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
  contentRow: {
    flex: 1,
    flexDirection: 'row',
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
  }
});