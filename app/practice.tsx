/**
 * BUILD 80: Practice Management Suite
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * FLAT TIMELINE ARCHITECTURE:
 * - All drills in timeline.drills[] array (no station silos)
 * - Coach assignments via getCoachDisplayName (Name First rule)
 * - reorderDrillInTimeline moves drills across coach boundaries
 *
 * BUILD 80: Removed Export/PDF functionality for stability
 * - Clean Share text with no "Station" terminology
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import React, { useState, useMemo, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Modal, StyleSheet, Share, Alert, ActionSheetIOS, Platform } from 'react-native';
import { Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePractice, CustomDrill } from '../context/PracticeContext';
import { Drill, PracticeSession, DrillBlock } from '../src/data/types';
import DrillCard from '../components/DrillCard';
import CategoryBadge from '../components/CategoryBadge';
import UpgradeBanner from '../components/UpgradeBanner';
import Toast from '../components/Toast';
import { filterCandidates } from '../src/core/engine/drillSelector';
import { SEED_DRILL_CATALOG } from '../src/data/seedDrills';
import { generateShareLink } from '../src/utils/practiceSerializer';
// BUILD 68: Coach assignment imports
import { loadCoachingStaff } from '../src/data/storage/coachingStorage';
import { CoachingStaff, getCoachColor } from '../src/data/types/coach';
import { ensureTimelineWithSync } from '../src/data/storage/practiceSessionStorage';
import { autoAssignDrillsToStaff, countUnassignedDrills, getCoachDisplayName } from '../src/logic/coachMatcher';
import { BASE_RPM } from '../src/core/constants/intensityConfig';

// BUILD 100: Display-friendly label for the age group enum value (7 groups)
function formatAgeGroup(raw: string): string {
  const labelMap: Record<string, string> = {
    'INTRO': 'Intro (3-4)',
    'T_BALL': 'T-Ball',
    'COACH_PITCH': 'Coach Pitch',
    'MACHINE_PITCH': 'Machine Pitch',
    'KID_PITCH': 'Kid Pitch',
    'COMPETITIVE': '11-12U',
    'ADVANCED': '13-14U',
    // Legacy mappings for saved sessions
    '8U': 'Coach Pitch',
    '10U': 'Kid Pitch',
    '12U': '11-12U',
    '14U': '13-14U',
  };
  return labelMap[raw] ?? raw.replace('AGE_', '').replace('_', '-');
}

function customToDrill(c: CustomDrill): Drill {
  return {
    id: c.id,
    name: c.name,
    description: c.description,
    complexityScore: 0,
    physicalIntensity: 0,
    category: c.category,
    ageGroupCompatibility: [],
    minPlayers: 1,
    subscriptionTier: 'free',
    equipment: c.equipment,
  };
}

/**
 * BUILD 73: Format session for Share - NO "Station" terminology
 * Uses coach names and flat timeline structure
 */
