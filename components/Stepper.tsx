import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

interface Props {
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  label?: string;
  locked?: boolean;
  step?: number; // BUILD 59: Support custom step increments (e.g., 15 for duration)
}

export default function Stepper({ value, min, max, onChange, label, locked = false, step = 1 }: Props) {
  const canDecrement = value > min && !locked;
  const canIncrement = value < max && !locked;

  return (
    <View style={styles.row}>
      {label && <Text style={styles.label}>{label}</Text>}
      <View style={styles.controls}>
        <TouchableOpacity
          style={[styles.button, !canDecrement && styles.buttonDisabled]}
          onPress={() => canDecrement && onChange(value - step)}
          disabled={!canDecrement}
          activeOpacity={0.6}
        >
          <Text style={[styles.buttonText, !canDecrement && styles.buttonTextDisabled]}>−</Text>
        </TouchableOpacity>

        <Text style={[styles.value, locked && styles.valueLocked]}>{value}</Text>

        <TouchableOpacity
          style={[styles.button, !canIncrement && styles.buttonDisabled]}
          onPress={() => canIncrement && onChange(value + step)}
          disabled={!canIncrement}
          activeOpacity={0.6}
        >
          <Text style={[styles.buttonText, !canIncrement && styles.buttonTextDisabled]}>+</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  label: {
    fontSize: 15,
    color: '#111827',
    fontWeight: '500',
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 0,
  },
  button: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#1B4332',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonDisabled: {
    backgroundColor: '#E5E7EB',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '600',
  },
  buttonTextDisabled: {
    color: '#9CA3AF',
  },
  value: {
    width: 44,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  valueLocked: {
    color: '#9CA3AF',
  },
});
