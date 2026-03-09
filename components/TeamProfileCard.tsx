/**
 * BUILD 100: Team Profile Card Component
 *
 * Displays a team profile with name, age group, and color indicator.
 * Tappable to switch active team. Long-press or edit button for management.
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { TeamProfile } from '../src/data/types/teamProfile';
import { AgeGroup } from '../src/data/types';

const AGE_GROUP_DISPLAY: Record<string, string> = {
  [AgeGroup.INTRO]: 'Intro (3-4)',
  [AgeGroup.T_BALL]: 'T-Ball (5-6)',
  [AgeGroup.COACH_PITCH]: 'Coach Pitch (7-8)',
  [AgeGroup.MACHINE_PITCH]: 'Machine Pitch (8-9)',
  [AgeGroup.KID_PITCH]: 'Kid Pitch (9-10)',
  [AgeGroup.COMPETITIVE]: '11-12U',
  [AgeGroup.ADVANCED]: '13-14U',
};

const EXPERIENCE_LABELS: Record<number, string> = {
  0: 'First Year',
  1: 'Beginner',
  2: 'Developing',
  3: 'Intermediate',
  4: 'Advanced',
  5: 'Veteran',
};

interface Props {
  profile: TeamProfile;
  isActive: boolean;
  onPress: () => void;
  onEdit: () => void;
}

export default function TeamProfileCard({ profile, isActive, onPress, onEdit }: Props) {
  return (
    <TouchableOpacity
      style={[
        styles.card,
        { borderLeftColor: profile.color },
        isActive && styles.cardActive,
      ]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.content}>
        <View style={styles.header}>
          <View style={styles.nameRow}>
            <View style={[styles.colorDot, { backgroundColor: profile.color }]} />
            <Text style={styles.name} numberOfLines={1}>{profile.name}</Text>
            {isActive && (
              <View style={styles.activeBadge}>
                <Text style={styles.activeBadgeText}>Active</Text>
              </View>
            )}
          </View>
          <TouchableOpacity onPress={onEdit} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="ellipsis-horizontal" size={20} color="#6B7280" />
          </TouchableOpacity>
        </View>

        <View style={styles.details}>
          <Text style={styles.detailText}>
            {AGE_GROUP_DISPLAY[profile.ageGroup] ?? profile.ageGroup}
          </Text>
          <Text style={styles.detailDot}>{'\u00B7'}</Text>
          <Text style={styles.detailText}>
            {EXPERIENCE_LABELS[profile.experienceLevel] ?? 'Developing'}
          </Text>
          <Text style={styles.detailDot}>{'\u00B7'}</Text>
          <Text style={styles.detailText}>
            {profile.assistantCoaches === 0 ? 'Solo' : `${profile.assistantCoaches + 1} coaches`}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#1B4332',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  cardActive: {
    borderWidth: 1.5,
    borderColor: '#D4AF37',
    shadowColor: '#D4AF37',
    shadowOpacity: 0.15,
  },
  content: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  colorDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
  },
  name: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111827',
    flex: 1,
  },
  activeBadge: {
    backgroundColor: '#D4AF37',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginLeft: 8,
  },
  activeBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  details: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  detailText: {
    fontSize: 13,
    color: '#6B7280',
  },
  detailDot: {
    fontSize: 13,
    color: '#D1D5DB',
    marginHorizontal: 6,
  },
});
