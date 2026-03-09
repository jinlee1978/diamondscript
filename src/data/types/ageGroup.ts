/**
 * Sacred ordering. Index IS the ordinal. Never sort or reorder.
 *
 * BUILD 100: Expanded from 5 → 7 groups.
 * Added INTRO (3-4) below T-Ball and MACHINE_PITCH (8-9) between Coach Pitch and Kid Pitch.
 * Existing ordinals shifted — all downstream lookups use the enum, not raw indices.
 */
export enum AgeGroup {
  INTRO = 'INTRO',
  T_BALL = 'T_BALL',
  COACH_PITCH = 'COACH_PITCH',
  MACHINE_PITCH = 'MACHINE_PITCH',
  KID_PITCH = 'KID_PITCH',
  COMPETITIVE = 'COMPETITIVE',
  ADVANCED = 'ADVANCED',
}

export interface AgeGroupDefinition {
  group: AgeGroup;
  minAge: number;
  maxAge: number;
  /** Floor of the complexity band for this age group. */
  minComplexity: number;
  /** Ceiling of the complexity band for this age group. */
  maxComplexity: number;
  /** Default total practice session duration in minutes. */
  defaultPracticeMinutes: number;
  /** Warm-up block duration in minutes. */
  warmupMinutes: number;
  /** Cool-down block duration in minutes. */
  cooldownMinutes: number;
}
