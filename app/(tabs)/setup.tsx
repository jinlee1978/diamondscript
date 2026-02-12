import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, TextInput, Alert, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
// BUILD 55 TROUBLESHOOTING: Temporarily commented out netinfo
// import NetInfo from '@react-native-community/netinfo';
import { usePractice } from '../../context/PracticeContext';
import { AgeGroup } from '../../src/data/types';
import AgeGroupPicker from '../../components/AgeGroupPicker';
import Stepper from '../../components/Stepper';
import UpgradeBanner from '../../components/UpgradeBanner';
import AICard from '../../components/AICard';
// BUILD 55 TROUBLESHOOTING: Temporarily commented out
// import SegmentedControl from '../../components/SegmentedControl';
import { filterCandidates } from '../../src/core/engine/drillSelector';
import { SEED_DRILL_CATALOG } from '../../src/data/seedDrills';
import { generateAIPracticePlan, convertAIPlanToPracticeSession } from '../../src/services/aiPracticeService';
import { supabase } from '../../src/config/supabase';

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
  const { tier, lastRequest, generateSession, importPractice } = usePractice();

  // BUILD 55 TROUBLESHOOTING: Temporarily commented out
  // const [selectedMode, setSelectedMode] = useState(0);

  // Local form state, pre-filled from last request
  const [ageGroup, setAgeGroup] = useState<AgeGroup>(lastRequest?.ageGroup ?? AgeGroup.AGE_10U);
  const [experience, setExperience] = useState(lastRequest?.experienceLevel ?? 2);
  const [intensity, setIntensity] = useState(lastRequest?.intensity ?? 3);
  const [numDrills, setNumDrills] = useState(lastRequest?.numDrills ?? 4);
  const [assistants, setAssistants] = useState(lastRequest?.assistantCoaches ?? 0);

  // AI Practice Generator state
  const [focusArea, setFocusArea] = useState('Hitting');
  const [duration, setDuration] = useState(60);
  const [intensityType, setIntensityType] = useState<'rec' | 'travel' | 'competitive'>('rec');
  const [specialInstructions, setSpecialInstructions] = useState(''); // BUILD 54: Custom instructions
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [cooldownSeconds, setCooldownSeconds] = useState(0); // BUILD 53: 60-second cooldown
  // BUILD 55 TROUBLESHOOTING: Temporarily hardcoded to true
  // const [isOnline, setIsOnline] = useState(true);

  // AUTH GUARD: Check for valid Supabase session before enabling AI button
  useEffect(() => {
    async function checkAuthSession() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        setIsAuthReady(!!session);
      } catch (error) {
        if (__DEV__) {
          console.error('Auth session check failed:', error);
        }
        setIsAuthReady(false);
      }
    }
    checkAuthSession();
  }, []);

  // BUILD 53: Cooldown timer - count down every second
  useEffect(() => {
    if (cooldownSeconds > 0) {
      const timer = setTimeout(() => {
        setCooldownSeconds(cooldownSeconds - 1);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [cooldownSeconds]);

  // BUILD 55 TROUBLESHOOTING: NetInfo listener temporarily commented out
  // useEffect(() => {
  //   const unsubscribe = NetInfo.addEventListener(state => {
  //     setIsOnline(state.isConnected ?? true);
  //   });
  //   return () => unsubscribe();
  // }, []);

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

  const handleAIGenerate = async () => {
    setIsGeneratingAI(true);
    try {
      // Map AgeGroup enum to string format
      const ageGroupString = ageGroup === AgeGroup.T_BALL ? 'T-Ball' :
                             ageGroup === AgeGroup.AGE_8U ? '8U' :
                             ageGroup === AgeGroup.AGE_10U ? '10U' :
                             ageGroup === AgeGroup.AGE_12U ? '12U' : '14U';

      // Generate AI practice plan via Supabase Edge Function
      const aiPlan = await generateAIPracticePlan({
        ageGroup: ageGroupString,
        experienceLevel: experience,
        focusArea,
        duration,
        intensity: intensityType,
        userInstructions: specialInstructions || undefined, // BUILD 54: Custom instructions
      });

      // Convert AI plan to PracticeSession format
      const practiceSession = convertAIPlanToPracticeSession(aiPlan, {
        ageGroup: ageGroupString,
        experienceLevel: experience,
        focusArea,
        duration,
        intensity: intensityType,
      }, tier);

      // Save to practice history and set as current session
      importPractice(practiceSession);

      // BUILD 53: Start 60-second cooldown to prevent accidental double-spending
      setCooldownSeconds(60);

      // Navigate to practice view to see the generated plan
      router.push('/practice');

    } catch (error) {
      Alert.alert(
        'AI Generation Failed',
        error instanceof Error ? error.message : 'Unable to generate AI practice plan. Please try again.',
        [{ text: 'OK', style: 'cancel' }]
      );
    } finally {
      setIsGeneratingAI(false);
    }
  };

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
      {/* BUILD 55 TROUBLESHOOTING: SegmentedControl temporarily removed */}
      {/* <SegmentedControl
        options={['Manual', 'AI Generator']}
        selectedIndex={selectedMode}
        onIndexChange={setSelectedMode}
      /> */}

      {/* Manual Practice Generator */}
      {/* BUILD 55 TROUBLESHOOTING: Removed conditional rendering */}
      {/* {selectedMode === 0 && ( */}
        <>
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
        </>
      {/* BUILD 55 TROUBLESHOOTING: Removed closing conditional */}
      {/* )} */}

      {/* BUILD 55 TROUBLESHOOTING: AI Generator temporarily replaced with Hello World */}
      {/* {selectedMode === 1 && ( */}
      <View style={styles.section}>
        <Text style={styles.helloWorld}>Hello World - AI Generator Placeholder</Text>
      </View>
      {/* )} */}
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
  aiInputGroup: {
    marginBottom: 16,
  },
  aiLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E40AF',
    marginBottom: 8,
  },
  textInput: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#1F2937',
  },
  multilineInput: {
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#1F2937',
    minHeight: 80,
  },
  intensityTypeRow: {
    flexDirection: 'row',
    gap: 8,
  },
  intensityTypeButton: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#BFDBFE',
    minHeight: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  intensityTypeButtonActive: {
    backgroundColor: '#3B82F6',
    borderColor: '#1E40AF',
  },
  intensityTypeText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  intensityTypeTextActive: {
    color: '#FFFFFF',
  },
  helloWorld: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1B4332',
    textAlign: 'center',
    padding: 24,
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    marginTop: 32,
  },
});
