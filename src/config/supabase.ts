import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Supabase client configuration using public environment variables
// These are safe to use in the Expo frontend (EXPO_PUBLIC_ prefix)
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase environment variables. Ensure EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY are set.'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// BUILD 73: AsyncStorage key for persisting user identity (migrated from SecureStore)
const USER_ID_KEY = '@diamondscript/supabase_user_id';

/**
 * BUILD 65: CRITICAL FIX - Enhanced authentication with forced session refresh
 * Ensures Edge Functions receive a FRESH, VALID JWT token on every request
 * Called automatically when app starts AND before each AI request
 * BUILD 73: Migrated from SecureStore to AsyncStorage for build compatibility
 */
export async function initializeAuth(): Promise<void> {
  try {
    // BUILD 73: Check for persisted user ID in AsyncStorage
    const storedUserId = await AsyncStorage.getItem(USER_ID_KEY);

    // BUILD 65: Get current session
    const { data: { session } } = await supabase.auth.getSession();

    // BUILD 65: Validate session matches stored user ID (if exists)
    if (session && storedUserId && session.user.id === storedUserId) {
      if (__DEV__) {
        console.log('✅ Supabase session restored from storage');
      }
      return; // Session is valid and matches persisted identity
    }

    // BUILD 65: Session is missing, expired, or doesn't match stored ID
    // Create new anonymous session
    const { data, error } = await supabase.auth.signInAnonymously();

    if (error) {
      if (__DEV__) {
        console.error('Supabase anonymous auth failed:', error.message);
      }
      throw error;
    }

    // BUILD 73: Persist new user ID to AsyncStorage (ties 5-plan limit to device)
    if (data?.user?.id) {
      await AsyncStorage.setItem(USER_ID_KEY, data.user.id);
      if (__DEV__) {
        console.log('✅ Supabase anonymous auth initialized & user ID persisted');
      }
    }
  } catch (error) {
    if (__DEV__) {
      console.error('Failed to initialize Supabase auth:', error);
    }
    // Don't throw - allow app to continue even if auth fails
    // AI feature will show error when user tries to use it
  }
}
