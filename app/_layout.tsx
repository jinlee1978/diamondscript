import React, { useEffect } from 'react';
import { Stack } from 'expo-router';
import { DrillsProvider } from '../context/DrillsContext';
import { PracticeProvider } from '../context/PracticeContext';
import ErrorBoundary from '../components/ErrorBoundary';
import DeepLinkHandler from '../components/DeepLinkHandler';
import { initSentry } from '../src/config/sentry';
import { initializeAuth } from '../src/config/supabase';
import { initializeRevenueCat } from '../src/subscription/service';

// Initialize Sentry on app startup
initSentry();

export default function RootLayout() {
  // BUILD 81: Initialize RevenueCat and Supabase on app startup
  useEffect(() => {
    // Initialize RevenueCat for subscription management (anonymous ID)
    initializeRevenueCat();
    // Initialize Supabase anonymous auth for AI features
    initializeAuth();
  }, []);

  return (
    <ErrorBoundary>
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
    </ErrorBoundary>
  );
}
