/**
 * BUILD 87: PaywallModal
 *
 * Professional paywall for DiamondScript Pro subscription.
 * Clean, high end design with clear value proposition.
 *
 * Features:
 * - Anonymous purchase flow (no account required)
 * - Clear pricing: $9.99/month
 * - Restore purchases support
 * - Privacy first messaging
 *
 * BUILD 87: Reviewer Bypass
 * - Hidden 5-tap trigger on PRO badge
 * - Secret code input for App Store/Play Store reviewers
 * - Ephemeral session-only Pro access (not persisted)
 *
 * BUILD 86: Tiger Team Fixes
 * - Shows specific error messages from RevenueCat (displayMessage)
 * - Better error handling for Google Play billing errors
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  TextInput,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { initiateUpgrade, restorePurchases } from '../src/subscription/service';

// BUILD 87: Reviewer bypass code (change annually)
const REVIEWER_CODE = 'REVIEW_BYPASS_2026';

interface PaywallModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
  /** BUILD 87: Direct tier override for app store reviewers */
  onReviewerBypass?: () => void;
  /** Optional context for why the paywall was triggered */
  trigger?: 'ai_generator' | 'history_limit' | 'feature';
}

export default function PaywallModal({
  visible,
  onClose,
  onSuccess,
  onReviewerBypass,
  trigger,
}: PaywallModalProps) {
  const insets = useSafeAreaInsets();
  const [isLoading, setIsLoading] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);

  // BUILD 87: Reviewer bypass state
  const [tapCount, setTapCount] = useState(0);
  const [showBypassInput, setShowBypassInput] = useState(false);
  const [bypassCode, setBypassCode] = useState('');

  // BUILD 87: Reset bypass state when modal closes
  useEffect(() => {
    if (!visible) {
      setTapCount(0);
      setShowBypassInput(false);
      setBypassCode('');
    }
  }, [visible]);

  // BUILD 87: Handle taps on PRO badge (secret trigger)
  const handleBadgeTap = () => {
    const newCount = tapCount + 1;
    setTapCount(newCount);
    if (newCount >= 5) {
      setShowBypassInput(true);
    }
  };

  // BUILD 87: Handle reviewer bypass code submission
  const handleBypassSubmit = () => {
    if (bypassCode === REVIEWER_CODE) {
      // Trigger the bypass callback if provided
      if (onReviewerBypass) {
        onReviewerBypass();
      } else {
        // Fallback: just call onSuccess (parent should handle tier)
        onSuccess();
      }
      onClose();
    } else {
      Alert.alert('Invalid Code', 'The reviewer code is incorrect.');
      setBypassCode('');
    }
  };

  const handleUpgrade = async () => {
    setIsLoading(true);
    try {
      const success = await initiateUpgrade();
      if (success) {
        onSuccess();
        onClose();
      }
    } catch (error: any) {
      // BUILD 86: Show specific error message from RevenueCat
      const errorMessage = error?.displayMessage ||
        error?.underlyingErrorMessage ||
        error?.message ||
        'Something went wrong. Please try again or contact support.';

      Alert.alert(
        'Purchase Failed',
        errorMessage,
        [{ text: 'OK' }]
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleRestore = async () => {
    setIsRestoring(true);
    try {
      const success = await restorePurchases();
      if (success) {
        Alert.alert(
          'Purchases Restored',
          'Your Pro subscription has been restored.',
          [{ text: 'OK', onPress: () => { onSuccess(); onClose(); } }]
        );
      } else {
        Alert.alert(
          'No Purchases Found',
          'We could not find any previous purchases associated with this device.',
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      Alert.alert(
        'Restore Failed',
        'Something went wrong. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsRestoring(false);
    }
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
    >
      <View style={[styles.container, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 20 }]}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeButtonText}>×</Text>
          </TouchableOpacity>
        </View>

        {/* Content */}
        <View style={styles.content}>
          {/* Pro Badge - BUILD 87: Secret tap trigger */}
          <TouchableOpacity onPress={handleBadgeTap} activeOpacity={1}>
            <View style={styles.proBadge}>
              <Text style={styles.proBadgeText}>PRO</Text>
            </View>
          </TouchableOpacity>

          {/* Headline */}
          <Text style={styles.headline}>DiamondScript Pro</Text>
          <Text style={styles.subheadline}>Your AI Assistant Coach</Text>

          {/* Contextual subtitle */}
          <Text style={styles.subtitle}>{getSubtitle()}</Text>

          {/* BUILD 87: Hidden reviewer bypass input */}
          {showBypassInput && (
            <View style={styles.bypassContainer}>
              <TextInput
                style={styles.bypassInput}
                value={bypassCode}
                onChangeText={setBypassCode}
                placeholder="Reviewer code"
                placeholderTextColor="#9CA3AF"
                autoCapitalize="characters"
                autoCorrect={false}
                secureTextEntry
              />
              <TouchableOpacity
                style={styles.bypassButton}
                onPress={handleBypassSubmit}
              >
                <Text style={styles.bypassButtonText}>Submit</Text>
              </TouchableOpacity>
            </View>
          )}

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

          {/* Privacy Footer */}
          <Text style={styles.privacyFooter}>
            Managed anonymously via Google Play.{'\n'}
            No account or password required.
          </Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 20,
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
    flex: 1,
    paddingHorizontal: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  proBadge: {
    backgroundColor: '#D4AF37',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 16,
  },
  proBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 2,
  },
  headline: {
    fontSize: 28,
    fontWeight: '800',
    color: '#1B4332',
    textAlign: 'center',
    marginBottom: 4,
  },
  subheadline: {
    fontSize: 18,
    fontWeight: '500',
    color: '#059669',
    textAlign: 'center',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 15,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 28,
    lineHeight: 22,
  },
  // BUILD 87: Reviewer bypass styles
  bypassContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    gap: 8,
  },
  bypassInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#111827',
    backgroundColor: '#F9FAFB',
  },
  bypassButton: {
    backgroundColor: '#6B7280',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  bypassButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  benefitsContainer: {
    width: '100%',
    gap: 20,
    marginBottom: 28,
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
    marginTop: 8,
  },
  price: {
    fontSize: 42,
    fontWeight: '800',
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
    gap: 12,
  },
  upgradeButton: {
    backgroundColor: '#1B4332',
    paddingVertical: 18,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#1B4332',
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
    fontWeight: '700',
  },
  restoreButton: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  restoreButtonText: {
    color: '#1B4332',
    fontSize: 15,
    fontWeight: '600',
  },
  privacyFooter: {
    fontSize: 12,
    color: '#9CA3AF',
    textAlign: 'center',
    lineHeight: 18,
    marginTop: 8,
  },
});
