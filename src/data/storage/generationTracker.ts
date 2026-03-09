/**
 * BUILD 101: Generation Tracker
 *
 * Tracks how many practice plans a free user has generated.
 * Free users get 3 generations total. After that, paywall.
 * Pro users have unlimited generations.
 *
 * Storage key: @diamondscript/generationCount
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const GENERATION_COUNT_KEY = '@diamondscript/generationCount';

/** Maximum free plan generations before paywall */
export const FREE_GENERATION_LIMIT = 3;

/**
 * Get the current generation count
 */
export async function getGenerationCount(): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem(GENERATION_COUNT_KEY);
    if (raw) {
      const count = parseInt(raw, 10);
      return isNaN(count) ? 0 : count;
    }
  } catch {
    // Fall through to return 0
  }
  return 0;
}

/**
 * Increment the generation count by 1.
 * Returns the new count.
 */
export async function incrementGenerationCount(): Promise<number> {
  const current = await getGenerationCount();
  const next = current + 1;
  try {
    await AsyncStorage.setItem(GENERATION_COUNT_KEY, String(next));
  } catch {
    // Non-critical — worst case, user gets an extra free generation
  }
  return next;
}

/**
 * Check if a free user can generate more plans.
 */
export async function canFreeUserGenerate(): Promise<boolean> {
  const count = await getGenerationCount();
  return count < FREE_GENERATION_LIMIT;
}

/**
 * Get remaining free generations.
 */
export async function getRemainingFreeGenerations(): Promise<number> {
  const count = await getGenerationCount();
  return Math.max(0, FREE_GENERATION_LIMIT - count);
}
