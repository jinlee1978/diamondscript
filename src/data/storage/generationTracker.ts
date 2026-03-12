/**
 * BUILD 101: Generation Tracker
 *
 * Tracks how many practice plans a free user has generated.
 * Young groups (Intro, T-Ball, Coach Pitch) get unlimited free generations.
 * All other age groups get 5 free generations, then paywall.
 * Pro users always have unlimited generations.
 *
 * Storage key: @diamondscript/generationCount
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const GENERATION_COUNT_KEY = '@diamondscript/generationCount';

/** Default free generation limit for non-young age groups */
export const FREE_GENERATION_LIMIT = 5;

/** Age groups that get unlimited free engine generations (everything except AI) */
const UNLIMITED_AGE_GROUPS = new Set(['INTRO', 'T_BALL', 'COACH_PITCH']);

/**
 * Check if an age group has unlimited free generations.
 */
export function isUnlimitedAgeGroup(ageGroup?: string): boolean {
  return !!ageGroup && UNLIMITED_AGE_GROUPS.has(ageGroup);
}

/**
 * Get the generation limit for a given age group.
 * Returns Infinity for young groups, FREE_GENERATION_LIMIT for others.
 */
export function getGenerationLimit(ageGroup?: string): number {
  return isUnlimitedAgeGroup(ageGroup) ? Infinity : FREE_GENERATION_LIMIT;
}

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
 * Check if a free user can generate more plans for the given age group.
 */
export async function canFreeUserGenerate(ageGroup?: string): Promise<boolean> {
  if (isUnlimitedAgeGroup(ageGroup)) return true;
  const count = await getGenerationCount();
  return count < FREE_GENERATION_LIMIT;
}

/**
 * Get remaining free generations for the given age group.
 * Returns Infinity for young groups.
 */
export async function getRemainingFreeGenerations(ageGroup?: string): Promise<number> {
  if (isUnlimitedAgeGroup(ageGroup)) return Infinity;
  const count = await getGenerationCount();
  return Math.max(0, FREE_GENERATION_LIMIT - count);
}
