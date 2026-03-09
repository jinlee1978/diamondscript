import { DrillCategory } from '../../data/types';
import { ALPHA, BETA, GAMMA, MAX_COMPLEXITY_DISTANCE, INTENSITY_RANGE } from '../constants/weights';
import { applyCategoryBalanceBonus } from './categoryBalance';

/**
 * Drill Match Score (DMS).
 *
 * DMS = ALPHA × ProximityScore + BETA × IntensityMatch + GAMMA × CategoryBalanceBonus
 *
 * ProximityScore  = max(0,  1 − |drill.complexityScore − targetComplexity| / MAX_COMPLEXITY_DISTANCE)
 * IntensityMatch  = 1 − |drill.physicalIntensity − requestedIntensity| / INTENSITY_RANGE
 * CategoryBalanceBonus is dynamic — recomputed after each greedy pick.
 *
 * Result is always in [0, 1].
 */
export function calculateDrillMatchScore(
  drillComplexity: number,
  drillIntensity: number,
  drillCategory: DrillCategory,
  targetComplexity: number,
  requestedIntensity: number,
  categoryCountsInSelection: Record<DrillCategory, number>,
): number {
  const proximityScore = Math.max(
    0,
    1.0 - Math.abs(drillComplexity - targetComplexity) / MAX_COMPLEXITY_DISTANCE,
  );

  const intensityMatch = Math.max(
    0,
    1.0 - Math.abs(drillIntensity - requestedIntensity) / INTENSITY_RANGE,
  );

  const categoryBalance = applyCategoryBalanceBonus(drillCategory, categoryCountsInSelection);

  return Math.min(1.0, ALPHA * proximityScore + BETA * intensityMatch + GAMMA * categoryBalance);
}
