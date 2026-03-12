/**
 * BUILD 100: Teams Management Screen
 *
 * Lists all team profiles with the active team highlighted.
 * Tap a card to switch active team. Ellipsis button to edit/delete.
 * "Add Team" button at bottom. Onboarding prompt when no teams exist.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { TeamProfile, TeamProfileStore } from '../../src/data/types/teamProfile';
import {
  loadTeamProfiles,
  createTeamProfile,
  updateTeamProfile,
  deleteTeamProfile,
  setActiveTeam,
} from '../../src/data/storage/teamProfileStorage';
import TeamProfileCard from '../../components/TeamProfileCard';
import TeamFormModal from '../../components/TeamFormModal';
import { AgeGroup } from '../../src/data/types';
import { usePractice } from '../../context/PracticeContext';
import { SubscriptionTier } from '../../src/subscription/tiers';

export default function TeamsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { tier } = usePractice();
  const [store, setStore] = useState<TeamProfileStore | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingProfile, setEditingProfile] = useState<TeamProfile | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Load on mount and on focus (so switching back to this tab refreshes)
  const loadData = useCallback(async () => {
    const data = await loadTeamProfiles();
    setStore(data);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  // Switch active team
  const handleTeamPress = useCallback(async (profile: TeamProfile) => {
    if (store?.activeTeamId === profile.id) return; // Already active
    const updated = await setActiveTeam(profile.id);
    setStore(updated);
  }, [store]);

  // Open edit modal
  const handleEditPress = useCallback((profile: TeamProfile) => {
    setEditingProfile(profile);
    setShowForm(true);
  }, []);

  // Create new team
  const handleCreate = useCallback(async (data: {
    name: string;
    ageGroup: AgeGroup;
    experienceLevel: number;
    intensity: number;
    assistantCoaches: number;
    color: string;
  }) => {
    const { store: updated } = await createTeamProfile(
      data.name,
      data.ageGroup,
      data.experienceLevel,
      data.intensity,
      data.assistantCoaches,
      data.color,
    );
    setStore(updated);
    setShowForm(false);
    setEditingProfile(null);
  }, []);

  // Update existing team
  const handleUpdate = useCallback(async (data: {
    name: string;
    ageGroup: AgeGroup;
    experienceLevel: number;
    intensity: number;
    assistantCoaches: number;
    color: string;
  }) => {
    if (!editingProfile) return;
    const updated = await updateTeamProfile(editingProfile.id, {
      name: data.name,
      ageGroup: data.ageGroup,
      experienceLevel: data.experienceLevel,
      intensity: data.intensity,
      assistantCoaches: data.assistantCoaches,
      color: data.color,
    });
    setStore(updated);
    setShowForm(false);
    setEditingProfile(null);
  }, [editingProfile]);

  // Delete team with confirmation
  const handleDelete = useCallback((profile: TeamProfile) => {
    Alert.alert(
      'Delete Team?',
      `Are you sure you want to remove "${profile.name}"? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const updated = await deleteTeamProfile(profile.id);
            setStore(updated);
          },
        },
      ],
    );
  }, []);

  // Handle save from form (dispatches to create or update)
  const handleFormSave = useCallback((data: {
    name: string;
    ageGroup: AgeGroup;
    experienceLevel: number;
    intensity: number;
    assistantCoaches: number;
    color: string;
  }) => {
    if (editingProfile) {
      handleUpdate(data);
    } else {
      handleCreate(data);
    }
  }, [editingProfile, handleUpdate, handleCreate]);

  const handleFormClose = useCallback(() => {
    setShowForm(false);
    setEditingProfile(null);
  }, []);

  const handleAddTeam = useCallback(() => {
    setEditingProfile(null);
    setShowForm(true);
  }, []);

  if (!store) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.loadingText}>Loading teams...</Text>
      </View>
    );
  }

  const hasTeams = store.profiles.length > 0;
  const usedColors = store.profiles
    .filter(p => p.id !== editingProfile?.id)
    .map(p => p.color);

  return (
    <>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.container,
          { paddingBottom: insets.bottom + 24 },
          !hasTeams && styles.containerEmpty,
        ]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#1B4332" />
        }
      >
        {hasTeams ? (
          <>
            <Text style={styles.title}>My Teams</Text>
            <Text style={styles.subtitle}>
              Tap a team to make it active. Your active team auto-fills practice settings.
            </Text>

            {store.profiles.map(profile => (
              <TeamProfileCard
                key={profile.id}
                profile={profile}
                isActive={profile.id === store.activeTeamId}
                onPress={() => handleTeamPress(profile)}
                onEdit={() => handleEditPress(profile)}
              />
            ))}

            {/* Add Team button */}
            <TouchableOpacity style={styles.addButton} onPress={handleAddTeam}>
              <Ionicons name="add-circle-outline" size={20} color="#1B4332" />
              <Text style={styles.addButtonText}>Add Team</Text>
            </TouchableOpacity>

            {/* BUILD 101: Staff management shortcut (folded from standalone tab) */}
            <View style={styles.staffSection}>
              <Text style={styles.staffSectionTitle}>Coaching Staff</Text>
              <Text style={styles.staffSectionSub}>
                Assign specialties to auto-match drills to coaches
              </Text>
              <TouchableOpacity
                style={styles.staffButton}
                onPress={() => router.push('/coaching')}
                activeOpacity={0.8}
              >
                <Ionicons name="people" size={20} color="#1B4332" />
                <Text style={styles.staffButtonText}>Manage Staff</Text>
                <Ionicons name="chevron-forward" size={16} color="#9CA3AF" />
              </TouchableOpacity>
            </View>

            {/* BUILD 101: Season Mode shortcut */}
            <View style={styles.staffSection}>
              <Text style={styles.staffSectionTitle}>Season Schedule</Text>
              <Text style={styles.staffSectionSub}>
                Plan your practices on a calendar across the season
              </Text>
              <TouchableOpacity
                style={styles.staffButton}
                onPress={() => router.push('/season')}
                activeOpacity={0.8}
              >
                <Ionicons name="calendar" size={20} color="#1B4332" />
                <Text style={styles.staffButtonText}>View Season</Text>
                <Ionicons name="chevron-forward" size={16} color="#9CA3AF" />
              </TouchableOpacity>
            </View>
          </>
        ) : (
          /* Empty state / Onboarding */
          <View style={styles.emptyState}>
            <View style={styles.emptyIcon}>
              <Ionicons name="people-outline" size={56} color="#1B4332" />
            </View>
            <Text style={styles.emptyTitle}>Welcome to DiamondScript</Text>
            <Text style={styles.emptyBody}>
              Create your first team profile to get started. Your team settings will automatically
              fill in when you generate practice plans.
            </Text>
            <TouchableOpacity style={styles.emptyButton} onPress={handleAddTeam}>
              <Ionicons name="add" size={20} color="#FFFFFF" />
              <Text style={styles.emptyButtonText}>Create Your First Team</Text>
            </TouchableOpacity>
            <Text style={styles.emptyHint}>
              Coach multiple teams? You can add more later and switch between them anytime.
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Create/Edit Modal */}
      <TeamFormModal
        visible={showForm}
        onClose={handleFormClose}
        onSave={handleFormSave}
        onDelete={editingProfile ? () => {
          handleFormClose();
          handleDelete(editingProfile);
        } : undefined}
        editProfile={editingProfile}
        usedColors={usedColors}
        tier={tier as SubscriptionTier}
      />
    </>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: '#FAFBFC',
  },
  container: {
    padding: 20,
  },
  containerEmpty: {
    flex: 1,
    justifyContent: 'center',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FAFBFC',
  },
  loadingText: {
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
    lineHeight: 20,
  },
  actionRow: {
    // Spacer for visual separation
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 2,
    borderColor: '#1B4332',
    borderRadius: 14,
    paddingVertical: 14,
    marginTop: 8,
    backgroundColor: '#FFFFFF',
  },
  addButtonText: {
    color: '#1B4332',
    fontSize: 15,
    fontWeight: '600',
  },
  // BUILD 101: Staff section (folded from standalone tab)
  staffSection: {
    marginTop: 32,
    paddingTop: 24,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  staffSectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1B4332',
    marginBottom: 4,
  },
  staffSectionSub: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 14,
  },
  staffButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#1B4332',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  staffButtonText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
  },
  // Empty / Onboarding State
  emptyState: {
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  emptyIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#ECFDF5',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 12,
    textAlign: 'center',
  },
  emptyBody: {
    fontSize: 15,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 28,
  },
  emptyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#1B4332',
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 32,
    width: '100%',
    shadowColor: '#1B4332',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  emptyButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
  },
  emptyHint: {
    fontSize: 13,
    color: '#9CA3AF',
    textAlign: 'center',
    marginTop: 16,
    lineHeight: 18,
  },
});
