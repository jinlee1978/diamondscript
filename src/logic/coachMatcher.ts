/**
 * BUILD 72: Smart Coordinator Engine
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * ARCHITECTURE: Unified Flat Timeline
 * - All drills exist in a single timeline array, NOT nested station silos
 * - Coach assignments are properties on DrillBlock, not structural containers
 * - flattenStationsToTimeline() converts engine output immediately on generation
 *
 * ASSIGNMENT ALGORITHM: Specialty-Aware with Load Balancing
 * - EXACT_MATCH (200): Coach specialty matches drill category directly
 * - RELATED_MATCH (150): Coach has related specialty (e.g., fielding → infield)
 * - HEAD_COACH_PENALTY (100): Head Coach is "Coach of Last Resort"
 * - LOAD_PENALTY_PER_DRILL (25): Prevents overloading any single coach
 *
 * BUILD 72: UNIVERSAL COACH IDENTITY ("Name First" Rule)
 * - getCoachDisplayName() prioritizes actual coach names from registry
 * - Falls back to "Role — Specialty" only when name is empty/default
 *
 * SOURCE-AGNOSTIC: Works identically for 'engine', 'ai', and 'manual' plans
 *
 * MANUAL LOCKDOWN: When assignmentSource === 'manual', auto-assignment NEVER
 * overrides. User's explicit choices are bulletproof.
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import { DrillBlock } from '../data/types/practice';
import { DrillCategory } from '../data/types';
import { CoachingStaff, Coach, CoachSpecialty } from '../data/types/coach';

/** Map drill categories to coach specialties (ordered by relevance) */
const CATEGORY_TO_SPECIALTIES: Record<DrillCategory, CoachSpecialty[]> = {
  hitting: ['hitting'],
  fielding: ['fielding', 'infield', 'outfield'],
  pitching: ['pitching', 'catching'],
  baserunning: ['baserunning'],
};

/** Specialty match scoring weights */
const MATCH_SCORES = {
  EXACT_MATCH: 200,      // Direct specialty match (hitting -> hitting)
  RELATED_MATCH: 150,    // Related specialty (fielding -> infield)
  NO_MATCH: 0,           // No matching specialty
};

/** Head Coach penalty - makes them "Coach of Last Resort" */
const HEAD_COACH_PENALTY = 100;

/** Load balancing factor - reduces score per assigned drill */
const LOAD_PENALTY_PER_DRILL = 25;

/** Default placeholder names to detect unnamed coaches */
const DEFAULT_PLACEHOLDER_NAMES: Record<string, string> = {
  'head-coach-default': 'Head Coach',
  'assistant-placeholder-1': 'Assistant 1',
  'assistant-placeholder-2': 'Assistant 2',
  'assistant-placeholder-3': 'Assistant 3',
};

/** Specialty display labels */
const SPECIALTY_LABELS: Record<CoachSpecialty, string> = {
  hitting: 'Hitting',
  fielding: 'Fielding',
  pitching: 'Pitching',
  catching: 'Catching',
  baserunning: 'Baserunning',
  infield: 'Infield',
  outfield: 'Outfield',
};

/**
 * Calculate specialty match score for a coach and drill category
 * Higher score = better match
 */
function calculateSpecialtyScore(coach: Coach, category: DrillCategory): number {
  const requiredSpecialties = CATEGORY_TO_SPECIALTIES[category] || [];
  if (requiredSpecialties.length === 0) return MATCH_SCORES.NO_MATCH;

  // Check for exact match (first specialty in the list)
  if (coach.specialties.includes(requiredSpecialties[0])) {
    return MATCH_SCORES.EXACT_MATCH;
  }

  // Check for related matches (subsequent specialties)
  for (const specialty of requiredSpecialties.slice(1)) {
    if (coach.specialties.includes(specialty)) {
      return MATCH_SCORES.RELATED_MATCH;
    }
  }

  return MATCH_SCORES.NO_MATCH;
}

/**
 * Auto-assign a single drill to the best-matching coach
 * Uses specialty scoring + load balancing
 * HEAD COACH IS PENALIZED - Assistants with specialties always win
 * Respects manual assignments (never overrides)
 */
