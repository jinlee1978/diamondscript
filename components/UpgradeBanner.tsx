import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';

interface Props {
  feature: string;
}

export default function UpgradeBanner({ feature }: Props) {
  const router = useRouter();

  return (
    <TouchableOpacity style={styles.container} onPress={() => router.push('/upgrade')} activeOpacity={0.7}>
      <View style={styles.inner}>
        <Text style={styles.icon}>&#9733;</Text>
        <Text style={styles.text}>
          <Text style={styles.bold}>Unlock {feature} </Text>
          with Pro
        </Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FEF3C7',
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#D4AF37',
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginTop: 4,
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  icon: {
    color: '#D4AF37',
    fontSize: 14,
  },
  text: {
    fontSize: 13,
    color: '#92400E',
  },
  bold: {
    fontWeight: '600',
  },
});
