import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, Linking, Platform, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { getOfferings } from '../src/subscription/service';
import { usePractice } from '../context/PracticeContext';

const FONT_ROUNDED = Platform.select({ ios: 'System', default: 'sans-serif-medium' });

const PRO_FEATURES = [
  'Custom Intensity',
  'Station Splitting',
  'Full Drill Catalog',
  'Unlimited History',
];

export default function UpgradeScreen() {
  const router = useRouter();
  const { upgradeToPro, restorePurchases: handleRestore } = usePractice();

  const [isBuying, setIsBuying] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [price, setPrice] = useState<string>('$9.99');

  useEffect(() => {
    getOfferings()
      .then((offering) => {
        const pkg = offering?.monthly ||
          offering?.availablePackages.find((p) => p.packageType === 'MONTHLY');
        if (pkg) {
          setPrice(pkg.product.priceString);
        }
      })
      .catch(() => {});
  }, []);

  const handleSubscribe = async () => {
    setIsBuying(true);
    const result = await upgradeToPro();

    if (result.success) {
      Alert.alert(
        'Welcome to Pro!',
        'You now have access to all Pro features.',
        [{ text: 'Get Started', onPress: () => router.back() }],
      );
    } else if (!result.userCancelled) {
      Alert.alert('Purchase Failed', result.message, [{ text: 'OK' }]);
    }
    setIsBuying(false);
  };

  const handleRestorePurchases = async () => {
    setIsRestoring(true);
    const result = await handleRestore();

    if (result.success) {
      Alert.alert(
        'Purchases Restored!',
        'Your Pro subscription has been restored.',
        [{ text: 'OK', onPress: () => router.back() }],
      );
    } else if (result.reason === 'none_found') {
      Alert.alert('No Purchases Found', result.message, [{ text: 'OK' }]);
    } else {
      Alert.alert('Restore Failed', result.message, [{ text: 'OK' }]);
    }
    setIsRestoring(false);
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>DiamondScript Pro</Text>
        <Text style={styles.price}>{price}<Text style={styles.period}>/mo</Text></Text>
      </View>

      {/* Feature checklist */}
      <View style={styles.features}>
        {PRO_FEATURES.map((feature) => (
          <View key={feature} style={styles.featureRow}>
            <Text style={styles.check}>✓</Text>
            <Text style={styles.featureText}>{feature}</Text>
          </View>
        ))}
      </View>

      {/* CTA */}
      <TouchableOpacity
        style={[styles.ctaButton, (isBuying || isRestoring) && styles.ctaDisabled]}
        onPress={handleSubscribe}
        disabled={isBuying || isRestoring}
        activeOpacity={0.85}
      >
        {isBuying ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text style={styles.ctaText}>Subscribe</Text>
        )}
      </TouchableOpacity>

      {/* Footer: disclosure + restore + legal */}
      <View style={styles.footer}>
        <Text style={styles.disclosure}>
          {price}/month. Auto-renews until cancelled.{'\n'}
          Payment charged to your {Platform.OS === 'ios' ? 'Apple ID' : 'Google Play'} account.
        </Text>

        <TouchableOpacity
          onPress={handleRestorePurchases}
          disabled={isBuying || isRestoring}
          activeOpacity={0.7}
        >
          <Text style={[styles.restoreText, (isBuying || isRestoring) && { opacity: 0.5 }]}>
            {isRestoring ? 'Restoring...' : 'Restore Purchases'}
          </Text>
        </TouchableOpacity>

        <View style={styles.legalRow}>
          <TouchableOpacity onPress={() => Linking.openURL('https://diamondscript.app/privacy')}>
            <Text style={styles.legalText}>Privacy Policy</Text>
          </TouchableOpacity>
          <Text style={styles.legalSep}>|</Text>
          <TouchableOpacity onPress={() => Linking.openURL('https://diamondscript.app/terms')}>
            <Text style={styles.legalText}>Terms of Use</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 32,
    justifyContent: 'center',
  },

  // Header
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    fontFamily: FONT_ROUNDED,
    color: '#1B4332',
    marginBottom: 8,
  },
  price: {
    fontSize: 40,
    fontWeight: '700',
    fontFamily: FONT_ROUNDED,
    color: '#1B4332',
  },
  period: {
    fontSize: 18,
    fontWeight: '500',
    color: '#9CA3AF',
  },

  // Features
  features: {
    gap: 16,
    marginBottom: 40,
    paddingLeft: 8,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  check: {
    fontSize: 16,
    fontWeight: '700',
    color: '#059669',
  },
  featureText: {
    fontSize: 17,
    fontWeight: '500',
    fontFamily: FONT_ROUNDED,
    color: '#111827',
  },

  // CTA
  ctaButton: {
    backgroundColor: '#1B3D2F',
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
    shadowColor: '#1B3D2F',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  ctaDisabled: {
    opacity: 0.6,
  },
  ctaText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
    fontFamily: FONT_ROUNDED,
  },

  // Footer
  footer: {
    alignItems: 'center',
    marginTop: 24,
    gap: 12,
  },
  disclosure: {
    fontSize: 12,
    color: '#9CA3AF',
    textAlign: 'center',
    lineHeight: 18,
  },
  restoreText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1B3D2F',
  },
  legalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  legalSep: {
    fontSize: 12,
    color: '#D1D5DB',
  },
  legalText: {
    fontSize: 12,
    color: '#9CA3AF',
    textDecorationLine: 'underline',
  },
});
