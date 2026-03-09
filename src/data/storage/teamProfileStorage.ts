/**
 * BUILD 100: Team Profile Storage
 *
 * AsyncStorage-backed persistence for team profiles.
 * Supports multi-team management with active team switching.
 *
 * Storage key: @diamondscript/teamProfiles
 *
 * Design:
 * - Each team profile stores its own age group, experience, intensity defaults
 * - Active team auto-fills setup and AI lab forms
 * - Coaching staff is per-team (each team can have different assistants)
 * - No server sync — everything is local-first
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { AgeGroup } from '../types/ageGroup';
import { TeamProfile, TeamProfileStore, TEAM_COLORS } from '../types/teamProfile';
import { createDefaultCoachingStaff } from './coachingStorage';

// TypeScript global
declare const __DEV__: boolean;

const TEAM_PROFILES_KEY = '@diamondscript/teamProfiles';

/** Generate a simple unique ID */
function generateId(): string {
  return `team-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
}

/**
 * Load all team profiles from AsyncStorage
 */
export async function loadTeamProfiles(): Promise<TeamProfileStore> {
  try {
    const raw = await AsyncStorage.getItem(TEAM_PROFILES_KEY);
    if (raw) {
      const store = JSON.parse(raw) as TeamProfileStore;
      if (store.profiles && Array.isArray(store.profiles)) {
        return store;
      }
    }
  } catch (error) {
    if (__DEV__) {
      console.error('Failed to load team profiles:', error);
    }
  }

  // Return empty store if nothing persisted
  return {
    profiles: [],
    activeTeamId: null,
    lastModified: Date.now(),
  };
}

/**
 * Save team profiles to AsyncStorage
 */
export async function saveTeamProfiles(store: TeamProfileStore): Promise<void> {
  try {
    store.lastModified = Date.now();
    await AsyncStorage.setItem(TEAM_PROFILES_KEY, JSON.stringify(store));
  } catch (error) {
    if (__DEV__) {
      console.error('Failed to save team profiles:', error);
    }
  }
}

/**
 * Create a new team profile
 */
export async function createTeamProfile(
  name: string,
  ageGroup: AgeGroup,
  experienceLevel: number = 2,
  intensity: number = 3,
  assistantCoaches: number = 0,
  color?: string,
): Promise<{ store: TeamProfileStore; newProfile: TeamProfile }> {
  const store = await loadTeamProfiles();
  const now = Date.now();

  // Pick next available color
  const usedColors = new Set(store.profiles.map(p => p.color));
  const selectedColor = color ?? TEAM_COLORS.find(c => !usedColors.has(c)) ?? TEAM_COLORS[0];

  const newProfile: TeamProfile = {
    id: generateId(),
    name,
    ageGroup,
    experienceLevel,
    intensity,
    assistantCoaches,
    coachingStaff: createDefaultCoachingStaff(),
    color: selectedColor,
    createdAt: now,
    lastModified: now,
  };

  store.profiles.push(newProfile);

  // If this is the first team, auto-activate it
  if (store.profiles.length === 1) {
    store.activeTeamId = newProfile.id;
  }

  await saveTeamProfiles(store);
  return { store, newProfile };
}

/**
 * Update an existing team profile
 */
export async function updateTeamProfile(
  teamId: string,
  updates: Partial<Pick<TeamProfile, 'name' | 'ageGroup' | 'experienceLevel' | 'intensity' | 'assistantCoaches' | 'color' | 'coachingStaff'>>,
): Promise<TeamProfileStore> {
  const store = await loadTeamProfiles();
  const profile = store.profiles.find(p => p.id === teamId);

  if (profile) {
    Object.assign(profile, updates, { lastModified: Date.now() });
    await saveTeamProfiles(store);
  }

  return store;
}

/**
 * Delete a team profile
 */
export async function deleteTeamProfile(teamId: string): Promise<TeamProfileStore> {
  const store = await loadTeamProfiles();
  store.profiles = store.profiles.filter(p => p.id !== teamId);

  // If deleted team was active, switch to first remaining or null
  if (store.activeTeamId === teamId) {
    store.activeTeamId = store.profiles.length > 0 ? store.profiles[0].id : null;
  }

  await saveTeamProfiles(store);
  return store;
}

/**
 * Set the active team
 */
export async function setActiveTeam(teamId: string | null): Promise<TeamProfileStore> {
  const store = await loadTeamProfiles();

  // Validate team exists
  if (teamId && !store.profiles.find(p => p.id === teamId)) {
    return store;
  }

  store.activeTeamId = teamId;
  await saveTeamProfiles(store);
  return store;
}

/**
 * Get the currently active team profile (convenience helper)
 */
export async function getActiveTeamProfile(): Promise<TeamProfile | null> {
  const store = await loadTeamProfiles();
  if (!store.activeTeamId) return null;
  return store.profiles.find(p => p.id === store.activeTeamId) ?? null;
}

/**
 * Check if onboarding is needed (no teams created yet)
 */
export async function needsOnboarding(): Promise<boolean> {
  const store = await loadTeamProfiles();
  return store.profiles.length === 0;
}
