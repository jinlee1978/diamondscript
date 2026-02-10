/**
 * Deep Link Handler Component
 *
 * Listens for diamondscript://view?plan=<encoded> deep links
 * and hydrates the practice session into the app state.
 */

import { useEffect } from 'react';
import { Linking, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { usePractice } from '../context/PracticeContext';
import { parseShareLink } from '../src/utils/practiceSerializer';

export default function DeepLinkHandler() {
  const router = useRouter();
  const { restoreSession } = usePractice();

  useEffect(() => {
    // Handle initial URL if app was opened from a deep link
    const handleInitialURL = async () => {
      const url = await Linking.getInitialURL();
      if (url) {
        handleDeepLink(url);
      }
    };

    // Handle deep links while app is already running
    const subscription = Linking.addEventListener('url', (event) => {
      handleDeepLink(event.url);
    });

    handleInitialURL();

    return () => {
      subscription.remove();
    };
  }, []);

  const handleDeepLink = (url: string) => {
    if (__DEV__) {
      console.log('📎 Deep link received:', url);
    }

    // Only handle diamondscript://view links
    if (!url.startsWith('diamondscript://view')) {
      return;
    }

    try {
      // Parse the share link and extract the practice session
      const session = parseShareLink(url);

      if (!session) {
        Alert.alert(
          'Invalid Link',
          'This practice link is invalid or corrupted. Please ask the sender to share again.',
          [{ text: 'OK' }]
        );
        return;
      }

      // Restore the session into app state
      restoreSession(session);

      // Navigate to the practice screen
      router.push('/practice');

      if (__DEV__) {
        console.log('✅ Practice session loaded from deep link');
      }
    } catch (error) {
      if (__DEV__) {
        console.error('Failed to handle deep link:', error);
      }

      Alert.alert(
        'Error Opening Link',
        'Could not open this practice link. Please try again.',
        [{ text: 'OK' }]
      );
    }
  };

  // This component doesn't render anything
  return null;
}
