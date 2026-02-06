import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Station } from '../src/data/types';
import DrillCard from './DrillCard';

interface Props {
  station: Station;
  stationIndex: number;
  transitionMinutes: number;
}

const COACH_LABELS = ['Head Coach', 'Assistant 1', 'Assistant 2', 'Assistant 3'];

export default function StationCard({ station, stationIndex, transitionMinutes }: Props) {
  const coachLabel = COACH_LABELS[station.coachIndex] ?? `Coach ${station.coachIndex + 1}`;

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
            transitionMinutes={transitionMinutes}
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
