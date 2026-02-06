/**
 * Drill Match Score weights.
 * ALPHA: complexity proximity (primary signal)
 * BETA:  physical intensity match (coach's explicit dial)
 * GAMMA: category balance diversity nudge
 * Must sum to 1.0.
 */
export const ALPHA = 0.50;
export const BETA = 0.30;
export const GAMMA = 0.20;

/**
 * Maximum distance on the complexity axis before ProximityScore floors to 0.
 * A drill more than 2.0 points away from the target complexity is unreachable.
 */
export const MAX_COMPLEXITY_DISTANCE = 2.0;

/**
 * Denominator for IntensityMatch normalization.
 * Intensity is 1–5, so max distance is 4.
 */
export const INTENSITY_RANGE = 4.0;
