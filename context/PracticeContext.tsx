/**
 * BUILD 86: PracticeContext - Unified Timeline State Manager
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * KEY INVARIANTS:
 * 1. FLAT TIMELINE: All sessions use timeline.drills[], never nested stationLayout
 *    - generateSession() calls flattenStationsToTimeline() immediately
 *    - restoreSession() and importPractice() ensure timeline exists
 *
 * 2. MANUAL LOCKDOWN: manuallyAssignDrillToCoach() sets assignmentSource: 'manual'
 *    - Manual assignments are NEVER overridden by auto assignment
 *    - Persisted through history storage and session restore
 *
 * 3. LOAD BALANCED: Auto assignment respects HEAD_COACH_PENALTY and LOAD_PENALTY
 *    - Assistants with matching specialties win over Head Coach
 *    - Drills distributed evenly across active coaches
 *
 * 4. SOURCE AGNOSTIC: Works identically for 'engine', 'ai', and 'manual' plans
 *
 * BUILD 86: SECURITY-FIRST ARCHITECTURE (Tiger Team Audit Fixes)
 * ══════════════════════════════════════════════════════════════
 * - SINGLE UNIFIED EFFECT for tier management (eliminates race conditions)
 * - Request ID pattern prevents stale async responses from updating state
 * - isActive flag prevents stale listener callbacks
 * - Refs for callbacks avoid effect re-registration
 * - NO optimistic updates - tier changes only via verified CustomerInfo
 * - NEVER fail open: tier starts FREE, errors keep FREE
 * - History Gate: Free users limited to 2 saved practices
 * - AI Gate: Handled in AI tab (requires Pro subscription)
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState, AppStateStatus } from 'react-native';
// BUILD 86: Real RevenueCat SDK
import { CustomerInfo } from 'react-native-purchases';
import { AgeGroup, PracticeRequest, PracticeSession, DrillCategory, Drill, DrillBlock } from '../src/data/types';
import { generatePracticeSession } from '../src/core/engine/index';
import { applyTierConstraints } from '../src/subscription/featureGate';
import { SEED_DRILL_CATALOG } from '../src/data/seedDrills';
import { SubscriptionTier } from '../src/subscription/tiers';
import { getSubscriptionInfo, initiateUpgrade, restorePurchases, addCustomerInfoListener, invalidateCustomerInfoCache, initializeRevenueCat, UpgradeResult, RestoreResult } from '../src/subscription/service';
import { useDrills, CustomDrill } from './DrillsContext';
import { captureException } from '../src/config/sentry';
import { flattenStationsToTimeline, manuallyAssignDrill as manuallyAssignDrillUtil } from '../src/logic/coachMatcher';
// BUILD 101: Generation tracking for monetization
import { incrementGenerationCount, canFreeUserGenerate, FREE_GENERATION_LIMIT } from '../src/data/storage/generationTracker';

const STORAGE_KEY = '@diamondscript/lastRequest';
const HISTORY_KEY = '@diamondscript/history';

// BUILD 101: Free tier history limit raised (was 2, now 5 to match UI display)
const FREE_HISTORY_LIMIT = 5;

export interface HistoryEntry {
  session: PracticeSession;
  savedAt: number;
  coachNote?: string; // BUILD 74: Post-practice notes for future reference
}

/**
 * BUILD 72: Non-blocking background save helper
 * Persists session changes to history without blocking the UI
 */
const debouncedSave = (() => {
  let timeoutId: NodeJS.Timeout | null = null;
  return (historyArray: HistoryEntry[]) => {
    if (timeoutId) clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(historyArray)).catch((err) => {
        if (__DEV__) console.error('syncSessionToHistory: AsyncStorage error', err);
      });
    }, 300); // Debounce 300ms to batch rapid changes
  };
})();

// Re-export for backward compatibility
export type { CustomDrill };

// BUILD 81: Paywall trigger types
export type PaywallTrigger = 'ai_generator' | 'history_limit' | 'feature';

