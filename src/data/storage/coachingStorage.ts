/**
 * BUILD 68: Coaching Staff Storage
 * Smart Placeholders with pre-set specialties
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Coach, CoachingStaff, CoachSpecialty, DEFAULT_COACH_IDS } from '../types/coach';

const COACHING_STORAGE_KEY = '@diamondscript/coachingStaff';

/**
 * Create default coaching staff with Smart Placeholders
 * Pre-set specialties for zero-config experience
 */
export function createDefaultCoachingStaff(): CoachingStaff {
  const now = Date.now();

  const coaches: Coach[] = [
    {
      id: DEFAULT_COACH_IDS.HEAD_COACH,
      name: 'Head Coach',
      role: 'head',
      specialties: ['hitting', 'fielding', 'pitching', 'baserunning'],
      createdAt: now,
      isActive: true,
    },
    {
      id: DEFAULT_COACH_IDS.ASSISTANT_1,
      name: 'Assistant 1',
      role: 'assistant',
      specialties: ['hitting'],
      placeholderIndex: 1,
      createdAt: now,
      isActive: true,
    },
    {
      id: DEFAULT_COACH_IDS.ASSISTANT_2,
      name: 'Assistant 2',
      role: 'assistant',
      specialties: ['infield', 'outfield', 'fielding'],
      placeholderIndex: 2,
      createdAt: now,
      isActive: true,
    },
    {
      id: DEFAULT_COACH_IDS.ASSISTANT_3,
      name: 'Assistant 3',
      role: 'assistant',
      specialties: ['pitching', 'catching'],
      placeholderIndex: 3,
      createdAt: now,
      isActive: true,
    },
  ];

  return {
    coaches,
    headCoachId: DEFAULT_COACH_IDS.HEAD_COACH,
    lastModified: now,
  };
}

/**
 * Load coaching staff from AsyncStorage
 */
export async function loadCoachingStaff(): Promise<CoachingStaff> {
  try {
    const raw = await AsyncStorage.getItem(COACHING_STORAGE_KEY);
    if (raw) {
      const staff = JSON.parse(raw) as CoachingStaff;
      // Validate structure
      if (staff.coaches && Array.isArray(staff.coaches) && staff.headCoachId) {
        return staff;
      }
    }
  } catch (error) {
    if (__DEV__) {
      console.error('Failed to load coaching staff:', error);
    }
  }

  // Return default staff if nothing persisted
  return createDefaultCoachingStaff();
}

/**
 * Save coaching staff to AsyncStorage
 */
export async function saveCoachingStaff(staff: CoachingStaff): Promise<void> {
  try {
    staff.lastModified = Date.now();
    await AsyncStorage.setItem(COACHING_STORAGE_KEY, JSON.stringify(staff));
  } catch (error) {
    if (__DEV__) {
      console.error('Failed to save coaching staff:', error);
    }
  }
}

/**
 * Update a coach's name
 */
export async function updateCoachName(coachId: string, newName: string): Promise<CoachingStaff> {
  const staff = await loadCoachingStaff();
  const coach = staff.coaches.find(c => c.id === coachId);
  if (coach) {
    coach.name = newName;
    await saveCoachingStaff(staff);
  }
  return staff;
}

/**
 * Update a coach's specialties
 */
export async function updateCoachSpecialties(
  coachId: string,
  specialties: CoachSpecialty[]
): Promise<CoachingStaff> {
  const staff = await loadCoachingStaff();
  const coach = staff.coaches.find(c => c.id === coachId);
  if (coach) {
    coach.specialties = specialties;
    await saveCoachingStaff(staff);
  }
  return staff;
}

/**
 * Toggle a coach's active status
 */
export async function toggleCoachActive(coachId: string): Promise<CoachingStaff> {
  const staff = await loadCoachingStaff();
  const coach = staff.coaches.find(c => c.id === coachId);
  if (coach && coach.role !== 'head') {
    coach.isActive = !coach.isActive;
    await saveCoachingStaff(staff);
  }
  return staff;
}

/**
 * Get a coach by ID
 */
export function getCoachById(staff: CoachingStaff, coachId: string): Coach | undefined {
  return staff.coaches.find(c => c.id === coachId);
}

/**
 * Get active assistants only
 */
export function getActiveAssistants(staff: CoachingStaff): Coach[] {
  return staff.coaches.filter(c => c.role === 'assistant' && c.isActive);
}

/**
 * BUILD 68: Add a new assistant coach
 * Returns updated staff with new assistant
 */
export async function addAssistantCoach(name: string, specialties: CoachSpecialty[] = []): Promise<CoachingStaff> {
  const staff = await loadCoachingStaff();

  // Find next available placeholder index
  const existingIndexes = staff.coaches
    .filter(c => c.role === 'assistant' && c.placeholderIndex)
    .map(c => c.placeholderIndex!);
  let nextIndex = 1;
  while (existingIndexes.includes(nextIndex)) {
    nextIndex++;
  }

  const newCoach: Coach = {
    id: `assistant-${Date.now()}-${nextIndex}`,
    name: name || `Assistant ${nextIndex}`,
    role: 'assistant',
    specialties: specialties.length > 0 ? specialties : [],
    placeholderIndex: nextIndex,
    createdAt: Date.now(),
    isActive: true,
  };

  staff.coaches.push(newCoach);
  await saveCoachingStaff(staff);
  return staff;
}

/**
 * BUILD 68: Delete an assistant coach (cannot delete Head Coach)
 * Returns updated staff without the deleted coach
 */
export async function deleteCoach(coachId: string): Promise<CoachingStaff> {
  const staff = await loadCoachingStaff();

  // Cannot delete head coach
  if (coachId === staff.headCoachId) {
    return staff;
  }

  // Remove the coach
  staff.coaches = staff.coaches.filter(c => c.id !== coachId);
  await saveCoachingStaff(staff);
  return staff;
}
