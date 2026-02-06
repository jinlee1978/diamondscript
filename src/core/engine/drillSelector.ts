import { Drill, AgeGroup } from '../../data/types';
import { calculateDrillMatchScore } from '../logic/drillMatchScoring';
import { createEmptyCategoryCounts } from '../logic/categoryBalance';

/**
 * Greedy drill selection loop.
 *
 * At each iteration:
 *   1. Score every remaining candidate against the current category state.
 *   2. Pick the highest-scoring drill.
 *   3. Update category counts.
 *   4. Repeat until numDrills are selected or candidates are exhausted.
 *
 * This produces natural category diversity without hard constraints —
 * the CategoryBalanceBonus shifts dynamically after each pick.
 */
export function selectDrills(
  candidates: Drill[],
  targetComplexity: number,
  requestedIntensity: number,
  numDrills: number,
): Drill[] {
  const selected: Drill[] = [];
  const remaining = [...candidates];
  const categoryCounts = createEmptyCategoryCounts();

  const drillsToSelect = Math.min(numDrills, candidates.length);

  for (let i = 0; i < drillsToSelect; i++) {
    let bestScore = -1;
    let bestIndex = -1;

    for (let j = 0; j < remaining.length; j++) {
      const drill = remaining[j];
      const score = calculateDrillMatchScore(
        drill.complexityScore,
        drill.physicalIntensity,
        drill.category,
        targetComplexity,
        requestedIntensity,
        categoryCounts,
      );

      if (score > bestScore) {
        bestScore = score;
        bestIndex = j;
      }
    }

    if (bestIndex === -1) break;

    const picked = remaining.splice(bestIndex, 1)[0];
    selected.push(picked);
    categoryCounts[picked.category]++;
  }

  return selected;
}

/**
 * Pre-filter: returns only drills compatible with the given age group and tier.
 * This runs BEFORE scoring. The engine never sees an incompatible drill.
 */
export function filterCandidates(
  catalog: Drill[],
  ageGroup: AgeGroup,
  subscriptionTier: 'free' | 'pro',
): Drill[] {
  return catalog.filter(
    (drill) =>
      drill.ageGroupCompatibility.includes(ageGroup) &&
      (subscriptionTier === 'pro' || drill.subscriptionTier === 'free'),
  );
}
