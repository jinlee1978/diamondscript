import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, TextInput, Alert, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import NetInfo from '@react-native-community/netinfo';
import { usePractice } from '../../context/PracticeContext';
import { AgeGroup } from '../../src/data/types';
import { SubscriptionTier } from '../../src/subscription/tiers';
import Stepper from '../../components/Stepper';
import PaywallModal from '../../components/PaywallModal';
import { generateAIPracticePlan, convertAIPlanToPracticeSession } from '../../src/services/aiPracticeService';
// BUILD 100: Auto-fill from active team profile
import { getActiveTeamProfile } from '../../src/data/storage/teamProfileStorage';

export default function AILabScreen() {
  const router = useRouter();
  const { tier, importPractice, aiCooldownUntil, setAiCooldownUntil, openPaywall, showPaywall, paywallTrigger, closePaywall } = usePractice();

  // Form state - BUILD 59: Restored Intensity (1-5) and Assistant Coaches
  const [ageGroup, setAgeGroup] = useState<AgeGroup>(AgeGroup.KID_PITCH);
  const [experience, setExperience] = useState(2);
  const [focusArea, setFocusArea] = useState('Hitting');
  const [durationText, setDurationText] = useState('60'); // BUILD 62: String for TextInput
  const [intensity, setIntensity] = useState(3); // BUILD 59: Integer intensity (1-5)
  const [assistantCoaches, setAssistantCoaches] = useState(0); // BUILD 59: Restored
  const [specialInstructions, setSpecialInstructions] = useState('');

  // UI state - BUILD 60: Global cooldown + connectivity
  const [isGenerating, setIsGenerating] = useState(false);
  const [isOnline, setIsOnline] = useState(true);

  // BUILD 67: Auth handled automatically by Auto-Repair logic in generateAIPracticePlan()

  // BUILD 100: Active team name for display
  const [activeTeamName, setActiveTeamName] = useState<string | null>(null);

  // BUILD 60: NetInfo connectivity guard
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      setIsOnline(state.isConnected ?? true);
    });
    return () => unsubscribe();
  }, []);

  // BUILD 100: Auto-fill from active team profile on focus
  useFocusEffect(
    useCallback(() => {
      getActiveTeamProfile().then(team => {
        if (team) {
          setAgeGroup(team.ageGroup);
          setExperience(team.experienceLevel);
          setIntensity(team.intensity);
          setAssistantCoaches(team.assistantCoaches);
          setActiveTeamName(team.name);
        } else {
          setActiveTeamName(null);
        }
      });
    }, [])
  );

  const getButtonState = () => {
    if (!isOnline) {
      return { disabled: true, text: 'No Internet Connection', showSpinner: false };
    }
    if (isGenerating) {
      return { disabled: true, text: 'Generating Practice Plan...', showSpinner: true };
    }
    // BUILD 60: GLOBAL COOLDOWN - Calculate remaining time from timestamp
    const cooldownRemaining = Math.max(0, Math.ceil((aiCooldownUntil - Date.now()) / 1000));
    if (cooldownRemaining > 0) {
      return { disabled: true, text: `Cooldown: ${cooldownRemaining}s`, showSpinner: false };
    }
    return { disabled: false, text: 'Generate AI Plan ✨', showSpinner: false };
  };

  const handleGenerate = async () => {
    // BUILD 81: AI Generator Gate - Block free users from Gemini API
    if (tier !== SubscriptionTier.PRO) {
      openPaywall('ai_generator');
      return;
    }

    // BUILD 62: Validate duration input
    const duration = parseInt(durationText, 10);
    if (isNaN(duration) || duration < 15 || duration > 240) {
      Alert.alert(
        'Invalid Duration',
        'Please enter a practice duration between 15 and 240 minutes.',
        [{ text: 'OK', style: 'cancel' }]
      );
      return;
    }

    setIsGenerating(true);
    try {
      // BUILD 100: Map AgeGroup enum to string format for Gemini
      const ageGroupStringMap: Record<AgeGroup, string> = {
        [AgeGroup.INTRO]: 'Intro (3-4)',
        [AgeGroup.T_BALL]: 'T-Ball (5-6)',
        [AgeGroup.COACH_PITCH]: 'Coach Pitch (7-8)',
        [AgeGroup.MACHINE_PITCH]: 'Machine Pitch (8-9)',
        [AgeGroup.KID_PITCH]: 'Kid Pitch (9-10)',
        [AgeGroup.COMPETITIVE]: 'Competitive (11-12)',
        [AgeGroup.ADVANCED]: 'Advanced (13-14)',
      };
      const ageGroupString = ageGroupStringMap[ageGroup];

      // Map intensity to string format for service
      const intensityMap = { 1: 'rec', 2: 'rec', 3: 'travel', 4: 'competitive', 5: 'competitive' } as const;
      const intensityType = intensityMap[intensity as 1 | 2 | 3 | 4 | 5];

      // BUILD 60: Generate AI plan with error handling
      const aiPlan = await generateAIPracticePlan({
        ageGroup: ageGroupString,
        experienceLevel: experience,
        focusArea,
        duration,
        intensity: intensityType,
        assistantCoaches,
        userInstructions: specialInstructions || undefined,
      });

      // BUILD 60: DATA CORRUPTION FIX - Validate response before conversion
      if (!aiPlan || !aiPlan.planTitle || !aiPlan.sections) {
        throw new Error('Invalid practice plan received from AI');
      }

      // Convert AI plan to PracticeSession format
      const baseSession = convertAIPlanToPracticeSession(aiPlan, {
        ageGroup: ageGroupString,
        experienceLevel: experience,
        focusArea,
        duration,
        intensity: intensityType,
        assistantCoaches,
      }, tier);

      // BUILD 63: Add source tracking to AI-generated practice
      const practiceSession = {
        ...baseSession,
        source: 'ai' as const,
      };

      // BUILD 60: Navigate first to prevent data orphaning if transition fails
      router.navigate('/history');
      importPractice(practiceSession);
      setAiCooldownUntil(Date.now() + 60000); // 60 seconds from now

    } catch (error) {
      // BUILD 60: Error handling - no import or navigation on failure
      Alert.alert(
        'AI Generation Failed',
        error instanceof Error ? error.message : 'Unable to generate AI practice plan. Please try again.',
        [{ text: 'OK', style: 'cancel' }]
      );
    } finally {
      setIsGenerating(false);
    }
  };

  const buttonState = getButtonState();

  return (
    <SafeAreaView style={styles.safeArea} edges={['left', 'right']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        {/* BUILD 59: PROFESSIONAL CENTERING */}
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.container}
            keyboardShouldPersistTaps="handled"
          >
            {/* Header - BUILD 59: Forest Green branding */}
            <View style={styles.header}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="sparkles" size={24} color="#D4AF37" />
                <Text style={styles.headerTitle}>AI Lab</Text>
              </View>
              <Text style={styles.headerSubtitle}>
                Generate custom practice plans powered by Gemini AI
              </Text>
            </View>

            {/* BUILD 100: Active team indicator */}
            {activeTeamName && (
              <View style={styles.teamBanner}>
                <Text style={styles.teamBannerText}>
                  {activeTeamName}
                </Text>
              </View>
            )}

            {/* Age Group Picker — BUILD 100: 7 groups, horizontal scroll */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Age Group</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.ageGroupRow}>
                  {[
                    { value: AgeGroup.INTRO, label: 'Intro', sub: '3-4' },
                    { value: AgeGroup.T_BALL, label: 'T-Ball', sub: '5-6' },
                    { value: AgeGroup.COACH_PITCH, label: 'Coach', sub: '7-8' },
                    { value: AgeGroup.MACHINE_PITCH, label: 'Machine', sub: '8-9' },
                    { value: AgeGroup.KID_PITCH, label: 'Kid Pitch', sub: '9-10' },
                    { value: AgeGroup.COMPETITIVE, label: '11-12U', sub: '11-12' },
                    { value: AgeGroup.ADVANCED, label: '13-14U', sub: '13-14' },
                  ].map((option) => (
                    <TouchableOpacity
                      key={option.value}
                      style={[
                        styles.ageGroupButton,
                        ageGroup === option.value && styles.ageGroupButtonActive,
                      ]}
                      onPress={() => setAgeGroup(option.value)}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          styles.ageGroupButtonText,
                          ageGroup === option.value && styles.ageGroupButtonTextActive,
                        ]}
                      >
                        {option.label}
                      </Text>
                      <Text
                        style={[
                          styles.ageGroupSubText,
                          ageGroup === option.value && styles.ageGroupSubTextActive,
                        ]}
                      >
                        {option.sub}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            </View>

            {/* Experience Level */}
            <View style={styles.inputGroup}>
              <Stepper
                label="Experience Level"
                value={experience}
                min={0}
                max={5}
                onChange={setExperience}
              />
              <Text style={styles.experienceLabel}>
                {['First Year', 'Beginner', 'Developing', 'Intermediate', 'Advanced', 'Veteran'][experience]}
              </Text>
            </View>

            {/* Focus Area */}
            <View style={styles.inputGroup}>
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

            {/* Duration - BUILD 62: TextInput with validation */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Practice Duration (minutes)</Text>
              <TextInput
                style={styles.textInput}
                value={durationText}
                onChangeText={setDurationText}
                placeholder="Duration in minutes (e.g., 90)"
                placeholderTextColor="#9CA3AF"
                keyboardType="numeric"
                maxLength={3}
              />
              <Text style={styles.durationHint}>
                Valid range: 15-240 minutes
              </Text>
            </View>

            {/* BUILD 59: FEATURE RESTORATION - Intensity (1-5) */}
            <View style={styles.inputGroup}>
              <Stepper
                label="Practice Intensity"
                value={intensity}
                min={1}
                max={5}
                onChange={setIntensity}
              />
              <Text style={styles.experienceLabel}>
                {['Light', 'Moderate', 'Standard', 'Vigorous', 'Maximum'][intensity - 1]}
              </Text>
            </View>

            {/* BUILD 59: FEATURE RESTORATION - Assistant Coaches */}
            <View style={styles.inputGroup}>
              <Stepper
                label="Assistant Coaches"
                value={assistantCoaches}
                min={0}
                max={3}
                onChange={setAssistantCoaches}
              />
              <Text style={styles.experienceLabel}>
                {assistantCoaches === 0 ? 'Head Coach Only' : `${assistantCoaches + 1} Total Coaches`}
              </Text>
            </View>

            {/* Special Instructions - BUILD 68: Added Clear button and countdown */}
            <View style={styles.inputGroup}>
              <View style={styles.labelRow}>
                <Text style={[styles.label, { marginBottom: 0 }]}>Special Instructions (Optional)</Text>
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
                placeholder="e.g., Focus on bunting, avoid long sprints, use only 2 baseballs..."
                placeholderTextColor="#9CA3AF"
                multiline
                numberOfLines={3}
                textAlignVertical="top"
                maxLength={500}
              />
              <Text style={styles.characterCount}>
                {specialInstructions.length}/500 characters
              </Text>
            </View>

            {/* Generate Button - BUILD 59: Forest Green & Gold */}
            <TouchableOpacity
              style={[
                styles.generateButton,
                buttonState.disabled && styles.generateButtonDisabled,
              ]}
              onPress={handleGenerate}
              disabled={buttonState.disabled}
              activeOpacity={0.85}
            >
              {buttonState.showSpinner && (
                <ActivityIndicator color="#FFFFFF" style={styles.spinner} />
              )}
              <Text style={styles.generateButtonText}>{buttonState.text}</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>

      {/* BUILD 81: PaywallModal for AI Generator Gate */}
      <PaywallModal
        visible={showPaywall}
        onClose={closePaywall}
        onSuccess={closePaywall}
        trigger={paywallTrigger ?? undefined}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  scroll: {
    flex: 1,
  },
  container: {
    padding: 24,
    paddingBottom: 48,
  },
  header: {
    paddingHorizontal: 0,
    paddingTop: 20,
    paddingBottom: 16,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1B4332', // BUILD 59: Forest Green
    marginBottom: 8,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
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
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1B4332', // BUILD 59: Forest Green
    marginBottom: 8,
  },
  ageGroupRow: {
    flexDirection: 'row',
    gap: 8,
  },
  ageGroupButton: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#A8DADC', // BUILD 59: Soft green-blue
    minHeight: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ageGroupButtonActive: {
    backgroundColor: '#1B4332', // BUILD 59: Forest Green
    borderColor: '#D4AF37', // BUILD 59: Gold
  },
  ageGroupButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
  },
  ageGroupButtonTextActive: {
    color: '#FFFFFF',
  },
  ageGroupSubText: {
    fontSize: 10,
    fontWeight: '500',
    color: '#9CA3AF',
    marginTop: 1,
  },
  ageGroupSubTextActive: {
    color: '#86EFAC',
  },
  experienceLabel: {
    textAlign: 'right',
    fontSize: 13,
    color: '#1B4332', // BUILD 59: Forest Green
    fontWeight: '600',
    marginTop: 4,
    paddingRight: 2,
  },
  textInput: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#A8DADC', // BUILD 59: Soft green-blue
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#1F2937',
  },
  durationHint: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
    paddingLeft: 2,
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
  generateButton: {
    marginTop: 32,
    backgroundColor: '#1B4332', // BUILD 59: Forest Green
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 56,
    flexDirection: 'row',
    shadowColor: '#D4AF37', // BUILD 59: Gold shadow
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
    borderWidth: 2,
    borderColor: '#D4AF37', // BUILD 59: Gold border
  },
  generateButtonDisabled: {
    backgroundColor: '#9CA3AF',
    shadowOpacity: 0,
    elevation: 0,
    borderColor: '#9CA3AF',
  },
  generateButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  spinner: {
    marginRight: 8,
  },
  // BUILD 68: Special instructions enhancements
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  clearButton: {
    fontSize: 13,
    fontWeight: '600',
    color: '#EF4444',
  },
  characterCount: {
    fontSize: 11,
    color: '#9CA3AF',
    textAlign: 'right',
    marginTop: 4,
  },
});