interface PracticeContextValue {
  // From SubscriptionContext
  tier: 'free' | 'pro';
  upgradeToPro: () => Promise<UpgradeResult>;
  restorePurchases: () => Promise<RestoreResult>;
  // BUILD 81: Paywall state
  showPaywall: boolean;
  paywallTrigger: PaywallTrigger | null;
  openPaywall: (trigger: PaywallTrigger) => void;
  closePaywall: () => void;
  canSaveMorePractices: () => boolean;
  // From DrillsContext
  starredDrills: Set<string>;
  toggleStar: (drillId: string) => void;
  /** BUILD 70: Star with drill data - auto-saves AI-generated drills */
  toggleStarWithDrill: (drill: Drill) => void;
  customDrills: CustomDrill[];
  addCustomDrill: (name: string, description: string, category: DrillCategory, equipment: string[]) => void;
  deleteCustomDrill: (id: string) => void;
  importDrill: (name: string, description: string, category: DrillCategory, equipment: string[]) => void;
  // From PracticeContext
  lastRequest: PracticeRequest | null;
  currentSession: PracticeSession | null;
  isLoading: boolean;
  generateSession: (request: PracticeRequest, coachNames?: string[]) => PracticeSession | null;
  swapDrill: (stationIndex: number, blockIndex: number, newDrill: Drill) => void;
  addDrillToSession: (newDrill: Drill) => void;
  removeDrillFromSession: (stationIndex: number, blockIndex: number) => void;
  reorderDrillsInStation: (stationIndex: number, newDrillOrder: DrillBlock[]) => void;
  // BUILD 70: Flat Timeline reordering - moves drills across coach boundaries
  reorderDrillInTimeline: (drillIndex: number, direction: 'up' | 'down') => void;
  // BUILD 70: Manual coach assignment - locks drill to a coach
  manuallyAssignDrillToCoach: (drillIndex: number, coachId: string) => void;
  resetToEngineOrder: () => void;
  history: HistoryEntry[];
  restoreSession: (session: PracticeSession) => void;
  updateCurrentSession: (session: PracticeSession) => void; // BUILD 68: Updates session and persists to history
  deletePracticeHistory: (savedAt: number) => void;
  importPractice: (session: PracticeSession) => boolean;
  // BUILD 60: AI Cooldown (global state persists across tab navigation)
  aiCooldownUntil: number;
  setAiCooldownUntil: (timestamp: number) => void;
  // BUILD 74: Coach notes for post-practice reflection
  updateCoachNote: (savedAt: number, note: string) => void;
}

const PracticeContext = createContext<PracticeContextValue | null>(null);

