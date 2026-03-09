/**
 * BUILD 101: Season Mode Types
 *
 * Calendar-based practice scheduling. A Season has a date range
 * and contains scheduled practice slots that can link to generated plans.
 */

import { AgeGroup } from './ageGroup';

/** A single scheduled practice slot */
export interface ScheduledPractice {
  /** Unique ID */
  id: string;
  /** Date string in YYYY-MM-DD format */
  date: string;
  /** Optional time of day (e.g. "5:30 PM") */
  time?: string;
  /** Location/field name */
  location?: string;
  /** Coach notes for this date */
  notes?: string;
  /** ID of linked history entry (if a plan was generated) */
  linkedHistoryId?: number;
  /** Whether this practice has been completed */
  completed: boolean;
}

/** A season containing multiple scheduled practices */
export interface Season {
  /** Unique ID */
  id: string;
  /** Display name (e.g. "Spring 2026") */
  name: string;
  /** Associated team profile ID */
  teamId?: string;
  /** Age group for context */
  ageGroup: AgeGroup;
  /** Start date (YYYY-MM-DD) */
  startDate: string;
  /** End date (YYYY-MM-DD) */
  endDate: string;
  /** All scheduled practices */
  practices: ScheduledPractice[];
  /** Creation timestamp */
  createdAt: number;
  /** Last modification */
  lastModified: number;
}

/** Storage container for seasons */
export interface SeasonStore {
  seasons: Season[];
  activeSeasonId: string | null;
  lastModified: number;
}
