/**
 * BUILD 100: Team Form Modal
 *
 * Reusable modal for creating and editing team profiles.
 * Shows name input, age group picker, experience stepper,
 * and color selector.
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  ScrollView,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { AgeGroup } from '../src/data/types';
import { TeamProfile, TEAM_COLORS, TEAM_COLOR_NAMES } from '../src/data/types/teamProfile';

const AGE_GROUP_OPTIONS: { value: AgeGroup; label: string; sub: string }[] = [
  { value: AgeGroup.INTRO, label: 'Intro', sub: '3-4' },
  { value: AgeGroup.T_BALL, label: 'T-Ball', sub: '5-6' },
  { value: AgeGroup.COACH_PITCH, label: 'Coach Pitch', sub: '7-8' },
  { value: AgeGroup.MACHINE_PITCH, label: 'Machine Pitch', sub: '8-9' },
  { value: AgeGroup.KID_PITCH, label: 'Kid Pitch', sub: '9-10' },
  { value: AgeGroup.COMPETITIVE, label: '11-12U', sub: '11-12' },
  { value: AgeGroup.ADVANCED, label: '13-14U', sub: '13-14' },
];

const EXPERIENCE_LABELS: Record<number, string> = {
  0: 'First Year',
  1: 'Beginner',
  2: 'Developing',
  3: 'Intermediate',
  4: 'Advanced',
  5: 'Veteran',
};

interface Props {
  visible: boolean;
  onClose: () => void;
  onSave: (data: {
    name: string;
    ageGroup: AgeGroup;
    experienceLevel: number;
    intensity: number;
    assistantCoaches: number;
    color: string;
  }) => void;
  /** If provided, we're editing an existing profile */
  editProfile?: TeamProfile | null;
  /** Colors already in use by other teams (for smart color picking) */
  usedColors?: string[];
}

