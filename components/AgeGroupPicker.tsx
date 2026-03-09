import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { AgeGroup } from '../src/data/types';

/**
 * BUILD 100: Expanded from 5 → 7 age groups.
 * Uses horizontal scroll to accommodate the wider range.
 * Each chip shows the group name + age range sublabel.
 */
const AGE_GROUP_ORDER: AgeGroup[] = [
  AgeGroup.INTRO,
  AgeGroup.T_BALL,
  AgeGroup.COACH_PITCH,
  AgeGroup.MACHINE_PITCH,
  AgeGroup.KID_PITCH,
  AgeGroup.COMPETITIVE,
  AgeGroup.ADVANCED,
];

const AGE_GROUP_LABELS: Record<AgeGroup, string> = {
  [AgeGroup.INTRO]: 'Intro',
  [AgeGroup.T_BALL]: 'T-Ball',
  [AgeGroup.COACH_PITCH]: 'Coach Pitch',
  [AgeGroup.MACHINE_PITCH]: 'Machine',
  [AgeGroup.KID_PITCH]: 'Kid Pitch',
  [AgeGroup.COMPETITIVE]: '11-12U',
  [AgeGroup.ADVANCED]: '13-14U',
};

const AGE_GROUP_SUBLABELS: Record<AgeGroup, string> = {
  [AgeGroup.INTRO]: '3-4',
  [AgeGroup.T_BALL]: '5-6',
  [AgeGroup.COACH_PITCH]: '7-8',
  [AgeGroup.MACHINE_PITCH]: '8-9',
  [AgeGroup.KID_PITCH]: '9-10',
  [AgeGroup.COMPETITIVE]: '11-12',
  [AgeGroup.ADVANCED]: '13-14',
};

interface Props {
  value: AgeGroup;
  onChange: (group: AgeGroup) => void;
}

export default function AgeGroupPicker({ value, onChange }: Props) {
  return (
    <View>
      <Text style={styles.label}>Age Group</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.scroll}>
        {AGE_GROUP_ORDER.map((group) => {
          const selected = group === value;
          return (
            <TouchableOpacity
              key={group}
              style={[styles.chip, selected && styles.chipSelected]}
              onPress={() => onChange(group)}
              activeOpacity={0.7}
            >
              <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                {AGE_GROUP_LABELS[group]}
              </Text>
              <Text style={[styles.chipSub, selected && styles.chipSubSelected]}>
                {AGE_GROUP_SUBLABELS[group]}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  scroll: {
    flexDirection: 'row',
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    marginRight: 8,
    alignItems: 'center',
    minWidth: 64,
  },
  chipSelected: {
    backgroundColor: '#1B4332',
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
  },
  chipTextSelected: {
    color: '#FFFFFF',
  },
  chipSub: {
    fontSize: 10,
    fontWeight: '500',
    color: '#9CA3AF',
    marginTop: 1,
  },
  chipSubSelected: {
    color: '#86EFAC',
  },
});
