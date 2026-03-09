import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { usePractice, PaywallTrigger } from '../context/PracticeContext';

interface Props {
  feature: string;
  /** Which paywall trigger context to use. Defaults to 'feature'. */
  trigger?: PaywallTrigger;
}

export default function UpgradeBanner({ feature, trigger = 'feature' }: Props) {
  const { openPaywall } = usePractice();

  return (
    <TouchableOpacity style={styles.container} onPress={() => openPaywall(trigger)} activeOpacity={0.7}>
      <View style={styles.inner}>
        <Ionicons name="diamond-outline" size={14} color="#D4AF37" />
        <Text style={styles.text}>
          <Text style={styles.bold}>Unlock {feature} </Text>
          with Pro
        </Text>
        <Ionicons name="chevron-forward" size={14} color="#92400E" />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FEF3C7',
    borderRadius: 10,
    borderLeftWidth: 3,
    borderLeftColor: '#D4AF37',
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 4,
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  text: {
    flex: 1,
    fontSize: 13,
    color: '#92400E',
  },
  bold: {
    fontWeight: '600',
  },
});
