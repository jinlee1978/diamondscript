import React from 'react';
import { Stack } from 'expo-router';
import { PracticeProvider } from '../context/PracticeContext';
import ErrorBoundary from '../components/ErrorBoundary';
import { initSentry } from '../src/config/sentry';

// Initialize Sentry on app startup
initSentry();

export default function RootLayout() {
  return (
    <ErrorBoundary>
      <PracticeProvider>
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: '#1B4332' },
            headerTintColor: '#FFFFFF',
            headerTitleStyle: { fontWeight: '600', fontSize: 17 },
          }}
        >
          <Stack.Screen name="index" options={{ title: 'DiamondScript' }} />
          <Stack.Screen name="setup" options={{ title: 'Setup Practice' }} />
          <Stack.Screen name="practice" options={{ title: 'Practice' }} />
          <Stack.Screen name="starred" options={{ title: 'My Drills' }} />
          <Stack.Screen name="history" options={{ title: 'Practice History' }} />
          <Stack.Screen name="upgrade" options={{ title: 'Go Pro' }} />
        </Stack>
      </PracticeProvider>
    </ErrorBoundary>
  );
}
