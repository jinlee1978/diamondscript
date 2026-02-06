/**
 * Base transition time in minutes. The actual transition time is computed as:
 *   transitionTime = BASE_TRANSITION_MINUTES + (TRANSITION_INTENSITY_PIVOT - intensity) * TRANSITION_SLOPE
 *
 * At intensity 3 (pivot): transition = 3.0 min
 * At intensity 1 (low):   transition = 4.0 min  (slower pace, more mental reset)
 * At intensity 5 (high):  transition = 2.0 min  (players are warm, move fast)
 */
export const BASE_TRANSITION_MINUTES = 3.0;
export const TRANSITION_INTENSITY_PIVOT = 3;
export const TRANSITION_SLOPE = 0.5;

/**
 * Base reps per minute = BASE_RPM + intensity.
 * At intensity 1: 4 RPM. At intensity 5: 8 RPM.
 */
export const BASE_RPM = 3;

/**
 * Maximum bonus reps a short station can earn, as a fraction of base repsPerDrill.
 */
export const BONUS_REP_CAP_FRACTION = 0.5;
