import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, Linking } from 'react-native';
import { useRouter } from 'expo-router';
// BUILD 86: CRITICAL FIX - Use real RevenueCat SDK (was importing stub!)
import { getOfferings } from '../src/subscription/service';
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

  // BUILD 60: QA Defect 2 Fix - Separate button locks
  const [isBuying, setIsBuying] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);

  // BUILD 60: QA Defect 2 Fix - Dynamic pricing from RevenueCat
  const [price, setPrice] = useState<string>('$9.99');

  // BUILD 86: Fetch dynamic price from RevenueCat offerings
  useEffect(() => {
    getOfferings()
      .then((offering) => {
        // Find the monthly subscription package
        const pkg = offering?.monthly ||
          offering?.availablePackages.find((p) => p.packageType === 'MONTHLY');
        if (pkg) {
          setPrice(pkg.product.priceString);
        }
      })
      .catch(() => {
        // Keep default price if fetch fails
      });
  }, []);

  const handleSubscribe = async () => {
    setIsBuying(true);
    try {
      const success = await upgradeToPro();
      if (success) {
        Alert.alert(
          'Welcome to Pro!',
          'You now have access to all Pro features. Enjoy!',
          [{ text: 'Get Started', onPress: () => router.back() }],
        );
      }
      // If success is false, user cancelled - no alert needed
    } catch (error) {
      // BUILD 60: QA Defect 1 Fix - Show actual error
      Alert.alert(
        'Purchase Failed',
        error instanceof Error ? error.message : 'Something went wrong. Please try again later.',
        [{ text: 'OK' }],
      );
    } finally {
      setIsBuying(false);
    }
  };

  const handleRestorePurchases = async () => {
    setIsRestoring(true);
    try {
      const success = await handleRestore();
      if (success) {
        Alert.alert(
          'Purchases Restored!',
          'Your Pro purchase has been restored.',
          [{ text: 'OK', onPress: () => router.back() }],
        );
      } else {
        Alert.alert(
          'No Purchases Found',
          'We couldn\'t find any previous purchases to restore.',
          [{ text: 'OK' }],
        );
      }
    } catch (error) {
      // BUILD 60: QA Fix - Handle restore errors
      Alert.alert(
        'Restore Failed',
        error instanceof Error ? error.message : 'Unable to restore purchases. Please try again.',
        [{ text: 'OK' }],
      );
    } finally {
      setIsRestoring(false);
    }
  };

  const handlePrivacyPolicy = () => {
    // TODO: Replace with actual hosted privacy policy URL
    const privacyUrl = 'https://diamondscript.app/privacy'; // Placeholder
    Linking.openURL(privacyUrl).catch(() => {
      Alert.alert(
        'Privacy Policy',
        'See PRIVACY_POLICY.md in the app repository for our complete privacy policy.',
        [{ text: 'OK' }],
      );
    });
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerBadge}>PRO</Text>
        <Text style={styles.headerTitle}>Unlock DiamondScript Pro</Text>
        <Text style={styles.headerPrice}>{price}<Text style={styles.headerPeriod}>/month</Text></Text>
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
        style={[styles.ctaButton, (isBuying || isRestoring) && styles.ctaButtonDisabled]}
        onPress={handleSubscribe}
        disabled={isBuying || isRestoring}
        activeOpacity={0.85}
      >
        <Text style={styles.ctaText}>
          {isBuying ? 'Processing...' : `Subscribe — ${price}/mo`}
        </Text>
      </TouchableOpacity>

      <Text style={styles.disclaimer}>
        Cancel anytime. Managed via Google Play.
      </Text>

      {/* Restore purchases button */}
      <TouchableOpacity
        style={styles.restoreButton}
        onPress={handleRestorePurchases}
        disabled={isBuying || isRestoring}
        activeOpacity={0.7}
      >
        <Text style={[styles.restoreText, (isBuying || isRestoring) && { opacity: 0.5 }]}>
          {isRestoring ? 'Restoring...' : 'Restore Purchases'}
        </Text>
      </TouchableOpacity>

      {/* Privacy Policy link */}
      <TouchableOpacity
        style={styles.privacyButton}
        onPress={handlePrivacyPolicy}
        activeOpacity={0.7}
      >
        <Text style={styles.privacyText}>Privacy Policy</Text>
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
  privacyButton: {
    marginTop: 8,
    paddingVertical: 8,
    alignItems: 'center',
  },
  privacyText: {
    color: '#9CA3AF',
    fontSize: 12,
    fontWeight: '500',
    textDecorationLine: 'underline',
  },
});
