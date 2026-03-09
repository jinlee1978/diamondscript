import { AgeGroup, AgeGroupDefinition } from '../../data/types';

/**
 * Sacred ordering. Index IS the ordinal. Never sort. Never reorder.
 * Frozen at runtime — mutation throws.
 *
 * BUILD 100: Expanded from 5 → 7 groups.
 *   0 — Intro (3-4): Pre-T-Ball motor skills. 30 min practices.
 *   1 — T-Ball (5-6): Ball on tee, no live pitching. 45 min.
 *   2 — Coach Pitch (7-8): Coach throws, real ball tracking begins. 50 min.
 *   3 — Machine Pitch (8-9): Consistent machine strikes, swing mechanics. 55 min.
 *   4 — Kid Pitch (9-10): Kid on the mound. Pitcher/catcher work. 60 min.
 *   5 — Competitive (11-12): Position specialization, advanced situations. 75 min.
 *   6 — Advanced (13-14): Full baseball, longer distances, pitch selection. 90 min.
 */
export const AGE_GROUP_DEFINITIONS: Readonly<AgeGroupDefinition[]> = Object.freeze([
  {
    group: AgeGroup.INTRO,
    minAge: 3,
    maxAge: 4,
    minComplexity: 1.0,
    maxComplexity: 1.5,
    defaultPracticeMinutes: 30,
    warmupMinutes: 5,
    cooldownMinutes: 5,
  },
  {
    group: AgeGroup.T_BALL,
    minAge: 5,
    maxAge: 6,
    minComplexity: 1.0,
    maxComplexity: 2.0,
    defaultPracticeMinutes: 45,
    warmupMinutes: 8,
    cooldownMinutes: 5,
  },
  {
    group: AgeGroup.COACH_PITCH,
    minAge: 7,
    maxAge: 8,
    minComplexity: 1.5,
    maxComplexity: 2.8,
    defaultPracticeMinutes: 50,
    warmupMinutes: 8,
    cooldownMinutes: 5,
  },
  {
    group: AgeGroup.MACHINE_PITCH,
    minAge: 8,
    maxAge: 9,
    minComplexity: 1.8,
    maxComplexity: 3.0,
    defaultPracticeMinutes: 55,
    warmupMinutes: 8,
    cooldownMinutes: 5,
  },
  {
    group: AgeGroup.KID_PITCH,
    minAge: 9,
    maxAge: 10,
    minComplexity: 2.2,
    maxComplexity: 3.5,
    defaultPracticeMinutes: 60,
    warmupMinutes: 10,
    cooldownMinutes: 5,
  },
  {
    group: AgeGroup.COMPETITIVE,
    minAge: 11,
    maxAge: 12,
    minComplexity: 3.0,
    maxComplexity: 4.3,
    defaultPracticeMinutes: 75,
    warmupMinutes: 10,
    cooldownMinutes: 7,
  },
  {
    group: AgeGroup.ADVANCED,
    minAge: 13,
    maxAge: 14,
    minComplexity: 3.8,
    maxComplexity: 5.0,
    defaultPracticeMinutes: 90,
    warmupMinutes: 12,
    cooldownMinutes: 8,
  },
]);

/** Lookup by AgeGroup enum value. Throws if group is not found. */
export function getAgeGroupDefinition(group: AgeGroup): AgeGroupDefinition {
  const def = AGE_GROUP_DEFINITIONS.find((d) => d.group === group);
  if (!def) {
    throw new Error(`Unknown age group: ${group}`);
  }
  return def;
}
