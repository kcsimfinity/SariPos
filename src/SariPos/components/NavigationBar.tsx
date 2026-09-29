import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { usePOS } from '../context/POSContext';
import { getTheme } from '../theme/theme';

interface Props {
  currentTab: 'POS' | 'INVENTORY' | 'SALES' | 'UTANG' | 'SETTINGS' | 'CASH';
  onSelectTab: (tab: 'POS' | 'INVENTORY' | 'SALES' | 'UTANG' | 'SETTINGS' | 'CASH') => void;
  cartItemCount: number;
  isPortrait: boolean;
}

const NAV_ITEMS: Array<{
  key: 'POS' | 'INVENTORY' | 'SALES' | 'UTANG' | 'SETTINGS' | 'CASH';
  icon: string;
  label: string;
}> = [
  { key: 'POS',       icon: 'cart',        label: 'POS' },
  { key: 'INVENTORY', icon: 'cube',        label: 'Inventory' },
  { key: 'SALES',     icon: 'receipt',     label: 'Sales' },
  { key: 'UTANG',     icon: 'people',      label: 'Utang' },
  { key: 'CASH',      icon: 'cash',        label: 'Cash Drawer' },
  { key: 'SETTINGS',  icon: 'settings',    label: 'Settings' },
];

export const NavigationBar: React.FC<Props> = ({ currentTab, onSelectTab, cartItemCount, isPortrait }) => {
  const { settings } = usePOS();
  const theme = getTheme(settings.theme === 'dark');
  const [expanded, setExpanded] = useState(false);
  
  // For landscape, decide if we show labels
  const showLabels = !isPortrait && expanded;

  if (isPortrait) {
    // Bottom Tab Bar
    return (
      <View style={[s.bottomBar, { backgroundColor: theme.surface, borderTopColor: theme.border }]}>
        {NAV_ITEMS.map(item => {
          const active = currentTab === item.key;
          const iconColor = active ? theme.primary : theme.textMuted;
          const textColor = active ? theme.primary : theme.textMuted;

          return (
            <TouchableOpacity
              key={item.key}
              style={s.bottomNavItem}
              onPress={() => onSelectTab(item.key)}
              activeOpacity={0.7}
            >
              <View style={s.iconWrap}>
                <Ionicons name={item.icon as any} size={22} color={iconColor} />
                {item.key === 'POS' && cartItemCount > 0 && (
                  <View style={s.badge}>
                    <Text style={s.badgeTxt}>{cartItemCount > 9 ? '9+' : cartItemCount}</Text>
                  </View>
                )}
              </View>
              <Text style={[s.bottomNavLabel, { color: textColor }]} numberOfLines={1}>{item.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    );
  }

  // Sidebar for Landscape
  return (
    <View
      style={[
        s.sidebar,
        {
          width: showLabels ? 164 : 56,
          backgroundColor: theme.surface,
          borderRightColor: theme.border,
        },
      ]}
    >
      <TouchableOpacity
        style={[s.brand, !showLabels && s.brandCenter]}
        onPress={() => setExpanded(e => !e)}
        activeOpacity={0.7}
      >
        <Ionicons name="menu" size={20} color={theme.textPrimary} />
        {showLabels && (
          <Text style={[s.brandText, { color: theme.textPrimary }]} numberOfLines={1}>
            SariPOS
          </Text>
        )}
      </TouchableOpacity>

      <View style={s.menu}>
        {NAV_ITEMS.map(item => {
          const active = currentTab === item.key;

          return (
            <TouchableOpacity
              key={item.key}
              style={[
                s.navItem,
                { backgroundColor: active ? theme.primaryGlow : 'transparent' },
                !showLabels && s.navCenter,
              ]}
              onPress={() => onSelectTab(item.key)}
              activeOpacity={0.75}
            >
              <View style={s.iconWrap}>
                <Ionicons
                  name={item.icon as any}
                  size={20}
                  color={active ? theme.primary : theme.textSecondary}
                />
                {item.key === 'POS' && cartItemCount > 0 && (
                  <View style={s.badge}>
                    <Text style={s.badgeTxt}>{cartItemCount > 9 ? '9+' : cartItemCount}</Text>
                  </View>
                )}
              </View>
              {showLabels && (
                <Text
                  style={[s.navLabel, { color: active ? theme.primary : theme.textSecondary }]}
                  numberOfLines={1}
                >
                  {item.label}
                </Text>
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

const s = StyleSheet.create({
  // Bottom Bar Styles
  bottomBar: {
    flexDirection: 'row',
    height: 52,
    borderTopWidth: 1,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  bottomNavItem: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bottomNavLabel: {
    fontSize: 9,
    fontWeight: '700',
    marginTop: 2,
  },
  
  // Sidebar Styles
  sidebar: {
    height: '100%',
    paddingVertical: 8,
    borderRightWidth: 1,
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 36,
    marginBottom: 4,
    paddingHorizontal: 12,
    gap: 12,
  },
  brandCenter: {
    justifyContent: 'center',
    paddingHorizontal: 0,
  },
  brandText: {
    fontSize: 14,
    fontWeight: '800',
    flexShrink: 1,
  },
  menu: {
    flex: 1,
    gap: 2,
    paddingHorizontal: 6,
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 40,
    borderRadius: 8,
    paddingHorizontal: 8,
    gap: 12,
  },
  navCenter: {
    justifyContent: 'center',
    paddingHorizontal: 0,
  },
  iconWrap: {
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  navLabel: {
    fontSize: 13,
    fontWeight: '700',
    flexShrink: 1,
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -6,
    backgroundColor: '#ef4444',
    borderRadius: 10,
    minWidth: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
    borderWidth: 1.5,
    borderColor: '#fff',
  },
  badgeTxt: {
    color: '#fff',
    fontSize: 8,
    fontWeight: '800',
  },
});
