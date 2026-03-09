import { generatePracticeSession } from '../../src/core/engine/index';
import { SEED_DRILL_CATALOG } from '../../src/data/seedDrills';
import { AgeGroup } from '../../src/data/types';
import { SCENARIO_A, SCENARIO_B, EDGE_ZERO_EXPERIENCE, EDGE_MAX_EXPERIENCE, EDGE_SINGLE_DRILL, EDGE_EXCESS_COACHES } from '../fixtures/scenarioFixtures';

describe('drillSelector — integration', () => {
  test('Scenario A: selects 4 drills, all 10U-compatible', () => {
    const session = generatePracticeSession(SCENARIO_A, SEED_DRILL_CATALOG);

    expect(session.selectedDrills).toHaveLength(4);
    for (const drill of session.selectedDrills) {
      expect(drill.ageGroupCompatibility).toContain(AgeGroup.KID_PITCH);
    }
  });

  test('Scenario A: target complexity ≈ 2.695', () => {
    const session = generatePracticeSession(SCENARIO_A, SEED_DRILL_CATALOG);
    expect(session.targetComplexity).toBeCloseTo(2.695, 3);
  });

  test('Scenario B: selects 4 drills, all 12U-compatible', () => {
    const session = generatePracticeSession(SCENARIO_B, SEED_DRILL_CATALOG);

    expect(session.selectedDrills).toHaveLength(4);
    for (const drill of session.selectedDrills) {
      expect(drill.ageGroupCompatibility).toContain(AgeGroup.COMPETITIVE);
    }
  });

  test('Scenario B: target complexity ≈ 4.137', () => {
    const session = generatePracticeSession(SCENARIO_B, SEED_DRILL_CATALOG);
    expect(session.targetComplexity).toBeCloseTo(4.137, 3);
  });

  test('split-logic: 12U exp=0 and 12U exp=5 produce different drill selections', () => {
    const beginner = generatePracticeSession(EDGE_ZERO_EXPERIENCE, SEED_DRILL_CATALOG);
    const advanced = generatePracticeSession(EDGE_MAX_EXPERIENCE, SEED_DRILL_CATALOG);

    const beginnerIds = beginner.selectedDrills.map((d) => d.id);
    const advancedIds = advanced.selectedDrills.map((d) => d.id);

    // They must differ — this is the core split-logic invariant
    expect(beginnerIds).not.toEqual(advancedIds);

    // Advanced TC must be higher
    expect(advanced.targetComplexity).toBeGreaterThan(beginner.targetComplexity);
  });

  test('Free tier filters out pro-only drills', () => {
    const freeRequest = { ...SCENARIO_B, subscriptionTier: 'free' as const };
    const session = generatePracticeSession(freeRequest, SEED_DRILL_CATALOG);

    for (const drill of session.selectedDrills) {
      expect(drill.subscriptionTier).toBe('free');
    }
  });

  test('single drill request returns exactly 1 drill', () => {
    const session = generatePracticeSession(EDGE_SINGLE_DRILL, SEED_DRILL_CATALOG);
    expect(session.selectedDrills).toHaveLength(1);
  });

  test('excess coaches: station count caps at numDrills', () => {
    const session = generatePracticeSession(EDGE_EXCESS_COACHES, SEED_DRILL_CATALOG);
    expect(session.stationLayout.stations).toHaveLength(2); // 2 drills = 2 stations max
  });

  test('T-Ball: no pitching drills selected', () => {
    const tballRequest = {
      ageGroup: AgeGroup.T_BALL,
      experienceLevel: 2,
      intensity: 2,
      numDrills: 3,
      assistantCoaches: 0,
      subscriptionTier: 'pro' as const,
    };
    const session = generatePracticeSession(tballRequest, SEED_DRILL_CATALOG);

    for (const drill of session.selectedDrills) {
      expect(drill.category).not.toBe('pitching');
    }
  });

  test('numDrills exceeding available compatible drills caps gracefully', () => {
    // T-Ball has very few drills in seed catalog; requesting 20 should return what's available
    const tballRequest = {
      ageGroup: AgeGroup.T_BALL,
      experienceLevel: 0,
      intensity: 1,
      numDrills: 20,
      assistantCoaches: 0,
      subscriptionTier: 'pro' as const,
    };
    const session = generatePracticeSession(tballRequest, SEED_DRILL_CATALOG);

    // Should return all available T-Ball drills without crashing
    expect(session.selectedDrills.length).toBeGreaterThan(0);
    expect(session.selectedDrills.length).toBeLessThanOrEqual(20);
    for (const drill of session.selectedDrills) {
      expect(drill.ageGroupCompatibility).toContain(AgeGroup.T_BALL);
    }
  });
});
