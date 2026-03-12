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
import { SubscriptionTier, getTierCapabilities } from '../../src/subscription/tiers';
import AgeGroupPicker from '../../components/AgeGroupPicker';
import Stepper from '../../components/Stepper';
import UpgradeBanner from '../../components/UpgradeBanner';
import { filterCandidates } from '../../src/core/engine/drillSelector';
import { SEED_DRILL_CATALOG } from '../../src/data/seedDrills';
import { loadCoachingStaff } from '../../src/data/storage/coachingStorage';
import { getActiveTeamProfile } from '../../src/data/storage/teamProfileStorage';
import { generateAIPracticePlan, convertAIPlanToPracticeSession } from '../../src/services/aiPracticeService';
// BUILD 101: AI Daily Budget
import { getRemainingAIGenerations, incrementAIUsage, PRO_DAILY_AI_LIMIT } from '../../src/data/storage/aiBudget';
import { isUnlimitedAgeGroup, FREE_GENERATION_LIMIT } from '../../src/data/storage/generationTracker';

type GenerateMode = 'engine' | 'ai';

const EXPERIENCE_LABELS: Record<number, string> = {
  0: 'First Year', 1: 'Beginner', 2: 'Developing',
  3: 'Intermediate', 4: 'Advanced', 5: 'Veteran',
};

// ── Focus Area Options ─────────────────────────────────────────
// Broad single-select categories. Coaches use Special Instructions for specifics.
// Pitching is suppressed for Intro, T-Ball, and Coach Pitch.
interface FocusOption {
  id: string;
  label: string;
  isPitching?: boolean;
}

const FOCUS_OPTIONS: FocusOption[] = [
  { id: 'balanced', label: 'Balanced' },
  { id: 'hitting', label: 'Hitting' },
  { id: 'fielding', label: 'Fielding' },
  { id: 'pitching', label: 'Pitching', isPitching: true },
  { id: 'base_running', label: 'Base Running' },
];

// Age groups that suppress pitching focus options
const PITCHING_SUPPRESSED = new Set([AgeGroup.INTRO, AgeGroup.T_BALL, AgeGroup.COACH_PITCH]);