export function autoAssignDrill(
  drill: DrillBlock,
  staff: CoachingStaff,
  currentAssignments?: Map<string, number>
): string {
  // Already manually assigned? NEVER override
  if (drill.assignmentSource === 'manual' && drill.assignedCoachId) {
    return drill.assignedCoachId;
  }

  const category = drill.drill.category;
  const assignments = currentAssignments || new Map<string, number>();

  // Score all coaches
  const coachScores: { coachId: string; score: number; isHead: boolean }[] = [];

  for (const coach of staff.coaches) {
    // Skip inactive assistants
    if (coach.role === 'assistant' && !coach.isActive) continue;

    // Calculate base specialty score
    let score = calculateSpecialtyScore(coach, category);

    // Apply load penalty based on current assignments
    const currentLoad = assignments.get(coach.id) || 0;
    score -= currentLoad * LOAD_PENALTY_PER_DRILL;

    // HEAD COACH PENALTY - Makes them "Coach of Last Resort"
    const isHead = coach.role === 'head';
    if (isHead) {
      score -= HEAD_COACH_PENALTY;
    }

    // Cap at minimum 0 for non-head coaches with specialties, but allow negative for head
    if (!isHead && score < 0) {
      score = 0;
    }

    coachScores.push({ coachId: coach.id, score, isHead });
  }

  // Sort by score (highest first)
  // For ties, prefer assistants over head coach
  coachScores.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    // For ties, prefer assistants
    if (a.isHead && !b.isHead) return 1;
    if (!a.isHead && b.isHead) return -1;
    return 0;
  });

  // Return best match, or head coach as absolute fallback
  return coachScores.length > 0 ? coachScores[0].coachId : staff.headCoachId;
}

/**
 * Auto-assign all drills in a list with load balancing
 * SOURCE AGNOSTIC: Works identically for 'engine', 'ai', and 'manual' plans
 * Returns new array with updated assignments
 */
export function autoAssignDrillsToStaff(
  drills: DrillBlock[],
  staff: CoachingStaff
): DrillBlock[] {
  // Track assignments for load balancing
  const assignmentCounts = new Map<string, number>();

  return drills.map(drill => {
    // NEVER override manual assignments
    if (drill.assignmentSource === 'manual' && drill.assignedCoachId) {
      // Still count it for load balancing
      assignmentCounts.set(
        drill.assignedCoachId,
        (assignmentCounts.get(drill.assignedCoachId) || 0) + 1
      );
      return drill;
    }

    const assignedCoachId = autoAssignDrill(drill, staff, assignmentCounts);

    // Update assignment count for load balancing
    assignmentCounts.set(
      assignedCoachId,
      (assignmentCounts.get(assignedCoachId) || 0) + 1
    );

    return {
      ...drill,
      assignedCoachId,
      assignmentSource: 'auto' as const,
    };
  });
}

/**
 * BUILD 72: Get display name for a coach (Universal Coach Identity - "Name First" Rule)
 *
 * HIERARCHY:
 * 1. IDENTITY FIRST: If coach has a real name (not placeholder), use it
 * 2. SPECIALTY FALLBACK: If name is placeholder, show "Role — Specialty"
 * 3. GENERIC FALLBACK: "Head Coach" or "Assistant X" as last resort
 */
export function getCoachDisplayName(
  coachId: string,
  staff: CoachingStaff,
  drillCategory?: DrillCategory
): string {
  const coach = staff.coaches.find(c => c.id === coachId);
  if (!coach) return 'Unassigned';

  // Check if coach has a real name (not a default placeholder)
  const defaultName = DEFAULT_PLACEHOLDER_NAMES[coachId];
  const hasRealName = coach.name && coach.name !== defaultName && coach.name.trim() !== '';

  // RULE 1: IDENTITY FIRST - Use real name if available
  if (hasRealName) {
    return coach.name;
  }

  // RULE 2: SPECIALTY FALLBACK - Show "Role — Specialty" for placeholder names
  if (coach.specialties.length > 0) {
    // Get the primary specialty (first one, or one that matches drill category)
    let primarySpecialty = coach.specialties[0];

    // If drill category is provided, try to find a matching specialty
    if (drillCategory) {
      const relevantSpecialties = CATEGORY_TO_SPECIALTIES[drillCategory] || [];
      const matchedSpecialty = coach.specialties.find(s => relevantSpecialties.includes(s));
      if (matchedSpecialty) {
        primarySpecialty = matchedSpecialty;
      }
    }

    const specialtyLabel = SPECIALTY_LABELS[primarySpecialty];

    if (coach.role === 'head') {
      return `Head Coach — ${specialtyLabel}`;
    } else {
      const assistantNum = coach.placeholderIndex || '';
      return `Assistant ${assistantNum} — ${specialtyLabel}`;
    }
  }

  // RULE 3: GENERIC FALLBACK
  if (coach.role === 'head') {
    return 'Head Coach';
  }

  return coach.name || `Assistant ${coach.placeholderIndex || ''}`;
}

