import { AgeGroup, PracticeRequest } from '../../src/data/types';

/** Scenario A: 10U / 1yr experience / Intensity 3 / 1 assistant coach */
export const SCENARIO_A: PracticeRequest = {
  ageGroup: AgeGroup.KID_PITCH,
  experienceLevel: 1,
  intensity: 3,
  numDrills: 4,
  assistantCoaches: 1,
  subscriptionTier: 'pro',
};

/** Scenario B: 12U / 4yr experience / Intensity 4 / 0 assistant coaches */
export const SCENARIO_B: PracticeRequest = {
  ageGroup: AgeGroup.COMPETITIVE,
  experienceLevel: 4,
  intensity: 4,
  numDrills: 4,
  assistantCoaches: 0,
  subscriptionTier: 'pro',
};

/** Edge: experience = 0 (EWF hard-coded 0) */
export const EDGE_ZERO_EXPERIENCE: PracticeRequest = {
  ageGroup: AgeGroup.COMPETITIVE,
  experienceLevel: 0,
  intensity: 3,
  numDrills: 3,
  assistantCoaches: 0,
  subscriptionTier: 'pro',
};

/** Edge: max experience */
export const EDGE_MAX_EXPERIENCE: PracticeRequest = {
  ageGroup: AgeGroup.COMPETITIVE,
  experienceLevel: 5,
  intensity: 3,
  numDrills: 3,
  assistantCoaches: 0,
  subscriptionTier: 'pro',
};

/** Edge: single drill */
export const EDGE_SINGLE_DRILL: PracticeRequest = {
  ageGroup: AgeGroup.KID_PITCH,
  experienceLevel: 2,
  intensity: 3,
  numDrills: 1,
  assistantCoaches: 0,
  subscriptionTier: 'pro',
};

/** Edge: more coaches than drills */
export const EDGE_EXCESS_COACHES: PracticeRequest = {
  ageGroup: AgeGroup.KID_PITCH,
  experienceLevel: 2,
  intensity: 3,
  numDrills: 2,
  assistantCoaches: 5,
  subscriptionTier: 'pro',
};
