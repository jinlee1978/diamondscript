/** Sacred ordering. Index IS the ordinal. Never sort or reorder. */
export enum AgeGroup {
  T_BALL = 'T_BALL',
  AGE_8U = '8U',
  AGE_10U = '10U',
  AGE_12U = '12U',
  AGE_14U = '14U',
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
