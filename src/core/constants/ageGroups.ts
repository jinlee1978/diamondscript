import { AgeGroup, AgeGroupDefinition } from '../../data/types';

/**
 * Sacred ordering. Index IS the ordinal. Never sort. Never reorder.
 * Frozen at runtime — mutation throws.
 */
export const AGE_GROUP_DEFINITIONS: Readonly<AgeGroupDefinition[]> = Object.freeze([
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
    group: AgeGroup.AGE_8U,
    minAge: 7,
    maxAge: 8,
    minComplexity: 1.5,
    maxComplexity: 2.8,
    defaultPracticeMinutes: 50,
    warmupMinutes: 8,
    cooldownMinutes: 5,
  },
  {
    group: AgeGroup.AGE_10U,
    minAge: 9,
    maxAge: 10,
    minComplexity: 2.2,
    maxComplexity: 3.5,
    defaultPracticeMinutes: 60,
    warmupMinutes: 10,
    cooldownMinutes: 5,
  },
  {
    group: AgeGroup.AGE_12U,
    minAge: 11,
    maxAge: 12,
    minComplexity: 3.0,
    maxComplexity: 4.3,
    defaultPracticeMinutes: 75,
    warmupMinutes: 10,
    cooldownMinutes: 7,
  },
  {
    group: AgeGroup.AGE_14U,
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
