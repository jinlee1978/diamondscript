import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { Stack } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DrillsProvider } from '../context/DrillsContext';
import { PracticeProvider } from '../context/PracticeContext';
import PaywallModal from '../components/PaywallModal';
import ErrorBoundary from '../components/ErrorBoundary';
import DeepLinkHandler from '../components/DeepLinkHandler';
import { initSentry } from '../src/config/sentry';
import { initializeAuth } from '../src/config/supabase';
import { initializeRevenueCat } from '../src/subscription/service';
import { usePractice } from '../context/PracticeContext';

function RootLayoutContent() {
  // BUILD 107: Single PaywallModal at root to prevent gesture responder conflicts
  // Fixes iOS freeze bug where multiple Modal instances on different screens
  // could leave phantom touch-blocking layers when navigating during animation
  const { showPaywall, paywallTrigger, closePaywall } = usePractice();

  // Double-init guard: prevents SDK re-initialization on React strict mode remounts
  const didInit = useRef(false);

  // BUILD 91: All native SDK initialization deferred to useEffect
  // Module-scope calls crash Hermes GC with New Architecture (TurboModule not ready)
  // BUILD 93: Entire init chain wrapped in 8-second ceiling to prevent cold-start freeze.
  //           Supabase auth has its own internal 5s timeout as first line of defense.
  //           If RevenueCat also stalls, the outer 8s timeout catches it.
  useEffect(() => {
    if (didInit.current) return;
    didInit.current = true;

    // Initialize Sentry first (non-blocking)
    initSentry();

    const INIT_CHAIN_TIMEOUT_MS = 8000;
    let timer: NodeJS.Timeout | undefined;

    Promise.race([
      (async () => {
        // Step 1: Initialize Supabase anonymous auth (creates/restores user ID)
        await initializeAuth();

        // Step 2: Retrieve the persisted Supabase user ID
        const supabaseUserId = await AsyncStorage.getItem('@diamondscript/supabase_user_id');

        // Step 3: Initialize RevenueCat with Supabase identity linking
        await initializeRevenueCat(supabaseUserId ?? undefined);
      })(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error('Init chain timed out')), INIT_CHAIN_TIMEOUT_MS);
      }),
    ])
      .catch((error) => {
        // Non-fatal: app continues with anonymous RevenueCat ID + free tier
        // PracticeContext verifyTier() will retry RevenueCat when ready
        console.error('[RootLayout] Init chain timed out or failed:', error);
      })
      .finally(() => {
        if (timer) clearTimeout(timer);
      });
  }, []);

  return (
    <>
      <DeepLinkHandler />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: '#1B3D2F' },
          headerTintColor: '#FFFFFF',
          headerTransparent: false, // BUILD 93: Disable iOS 26 Liquid Glass translucency
          headerShadowVisible: false,
          headerBackTitle: 'Back',
          headerTitleStyle: {
            fontWeight: '600',
            fontSize: 17,
            fontFamily: Platform.select({ ios: 'ui-rounded', default: undefined }),
          },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="practice" options={{ title: 'Practice' }} />
        <Stack.Screen name="upgrade" options={{ title: 'Go Pro' }} />
        {/* BUILD 101: Season Mode */}
        <Stack.Screen name="season" options={{ title: 'Season' }} />
      </Stack>

      {/* BUILD 107: Single PaywallModal at root level */}
      <PaywallModal
        visible={showPaywall}
        onClose={closePaywall}
        onSuccess={closePaywall}
        trigger={paywallTrigger ?? undefined}
      />
    </>
  );
}

export default function RootLayout() {
  return (
    <ErrorBoundary>
      <DrillsProvider>
        <PracticeProvider>
          <RootLayoutContent />
        </PracticeProvider>
      </DrillsProvider>
    </ErrorBoundary>
  );
}