function formatSessionForShare(session: PracticeSession): string {
  const { warmupMinutes, cooldownMinutes, stationLayout, request, coachNames, timeline } = session;
  const ageLabel = formatAgeGroup(request.ageGroup);
  // BUILD 73: Coach labels only, no "Station" verbiage
  const DEFAULT_COACH_LABELS = ['Head Coach', 'Assistant 1', 'Assistant 2', 'Assistant 3'];

  const lines: string[] = [
    '\u2014 DiamondScript Practice \u2014',
    `${ageLabel} \u00B7 ${stationLayout.totalWallClockMinutes} min`,
    '',
    `Warm Up: ${warmupMinutes} min`,
    'Stretch, light jog, arm circles',
    '',
  ];

  // BUILD 107: Recalculate timing at share time based on current drill grouping
  const shareAvailableDrillTime = stationLayout.totalWallClockMinutes - warmupMinutes - cooldownMinutes;
  const shareRPM = BASE_RPM + request.intensity;
  const shareTransition = Math.round(stationLayout.transitionTimeMinutes);
  // Helper: format a group of drills with proportional time redistribution.
  // Uses weighted largest-remainder to preserve AI timing ratios while ensuring exact sums.
  function formatDrillGroup(
    drills: { drill: { name: string; equipment?: string[] }; reps: number; bonusReps: number; timeMinutes: number }[],
    coachLabel: string
  ) {
    const drillCount = drills.length;
    if (drillCount === 0) return; // Guard: skip empty groups
    const totalTransitions = (drillCount - 1) * shareTransition;
    const pureDrillMinutes = Math.max(0, shareAvailableDrillTime - totalTransitions); // Guard: never negative

    // Proportional redistribution using weighted largest-remainder
    const totalWeight = drills.reduce((sum, b) => sum + Math.max(b.timeMinutes, 1), 0);
    const entries: { index: number; floored: number; remainder: number }[] = [];
    let flooredSum = 0;
    drills.forEach((block, di) => {
      const weight = Math.max(block.timeMinutes, 1);
      const exactTime = (weight / totalWeight) * pureDrillMinutes;
      const floored = Math.floor(exactTime);
      entries.push({ index: di, floored, remainder: exactTime - floored });
      flooredSum += floored;
    });
    let leftover = pureDrillMinutes - flooredSum;
    const sorted = [...entries].sort((a, b) => b.remainder - a.remainder);
    for (const entry of sorted) {
      if (leftover <= 0) break;
      entry.floored += 1;
      leftover -= 1;
    }
    // Restore original order
    entries.sort((a, b) => a.index - b.index);

    const groupTotal = pureDrillMinutes + totalTransitions;
    lines.push(`${coachLabel} (${groupTotal} min)`);
    entries.forEach((entry, di) => {
      const block = drills[entry.index];
      const drillTime = entry.floored;
      const drillReps = Math.round(drillTime * shareRPM);
      lines.push(`  \u2022 ${block.drill.name} \u2014 ${drillReps} reps \u00B7 ${drillTime} min`);
      if (block.drill.equipment && block.drill.equipment.length > 0) {
        lines.push(`    Equipment: ${block.drill.equipment.join(', ')}`);
      }
      if (di < drills.length - 1) {
        lines.push(`  \u2193 ${shareTransition} min transition`);
      }
    });
    lines.push('');
  }

  // BUILD 73: Use timeline for proper coach grouping
  if (timeline?.drills && timeline.drills.length > 0) {
    const coachDrillMap = new Map<string, typeof timeline.drills>();
    for (const drill of timeline.drills) {
      const coachId = drill.assignedCoachId || 'head-coach-default';
      if (!coachDrillMap.has(coachId)) {
        coachDrillMap.set(coachId, []);
      }
      coachDrillMap.get(coachId)!.push(drill);
    }

    const groupCount = coachDrillMap.size;
    let coachIndex = 0;
    for (const [_coachId, drills] of coachDrillMap) {
      const coachLabel = coachNames?.[coachIndex] ||
        DEFAULT_COACH_LABELS[coachIndex] ||
        `Coach ${coachIndex + 1}`;
      formatDrillGroup(drills, coachLabel);
      coachIndex++;
    }

    if (groupCount > 1) {
      lines.push(`(${groupCount} stations run at the same time)`);
      lines.push('');
    }
  } else {
    // Fallback to station-based output (legacy sessions)
    stationLayout.stations.forEach((station) => {
      const coachLabel = coachNames?.[station.coachIndex] ||
        DEFAULT_COACH_LABELS[station.coachIndex] ||
        `Coach ${station.coachIndex + 1}`;
      formatDrillGroup(station.drills, coachLabel);
    });

    if (stationLayout.stations.length > 1) {
      lines.push(`(${stationLayout.stations.length} stations run at the same time)`);
      lines.push('');
    }
  }

  lines.push(`Cool Down: ${cooldownMinutes} min`);
  lines.push('Cool stretches, hydrate, recap');
  lines.push('');
  lines.push(`Total: ${stationLayout.totalWallClockMinutes} min`);

  return lines.join('\n');
}

// BUILD 73: Group drills by coach for visual rendering while preserving timeline order
interface CoachGroup {
  coachId: string;
  coachName: string;
  coachColors: { bg: string; border: string; text: string } | null;
  drills: { block: DrillBlock; timelineIndex: number }[];
}

function groupDrillsByCoach(
  drills: DrillBlock[],
  staff: CoachingStaff | null,
  coachNames?: string[]
): CoachGroup[] {
  const groups: CoachGroup[] = [];
  const coachMap = new Map<string, CoachGroup>();

  drills.forEach((block, timelineIndex) => {
    const coachId = block.assignedCoachId || 'head-coach-default';

    if (!coachMap.has(coachId)) {
      // Determine coach display name using Name First rule
      let coachName = 'Head Coach';
      if (staff) {
        coachName = getCoachDisplayName(coachId, staff, block.drill.category);
      } else if (coachNames) {
        // Fallback to legacy coachNames array
        const coachIndex = coachId === 'head-coach-default' ? 0 :
          parseInt(coachId.replace('assistant-placeholder-', ''), 10);
        if (!isNaN(coachIndex) && coachNames[coachIndex]) {
          coachName = coachNames[coachIndex];
        }
      }

      const group: CoachGroup = {
        coachId,
        coachName,
        coachColors: getCoachColor(coachId),
        drills: [],
      };
      coachMap.set(coachId, group);
      groups.push(group);
    }

    coachMap.get(coachId)!.drills.push({ block, timelineIndex });
  });

  return groups;
}

