import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AgeGroup, PracticeRequest, PracticeSession, DrillCategory, Drill } from '../src/data/types';
import { generatePracticeSession } from '../src/core/engine/index';
import { applyTierConstraints } from '../src/subscription/featureGate';
import { SEED_DRILL_CATALOG } from '../src/data/seedDrills';
import { useSubscription } from './SubscriptionContext';
import { useDrills, CustomDrill } from './DrillsContext';

const STORAGE_KEY = '@diamondscript/lastRequest';
const HISTORY_KEY = '@diamondscript/history';

export interface HistoryEntry {
  session: PracticeSession;
  savedAt: number;
}

// Re-export for backward compatibility
export type { CustomDrill };

interface PracticeContextValue {
  // From SubscriptionContext
  tier: 'free' | 'pro';
  upgradeToPro: () => Promise<boolean>;
  restorePurchases: () => Promise<boolean>;
  // From DrillsContext
  starredDrills: Set<string>;
  toggleStar: (drillId: string) => void;
  customDrills: CustomDrill[];
  addCustomDrill: (name: string, description: string, category: DrillCategory, equipment: string[]) => void;
  deleteCustomDrill: (id: string) => void;
  importDrill: (name: string, description: string, category: DrillCategory, equipment: string[]) => void;
  // From PracticeContext
  lastRequest: PracticeRequest | null;
  currentSession: PracticeSession | null;
  isLoading: boolean;
  generateSession: (request: PracticeRequest) => PracticeSession;
  swapDrill: (stationIndex: number, blockIndex: number, newDrill: Drill) => void;
  addDrillToSession: (newDrill: Drill) => void;
  removeDrillFromSession: (stationIndex: number, blockIndex: number) => void;
  history: HistoryEntry[];
  restoreSession: (session: PracticeSession) => void;
  deletePracticeHistory: (savedAt: number) => void;
  importPractice: (session: PracticeSession) => void;
}

const PracticeContext = createContext<PracticeContextValue | null>(null);

export function PracticeProvider({ children }: { children: React.ReactNode }) {
  // Get data from other contexts
  const subscription = useSubscription();
  const drills = useDrills();

  const [lastRequest, setLastRequest] = useState<PracticeRequest | null>(null);
  const [currentSession, setCurrentSession] = useState<PracticeSession | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load persisted request on mount
  useEffect(() => {
    let mounted = true;

    const defaultRequest: PracticeRequest = {
      ageGroup: AgeGroup.AGE_10U,
      experienceLevel: 2,
      intensity: 3,
      numDrills: 4,
      assistantCoaches: 0,
      subscriptionTier: subscription.tier,
    };

    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (!mounted) return;
        if (raw) {
          try {
            const parsed = JSON.parse(raw);
            // Update tier in loaded request to match current subscription
            setLastRequest({ ...parsed, subscriptionTier: subscription.tier });
          } catch (error) {
            // BUILD 38: Enhanced JSON.parse error logging
            if (__DEV__) {
              console.error('PracticeContext: Failed to parse last request:', error);
            }
            // Corrupted — fall back to default
            setLastRequest(defaultRequest);
          }
        } else {
          setLastRequest(defaultRequest);
        }
      })
      .catch(() => {
        if (mounted) {
          setLastRequest(defaultRequest);
        }
      })
      .finally(() => {
        if (mounted) {
          setIsLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, [subscription.tier]);

  // Load persisted history on mount
  useEffect(() => {
    let mounted = true;

    AsyncStorage.getItem(HISTORY_KEY)
      .then((raw) => {
        if (!mounted) return;
        if (raw) {
          try {
            const parsed = JSON.parse(raw);
            setHistory(parsed);
          } catch (error) {
            // BUILD 38: Enhanced JSON.parse error logging
            if (__DEV__) {
              console.error('PracticeContext: Failed to parse history:', error);
            }
            // Corrupted — start empty
            setHistory([]);
          }
        }
      })
      .catch(() => {});

    return () => {
      mounted = false;
    };
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

  const removeDrillFromSession = useCallback((stationIndex: number, blockIndex: number) => {
    setCurrentSession((prev) => {
      if (!prev) return prev;

      // Remove the drill at the specified position
      const stations = prev.stationLayout.stations.map((station, si) =>
        si !== stationIndex
          ? station
          : {
              ...station,
              drills: station.drills.filter((_, bi) => bi !== blockIndex),
            },
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

  const importPractice = useCallback((session: PracticeSession) => {
    // BUILD 51: Import shared practice - save to history and set as current
    setCurrentSession(session);

    // Save to history
    const entry: HistoryEntry = { session, savedAt: Date.now() };
    setHistory((prev) => {
      const next = [entry, ...prev];
      AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const generateSession = useCallback((request: PracticeRequest): PracticeSession => {
    // Apply tier constraints (intensity lock, station split lock, catalog filter)
    const sanitized = applyTierConstraints(request, subscription.tier);

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
  }, [subscription.tier]);

  return (
    <PracticeContext.Provider
      value={{
        // Subscription
        tier: subscription.tier,
        upgradeToPro: subscription.upgradeToPro,
        restorePurchases: subscription.restorePurchases,
        // Drills
        starredDrills: drills.starredDrills,
        toggleStar: drills.toggleStar,
        customDrills: drills.customDrills,
        addCustomDrill: drills.addCustomDrill,
        deleteCustomDrill: drills.deleteCustomDrill,
        importDrill: drills.importDrill,
        // Practice
        lastRequest,
        currentSession,
        isLoading,
        generateSession,
        swapDrill,
        addDrillToSession,
        removeDrillFromSession,
        history,
        restoreSession,
        deletePracticeHistory,
        importPractice,
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
