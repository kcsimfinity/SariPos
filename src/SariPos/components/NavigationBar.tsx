import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { usePOS } from '../context/POSContext';
import { getTheme } from '../theme/theme';

interface Props {
  currentTab: 'POS' | 'INVENTORY' | 'SALES' | 'UTANG' | 'SETTINGS';
  onSelectTab: (tab: 'POS' | 'INVENTORY' | 'SALES' | 'UTANG' | 'SETTINGS') => void;
  cartItemCount: number;
}

export const NavigationBar: React.FC<Props> = ({ currentTab, onSelectTab, cartItemCount }) => {
  const { settings } = usePOS();
  const theme = getTheme(settings.theme === 'dark');
  const [isExpanded, setIsExpanded] = useState(false);

  const toggleExpand = () => setIsExpanded(!isExpanded);

  return (
    <View
      style={[
        styles.sidebar,
        {
          width: isExpanded ? 180 : 70,
          backgroundColor: theme.surface,
          borderRightColor: theme.border,
        },
      ]}
    >
      {/* Brand Header */}
      <TouchableOpacity
        style={[styles.brandHeader, !isExpanded && { justifyContent: 'center' }]}
        onPress={toggleExpand}
        activeOpacity={0.7}
      >
        <View style={[styles.logoBadge, { backgroundColor: theme.primaryGlow }]}>
          <Ionicons name="home" size={22} color={theme.accent} />
        </View>

        {isExpanded && (
          <View style={styles.brandTitleContainer}>
            <Text style={[styles.brandText, { color: theme.textPrimary }]} numberOfLines={1}>
              {settings.store_name || 'SariPos'}
            </Text>
            <Text style={[styles.brandSub, { color: theme.textSecondary }]}>System</Text>
          </View>
        )}
      </TouchableOpacity>

      {/* Menu Items */}
      <View style={styles.menuContainer}>
        {/* POS Tab */}
        <TouchableOpacity
          style={[
            styles.navItem,
            currentTab === 'POS' && { backgroundColor: theme.primary },
            !isExpanded && { justifyContent: 'center', paddingHorizontal: 0 }
          ]}
          onPress={() => onSelectTab('POS')}
        >
          <View style={styles.iconBox}>
            <Ionicons name="cart-outline" size={24} color={currentTab === 'POS' ? '#ffffff' : theme.textSecondary} />
            {cartItemCount > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{cartItemCount}</Text>
              </View>
            )}
          </View>
          {isExpanded && <Text style={[styles.navText, { color: currentTab === 'POS' ? '#ffffff' : theme.textSecondary }]}>POS</Text>}
        </TouchableOpacity>

        {/* INVENTORY Tab */}
        <TouchableOpacity
          style={[
            styles.navItem,
            currentTab === 'INVENTORY' && { backgroundColor: theme.primary },
            !isExpanded && { justifyContent: 'center', paddingHorizontal: 0 }
          ]}
          onPress={() => onSelectTab('INVENTORY')}
        >
          <View style={styles.iconBox}>
            <Ionicons name="cube-outline" size={24} color={currentTab === 'INVENTORY' ? '#ffffff' : theme.textSecondary} />
          </View>
          {isExpanded && <Text style={[styles.navText, { color: currentTab === 'INVENTORY' ? '#ffffff' : theme.textSecondary }]}>INVENTORY</Text>}
        </TouchableOpacity>

        {/* SALES Tab */}
        <TouchableOpacity
          style={[
            styles.navItem,
            currentTab === 'SALES' && { backgroundColor: theme.primary },
            !isExpanded && { justifyContent: 'center', paddingHorizontal: 0 }
          ]}
          onPress={() => onSelectTab('SALES')}
        >
          <View style={styles.iconBox}>
            <Ionicons name="stats-chart-outline" size={24} color={currentTab === 'SALES' ? '#ffffff' : theme.textSecondary} />
          </View>
          {isExpanded && <Text style={[styles.navText, { color: currentTab === 'SALES' ? '#ffffff' : theme.textSecondary }]}>SALES</Text>}
        </TouchableOpacity>

        {/* UTANG Tab */}
        <TouchableOpacity
          style={[
            styles.navItem,
            currentTab === 'UTANG' && { backgroundColor: theme.danger },
            !isExpanded && { justifyContent: 'center', paddingHorizontal: 0 }
          ]}
          onPress={() => onSelectTab('UTANG')}
        >
          <View style={styles.iconBox}>
            <Ionicons name="book-outline" size={24} color={currentTab === 'UTANG' ? '#ffffff' : theme.textSecondary} />
          </View>
          {isExpanded && <Text style={[styles.navText, { color: currentTab === 'UTANG' ? '#ffffff' : theme.textSecondary }]}>UTANG</Text>}
        </TouchableOpacity>

        {/* SETTINGS Tab */}
        <TouchableOpacity
          style={[
            styles.navItem,
            currentTab === 'SETTINGS' && { backgroundColor: theme.primary },
            !isExpanded && { justifyContent: 'center', paddingHorizontal: 0 }
          ]}
          onPress={() => onSelectTab('SETTINGS')}
        >
          <View style={styles.iconBox}>
            <Ionicons name="settings-outline" size={24} color={currentTab === 'SETTINGS' ? '#ffffff' : theme.textSecondary} />
          </View>
          {isExpanded && <Text style={[styles.navText, { color: currentTab === 'SETTINGS' ? '#ffffff' : theme.textSecondary }]}>SETTINGS</Text>}
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  sidebar: {
    height: '100%',
    paddingVertical: 14,
    paddingHorizontal: 8,
    borderRightWidth: 1,
  },
  brandHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 50,
    marginBottom: 20,
    paddingHorizontal: 4,
  },
  logoBadge: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  brandTitleContainer: {
    marginLeft: 12,
    flex: 1,
  },
  brandText: {
    fontSize: 15,
    fontWeight: 'bold',
  },
  brandSub: {
    fontSize: 10,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  menuContainer: {
    flex: 1,
    gap: 8,
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 52,
    borderRadius: 12,
    paddingHorizontal: 10,
  },
  iconBox: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  navText: {
    fontSize: 13,
    fontWeight: 'bold',
    letterSpacing: 0.5,
    marginLeft: 8,
  },
  badge: {
    position: 'absolute',
    top: 2,
    right: 2,
    backgroundColor: '#ef4444',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: 'bold',
  },
});