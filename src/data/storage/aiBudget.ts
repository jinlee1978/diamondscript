/**
 * BUILD 101: AI Daily Budget
 *
 * Replaces the 60-second cooldown with a daily generation limit.
 * Pro users: 10 AI generations per day
 * Free users: 0 (AI is Pro-only, they use engine generations from generationTracker)
 *
 * Budget resets at midnight local time each day.
 * Storage key: @diamondscript/aiBudget
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const AI_BUDGET_KEY = '@diamondscript/aiBudget';

/** Pro users get 10 AI generations per day */
export const PRO_DAILY_AI_LIMIT = 10;

interface AIBudgetData {
  /** Date string YYYY-MM-DD for the current budget period */
  date: string;
  /** Number of AI generations used today */
  used: number;
}

function todayStr(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

/** Load today's AI budget usage. Resets automatically if it's a new day. */
export async function loadAIBudget(): Promise<AIBudgetData> {
  try {
    const raw = await AsyncStorage.getItem(AI_BUDGET_KEY);
    if (raw) {
      const data = JSON.parse(raw) as AIBudgetData;
      if (data.date === todayStr()) {
        return data;
      }
    }
  } catch { /* fall through */ }
  // New day or no data — reset
  return { date: todayStr(), used: 0 };
}

/** Increment today's AI usage by 1. Returns updated budget. */
export async function incrementAIUsage(): Promise<AIBudgetData> {
  const budget = await loadAIBudget();
  budget.used += 1;
  try {
    await AsyncStorage.setItem(AI_BUDGET_KEY, JSON.stringify(budget));
  } catch { /* non-critical */ }
  return budget;
}

/** Check remaining AI generations for today. */
export async function getRemainingAIGenerations(): Promise<number> {
  const budget = await loadAIBudget();
  return Math.max(0, PRO_DAILY_AI_LIMIT - budget.used);
}

/** Check if user can generate an AI plan today. */
export async function canGenerateAI(): Promise<boolean> {
  const remaining = await getRemainingAIGenerations();
  return remaining > 0;
}
