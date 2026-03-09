/**
 * BUILD 106: Category Badge with Icons
 *
 * Replaces diamond character with sport-specific Ionicons.
 * Uses centralized theme colors.
 */

import React from 'react';
import { Text, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { DrillCategory } from '../src/data/types';
import { colors, radii } from '../src/theme';

const CATEGORY_CONFIG: Record<DrillCategory, {
  bg: string; text: string; icon: keyof typeof Ionicons.glyphMap; label: string;
}> = {
  hitting:     { bg: colors.hitting, text: '#111827', icon: 'baseball-outline', label: 'Hitting' },
  fielding:    { bg: colors.fielding, text: '#FFFFFF', icon: 'hand-left-outline', label: 'Fielding' },
  pitching:    { bg: colors.pitching, text: '#FFFFFF', icon: 'fitness-outline', label: 'Pitching' },
  baserunning: { bg: colors.baserunning, text: '#FFFFFF', icon: 'footsteps-outline', label: 'Running' },
};

interface Props {
  category: DrillCategory;
  size?: 'small' | 'medium';
}

export default function CategoryBadge({ category, size = 'small' }: Props) {
  const config = CATEGORY_CONFIG[category];
  const isMedium = size === 'medium';

  return (
    <View style={[styles.badge, { backgroundColor: config.bg }, isMedium && styles.badgeMedium]}>
      <Ionicons
        name={config.icon}
        size={isMedium ? 12 : 10}
        color={config.text}
      />
      <Text style={[styles.label, { color: config.text }, isMedium && styles.labelMedium]}>
        {config.label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radii.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  badgeMedium: {
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  label: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  labelMedium: {
    fontSize: 11,
  },
});
