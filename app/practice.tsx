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
import { View, Text, ScrollView, TouchableOpacity, Modal, StyleSheet, Share, Alert } from 'react-native';
import { Stack } from 'expo-router';
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

// Display-friendly label for the age group enum value
function formatAgeGroup(raw: string): string {
  return raw.replace('AGE_', '').replace('_', '-').replace('T-BALL', 'T-Ball');
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

  // BUILD 73: Use timeline for proper coach grouping
  if (timeline?.drills && timeline.drills.length > 0) {
    // Group drills by coach for share output
    const coachDrillMap = new Map<string, typeof timeline.drills>();
    for (const drill of timeline.drills) {
      const coachId = drill.assignedCoachId || 'head-coach-default';
      if (!coachDrillMap.has(coachId)) {
        coachDrillMap.set(coachId, []);
      }
      coachDrillMap.get(coachId)!.push(drill);
    }

    let coachIndex = 0;
    for (const [_coachId, drills] of coachDrillMap) {
      // Determine coach label from coachNames or defaults
      const coachLabel = coachNames?.[coachIndex] ||
        DEFAULT_COACH_LABELS[coachIndex] ||
        `Coach ${coachIndex + 1}`;

      lines.push(coachLabel);
      drills.forEach((block, di) => {
        const totalReps = block.reps + block.bonusReps;
        lines.push(`  \u2022 ${block.drill.name} \u2014 ${totalReps} reps \u00B7 ${block.timeMinutes.toFixed(1)} min`);
        if (block.drill.equipment && block.drill.equipment.length > 0) {
          lines.push(`    Equipment: ${block.drill.equipment.join(', ')}`);
        }
        if (di < drills.length - 1) {
          lines.push(`  \u2193 ${stationLayout.transitionTimeMinutes} min transition`);
        }
      });
      lines.push('');
      coachIndex++;
    }
  } else {
    // Fallback to station-based output (legacy sessions)
    stationLayout.stations.forEach((station) => {
      const coachLabel = coachNames?.[station.coachIndex] ||
        DEFAULT_COACH_LABELS[station.coachIndex] ||
        `Coach ${station.coachIndex + 1}`;

      lines.push(coachLabel);
      station.drills.forEach((block, di) => {
        const totalReps = block.reps + block.bonusReps;
        lines.push(`  \u2022 ${block.drill.name} \u2014 ${totalReps} reps \u00B7 ${block.timeMinutes.toFixed(1)} min`);
        if (block.drill.equipment && block.drill.equipment.length > 0) {
          lines.push(`    Equipment: ${block.drill.equipment.join(', ')}`);
        }
        if (di < station.drills.length - 1) {
          lines.push(`  \u2193 ${stationLayout.transitionTimeMinutes} min transition`);
        }
      });
      lines.push('');
    });
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
  } = usePractice();
  const [showAddPicker, setShowAddPicker] = useState(false);
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

  // BUILD 73: Use timeline.drills as source of truth, fallback to stationLayout
  const timelineDrills = currentSession.timeline?.drills ||
    stationLayout.stations.flatMap((s, si) =>
      s.drills.map((d, di) => ({
        ...d,
        assignedCoachId: si === 0 ? 'head-coach-default' : `assistant-placeholder-${si}`,
        order: si * 100 + di
      }))
    );

  // Group drills by coach for visual rendering
  const coachGroups = groupDrillsByCoach(timelineDrills, staff, currentSession.coachNames);

  // Memoize expensive drill filtering calculations
  const { hasShortfall, upgradeHelps, canAddDrill, addableDrills } = useMemo(() => {
    const shortfall = selectedDrills.length < request.numDrills;
    const proPoolSize = shortfall
      ? filterCandidates(SEED_DRILL_CATALOG, request.ageGroup, 'pro').length
      : 0;
    const helps = shortfall && proPoolSize > selectedDrills.length;

    const canAdd = tier === 'pro' || request.ageGroup === 'T_BALL';
    const sessionDrillIds = new Set(timelineDrills.map((b) => b.drill.id));
    const drills: Drill[] = canAdd
      ? [
          ...filterCandidates(SEED_DRILL_CATALOG, request.ageGroup, tier).filter((d) => !sessionDrillIds.has(d.id)),
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

  const handleShare = async () => {
    try {
      const practiceData = {
        type: 'practice',
        ageGroup: formatAgeGroup(request.ageGroup),
        totalMinutes: stationLayout.totalWallClockMinutes,
        coachCount: coachGroups.length, // BUILD 73: Use coach count instead of station count
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
        }).catch(() => {});
      } else {
        await Share.share({
          title: `DiamondScript \u2014 ${formatAgeGroup(request.ageGroup)} Practice`,
          message: `${textPlan}\n\nCopy this message to import the practice plan!\n\n${magicPayload}`,
        }).catch(() => {});
      }
    } catch (error) {
      console.error('Practice share failed:', error);
      try {
        await Share.share({
          title: 'DiamondScript Practice',
          message: `DiamondScript Practice Plan\n\nAge Group: ${formatAgeGroup(request.ageGroup)}\nDuration: ${stationLayout.totalWallClockMinutes} minutes`,
        }).catch(() => {});
      } catch {
        // Absolute last resort - do nothing
      }
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
  const canEditOrder = isPro && timelineDrills.length > 1;

  return (
    <>
    <Stack.Screen
      options={{
        headerRight: ({ tintColor }) => (
          <View style={{ flexDirection: 'row', gap: 16, paddingRight: 16 }}>
            {canEditOrder && (
              <TouchableOpacity onPress={() => setIsEditMode(!isEditMode)}>
                <Text style={{ color: tintColor, fontSize: 15, fontWeight: '500' }}>
                  {isEditMode ? 'Done' : 'Edit Order'}
                </Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={handleShare}>
              <Text style={{ color: tintColor, fontSize: 15, fontWeight: '500' }}>Share</Text>
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

      {/* BUILD 73: FLAT TIMELINE RENDERING - Drills grouped by coach but arrows cross boundaries */}
      {coachGroups.map((group, groupIndex) => (
        <View key={group.coachId} style={styles.coachSection}>
          {/* Coach Header */}
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
              {group.drills.length} drill{group.drills.length !== 1 ? 's' : ''}
            </Text>
          </View>

          {/* Drills under this coach */}
          {group.drills.map(({ block, timelineIndex }, drillIndexInGroup) => {
            // BUILD 73: isFirst/isLast based on GLOBAL timeline position
            const isFirstInTimeline = timelineIndex === 0;
            const isLastInTimeline = timelineIndex === timelineDrills.length - 1;

            return (
              <View key={block.id || `drill-${timelineIndex}`}>
                <DrillCard
                  block={block}
                  stationIndex={groupIndex}
                  blockIndex={drillIndexInGroup}
                  isFirst={isFirstInTimeline}
                  isLast={isLastInTimeline}
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
      ))}

      {/* Reset to Recommended button (shown in edit mode) */}
      {isEditMode && canEditOrder && (
        <TouchableOpacity style={styles.resetButton} onPress={handleResetToRecommended}>
          <Text style={styles.resetButtonText}>Reset to Recommended Order</Text>
        </TouchableOpacity>
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
            {coachGroups.length} coaches assigned
          </Text>
        )}
      </View>

    </ScrollView>

    {/* Add-drill picker bottom sheet */}
    {showAddPicker && (
      <Modal visible transparent animationType="slide">
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={() => setShowAddPicker(false)}>
          <View style={styles.pickerSheet} onStartShouldSetResponder={() => true}>
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
                return (
                  <TouchableOpacity
                    key={drill.id}
                    style={styles.pickerRow}
                    onPress={() => { addDrillToSession(drill); setShowAddPicker(false); }}
                  >
                    <View style={styles.pickerRowInfo}>
                      <View style={styles.pickerRowTop}>
                        <Text style={styles.pickerDrillName}>{drill.name}</Text>
                        {isCustom && (
                          <View style={styles.pickerCustomBadge}>
                            <Text style={styles.pickerCustomBadgeText}>Custom</Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.pickerDrillDesc} numberOfLines={1}>{drill.description}</Text>
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
    backgroundColor: '#F8FAFC',
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

  // Reset to Recommended button
  resetButton: {
    borderWidth: 1,
    borderColor: '#9CA3AF',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 16,
    backgroundColor: '#F9FAFB',
  },
  resetButtonText: {
    color: '#6B7280',
    fontSize: 14,
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
});
