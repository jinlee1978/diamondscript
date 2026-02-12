import { createClient } from '@supabase/supabase-js';

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

/**
 * Initialize anonymous authentication for AI feature
 * This ensures Edge Functions receive a valid JWT token
 * Called automatically when app starts
 */
export async function initializeAuth(): Promise<void> {
  try {
    // Check if user already has a session
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      // Sign in anonymously to get a valid JWT token
      const { error } = await supabase.auth.signInAnonymously();

      if (error) {
        if (__DEV__) {
          console.error('Supabase anonymous auth failed:', error.message);
        }
        throw error;
      }

      if (__DEV__) {
        console.log('✅ Supabase anonymous auth initialized');
      }
    } else {
      if (__DEV__) {
        console.log('✅ Supabase session already exists');
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