export function PracticeProvider({ children }: { children: React.ReactNode }) {
  const drills = useDrills();

  // BUILD 81: RevenueCat-backed tier state
  const [tier, setTier] = useState<SubscriptionTier>(SubscriptionTier.FREE);
  const [lastRequest, setLastRequest] = useState<PracticeRequest | null>(null);
  const [currentSession, setCurrentSession] = useState<PracticeSession | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [aiCooldownUntil, setAiCooldownUntil] = useState<number>(0);

  // BUILD 81: Paywall state
  const [showPaywall, setShowPaywall] = useState(false);
  const [paywallTrigger, setPaywallTrigger] = useState<PaywallTrigger | null>(null);

  const openPaywall = useCallback((trigger: PaywallTrigger) => {
    setPaywallTrigger(trigger);
    setShowPaywall(true);
  }, []);

  const closePaywall = useCallback(() => {
    setShowPaywall(false);
    setPaywallTrigger(null);
  }, []);

  // BUILD 81: Check if free user can save more practices
  const canSaveMorePractices = useCallback(() => {
    if (tier === SubscriptionTier.PRO) return true;
    return history.length < FREE_HISTORY_LIMIT;
  }, [tier, history.length]);

  /**
   * BUILD 72: syncSessionToHistory - Non-blocking background save
   * Called by all mutations to persist changes to history automatically
   * Updates the FIRST entry in history (most recent session being edited)
   */
  const syncSessionToHistory = useCallback((updatedSession: PracticeSession) => {
    setHistory((prevHistory) => {
      if (prevHistory.length === 0) return prevHistory;

      // Update the first (most recent) entry with the updated session
      const updatedHistory = [
        { ...prevHistory[0], session: updatedSession },
        ...prevHistory.slice(1),
      ];

      // Non-blocking background save with debouncing
      debouncedSave(updatedHistory);

      return updatedHistory;
    });
  }, []);

  /**
   * BUILD 86: UNIFIED TIER MANAGEMENT EFFECT
   * =========================================
   * Tiger Team Security Audit Fixes:
   *
   * 1. SINGLE EFFECT - Eliminates race conditions between multiple effects
   * 2. REQUEST ID PATTERN - Prevents stale async responses from updating state
   * 3. isActive FLAG - Prevents stale listener callbacks after unmount
   * 4. REF FOR CALLBACKS - closePaywall accessed via ref to avoid re-registration
   * 5. NO OPTIMISTIC UPDATES - Tier only changes via verified RevenueCat data
   *
   * Flow:
   * - Initialize RevenueCat first
   * - Fetch initial tier
   * - Register CustomerInfo listener (with isActive guard)
   * - Handle AppState changes (with request ID tracking)
   * - Cleanup everything on unmount
   */

  // Ref for closePaywall to avoid effect re-registration
  const closePaywallRef = useRef(closePaywall);
  useEffect(() => {
    closePaywallRef.current = closePaywall;
  }, [closePaywall]);

  // Ref to track current AppState for transition detection
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  useEffect(() => {
    let isActive = true; // Guard against stale callbacks
    let requestId = 0;   // Track which async request is current

    // Helper: Verify tier with request ID tracking
    const verifyTier = async () => {
      const thisRequest = ++requestId;

      try {
        // Ensure SDK is ready
        await initializeRevenueCat();

        const info = await getSubscriptionInfo();

        // Only update if this is still the latest request AND we're still mounted
        if (isActive && thisRequest === requestId) {
          setTier(info.tier);
        }
      } catch (error) {
        // SECURITY: Any error forces FREE tier
        if (isActive && thisRequest === requestId) {
          setTier(SubscriptionTier.FREE);
          captureException(error as Error, { context: 'tier_verification' });
        }
      }
    };

    // Initial tier verification
    verifyTier();

    // CustomerInfo listener with isActive guard
    const onCustomerInfoUpdate = (info: CustomerInfo) => {
      if (!isActive) return; // Ignore stale callbacks

      const isPro = !!info.entitlements.active['pro'];
      setTier(isPro ? SubscriptionTier.PRO : SubscriptionTier.FREE);

      // Close paywall if user just upgraded (use ref to avoid deps)
      if (isPro) {
        closePaywallRef.current();
      }
    };

    // Register listener (cleanup function returned but SDK doesn't support removal)
    const cleanupListener = addCustomerInfoListener(onCustomerInfoUpdate);

    // AppState listener for foreground/background transitions
    const appStateListener = AppState.addEventListener('change', (nextState) => {
      if (!isActive) return;

      const prevState = appStateRef.current;
      appStateRef.current = nextState;

      // Coming to foreground from background/inactive
      if (prevState.match(/inactive|background/) && nextState === 'active') {
        // Invalidate cache first, then verify fresh
        invalidateCustomerInfoCache();
        verifyTier();
      } else if (nextState === 'background') {
        // BUILD 86: GHOST KILLER - Invalidate cache when going to background
        invalidateCustomerInfoCache();
      }
    });

    // CLEANUP: Mark as inactive to ignore stale callbacks
    return () => {
      isActive = false;
      cleanupListener();
      appStateListener.remove();
    };
  }, []); // Empty deps - register ONCE, use refs for dynamic values

  // FIX: Security Criterion 2 - Load persisted request WITHOUT tier (tier from RC only)
  useEffect(() => {
    const defaultRequest: PracticeRequest = {
      ageGroup: AgeGroup.KID_PITCH,
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
            // FIX: Security Criterion 2 - Strip persisted tier, use live RC tier
            const { subscriptionTier: _, ...requestWithoutTier } = parsed;
            setLastRequest({ ...requestWithoutTier, subscriptionTier: tier });
          } catch (error) {
            if (__DEV__) {
              console.error('PracticeContext: Failed to parse last request:', error);
            }
            setLastRequest(defaultRequest);
          }
        } else {
          setLastRequest(defaultRequest);
        }
      })
      .catch(() => setLastRequest(defaultRequest))
      .finally(() => setIsLoading(false));
  }, [tier]);

  // Load persisted history on mount
  useEffect(() => {
    let mounted = true;

    AsyncStorage.getItem(HISTORY_KEY)
      .then((raw) => {
        if (!mounted) return;
        if (raw) {
          try {
            const parsed = JSON.parse(raw);
            // BUILD 63: Migrate old sessions to add missing 'source' field
            const migratedHistory = parsed.map((entry: HistoryEntry) => ({
              ...entry,
              session: {
                ...entry.session,
                source: entry.session.source ?? 'manual', // Default old sessions to 'manual'
              },
            }));
            setHistory(migratedHistory);
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
      const updatedSession: PracticeSession = { ...prev, stationLayout: { ...prev.stationLayout, stations } };

      // BUILD 72: Non-blocking background save
      syncSessionToHistory(updatedSession);
      return updatedSession;
    });
  }, [syncSessionToHistory]);

  const addDrillToSession = useCallback((newDrill: Drill) => {
    setCurrentSession((prev) => {
      if (!prev) return prev;

      let updatedSession: PracticeSession;

      // BUILD 70: Add to timeline (flat structure)
      if (prev.timeline?.drills) {
        const refBlock = prev.timeline.drills[0];
        const newBlock: DrillBlock = {
          id: `drill-${Date.now()}`,
          drill: newDrill,
          timeMinutes: refBlock?.timeMinutes || 5,
          reps: refBlock?.reps || 10,
          bonusReps: 0,
          openTimeMinutes: 0,
          order: prev.timeline.drills.length,
          assignmentSource: 'auto',
        };

        const newDrills = [...prev.timeline.drills, newBlock];

        updatedSession = {
          ...prev,
          timeline: {
            ...prev.timeline,
            drills: newDrills,
          },
        };

        // BUILD 72: Non-blocking background save
        syncSessionToHistory(updatedSession);
        return updatedSession;
      }

      // Fallback to station-based (legacy)
      if (prev.stationLayout.stations.length === 0 || prev.stationLayout.stations[0].drills.length === 0) return prev;

      let targetIdx = 0;
      for (let i = 1; i < prev.stationLayout.stations.length; i++) {
        if (prev.stationLayout.stations[i].drills.length < prev.stationLayout.stations[targetIdx].drills.length) {
          targetIdx = i;
        }
      }

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

      const { transitionTimeMinutes } = prev.stationLayout;
      const maxStationTime = Math.max(
        ...stations.map((s) => {
          const drillTime = s.drills.reduce((sum, b) => sum + b.timeMinutes, 0);
          return drillTime + Math.max(0, s.drills.length - 1) * transitionTimeMinutes;
        }),
      );
      const totalWallClockMinutes = prev.warmupMinutes + maxStationTime + prev.cooldownMinutes;

      updatedSession = { ...prev, stationLayout: { ...prev.stationLayout, stations, totalWallClockMinutes } };

      // BUILD 72: Non-blocking background save
      syncSessionToHistory(updatedSession);
      return updatedSession;
    });
  }, [syncSessionToHistory]);

  const removeDrillFromSession = useCallback((stationIndex: number, blockIndex: number) => {
    setCurrentSession((prev) => {
      if (!prev) return prev;

      let updatedSession: PracticeSession;

      // BUILD 70: Remove from timeline if using flat structure
      if (prev.timeline?.drills) {
        // blockIndex is the timeline index when using flat timeline
        const newDrills = prev.timeline.drills.filter((_, idx) => idx !== blockIndex);
        const reorderedDrills = newDrills.map((drill, idx) => ({ ...drill, order: idx }));

        updatedSession = {
          ...prev,
          timeline: {
            ...prev.timeline,
            drills: reorderedDrills,
          },
        };

        // BUILD 72: Non-blocking background save
        syncSessionToHistory(updatedSession);
        return updatedSession;
      }

      // Fallback to station-based removal
      const stations = prev.stationLayout.stations.map((station, si) =>
        si !== stationIndex
          ? station
          : {
              ...station,
              drills: station.drills.filter((_, bi) => bi !== blockIndex),
            },
      );

      const { transitionTimeMinutes } = prev.stationLayout;
      const maxStationTime = Math.max(
        ...stations.map((s) => {
          const drillTime = s.drills.reduce((sum, b) => sum + b.timeMinutes, 0);
          return drillTime + Math.max(0, s.drills.length - 1) * transitionTimeMinutes;
        }),
      );
      const totalWallClockMinutes = prev.warmupMinutes + maxStationTime + prev.cooldownMinutes;

      updatedSession = { ...prev, stationLayout: { ...prev.stationLayout, stations, totalWallClockMinutes } };

      // BUILD 72: Non-blocking background save
      syncSessionToHistory(updatedSession);
      return updatedSession;
    });
  }, [syncSessionToHistory]);

  const reorderDrillsInStation = useCallback((stationIndex: number, newDrillOrder: DrillBlock[]) => {
    setCurrentSession((prev) => {
      if (!prev) return prev;

      if (stationIndex < 0 || stationIndex >= prev.stationLayout.stations.length) {
        if (__DEV__) {
          console.warn(`reorderDrillsInStation: invalid stationIndex ${stationIndex}`);
        }
        return prev;
      }

      const totalBonus = newDrillOrder.reduce((sum, b) => sum + b.bonusReps, 0);
      const rebalanced = newDrillOrder.map((block, i) => ({
        ...block,
        bonusReps: i === newDrillOrder.length - 1 ? totalBonus : 0,
      }));

      const stations = prev.stationLayout.stations.map((station, si) =>
        si !== stationIndex ? station : { ...station, drills: rebalanced },
      );

      const updatedSession: PracticeSession = { ...prev, stationLayout: { ...prev.stationLayout, stations } };

      // BUILD 72: Non-blocking background save
      syncSessionToHistory(updatedSession);
      return updatedSession;
    });
  }, [syncSessionToHistory]);

  // BUILD 70: Flat Timeline reordering - drills can move across coach boundaries
  const reorderDrillInTimeline = useCallback((drillIndex: number, direction: 'up' | 'down') => {
    setCurrentSession((prev) => {
      if (!prev) return prev;

      // Ensure timeline exists - create from stationLayout if missing
      let drillsArray: DrillBlock[];
      if (prev.timeline?.drills && prev.timeline.drills.length > 0) {
        drillsArray = [...prev.timeline.drills];
      } else {
        // Flatten stations to timeline
        const timeline = flattenStationsToTimeline(
          prev.stationLayout.stations,
          prev.stationLayout.transitionTimeMinutes,
          prev.stationLayout.totalWallClockMinutes
        );
        drillsArray = [...timeline.drills];
      }

      const targetIndex = direction === 'up' ? drillIndex - 1 : drillIndex + 1;

      if (targetIndex < 0 || targetIndex >= drillsArray.length) {
        return prev;
      }

      // Swap the drills
      [drillsArray[drillIndex], drillsArray[targetIndex]] = [drillsArray[targetIndex], drillsArray[drillIndex]];

      // Update order fields
      const reorderedDrills = drillsArray.map((drill, idx) => ({
        ...drill,
        order: idx,
      }));

      const updatedTimeline = {
        drills: reorderedDrills,
        transitionTimeMinutes: prev.timeline?.transitionTimeMinutes || prev.stationLayout.transitionTimeMinutes,
        totalWallClockMinutes: prev.timeline?.totalWallClockMinutes || prev.stationLayout.totalWallClockMinutes,
      };

      const updatedSession: PracticeSession = {
        ...prev,
        timeline: updatedTimeline,
      };

      // BUILD 72: Non-blocking background save
      syncSessionToHistory(updatedSession);
      return updatedSession;
    });
  }, [syncSessionToHistory]);

  // BUILD 70: Manual coach assignment - LOCKS the drill to prevent auto-override
  const manuallyAssignDrillToCoach = useCallback((drillIndex: number, coachId: string) => {
    setCurrentSession((prev) => {
      if (!prev?.timeline?.drills) return prev;

      const updatedDrills = manuallyAssignDrillUtil(prev.timeline.drills, drillIndex, coachId);

      const updatedSession: PracticeSession = {
        ...prev,
        timeline: {
          ...prev.timeline,
          drills: updatedDrills,
        },
      };

      // BUILD 72: Non-blocking background save
      syncSessionToHistory(updatedSession);
      return updatedSession;
    });
  }, [syncSessionToHistory]);

  // BUILD 74: Update coach note for a history entry
  const updateCoachNote = useCallback((savedAt: number, note: string) => {
    setHistory((prevHistory) => {
      const updatedHistory = prevHistory.map((entry) =>
        entry.savedAt === savedAt ? { ...entry, coachNote: note } : entry
      );

      // Persist with debouncing to avoid excessive writes
      debouncedSave(updatedHistory);
      return updatedHistory;
    });
  }, []);

  const resetToEngineOrder = useCallback(() => {
    if (!currentSession) return;

    const fullCatalog = [
      ...SEED_DRILL_CATALOG,
      ...drills.customDrills.map((c) => ({
        id: c.id,
        name: c.name,
        description: c.description,
        complexityScore: 0,
        physicalIntensity: 0,
        category: c.category,
        ageGroupCompatibility: [],
        minPlayers: 1,
        subscriptionTier: 'free' as const,
        equipment: c.equipment,
      })),
    ];

    const freshSession = generatePracticeSession(
      currentSession.request,
      fullCatalog
    );

    // BUILD 70: Immediately flatten to timeline
    const timeline = flattenStationsToTimeline(
      freshSession.stationLayout.stations,
      freshSession.stationLayout.transitionTimeMinutes,
      freshSession.stationLayout.totalWallClockMinutes
    );

    setCurrentSession({
      ...freshSession,
      timeline,
    });
  }, [currentSession, drills.customDrills]);

  const restoreSession = useCallback((session: PracticeSession) => {
    // BUILD 70: Ensure timeline exists when restoring
    if (!session.timeline && session.stationLayout) {
      const timeline = flattenStationsToTimeline(
        session.stationLayout.stations,
        session.stationLayout.transitionTimeMinutes,
        session.stationLayout.totalWallClockMinutes
      );
      setCurrentSession({ ...session, timeline });
    } else {
      setCurrentSession(session);
    }
  }, []);

  // BUILD 68: Update current session AND persist to history
  const updateCurrentSession = useCallback((session: PracticeSession) => {
    setCurrentSession(session);

    setHistory((prev) => {
      if (prev.length === 0) return prev;

      const updatedHistory = prev.map((entry, index) => {
        if (index === 0 && entry.session.request.ageGroup === session.request.ageGroup) {
          return { ...entry, session };
        }
        return entry;
      });

      AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(updatedHistory));
      return updatedHistory;
    });
  }, []);

  const deletePracticeHistory = useCallback((savedAt: number) => {
    setHistory((prev) => {
      const next = prev.filter((entry) => entry.savedAt !== savedAt);
      AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const importPractice = useCallback((session: PracticeSession): boolean => {
    // BUILD 81: History gate - check if free user can save more practices
    if (tier === SubscriptionTier.FREE && history.length >= FREE_HISTORY_LIMIT) {
      openPaywall('history_limit');
      return false;
    }

    // BUILD 93: Sanitize imported session tier to prevent Free→Pro bypass
    // If a Free user imports a Pro session and resets to engine order,
    // the engine would otherwise use the Pro tier from the original request
    if (session.request) {
      session = { ...session, request: { ...session.request, subscriptionTier: tier } };
    }

    // BUILD 70: Ensure timeline exists when importing
    let sessionWithTimeline = session;
    if (!session.timeline && session.stationLayout) {
      const timeline = flattenStationsToTimeline(
        session.stationLayout.stations,
        session.stationLayout.transitionTimeMinutes,
        session.stationLayout.totalWallClockMinutes
      );
      sessionWithTimeline = { ...session, timeline };
    }

    setCurrentSession(sessionWithTimeline);

    const entry: HistoryEntry = { session: sessionWithTimeline, savedAt: Date.now() };
    setHistory((prev) => {
      const next = [entry, ...prev];
      AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(next));
      return next;
    });

    return true;
  }, [tier, history.length, openPaywall]);

  // BUILD 101: Track remaining free generations for UI display
  const [freeGenerationsLeft, setFreeGenerationsLeft] = useState(FREE_GENERATION_LIMIT);

  // Load generation count on mount
  useEffect(() => {
    canFreeUserGenerate().then((canGenerate) => {
      // Refresh remaining count
      import('../src/data/storage/generationTracker').then(({ getRemainingFreeGenerations }) => {
        getRemainingFreeGenerations().then(setFreeGenerationsLeft);
      });
    });
  }, []);

  const generateSession = useCallback((request: PracticeRequest, coachNames?: string[]): PracticeSession | null => {
    // BUILD 101: Generation gate - free users get 3 plans, then paywall
    // (async check is non-blocking; we use cached freeGenerationsLeft for instant gating)
    if (tier === SubscriptionTier.FREE && freeGenerationsLeft <= 0) {
      openPaywall('history_limit');
      return null;
    }

    const sanitized = applyTierConstraints(request, tier);
    const engineSession = generatePracticeSession(sanitized, SEED_DRILL_CATALOG);

    // BUILD 70: IMMEDIATELY flatten to timeline - BREAKS STATION SILOS
    const timeline = flattenStationsToTimeline(
      engineSession.stationLayout.stations,
      engineSession.stationLayout.transitionTimeMinutes,
      engineSession.stationLayout.totalWallClockMinutes
    );

    const session: PracticeSession = {
      ...engineSession,
      source: 'manual',
      timeline,
      ...(coachNames && coachNames.length > 0 ? { coachNames } : {}),
    };

    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(sanitized));
    setLastRequest(sanitized);
    setCurrentSession(session);

    // BUILD 101: Increment generation counter for free users
    if (tier === SubscriptionTier.FREE) {
      incrementGenerationCount().then(() => {
        import('../src/data/storage/generationTracker').then(({ getRemainingFreeGenerations }) => {
          getRemainingFreeGenerations().then(setFreeGenerationsLeft);
        });
      });
    }

    const entry: HistoryEntry = { session, savedAt: Date.now() };
    setHistory((prev) => {
      const next = [entry, ...prev];
      AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(next));
      return next;
    });

    return session;
  }, [tier, freeGenerationsLeft, openPaywall]);

  /**
   * BUILD 86: SECURITY FIX - No optimistic tier updates
   *
   * The CustomerInfo listener handles tier updates after RevenueCat
   * verifies the purchase. This prevents "Ghost Pro" from premature
   * state changes.
   */
  // BUILD 90: Pass-through typed results — no try/catch needed.
  // DO NOT setTier here — CustomerInfo listener handles it
  // after RevenueCat verifies the purchase server-side.
  const upgradeToPro = useCallback(async (): Promise<UpgradeResult> => {
    return initiateUpgrade();
  }, []);

  const handleRestorePurchases = useCallback(async (): Promise<RestoreResult> => {
    return restorePurchases();
  }, []);

  return (
    <PracticeContext.Provider
      value={{
        // Subscription
        tier,
        upgradeToPro,
        restorePurchases: handleRestorePurchases,
        // BUILD 81: Paywall state
        showPaywall,
        paywallTrigger,
        openPaywall,
        closePaywall,
        canSaveMorePractices,
        // Drills
        starredDrills: drills.starredDrills,
        toggleStar: drills.toggleStar,
        toggleStarWithDrill: drills.toggleStarWithDrill,
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
        reorderDrillsInStation,
        reorderDrillInTimeline,
        manuallyAssignDrillToCoach,
        resetToEngineOrder,
        history,
        restoreSession,
        updateCurrentSession,
        deletePracticeHistory,
        importPractice,
        // BUILD 60: AI Cooldown
        aiCooldownUntil,
        setAiCooldownUntil,
        // BUILD 74: Coach Notes
        updateCoachNote,
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
