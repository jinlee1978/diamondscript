import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Modal, ScrollView, StyleSheet } from 'react-native';
import { DrillBlock, Drill } from '../src/data/types';
import { usePractice, CustomDrill } from '../context/PracticeContext';
import { SEED_DRILL_CATALOG } from '../src/data/seedDrills';
import CategoryBadge from './CategoryBadge';

interface Props {
  block: DrillBlock;
  stationIndex: number;
  blockIndex: number;
  isLast: boolean;
  transitionMinutes: number;
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

export default function DrillCard({ block, stationIndex, blockIndex, isLast, transitionMinutes }: Props) {
  const { starredDrills, toggleStar, customDrills, swapDrill } = usePractice();
  const isStarred = starredDrills.has(block.drill.id);
  const totalReps = block.reps + block.bonusReps;
  const [showPicker, setShowPicker] = useState(false);

  const replacementDrills: Drill[] = [
    ...SEED_DRILL_CATALOG.filter((d) => starredDrills.has(d.id) && d.id !== block.drill.id),
    ...customDrills.filter((c) => c.id !== block.drill.id).map(customToDrill),
  ];

  const handleSwap = (drill: Drill) => {
    swapDrill(stationIndex, blockIndex, drill);
    setShowPicker(false);
  };

  return (
    <View>
      <View style={styles.card}>
        <View style={styles.header}>
          <Text style={styles.name}>{block.drill.name}</Text>
          <View style={styles.headerRight}>
            <TouchableOpacity
              onPress={() => toggleStar(block.drill.id)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={[styles.star, isStarred && styles.starActive]}>
                {isStarred ? '\u2605' : '\u2606'}
              </Text>
            </TouchableOpacity>
            <CategoryBadge category={block.drill.category} />
          </View>
        </View>

        <Text style={styles.description}>{block.drill.description}</Text>

        {block.drill.equipment && block.drill.equipment.length > 0 && (
          <View style={styles.equipmentSection}>
            <Text style={styles.equipmentLabel}>Equipment: </Text>
            <Text style={styles.equipmentList}>{block.drill.equipment.join(', ')}</Text>
          </View>
        )}

        <View style={styles.stats}>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{totalReps}</Text>
            <Text style={styles.statLabel}>Reps</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.stat}>
            <Text style={styles.statValue}>{block.timeMinutes.toFixed(1)}</Text>
            <Text style={styles.statLabel}>Min</Text>
          </View>
          {block.bonusReps > 0 && (
            <>
              <View style={styles.divider} />
              <View style={styles.stat}>
                <Text style={[styles.statValue, styles.bonusValue]}>+{block.bonusReps}</Text>
                <Text style={styles.statLabel}>Bonus</Text>
              </View>
            </>
          )}
          {block.openTimeMinutes > 0 && (
            <>
              <View style={styles.divider} />
              <View style={styles.stat}>
                <Text style={[styles.statValue, styles.openValue]}>{block.openTimeMinutes.toFixed(1)}</Text>
                <Text style={styles.statLabel}>Open</Text>
              </View>
            </>
          )}
        </View>

        {replacementDrills.length > 0 && (
          <TouchableOpacity style={styles.swapTrigger} onPress={() => setShowPicker(true)}>
            <Text style={styles.swapTriggerText}>Swap drill</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Transition arrow between drills */}
      {!isLast && (
        <View style={styles.transition}>
          <Text style={styles.transitionText}>{transitionMinutes} min transition</Text>
          <Text style={styles.arrow}>&#8595;</Text>
        </View>
      )}

      {/* Swap-picker bottom sheet */}
      {showPicker && <Modal visible transparent animationType="slide">
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={() => setShowPicker(false)}>
          <View style={styles.pickerSheet} onStartShouldSetResponder={() => true}>
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
      </Modal>}
    </View>
  );
}

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
  name: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
    flex: 1,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  star: {
    fontSize: 18,
    color: '#D1D5DB',
  },
  starActive: {
    color: '#D4AF37',
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
});
