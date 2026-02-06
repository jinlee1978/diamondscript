import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { usePractice } from '../context/PracticeContext';
import { AgeGroup } from '../src/data/types';
import AgeGroupPicker from '../components/AgeGroupPicker';
import Stepper from '../components/Stepper';
import UpgradeBanner from '../components/UpgradeBanner';
import { filterCandidates } from '../src/core/engine/drillSelector';
import { SEED_DRILL_CATALOG } from '../src/data/seedDrills';

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
  const { tier, lastRequest, generateSession } = usePractice();

  // Local form state, pre-filled from last request
  const [ageGroup, setAgeGroup] = useState<AgeGroup>(lastRequest?.ageGroup ?? AgeGroup.AGE_10U);
  const [experience, setExperience] = useState(lastRequest?.experienceLevel ?? 2);
  const [intensity, setIntensity] = useState(lastRequest?.intensity ?? 3);
  const [numDrills, setNumDrills] = useState(lastRequest?.numDrills ?? 4);
  const [assistants, setAssistants] = useState(lastRequest?.assistantCoaches ?? 0);

  // Sync when lastRequest loads from AsyncStorage
  useEffect(() => {
    if (lastRequest) {
      setAgeGroup(lastRequest.ageGroup);
      setExperience(lastRequest.experienceLevel);
      setIntensity(lastRequest.intensity);
      setNumDrills(lastRequest.numDrills);
      setAssistants(lastRequest.assistantCoaches);
    }
  }, [lastRequest]);

  // Free tier caps non-T-Ball age groups at 2 drills; T-Ball is limited only by catalog size
  const isTBall = ageGroup === AgeGroup.T_BALL;
  const availableDrills = filterCandidates(SEED_DRILL_CATALOG, ageGroup, tier).length;
  const proAvailable = filterCandidates(SEED_DRILL_CATALOG, ageGroup, 'pro').length;
  const effectiveMax = tier === 'free' && !isTBall ? Math.min(2, availableDrills) : availableDrills;
  const drillsMax = Math.min(6, effectiveMax);
  const drillsMin = Math.min(3, drillsMax);
  const drillsUpgradeHelps = tier === 'free' && drillsMax < 6 && Math.min(6, proAvailable) > drillsMax;
  const drillsCappedNoUpgrade = drillsMax < 6 && !drillsUpgradeHelps;

  // Clamp numDrills down when switching to an age group with a smaller effective max
  useEffect(() => {
    const available = filterCandidates(SEED_DRILL_CATALOG, ageGroup, tier).length;
    const isTB = ageGroup === AgeGroup.T_BALL;
    const max = Math.min(6, tier === 'free' && !isTB ? Math.min(2, available) : available);
    if (numDrills > max) setNumDrills(max);
  }, [ageGroup, tier]);

  const intensityLocked = tier === 'free';
  const assistantsLocked = tier === 'free';

  const handleGo = () => {
    generateSession({
      ageGroup,
      experienceLevel: experience,
      intensity,
      numDrills,
      assistantCoaches: assistants,
      subscriptionTier: tier,
    });
    router.push('/practice');
  };

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.container}>
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
            max={5}
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
          max={5}
          onChange={setIntensity}
          locked={intensityLocked}
        />
        {intensityLocked && <UpgradeBanner feature="custom intensity" />}
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
          <UpgradeBanner feature={`up to ${Math.min(6, proAvailable)} drills (only ${drillsMax} on Free)`} />
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
          max={3}
          onChange={setAssistants}
          locked={assistantsLocked}
        />
        {assistantsLocked && <UpgradeBanner feature="station splitting" />}
      </View>

      {/* Go button */}
      <TouchableOpacity style={styles.goButton} onPress={handleGo} activeOpacity={0.85}>
        <Text style={styles.goText}>Go</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  container: {
    padding: 24,
    paddingBottom: 48,
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
    color: '#1B4332',
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
  goButton: {
    marginTop: 32,
    backgroundColor: '#1B4332',
    borderRadius: 16,
    paddingVertical: 20,
    alignItems: 'center',
    shadowColor: '#1B4332',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 5,
  },
  goText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
});
