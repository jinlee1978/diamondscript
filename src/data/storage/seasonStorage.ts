/**
 * BUILD 101: Season Storage
 *
 * AsyncStorage-backed persistence for season schedules.
 * Supports creating seasons with date ranges and managing practice slots.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Season, SeasonStore, ScheduledPractice } from '../types/season';
import { AgeGroup } from '../types/ageGroup';

const SEASON_KEY = '@diamondscript/seasons';

function generateId(): string {
  return `season-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
}

function generatePracticeId(): string {
  return `practice-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
}

/** Load all seasons */
export async function loadSeasons(): Promise<SeasonStore> {
  try {
    const raw = await AsyncStorage.getItem(SEASON_KEY);
    if (raw) {
      const store = JSON.parse(raw) as SeasonStore;
      if (store.seasons && Array.isArray(store.seasons)) return store;
    }
  } catch { /* fall through */ }
  return { seasons: [], activeSeasonId: null, lastModified: Date.now() };
}

/** Save seasons */
async function saveSeasons(store: SeasonStore): Promise<void> {
  store.lastModified = Date.now();
  await AsyncStorage.setItem(SEASON_KEY, JSON.stringify(store));
}

/** Create a new season */
export async function createSeason(
  name: string,
  ageGroup: AgeGroup,
  startDate: string,
  endDate: string,
  teamId?: string,
): Promise<{ store: SeasonStore; newSeason: Season }> {
  const store = await loadSeasons();
  const now = Date.now();

  const newSeason: Season = {
    id: generateId(),
    name,
    teamId,
    ageGroup,
    startDate,
    endDate,
    practices: [],
    createdAt: now,
    lastModified: now,
  };

  store.seasons.push(newSeason);
  if (store.seasons.length === 1) store.activeSeasonId = newSeason.id;
  await saveSeasons(store);
  return { store, newSeason };
}

/** Delete a season */
export async function deleteSeason(seasonId: string): Promise<SeasonStore> {
  const store = await loadSeasons();
  store.seasons = store.seasons.filter(s => s.id !== seasonId);
  if (store.activeSeasonId === seasonId) {
    store.activeSeasonId = store.seasons.length > 0 ? store.seasons[0].id : null;
  }
  await saveSeasons(store);
  return store;
}

/** Set active season */
export async function setActiveSeason(seasonId: string | null): Promise<SeasonStore> {
  const store = await loadSeasons();
  if (seasonId && !store.seasons.find(s => s.id === seasonId)) return store;
  store.activeSeasonId = seasonId;
  await saveSeasons(store);
  return store;
}

/** Add a practice slot to a season */
export async function addPracticeToSeason(
  seasonId: string,
  date: string,
  time?: string,
  location?: string,
): Promise<SeasonStore> {
  const store = await loadSeasons();
  const season = store.seasons.find(s => s.id === seasonId);
  if (!season) return store;

  season.practices.push({
    id: generatePracticeId(),
    date,
    time,
    location,
    completed: false,
  });
  season.practices.sort((a, b) => a.date.localeCompare(b.date));
  season.lastModified = Date.now();
  await saveSeasons(store);
  return store;
}

/** Remove a practice from a season */
export async function removePracticeFromSeason(
  seasonId: string,
  practiceId: string,
): Promise<SeasonStore> {
  const store = await loadSeasons();
  const season = store.seasons.find(s => s.id === seasonId);
  if (!season) return store;
  season.practices = season.practices.filter(p => p.id !== practiceId);
  season.lastModified = Date.now();
  await saveSeasons(store);
  return store;
}

/** Toggle practice completion */
export async function togglePracticeComplete(
  seasonId: string,
  practiceId: string,
): Promise<SeasonStore> {
  const store = await loadSeasons();
  const season = store.seasons.find(s => s.id === seasonId);
  if (!season) return store;
  const practice = season.practices.find(p => p.id === practiceId);
  if (practice) {
    practice.completed = !practice.completed;
    season.lastModified = Date.now();
    await saveSeasons(store);
  }
  return store;
}

/** Update practice notes */
export async function updatePracticeNotes(
  seasonId: string,
  practiceId: string,
  notes: string,
): Promise<SeasonStore> {
  const store = await loadSeasons();
  const season = store.seasons.find(s => s.id === seasonId);
  if (!season) return store;
  const practice = season.practices.find(p => p.id === practiceId);
  if (practice) {
    practice.notes = notes;
    season.lastModified = Date.now();
    await saveSeasons(store);
  }
  return store;
}

/** Link a generated plan to a practice slot */
export async function linkPlanToPractice(
  seasonId: string,
  practiceId: string,
  historyId: number,
): Promise<SeasonStore> {
  const store = await loadSeasons();
  const season = store.seasons.find(s => s.id === seasonId);
  if (!season) return store;
  const practice = season.practices.find(p => p.id === practiceId);
  if (practice) {
    // Pass 0 or falsy to unlink
    practice.linkedHistoryId = historyId || undefined;
    season.lastModified = Date.now();
    await saveSeasons(store);
  }
  return store;
}

/** Get the active season */
export async function getActiveSeason(): Promise<Season | null> {
  const store = await loadSeasons();
  if (!store.activeSeasonId) return null;
  return store.seasons.find(s => s.id === store.activeSeasonId) ?? null;
}