export default function GenerateScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const {
    tier, lastRequest, generateSession, importPractice,
    showPaywall, paywallTrigger, closePaywall, openPaywall,
    freeGenerationsLeft, refreshGenerationsLeft,
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

  // AI-only state — multi-select focus area (max 3)
  const [selectedFocuses, setSelectedFocuses] = useState<Set<string>>(new Set(['balanced']));
  const MAX_FOCUSES = 3;

  const toggleFocus = (id: string) => {
    setSelectedFocuses(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        if (next.size <= 1) return prev; // Keep at least one
        next.delete(id);
      } else {
        if (next.size >= MAX_FOCUSES) return prev; // Cap at 3
        next.add(id);
      }
      return next;
    });
  };

  const atMaxFocuses = selectedFocuses.size >= MAX_FOCUSES;

  // Filter focus options based on age group (suppress pitching for young groups)
  const visibleFocusOptions = FOCUS_OPTIONS.filter(
    o => !o.isPitching || !PITCHING_SUPPRESSED.has(ageGroup)
  );

  // Clear pitching if age group changed to young
  useEffect(() => {
    if (PITCHING_SUPPRESSED.has(ageGroup)) {
      setSelectedFocuses(prev => {
        if (!prev.has('pitching')) return prev;
        const next = new Set(prev);
        next.delete('pitching');
        return next.size > 0 ? next : new Set(['balanced']);
      });
    }
  }, [ageGroup]);

  // Build the focusArea string for the AI prompt
  const focusArea = FOCUS_OPTIONS
    .filter(o => selectedFocuses.has(o.id))
    .map(o => o.label)
    .join(', ') || 'Balanced';
  const [durationText, setDurationText] = useState('60');
  const [specialInstructions, setSpecialInstructions] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  // BUILD 101: Daily AI budget (replaces 60s cooldown)
  const [aiRemaining, setAiRemaining] = useState(PRO_DAILY_AI_LIMIT);

  // Sync from lastRequest (clamp to tier caps, age-aware)
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

  // Auto-fill from active team + load AI budget
  useFocusEffect(
    useCallback(() => {
      getActiveTeamProfile().then(team => {
        if (team) {
          const tierCaps = getTierCapabilities(tier as SubscriptionTier, team.ageGroup);
          setAgeGroup(team.ageGroup);
          setExperience(Math.min(team.experienceLevel, tierCaps.maxExperience));
          // Clamp to tier limits so saved team values don't exceed caps
          setIntensity(Math.min(team.intensity, tierCaps.maxIntensity));
          setAssistants(Math.min(team.assistantCoaches, tierCaps.maxAssistants));
          setActiveTeamName(team.name);
        } else {
          setActiveTeamName(null);
        }
      });
      // BUILD 101: Refresh AI daily budget on each visit
      if (tier === SubscriptionTier.PRO) {
        getRemainingAIGenerations().then(setAiRemaining);
      }
      // Refresh free generation counter on tab focus
      if (tier === SubscriptionTier.FREE) {
        refreshGenerationsLeft(ageGroup);
      }
    }, [tier])
  );

  // NetInfo
  useEffect(() => {
    const unsub = NetInfo.addEventListener(s => setIsOnline(s.isConnected ?? true));
    return () => unsub();
  }, []);

  // Engine drill constraints — driven by tier capabilities (age-aware for assistant caps)
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

  // Clamp all values when age group or tier changes + refresh generation counter
  useEffect(() => {
    const avail = filterCandidates(SEED_DRILL_CATALOG, ageGroup, tier).length;
    const max = Math.min(caps.maxDrills, avail);
    if (numDrills > max) setNumDrills(max);
    if (assistants > caps.maxAssistants) setAssistants(caps.maxAssistants);
    if (intensity > caps.maxIntensity) setIntensity(caps.maxIntensity);
    if (experience > caps.maxExperience) setExperience(caps.maxExperience);
    // Refresh generation counter (unlimited groups show differently)
    if (tier === SubscriptionTier.FREE) refreshGenerationsLeft(ageGroup);
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
      router.navigate('/history');
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
            <Stepper label="Experience" value={experience} min={0} max={caps.maxExperience} onChange={setExperience} />
            <Text style={styles.expLabel}>{EXPERIENCE_LABELS[experience]}</Text>
          </View>

          {/* SHARED: Intensity */}
          <View style={styles.section}>
            <Stepper label="Intensity" value={intensity} min={1} max={caps.maxIntensity} onChange={setIntensity} />
            {intensityUpgradeHelps && <UpgradeBanner feature={`intensity up to ${proCaps.maxIntensity}`} />}
          </View>

          {/* SHARED: Assistants */}
          <View style={styles.section}>
            <Stepper label="Assistants" value={assistants} min={0} max={caps.maxAssistants} onChange={setAssistants} />
            {assistantsUpgradeHelps && <UpgradeBanner feature={`up to ${proCaps.maxAssistants} assistants`} />}
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
          )}

          {/* AI-ONLY: Focus Area + Duration + Instructions */}
          {mode === 'ai' && (
            <>
              <View style={styles.section}>
                <Text style={styles.label}>Focus Area ({selectedFocuses.size}/{MAX_FOCUSES})</Text>
                <Text style={styles.hint}>Select up to {MAX_FOCUSES} areas to focus on</Text>
                <View style={styles.chipRow}>
                  {visibleFocusOptions.map(opt => {
                    const isSelected = selectedFocuses.has(opt.id);
                    const isDisabled = !isSelected && atMaxFocuses;
                    return (
                      <TouchableOpacity
                        key={opt.id}
                        style={[
                          styles.chip,
                          isSelected && styles.chipSelected,
                          isDisabled && styles.chipDisabled,
                        ]}
                        onPress={() => toggleFocus(opt.id)}
                        activeOpacity={isDisabled ? 1 : 0.7}
                      >
                        <Text style={[
                          styles.chipText,
                          isSelected && styles.chipTextSelected,
                          isDisabled && styles.chipTextDisabled,
                        ]}>
                          {opt.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
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
                <Text style={styles.hint}>Optional — add detail to fine-tune your plan</Text>
                <TextInput
                  style={styles.multilineInput}
                  value={specialInstructions}
                  onChangeText={setSpecialInstructions}
                  placeholder="e.g., Extra bunting reps, no long sprints, keep drills under 10 min..."
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
            <>
              <TouchableOpacity style={styles.goButton} onPress={handleEngineGo} activeOpacity={0.85}>
                <Text style={styles.goText}>Generate</Text>
              </TouchableOpacity>
              {tier === SubscriptionTier.FREE && (
                <Text style={styles.generationHint}>
                  {isUnlimitedAgeGroup(ageGroup)
                    ? 'Free for this age group — no limits'
                    : `${freeGenerationsLeft} of ${FREE_GENERATION_LIMIT} free plans remaining`}
                </Text>
              )}
            </>
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
  generationHint: {
    fontSize: 12, color: '#6B7280', textAlign: 'center',
    marginTop: 8, fontWeight: '500',
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
  // Focus area chip picker
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 4,
  },
  chip: {
    backgroundColor: '#F3F4F6',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  chipSelected: {
    backgroundColor: '#1B4332',
    borderColor: '#1B4332',
  },
  chipText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#374151',
  },
  chipTextSelected: {
    color: '#FFFFFF',
  },
  chipDisabled: {
    opacity: 0.4,
  },
  chipTextDisabled: {
    color: '#9CA3AF',
  },
});
