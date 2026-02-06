import React from 'react';
import { Text, StyleSheet, View } from 'react-native';
import { DrillCategory } from '../src/data/types';

const CATEGORY_COLORS: Record<DrillCategory, { bg: string; text: string }> = {
  hitting:     { bg: '#D4AF37', text: '#111827' },  // gold
  fielding:    { bg: '#1B4332', text: '#FFFFFF' },  // forest green
  pitching:    { bg: '#2563EB', text: '#FFFFFF' },  // blue
  baserunning: { bg: '#EA580C', text: '#FFFFFF' },  // orange
};

const CATEGORY_LABELS: Record<DrillCategory, string> = {
  hitting:     'Hitting',
  fielding:    'Fielding',
  pitching:    'Pitching',
  baserunning: 'Running',
};

interface Props {
  category: DrillCategory;
}

export default function CategoryBadge({ category }: Props) {
  const { bg, text } = CATEGORY_COLORS[category];

  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <Text style={[styles.label, { color: text }]}>{'◆ '}{CATEGORY_LABELS[category]}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 2,
    elevation: 2,
  },
  label: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
});
