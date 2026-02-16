/**
 * BUILD 72: Practice Types
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * ARCHITECTURE NOTES:
 * - PracticeTimeline is the CANONICAL drill container (flat array)
 * - StationLayout exists for ENGINE OUTPUT ONLY - immediately flattened
 * - assignmentSource: 'manual' | 'auto' controls auto-assignment override
 *
 * BUILD 72 ADDITIONS:
 * - PracticeDetails: Title, Objective, Location, Notes for PDF export
 * - Details persist with session in history
 *
 * LEGACY: Station/StationLayout types retained for engine compatibility only
 * ═══════════════════════════════════════════════════════════════════════════════
 */

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

/** BUILD 68: Assignment source for drill-coach mapping */
export type AssignmentSource = 'auto' | 'manual';

/** A single drill block within a station, fully scheduled. */
export interface DrillBlock {
  /** BUILD 68: Unique identifier for this drill block */
  id?: string;
  drill: Drill;
  /** Wall-clock time allocated to this block in minutes. */
  timeMinutes: number;
  /** Base repetitions calculated by the rep flow engine. */
  reps: number;
  /** Bonus reps awarded to the last drill on a short station (0 if N/A). */
  bonusReps: number;
  /** Leftover time after bonus reps, in minutes. Labeled "open time" for the coach. */
  openTimeMinutes: number;
  /** BUILD 68: Assigned coach ID from the staff registry */
  assignedCoachId?: string;
  /** BUILD 68: Display order in the flat timeline */
  order?: number;
  /** BUILD 68: How this assignment was made (auto or manual) */
  assignmentSource?: AssignmentSource;
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

/** BUILD 68: Flat timeline structure for simplified drill management */
export interface PracticeTimeline {
  drills: DrillBlock[];
  transitionTimeMinutes: number;
  totalWallClockMinutes: number;
}

/** BUILD 63: Source origin for practice sessions */
export type PracticeSource = 'ai' | 'manual' | 'library';

/** BUILD 72: Practice details for PDF export and display */
export interface PracticeDetails {
  /** Custom title for the practice (default: 'Practice Session') */
  title: string;
  /** Main goal/objective for the session */
  objective: string;
  /** Field or location name */
  location: string;
  /** General coaching notes/reminders */
  notes: string;
  /** Date of the practice (ISO string) */
  practiceDate?: string;
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
  /** BUILD 63: Source origin (ai, manual, library) - optional for backward compatibility */
  source?: PracticeSource;
  /** BUILD 63: Optional custom coach names for staff assignments */
  coachNames?: string[];
  /** BUILD 68: Flat timeline structure (migrated from stationLayout) */
  timeline?: PracticeTimeline;
  /** BUILD 72: Practice details for PDF export (title, objective, location, notes) */
  details?: PracticeDetails;
}
