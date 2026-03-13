import React, { useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Alert, Image } from 'react-native';
import { Stack, useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import { usePractice } from '../../context/PracticeContext';
import { DrillCategory } from '../../src/data/types';
import { SEED_DRILL_CATALOG } from '../../src/data/seedDrills';
import { getSubscriptionInfo } from '../../src/subscription/service';
import { getActiveTeamProfile } from '../../src/data/storage/teamProfileStorage';
import { getActiveSeason } from '../../src/data/storage/seasonStorage';
import { TeamProfile } from '../../src/data/types/teamProfile';
import { Season, ScheduledPractice } from '../../src/data/types/season';

// Age group formatting
function formatAgeGroup(raw: string): string {
  const labelMap: Record<string, string> = {
    'INTRO': 'Intro (3-4)', 'T_BALL': 'T-Ball', 'COACH_PITCH': 'Coach Pitch',
    'MACHINE_PITCH': 'Machine Pitch', 'KID_PITCH': 'Kid Pitch',
    'COMPETITIVE': '11-12U', 'ADVANCED': '13-14U',
    '8U': 'Coach Pitch', '10U': 'Kid Pitch', '12U': '11-12U', '14U': '13-14U',
  };
  return labelMap[raw] ?? raw.replace('AGE_', '').replace('_', '-');
}

// BUILD 49: Universal Import
interface PendingImport {
  type: 'drill' | 'practice';
  name?: string;
  description?: string;
  category?: DrillCategory;
  equipment?: string[];
  isDuplicate?: boolean;
  totalMinutes?: number;
  coachCount?: number;
  ageGroup?: string;
  practiceData?: any;
}

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { tier, currentSession, isLoading, starredDrills, customDrills, history, importDrill, importPractice, openPaywall, showPaywall, paywallTrigger, closePaywall } = usePractice();

  const [pendingImport, setPendingImport] = useState<PendingImport | null>(null);
  const [promptedDrills, setPromptedDrills] = useState<Set<string>>(new Set());
  const [activeTeam, setActiveTeam] = useState<TeamProfile | null>(null);
  const [nextPractice, setNextPractice] = useState<ScheduledPractice | null>(null);
  const [activeSeason, setActiveSeason] = useState<Season | null>(null);

  // Validate tier on focus
  useFocusEffect(
    useCallback(() => {
      getSubscriptionInfo().catch(() => {});
    }, [])
  );

  // Load dashboard data on focus
  useFocusEffect(
    useCallback(() => {
      getActiveTeamProfile().then(setActiveTeam);
      getActiveSeason().then(season => {
        setActiveSeason(season);
        if (season) {
          const today = new Date().toISOString().split('T')[0];
          const upcoming = season.practices
            .filter(p => p.date >= today && !p.completed)
            .sort((a, b) => a.date.localeCompare(b.date));
          setNextPractice(upcoming[0] || null);
        } else {
          setNextPractice(null);
        }
      });
    }, [])
  );

  // Clipboard import logic (unchanged)
  const checkClipboard = React.useCallback(async (isManualTrigger = false) => {
    try {
      const clipboardContent = await Clipboard.getStringAsync();
      if (clipboardContent.includes('{DIAMONDSCRIPT_DATA:')) {
        const match = clipboardContent.match(/\{DIAMONDSCRIPT_DATA:([\s\S]+?)\}\s*$/);
        if (match && match[1]) {
          try {
            const data = JSON.parse(match[1]);
            const contentType = data.type || 'drill';

            if (contentType === 'drill' && data.name && data.description) {
              const drillHash = `${data.name}|${data.description}`;
              if (promptedDrills.has(drillHash)) return true;
              setPromptedDrills((prev) => new Set(prev).add(drillHash));
              const isDuplicate = customDrills.some(
                (d) => d.name === data.name && d.description === data.description
              );
              setPendingImport({
                type: 'drill', name: data.name, description: data.description,
                category: data.category, equipment: data.equipment || [], isDuplicate,
              });
              if (isManualTrigger) Alert.alert('Shared Drill Found', 'Import card displayed below.');
              return true;
            }

            if (contentType === 'practice' && data.ageGroup && data.totalMinutes) {
              const practiceHash = `practice-${data.ageGroup}-${data.totalMinutes}`;
              if (promptedDrills.has(practiceHash)) return true;
              setPromptedDrills((prev) => new Set(prev).add(practiceHash));
              setPendingImport({
                type: 'practice', ageGroup: data.ageGroup, totalMinutes: data.totalMinutes,
                coachCount: data.coachCount || data.stationCount || 1, practiceData: data,
              });
              if (isManualTrigger) Alert.alert('Shared Practice Found', 'Import card displayed below.');
              return true;
            }
          } catch { /* parse error */ }
        }
      }
      if (isManualTrigger) Alert.alert('No Shared Content Found', 'Copy a shared drill or practice link and try again.');
      return false;
    } catch { return false; }
  }, [promptedDrills, customDrills]);

  useFocusEffect(
    React.useCallback(() => { checkClipboard(false); }, [checkClipboard])
  );

  const handleImport = () => {
    if (!pendingImport) return;
    if (pendingImport.type === 'drill') {
      importDrill(pendingImport.name!, pendingImport.description!, pendingImport.category || 'hitting', pendingImport.equipment || []);
    } else if (pendingImport.type === 'practice' && pendingImport.practiceData?.session) {
      const success = importPractice(pendingImport.practiceData.session);
      if (success) router.push('/practice');
    }
    Clipboard.setStringAsync('');
    setPendingImport(null);
  };

  const handleDismiss = () => {
    if (pendingImport?.type === 'drill' && pendingImport.isDuplicate) Clipboard.setStringAsync('');
    setPendingImport(null);
  };

  // Computed values
  const starredAppDrills = SEED_DRILL_CATALOG.filter(d => starredDrills.has(d.id));
  const totalDrills = starredAppDrills.length + customDrills.length;
  const lastPractice = history.length > 0 ? history[0] : null;

  const formatPracticeDate = (date: string) => {
    const d = new Date(date + 'T12:00:00');
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    if (date === today.toISOString().split('T')[0]) return 'Today';
    if (date === tomorrow.toISOString().split('T')[0]) return 'Tomorrow';
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  };

  return (
    <>
      <Stack.Screen
        options={{
          headerRight: () => (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 18, paddingRight: 4 }}>
              <TouchableOpacity
                onPress={() => checkClipboard(true)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="clipboard-outline" size={20} color="#FFFFFF" />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => router.navigate('/settings')}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="settings-outline" size={20} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          ),
        }}
      />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.container, { paddingBottom: insets.bottom + 24 }]}
      >
        {/* Import Card */}
        {pendingImport && (
          <View style={[styles.importCard, pendingImport.type === 'practice' && styles.importCardPractice]}>
            <View style={styles.importHeader}>
              <View style={[styles.sharedBadge, pendingImport.type === 'practice' && styles.sharedBadgePractice]}>
                <Text style={[styles.sharedBadgeText, pendingImport.type === 'practice' && styles.sharedBadgeTextPractice]}>
                  {pendingImport.type === 'drill' ? 'SHARED DRILL' : 'SHARED PLAN'}
                </Text>
              </View>
              <TouchableOpacity onPress={handleDismiss} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close" size={20} color="#6B7280" />
              </TouchableOpacity>
            </View>
            {pendingImport.type === 'drill' ? (
              <View style={styles.importBody}>
                <Text style={styles.importDrillName}>{pendingImport.name}</Text>
                <Text style={styles.importDrillDesc} numberOfLines={2}>{pendingImport.description}</Text>
              </View>
            ) : (
              <View style={styles.importBody}>
                <Text style={styles.importDrillName}>{pendingImport.ageGroup} Practice</Text>
                <Text style={styles.importDrillDesc}>
                  {pendingImport.totalMinutes} min  {'\u2022'}  {pendingImport.coachCount} coach{pendingImport.coachCount !== 1 ? 'es' : ''}
                </Text>
              </View>
            )}
            <View style={styles.importActions}>
              <TouchableOpacity style={styles.importButtonSecondary} onPress={handleDismiss}>
                <Text style={styles.importButtonSecondaryText}>Dismiss</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.importButtonPrimary} onPress={handleImport}>
                <Text style={styles.importButtonPrimaryText}>Import</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {isLoading ? (
          <Text style={styles.loading}>Loading...</Text>
        ) : (
          <>
            {/* Logo + Greeting + Tier */}
            <View style={styles.greetingRow}>
              <Image
                source={require('../../assets/icon.png')}
                style={styles.logo}
                resizeMode="contain"
              />
              <View style={styles.greetingTextArea}>
                <Text style={styles.greeting} numberOfLines={1} adjustsFontSizeToFit>DiamondScript</Text>
                <Text style={styles.greetingSub}>
                  {activeTeam ? activeTeam.name : 'Practice generation for every diamond.'}
                </Text>
              </View>
              <View style={[styles.tierBadge, tier === 'pro' && styles.tierBadgePro]}>
                <Text style={[styles.tierText, tier === 'pro' && styles.tierTextPro]}>
                  {tier === 'pro' ? 'PRO' : 'FREE'}
                </Text>
              </View>
            </View>

            {/* Primary CTA */}
            <TouchableOpacity
              style={styles.ctaButton}
              onPress={() => router.navigate('/generate')}
              activeOpacity={0.85}
            >
              <Ionicons name="baseball-outline" size={20} color="#FFFFFF" />
              <Text style={styles.ctaText}>Generate Practice</Text>
            </TouchableOpacity>

            {/* Next Practice (from Season) */}
            {nextPractice && activeSeason && (
              <TouchableOpacity style={styles.nextPracticeCard} onPress={() => router.navigate('/season')} activeOpacity={0.8}>
                <View style={styles.nextPracticeIcon}>
                  <Ionicons name="calendar" size={18} color="#1B4332" />
                </View>
                <View style={styles.nextPracticeInfo}>
                  <Text style={styles.nextPracticeLabel}>Next Practice</Text>
                  <Text style={styles.nextPracticeDate}>
                    {formatPracticeDate(nextPractice.date)}{nextPractice.time ? ` at ${nextPractice.time}` : ''}
                  </Text>
                  {nextPractice.location ? (
                    <Text style={styles.nextPracticeLocation}>{nextPractice.location}</Text>
                  ) : null}
                </View>
                <Ionicons name="chevron-forward" size={16} color="#9CA3AF" />
              </TouchableOpacity>
            )}

            {/* Quick Actions Row */}
            <View style={styles.quickActions}>
              <TouchableOpacity style={styles.quickAction} onPress={() => router.navigate('/teams')} activeOpacity={0.8}>
                <View style={[styles.quickActionIcon, { backgroundColor: '#ECFDF5' }]}>
                  <Ionicons name="shield-outline" size={20} color="#1B4332" />
                </View>
                <Text style={styles.quickActionLabel}>Teams</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.quickAction} onPress={() => router.navigate('/drills')} activeOpacity={0.8}>
                <View style={[styles.quickActionIcon, { backgroundColor: '#FEF3C7' }]}>
                  <Ionicons name="star-outline" size={20} color="#92400E" />
                </View>
                <Text style={styles.quickActionLabel}>Drills</Text>
                {totalDrills > 0 && (
                  <View style={styles.quickActionBadge}>
                    <Text style={styles.quickActionBadgeText}>{totalDrills}</Text>
                  </View>
                )}
              </TouchableOpacity>

              <TouchableOpacity style={styles.quickAction} onPress={() => router.navigate('/season')} activeOpacity={0.8}>
                <View style={[styles.quickActionIcon, { backgroundColor: '#EFF6FF' }]}>
                  <Ionicons name="calendar-outline" size={20} color="#1D4ED8" />
                </View>
                <Text style={styles.quickActionLabel}>Season</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.quickAction} onPress={() => router.navigate('/coaching')} activeOpacity={0.8}>
                <View style={[styles.quickActionIcon, { backgroundColor: '#F3E8FF' }]}>
                  <Ionicons name="people-outline" size={20} color="#7C3AED" />
                </View>
                <Text style={styles.quickActionLabel}>Staff</Text>
              </TouchableOpacity>
            </View>

            {/* Recent Practice Log */}
            {history.length > 0 && (
              <View style={styles.recentSection}>
                <View style={styles.recentHeader}>
                  <Text style={styles.recentTitle}>Recent Practices</Text>
                  <TouchableOpacity onPress={() => router.navigate('/history')}>
                    <Text style={styles.recentSeeAll}>See All</Text>
                  </TouchableOpacity>
                </View>

                {history.slice(0, 3).filter(s => s?.session?.request).map((entry, i) => (
                  <TouchableOpacity
                    key={entry.savedAt?.toString() || i}
                    style={styles.recentCard}
                    onPress={() => router.navigate('/history')}
                    activeOpacity={0.8}
                  >
                    <View style={styles.recentCardLeft}>
                      <Text style={styles.recentCardAge}>{formatAgeGroup(entry.session.request?.ageGroup ?? 'Unknown')}</Text>
                      <Text style={styles.recentCardMeta}>
                        {entry.session.selectedDrills?.length ?? 0} drills  {'\u2022'}  {entry.session.stationLayout?.totalWallClockMinutes ?? 0} min
                        {entry.session.source === 'ai' ? '  \u2022  AI' : ''}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={14} color="#D1D5DB" />
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Upgrade nudge */}
            {tier === 'free' && (
              <TouchableOpacity style={styles.upgradeNudge} onPress={() => openPaywall('feature')} activeOpacity={0.7}>
                <Ionicons name="diamond-outline" size={16} color="#92400E" />
                <Text style={styles.upgradeNudgeText}>
                  Unlock full power with <Text style={styles.upgradeNudgeBold}>Pro — $9.99/mo</Text>
                </Text>
              </TouchableOpacity>
            )}
          </>
        )}
      </ScrollView>

    </>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: '#FAFBFC' },
  container: { padding: 20 },
  loading: { textAlign: 'center', marginTop: 80, color: '#6B7280', fontSize: 16 },

  // Logo + Greeting
  greetingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
    gap: 12,
  },
  logo: {
    width: 44,
    height: 44,
    borderRadius: 12,
  },
  greetingTextArea: {
    flex: 1,
  },
  greeting: {
    fontSize: 24,
    fontWeight: '800',
    color: '#1B4332',
    letterSpacing: -0.5,
  },
  greetingSub: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 1,
  },
  tierBadge: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  tierBadgePro: {
    backgroundColor: '#D4AF37',
  },
  tierText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6B7280',
    letterSpacing: 0.8,
  },
  tierTextPro: {
    color: '#FFFFFF',
  },

  // CTA
  ctaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#1B4332',
    borderRadius: 16,
    paddingVertical: 18,
    marginBottom: 20,
    shadowColor: '#1B4332',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  ctaText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.3,
  },

  // Next practice
  nextPracticeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDF4',
    borderRadius: 14,
    padding: 14,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#BBF7D0',
    gap: 12,
  },
  nextPracticeIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#DCFCE7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextPracticeInfo: { flex: 1 },
  nextPracticeLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  nextPracticeDate: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1B4332',
    marginTop: 1,
  },
  nextPracticeLocation: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 1,
  },

  // Quick Actions
  quickActions: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 24,
  },
  quickAction: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#F3F4F6',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
    position: 'relative',
  },
  quickActionIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  quickActionLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#374151',
  },
  quickActionBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: '#D4AF37',
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  quickActionBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // Recent Practices
  recentSection: { marginBottom: 20 },
  recentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  recentTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  recentSeeAll: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1B4332',
  },
  recentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  recentCardLeft: { flex: 1 },
  recentCardAge: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  recentCardMeta: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 2,
  },

  // Upgrade
  upgradeNudge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FEF3C7',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  upgradeNudgeText: {
    fontSize: 13,
    color: '#92400E',
  },
  upgradeNudgeBold: { fontWeight: '700' },

  // Import Card
  importCard: {
    marginBottom: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 2,
    borderColor: '#3B82F6',
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
  },
  importCardPractice: { borderColor: '#D4AF37', shadowColor: '#D4AF37' },
  importHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  sharedBadge: {
    backgroundColor: '#DBEAFE',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#3B82F6',
  },
  sharedBadgeText: { fontSize: 10, fontWeight: '700', color: '#1D4ED8', letterSpacing: 0.5 },
  sharedBadgePractice: { backgroundColor: '#FEF3C7', borderColor: '#D4AF37' },
  sharedBadgeTextPractice: { color: '#92400E' },
  importBody: {
    backgroundColor: '#F9FAFB',
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
  },
  importDrillName: { fontSize: 15, fontWeight: '600', color: '#1B4332' },
  importDrillDesc: { fontSize: 13, color: '#6B7280', marginTop: 3 },
  importActions: { flexDirection: 'row', gap: 10 },
  importButtonPrimary: {
    flex: 1,
    backgroundColor: '#3B82F6',
    paddingVertical: 11,
    borderRadius: 10,
    alignItems: 'center',
  },
  importButtonPrimaryText: { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },
  importButtonSecondary: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    paddingVertical: 11,
    borderRadius: 10,
    alignItems: 'center',
  },
  importButtonSecondaryText: { fontSize: 14, fontWeight: '600', color: '#6B7280' },
});
