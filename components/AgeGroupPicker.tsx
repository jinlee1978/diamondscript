import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { AgeGroup } from '../src/data/types';

const AGE_GROUP_ORDER: AgeGroup[] = [
  AgeGroup.T_BALL,
  AgeGroup.AGE_8U,
  AgeGroup.AGE_10U,
  AgeGroup.AGE_12U,
  AgeGroup.AGE_14U,
];

const AGE_GROUP_LABELS: Record<AgeGroup, string> = {
  [AgeGroup.T_BALL]: 'T-Ball',
  [AgeGroup.AGE_8U]: '8U',
  [AgeGroup.AGE_10U]: '10U',
  [AgeGroup.AGE_12U]: '12U',
  [AgeGroup.AGE_14U]: '14U',
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
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    marginRight: 8,
  },
  chipSelected: {
    backgroundColor: '#1B4332',
  },
  chipText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#374151',
  },
  chipTextSelected: {
    color: '#FFFFFF',
  },
});
