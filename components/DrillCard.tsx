/**
 * BUILD 71: DrillCard - Interactive Drill Display with Coach Assignment
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * INTERACTIVE COACH BADGE:
 * - Tappable badge opens coach picker modal
 * - Shows "Assign Coach" CTA when unassigned (amber styling)
 * - Selection calls manuallyAssignDrillToCoach() → sets assignmentSource: 'manual'
 *
 * MANUAL LOCKDOWN: Once assigned manually, auto-assignment never overrides
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { View, Text, TouchableOpacity, Modal, ScrollView, StyleSheet, Share } from 'react-native';
import { DrillBlock, Drill } from '../src/data/types';
import { usePractice, CustomDrill } from '../context/PracticeContext';
import { SEED_DRILL_CATALOG } from '../src/data/seedDrills';
import CategoryBadge from './CategoryBadge';
import { CoachingStaff, getCoachColor, Coach } from '../src/data/types/coach';
import { loadCoachingStaff } from '../src/data/storage/coachingStorage';
import { getCoachDisplayName } from '../src/logic/coachMatcher';

interface Props {
  block: DrillBlock;
  stationIndex: number;
  blockIndex: number;
  isLast: boolean;
  isFirst: boolean;
  transitionMinutes: number;
  isEditMode?: boolean;
  /** BUILD 107: Show transition arrow after this drill (within same coach group only) */
  showTransitionArrow?: boolean;
  /** BUILD 107: Adjusted time/reps recalculated for current coach grouping */
  displayTime?: number;
  displayReps?: number;
  /** BUILD 70: Timeline index for manuallyAssignDrillToCoach */
  timelineIndex?: number;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
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

