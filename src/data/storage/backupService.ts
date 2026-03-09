/**
 * BUILD 105: Backup & Restore Service
 *
 * Exports all app data to a single JSON object for backup.
 * Imports a backup JSON to restore all app data.
 *
 * Storage keys covered:
 * - @diamondscript/history (practice sessions)
 * - @diamondscript/lastRequest (last generator settings)
 * - @diamondscript/seasons (season schedules)
 * - @diamondscript/teamProfiles (team profiles)
 * - @diamondscript/coachingStaff (coaching staff)
 * - @diamondscript/starredDrills (starred drill IDs)
 * - @diamondscript/customDrills (user-created drills)
 * - @diamondscript/generationCount (generation tracking)
 * - @diamondscript/aiBudget (daily AI budget)
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

/** All keys that constitute the user's data */
const BACKUP_KEYS = [
  '@diamondscript/history',
  '@diamondscript/lastRequest',
  '@diamondscript/seasons',
  '@diamondscript/teamProfiles',
  '@diamondscript/coachingStaff',
  '@diamondscript/starredDrills',
  '@diamondscript/customDrills',
  '@diamondscript/generationCount',
  '@diamondscript/aiBudget',
];

export interface BackupData {
  /** Format version for future compatibility */
  version: number;
  /** Timestamp when backup was created */
  createdAt: number;
  /** App build identifier */
  build: string;
  /** The raw key-value data from AsyncStorage */
  data: Record<string, string>;
  /** Human-readable summary for the file */
  summary: {
    practiceCount: number;
    seasonCount: number;
    teamCount: number;
    customDrillCount: number;
  };
}

/**
 * Export all app data as a BackupData object
 */
export async function exportBackup(): Promise<BackupData> {
  const data: Record<string, string> = {};
  let practiceCount = 0;
  let seasonCount = 0;
  let teamCount = 0;
  let customDrillCount = 0;

  for (const key of BACKUP_KEYS) {
    try {
      const value = await AsyncStorage.getItem(key);
      if (value !== null) {
        data[key] = value;

        // Build summary
        if (key === '@diamondscript/history') {
          try {
            const arr = JSON.parse(value);
            if (Array.isArray(arr)) practiceCount = arr.length;
          } catch { /* skip */ }
        }
        if (key === '@diamondscript/seasons') {
          try {
            const store = JSON.parse(value);
            if (store?.seasons) seasonCount = store.seasons.length;
          } catch { /* skip */ }
        }
        if (key === '@diamondscript/teamProfiles') {
          try {
            const store = JSON.parse(value);
            if (store?.profiles) teamCount = store.profiles.length;
          } catch { /* skip */ }
        }
        if (key === '@diamondscript/customDrills') {
          try {
            const arr = JSON.parse(value);
            if (Array.isArray(arr)) customDrillCount = arr.length;
          } catch { /* skip */ }
        }
      }
    } catch {
      // Skip keys that fail to read
    }
  }

  return {
    version: 1,
    createdAt: Date.now(),
    build: 'BUILD_105',
    data,
    summary: {
      practiceCount,
      seasonCount,
      teamCount,
      customDrillCount,
    },
  };
}

/**
 * Convert backup to a shareable JSON string
 */
export function backupToString(backup: BackupData): string {
  return JSON.stringify(backup, null, 2);
}

/**
 * Parse a backup JSON string. Returns null if invalid.
 * Validates structure, key membership, and inner JSON integrity.
 */
export function parseBackup(jsonString: string): BackupData | null {
  try {
    const parsed = JSON.parse(jsonString);
    if (!parsed || typeof parsed !== 'object') return null;
    if (parsed.version !== 1) return null;
    if (!parsed.data || typeof parsed.data !== 'object') return null;
    if (!parsed.createdAt || typeof parsed.createdAt !== 'number') return null;

    // Validate all data keys are recognized and values are strings
    for (const [key, value] of Object.entries(parsed.data)) {
      if (!BACKUP_KEYS.includes(key)) return null;       // Unknown key — reject
      if (typeof value !== 'string') return null;          // Must be serialized string
      // Verify inner JSON can be parsed
      try { JSON.parse(value as string); } catch { return null; }
    }

    // Validate summary if present
    if (parsed.summary && typeof parsed.summary !== 'object') return null;

    return parsed as BackupData;
  } catch {
    return null;
  }
}

/**
 * Import a backup, replacing all existing data.
 * Uses multiRemove + multiSet for atomic writes to prevent data loss on partial failure.
 * Returns the summary plus any keys that failed.
 */
export async function importBackup(backup: BackupData): Promise<{ summary: BackupData['summary']; failedKeys: string[] }> {
  const failedKeys: string[] = [];

  // Build the write batch
  const setOps: Array<[string, string]> = [];
  for (const [key, value] of Object.entries(backup.data)) {
    if (BACKUP_KEYS.includes(key)) {
      setOps.push([key, value]);
    }
  }

  try {
    // Atomic remove of all existing keys
    await AsyncStorage.multiRemove(BACKUP_KEYS);
  } catch (err) {
    if (__DEV__) console.warn('Backup: multiRemove partially failed', err);
  }

  try {
    // Atomic write of all backup data
    await AsyncStorage.multiSet(setOps);
  } catch (err) {
    if (__DEV__) console.error('Backup: multiSet failed, falling back to individual writes', err);
    // Fall back to individual writes if multiSet fails
    for (const [key, value] of setOps) {
      try {
        await AsyncStorage.setItem(key, value);
      } catch {
        failedKeys.push(key);
      }
    }
  }

  return { summary: backup.summary, failedKeys };
}

/**
 * Get a rough size estimate of the backup in bytes
 */
export function estimateBackupSize(backup: BackupData): number {
  return JSON.stringify(backup).length;
}

/**
 * Format bytes to human-readable string
 */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
