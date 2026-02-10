import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DrillCategory } from '../src/data/types';

const STARRED_KEY = '@diamondscript/starredDrills';
const CUSTOM_DRILLS_KEY = '@diamondscript/customDrills';

export interface CustomDrill {
  id: string;
  name: string;
  description: string;
  category: DrillCategory;
  equipment: string[];
  createdAt: number;
}

interface DrillsContextValue {
  starredDrills: Set<string>;
  toggleStar: (drillId: string) => void;
  customDrills: CustomDrill[];
  addCustomDrill: (name: string, description: string, category: DrillCategory, equipment: string[]) => void;
  deleteCustomDrill: (id: string) => void;
}

const DrillsContext = createContext<DrillsContextValue | null>(null);

export function DrillsProvider({ children }: { children: React.ReactNode }) {
  const [starredDrills, setStarredDrills] = useState<Set<string>>(new Set());
  const [customDrills, setCustomDrills] = useState<CustomDrill[]>([]);

  // Load persisted starred drills on mount
  useEffect(() => {
    let mounted = true;

    AsyncStorage.getItem(STARRED_KEY)
      .then((raw) => {
        if (!mounted) return;
        if (raw) {
          try {
            setStarredDrills(new Set(JSON.parse(raw)));
          } catch {
            // Corrupted — start with empty set
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
            setCustomDrills(JSON.parse(raw));
          } catch {
            // Corrupted — start empty
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
      AsyncStorage.setItem(STARRED_KEY, JSON.stringify([...next]));
      return next;
    });
  }, []);

  const addCustomDrill = useCallback((name: string, description: string, category: DrillCategory, equipment: string[]) => {
    setCustomDrills((prev) => {
      const next = [...prev, { id: Date.now().toString(), name, description, category, equipment, createdAt: Date.now() }];
      AsyncStorage.setItem(CUSTOM_DRILLS_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const deleteCustomDrill = useCallback((id: string) => {
    setCustomDrills((prev) => {
      const next = prev.filter((d) => d.id !== id);
      AsyncStorage.setItem(CUSTOM_DRILLS_KEY, JSON.stringify(next));
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
