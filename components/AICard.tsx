import React from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';

interface AICardProps {
  isAuthReady: boolean;
  isGenerating: boolean;
  cooldownSeconds: number;
  isOnline: boolean;
  onGenerate: () => void;
  // BUILD 55 TROUBLESHOOTING: Temporarily commented out
  // children?: React.ReactNode;
}

export default function AICard({ isAuthReady, isGenerating, cooldownSeconds, isOnline, onGenerate }: AICardProps) {
  // Determine button state and text
  const getButtonState = () => {
    if (!isOnline) {
      return {
        disabled: true,
        text: 'Internet Required',
        showSpinner: false,
      };
    }
    if (!isAuthReady) {
      return {
        disabled: true,
        text: 'Initializing AI Engine...',
        showSpinner: true,
      };
    }
    if (isGenerating) {
      return {
        disabled: true,
        text: 'Crafting Your Plan...',
        showSpinner: false, // We'll show skeleton shimmer instead
      };
    }
    if (cooldownSeconds > 0) {
      return {
        disabled: true,
        text: `Ready in ${cooldownSeconds}s...`,
        showSpinner: false,
      };
    }
    return {
      disabled: false,
      text: 'Generate AI Plan ✨',
      showSpinner: false,
    };
  };

  const buttonState = getButtonState();

  return (
    <View style={styles.aiCard}>
      {/* Card Header */}
      <View style={styles.cardHeader}>
        <Text style={styles.sparkleIcon}>✨</Text>
        <Text style={styles.cardTitle}>AI Practice Generator</Text>
        <View style={styles.betaBadge}>
          <Text style={styles.betaText}>BETA</Text>
        </View>
      </View>

      {/* Loading Skeleton Shimmer (shown while generating) */}
      {isGenerating && (
        <View style={styles.skeletonContainer}>
          <View style={styles.skeletonSection}>
            <View style={styles.skeletonBar} />
            <View style={[styles.skeletonBar, styles.skeletonBarShort]} />
          </View>
          <View style={styles.skeletonSection}>
            <View style={styles.skeletonBar} />
            <View style={[styles.skeletonBar, styles.skeletonBarMedium]} />
          </View>
          <View style={styles.skeletonSection}>
            <View style={styles.skeletonBar} />
            <View style={[styles.skeletonBar, styles.skeletonBarShort]} />
          </View>
        </View>
      )}

      {/* BUILD 55 TROUBLESHOOTING: Children rendering temporarily removed */}
      {/* {!isGenerating && children} */}

      {/* Generate Button */}
      <TouchableOpacity
        style={[
          styles.generateButton,
          buttonState.disabled && styles.generateButtonDisabled,
        ]}
        onPress={onGenerate}
        disabled={buttonState.disabled}
        activeOpacity={0.8}
      >
        {buttonState.showSpinner ? (
          <ActivityIndicator color="#FFFFFF" size="small" />
        ) : (
          <Text style={styles.generateButtonText}>{buttonState.text}</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  aiCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#D4AF37', // Gold border
    padding: 24,
    marginTop: 32,
    marginBottom: 16,
    shadowColor: '#D4AF37',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  sparkleIcon: {
    fontSize: 24,
    marginRight: 8,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#3B82F6', // DiamondScript Blue
    flex: 1,
  },
  betaBadge: {
    backgroundColor: '#3B82F6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  betaText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 1,
  },
  skeletonContainer: {
    marginBottom: 20,
  },
  skeletonSection: {
    marginBottom: 16,
  },
  skeletonBar: {
    height: 16,
    backgroundColor: '#E5E7EB',
    borderRadius: 8,
    marginBottom: 8,
    width: '100%',
  },
  skeletonBarShort: {
    width: '60%',
  },
  skeletonBarMedium: {
    width: '80%',
  },
  generateButton: {
    backgroundColor: '#3B82F6',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 56,
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  generateButtonDisabled: {
    backgroundColor: '#9CA3AF',
    opacity: 0.7,
  },
  generateButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});
