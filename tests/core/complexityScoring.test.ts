import { calculateTargetComplexity } from '../../src/core/logic/complexityScoring';
import { getAgeGroupDefinition } from '../../src/core/constants/ageGroups';
import { AgeGroup } from '../../src/data/types';

describe('calculateTargetComplexity', () => {
  test('Scenario A: 10U, 1yr → TC ≈ 2.695', () => {
    const def = getAgeGroupDefinition(AgeGroup.AGE_10U);
    const tc = calculateTargetComplexity(def, 1);
    expect(tc).toBeCloseTo(2.695, 3);
  });

  test('Scenario B: 12U, 4yr → TC ≈ 4.137', () => {
    const def = getAgeGroupDefinition(AgeGroup.AGE_12U);
    const tc = calculateTargetComplexity(def, 4);
    expect(tc).toBeCloseTo(4.137, 3);
  });

  test('TC is always within [ageMin, ageMax] for all age groups and experience levels', () => {
    const ageGroups = [AgeGroup.T_BALL, AgeGroup.AGE_8U, AgeGroup.AGE_10U, AgeGroup.AGE_12U, AgeGroup.AGE_14U];

    for (const group of ageGroups) {
      const def = getAgeGroupDefinition(group);
      for (let exp = 0; exp <= 5; exp++) {
        const tc = calculateTargetComplexity(def, exp);
        expect(tc).toBeGreaterThanOrEqual(def.minComplexity);
        expect(tc).toBeLessThanOrEqual(def.maxComplexity);
      }
    }
  });

  test('exp=0 produces TC = ageMin (EWF is 0)', () => {
    const def = getAgeGroupDefinition(AgeGroup.AGE_12U);
    expect(calculateTargetComplexity(def, 0)).toBe(def.minComplexity);
  });

  test('exp=5 produces TC = ageMax (EWF is 1)', () => {
    const def = getAgeGroupDefinition(AgeGroup.AGE_12U);
    expect(calculateTargetComplexity(def, 5)).toBe(def.maxComplexity);
  });

  test('split-logic: Beginner 12U and Advanced 12U produce different TC', () => {
    const def = getAgeGroupDefinition(AgeGroup.AGE_12U);
    const beginnerTC = calculateTargetComplexity(def, 0);
    const advancedTC = calculateTargetComplexity(def, 5);
    expect(beginnerTC).not.toBe(advancedTC);
    expect(advancedTC).toBeGreaterThan(beginnerTC);
  });
});
