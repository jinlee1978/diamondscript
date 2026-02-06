import { AgeGroup } from './ageGroup';
import { Drill } from './drill';

/** All inputs the engine needs to produce a practice session. */
export interface PracticeRequest {
  ageGroup: AgeGroup;
  /** Years of experience, 0–5. */
  experienceLevel: number;
  /** Requested session intensity, 1–5. */
  intensity: number;
  /** How many drills the coach wants in this session. */
  numDrills: number;
  /** Number of assistant coaches on the field (0+). */
  assistantCoaches: number;
  /** Subscription tier — used for pre-engine drill filtering only. */
  subscriptionTier: 'free' | 'pro';
}

/** A single drill block within a station, fully scheduled. */
export interface DrillBlock {
  drill: Drill;
  /** Wall-clock time allocated to this block in minutes. */
  timeMinutes: number;
  /** Base repetitions calculated by the rep flow engine. */
  reps: number;
  /** Bonus reps awarded to the last drill on a short station (0 if N/A). */
  bonusReps: number;
  /** Leftover time after bonus reps, in minutes. Labeled "open time" for the coach. */
  openTimeMinutes: number;
}

/** One physical station on the field, run by one coach. */
export interface Station {
  /** Coach index: 0 = head coach, 1+ = assistants. */
  coachIndex: number;
  /** Ordered sequence of drill blocks at this station. */
  drills: DrillBlock[];
}

/** Full output of the rep flow engine: the station layout for the practice. */
export interface StationLayout {
  stations: Station[];
  /** Wall-clock time between consecutive drills within a station, in minutes. */
  transitionTimeMinutes: number;
  /** Total practice duration in minutes (warmup + drills + transitions + cooldown). */
  totalWallClockMinutes: number;
}

/** The complete output of the practice generator engine. */
export interface PracticeSession {
  /** Echo of the original request for display/logging. */
  request: PracticeRequest;
  /** The target complexity score computed for this request. */
  targetComplexity: number;
  /** Ordered list of selected drills before station layout. */
  selectedDrills: Drill[];
  /** The full station layout with reps and timing. */
  stationLayout: StationLayout;
  /** Warm-up duration for this age group. */
  warmupMinutes: number;
  /** Cool-down duration for this age group. */
  cooldownMinutes: number;
}
