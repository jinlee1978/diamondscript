import React, { useState, useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Modal, StyleSheet, Share } from 'react-native';
import { Stack } from 'expo-router';
import { usePractice, CustomDrill } from '../context/PracticeContext';
import { Drill, PracticeSession } from '../src/data/types';
import StationCard from '../components/StationCard';
import CategoryBadge from '../components/CategoryBadge';
import UpgradeBanner from '../components/UpgradeBanner';
import { filterCandidates } from '../src/core/engine/drillSelector';
import { SEED_DRILL_CATALOG } from '../src/data/seedDrills';

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

function formatSessionForShare(session: PracticeSession): string {
  const { warmupMinutes, cooldownMinutes, stationLayout, request } = session;
  const ageLabel = formatAgeGroup(request.ageGroup);
  const COACH_LABELS = ['Head Coach', 'Assistant 1', 'Assistant 2', 'Assistant 3'];

  const lines: string[] = [
    '\u2014 DiamondScript Practice \u2014',
    `${ageLabel} \u00B7 ${stationLayout.totalWallClockMinutes} min`,
    '',
    `Warm-Up: ${warmupMinutes} min`,
    'Stretch, light jog, arm circles',
    '',
  ];

  stationLayout.stations.forEach((station, i) => {
    const coachLabel = COACH_LABELS[station.coachIndex] ?? `Coach ${station.coachIndex + 1}`;
    lines.push(`Station ${i + 1} \u2014 ${coachLabel}`);
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

  lines.push(`Cool-Down: ${cooldownMinutes} min`);
  lines.push('Cool stretches, hydrate, recap');
  lines.push('');
  lines.push(`Total: ${stationLayout.totalWallClockMinutes} min`);

  return lines.join('\n');
}

export default function PracticeScreen() {
  const { tier, currentSession, customDrills, addDrillToSession } = usePractice();
  const [showAddPicker, setShowAddPicker] = useState(false);

  if (!currentSession) {
    return (
      <View style={styles.container}>
        <Text style={styles.empty}>No practice generated yet. Go back and tap Go.</Text>
      </View>
    );
  }

  const { warmupMinutes, cooldownMinutes, stationLayout, request, selectedDrills } = currentSession;

  // Memoize expensive drill filtering calculations
  const { hasShortfall, upgradeHelps, canAddDrill, addableDrills } = useMemo(() => {
    // Did the engine return fewer drills than requested?
    const shortfall = selectedDrills.length < request.numDrills;
    // Would upgrading to Pro unlock more drills for this age group?
    const proPoolSize = shortfall
      ? filterCandidates(SEED_DRILL_CATALOG, request.ageGroup, 'pro').length
      : 0;
    const helps = shortfall && proPoolSize > selectedDrills.length;

    // Add-drill: free on T-Ball, Pro required for 8U–14U
    const canAdd = tier === 'pro' || request.ageGroup === 'T_BALL';
    const sessionDrillIds = new Set(
      stationLayout.stations.flatMap((s) => s.drills.map((b) => b.drill.id)),
    );
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
  }, [selectedDrills.length, request.numDrills, request.ageGroup, tier, stationLayout.stations, customDrills]);

  const handleShare = async () => {
    try {
      await Share.share({
        title: `DiamondScript — ${formatAgeGroup(request.ageGroup)} Practice`,
        message: formatSessionForShare(currentSession),
      });
    } catch {
      // User cancelled or share failed
    }
  };

  return (
    <>
    <Stack.Screen
      options={{
        headerRight: ({ tintColor }) => (
          <TouchableOpacity onPress={handleShare} style={{ paddingRight: 16 }}>
            <Text style={{ color: tintColor, fontSize: 15, fontWeight: '500' }}>Share</Text>
          </TouchableOpacity>
        ),
      }}
    />
    <ScrollView style={styles.scroll} contentContainerStyle={styles.container}>
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
            Only {selectedDrills.length} drills available for {formatAgeGroup(request.ageGroup)} — try requesting {selectedDrills.length} or fewer.
          </Text>
        </View>
      )}

      {/* Warmup block */}
      <View style={styles.bookendCard}>
        <Text style={styles.bookendLabel}>Warm-Up</Text>
        <Text style={styles.bookendDuration}>{warmupMinutes} min</Text>
        <Text style={styles.bookendNote}>Stretch, light jog, arm circles</Text>
      </View>

      {/* Station cards */}
      {stationLayout.stations.map((station, i) => (
        <StationCard
          key={station.coachIndex}
          station={station}
          stationIndex={i}
          transitionMinutes={stationLayout.transitionTimeMinutes}
        />
      ))}

      {/* Add-drill button / upgrade nudge */}
      {canAddDrill && addableDrills.length > 0 ? (
        <TouchableOpacity style={styles.addDrillButton} onPress={() => setShowAddPicker(true)}>
          <Text style={styles.addDrillButtonText}>+ Add Drill</Text>
        </TouchableOpacity>
      ) : !canAddDrill && (
        <View style={styles.addDrillNudge}>
          <UpgradeBanner feature="adding drills to a practice" />
        </View>
      )}

      {/* Cooldown block */}
      <View style={styles.bookendCard}>
        <Text style={styles.bookendLabel}>Cool-Down</Text>
        <Text style={styles.bookendDuration}>{cooldownMinutes} min</Text>
        <Text style={styles.bookendNote}>Cool stretches, hydrate, recap</Text>
      </View>

      {/* Footer: total wall clock confirmation */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>
          Total practice: <Text style={styles.footerBold}>{stationLayout.totalWallClockMinutes} minutes</Text>
        </Text>
        {stationLayout.stations.length > 1 && (
          <Text style={styles.footerSub}>
            {stationLayout.stations.length} parallel stations running simultaneously
          </Text>
        )}
      </View>

    </ScrollView>

    {/* Add-drill picker bottom sheet — rendered outside ScrollView to avoid key-collision warnings */}
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
    </>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: '#FAFAFA',
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

  // Catalog-cap note (shown when Pro wouldn't help either)
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

  // ── Add-drill button / nudge ──
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

  // ── Add-drill picker bottom sheet ──
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