/**
 * BUILD 72: Get specialty tag for PDF display
 * Returns the coach's primary specialty as a short tag, or null if none
 */
export function getCoachSpecialtyTag(
  coachId: string,
  staff: CoachingStaff,
  drillCategory?: DrillCategory
): string | null {
  const coach = staff.coaches.find(c => c.id === coachId);
  if (!coach || coach.specialties.length === 0) return null;

  // Try to find a specialty that matches the drill category
  if (drillCategory) {
    const relevantSpecialties = CATEGORY_TO_SPECIALTIES[drillCategory] || [];
    const matchedSpecialty = coach.specialties.find(s => relevantSpecialties.includes(s));
    if (matchedSpecialty) {
      return SPECIALTY_LABELS[matchedSpecialty];
    }
  }

  // Return first specialty as fallback
  return SPECIALTY_LABELS[coach.specialties[0]] || null;
}

/**
 * Claim all unassigned drills for a specific coach
 */
export function claimAllUnassigned(
  drills: DrillBlock[],
  claimingCoachId: string
): DrillBlock[] {
  return drills.map(drill => {
    if (!drill.assignedCoachId) {
      return {
        ...drill,
        assignedCoachId: claimingCoachId,
        assignmentSource: 'manual' as const,
      };
    }
    return drill;
  });
}

/**
 * Manually assign a drill to a coach (overrides auto-assignment)
 * Sets assignmentSource: 'manual' to LOCK the assignment
 */
export function manuallyAssignDrill(
  drills: DrillBlock[],
  drillIndex: number,
  newCoachId: string
): DrillBlock[] {
  return drills.map((drill, idx) => {
    if (idx === drillIndex) {
      return {
        ...drill,
        assignedCoachId: newCoachId,
        assignmentSource: 'manual' as const,
      };
    }
    return drill;
  });
}

/**
 * Count unassigned drills
 */
export function countUnassignedDrills(drills: DrillBlock[]): number {
  return drills.filter(d => !d.assignedCoachId).length;
}

/**
 * Get drills assigned to a specific coach
 */
export function getDrillsForCoach(drills: DrillBlock[], coachId: string): DrillBlock[] {
  return drills.filter(d => d.assignedCoachId === coachId);
}

/**
 * BUILD 72: Get coach's primary specialty for a given category
 * Used for role aliasing in Share text
 */
export function getCoachRoleForCategory(
  coachId: string,
  staff: CoachingStaff,
  category: DrillCategory
): string | null {
  const coach = staff.coaches.find(c => c.id === coachId);
  if (!coach) return null;

  const requiredSpecialties = CATEGORY_TO_SPECIALTIES[category] || [];
  const matchedSpecialty = coach.specialties.find(s => requiredSpecialties.includes(s));

  if (matchedSpecialty) {
    return SPECIALTY_LABELS[matchedSpecialty] || null;
  }

  return null;
}

/**
 * BUILD 72: Flatten station layout into a single timeline array
 * BREAKS THE STATION SILOS - All drills in one flat array
 */
export function flattenStationsToTimeline(
  stations: { coachIndex: number; drills: DrillBlock[] }[],
  transitionTimeMinutes: number,
  totalWallClockMinutes: number
): { drills: DrillBlock[]; transitionTimeMinutes: number; totalWallClockMinutes: number } {
  const flatDrills: DrillBlock[] = [];
  let order = 0;

  for (const station of stations) {
    for (const drill of station.drills) {
      flatDrills.push({
        ...drill,
        id: drill.id || `drill-${order}-${Date.now()}`,
        // Initially assign based on station, but this will be re-assigned by autoAssignDrillsToStaff
        assignedCoachId: drill.assignedCoachId,
        order: order++,
        assignmentSource: drill.assignmentSource || 'auto',
      });
    }
  }

  return {
    drills: flatDrills,
    transitionTimeMinutes,
    totalWallClockMinutes,
  };
}