const DrillCard = React.memo(function DrillCard({
  block,
  stationIndex,
  blockIndex,
  isLast,
  isFirst,
  transitionMinutes,
  isEditMode = false,
  showTransitionArrow,
  displayTime,
  displayReps,
  timelineIndex,
  onMoveUp,
  onMoveDown
}: Props) {
  // BUILD 70: ALL hooks BEFORE conditional returns (React Rules of Hooks)
  const {
    starredDrills,
    toggleStarWithDrill,
    customDrills,
    swapDrill,
    removeDrillFromSession,
    manuallyAssignDrillToCoach, // BUILD 70: Manual coach assignment
  } = usePractice();
  const [showPicker, setShowPicker] = useState(false);
  const [showCoachPicker, setShowCoachPicker] = useState(false); // BUILD 70: Coach picker modal

  // BUILD 68: Coaching staff state for coach badges
  const [staff, setStaff] = useState<CoachingStaff | null>(null);

  useEffect(() => {
    loadCoachingStaff().then(setStaff);
  }, []);

  // BUILD 70: Universal Share handler with type flag (Unified Sharing Ecosystem)
  const handleShare = useCallback(async () => {
    if (!block?.drill) return;

    try {
      // BUILD 49: Add type flag for Universal Import detection
      const drillData = {
        type: 'drill',
        name: block.drill.name,
        description: block.drill.description,
        category: block.drill.category,
        equipment: block.drill.equipment || [],
      };

      const shareMessage = `Check out this baseball drill from DiamondScript:\n\n${block.drill.name}\n\n${block.drill.description}${
        block.drill.equipment && block.drill.equipment.length > 0
          ? `\n\nEquipment: ${block.drill.equipment.join(', ')}`
          : ''
      }\n\nCopy this message to import it into your app!\n\n{DIAMONDSCRIPT_DATA:${JSON.stringify(drillData)}}`;

      await Share.share({
        message: shareMessage,
      });
    } catch (error) {
      // Share cancelled or failed - silent fail (user knows what happened)
      if (__DEV__) {
        console.log('Share cancelled or failed:', error);
      }
    }
  }, [block]);

  // BUILD 70: Handle coach selection from picker
  const handleSelectCoach = useCallback((coach: Coach) => {
    // Use timelineIndex if available, otherwise fall back to blockIndex
    const drillIdx = timelineIndex ?? blockIndex;
    manuallyAssignDrillToCoach(drillIdx, coach.id);
    setShowCoachPicker(false);
  }, [timelineIndex, blockIndex, manuallyAssignDrillToCoach]);

  // BUILD 41: Total protection - catch-all null guard (AFTER hooks)
  if (!block?.drill) {
    return <View />;
  }

  // Defensive null guard: prevent crash if drill data is incomplete during re-render
  if (!block.drill.id || !block.drill.name) {
    return <View />;
  }

  const isStarred = starredDrills.has(block.drill.id);
  // BUILD 107: Use adjusted values when provided (recalculated for current coach grouping)
  const effectiveReps = displayReps ?? (block.reps + block.bonusReps);
  const effectiveTime = displayTime ?? block.timeMinutes;

  const replacementDrills: Drill[] = [
    ...SEED_DRILL_CATALOG.filter((d) => starredDrills.has(d.id) && d.id !== block.drill.id),
    ...customDrills.filter((c) => c.id !== block.drill.id).map(customToDrill),
  ];

  // BUILD 107: Use timelineIndex for timeline-based sessions (multi-coach safe).
  // blockIndex is relative to coach group, timelineIndex is absolute in timeline array.
  const handleSwap = (drill: Drill) => {
    swapDrill(stationIndex, timelineIndex ?? blockIndex, drill);
    setShowPicker(false);
  };

  // BUILD 70: Get coach display info
  const coachId = block.assignedCoachId;
  const coachColors = coachId ? getCoachColor(coachId) : null;
  const coachDisplayName = staff && coachId
    ? getCoachDisplayName(coachId, staff, block.drill.category)
    : null;

  // BUILD 107: Detect custom or AI-generated drill for badge display
  // Memoized to avoid O(n) lookup on every render for every drill card
  const isCustomDrill = useMemo(
    () => customDrills.some((c) => c.id === block.drill.id),
    [customDrills, block.drill.id]
  );
  const isAIDrill = block.drill.id?.startsWith('ai-') ?? false;

  // BUILD 70: Get available coaches for picker
  const availableCoaches = staff?.coaches.filter(c => c.role === 'head' || c.isActive) || [];

  const cardContent = (
    <>
      <View style={styles.header}>
        <View style={styles.nameRow}>
          <Text style={styles.name} numberOfLines={1} ellipsizeMode="tail">{block.drill.name}</Text>
          {isCustomDrill && (
            <View style={styles.drillSourceBadge}>
              <Text style={styles.drillSourceBadgeText}>Custom</Text>
            </View>
          )}
          {isAIDrill && !isCustomDrill && (
            <View style={[styles.drillSourceBadge, styles.drillSourceBadgeAI]}>
              <Text style={styles.drillSourceBadgeText}>AI</Text>
            </View>
          )}
        </View>
        <View style={styles.headerRight}>
            {/* Reorder arrows - only show in edit mode */}
            {isEditMode && (
              <View style={styles.arrowButtons}>
                {!isFirst && onMoveUp && (
                  <TouchableOpacity
                    onPress={onMoveUp}
                    style={styles.arrowButton}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Text style={styles.arrowIcon}>{'▲'}</Text>
                  </TouchableOpacity>
                )}
                {!isLast && onMoveDown && (
                  <TouchableOpacity
                    onPress={onMoveDown}
                    style={styles.arrowButton}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Text style={styles.arrowIcon}>{'▼'}</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
            <TouchableOpacity
              onPress={() => removeDrillFromSession(stationIndex, timelineIndex ?? blockIndex)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={styles.deleteIcon}>{'\u00D7'}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleShare}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={styles.shareIcon}>{'\u2197'}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => toggleStarWithDrill(block.drill)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={[styles.star, isStarred && styles.starActive]}>
                {isStarred ? '\u2605' : '\u2606'}
              </Text>
            </TouchableOpacity>
            <CategoryBadge category={block.drill.category} />
          </View>
        </View>

        {/* BUILD 70: INTERACTIVE Coach Badge - TouchableOpacity, NOT static Text */}
        <TouchableOpacity
          style={[
            styles.coachBadge,
            coachColors
              ? { backgroundColor: coachColors.bg, borderColor: coachColors.border }
              : styles.coachBadgeUnassigned
          ]}
          onPress={() => { setShowPicker(false); setShowCoachPicker(true); }}
          hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
        >
          <Text style={[
            styles.coachBadgeText,
            coachColors ? { color: coachColors.text } : styles.coachBadgeTextUnassigned
          ]}>
            {coachDisplayName || 'Assign Coach'}
          </Text>
          <Text style={styles.coachBadgeChevron}>{'▼'}</Text>
        </TouchableOpacity>

        <Text style={styles.description}>{block.drill.description}</Text>

        {block.drill.equipment && block.drill.equipment.length > 0 && (
          <View style={styles.equipmentSection}>
            <Text style={styles.equipmentLabel}>Equipment: </Text>
            <Text style={styles.equipmentList}>{block.drill.equipment.join(', ')}</Text>
          </View>
        )}

        <View style={styles.stats}>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{effectiveReps}</Text>
            <Text style={styles.statLabel}>Reps</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.stat}>
            <Text style={styles.statValue}>{Math.round(effectiveTime)}</Text>
            <Text style={styles.statLabel}>Min</Text>
          </View>
        </View>

      {replacementDrills.length > 0 && (
        <TouchableOpacity style={styles.swapTrigger} onPress={() => { setShowCoachPicker(false); setShowPicker(true); }}>
          <Text style={styles.swapTriggerText}>Swap drill</Text>
        </TouchableOpacity>
      )}
    </>
  );

  return (
    <View>
      <View style={styles.card}>
        {cardContent}
      </View>

      {/* BUILD 107: Transition arrow between drills WITHIN same coach group only.
          showTransitionArrow controls per-group display; falls back to !isLast for backwards compat. */}
      {(showTransitionArrow !== undefined ? showTransitionArrow : !isLast) && (
        <View style={styles.transition}>
          <Text style={styles.transitionText}>{Math.round(transitionMinutes)} min transition</Text>
          <Text style={styles.arrow}>&#8595;</Text>
        </View>
      )}

      {/* Swap-picker bottom sheet */}
      {showPicker && <Modal visible transparent animationType="slide" onRequestClose={() => setShowPicker(false)}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={() => setShowPicker(false)}>
          <View style={styles.pickerSheet} onStartShouldSetResponder={() => true} onMoveShouldSetResponder={() => false}>
            <View style={styles.pickerHandle} />
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>Swap Drill</Text>
              <TouchableOpacity onPress={() => setShowPicker(false)}>
                <Text style={styles.pickerClose}>{'\u00D7'}</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.pickerList}>
              {replacementDrills.map((drill) => {
                const isCustom = customDrills.some((c) => c.id === drill.id);
                return (
                  <TouchableOpacity key={drill.id} style={styles.pickerRow} onPress={() => handleSwap(drill)}>
                    <View style={styles.pickerRowInfo}>
                      <View style={styles.pickerRowTop}>
                        <Text style={styles.pickerDrillName} numberOfLines={1} ellipsizeMode="tail">{drill.name}</Text>
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
      </Modal>}

      {/* BUILD 70: Coach Picker Modal */}
      {showCoachPicker && (
        <Modal visible transparent animationType="slide" onRequestClose={() => setShowCoachPicker(false)}>
          <TouchableOpacity
            style={styles.backdrop}
            activeOpacity={1}
            onPress={() => setShowCoachPicker(false)}
          >
            <View style={styles.pickerSheet} onStartShouldSetResponder={() => true} onMoveShouldSetResponder={() => false}>
              <View style={styles.pickerHandle} />
              <View style={styles.pickerHeader}>
                <Text style={styles.pickerTitle}>Assign Coach</Text>
                <TouchableOpacity onPress={() => setShowCoachPicker(false)}>
                  <Text style={styles.pickerClose}>{'\u00D7'}</Text>
                </TouchableOpacity>
              </View>
              <ScrollView style={styles.pickerList}>
                {availableCoaches.map((coach) => {
                  const colors = getCoachColor(coach.id);
                  const isSelected = coach.id === coachId;
                  return (
                    <TouchableOpacity
                      key={coach.id}
                      style={[styles.coachPickerRow, isSelected && styles.coachPickerRowSelected]}
                      onPress={() => handleSelectCoach(coach)}
                    >
                      <View style={[
                        styles.coachPickerBadge,
                        colors && { backgroundColor: colors.bg, borderColor: colors.border }
                      ]}>
                        <Text style={[
                          styles.coachPickerBadgeText,
                          colors && { color: colors.text }
                        ]}>
                          {coach.role === 'head' ? 'HC' : `A${coach.placeholderIndex || ''}`}
                        </Text>
                      </View>
                      <View style={styles.coachPickerInfo}>
                        <Text style={styles.coachPickerName} numberOfLines={1} ellipsizeMode="tail">{coach.name}</Text>
                        {coach.specialties.length > 0 && (
                          <Text style={styles.coachPickerSpecialties} numberOfLines={1} ellipsizeMode="tail">
                            {coach.specialties.map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(', ')}
                          </Text>
                        )}
                      </View>
                      {isSelected && (
                        <Text style={styles.coachPickerCheck}>{'✓'}</Text>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
              <View style={styles.coachPickerHint}>
                <Text style={styles.coachPickerHintText}>
                  Manual assignments are locked and won't be changed by auto-assignment
                </Text>
              </View>
            </View>
          </TouchableOpacity>
        </Modal>
      )}
    </View>
  );
});

export default DrillCard;

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    shadowColor: '#1B4332',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 6,
  },
  name: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
    flexShrink: 1,
  },
  drillSourceBadge: {
    backgroundColor: '#E0F2FE',
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  drillSourceBadgeAI: {
    backgroundColor: '#F3E8FF',
  },
  drillSourceBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#374151',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  arrowButtons: {
    flexDirection: 'column',
    gap: 2,
    marginRight: 4,
  },
  arrowButton: {
    paddingHorizontal: 4,
  },
  arrowIcon: {
    fontSize: 14,
    color: '#1B4332',
    fontWeight: '700',
  },
  deleteIcon: {
    fontSize: 22,
    color: '#EF4444',
    fontWeight: '700',
  },
  shareIcon: {
    fontSize: 18,
    color: '#3B82F6',
  },
  star: {
    fontSize: 18,
    color: '#D1D5DB',
  },
  starActive: {
    color: '#D4AF37',
  },
  // BUILD 70: Interactive coach badge styles
  coachBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 8,
    gap: 4,
  },
  coachBadgeUnassigned: {
    backgroundColor: '#FEF3C7',
    borderColor: '#F59E0B',
  },
  coachBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  coachBadgeTextUnassigned: {
    color: '#B45309',
  },
  coachBadgeChevron: {
    fontSize: 8,
    color: '#6B7280',
    marginLeft: 2,
  },
  description: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 10,
    lineHeight: 18,
  },
  equipmentSection: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 10,
  },
  equipmentLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
  },
  equipmentList: {
    fontSize: 12,
    color: '#6B7280',
    flex: 1,
  },
  stats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  stat: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1B4332',
  },
  statLabel: {
    fontSize: 10,
    color: '#9CA3AF',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 1,
  },
  bonusValue: {
    color: '#D4AF37',
  },
  openValue: {
    color: '#6B7280',
  },
  divider: {
    width: 1,
    height: 28,
    backgroundColor: '#E5E7EB',
  },
  transition: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  transitionText: {
    fontSize: 11,
    color: '#9CA3AF',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontWeight: '600',
  },
  arrow: {
    fontSize: 20,
    color: '#D4AF37',
    marginTop: 2,
  },

  // ── Swap trigger ──
  swapTrigger: {
    marginTop: 10,
    alignItems: 'center',
  },
  swapTriggerText: {
    fontSize: 12,
    color: '#1B4332',
    fontWeight: '500',
  },

  // ── Swap picker bottom sheet ──
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'flex-end',
  },
  pickerSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingBottom: 34,
    maxHeight: '60%',
  },
  pickerHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
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

  // BUILD 70: Coach picker styles
  coachPickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  coachPickerRowSelected: {
    backgroundColor: '#F0FDF4',
  },
  coachPickerBadge: {
    width: 36,
    height: 36,
    borderRadius: 8,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    backgroundColor: '#F0FDF4',
    borderColor: '#BBF7D0',
  },
  coachPickerBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#166534',
  },
  coachPickerInfo: {
    flex: 1,
  },
  coachPickerName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
  },
  coachPickerSpecialties: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  coachPickerCheck: {
    fontSize: 18,
    color: '#16A34A',
    fontWeight: '700',
  },
  coachPickerHint: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    backgroundColor: '#FFFBEB',
  },
  coachPickerHintText: {
    fontSize: 11,
    color: '#92400E',
    textAlign: 'center',
    lineHeight: 15,
  },
});
