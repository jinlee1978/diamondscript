/**
 * BUILD 68: Coach and Coaching Staff Types
 * Universal Staff Registry with Smart Placeholders
 */

/** Coach specialty categories - maps to drill categories */
export type CoachSpecialty = 'hitting' | 'fielding' | 'pitching' | 'catching' | 'baserunning' | 'infield' | 'outfield';

/** Individual coach in the staff registry */
export interface Coach {
  id: string;
  name: string;
  role: 'head' | 'assistant';
  specialties: CoachSpecialty[];
  /** For Smart Placeholders: 1, 2, or 3. undefined for user-created coaches */
  placeholderIndex?: number;
  createdAt: number;
  isActive: boolean;
}

/** Complete coaching staff for a team */
export interface CoachingStaff {
  coaches: Coach[];
  headCoachId: string;
  lastModified: number;
}

/** Default coach IDs for stable references */
export const DEFAULT_COACH_IDS = {
  HEAD_COACH: 'head-coach-default',
  ASSISTANT_1: 'assistant-placeholder-1',
  ASSISTANT_2: 'assistant-placeholder-2',
  ASSISTANT_3: 'assistant-placeholder-3',
} as const;

/** Default placeholder names for Legacy Name Sync detection */
export const DEFAULT_PLACEHOLDER_NAMES: Record<string, string> = {
  [DEFAULT_COACH_IDS.HEAD_COACH]: 'Head Coach',
  [DEFAULT_COACH_IDS.ASSISTANT_1]: 'Assistant 1',
  [DEFAULT_COACH_IDS.ASSISTANT_2]: 'Assistant 2',
  [DEFAULT_COACH_IDS.ASSISTANT_3]: 'Assistant 3',
};

/** Index-to-ID mapping for Build 66/67 coachNames array */
export const INDEX_TO_COACH_ID = [
  DEFAULT_COACH_IDS.HEAD_COACH,
  DEFAULT_COACH_IDS.ASSISTANT_1,
  DEFAULT_COACH_IDS.ASSISTANT_2,
  DEFAULT_COACH_IDS.ASSISTANT_3,
];

/** Coach color palette for UI badges */
export const COACH_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  [DEFAULT_COACH_IDS.HEAD_COACH]: {
    bg: '#D1FAE5',
    text: '#065F46',
    border: '#059669',
  },
  [DEFAULT_COACH_IDS.ASSISTANT_1]: {
    bg: '#DBEAFE',
    text: '#1E40AF',
    border: '#3B82F6',
  },
  [DEFAULT_COACH_IDS.ASSISTANT_2]: {
    bg: '#FEF3C7',
    text: '#92400E',
    border: '#D4AF37',
  },
  [DEFAULT_COACH_IDS.ASSISTANT_3]: {
    bg: '#ECFDF5',
    text: '#047857',
    border: '#10B981',
  },
};

/** Get color config for a coach ID, with fallback */
export function getCoachColor(coachId: string): { bg: string; text: string; border: string } {
  return COACH_COLORS[coachId] ?? {
    bg: '#F3F4F6',
    text: '#374151',
    border: '#9CA3AF',
  };
}
