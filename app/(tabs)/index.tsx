import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { Stack, useRouter, useFocusEffect } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { usePractice } from '../../context/PracticeContext';
import { DrillCategory } from '../../src/data/types';


// BUILD 49: Universal Import - supports both Drills and Practices
interface PendingImport {
  type: 'drill' | 'practice';
  // Drill fields
  name?: string;
  description?: string;
  category?: DrillCategory;
  equipment?: string[];
  isDuplicate?: boolean;
  // Practice fields
  totalMinutes?: number;
  stationCount?: number;
  ageGroup?: string;
  practiceData?: any; // Full practice session for import
}

export default function HomeScreen() {
  // BUILD 47: ALL hooks at absolute top (React Rules of Hooks)
  const router = useRouter();
  const { tier, currentSession, isLoading, starredDrills, customDrills, history, importDrill, importPractice } = usePractice();

  // BUILD 47: Magic Import state (visual card instead of Alert)
  const [pendingImport, setPendingImport] = useState<PendingImport | null>(null);
  const [promptedDrills, setPromptedDrills] = useState<Set<string>>(new Set());

  // BUILD 49: Universal Magic Import - detects both Drills and Practices
  const checkClipboard = React.useCallback(async (isManualTrigger = false) => {
    try {
      const clipboardContent = await Clipboard.getStringAsync();

      // BUILD 49: Debugging transparency
      console.log('[Clipboard Scan]', {
        hasPrefix: clipboardContent.includes('{DIAMONDSCRIPT_DATA:'),
        isManual: isManualTrigger
      });

      // Check if clipboard contains the magic prefix
      if (clipboardContent.includes('{DIAMONDSCRIPT_DATA:')) {
        // BUILD 51: Robust regex - matches any character including newlines and special chars
        const match = clipboardContent.match(/\{DIAMONDSCRIPT_DATA:([\s\S]+?)\}\s*$/);

        console.log('[Clipboard Scan]', { found: !!match });

        if (match && match[1]) {
          try {
            const data = JSON.parse(match[1]);
            const contentType = data.type || 'drill'; // Default to drill for backwards compatibility

            console.log('[Clipboard Scan]', { type: contentType, hasName: !!data.name });

            // BUILD 49: DRILL IMPORT (removed category gatekeeper - fix for "8U/14U trap")
            if (contentType === 'drill') {
              // Validate ONLY name and description (no category requirement)
              if (data.name && data.description) {
                // BUILD 46: Session tracking - check if already prompted
                const drillHash = `${data.name}|${data.description}`;
                if (promptedDrills.has(drillHash)) {
                  return true; // Already prompted - return success
                }

                // Mark as prompted
                setPromptedDrills((prev) => new Set(prev).add(drillHash));

                // BUILD 46: Duplicate detection
                const isDuplicate = customDrills.some(
                  (d) => d.name === data.name && d.description === data.description
                );

                // Show Import Card
                setPendingImport({
                  type: 'drill',
                  name: data.name,
                  description: data.description,
                  category: data.category,
                  equipment: data.equipment || [],
                  isDuplicate,
                });

                if (isManualTrigger) {
                  Alert.alert('✓ Shared Drill Found', 'Import card displayed below.');
                }
                return true;
              }
            }

            // BUILD 49: PRACTICE IMPORT
            if (contentType === 'practice') {
              if (data.ageGroup && data.totalMinutes && data.stationCount) {
                const practiceHash = `practice-${data.ageGroup}-${data.totalMinutes}`;
                if (promptedDrills.has(practiceHash)) {
                  return true; // Already prompted
                }

                setPromptedDrills((prev) => new Set(prev).add(practiceHash));

                setPendingImport({
                  type: 'practice',
                  ageGroup: data.ageGroup,
                  totalMinutes: data.totalMinutes,
                  stationCount: data.stationCount,
                  practiceData: data,
                });

                if (isManualTrigger) {
                  Alert.alert('✓ Shared Practice Found', 'Import card displayed below.');
                }
                return true;
              }
            }
          } catch (parseError) {
            console.error('[Clipboard Scan] Parse error:', parseError);
          }
        }
      }

      // BUILD 49: Manual trigger feedback - no data found
      if (isManualTrigger) {
        Alert.alert('No Shared Content Found', 'Copy a shared drill or practice link and try again.');
      }
      return false;
    } catch (error) {
      console.error('[Clipboard Scan] Failed:', error);
      return false;
    }
  }, [promptedDrills, customDrills]);

  // BUILD 49: Clipboard listener - automatic detection on screen focus
  useFocusEffect(
    React.useCallback(() => {
      checkClipboard(false); // Automatic, not manual
    }, [checkClipboard])
  );

  // BUILD 49: Universal Import handlers - support both drills and practices
  const handleImport = () => {
    if (!pendingImport) return;

    if (pendingImport.type === 'drill') {
      importDrill(
        pendingImport.name!,
        pendingImport.description!,
        pendingImport.category || 'hitting',
        pendingImport.equipment || []
      );
    } else if (pendingImport.type === 'practice') {
      // BUILD 51: Practice import now fully implemented
      if (pendingImport.practiceData?.session) {
        importPractice(pendingImport.practiceData.session);
        // Navigate to practice screen to view imported practice
        router.push('/practice');
      } else {
        Alert.alert('Import Error', 'Practice data is incomplete. Unable to import.');
      }
    }

    // Clear clipboard and pending import
    Clipboard.setStringAsync('');
    setPendingImport(null);
  };

  const handleDismiss = () => {
    if (!pendingImport) return;

    // For duplicates, clear clipboard on dismiss (Build 46 pattern)
    if (pendingImport.type === 'drill' && pendingImport.isDuplicate) {
      Clipboard.setStringAsync('');
    }

    setPendingImport(null);
  };

  return (
    <>
      <Stack.Screen
        options={{
          headerRight: ({ tintColor }) => (
            <TouchableOpacity
              onPress={() => checkClipboard(true)}
              style={{ paddingRight: 16 }}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={{ fontSize: 22 }}>{'📥'}</Text>
            </TouchableOpacity>
          ),
        }}
      />
      <View style={styles.container}>
        {/* BUILD 51: Import Card - ALWAYS visible, even during loading */}
        {/* BUILD 49: Universal Import Card - supports both Drills and Practices */}
        {pendingImport && (
        <View style={[
          styles.importCard,
          pendingImport.type === 'practice' && styles.importCardPractice
        ]}>
          <View style={styles.importHeader}>
            <View style={[
              styles.sharedBadge,
              pendingImport.type === 'practice' && styles.sharedBadgePractice
            ]}>
              <Text style={[
                styles.sharedBadgeText,
                pendingImport.type === 'practice' && styles.sharedBadgeTextPractice
              ]}>
                {pendingImport.type === 'drill' ? 'SHARED' : 'SHARED PLAN'}
              </Text>
            </View>
            <TouchableOpacity onPress={handleDismiss} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={styles.importClose}>{'\u00D7'}</Text>
            </TouchableOpacity>
          </View>

          {/* DRILL DISPLAY */}
          {pendingImport.type === 'drill' && (
            <>
              <Text style={styles.importTitle}>
                {pendingImport.isDuplicate ? 'Duplicate Drill Detected' : 'New Drill Available'}
              </Text>

              <View style={styles.importDrillInfo}>
                <Text style={styles.importDrillName}>{pendingImport.name}</Text>
                <Text style={styles.importDrillDesc} numberOfLines={2}>
                  {pendingImport.description}
                </Text>
                {pendingImport.equipment && pendingImport.equipment.length > 0 && (
                  <Text style={styles.importEquipment}>
                    Equipment: {pendingImport.equipment.join(', ')}
                  </Text>
                )}
              </View>

              {pendingImport.isDuplicate && (
                <Text style={styles.importWarning}>
                  You already have this drill in your library. Import anyway?
                </Text>
              )}
            </>
          )}

          {/* PRACTICE DISPLAY */}
          {pendingImport.type === 'practice' && (
            <>
              <Text style={styles.importTitle}>Shared Practice Plan</Text>

              <View style={styles.importDrillInfo}>
                <Text style={styles.importDrillName}>
                  {pendingImport.ageGroup} Practice
                </Text>
                <Text style={styles.importDrillDesc}>
                  {pendingImport.totalMinutes} minutes • {pendingImport.stationCount} stations
                </Text>
              </View>

              <Text style={styles.importWarning}>
                This practice will be saved to your History and loaded for review.
              </Text>
            </>
          )}

          <View style={styles.importActions}>
            <TouchableOpacity
              style={[styles.importButton, styles.importButtonSecondary]}
              onPress={handleDismiss}
              activeOpacity={0.7}
            >
              <Text style={styles.importButtonTextSecondary}>Dismiss</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.importButton, styles.importButtonPrimary]}
              onPress={handleImport}
              activeOpacity={0.7}
            >
              <Text style={styles.importButtonTextPrimary}>
                {pendingImport.type === 'drill'
                  ? (pendingImport.isDuplicate ? 'Import Anyway' : 'Import')
                  : 'Import Practice'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* BUILD 51: Conditional rendering - show loading or normal content */}
      {isLoading ? (
        <Text style={styles.loading}>Loading...</Text>
      ) : (
        <>
          {/* Tier badge */}
          <View style={styles.tierRow}>
            <View style={[styles.tierBadge, tier === 'pro' && styles.tierBadgePro]}>
              <Text style={styles.tierText}>{tier === 'pro' ? 'Pro' : 'Free'}</Text>
            </View>
          </View>

          {/* Hero */}
          <View style={styles.hero}>
            <View style={styles.logoContainer}>
              <Text style={styles.diamondIcon}>{'◆'}</Text>
            </View>
            <Text style={styles.heroTitle}>DiamondScript</Text>
            <Text style={styles.heroSub}>Practice generation for every diamond.</Text>
          </View>

          {/* Primary CTA */}
          <TouchableOpacity
            style={styles.ctaButton}
            onPress={() => router.push('/setup')}
            activeOpacity={0.85}
          >
            <Text style={styles.ctaText}>Generate Practice</Text>
          </TouchableOpacity>

          {/* My Drills shortcut */}
      <TouchableOpacity
        style={styles.myDrillsCard}
        onPress={() => router.push('/starred')}
        activeOpacity={0.8}
      >
        <Text style={styles.myDrillsIcon}>{'\u2605'}</Text>
        <View style={styles.myDrillsInfo}>
          <Text style={styles.myDrillsLabel}>My Drills</Text>
          <Text style={styles.myDrillsSub}>
            {starredDrills.size + customDrills.length === 0
              ? 'Star drills during practice to save them'
              : `${starredDrills.size + customDrills.length} drill${starredDrills.size + customDrills.length !== 1 ? 's' : ''} saved`}
          </Text>
        </View>
        <Text style={styles.myDrillsChevron}>{'\u203A'}</Text>
      </TouchableOpacity>

      {/* Practice History shortcut */}
      {history.length > 0 && (
        <TouchableOpacity
          style={styles.myDrillsCard}
          onPress={() => router.push('/history')}
          activeOpacity={0.8}
        >
          <Text style={[styles.myDrillsIcon, { color: '#1B4332' }]}>{'\u2713'}</Text>
          <View style={styles.myDrillsInfo}>
            <Text style={styles.myDrillsLabel}>Practice History</Text>
            <Text style={styles.myDrillsSub}>
              {history.length} practice{history.length !== 1 ? 's' : ''} saved
            </Text>
          </View>
          <Text style={styles.myDrillsChevron}>{'\u203A'}</Text>
        </TouchableOpacity>
      )}

      {/* Last practice summary — visible only if a session was generated this app lifecycle */}
      {currentSession && (
        <TouchableOpacity
          style={styles.lastCard}
          onPress={() => router.push('/practice')}
          activeOpacity={0.8}
        >
          <Text style={styles.lastLabel}>Last Practice</Text>
          <View style={styles.lastMeta}>
            <Text style={styles.lastMeta1}>
              {currentSession.request.ageGroup.replace('AGE_', '').replace('_', '-').replace('T-BALL', 'T-Ball')}
            </Text>
            <Text style={styles.lastMetaDot}>&#8226;</Text>
            <Text style={styles.lastMeta1}>
              {currentSession.selectedDrills.length} drills
            </Text>
            <Text style={styles.lastMetaDot}>&#8226;</Text>
            <Text style={styles.lastMeta1}>
              {currentSession.stationLayout.totalWallClockMinutes} min
            </Text>
          </View>
        </TouchableOpacity>
      )}

          {/* Upgrade nudge for free users */}
          {tier === 'free' && (
            <TouchableOpacity
              style={styles.upgradeNudge}
              onPress={() => router.push('/upgrade')}
              activeOpacity={0.7}
            >
              <Text style={styles.upgradeNudgeText}>
                &#9733; Unlock full power with <Text style={styles.upgradeNudgeBold}>Pro — $7.99/mo</Text>
              </Text>
            </TouchableOpacity>
          )}
        </>
      )}
    </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
    padding: 24,
  },
  loading: {
    textAlign: 'center',
    marginTop: 80,
    color: '#6B7280',
    fontSize: 16,
  },
  tierRow: {
    alignItems: 'flex-end',
  },
  tierBadge: {
    backgroundColor: '#E5E7EB',
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
  },
  tierBadgePro: {
    backgroundColor: '#D4AF37',
    shadowColor: '#D4AF37',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  tierText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#374151',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  hero: {
    marginTop: 48,
    marginBottom: 48,
    alignItems: 'center',
  },
  logoContainer: {
    width: 64,
    height: 64,
    backgroundColor: '#1B4332',
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    shadowColor: '#1B4332',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 5,
    transform: [{ rotate: '45deg' }],
  },
  diamondIcon: {
    fontSize: 28,
    color: '#D4AF37',
    transform: [{ rotate: '-45deg' }],
    fontWeight: '700',
  },
  heroTitle: {
    fontSize: 36,
    fontWeight: '700',
    color: '#1B4332',
    letterSpacing: -1,
  },
  heroSub: {
    fontSize: 16,
    color: '#6B7280',
    marginTop: 8,
    letterSpacing: 0.3,
  },
  ctaButton: {
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
  ctaText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  myDrillsCard: {
    marginTop: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    shadowColor: '#1B4332',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  myDrillsIcon: {
    fontSize: 22,
    color: '#D4AF37',
    width: 32,
    height: 32,
    textAlign: 'center',
    lineHeight: 32,
  },
  myDrillsInfo: {
    flex: 1,
  },
  myDrillsLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
  },
  myDrillsSub: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },
  myDrillsChevron: {
    fontSize: 18,
    color: '#9CA3AF',
  },

  // BUILD 47 FIX: Manual clipboard check button
  refreshButton: {
    marginTop: 16,
    backgroundColor: '#EFF6FF',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#3B82F6',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  refreshIcon: {
    fontSize: 18,
    color: '#3B82F6',
    fontWeight: '700',
  },
  refreshText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1D4ED8',
  },

  lastCard: {
    marginTop: 24,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#1B4332',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  lastLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  lastMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  lastMeta1: {
    fontSize: 15,
    fontWeight: '500',
    color: '#111827',
  },
  lastMetaDot: {
    color: '#9CA3AF',
    fontSize: 10,
  },
  upgradeNudge: {
    marginTop: 32,
    backgroundColor: '#FEF3C7',
    borderRadius: 16,
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderLeftWidth: 4,
    borderLeftColor: '#D4AF37',
    shadowColor: '#D4AF37',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  upgradeNudgeText: {
    fontSize: 14,
    color: '#92400E',
    textAlign: 'center',
  },
  upgradeNudgeBold: {
    fontWeight: '700',
  },

  // BUILD 47 FIX: Magic Import Card styles (enhanced visibility)
  importCard: {
    marginVertical: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 18,
    borderWidth: 2,
    borderColor: '#3B82F6', // Blue border for SHARED drill
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25, // Increased from 0.15 for better depth
    shadowRadius: 6,
    elevation: 4,
  },
  importHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sharedBadge: {
    backgroundColor: '#DBEAFE',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#3B82F6',
  },
  sharedBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#1D4ED8',
    letterSpacing: 0.8,
  },
  importClose: {
    fontSize: 24,
    color: '#6B7280',
    fontWeight: '700',
  },
  importTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 10,
  },
  importDrillInfo: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
  },
  importDrillName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1B4332',
    marginBottom: 6,
  },
  importDrillDesc: {
    fontSize: 13,
    color: '#6B7280',
    lineHeight: 18,
    marginBottom: 6,
  },
  importEquipment: {
    fontSize: 12,
    color: '#374151',
    fontStyle: 'italic',
  },
  importWarning: {
    fontSize: 12,
    color: '#DC2626',
    fontWeight: '500',
    marginBottom: 14,
    textAlign: 'center',
  },
  importActions: {
    flexDirection: 'row',
    gap: 10,
  },
  importButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  importButtonPrimary: {
    backgroundColor: '#3B82F6',
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  importButtonSecondary: {
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  importButtonTextPrimary: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  importButtonTextSecondary: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },

  // BUILD 49: Practice Import Card styles (gold/green accent)
  importCardPractice: {
    borderColor: '#D4AF37', // Gold border for SHARED PLAN
    shadowColor: '#D4AF37',
  },
  sharedBadgePractice: {
    backgroundColor: '#FEF3C7', // Gold background
    borderColor: '#D4AF37',
  },
  sharedBadgeTextPractice: {
    color: '#92400E', // Dark gold text
  },
});
