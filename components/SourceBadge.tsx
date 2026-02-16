import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { PracticeSource } from '../src/data/types';

interface Props {
  source: PracticeSource;
  size?: 'small' | 'medium';
}

/**
 * BUILD 63: Source badge component for practice origin tracking
 * Displays color-coded badges: AI (Gold), Manual (Green), Library (Blue)
 */
export default function SourceBadge({ source, size = 'small' }: Props) {
  const config = {
    ai: {
      label: '✨ AI Generated',
      backgroundColor: '#FEF3C7', // Gold background
      textColor: '#92400E', // Dark gold text
      borderColor: '#D4AF37', // Gold border
    },
    manual: {
      label: '👤 Coach Created',
      backgroundColor: '#D1FAE5', // Light green background
      textColor: '#065F46', // Dark green text
      borderColor: '#059669', // Green border
    },
    library: {
      label: '📦 App Library',
      backgroundColor: '#DBEAFE', // Light blue background
      textColor: '#1E40AF', // Dark blue text
      borderColor: '#3B82F6', // Blue border
    },
  };

  const badgeConfig = config[source];
  const isMedium = size === 'medium';

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: badgeConfig.backgroundColor,
          borderColor: badgeConfig.borderColor,
        },
        isMedium && styles.badgeMedium,
      ]}
    >
      <Text
        style={[
          styles.badgeText,
          { color: badgeConfig.textColor },
          isMedium && styles.badgeTextMedium,
        ]}
      >
        {badgeConfig.label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderRadius: 6,
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 2,
    alignSelf: 'flex-start',
  },
  badgeMedium: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  badgeTextMedium: {
    fontSize: 12,
  },
});
