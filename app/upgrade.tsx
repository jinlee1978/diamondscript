import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { usePractice } from '../context/PracticeContext';

const PRO_FEATURES = [
  { icon: '\u2195', title: 'Custom Intensity', desc: 'Set intensity 1–5 to match your team\'s energy.' },
  { icon: '\u25B6', title: 'Station Splitting', desc: 'Run parallel stations with assistant coaches.' },
  { icon: '\u2605', title: 'Full Drill Catalog', desc: 'Access every drill, not just the top 30.' },
  { icon: '\u21CB', title: 'Unlimited History', desc: 'Save and revisit every practice you\'ve run.' },
];

export default function UpgradeScreen() {
  const router = useRouter();
  const { upgradeToPro, restorePurchases: handleRestore } = usePractice();
  const [isProcessing, setIsProcessing] = useState(false);

  const handleSubscribe = async () => {
    setIsProcessing(true);
    try {
      const success = await upgradeToPro();
      if (success) {
        Alert.alert(
          'Welcome to Pro!',
          'You now have access to all Pro features. Enjoy!',
          [{ text: 'Get Started', onPress: () => router.back() }],
        );
      } else {
        Alert.alert(
          'Payment Integration Required',
          'In-app purchase integration is in development. This would normally trigger the payment flow.',
          [{ text: 'OK' }],
        );
      }
    } catch (error) {
      Alert.alert(
        'Error',
        'Something went wrong. Please try again later.',
        [{ text: 'OK' }],
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRestorePurchases = async () => {
    setIsProcessing(true);
    try {
      const success = await handleRestore();
      if (success) {
        Alert.alert(
          'Purchases Restored!',
          'Your Pro subscription has been restored.',
          [{ text: 'OK', onPress: () => router.back() }],
        );
      } else {
        Alert.alert(
          'No Purchases Found',
          'We couldn\'t find any previous purchases to restore.',
          [{ text: 'OK' }],
        );
      }
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerBadge}>PRO</Text>
        <Text style={styles.headerTitle}>Unlock DiamondScript Pro</Text>
        <Text style={styles.headerPrice}>$7.99 <Text style={styles.headerPeriod}>/ month</Text></Text>
      </View>

      {/* Feature list */}
      <View style={styles.features}>
        {PRO_FEATURES.map((f) => (
          <View key={f.title} style={styles.featureRow}>
            <Text style={styles.featureIcon}>{f.icon}</Text>
            <View style={styles.featureContent}>
              <Text style={styles.featureTitle}>{f.title}</Text>
              <Text style={styles.featureDesc}>{f.desc}</Text>
            </View>
          </View>
        ))}
      </View>

      {/* CTA */}
      <TouchableOpacity
        style={[styles.ctaButton, isProcessing && styles.ctaButtonDisabled]}
        onPress={handleSubscribe}
        disabled={isProcessing}
        activeOpacity={0.85}
      >
        <Text style={styles.ctaText}>
          {isProcessing ? 'Processing...' : 'Subscribe — $7.99/mo'}
        </Text>
      </TouchableOpacity>

      <Text style={styles.disclaimer}>
        Cancel anytime. No commitment.
      </Text>

      {/* Restore purchases button */}
      <TouchableOpacity
        style={styles.restoreButton}
        onPress={handleRestorePurchases}
        disabled={isProcessing}
        activeOpacity={0.7}
      >
        <Text style={styles.restoreText}>Restore Purchases</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
    padding: 28,
  },
  header: {
    alignItems: 'center',
    marginBottom: 36,
    marginTop: 16,
  },
  headerBadge: {
    backgroundColor: '#D4AF37',
    color: '#111827',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
    paddingHorizontal: 14,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 12,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
  },
  headerPrice: {
    fontSize: 36,
    fontWeight: '700',
    color: '#1B4332',
    marginTop: 8,
  },
  headerPeriod: {
    fontSize: 16,
    fontWeight: '400',
    color: '#6B7280',
  },

  // Feature list
  features: {
    gap: 20,
    marginBottom: 40,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
  },
  featureIcon: {
    fontSize: 22,
    color: '#1B4332',
    width: 28,
    textAlign: 'center',
  },
  featureContent: {},
  featureTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  featureDesc: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },

  // CTA
  ctaButton: {
    backgroundColor: '#D4AF37',
    borderRadius: 14,
    paddingVertical: 18,
    alignItems: 'center',
    shadowColor: '#D4AF37',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 4,
  },
  ctaButtonDisabled: {
    backgroundColor: '#D1D5DB',
    shadowOpacity: 0,
  },
  ctaText: {
    color: '#111827',
    fontSize: 18,
    fontWeight: '700',
  },
  disclaimer: {
    textAlign: 'center',
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 16,
  },
  restoreButton: {
    marginTop: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  restoreText: {
    color: '#1B4332',
    fontSize: 14,
    fontWeight: '600',
  },
});
