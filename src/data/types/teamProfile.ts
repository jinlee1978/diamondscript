/**
 * BUILD 100: Team Profile Types
 *
 * Lightweight team profiles stored in AsyncStorage.
 * Coaches with multiple teams can switch between them.
 * Each profile pre-fills the setup and AI lab forms.
 */

import { AgeGroup } from './ageGroup';
import { CoachingStaff } from './coach';

/** A team profile that pre-fills practice generation forms */
export interface TeamProfile {
  /** Unique identifier (UUID-style) */
  id: string;
  /** Display name, e.g. "Red Sox 10U" */
  name: string;
  /** Age group for this team */
  ageGroup: AgeGroup;
  /** Default experience level (0-5) */
  experienceLevel: number;
  /** Default intensity (1-5) */
  intensity: number;
  /** Number of assistant coaches (0-3) */
  assistantCoaches: number;
  /** Coaching staff snapshot for this team */
  coachingStaff?: CoachingStaff;
  /** Optional team color for visual distinction */
  color: string;
  /** Creation timestamp */
  createdAt: number;
  /** Last modification timestamp */
  lastModified: number;
}

/** Container for all team profiles */
export interface TeamProfileStore {
  /** All team profiles */
  profiles: TeamProfile[];
  /** ID of the currently active team (null = no team selected) */
  activeTeamId: string | null;
  /** Last modification timestamp */
  lastModified: number;
}

/** Predefined team colors for visual distinction */
export const TEAM_COLORS = [
  '#1B4332', // Forest Green (default)
  '#1E40AF', // Blue
  '#DC2626', // Red
  '#7C3AED', // Purple
  '#D97706', // Amber
  '#0891B2', // Cyan
  '#BE185D', // Pink
  '#4338CA', // Indigo
] as const;

/** Get a display-friendly color name */
export const TEAM_COLOR_NAMES: Record<string, string> = {
  '#1B4332': 'Green',
  '#1E40AF': 'Blue',
  '#DC2626': 'Red',
  '#7C3AED': 'Purple',
  '#D97706': 'Amber',
  '#0891B2': 'Cyan',
  '#BE185D': 'Pink',
  '#4338CA': 'Indigo',
};
