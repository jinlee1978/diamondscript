import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AgeGroup, PracticeRequest, PracticeSession, DrillCategory, Drill } from '../src/data/types';
import { generatePracticeSession } from '../src/core/engine/index';
import { applyTierConstraints } from '../src/subscription/featureGate';
import { SubscriptionTier } from '../src/subscription/tiers';
import { SEED_DRILL_CATALOG } from '../src/data/seedDrills';
import { getSubscriptionInfo, initiateUpgrade, restorePurchases } from '../src/subscription/service';

const STORAGE_KEY = '@diamondscript/lastRequest';
const STARRED_KEY = '@diamondscript/starredDrills';
const CUSTOM_DRILLS_KEY = '@diamondscript/customDrills';
const HISTORY_KEY = '@diamondscript/history';

export interface CustomDrill {
  id: string;
  name: string;
  description: string;
  category: DrillCategory;
  equipment: string[];
  createdAt: number;
}

export interface HistoryEntry {
  session: PracticeSession;
  savedAt: number;
}

interface PracticeContextValue {
  tier: 'free' | 'pro';
  lastRequest: PracticeRequest | null;
  currentSession: PracticeSession | null;
  isLoading: boolean;
  generateSession: (request: PracticeRequest) => PracticeSession;
  starredDrills: Set<string>;
  toggleStar: (drillId: string) => void;
  customDrills: CustomDrill[];
  addCustomDrill: (name: string, description: string, category: DrillCategory, equipment: string[]) => void;
  deleteCustomDrill: (id: string) => void;
  swapDrill: (stationIndex: number, blockIndex: number, newDrill: Drill) => void;
  addDrillToSession: (newDrill: Drill) => void;
  history: HistoryEntry[];
  restoreSession: (session: PracticeSession) => void;
  deletePracticeHistory: (savedAt: number) => void;
  upgradeToPro: () => Promise<boolean>;
  restorePurchases: () => Promise<boolean>;
}

const PracticeContext = createContext<PracticeContextValue | null>(null);

