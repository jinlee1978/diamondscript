import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { usePractice } from '../context/PracticeContext';

export default function HomeScreen() {
  const router = useRouter();
  const { tier, currentSession, isLoading, starredDrills, customDrills, history } = usePractice();

  if (isLoading) {
    return (
      <View style={styles.container}>
        <Text style={styles.loading}>Loading...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
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
    </View>
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
});