export default function PracticeScreen() {
  const insets = useSafeAreaInsets();
  const {
    tier,
    currentSession,
    customDrills,
    addDrillToSession,
    resetToEngineOrder,
    updateCurrentSession,
    reorderDrillInTimeline,
    showPaywall,
    paywallTrigger,
    closePaywall,
    openPaywall,
  } = usePractice();
  const [showAddPicker, setShowAddPicker] = useState(false);
  const [showSharePreview, setShowSharePreview] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [isEditMode, setIsEditMode] = useState(false);
  const [hasInitializedCoaches, setHasInitializedCoaches] = useState(false);
  const [staff, setStaff] = useState<CoachingStaff | null>(null);

  // BUILD 68: Auto-assignment on session load
  useEffect(() => {
    if (!currentSession || hasInitializedCoaches) return;

    const initializeCoachAssignments = async () => {
      try {
        const loadedStaff = await loadCoachingStaff();
        setStaff(loadedStaff);

        const migratedSession = await ensureTimelineWithSync(currentSession);

        if (migratedSession.timeline && countUnassignedDrills(migratedSession.timeline.drills) > 0) {
          const assignedDrills = autoAssignDrillsToStaff(
            migratedSession.timeline.drills,
            loadedStaff
          );

          const updatedSession: PracticeSession = {
            ...migratedSession,
            timeline: {
              ...migratedSession.timeline,
              drills: assignedDrills,
            },
          };

          updateCurrentSession(updatedSession);
        }

        setHasInitializedCoaches(true);
      } catch (error) {
        console.error('BUILD 73: Coach assignment initialization failed:', error);
        setHasInitializedCoaches(true);
      }
    };

    initializeCoachAssignments();
  }, [currentSession, hasInitializedCoaches, updateCurrentSession]);

  // Reset initialization flag when session changes
  useEffect(() => {
    setHasInitializedCoaches(false);
  }, [currentSession?.request?.ageGroup]);

  // Load staff on mount for display purposes
  useEffect(() => {
    loadCoachingStaff().then(setStaff);
  }, []);

  if (!currentSession) {
    return (
      <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <Text style={styles.empty}>No practice generated yet. Go back and tap Go.</Text>
      </View>
    );
  }

  const { warmupMinutes, cooldownMinutes, stationLayout, request, selectedDrills } = currentSession;

  // BUILD 73: Use timeline.drills as source of truth, fallback to stationLayout.
  // Memoized so the fallback flatMap doesn't create a new array reference every render,
  // which would defeat downstream useMemo hooks (coachGroups, adjustedDrillValues).
  const timelineDrills = useMemo(
    () => currentSession.timeline?.drills ||
      stationLayout.stations.flatMap((s, si) =>
        s.drills.map((d, di) => ({
          ...d,
          assignedCoachId: si === 0 ? 'head-coach-default' : `assistant-placeholder-${si}`,
          order: si * 100 + di
        }))
      ),
    [currentSession.timeline?.drills, stationLayout.stations]
  );

  // Group drills by coach for visual rendering — memoized so downstream
  // useMemo hooks only recompute when drills/staff/names actually change.
  const coachGroups = useMemo(
    () => groupDrillsByCoach(timelineDrills, staff, currentSession.coachNames),
    [timelineDrills, staff, currentSession.coachNames]
  );

  // BUILD 107: Recalculate per-drill time and reps based on CURRENT grouping.
  // When drills are moved between coaches, the original engine values become stale.
  // Every coach group runs during the same wall-clock window (availableDrillTime),
  // so we redistribute time proportionally within each group.
  //
  // PROPORTIONAL REDISTRIBUTION: Each drill's share of the group time is weighted
  // by its original timeMinutes value (from the engine or AI). This preserves the
  // AI's intended pacing (e.g., 12-min hitting drill stays ~2x a 6-min baserunning
  // drill). For Quick Plan sessions where the engine assigns equal times, proportional
  // = equal, so behavior is identical.
  //
  // Rounding strategy: weighted largest-remainder method. Scale each drill proportionally,
  // floor all values, then distribute the leftover minutes to drills with the largest
  // fractional remainders. Guarantees whole numbers that sum exactly.
  const availableDrillTime = stationLayout.totalWallClockMinutes - warmupMinutes - cooldownMinutes;
  const rpm = BASE_RPM + request.intensity;
  const roundedTransition = Math.round(stationLayout.transitionTimeMinutes);

  // Map from timeline index → adjusted { time, reps } for display
  const adjustedDrillValues = useMemo(() => {
    const values = new Map<number, { time: number; reps: number }>();
    for (const group of coachGroups) {
      const drillCount = group.drills.length;
      if (drillCount === 0) continue; // Guard: skip empty groups
      const totalTransitions = (drillCount - 1) * roundedTransition;
      const pureDrillMinutes = Math.max(0, availableDrillTime - totalTransitions); // Guard: never negative

      // Sum original weights for this group
      const totalWeight = group.drills.reduce((sum, { block }) => sum + Math.max(block.timeMinutes, 1), 0);

      // Calculate proportional time and track remainders for largest-remainder rounding
      const entries: { timelineIndex: number; floored: number; remainder: number }[] = [];
      let flooredSum = 0;
      for (const { block, timelineIndex } of group.drills) {
        const weight = Math.max(block.timeMinutes, 1);
        const exactTime = (weight / totalWeight) * pureDrillMinutes;
        const floored = Math.floor(exactTime);
        entries.push({ timelineIndex, floored, remainder: exactTime - floored });
        flooredSum += floored;
      }

      // Distribute leftover minutes to drills with largest fractional remainders
      let leftover = pureDrillMinutes - flooredSum;
      const sorted = [...entries].sort((a, b) => b.remainder - a.remainder);
      for (const entry of sorted) {
        if (leftover <= 0) break;
        entry.floored += 1;
        leftover -= 1;
      }

      // Write final values
      for (const entry of entries) {
        values.set(entry.timelineIndex, {
          time: entry.floored,
          reps: Math.round(entry.floored * rpm),
        });
      }
    }
    return values;
  }, [coachGroups, availableDrillTime, roundedTransition, rpm]);

  // Memoize expensive drill filtering calculations
  const { hasShortfall, upgradeHelps, canAddDrill, addableDrills } = useMemo(() => {
    const shortfall = selectedDrills.length < request.numDrills;
    const proPoolSize = shortfall
      ? filterCandidates(SEED_DRILL_CATALOG, request.ageGroup, 'pro').length
      : 0;
    const helps = shortfall && proPoolSize > selectedDrills.length;

    const canAdd = tier === 'pro' || request.ageGroup === 'T_BALL' || request.ageGroup === 'INTRO';
    const sessionDrillIds = new Set(timelineDrills.map((b) => b.drill.id));
    const drills: Drill[] = canAdd
      ? [
          ...filterCandidates(SEED_DRILL_CATALOG, request.ageGroup, 'pro').filter((d) => !sessionDrillIds.has(d.id)),
          ...customDrills.filter((c) => !sessionDrillIds.has(c.id)).map(customToDrill),
        ]
      : [];

    return {
      hasShortfall: shortfall,
      upgradeHelps: helps,
      canAddDrill: canAdd,
      addableDrills: drills,
    };
  }, [selectedDrills.length, request.numDrills, request.ageGroup, tier, timelineDrills, customDrills]);

  const handleShare = () => {
    setShowSharePreview(true);
  };

  // BUILD 107: Share freeze fix — keep modal open during Share.share() to avoid
  // race condition between modal dismiss animation and iOS share sheet.
  // Modal only closes in finally{} after share completes or is cancelled.
  const executeShare = async () => {
    if (isSharing) return; // Guard: prevent double-tap
    setIsSharing(true);
    try {
      const practiceData = {
        type: 'practice',
        ageGroup: formatAgeGroup(request.ageGroup),
        totalMinutes: stationLayout.totalWallClockMinutes,
        coachCount: coachGroups.length,
        warmupMinutes,
        cooldownMinutes,
        session: currentSession,
      };

      const textPlan = formatSessionForShare(currentSession);
      const magicPayload = `{DIAMONDSCRIPT_DATA:${JSON.stringify(practiceData)}}`;

      if (tier === 'pro') {
        let deepLink: string | null = null;
        try {
          deepLink = generateShareLink(currentSession);
        } catch (linkError) {
          console.warn('Deep link generation failed:', linkError);
        }

        const message = deepLink
          ? `Open this practice in DiamondScript:\n${deepLink}\n\n${textPlan}\n\n${magicPayload}`
          : `${textPlan}\n\nCopy this message to import the practice plan!\n\n${magicPayload}`;

        await Share.share({
          title: `DiamondScript \u2014 ${formatAgeGroup(request.ageGroup)} Practice`,
          message,
        });
      } else {
        await Share.share({
          title: `DiamondScript \u2014 ${formatAgeGroup(request.ageGroup)} Practice`,
          message: `${textPlan}\n\nCopy this message to import the practice plan!\n\n${magicPayload}`,
        });
      }
    } catch (error) {
      // Share cancelled or failed — only attempt fallback for real errors, not user cancellation
      if (error instanceof Error && error.message !== 'User did not share') {
        console.error('Practice share failed:', error);
        try {
          await Share.share({
            title: 'DiamondScript Practice',
            message: `DiamondScript Practice Plan\n\nAge Group: ${formatAgeGroup(request.ageGroup)}\nDuration: ${stationLayout.totalWallClockMinutes} minutes`,
          });
        } catch {
          // Absolute last resort - do nothing
        }
      }
    } finally {
      // Always dismiss the share preview modal AFTER sharing completes
      setIsSharing(false);
      setShowSharePreview(false);
    }
  };

  const handleResetToRecommended = () => {
    Alert.alert(
      'Reset to Recommended Order?',
      'This will restore the AI generated drill order. Current changes will be lost.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: () => {
            resetToEngineOrder();
            setToastMessage('Drill order reset to recommended');
            setToastVisible(true);
            setIsEditMode(false);
          },
        },
      ]
    );
  };

  const isPro = tier === 'pro';
  const canEditOrder = timelineDrills.length > 1;

  const handleMoreMenu = () => {
    const options = isEditMode
      ? ['Reset to Recommended', 'Done Editing', 'Cancel']
      : canEditOrder
        ? ['Edit Order', 'Cancel']
        : ['Cancel'];

    const cancelIndex = options.length - 1;
    const destructiveIndex = isEditMode ? 0 : -1;

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options, cancelButtonIndex: cancelIndex, destructiveButtonIndex: destructiveIndex },
        (buttonIndex) => {
          if (isEditMode) {
            if (buttonIndex === 0) handleResetToRecommended();
            else if (buttonIndex === 1) setIsEditMode(false);
          } else {
            if (buttonIndex === 0 && canEditOrder) setIsEditMode(true);
          }
        }
      );
    } else {
      // Android fallback using Alert
      if (isEditMode) {
        Alert.alert('Options', '', [
          { text: 'Reset to Recommended', style: 'destructive', onPress: handleResetToRecommended },
          { text: 'Done Editing', onPress: () => setIsEditMode(false) },
          { text: 'Cancel', style: 'cancel' },
        ]);
      } else if (canEditOrder) {
        Alert.alert('Options', '', [
          { text: 'Edit Order', onPress: () => setIsEditMode(true) },
          { text: 'Cancel', style: 'cancel' },
        ]);
      }
    }
  };

  return (
    <>
    <Stack.Screen
      options={{
        headerRight: () => (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 20, paddingRight: 16 }}>
            <TouchableOpacity onPress={handleShare} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="share-outline" size={22} color="#FFFFFF" />
            </TouchableOpacity>
            <TouchableOpacity onPress={handleMoreMenu} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="ellipsis-horizontal" size={22} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        ),
      }}
    />
    <ScrollView style={styles.scroll} contentContainerStyle={[styles.container, { paddingBottom: insets.bottom }]}>
      {/* Header summary */}
      <View style={styles.summary}>
        <Text style={styles.summaryAge}>{formatAgeGroup(request.ageGroup)}</Text>
        <View style={styles.summaryBadge}>
          <Text style={styles.summaryTime}>{stationLayout.totalWallClockMinutes} min</Text>
        </View>
      </View>

      {/* Drill shortfall banners */}
      {hasShortfall && upgradeHelps && (
        <UpgradeBanner feature={`the full catalog (${selectedDrills.length} of ${request.numDrills} drills shown)`} />
      )}
      {hasShortfall && !upgradeHelps && (
        <View style={styles.capNote}>
          <Text style={styles.capNoteText}>
            Only {selectedDrills.length} drills available for {formatAgeGroup(request.ageGroup)} \u2014 try requesting {selectedDrills.length} or fewer.
          </Text>
        </View>
      )}

      {/* Warmup block */}
      <View style={styles.bookendCard}>
        <Text style={styles.bookendLabel}>Warm Up</Text>
        <Text style={styles.bookendDuration}>{warmupMinutes} min</Text>
        <Text style={styles.bookendNote}>Stretch, light jog, arm circles</Text>
      </View>

      {/* BUILD 107: FLAT TIMELINE RENDERING - Drills grouped by coach, transitions only within groups */}
      {coachGroups.map((group, groupIndex) => {
        // BUILD 107: Per-group total = sum of that group's drill times + transitions.
        // This matches what a coach can manually add up from the drill cards.
        const groupDrillSum = group.drills.reduce((sum, { timelineIndex }) => {
          const adj = adjustedDrillValues.get(timelineIndex);
          return sum + (adj?.time ?? 0);
        }, 0);
        const groupTransitions = Math.max(0, group.drills.length - 1) * roundedTransition;
        const groupTotalMinutes = groupDrillSum + groupTransitions;

        return (
        <View key={group.coachId} style={styles.coachSection}>
          {/* Coach Header with group time total */}
          <View style={[
            styles.coachHeader,
            group.coachColors && { backgroundColor: group.coachColors.bg, borderColor: group.coachColors.border }
          ]}>
            <Text style={[
              styles.coachHeaderText,
              group.coachColors && { color: group.coachColors.text }
            ]}>
              {group.coachName}
            </Text>
            <Text style={styles.coachDrillCount}>
              {group.drills.length} drill{group.drills.length !== 1 ? 's' : ''} {'\u00B7'} {groupTotalMinutes} min
            </Text>
          </View>

          {/* Drills under this coach */}
          {group.drills.map(({ block, timelineIndex }, drillIndexInGroup) => {
            // BUILD 73: isFirst/isLast based on GLOBAL timeline position (for edit mode arrows)
            const isFirstInTimeline = timelineIndex === 0;
            const isLastInTimeline = timelineIndex === timelineDrills.length - 1;
            // BUILD 107: Transition arrows only between drills WITHIN the same coach group.
            // Cross-group transitions are wrong — parallel stations don't transition sequentially.
            const isLastInGroup = drillIndexInGroup === group.drills.length - 1;

            const adjusted = adjustedDrillValues.get(timelineIndex);

            return (
              <View key={block.id || `drill-${timelineIndex}`}>
                <DrillCard
                  block={block}
                  stationIndex={groupIndex}
                  blockIndex={drillIndexInGroup}
                  isFirst={isFirstInTimeline}
                  isLast={isLastInTimeline}
                  showTransitionArrow={!isLastInGroup}
                  displayTime={adjusted?.time}
                  displayReps={adjusted?.reps}
                  transitionMinutes={stationLayout.transitionTimeMinutes}
                  isEditMode={isEditMode}
                  timelineIndex={timelineIndex}
                  onMoveUp={() => reorderDrillInTimeline(timelineIndex, 'up')}
                  onMoveDown={() => reorderDrillInTimeline(timelineIndex, 'down')}
                />
              </View>
            );
          })}
        </View>
        );
      })}

      {/* Edit mode indicator */}
      {isEditMode && (
        <View style={styles.editModeBar}>
          <Ionicons name="reorder-three" size={18} color="#1B4332" />
          <Text style={styles.editModeText}>Reordering drills — use arrows to move</Text>
        </View>
      )}

      {/* Add-drill button / upgrade nudge */}
      {!isEditMode && canAddDrill && addableDrills.length > 0 ? (
        <TouchableOpacity style={styles.addDrillButton} onPress={() => setShowAddPicker(true)}>
          <Text style={styles.addDrillButtonText}>+ Add Drill</Text>
        </TouchableOpacity>
      ) : !isEditMode && !canAddDrill && (
        <View style={styles.addDrillNudge}>
          <UpgradeBanner feature="adding drills to a practice" />
        </View>
      )}

      {/* Cooldown block */}
      <View style={styles.bookendCard}>
        <Text style={styles.bookendLabel}>Cool Down</Text>
        <Text style={styles.bookendDuration}>{cooldownMinutes} min</Text>
        <Text style={styles.bookendNote}>Cool stretches, hydrate, recap</Text>
      </View>

      {/* Footer: total wall clock confirmation */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>
          Total practice: <Text style={styles.footerBold}>{stationLayout.totalWallClockMinutes} minutes</Text>
        </Text>
        {coachGroups.length > 1 && (
          <Text style={styles.footerSub}>
            {coachGroups.length} coaches — stations run at the same time
          </Text>
        )}
      </View>

    </ScrollView>

    {/* Add-drill picker bottom sheet */}
    {showAddPicker && (
      <Modal visible transparent animationType="slide" onRequestClose={() => setShowAddPicker(false)}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={() => setShowAddPicker(false)}>
          <View style={styles.pickerSheet} onStartShouldSetResponder={() => true} onMoveShouldSetResponder={() => false}>
            <View style={styles.pickerHandle} />
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>Add Drill</Text>
              <TouchableOpacity onPress={() => setShowAddPicker(false)}>
                <Text style={styles.pickerClose}>{'\u00D7'}</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.pickerList}>
              {addableDrills.map((drill) => {
                const isCustom = customDrills.some((c) => c.id === drill.id);
                const isProLocked = tier === 'free' && drill.subscriptionTier === 'pro';
                return (
                  <TouchableOpacity
                    key={drill.id}
                    style={[styles.pickerRow, isProLocked && styles.pickerRowLocked]}
                    onPress={() => {
                      if (isProLocked) {
                        setShowAddPicker(false);
                        openPaywall('drill_catalog');
                      } else {
                        addDrillToSession(drill);
                        setShowAddPicker(false);
                      }
                    }}
                  >
                    <View style={styles.pickerRowInfo}>
                      <View style={styles.pickerRowTop}>
                        <Text style={[styles.pickerDrillName, isProLocked && styles.pickerDrillNameLocked]}>{drill.name}</Text>
                        {isCustom && (
                          <View style={styles.pickerCustomBadge}>
                            <Text style={styles.pickerCustomBadgeText}>Custom</Text>
                          </View>
                        )}
                        {isProLocked && (
                          <View style={styles.pickerProBadge}>
                            <Ionicons name="lock-closed" size={10} color="#D4AF37" />
                            <Text style={styles.pickerProBadgeText}>PRO</Text>
                          </View>
                        )}
                      </View>
                      <Text style={[styles.pickerDrillDesc, isProLocked && styles.pickerDrillDescLocked]} numberOfLines={1}>{drill.description}</Text>
                    </View>
                    <CategoryBadge category={drill.category} />
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    )}
    {/* Share Preview Modal */}
    {showSharePreview && (
      <Modal visible transparent animationType="fade" onRequestClose={() => { if (!isSharing) setShowSharePreview(false); }}>
        <TouchableOpacity
          style={styles.shareBackdrop}
          activeOpacity={1}
          onPress={() => { if (!isSharing) setShowSharePreview(false); }}
        >
          <View style={styles.sharePreviewSheet} onStartShouldSetResponder={() => true} onMoveShouldSetResponder={() => false}>
            {/* Icon */}
            <View style={styles.shareIconCircle}>
              <Ionicons name="share-outline" size={24} color="#1B4332" />
            </View>

            <Text style={styles.sharePreviewTitle}>Share Practice Plan</Text>

            {/* Summary pill */}
            <View style={styles.sharePreviewSummary}>
              <Text style={styles.sharePreviewLabel}>{formatAgeGroup(request.ageGroup)}</Text>
              <Text style={styles.sharePreviewMeta}>
                {stationLayout.totalWallClockMinutes} min  {'\u2022'}  {timelineDrills.length} drills  {'\u2022'}  {coachGroups.length} coach{coachGroups.length !== 1 ? 'es' : ''}
              </Text>
            </View>

            {/* Divider */}
            <View style={styles.shareDivider} />

            {/* How it works */}
            <Text style={styles.shareHowItWorks}>How it works</Text>

            <View style={styles.sharePreviewSteps}>
              <View style={styles.shareStep}>
                <View style={styles.shareStepNumber}><Text style={styles.shareStepNumberText}>1</Text></View>
                <Text style={styles.shareStepText}>Send via text, email, or any app</Text>
              </View>
              <View style={styles.shareStep}>
                <View style={styles.shareStepNumber}><Text style={styles.shareStepNumberText}>2</Text></View>
                <Text style={styles.shareStepText}>Other coach copies the message</Text>
              </View>
              <View style={styles.shareStep}>
                <View style={styles.shareStepNumber}><Text style={styles.shareStepNumberText}>3</Text></View>
                <Text style={styles.shareStepText}>Plan imports automatically in DiamondScript</Text>
              </View>
            </View>

            {/* Actions */}
            <TouchableOpacity
              style={[styles.sharePreviewButton, isSharing && { opacity: 0.5 }]}
              onPress={executeShare}
              activeOpacity={0.85}
              disabled={isSharing}
            >
              <Ionicons name="paper-plane-outline" size={18} color="#FFFFFF" />
              <Text style={styles.sharePreviewButtonText}>{isSharing ? 'Sharing...' : 'Share Now'}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.sharePreviewCancel, isSharing && { opacity: 0.5 }]} onPress={() => { if (!isSharing) setShowSharePreview(false); }} disabled={isSharing}>
              <Text style={styles.sharePreviewCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    )}


    <Toast
      message={toastMessage}
      visible={toastVisible}
      onHide={() => setToastVisible(false)}
    />
    </>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: '#FAFBFC',
  },
  container: {
    padding: 20,
    paddingBottom: 40,
  },
  empty: {
    textAlign: 'center',
    marginTop: 80,
    color: '#6B7280',
    fontSize: 15,
  },

  // Summary row
  summary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  summaryAge: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1B4332',
  },
  summaryBadge: {
    backgroundColor: '#1B4332',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    shadowColor: '#1B4332',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  summaryTime: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },

  // Warmup / Cooldown bookend cards
  bookendCard: {
    backgroundColor: '#1B4332',
    borderRadius: 16,
    padding: 18,
    marginBottom: 16,
    alignItems: 'center',
    shadowColor: '#1B4332',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  bookendLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#86EFAC',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 2,
  },
  bookendDuration: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  bookendNote: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 3,
  },

  // BUILD 73: Coach section styles
  coachSection: {
    marginBottom: 16,
  },
  coachHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 2,
    marginBottom: 12,
    backgroundColor: '#F0FDF4',
    borderColor: '#BBF7D0',
  },
  coachHeaderText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#166534',
  },
  coachDrillCount: {
    fontSize: 12,
    fontWeight: '500',
    color: '#6B7280',
  },

  // Footer
  footer: {
    marginTop: 8,
    padding: 18,
    backgroundColor: '#F3F4F6',
    borderRadius: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  footerText: {
    fontSize: 14,
    color: '#374151',
  },
  footerBold: {
    fontWeight: '700',
    color: '#1B4332',
  },
  footerSub: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 3,
  },

  // Catalog-cap note
  capNote: {
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  capNoteText: {
    fontSize: 13,
    color: '#6B7280',
    textAlign: 'center',
  },

  // Add-drill button / nudge
  addDrillNudge: {
    marginBottom: 16,
  },
  addDrillButton: {
    borderWidth: 2,
    borderColor: '#1B4332',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 16,
    backgroundColor: '#FFFFFF',
    shadowColor: '#1B4332',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  addDrillButtonText: {
    color: '#1B4332',
    fontSize: 15,
    fontWeight: '600',
  },

  // Edit mode indicator bar
  editModeBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#ECFDF5',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  editModeText: {
    color: '#1B4332',
    fontSize: 13,
    fontWeight: '500',
  },

  // Add-drill picker bottom sheet
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'flex-end',
  },
  pickerSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 34,
    maxHeight: '60%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  pickerHandle: {
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#D1D5DB',
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 8,
  },
  pickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  pickerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  pickerClose: {
    fontSize: 22,
    color: '#6B7280',
  },
  pickerList: {
    paddingHorizontal: 16,
  },
  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  pickerRowInfo: {
    flex: 1,
    marginRight: 10,
  },
  pickerRowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pickerDrillName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
  },
  pickerDrillDesc: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  pickerCustomBadge: {
    backgroundColor: '#ECFDF5',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  pickerCustomBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#059669',
  },
  pickerRowLocked: {
    opacity: 0.6,
  },
  pickerDrillNameLocked: {
    color: '#9CA3AF',
  },
  pickerDrillDescLocked: {
    color: '#D1D5DB',
  },
  pickerProBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#FEF3C7',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  pickerProBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#D4AF37',
  },

  // Share preview modal
  shareBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  sharePreviewSheet: {
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    paddingTop: 32,
    paddingBottom: 24,
    paddingHorizontal: 32,
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.15,
    shadowRadius: 32,
    elevation: 12,
  },
  shareIconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#ECFDF5',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  sharePreviewTitle: {
    fontSize: 19,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 20,
  },
  sharePreviewSummary: {
    backgroundColor: '#F0FDF4',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 20,
    alignItems: 'center',
    width: '100%',
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  sharePreviewLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1B4332',
  },
  sharePreviewMeta: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 3,
  },
  shareDivider: {
    height: 1,
    backgroundColor: '#E5E7EB',
    width: '100%',
    marginVertical: 20,
  },
  shareHowItWorks: {
    fontSize: 12,
    fontWeight: '600',
    color: '#9CA3AF',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    alignSelf: 'flex-start',
    marginBottom: 16,
  },
  sharePreviewSteps: {
    width: '100%',
    gap: 16,
    marginBottom: 28,
  },
  shareStep: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  shareStepNumber: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#1B4332',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shareStepNumberText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  shareStepText: {
    flex: 1,
    fontSize: 14,
    color: '#374151',
    lineHeight: 19,
  },
  sharePreviewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#1B4332',
    borderRadius: 14,
    paddingVertical: 15,
    width: '100%',
    shadowColor: '#1B4332',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  sharePreviewButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  sharePreviewCancel: {
    alignItems: 'center',
    paddingVertical: 12,
    marginTop: 6,
  },
  sharePreviewCancelText: {
    color: '#9CA3AF',
    fontSize: 14,
    fontWeight: '500',
  },
});
