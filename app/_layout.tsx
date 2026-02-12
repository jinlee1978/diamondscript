import React, { useEffect } from 'react';
import { Stack } from 'expo-router';
import { SubscriptionProvider } from '../context/SubscriptionContext';
import { DrillsProvider } from '../context/DrillsContext';
import { PracticeProvider } from '../context/PracticeContext';
import ErrorBoundary from '../components/ErrorBoundary';
import DeepLinkHandler from '../components/DeepLinkHandler';
import { initSentry } from '../src/config/sentry';
import { initializeAuth } from '../src/config/supabase';

// Initialize Sentry on app startup
initSentry();

export default function RootLayout() {
  // Initialize Supabase anonymous auth for AI features
  useEffect(() => {
    initializeAuth();
  }, []);

  return (
    <ErrorBoundary>
      <SubscriptionProvider>
        <DrillsProvider>
          <PracticeProvider>
            <DeepLinkHandler />
            <Stack
              screenOptions={{
                headerStyle: { backgroundColor: '#1B4332' },
                headerTintColor: '#FFFFFF',
                headerTitleStyle: { fontWeight: '600', fontSize: 17 },
              }}
            >
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen name="practice" options={{ title: 'Practice' }} />
              <Stack.Screen name="upgrade" options={{ title: 'Go Pro' }} />
            </Stack>
          </PracticeProvider>
        </DrillsProvider>
      </SubscriptionProvider>
    </ErrorBoundary>
  );
}
