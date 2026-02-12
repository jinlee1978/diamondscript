import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DrillCategory } from '../src/data/types';

// Generate cryptographically strong random ID (React Native compatible)
function generateUniqueId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}${Math.random().toString(36).substring(2, 15)}`;
}

const STARRED_KEY = '@diamondscript/starredDrills';
const CUSTOM_DRILLS_KEY = '@diamondscript/customDrills';
const BUILD_VERSION_KEY = '@diamondscript/buildVersion';
const CURRENT_BUILD = 56;

export interface CustomDrill {
  id: string;
  name: string;
  description: string;
  category: DrillCategory;
  equipment: string[];
  createdAt: number;
  isImported?: boolean;
}

interface DrillsContextValue {
  starredDrills: Set<string>;
  toggleStar: (drillId: string) => void;
  customDrills: CustomDrill[];
  addCustomDrill: (name: string, description: string, category: DrillCategory, equipment: string[]) => void;
  deleteCustomDrill: (id: string) => void;
  importDrill: (name: string, description: string, category: DrillCategory, equipment: string[]) => void;
}

const DrillsContext = createContext<DrillsContextValue | null>(null);

export function DrillsProvider({ children }: { children: React.ReactNode }) {
  const [starredDrills, setStarredDrills] = useState<Set<string>>(new Set());
  const [customDrills, setCustomDrills] = useState<CustomDrill[]>([]);

  // BUILD 38: One-time wipe to clear corrupted data from previous builds
  useEffect(() => {
    AsyncStorage.getItem(BUILD_VERSION_KEY)
      .then(async (version) => {
        const lastBuild = version ? parseInt(version, 10) : 0;

        if (lastBuild < CURRENT_BUILD) {
          // First time running Build 38 - clear all drill data
          if (__DEV__) {
            console.log(`DrillsContext: Upgrading from build ${lastBuild} to ${CURRENT_BUILD} - clearing drill data`);
          }

          await AsyncStorage.multiRemove([STARRED_KEY, CUSTOM_DRILLS_KEY]);
          await AsyncStorage.setItem(BUILD_VERSION_KEY, CURRENT_BUILD.toString());

          if (__DEV__) {
            console.log('DrillsContext: Drill data wiped successfully');
          }
        }
      })
      .catch((error) => {
        if (__DEV__) {
          console.error('DrillsContext: Failed to check/update build version:', error);
        }
      });
  }, []);

  // Load persisted starred drills on mount
  useEffect(() => {
    let mounted = true;

    AsyncStorage.getItem(STARRED_KEY)
      .then((raw) => {
        if (!mounted) return;
        if (raw) {
          try {
            const parsed = JSON.parse(raw);
            setStarredDrills(new Set(parsed));
          } catch (error) {
            // BUILD 38: Enhanced JSON.parse error logging
            if (__DEV__) {
              console.error('DrillsContext: Failed to parse starred drills:', error);
            }
            // Corrupted — start with empty set
            setStarredDrills(new Set());
          }
        }
      })
      .catch(() => {});

    return () => {
      mounted = false;
    };
  }, []);

  // Load persisted custom drills on mount
  useEffect(() => {
    let mounted = true;

    AsyncStorage.getItem(CUSTOM_DRILLS_KEY)
      .then((raw) => {
        if (!mounted) return;
        if (raw) {
          try {
            const parsed = JSON.parse(raw);
            setCustomDrills(parsed);
          } catch (error) {
            // BUILD 38: Enhanced JSON.parse error logging
            if (__DEV__) {
              console.error('DrillsContext: Failed to parse custom drills:', error);
            }
            // Corrupted — start empty
            setCustomDrills([]);
          }
        }
      })
      .catch(() => {});

    return () => {
      mounted = false;
    };
  }, []);

  const toggleStar = useCallback((drillId: string) => {
    setStarredDrills((prev) => {
      const next = new Set(prev);
      if (next.has(drillId)) {
        next.delete(drillId);
      } else {
        next.add(drillId);
      }
      // BUILD 39: Fire-and-forget AsyncStorage write (non-blocking)
      try {
        AsyncStorage.setItem(STARRED_KEY, JSON.stringify([...next])).catch(() => {});
      } catch {
        // JSON.stringify failed - ignore silently
      }
      return next;
    });
  }, []);

  const addCustomDrill = useCallback((name: string, description: string, category: DrillCategory, equipment: string[]) => {
    setCustomDrills((prev) => {
      const next = [...prev, { id: generateUniqueId(), name, description, category, equipment, createdAt: Date.now() }];
      // BUILD 39: Fire-and-forget AsyncStorage write (non-blocking)
      try {
        AsyncStorage.setItem(CUSTOM_DRILLS_KEY, JSON.stringify(next)).catch(() => {});
      } catch {
        // JSON.stringify failed - ignore silently
      }
      return next;
    });
  }, []);

  const deleteCustomDrill = useCallback((id: string) => {
    setCustomDrills((prev) => {
      const next = prev.filter((d) => d.id !== id);
      // BUILD 39: Fire-and-forget AsyncStorage write (non-blocking)
      try {
        AsyncStorage.setItem(CUSTOM_DRILLS_KEY, JSON.stringify(next)).catch(() => {});
      } catch {
        // JSON.stringify failed - ignore silently
      }
      return next;
    });
  }, []);

  const importDrill = useCallback((name: string, description: string, category: DrillCategory, equipment: string[]) => {
    setCustomDrills((prev) => {
      const importedDrill: CustomDrill = {
        id: generateUniqueId(),
        name: `${name} (Shared)`,
        description,
        category,
        equipment,
        createdAt: Date.now(),
        isImported: true,
      };
      const next = [...prev, importedDrill];
      // BUILD 45: Fire-and-forget AsyncStorage write (non-blocking)
      try {
        AsyncStorage.setItem(CUSTOM_DRILLS_KEY, JSON.stringify(next)).catch(() => {});
      } catch {
        // JSON.stringify failed - ignore silently
      }
      return next;
    });
  }, []);

  return (
    <DrillsContext.Provider
      value={{
        starredDrills,
        toggleStar,
        customDrills,
        addCustomDrill,
        deleteCustomDrill,
        importDrill,
      }}
    >
      {children}
    </DrillsContext.Provider>
  );
}

export function useDrills(): DrillsContextValue {
  const ctx = useContext(DrillsContext);
  if (!ctx) throw new Error('useDrills must be used inside <DrillsProvider>');
  return ctx;
}
