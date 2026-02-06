import { applyExperienceWeighting } from '../../src/core/logic/experienceWeighting';

describe('applyExperienceWeighting', () => {
  const PRECISION = 4;

  test('EWF(0) is exactly 0', () => {
    expect(applyExperienceWeighting(0)).toBe(0.0);
  });

  test('EWF table matches design spec', () => {
    const expected: [number, number][] = [
      [0, 0.0],
      [1, 0.3807],
      [2, 0.5771],
      [3, 0.7360],
      [4, 0.8747],
      [5, 1.0],
    ];

    for (const [x, expectedEWF] of expected) {
      expect(applyExperienceWeighting(x)).toBeCloseTo(expectedEWF, PRECISION);
    }
  });

  test('EWF is monotonically increasing over 0–5', () => {
    let prev = applyExperienceWeighting(0);
    for (let x = 1; x <= 5; x++) {
      const current = applyExperienceWeighting(x);
      expect(current).toBeGreaterThan(prev);
      prev = current;
    }
  });

  test('negative experience clamps to 0', () => {
    expect(applyExperienceWeighting(-3)).toBe(0.0);
  });

  test('experience above 5 clamps to 1.0', () => {
    expect(applyExperienceWeighting(10)).toBe(1.0);
  });
});
