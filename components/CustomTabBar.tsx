/**
 * BUILD 106: Custom Tab Bar
 *
 * Custom bottom navigation with:
 * - Prominent center Generate button (gold, elevated)
 * - Clean icon + label layout for other tabs
 * - Subtle active indicator
 */

import React from 'react';
import {
  View, TouchableOpacity, Text, StyleSheet, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, typography, shadows } from '../src/theme';

interface TabConfig {
  name: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconActive: keyof typeof Ionicons.glyphMap;
}

const TABS: TabConfig[] = [
  { name: 'index', label: 'Home', icon: 'home-outline', iconActive: 'home' },
  { name: 'teams', label: 'Teams', icon: 'shield-outline', iconActive: 'shield' },
  { name: 'generate', label: 'Generate', icon: 'baseball-outline', iconActive: 'baseball' },
  { name: 'history', label: 'Log', icon: 'journal-outline', iconActive: 'journal' },
];

interface Props {
  state: any;
  descriptors: any;
  navigation: any;
}

export default function CustomTabBar({ state, descriptors, navigation }: Props) {
  const insets = useSafeAreaInsets();

  // Find which visible tabs correspond to state routes
  const visibleRoutes = state.routes.filter((route: any) => {
    const { options } = descriptors[route.key];
    // Skip hidden tabs (href: null)
    return options.href !== null;
  });

  return (
    <View style={[styles.container, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      {/* Curved top edge */}
      <View style={styles.topEdge} />

      <View style={styles.tabRow}>
        {visibleRoutes.map((route: any, index: number) => {
          const { options } = descriptors[route.key];
          const isFocused = state.index === state.routes.indexOf(route);
          const tabConfig = TABS.find(t => t.name === route.name);
          const isGenerate = route.name === 'generate';

          if (!tabConfig) return null;

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });
            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };

          const onLongPress = () => {
            navigation.emit({ type: 'tabLongPress', target: route.key });
          };

          if (isGenerate) {
            return (
              <TouchableOpacity
                key={route.key}
                accessibilityRole="button"
                accessibilityState={isFocused ? { selected: true } : {}}
                accessibilityLabel={options.tabBarAccessibilityLabel}
                onPress={onPress}
                onLongPress={onLongPress}
                style={styles.generateWrapper}
                activeOpacity={0.8}
              >
                <View style={[styles.generateButton, isFocused && styles.generateButtonActive]}>
                  <Ionicons name="baseball" size={26} color="#FFFFFF" />
                </View>
                <Text style={[styles.generateLabel, isFocused && styles.labelActive]}>
                  {tabConfig.label}
                </Text>
              </TouchableOpacity>
            );
          }

          return (
            <TouchableOpacity
              key={route.key}
              accessibilityRole="button"
              accessibilityState={isFocused ? { selected: true } : {}}
              accessibilityLabel={options.tabBarAccessibilityLabel}
              onPress={onPress}
              onLongPress={onLongPress}
              style={styles.tab}
              activeOpacity={0.7}
            >
              {isFocused && <View style={styles.activeIndicator} />}
              <Ionicons
                name={isFocused ? tabConfig.iconActive : tabConfig.icon}
                size={22}
                color={isFocused ? colors.primary : colors.tabInactive}
              />
              <Text style={[styles.label, isFocused && styles.labelActive]}>
                {tabConfig.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.white,
    borderTopWidth: 0,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -3 },
        shadowOpacity: 0.06,
        shadowRadius: 6,
      },
      android: { elevation: 8 },
    }),
  },
  topEdge: {
    position: 'absolute',
    top: -1,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(0,0,0,0.04)',
  },
  tabRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-around',
    paddingTop: 6,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 8,
    paddingBottom: 4,
    position: 'relative',
  },
  activeIndicator: {
    position: 'absolute',
    top: 0,
    width: 20,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: colors.primary,
  },
  label: {
    ...typography.tabLabel,
    color: colors.tabInactive,
    marginTop: 3,
  },
  labelActive: {
    color: colors.primary,
    fontWeight: '700',
  },

  // Generate button
  generateWrapper: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 4,
  },
  generateButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -18,
    ...Platform.select({
      ios: {
        shadowColor: colors.gold,
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.4,
        shadowRadius: 6,
      },
      android: { elevation: 6 },
    }),
  },
  generateButtonActive: {
    backgroundColor: colors.primary,
    ...Platform.select({
      ios: {
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.4,
        shadowRadius: 6,
      },
    }),
  },
  generateLabel: {
    ...typography.tabLabel,
    color: colors.textMuted,
    marginTop: 4,
  },
});
