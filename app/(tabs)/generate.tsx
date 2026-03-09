/**
 * BUILD 101: Unified Generate Screen
 *
 * Merges Setup (engine) and AI Lab into a single tab with a mode toggle.
 * "Quick Plan" uses the local engine. "AI Lab" uses Gemini.
 * Active team auto-fills both modes.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet,
  TextInput, Alert, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import NetInfo from '@react-native-community/netinfo';
import { usePractice } from '../../context/PracticeContext';
import { AgeGroup } from '../../src/data/types';
import { SubscriptionTier } from '../../src/subscription/tiers';
import AgeGroupPicker from '../../components/AgeGroupPicker';
import Stepper from '../../components/Stepper';
import UpgradeBanner from '../../components/UpgradeBanner';
import PaywallModal from '../../components/PaywallModal';
import { filterCandidates } from '../../src/core/engine/drillSelector';
import { SEED_DRILL_CATALOG } from '../../src/data/seedDrills';
import { loadCoachingStaff } from '../../src/data/storage/coachingStorage';
import { getActiveTeamProfile } from '../../src/data/storage/teamProfileStorage';
import { generateAIPracticePlan, convertAIPlanToPracticeSession } from '../../src/services/aiPracticeService';
// BUILD 101: AI Daily Budget
import { getRemainingAIGenerations, incrementAIUsage, PRO_DAILY_AI_LIMIT } from '../../src/data/storage/aiBudget';

type GenerateMode = 'engine' | 'ai';

const EXPERIENCE_LABELS: Record<number, string> = {
  0: 'First Year', 1: 'Beginner', 2: 'Developing',
  3: 'Intermediate', 4: 'Advanced', 5: 'Veteran',
};

export default function GenerateScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const {
    tier, lastRequest, generateSession, importPractice,
    showPaywall, paywallTrigger, closePaywall, openPaywall,
  } = usePractice();

  // Mode toggle
  const [mode, setMode] = useState<GenerateMode>('engine');

  // Shared form state
  const [ageGroup, setAgeGroup] = useState<AgeGroup>(lastRequest?.ageGroup ?? AgeGroup.KID_PITCH);
  const [experience, setExperience] = useState(lastRequest?.experienceLevel ?? 2);
  const [intensity, setIntensity] = useState(lastRequest?.intensity ?? 3);
  const [numDrills, setNumDrills] = useState(lastRequest?.numDrills ?? 4);
  const [assistants, setAssistants] = useState(lastRequest?.assistantCoaches ?? 0);
  const [activeTeamName, setActiveTeamName] = useState<string | null>(null);

  // AI-only state
  const [focusArea, setFocusArea] = useState('Hitting');
  const [durationText, setDurationText] = useState('60');
  const [specialInstructions, setSpecialInstructions] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  // BUILD 101: Daily AI budget (replaces 60s cooldown)
  const [aiRemaining, setAiRemaining] = useState(PRO_DAILY_AI_LIMIT);

  // Sync from lastRequest
  useEffect(() => {
    if (lastRequest) {
      setAgeGroup(lastRequest.ageGroup);
      setExperience(lastRequest.experienceLevel);
      setIntensity(lastRequest.intensity);
      setNumDrills(lastRequest.numDrills);
      setAssistants(lastRequest.assistantCoaches);
    }
  }, [lastRequest]);

  // Auto-fill from active team + load AI budget
  useFocusEffect(
    useCallback(() => {
      getActiveTeamProfile().then(team => {
        if (team) {
          setAgeGroup(team.ageGroup);
          setExperience(team.experienceLevel);
          setIntensity(team.intensity);
          setAssistants(team.assistantCoaches);
          setActiveTeamName(team.name);
        } else {
          setActiveTeamName(null);
        }
      });
      // BUILD 101: Refresh AI daily budget on each visit
      if (tier === SubscriptionTier.PRO) {
        getRemainingAIGenerations().then(setAiRemaining);
      }
    }, [tier])
  );

  // NetInfo
  useEffect(() => {
    const unsub = NetInfo.addEventListener(s => setIsOnline(s.isConnected ?? true));
    return () => unsub();
  }, []);

  // Engine drill constraints
  const isTBall = ageGroup === AgeGroup.T_BALL || ageGroup === AgeGroup.INTRO;
  const availableDrills = filterCandidates(SEED_DRILL_CATALOG, ageGroup, tier).length;
  const proAvailable = filterCandidates(SEED_DRILL_CATALOG, ageGroup, 'pro').length;
  const effectiveMax = tier === 'free' && !isTBall ? Math.min(2, availableDrills) : availableDrills;
  const drillsMax = Math.min(6, effectiveMax);
  const drillsMin = Math.min(3, drillsMax);
  const drillsUpgradeHelps = tier === 'free' && drillsMax < 6 && Math.min(6, proAvailable) > drillsMax;
  const drillsCappedNoUpgrade = drillsMax < 6 && !drillsUpgradeHelps;
  const intensityLocked = tier === 'free';
  const assistantsLocked = tier === 'free';

  // Clamp drills
  useEffect(() => {
    const avail = filterCandidates(SEED_DRILL_CATALOG, ageGroup, tier).length;
    const isTB = ageGroup === AgeGroup.T_BALL || ageGroup === AgeGroup.INTRO;
    const max = Math.min(6, tier === 'free' && !isTB ? Math.min(2, avail) : avail);
    if (numDrills > max) setNumDrills(max);
  }, [ageGroup, tier]);

  // Engine generation
  const handleEngineGo = async () => {
    const staff = await loadCoachingStaff();
    const totalCoaches = assistants + 1;
    const coachNames = staff.coaches.slice(0, totalCoaches).map(c => c.name);
    const success = generateSession(
      { ageGroup, experienceLevel: experience, intensity, numDrills, assistantCoaches: assistants, subscriptionTier: tier },
      coachNames.length > 0 ? coachNames : undefined
    );
    if (success) router.push('/practice');
  };

  // AI generation — BUILD 101: daily budget replaces 60s cooldown
  const getAIButtonState = () => {
    if (!isOnline) return { disabled: true, text: 'No Internet Connection', showSpinner: false };
    if (isGenerating) return { disabled: true, text: 'Generating...', showSpinner: true };
    if (aiRemaining <= 0) return { disabled: true, text: 'Daily Limit Reached', showSpinner: false };
    return { disabled: false, text: `Generate AI Plan (${aiRemaining}/${PRO_DAILY_AI_LIMIT})`, showSpinner: false };
  };

  const handleAIGenerate = async () => {
    if (tier !== SubscriptionTier.PRO) { openPaywall('ai_generator'); return; }
    const duration = parseInt(durationText, 10);
    if (isNaN(duration) || duration < 15 || duration > 240) {
      Alert.alert('Invalid Duration', 'Enter a duration between 15 and 240 minutes.');
      return;
    }
    setIsGenerating(true);
    try {
      const ageGroupStringMap: Record<AgeGroup, string> = {
        [AgeGroup.INTRO]: 'Intro (3-4)', [AgeGroup.T_BALL]: 'T-Ball (5-6)',
        [AgeGroup.COACH_PITCH]: 'Coach Pitch (7-8)', [AgeGroup.MACHINE_PITCH]: 'Machine Pitch (8-9)',
        [AgeGroup.KID_PITCH]: 'Kid Pitch (9-10)', [AgeGroup.COMPETITIVE]: 'Competitive (11-12)',
        [AgeGroup.ADVANCED]: 'Advanced (13-14)',
      };
      const ageGroupString = ageGroupStringMap[ageGroup];
      const intensityMap = { 1: 'rec', 2: 'rec', 3: 'travel', 4: 'competitive', 5: 'competitive' } as const;
      const intensityType = intensityMap[intensity as 1 | 2 | 3 | 4 | 5];

      const aiPlan = await generateAIPracticePlan({
        ageGroup: ageGroupString, experienceLevel: experience, focusArea, duration,
        intensity: intensityType, assistantCoaches: assistants,
        userInstructions: specialInstructions || undefined,
      });
      if (!aiPlan || !aiPlan.planTitle || !aiPlan.sections) throw new Error('Invalid AI response');

      const baseSession = convertAIPlanToPracticeSession(aiPlan, {
        ageGroup: ageGroupString, experienceLevel: experience, focusArea, duration,
        intensity: intensityType, assistantCoaches: assistants,
      }, tier);
      const practiceSession = { ...baseSession, source: 'ai' as const };
      router.push('/history');
      importPractice(practiceSession);
      // BUILD 101: Decrement daily AI budget (replaces 60s cooldown)
      const budget = await incrementAIUsage();
      setAiRemaining(Math.max(0, PRO_DAILY_AI_LIMIT - budget.used));
    } catch (error) {
      Alert.alert('AI Generation Failed', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const aiButton = getAIButtonState();

  return (
    <>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.container, { paddingBottom: insets.bottom + 24 }]}
          keyboardShouldPersistTaps="handled"
        >
          {/* Mode Toggle */}
          <View style={styles.modeToggle}>
            <TouchableOpacity
              style={[styles.modeButton, mode === 'engine' && styles.modeButtonActive]}
              onPress={() => setMode('engine')}
            >
              <Ionicons name="baseball-outline" size={16} color={mode === 'engine' ? '#FFF' : '#6B7280'} />
              <Text style={[styles.modeButtonText, mode === 'engine' && styles.modeButtonTextActive]}>
                Quick Plan
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modeButton, mode === 'ai' && styles.modeButtonActive]}
              onPress={() => setMode('ai')}
            >
              <Ionicons name="sparkles" size={16} color={mode === 'ai' ? '#D4AF37' : '#6B7280'} />
              <Text style={[styles.modeButtonText, mode === 'ai' && styles.modeButtonTextActive]}>
                AI Lab
              </Text>
            </TouchableOpacity>
          </View>

          {/* Active team banner */}
          {activeTeamName && (
            <View style={styles.teamBanner}>
              <Text style={styles.teamBannerText}>{activeTeamName}</Text>
            </View>
          )}

          {/* SHARED: Age Group */}
          <View style={styles.section}>
            <AgeGroupPicker value={ageGroup} onChange={setAgeGroup} />
          </View>

          {/* SHARED: Experience */}
          <View style={styles.section}>
            <Stepper label="Experience" value={experience} min={0} max={5} onChange={setExperience} />
            <Text style={styles.expLabel}>{EXPERIENCE_LABELS[experience]}</Text>
          </View>

          {/* SHARED: Intensity */}
          <View style={styles.section}>
            <Stepper label="Intensity" value={intensity} min={1} max={5} onChange={setIntensity} locked={intensityLocked} />
            {intensityLocked && <UpgradeBanner feature="custom intensity" />}
          </View>

          {/* SHARED: Assistants */}
          <View style={styles.section}>
            <Stepper label="Assistants" value={assistants} min={0} max={3} onChange={setAssistants} locked={assistantsLocked} />
            {assistantsLocked && <UpgradeBanner feature="station splitting" />}
          </View>

          {/* ENGINE-ONLY: Number of Drills */}
          {mode === 'engine' && (
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
          )}

          {/* AI-ONLY: Focus Area + Duration + Instructions */}
          {mode === 'ai' && (
            <>
              <View style={styles.section}>
                <Text style={styles.label}>Focus Area</Text>
                <TextInput
                  style={styles.textInput}
                  value={focusArea}
                  onChangeText={setFocusArea}
                  placeholder="e.g., Hitting, Fielding, Base Running"
                  placeholderTextColor="#9CA3AF"
                  maxLength={100}
                />
              </View>

              <View style={styles.section}>
                <Text style={styles.label}>Duration (minutes)</Text>
                <TextInput
                  style={styles.textInput}
                  value={durationText}
                  onChangeText={setDurationText}
                  placeholder="60"
                  placeholderTextColor="#9CA3AF"
                  keyboardType="numeric"
                  maxLength={3}
                />
                <Text style={styles.hint}>15-240 minutes</Text>
              </View>

              <View style={styles.section}>
                <View style={styles.labelRow}>
                  <Text style={styles.label}>Special Instructions</Text>
                  {specialInstructions.length > 0 && (
                    <TouchableOpacity onPress={() => setSpecialInstructions('')}>
                      <Text style={styles.clearButton}>Clear</Text>
                    </TouchableOpacity>
                  )}
                </View>
                <TextInput
                  style={styles.multilineInput}
                  value={specialInstructions}
                  onChangeText={setSpecialInstructions}
                  placeholder="e.g., Focus on bunting, avoid long sprints..."
                  placeholderTextColor="#9CA3AF"
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                  maxLength={500}
                />
                <Text style={styles.charCount}>{specialInstructions.length}/500</Text>
              </View>
            </>
          )}

          {/* Go Button */}
          {mode === 'engine' ? (
            <TouchableOpacity style={styles.goButton} onPress={handleEngineGo} activeOpacity={0.85}>
              <Text style={styles.goText}>Generate</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.aiButton, aiButton.disabled && styles.aiButtonDisabled]}
              onPress={handleAIGenerate}
              disabled={aiButton.disabled}
              activeOpacity={0.85}
            >
              {aiButton.showSpinner && <ActivityIndicator color="#FFFFFF" style={{ marginRight: 8 }} />}
              <Text style={styles.aiButtonText}>{aiButton.text}</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      <PaywallModal
        visible={showPaywall}
        onClose={closePaywall}
        onSuccess={closePaywall}
        trigger={paywallTrigger ?? undefined}
      />
    </>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: '#FAFBFC' },
  container: { padding: 24 },
  modeToggle: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    padding: 3,
    marginBottom: 20,
  },
  modeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
  },
  modeButtonActive: {
    backgroundColor: '#1B4332',
    shadowColor: '#1B4332',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  modeButtonText: { fontSize: 14, fontWeight: '600', color: '#6B7280' },
  modeButtonTextActive: { color: '#FFFFFF' },
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
  teamBannerText: { fontSize: 13, fontWeight: '600', color: '#1B4332' },
  section: { marginBottom: 8 },
  expLabel: {
    textAlign: 'right', fontSize: 13, color: '#1B4332',
    fontWeight: '600', marginTop: -4, paddingRight: 2,
  },
  capNote: {
    backgroundColor: '#F3F4F6', borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 10,
    marginTop: 4, borderWidth: 1, borderColor: '#E5E7EB',
  },
  capNoteText: { fontSize: 13, color: '#6B7280', textAlign: 'center' },
  label: { fontSize: 14, fontWeight: '600', color: '#1B4332', marginBottom: 8 },
  labelRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 8,
  },
  clearButton: { fontSize: 13, fontWeight: '600', color: '#EF4444' },
  textInput: {
    backgroundColor: '#FFFFFF', borderRadius: 12, borderWidth: 1,
    borderColor: '#E5E7EB', paddingHorizontal: 16, paddingVertical: 12,
    fontSize: 16, color: '#1F2937',
  },
  multilineInput: {
    backgroundColor: '#F3F4F6', borderRadius: 12, borderWidth: 1,
    borderColor: '#E5E7EB', paddingHorizontal: 16, paddingVertical: 12,
    fontSize: 16, color: '#1F2937', minHeight: 80,
  },
  hint: { fontSize: 12, color: '#6B7280', marginTop: 4, paddingLeft: 2 },
  charCount: { fontSize: 11, color: '#9CA3AF', textAlign: 'right', marginTop: 4 },
  goButton: {
    marginTop: 24, backgroundColor: '#1B4332', borderRadius: 12,
    paddingVertical: 16, alignItems: 'center', minHeight: 56,
    shadowColor: '#1B4332', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3, shadowRadius: 4, elevation: 4,
  },
  goText: {
    color: '#FFFFFF', fontSize: 18, fontWeight: '700',
    letterSpacing: 1, textTransform: 'uppercase',
  },
  aiButton: {
    marginTop: 24, backgroundColor: '#1B4332', borderRadius: 12,
    paddingVertical: 16, alignItems: 'center', justifyContent: 'center',
    minHeight: 56, flexDirection: 'row',
    borderWidth: 2, borderColor: '#D4AF37',
    shadowColor: '#D4AF37', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3, shadowRadius: 4, elevation: 4,
  },
  aiButtonDisabled: {
    backgroundColor: '#9CA3AF', shadowOpacity: 0, elevation: 0, borderColor: '#9CA3AF',
  },
  aiButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700', letterSpacing: 0.5 },
});
