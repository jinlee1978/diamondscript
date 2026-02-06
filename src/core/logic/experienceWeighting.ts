/**
 * Experience Weighting Function (EWF).
 *
 * Maps integer experience years (0–5) to a 0.0–1.0 weight using a concave
 * power curve with exponent 0.6. Early experience years produce steeper gains;
 * upper years exhibit diminishing returns.
 *
 * Table:
 *   x=0 → 0.000
 *   x=1 → 0.381  (+0.381)
 *   x=2 → 0.577  (+0.196)
 *   x=3 → 0.736  (+0.159)
 *   x=4 → 0.875  (+0.139)
 *   x=5 → 1.000  (+0.125)
 */

const EWF_EXPONENT = 0.6;
const EWF_MAX_EXPERIENCE = 5;

export function applyExperienceWeighting(experienceYears: number): number {
  if (experienceYears <= 0) return 0.0;
  const clamped = Math.min(experienceYears, EWF_MAX_EXPERIENCE);
  const normalized = clamped / EWF_MAX_EXPERIENCE;
  return Math.pow(normalized, EWF_EXPONENT);
}
