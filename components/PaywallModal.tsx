/**
 * BUILD 90: PaywallModal
 *
 * Professional paywall for DiamondScript Pro subscription.
 * Clean, high end design with clear value proposition.
 *
 * Features:
 * - Anonymous purchase flow (no account required)
 * - Clear pricing: $9.99/month
 * - Restore purchases support
 * - Privacy first messaging
 * - Apple Guideline 3.1.2 compliant (disclosure + legal links)
 *
 * BUILD 86: Tiger Team Fixes
 * - Shows specific error messages from RevenueCat (displayMessage)
 * - Better error handling for Google Play billing errors
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Platform,
  Linking,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { initiateUpgrade, restorePurchases } from '../src/subscription/service';

const PRIVACY_URL = 'https://diamondscript.app/privacy';
const TERMS_URL = 'https://diamondscript.app/terms';

interface PaywallModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
  /** Optional context for why the paywall was triggered */
  trigger?: 'ai_generator' | 'history_limit' | 'feature';
}

export default function PaywallModal({
  visible,
  onClose,
  onSuccess,
  trigger,
}: PaywallModalProps) {
  const insets = useSafeAreaInsets();
  const [isLoading, setIsLoading] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);

  // BUILD 90: Pattern-match on typed UpgradeResult — no try/catch needed
  const handleUpgrade = async () => {
    setIsLoading(true);
    const result = await initiateUpgrade();

    if (result.success) {
      onSuccess();
      onClose();
    } else if (!result.userCancelled) {
      // Show specific error message from RevenueCat
      Alert.alert('Purchase Failed', result.message, [{ text: 'OK' }]);
    }
    // userCancelled: silent — no alert needed
    setIsLoading(false);
  };

  // BUILD 90: Pattern-match on typed RestoreResult for clear UI feedback
  const handleRestore = async () => {
    setIsRestoring(true);
    const result = await restorePurchases();

    if (result.success) {
      Alert.alert(
        'Purchases Restored',
        'Your Pro subscription has been restored.',
        [{ text: 'OK', onPress: () => { onSuccess(); onClose(); } }]
      );
    } else if (result.reason === 'none_found') {
      Alert.alert('No Purchases Found', result.message, [{ text: 'OK' }]);
    } else {
      Alert.alert('Restore Failed', result.message, [{ text: 'OK' }]);
    }
    setIsRestoring(false);
  };

  // Context-specific subtitle
  const getSubtitle = () => {
    switch (trigger) {
      case 'ai_generator':
        return 'Unlock AI powered practice plans tailored to your team.';
      case 'history_limit':
        return 'Keep your entire season history with unlimited practice storage.';
      default:
        return 'Take your coaching to the next level with Pro features.';
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
      onDismiss={onClose}
    >
      <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom + 16 }]}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeButtonText}>×</Text>
          </TouchableOpacity>
        </View>

        {/* Scrollable content area */}
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          {/* Content */}
          <View style={styles.content}>
            {/* Pro Badge */}
            <View style={styles.proBadge}>
              <Text style={styles.proBadgeText}>PRO</Text>
            </View>

            {/* Headline */}
            <Text style={styles.headline}>DiamondScript Pro</Text>
            <Text style={styles.subheadline}>Your AI Assistant Coach</Text>

            {/* Contextual subtitle */}
            <Text style={styles.subtitle}>{getSubtitle()}</Text>

            {/* Benefits */}
            <View style={styles.benefitsContainer}>
              <View style={styles.benefitRow}>
                <Text style={styles.benefitIcon}>⚡</Text>
                <View style={styles.benefitTextContainer}>
                  <Text style={styles.benefitTitle}>Pro Series Tactical Scripts</Text>
                  <Text style={styles.benefitDescription}>
                    Get intelligent practice plans customized for your age group and focus areas.
                  </Text>
                </View>
              </View>

              <View style={styles.benefitRow}>
                <Text style={styles.benefitIcon}>📋</Text>
                <View style={styles.benefitTextContainer}>
                  <Text style={styles.benefitTitle}>Unlimited Season History</Text>
                  <Text style={styles.benefitDescription}>
                    Save and review every practice from your entire season.
                  </Text>
                </View>
              </View>

              <View style={styles.benefitRow}>
                <Text style={styles.benefitIcon}>🎯</Text>
                <View style={styles.benefitTextContainer}>
                  <Text style={styles.benefitTitle}>Advanced Mechanical Cues</Text>
                  <Text style={styles.benefitDescription}>
                    Detailed coaching points and technique breakdowns for every drill.
                  </Text>
                </View>
              </View>
            </View>

            {/* Price */}
            <View style={styles.priceContainer}>
              <Text style={styles.price}>$9.99</Text>
              <Text style={styles.priceUnit}>/month</Text>
            </View>
          </View>

          {/* Actions */}
          <View style={styles.actions}>
            {/* Upgrade Button */}
            <TouchableOpacity
              style={[styles.upgradeButton, isLoading && styles.buttonDisabled]}
              onPress={handleUpgrade}
              disabled={isLoading || isRestoring}
              activeOpacity={0.85}
            >
              {isLoading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.upgradeButtonText}>Upgrade Now</Text>
              )}
            </TouchableOpacity>

            {/* Restore Button */}
            <TouchableOpacity
              style={styles.restoreButton}
              onPress={handleRestore}
              disabled={isLoading || isRestoring}
            >
              {isRestoring ? (
                <ActivityIndicator color="#1B4332" size="small" />
              ) : (
                <Text style={styles.restoreButtonText}>Restore Purchases</Text>
              )}
            </TouchableOpacity>

            {/* Apple-required subscription disclosure (Guideline 3.1.2) */}
            <Text style={styles.privacyFooter}>
              $9.99/month. Subscription auto-renews monthly until cancelled.{'\n'}
              Payment charged to your {Platform.OS === 'ios' ? 'Apple ID' : 'Google Play'} account. No sign-up required.
            </Text>
            <View style={styles.legalLinks}>
              <TouchableOpacity onPress={() => Linking.openURL(PRIVACY_URL)}>
                <Text style={styles.legalLinkText}>Privacy Policy</Text>
              </TouchableOpacity>
              <Text style={styles.legalSeparator}>|</Text>
              <TouchableOpacity onPress={() => Linking.openURL(TERMS_URL)}>
                <Text style={styles.legalLinkText}>Terms of Use</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButtonText: {
    fontSize: 24,
    color: '#6B7280',
    lineHeight: 26,
  },
  content: {
    paddingHorizontal: 28,
    alignItems: 'center',
    paddingBottom: 8,
  },
  proBadge: {
    backgroundColor: '#D4AF37',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 20,
  },
  proBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 2,
  },
  headline: {
    fontSize: 28,
    fontWeight: '700',
    fontFamily: Platform.select({ ios: 'ui-rounded', default: undefined }),
    color: '#1B4332',
    textAlign: 'center',
    marginBottom: 4,
  },
  subheadline: {
    fontSize: 18,
    fontWeight: '500',
    fontFamily: Platform.select({ ios: 'ui-rounded', default: undefined }),
    color: '#059669',
    textAlign: 'center',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 15,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 22,
  },
  benefitsContainer: {
    width: '100%',
    gap: 24,
    marginBottom: 32,
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
  },
  benefitIcon: {
    fontSize: 24,
    width: 32,
    textAlign: 'center',
  },
  benefitTextContainer: {
    flex: 1,
  },
  benefitTitle: {
    fontSize: 16,
    fontWeight: '600',
    fontFamily: Platform.select({ ios: 'ui-rounded', default: undefined }),
    color: '#111827',
    marginBottom: 3,
  },
  benefitDescription: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: 4,
    marginBottom: 8,
  },
  price: {
    fontSize: 42,
    fontWeight: '700',
    fontFamily: Platform.select({ ios: 'ui-rounded', default: undefined }),
    color: '#1B4332',
  },
  priceUnit: {
    fontSize: 18,
    fontWeight: '500',
    color: '#6B7280',
    marginLeft: 4,
  },
  actions: {
    paddingHorizontal: 28,
    paddingTop: 24,
    gap: 4,
  },
  upgradeButton: {
    backgroundColor: '#1B3D2F',
    paddingVertical: 18,
    paddingHorizontal: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'stretch',
    shadowColor: '#1B3D2F',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  upgradeButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
    fontFamily: Platform.select({ ios: 'ui-rounded', default: undefined }),
  },
  restoreButton: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  restoreButtonText: {
    color: '#1B3D2F',
    fontSize: 15,
    fontWeight: '600',
    fontFamily: Platform.select({ ios: 'ui-rounded', default: undefined }),
  },
  privacyFooter: {
    fontSize: 12,
    color: '#9CA3AF',
    textAlign: 'center',
    lineHeight: 18,
    marginTop: 16,
  },
  legalLinks: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 12,
    paddingBottom: 8,
    gap: 8,
  },
  legalLinkText: {
    fontSize: 12,
    color: '#6B7280',
    textDecorationLine: 'underline',
  },
  legalSeparator: {
    fontSize: 12,
    color: '#D1D5DB',
  },
});