export function PracticeProvider({ children }: { children: React.ReactNode }) {
  const [tier, setTier] = useState<SubscriptionTier>('free');
  const [lastRequest, setLastRequest] = useState<PracticeRequest | null>(null);
  const [currentSession, setCurrentSession] = useState<PracticeSession | null>(null);
  const [starredDrills, setStarredDrills] = useState<Set<string>>(new Set());
  const [customDrills, setCustomDrills] = useState<CustomDrill[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load subscription tier on mount
  useEffect(() => {
    getSubscriptionInfo().then((info) => {
      setTier(info.tier);
    });
  }, []);

  // Load persisted request on mount
  useEffect(() => {
    const defaultRequest: PracticeRequest = {
      ageGroup: AgeGroup.AGE_10U,
      experienceLevel: 2,
      intensity: 3,
      numDrills: 4,
      assistantCoaches: 0,
      subscriptionTier: tier,
    };

    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (raw) {
          try {
            const parsed = JSON.parse(raw);
            // Update tier in loaded request to match current subscription
            setLastRequest({ ...parsed, subscriptionTier: tier });
          } catch {
            // Corrupted — fall back to default
            setLastRequest(defaultRequest);
          }
        } else {
          setLastRequest(defaultRequest);
        }
      })
      .catch(() => {
        setLastRequest(defaultRequest);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [tier]);

  // Load persisted starred drills on mount
  useEffect(() => {
    AsyncStorage.getItem(STARRED_KEY)
      .then((raw) => {
        if (raw) {
          try {
            setStarredDrills(new Set(JSON.parse(raw)));
          } catch {
            // Corrupted — start with empty set
          }
        }
      })
      .catch(() => {});
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

  // Load persisted custom drills on mount
  useEffect(() => {
    AsyncStorage.getItem(CUSTOM_DRILLS_KEY)
      .then((raw) => {
        if (raw) {
          try {
            setCustomDrills(JSON.parse(raw));
          } catch {
            // Corrupted — start empty
          }
        }
      })
      .catch(() => {});
  }, []);

  // Load persisted history on mount
  useEffect(() => {
    AsyncStorage.getItem(HISTORY_KEY)
      .then((raw) => {
        if (raw) {
          try {
            setHistory(JSON.parse(raw));
          } catch {
            // Corrupted — start empty
          }
        }
      })
      .catch(() => {});
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

  const swapDrill = useCallback((stationIndex: number, blockIndex: number, newDrill: Drill) => {
    setCurrentSession((prev) => {
      if (!prev) return prev;
      const stations = prev.stationLayout.stations.map((station, si) =>
        si !== stationIndex
          ? station
          : {
              ...station,
              drills: station.drills.map((block, bi) =>
                bi !== blockIndex ? block : { ...block, drill: newDrill },
              ),
            },
      );
      return { ...prev, stationLayout: { ...prev.stationLayout, stations } };
    });
  }, []);

  const addDrillToSession = useCallback((newDrill: Drill) => {
    setCurrentSession((prev) => {
      if (!prev || prev.stationLayout.stations.length === 0 || prev.stationLayout.stations[0].drills.length === 0) return prev;

      // Balance: append to the station with the fewest drills
      let targetIdx = 0;
      for (let i = 1; i < prev.stationLayout.stations.length; i++) {
        if (prev.stationLayout.stations[i].drills.length < prev.stationLayout.stations[targetIdx].drills.length) {
          targetIdx = i;
        }
      }

      // Match time and base reps from any existing block (engine distributes uniformly)
      const refBlock = prev.stationLayout.stations[0].drills[0];
      const newBlock = {
        drill: newDrill,
        timeMinutes: refBlock.timeMinutes,
        reps: refBlock.reps,
        bonusReps: 0,
        openTimeMinutes: 0,
      };

      const stations = prev.stationLayout.stations.map((station, i) =>
        i !== targetIdx ? station : { ...station, drills: [...station.drills, newBlock] },
      );

      // Recompute total: warmup + longest-station wall-clock + cooldown
      const { transitionTimeMinutes } = prev.stationLayout;
      const maxStationTime = Math.max(
        ...stations.map((s) => {
          const drillTime = s.drills.reduce((sum, b) => sum + b.timeMinutes, 0);
          return drillTime + Math.max(0, s.drills.length - 1) * transitionTimeMinutes;
        }),
      );
      const totalWallClockMinutes = prev.warmupMinutes + maxStationTime + prev.cooldownMinutes;

      return { ...prev, stationLayout: { ...prev.stationLayout, stations, totalWallClockMinutes } };
    });
  }, []);

  const restoreSession = useCallback((session: PracticeSession) => {
    setCurrentSession(session);
  }, []);

  const deletePracticeHistory = useCallback((savedAt: number) => {
    setHistory((prev) => {
      const next = prev.filter((entry) => entry.savedAt !== savedAt);
      AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const generateSession = useCallback((request: PracticeRequest): PracticeSession => {
    // Apply tier constraints (intensity lock, station split lock, catalog filter)
    const sanitized = applyTierConstraints(request, tier);

    // Run the engine
    const session = generatePracticeSession(sanitized, SEED_DRILL_CATALOG);

    // Persist the sanitized request for next time
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(sanitized));
    setLastRequest(sanitized);
    setCurrentSession(session);

    // Save to history
    const entry: HistoryEntry = { session, savedAt: Date.now() };
    setHistory((prev) => {
      const next = [entry, ...prev];
      AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(next));
      return next;
    });

    return session;
  }, [tier]);

  const upgradeToPro = useCallback(async (): Promise<boolean> => {
    const success = await initiateUpgrade();
    if (success) {
      // Reload subscription info to update tier
      const info = await getSubscriptionInfo();
      setTier(info.tier);
    }
    return success;
  }, []);

  const handleRestorePurchases = useCallback(async (): Promise<boolean> => {
    const success = await restorePurchases();
    if (success) {
      // Reload subscription info to update tier
      const info = await getSubscriptionInfo();
      setTier(info.tier);
    }
    return success;
  }, []);

  return (
    <PracticeContext.Provider
      value={{
        tier,
        lastRequest,
        currentSession,
        isLoading,
        generateSession,
        starredDrills,
        toggleStar,
        customDrills,
        addCustomDrill,
        deleteCustomDrill,
        swapDrill,
        addDrillToSession,
        history,
        restoreSession,
        deletePracticeHistory,
        upgradeToPro,
        restorePurchases: handleRestorePurchases,
      }}
    >
      {children}
    </PracticeContext.Provider>
  );
}

export function usePractice(): PracticeContextValue {
  const ctx = useContext(PracticeContext);
  if (!ctx) throw new Error('usePractice must be used inside <PracticeProvider>');
  return ctx;
}
