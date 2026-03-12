import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { usePractice } from '../../context/PracticeContext';
import { AgeGroup } from '../../src/data/types';
import { SubscriptionTier, getTierCapabilities } from '../../src/subscription/tiers';
import AgeGroupPicker from '../../components/AgeGroupPicker';
import Stepper from '../../components/Stepper';
import UpgradeBanner from '../../components/UpgradeBanner';
import { filterCandidates } from '../../src/core/engine/drillSelector';
import { SEED_DRILL_CATALOG } from '../../src/data/seedDrills';
// BUILD 68: Use Staff Registry instead of manual coach names
import { loadCoachingStaff } from '../../src/data/storage/coachingStorage';
// BUILD 100: Auto-fill from active team profile
import { getActiveTeamProfile } from '../../src/data/storage/teamProfileStorage';

// Human-readable labels for experience levels
const EXPERIENCE_LABELS: Record<number, string> = {
  0: 'First Year',
  1: 'Beginner',
  2: 'Developing',
  3: 'Intermediate',
  4: 'Advanced',
  5: 'Veteran',
};

export default function SetupScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { tier, lastRequest, generateSession, showPaywall, paywallTrigger, closePaywall } = usePractice();

  // Local form state, pre-filled from last request
  const [ageGroup, setAgeGroup] = useState<AgeGroup>(lastRequest?.ageGroup ?? AgeGroup.KID_PITCH);
  const [experience, setExperience] = useState(lastRequest?.experienceLevel ?? 2);
  const [intensity, setIntensity] = useState(lastRequest?.intensity ?? 3);
  const [numDrills, setNumDrills] = useState(lastRequest?.numDrills ?? 4);
  const [assistants, setAssistants] = useState(lastRequest?.assistantCoaches ?? 0);

  // BUILD 68: Coach names now come from Staff Registry (removed manual input)
  // BUILD 100: Track active team name for display
  const [activeTeamName, setActiveTeamName] = useState<string | null>(null);

  // Sync when lastRequest loads from AsyncStorage (clamp to tier caps, age-aware)
  useEffect(() => {
    if (lastRequest) {
      const tierCaps = getTierCapabilities(tier as SubscriptionTier, lastRequest.ageGroup);
      setAgeGroup(lastRequest.ageGroup);
      setExperience(Math.min(lastRequest.experienceLevel, tierCaps.maxExperience));
      setIntensity(Math.min(lastRequest.intensity, tierCaps.maxIntensity));
      setNumDrills(Math.min(lastRequest.numDrills, tierCaps.maxDrills));
      setAssistants(Math.min(lastRequest.assistantCoaches, tierCaps.maxAssistants));
    }
  }, [lastRequest]);

  // BUILD 100: Auto-fill from active team profile on focus
  useFocusEffect(
    React.useCallback(() => {
      getActiveTeamProfile().then(team => {
        if (team) {
          const tierCaps = getTierCapabilities(tier as SubscriptionTier, team.ageGroup);
          setAgeGroup(team.ageGroup);
          setExperience(Math.min(team.experienceLevel, tierCaps.maxExperience));
          setIntensity(Math.min(team.intensity, tierCaps.maxIntensity));
          setAssistants(Math.min(team.assistantCoaches, tierCaps.maxAssistants));
          setActiveTeamName(team.name);
        } else {
          setActiveTeamName(null);
        }
      });
    }, [])
  );

  // Tier-driven constraints (age-aware for assistant caps)
  const caps = getTierCapabilities(tier as SubscriptionTier, ageGroup);
  const proCaps = getTierCapabilities(SubscriptionTier.PRO, ageGroup);
  const availableDrills = filterCandidates(SEED_DRILL_CATALOG, ageGroup, tier).length;
  const proAvailable = filterCandidates(SEED_DRILL_CATALOG, ageGroup, 'pro').length;
  const drillsMax = Math.min(caps.maxDrills, availableDrills);
  const drillsMin = Math.min(3, drillsMax);
  const drillsUpgradeHelps = tier === 'free' && drillsMax < proCaps.maxDrills && Math.min(proCaps.maxDrills, proAvailable) > drillsMax;
  const drillsCappedNoUpgrade = drillsMax < caps.maxDrills && !drillsUpgradeHelps;
  const intensityUpgradeHelps = proCaps.maxIntensity > caps.maxIntensity;
  const assistantsUpgradeHelps = proCaps.maxAssistants > caps.maxAssistants;

  // Clamp all values when age group or tier changes
  useEffect(() => {
    const available = filterCandidates(SEED_DRILL_CATALOG, ageGroup, tier).length;
    const max = Math.min(caps.maxDrills, available);
    if (numDrills > max) setNumDrills(max);
    if (assistants > caps.maxAssistants) setAssistants(caps.maxAssistants);
    if (intensity > caps.maxIntensity) setIntensity(caps.maxIntensity);
    if (experience > caps.maxExperience) setExperience(caps.maxExperience);
  }, [ageGroup, tier]);

  const handleGo = async () => {
    // BUILD 68: Load coach names from Staff Registry
    const staff = await loadCoachingStaff();
    const totalCoaches = assistants + 1; // Head coach + assistants
    const coachNames = staff.coaches
      .slice(0, totalCoaches)
      .map(coach => coach.name);

    // BUILD 81: Check if generateSession was successful (History Gate may block)
    const success = generateSession(
      {
        ageGroup,
        experienceLevel: experience,
        intensity,
        numDrills,
        assistantCoaches: assistants,
        subscriptionTier: tier,
      },
      coachNames.length > 0 ? coachNames : undefined
    );

    // Only navigate if session was created (not blocked by History Gate)
    if (success) {
      router.push('/practice');
    }
  };

  return (
    <>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.container, { paddingBottom: insets.bottom + 24 }]}
      >
        {/* BUILD 100: Active team indicator */}
        {activeTeamName && (
          <View style={styles.teamBanner}>
            <Text style={styles.teamBannerText}>
              {activeTeamName}
            </Text>
          </View>
        )}

        {/* Age Group */}
        <View style={styles.section}>
          <AgeGroupPicker value={ageGroup} onChange={setAgeGroup} />
        </View>

        {/* Experience */}
        <View style={styles.section}>
          <View style={styles.expRow}>
            <Stepper
              label="Experience"
              value={experience}
              min={0}
              max={caps.maxExperience}
              onChange={setExperience}
            />
          </View>
          <Text style={styles.expLabel}>{EXPERIENCE_LABELS[experience]}</Text>
        </View>

        {/* Intensity */}
        <View style={styles.section}>
          <Stepper
            label="Intensity"
            value={intensity}
            min={1}
            max={caps.maxIntensity}
            onChange={setIntensity}
          />
          {intensityUpgradeHelps && <UpgradeBanner feature={`intensity up to ${proCaps.maxIntensity}`} />}
        </View>

        {/* Number of Drills */}
        <View style={styles.section}>
          <Stepper
            label="Drills"
            value={Math.min(numDrills, drillsMax)}
            min={drillsMin}
            max={drillsMax}
            onChange={setNumDrills}
          />
          {drillsUpgradeHelps && (
            <UpgradeBanner feature={`up to ${Math.min(proCaps.maxDrills, proAvailable)} drills`} />
          )}
          {drillsCappedNoUpgrade && (
            <View style={styles.capNote}>
              <Text style={styles.capNoteText}>
                Only {availableDrills} drill{availableDrills !== 1 ? 's' : ''} available for this age group.
              </Text>
            </View>
          )}
        </View>

        {/* Assistant Coaches */}
        <View style={styles.section}>
          <Stepper
            label="Assistants"
            value={assistants}
            min={0}
            max={caps.maxAssistants}
            onChange={setAssistants}
          />
          {assistantsUpgradeHelps && <UpgradeBanner feature={`up to ${proCaps.maxAssistants} assistants`} />}
        </View>

        {/* BUILD 68: Coach names now loaded from Staff Registry automatically */}

        {/* Go button - BUILD 59: Forest Green matching AI Lab */}
        <TouchableOpacity style={styles.goButton} onPress={handleGo} activeOpacity={0.85}>
          <Text style={styles.goText}>Go</Text>
        </TouchableOpacity>
      </ScrollView>

    </>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: '#F8FAFC', // BUILD 63: Soft off-white background
  },
  container: {
    padding: 24,
    paddingBottom: 48,
  },
  teamBanner: {
    backgroundColor: '#ECFDF5',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#A7F3D0',
    alignItems: 'center',
  },
  teamBannerText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1B4332',
  },
  section: {
    marginBottom: 8,
  },
  expRow: {
    // slight indent handled by Stepper itself
  },
  expLabel: {
    textAlign: 'right',
    fontSize: 13,
    color: '#1B4332', // BUILD 59: Forest Green
    fontWeight: '600',
    marginTop: -4,
    paddingRight: 2,
  },
  capNote: {
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginTop: 4,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  capNoteText: {
    fontSize: 13,
    color: '#6B7280',
    textAlign: 'center',
  },
  // BUILD 68: Coach name styles removed - now using Staff Registry
  goButton: {
    marginTop: 32,
    backgroundColor: '#1B4332', // BUILD 59: Forest Green
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    minHeight: 56,
    shadowColor: '#1B4332',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  goText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
});
