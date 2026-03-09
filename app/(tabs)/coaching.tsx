import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, Modal, StyleSheet, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Coach, CoachingStaff, CoachSpecialty, getCoachColor } from '../../src/data/types/coach';
import {
  loadCoachingStaff,
  updateCoachName,
  updateCoachSpecialties,
  toggleCoachActive,
  addAssistantCoach,
  deleteCoach,
} from '../../src/data/storage/coachingStorage';

const ALL_SPECIALTIES: { value: CoachSpecialty; label: string }[] = [
  { value: 'hitting', label: 'Hitting' },
  { value: 'fielding', label: 'Fielding' },
  { value: 'pitching', label: 'Pitching' },
  { value: 'catching', label: 'Catching' },
  { value: 'baserunning', label: 'Baserunning' },
  { value: 'infield', label: 'Infield' },
  { value: 'outfield', label: 'Outfield' },
];

export default function CoachingScreen() {
  const insets = useSafeAreaInsets();
  const [staff, setStaff] = useState<CoachingStaff | null>(null);
  const [editingCoach, setEditingCoach] = useState<Coach | null>(null);
  const [editName, setEditName] = useState('');
  const [editSpecialties, setEditSpecialties] = useState<CoachSpecialty[]>([]);
  const [showNameModal, setShowNameModal] = useState(false);
  const [showSpecialtyModal, setShowSpecialtyModal] = useState(false);

  useEffect(() => {
    loadCoachingStaff().then(setStaff);
  }, []);

  const handleEditName = useCallback((coach: Coach) => {
    setEditingCoach(coach);
    setEditName(coach.name);
    setShowNameModal(true);
  }, []);

  const handleSaveName = useCallback(async () => {
    if (!editingCoach || !editName.trim()) return;
    const updated = await updateCoachName(editingCoach.id, editName.trim());
    setStaff(updated);
    setShowNameModal(false);
    setEditingCoach(null);
  }, [editingCoach, editName]);

  const handleEditSpecialties = useCallback((coach: Coach) => {
    setEditingCoach(coach);
    setEditSpecialties([...coach.specialties]);
    setShowSpecialtyModal(true);
  }, []);

  const toggleSpecialty = useCallback((specialty: CoachSpecialty) => {
    setEditSpecialties(prev => {
      if (prev.includes(specialty)) {
        return prev.filter(s => s !== specialty);
      }
      return [...prev, specialty];
    });
  }, []);

  const handleSaveSpecialties = useCallback(async () => {
    if (!editingCoach) return;
    const updated = await updateCoachSpecialties(editingCoach.id, editSpecialties);
    setStaff(updated);
    setShowSpecialtyModal(false);
    setEditingCoach(null);
  }, [editingCoach, editSpecialties]);

  const handleToggleActive = useCallback(async (coach: Coach) => {
    if (coach.role === 'head') {
      Alert.alert('Cannot Deactivate', 'The Head Coach cannot be deactivated.');
      return;
    }
    const updated = await toggleCoachActive(coach.id);
    setStaff(updated);
  }, []);

  // BUILD 68: Add new assistant coach
  const handleAddAssistant = useCallback(async () => {
    const updated = await addAssistantCoach('', []);
    setStaff(updated);
  }, []);

  // BUILD 68: Delete assistant coach
  const handleDeleteCoach = useCallback(async (coach: Coach) => {
    if (coach.role === 'head') {
      Alert.alert('Cannot Delete', 'The Head Coach cannot be deleted.');
      return;
    }
    Alert.alert(
      'Delete Coach?',
      `Are you sure you want to remove "${coach.name}" from your staff?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const updated = await deleteCoach(coach.id);
            setStaff(updated);
          },
        },
      ]
    );
  }, []);

  if (!staff) {
    return (
      <View style={[styles.container]}>
        <Text style={styles.loading}>Loading coaching staff...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={[styles.container, { paddingBottom: insets.bottom + 20 }]}
    >
      <Text style={styles.title}>Coaching Staff</Text>
      <Text style={styles.subtitle}>
        Assign specialties to auto-match drills to coaches
      </Text>

      {staff.coaches.map(coach => {
        const colors = getCoachColor(coach.id);
        return (
          <View
            key={coach.id}
            style={[
              styles.coachCard,
              { borderLeftColor: colors.border },
              !coach.isActive && styles.coachCardInactive,
            ]}
          >
            <View style={styles.coachHeader}>
              <View style={[styles.roleBadge, { backgroundColor: colors.bg }]}>
                <Text style={[styles.roleBadgeText, { color: colors.text }]}>
                  {coach.role === 'head' ? 'HEAD' : `ASST ${coach.placeholderIndex || ''}`}
                </Text>
              </View>
              {coach.role === 'assistant' && (
                <TouchableOpacity
                  onPress={() => handleToggleActive(coach)}
                  style={[styles.activeToggle, coach.isActive && styles.activeToggleOn]}
                >
                  <Text style={styles.activeToggleText}>
                    {coach.isActive ? 'Active' : 'Inactive'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            <TouchableOpacity onPress={() => handleEditName(coach)}>
              <Text style={styles.coachName}>{coach.name}</Text>
              <Text style={styles.editHint}>Tap to rename</Text>
            </TouchableOpacity>

            <View style={styles.specialtiesRow}>
              {coach.specialties.map(s => (
                <View key={s} style={[styles.specialtyChip, { backgroundColor: colors.bg }]}>
                  <Text style={[styles.specialtyChipText, { color: colors.text }]}>
                    {s.charAt(0).toUpperCase() + s.slice(1)}
                  </Text>
                </View>
              ))}
              <TouchableOpacity
                style={styles.editSpecialtiesButton}
                onPress={() => handleEditSpecialties(coach)}
              >
                <Text style={styles.editSpecialtiesText}>Edit</Text>
              </TouchableOpacity>
            </View>

            {/* BUILD 68: Delete button for assistants */}
            {coach.role === 'assistant' && (
              <TouchableOpacity
                style={styles.deleteCoachButton}
                onPress={() => handleDeleteCoach(coach)}
              >
                <Text style={styles.deleteCoachButtonText}>Remove from Staff</Text>
              </TouchableOpacity>
            )}
          </View>
        );
      })}

      {/* BUILD 68: Add Assistant Button */}
      <TouchableOpacity style={styles.addAssistantButton} onPress={handleAddAssistant}>
        <Text style={styles.addAssistantButtonText}>+ Add Assistant Coach</Text>
      </TouchableOpacity>

      {/* Name Edit Modal */}
      <Modal visible={showNameModal} transparent animationType="fade" onRequestClose={() => setShowNameModal(false)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={styles.modalBackdrop}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Rename Coach</Text>
              <TextInput
                style={styles.modalInput}
                value={editName}
                onChangeText={setEditName}
                placeholder="Enter coach name"
                placeholderTextColor="#9CA3AF"
                autoFocus
              />
              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.modalButtonSecondary}
                  onPress={() => setShowNameModal(false)}
                >
                  <Text style={styles.modalButtonSecondaryText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.modalButtonPrimary}
                  onPress={handleSaveName}
                >
                  <Text style={styles.modalButtonPrimaryText}>Save</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Specialty Edit Modal */}
      <Modal visible={showSpecialtyModal} transparent animationType="fade" onRequestClose={() => setShowSpecialtyModal(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Edit Specialties</Text>
            <Text style={styles.modalSubtitle}>
              Select the skills this coach specializes in
            </Text>
            <View style={styles.specialtyGrid}>
              {ALL_SPECIALTIES.map(({ value, label }) => (
                <TouchableOpacity
                  key={value}
                  style={[
                    styles.specialtyOption,
                    editSpecialties.includes(value) && styles.specialtyOptionActive,
                  ]}
                  onPress={() => toggleSpecialty(value)}
                >
                  <Text
                    style={[
                      styles.specialtyOptionText,
                      editSpecialties.includes(value) && styles.specialtyOptionTextActive,
                    ]}
                  >
                    {label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalButtonSecondary}
                onPress={() => setShowSpecialtyModal(false)}
              >
                <Text style={styles.modalButtonSecondaryText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalButtonPrimary}
                onPress={handleSaveSpecialties}
              >
                <Text style={styles.modalButtonPrimaryText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  container: {
    padding: 20,
  },
  loading: {
    textAlign: 'center',
    marginTop: 80,
    color: '#6B7280',
    fontSize: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1B4332',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 24,
  },
  coachCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    borderLeftWidth: 4,
    shadowColor: '#1B4332',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  coachCardInactive: {
    opacity: 0.6,
    backgroundColor: '#F3F4F6',
  },
  coachHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  roleBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  roleBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  activeToggle: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  activeToggleOn: {
    backgroundColor: '#D1FAE5',
  },
  activeToggleText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#374151',
  },
  coachName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  editHint: {
    fontSize: 11,
    color: '#9CA3AF',
    marginTop: 2,
  },
  specialtiesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
  },
  specialtyChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  specialtyChipText: {
    fontSize: 11,
    fontWeight: '600',
  },
  editSpecialtiesButton: {
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  editSpecialtiesText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#3B82F6',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 340,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 16,
  },
  modalInput: {
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    color: '#111827',
    marginBottom: 20,
  },
  specialtyGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 20,
  },
  specialtyOption: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
  },
  specialtyOptionActive: {
    backgroundColor: '#1B4332',
    borderColor: '#1B4332',
  },
  specialtyOptionText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#6B7280',
  },
  specialtyOptionTextActive: {
    color: '#FFFFFF',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButtonSecondary: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  modalButtonSecondaryText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#6B7280',
  },
  modalButtonPrimary: {
    flex: 1,
    backgroundColor: '#1B4332',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  modalButtonPrimaryText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  // BUILD 68: Add/Delete coach button styles
  addAssistantButton: {
    borderWidth: 2,
    borderColor: '#1B4332',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 20,
    backgroundColor: '#FFFFFF',
  },
  addAssistantButtonText: {
    color: '#1B4332',
    fontSize: 15,
    fontWeight: '600',
  },
  deleteCoachButton: {
    marginTop: 12,
    paddingVertical: 8,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  deleteCoachButtonText: {
    color: '#EF4444',
    fontSize: 13,
    fontWeight: '500',
  },
});
