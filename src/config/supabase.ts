import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Supabase client configuration using public environment variables
// These are safe to use in the Expo frontend (EXPO_PUBLIC_ prefix)
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

// BUILD 91: Graceful fallback instead of module-scope throw
// A throw during module evaluation crashes the JS thread before ErrorBoundary exists.
// If env vars are missing, supabase will be null and AI features degrade gracefully.
if (!supabaseUrl || !supabaseAnonKey) {
  console.error('[Supabase] Missing environment variables. AI features will be unavailable.');
}

export const supabase = (supabaseUrl && supabaseAnonKey)
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null as any; // null client — initializeAuth() will fail safely via try/catch

// BUILD 73: AsyncStorage key for persisting user identity (migrated from SecureStore)
const USER_ID_KEY = '@diamondscript/supabase_user_id';

// BUILD 93: 5-second ceiling on entire auth flow to prevent cold-start freeze
const AUTH_TIMEOUT_MS = 5000;

/**
 * BUILD 65: CRITICAL FIX - Enhanced authentication with forced session refresh
 * BUILD 73: Migrated from SecureStore to AsyncStorage for build compatibility
 * BUILD 93: Wrapped in 5-second timeout — on slow/no network, app proceeds
 *           with degraded AI (shows error when user tries to use it)
 */
export async function initializeAuth(): Promise<void> {
  let timer: NodeJS.Timeout | undefined;
  try {
    await Promise.race([
      performAuth(),
      new Promise<void>((_, reject) => {
        timer = setTimeout(() => reject(new Error('Auth timed out')), AUTH_TIMEOUT_MS);
      }),
    ]);
  } catch (error) {
    if (__DEV__) {
      console.error('Failed to initialize Supabase auth:', error);
    }
    // Don't throw - allow app to continue even if auth fails or times out
    // AI feature will show error when user tries to use it
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/** Inner auth logic — called by initializeAuth with a timeout wrapper */
async function performAuth(): Promise<void> {
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
}
