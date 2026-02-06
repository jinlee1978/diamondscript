import { DrillCategory } from '../../data/types';

/**
 * Category balance bonus for the Drill Match Score.
 *
 * Provides a soft diversity nudge during greedy selection:
 *   - Category not yet in selection → 1.0  (strong pull)
 *   - Category appears once         → 0.5  (mild pull)
 *   - Category appears twice+       → 0.0  (no pull)
 *
 * This bonus is recomputed after each drill is selected, so early picks
 * naturally pull the next selection toward underrepresented categories.
 */
export function applyCategoryBalanceBonus(
  category: DrillCategory,
  categoryCountsInSelection: Record<DrillCategory, number>,
): number {
  const count = categoryCountsInSelection[category] ?? 0;
  if (count === 0) return 1.0;
  if (count === 1) return 0.5;
  return 0.0;
}

/** Creates a zeroed category count map. */
export function createEmptyCategoryCounts(): Record<DrillCategory, number> {
  return { hitting: 0, fielding: 0, pitching: 0, baserunning: 0 };
}