export default function TeamFormModal({
  visible,
  onClose,
  onSave,
  editProfile,
  usedColors = [],
}: Props) {
  const [name, setName] = useState('');
  const [ageGroup, setAgeGroup] = useState<AgeGroup>(AgeGroup.KID_PITCH);
  const [experience, setExperience] = useState(2);
  const [intensity, setIntensity] = useState(3);
  const [assistants, setAssistants] = useState(0);
  const [color, setColor] = useState(TEAM_COLORS[0]);

  // Reset form when modal opens
  useEffect(() => {
    if (visible) {
      if (editProfile) {
        setName(editProfile.name);
        setAgeGroup(editProfile.ageGroup);
        setExperience(editProfile.experienceLevel);
        setIntensity(editProfile.intensity);
        setAssistants(editProfile.assistantCoaches);
        setColor(editProfile.color);
      } else {
        setName('');
        setAgeGroup(AgeGroup.KID_PITCH);
        setExperience(2);
        setIntensity(3);
        setAssistants(0);
        // Pick first unused color
        const available = TEAM_COLORS.find(c => !usedColors.includes(c));
        setColor(available ?? TEAM_COLORS[0]);
      }
    }
  }, [visible, editProfile, usedColors]);

  const handleSave = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    onSave({
      name: trimmed,
      ageGroup,
      experienceLevel: experience,
      intensity,
      assistantCoaches: assistants,
      color,
    });
  };

  const isEditing = !!editProfile;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.sheet}>
          <View style={styles.handle} />

          <ScrollView showsVerticalScrollIndicator={false}>
            <Text style={styles.title}>
              {isEditing ? 'Edit Team' : 'New Team'}
            </Text>

            {/* Team Name */}
            <Text style={styles.sectionLabel}>Team Name</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="e.g. Red Sox 10U"
              placeholderTextColor="#9CA3AF"
              maxLength={40}
              autoFocus={!isEditing}
            />

            {/* Age Group */}
            <Text style={styles.sectionLabel}>Age Group</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
              {AGE_GROUP_OPTIONS.map(opt => {
                const selected = opt.value === ageGroup;
                return (
                  <TouchableOpacity
                    key={opt.value}
                    style={[styles.chip, selected && styles.chipSelected]}
                    onPress={() => setAgeGroup(opt.value)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                      {opt.label}
                    </Text>
                    <Text style={[styles.chipSub, selected && styles.chipSubSelected]}>
                      {opt.sub}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Experience Level */}
            <Text style={styles.sectionLabel}>Experience Level</Text>
            <View style={styles.stepperRow}>
              <TouchableOpacity
                style={styles.stepperButton}
                onPress={() => setExperience(Math.max(0, experience - 1))}
                disabled={experience <= 0}
              >
                <Text style={[styles.stepperButtonText, experience <= 0 && styles.stepperDisabled]}>
                  {'\u2212'}
                </Text>
              </TouchableOpacity>
              <View style={styles.stepperValue}>
                <Text style={styles.stepperValueText}>{experience}</Text>
                <Text style={styles.stepperLabel}>{EXPERIENCE_LABELS[experience]}</Text>
              </View>
              <TouchableOpacity
                style={styles.stepperButton}
                onPress={() => setExperience(Math.min(5, experience + 1))}
                disabled={experience >= 5}
              >
                <Text style={[styles.stepperButtonText, experience >= 5 && styles.stepperDisabled]}>+</Text>
              </TouchableOpacity>
            </View>

            {/* Assistants */}
            <Text style={styles.sectionLabel}>Assistant Coaches</Text>
            <View style={styles.stepperRow}>
              <TouchableOpacity
                style={styles.stepperButton}
                onPress={() => setAssistants(Math.max(0, assistants - 1))}
                disabled={assistants <= 0}
              >
                <Text style={[styles.stepperButtonText, assistants <= 0 && styles.stepperDisabled]}>
                  {'\u2212'}
                </Text>
              </TouchableOpacity>
              <View style={styles.stepperValue}>
                <Text style={styles.stepperValueText}>{assistants}</Text>
                <Text style={styles.stepperLabel}>
                  {assistants === 0 ? 'Solo' : `${assistants + 1} total`}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.stepperButton}
                onPress={() => setAssistants(Math.min(3, assistants + 1))}
                disabled={assistants >= 3}
              >
                <Text style={[styles.stepperButtonText, assistants >= 3 && styles.stepperDisabled]}>+</Text>
              </TouchableOpacity>
            </View>

            {/* Team Color */}
            <Text style={styles.sectionLabel}>Team Color</Text>
            <View style={styles.colorRow}>
              {TEAM_COLORS.map(c => {
                const isSelected = c === color;
                return (
                  <TouchableOpacity
                    key={c}
                    style={[
                      styles.colorDot,
                      { backgroundColor: c },
                      isSelected && styles.colorDotSelected,
                    ]}
                    onPress={() => setColor(c)}
                  >
                    {isSelected && <View style={styles.colorCheck} />}
                  </TouchableOpacity>
                );
              })}
            </View>
            <Text style={styles.colorName}>{TEAM_COLOR_NAMES[color] ?? 'Custom'}</Text>

            {/* Action Buttons */}
            <View style={styles.actions}>
              <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveButton, !name.trim() && styles.saveButtonDisabled]}
                onPress={handleSave}
                disabled={!name.trim()}
              >
                <Text style={styles.saveButtonText}>
                  {isEditing ? 'Save Changes' : 'Create Team'}
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingBottom: 40,
    maxHeight: '90%',
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: '#D1D5DB',
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 20,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 8,
    marginTop: 16,
  },
  input: {
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    color: '#111827',
    backgroundColor: '#FAFAFA',
  },
  chipScroll: {
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
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  stepperButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  stepperButtonText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1B4332',
  },
  stepperDisabled: {
    color: '#D1D5DB',
  },
  stepperValue: {
    alignItems: 'center',
    minWidth: 80,
  },
  stepperValueText: {
    fontSize: 28,
    fontWeight: '700',
    color: '#111827',
  },
  stepperLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  colorRow: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'center',
  },
  colorDot: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  colorDotSelected: {
    borderWidth: 3,
    borderColor: '#D4AF37',
  },
  colorCheck: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#FFFFFF',
  },
  colorName: {
    textAlign: 'center',
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 6,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 28,
    marginBottom: 8,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#6B7280',
  },
  saveButton: {
    flex: 1,
    backgroundColor: '#1B4332',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.4,
  },
  saveButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
