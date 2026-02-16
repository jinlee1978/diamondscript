/**
 * BUILD 71: Practice Session Storage & Migration
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * PURPOSE: Migrates legacy stationLayout sessions to flat timeline format
 *
 * MANUAL LOCKDOWN PRESERVATION:
 * - migrateToTimeline() preserves assignmentSource on each DrillBlock
 * - Manual assignments (assignmentSource: 'manual') survive storage round-trips
 * - Auto assignments default to 'auto' if not specified
 *
 * LEGACY SUPPORT:
 * - Build 66/67 sessions with coachNames[] sync to Coaching Registry
 * - ONE-TIME CONSTRAINT: Only syncs if placeholder still has default name
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import { PracticeSession, PracticeTimeline, DrillBlock } from '../types/practice';
import {
  DEFAULT_COACH_IDS,
  DEFAULT_PLACEHOLDER_NAMES,
  INDEX_TO_COACH_ID,
} from '../types/coach';
import { loadCoachingStaff, saveCoachingStaff } from './coachingStorage';

/** Generate unique ID for drill blocks */
function generateDrillBlockId(): string {
  return `drill-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/** Map old coachIndex to Smart Placeholder IDs */
function mapCoachIndexToPlaceholder(coachIndex: number): string {
  switch (coachIndex) {
    case 0:
      return DEFAULT_COACH_IDS.HEAD_COACH;
    case 1:
      return DEFAULT_COACH_IDS.ASSISTANT_1;
    case 2:
      return DEFAULT_COACH_IDS.ASSISTANT_2;
    case 3:
      return DEFAULT_COACH_IDS.ASSISTANT_3;
    default:
      return DEFAULT_COACH_IDS.HEAD_COACH;
  }
}

/**
 * Migrate a session from stationLayout to flat timeline
 * RED FLAG FIX: Includes defensive guards for malformed data
 * This is a PURE function - no side effects
 */
export function migrateToTimeline(session: PracticeSession): PracticeTimeline {
  const drills: DrillBlock[] = [];
  let order = 0;

  // Defensive check for missing stationLayout
  if (!session.stationLayout?.stations) {
    return { drills: [], transitionTimeMinutes: 2, totalWallClockMinutes: 0 };
  }

  for (const station of session.stationLayout.stations) {
    // RED FLAG FIX: Guard 1 - Skip malformed stations
    if (!Array.isArray(station?.drills)) continue;

    // Map station.coachIndex to Smart Placeholder ID
    const coachId = mapCoachIndexToPlaceholder(station.coachIndex);

    for (const block of station.drills) {
      // RED FLAG FIX: Guard 2 - Skip invalid drill blocks
      if (!block?.drill?.id) continue;

      drills.push({
        ...block,
        id: block.id ?? generateDrillBlockId(),
        assignedCoachId: block.assignedCoachId ?? coachId,
        order: order++,
        assignmentSource: block.assignmentSource ?? 'auto',
      });
    }
  }

  return {
    drills,
    transitionTimeMinutes: session.stationLayout.transitionTimeMinutes ?? 2,
    totalWallClockMinutes: session.stationLayout.totalWallClockMinutes ?? 0,
  };
}

/**
 * BUILD 68: Legacy Name Sync
 * Syncs coachNames[] from Build 66/67 sessions to the Coaching Registry
 * ONE-TIME CONSTRAINT: Only syncs if placeholder still has default name
 */
export async function syncLegacyCoachNames(session: PracticeSession): Promise<void> {
  // Exit early if no legacy names to sync
  if (!session.coachNames || session.coachNames.length === 0) {
    return;
  }

  const staff = await loadCoachingStaff();
  let hasChanges = false;

  for (let i = 0; i < session.coachNames.length && i < 4; i++) {
    const legacyName = session.coachNames[i];
    const coachId = INDEX_TO_COACH_ID[i];

    // Skip empty/null legacy names
    if (!legacyName || legacyName.trim() === '') continue;

    // Find the coach in the registry
    const coach = staff.coaches.find(c => c.id === coachId);
    if (!coach) continue;

    // ONE-TIME CONSTRAINT: Only sync if placeholder still has default name
    if (coach.name === DEFAULT_PLACEHOLDER_NAMES[coachId]) {
      coach.name = legacyName.trim();
      hasChanges = true;
    }
  }

  // Persist only if we made changes
  if (hasChanges) {
    await saveCoachingStaff(staff);
  }
}

/**
 * Load a practice session, migrating to timeline if needed
 * Orchestrates both migration and legacy name sync
 */
export async function loadPracticeSession(sessionJson: string): Promise<PracticeSession | null> {
  try {
    const session = JSON.parse(sessionJson) as PracticeSession;

    // Step 1: Migrate to timeline if missing
    if (session.stationLayout && !session.timeline) {
      session.timeline = migrateToTimeline(session);
    }

    // Step 2: Sync legacy coach names to registry (one-time)
    await syncLegacyCoachNames(session);

    return session;
  } catch (error) {
    if (__DEV__) {
      console.error('Failed to load practice session:', error);
    }
    return null;
  }
}

/**
 * Ensure a session has a timeline (for runtime use)
 * Synchronous version - does NOT sync legacy names
 */
export function ensureTimeline(session: PracticeSession): PracticeSession {
  if (!session.timeline) {
    session.timeline = migrateToTimeline(session);
  }
  return session;
}

/**
 * Ensure a session has a timeline AND sync legacy names
 * Async version - full migration + sync
 */
export async function ensureTimelineWithSync(session: PracticeSession): Promise<PracticeSession> {
  if (!session.timeline) {
    session.timeline = migrateToTimeline(session);
  }
  await syncLegacyCoachNames(session);
  return session;
}
