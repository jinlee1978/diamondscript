import { calculateDrillMatchScore } from '../../src/core/logic/drillMatchScoring';
import { createEmptyCategoryCounts } from '../../src/core/logic/categoryBalance';
import { DrillCategory } from '../../src/data/types';

describe('calculateDrillMatchScore', () => {
  test('DMS is always in [0, 1]', () => {
    const categories: DrillCategory[] = ['hitting', 'fielding', 'pitching', 'baserunning'];
    const emptyCounts = createEmptyCategoryCounts();

    // Fuzz across a range of inputs
    for (const cat of categories) {
      for (let complexity = 1; complexity <= 5; complexity++) {
        for (let intensity = 1; intensity <= 5; intensity++) {
          const dms = calculateDrillMatchScore(complexity, intensity, cat, 3.0, 3, emptyCounts);
          expect(dms).toBeGreaterThanOrEqual(0);
          expect(dms).toBeLessThanOrEqual(1);
        }
      }
    }
  });

  test('Scenario A first-pass: Grounders & Throw scores ≈ 0.9513', () => {
    const emptyCounts = createEmptyCategoryCounts();
    const dms = calculateDrillMatchScore(2.5, 3, 'fielding', 2.695, 3, emptyCounts);
    expect(dms).toBeCloseTo(0.9513, 3);
  });

  test('Scenario A first-pass: Batting Tee Drill scores ≈ 0.8988', () => {
    const emptyCounts = createEmptyCategoryCounts();
    const dms = calculateDrillMatchScore(2.8, 2, 'hitting', 2.695, 3, emptyCounts);
    expect(dms).toBeCloseTo(0.8988, 3);
  });

  test('Scenario B first-pass: Double-Play Drill scores ≈ 0.9843', () => {
    const emptyCounts = createEmptyCategoryCounts();
    const dms = calculateDrillMatchScore(4.2, 4, 'fielding', 4.1371, 4, emptyCounts);
    expect(dms).toBeCloseTo(0.9843, 3);
  });

  test('CategoryBalanceBonus drops score when category already selected', () => {
    const counts: Record<DrillCategory, number> = { hitting: 0, fielding: 1, pitching: 0, baserunning: 0 };
    const withFieldingOnce = calculateDrillMatchScore(2.5, 3, 'fielding', 2.695, 3, counts);

    const emptyCounts = createEmptyCategoryCounts();
    const withFieldingZero = calculateDrillMatchScore(2.5, 3, 'fielding', 2.695, 3, emptyCounts);

    expect(withFieldingOnce).toBeLessThan(withFieldingZero);
  });

  test('perfect match on complexity and intensity with empty category gives max-ish score', () => {
    const emptyCounts = createEmptyCategoryCounts();
    // Exact match: proximity=1.0, intensity=1.0, category=1.0 → DMS = 0.5+0.3+0.2 = 1.0
    const dms = calculateDrillMatchScore(3.0, 3, 'hitting', 3.0, 3, emptyCounts);
    expect(dms).toBeCloseTo(1.0, 4);
  });

  test('drill beyond MAX_COMPLEXITY_DISTANCE has ProximityScore = 0', () => {
    const emptyCounts = createEmptyCategoryCounts();
    // TC=2.0, drill at 4.1 → distance=2.1 > 2.0 → proximity floors to 0
    const dms = calculateDrillMatchScore(4.1, 3, 'hitting', 2.0, 3, emptyCounts);
    // DMS = 0.50*0 + 0.30*1.0 + 0.20*1.0 = 0.5
    expect(dms).toBeCloseTo(0.5, 4);
  });
});
