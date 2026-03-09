/**
 * BUILD 106: Polished Tab Layout with Custom Tab Bar
 *
 * Tabs: Home, Teams, Generate (center gold button), Practice Log
 * Hidden tabs (still routable): drills, setup, ai, coaching
 */

import React from 'react';
import { Platform } from 'react-native';
import { Tabs } from 'expo-router';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import CustomTabBar from '../../components/CustomTabBar';
import { colors } from '../../src/theme';

const FONT_ROUNDED = Platform.select({ ios: 'ui-rounded', default: undefined });

function TabsContent() {
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{
        headerShown: true,
        headerTransparent: false,
        headerStyle: { backgroundColor: colors.primaryDark },
        headerTintColor: colors.textInverse,
        headerShadowVisible: false,
        headerTitleStyle: {
          fontFamily: FONT_ROUNDED,
          fontWeight: '700',
          fontSize: 17,
          letterSpacing: -0.2,
        },
        headerLeftContainerStyle: { paddingHorizontal: 16 },
        headerRightContainerStyle: { paddingHorizontal: 16 },
        headerStatusBarHeight: insets.top,
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Home' }} />
      <Tabs.Screen name="teams" options={{ title: 'Teams' }} />
      {/* Center: Generate (prominent gold button in custom tab bar) */}
      <Tabs.Screen name="generate" options={{ title: 'Generate' }} />
      <Tabs.Screen name="history" options={{ title: 'Practice Log' }} />
      {/* Hidden tabs: still routable but not shown in tab bar */}
      <Tabs.Screen name="drills" options={{ href: null, title: 'Drill Library' }} />
      <Tabs.Screen name="setup" options={{ href: null, title: 'New Plan' }} />
      <Tabs.Screen name="ai" options={{ href: null, title: 'AI Lab' }} />
      <Tabs.Screen name="coaching" options={{ href: null, title: 'Staff' }} />
    </Tabs>
  );
}

export default function TabLayout() {
  return (
    <SafeAreaProvider>
      <TabsContent />
    </SafeAreaProvider>
  );
}
