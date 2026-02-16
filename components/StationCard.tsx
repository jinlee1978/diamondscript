import React, { useCallback } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Station, DrillBlock } from '../src/data/types';
import DrillCard from './DrillCard';
import { usePractice } from '../context/PracticeContext';

interface Props {
  station: Station;
  stationIndex: number;
  transitionMinutes: number;
  isEditMode?: boolean;
  coachNames?: string[]; // BUILD 64: Optional custom coach names
}

const COACH_LABELS = ['Head Coach', 'Assistant 1', 'Assistant 2', 'Assistant 3'];

export default function StationCard({ station, stationIndex, transitionMinutes, isEditMode = false, coachNames }: Props) {
  const { tier, reorderDrillsInStation } = usePractice();

  // BUILD 64: Use custom coach name if available, otherwise fall back to default labels
  const coachLabel = coachNames && coachNames[station.coachIndex]
    ? coachNames[station.coachIndex]
    : (COACH_LABELS[station.coachIndex] ?? `Coach ${station.coachIndex + 1}`);

  const isPro = tier === 'pro';
  const canReorder = isPro && isEditMode && station.drills.length > 1;

  // BUILD 63: Arrow-based swap - move drill up (swap with previous)
  const handleMoveUp = useCallback(
    (blockIndex: number) => {
      if (blockIndex <= 0) return;

      const newOrder = [...station.drills];
      [newOrder[blockIndex - 1], newOrder[blockIndex]] = [newOrder[blockIndex], newOrder[blockIndex - 1]];

      reorderDrillsInStation(stationIndex, newOrder);
    },
    [station.drills, stationIndex, reorderDrillsInStation]
  );

  // BUILD 63: Arrow-based swap - move drill down (swap with next)
  const handleMoveDown = useCallback(
    (blockIndex: number) => {
      if (blockIndex >= station.drills.length - 1) return;

      const newOrder = [...station.drills];
      [newOrder[blockIndex], newOrder[blockIndex + 1]] = [newOrder[blockIndex + 1], newOrder[blockIndex]];

      reorderDrillsInStation(stationIndex, newOrder);
    },
    [station.drills, stationIndex, reorderDrillsInStation]
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.coachBadge}>
          <Text style={styles.coachLabel}>{coachLabel}</Text>
        </View>
        <Text style={styles.stationLabel}>Station {station.coachIndex + 1}</Text>
      </View>

      <View style={styles.drills}>
        {station.drills.map((block, i) => (
          <DrillCard
            key={block.drill.id}
            block={block}
            stationIndex={stationIndex}
            blockIndex={i}
            isLast={i === station.drills.length - 1}
            isFirst={i === 0}
            transitionMinutes={transitionMinutes}
            isEditMode={isEditMode && canReorder}
            onMoveUp={canReorder ? () => handleMoveUp(i) : undefined}
            onMoveDown={canReorder ? () => handleMoveDown(i) : undefined}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    overflow: 'hidden',
    marginBottom: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: '#F9FAFB',
  },
  coachBadge: {
    backgroundColor: '#1B4332',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  coachLabel: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  stationLabel: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
  },
  drills: {
    padding: 12,
    gap: 0,
  },
});
