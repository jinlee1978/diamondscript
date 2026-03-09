/**
 * BUILD 106: Centralized Design System
 *
 * Single source of truth for colors, typography, spacing, and radii.
 * All screens should import from here instead of hardcoding values.
 */

import { Platform, TextStyle } from 'react-native';

// ── Colors ──

export const colors = {
  // Brand
  primary: '#1B4332',       // Forest green — buttons, accents, headers
  primaryDark: '#1B3D2F',   // Header background
  primaryLight: '#ECFDF5',  // Light green tint — backgrounds, highlights
  primaryMuted: '#BBF7D0',  // Soft green — borders, dividers

  // Gold accent
  gold: '#D4AF37',
  goldLight: '#FEF3C7',
  goldDark: '#92400E',

  // Semantic
  success: '#059669',
  warning: '#D97706',
  error: '#EF4444',
  info: '#3B82F6',

  // Neutrals
  white: '#FFFFFF',
  background: '#FAFBFC',    // Warmer than #F8FAFC
  surface: '#FFFFFF',
  surfaceHover: '#F9FAFB',
  border: '#E5E7EB',
  borderLight: '#F3F4F6',
  divider: '#F3F4F6',

  // Text
  textPrimary: '#111827',
  textSecondary: '#4B5563',
  textTertiary: '#6B7280',
  textMuted: '#9CA3AF',
  textInverse: '#FFFFFF',

  // Category colors
  hitting: '#D4AF37',
  fielding: '#1B4332',
  pitching: '#2563EB',
  baserunning: '#EA580C',

  // Source badge colors
  aiBg: '#FEF3C7',
  aiText: '#92400E',
  aiBorder: '#D4AF37',
  manualBg: '#D1FAE5',
  manualText: '#065F46',
  manualBorder: '#059669',
  libraryBg: '#DBEAFE',
  libraryText: '#1E40AF',
  libraryBorder: '#3B82F6',

  // Tab bar
  tabActive: '#1B4332',
  tabInactive: '#9CA3AF',
  tabBarBg: '#FFFFFF',
  generateButton: '#D4AF37',
} as const;

// ── Typography ──

const FONT_FAMILY = Platform.select({
  ios: {
    regular: 'System',
    medium: 'System',
    semibold: 'System',
    bold: 'System',
    rounded: 'System',           // Use System; ui-rounded requires iOS 16+
  },
  default: {
    regular: 'sans-serif',
    medium: 'sans-serif-medium',
    semibold: 'sans-serif-medium',
    bold: 'sans-serif',
    rounded: 'sans-serif-medium', // Android equivalent of rounded
  },
});

export const typography = {
  // Large titles (screen names, hero text)
  largeTitle: {
    fontSize: 28,
    fontWeight: '700',
    fontFamily: FONT_FAMILY?.rounded,
    letterSpacing: -0.3,
    color: colors.textPrimary,
  } as TextStyle,

  // Section titles
  title: {
    fontSize: 20,
    fontWeight: '700',
    fontFamily: FONT_FAMILY?.rounded,
    letterSpacing: -0.2,
    color: colors.textPrimary,
  } as TextStyle,

  // Card titles
  headline: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.1,
    color: colors.textPrimary,
  } as TextStyle,

  // Subtitles, secondary headlines
  subheadline: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textSecondary,
  } as TextStyle,

  // Body text
  body: {
    fontSize: 15,
    fontWeight: '400',
    lineHeight: 22,
    color: colors.textSecondary,
  } as TextStyle,

  // Smaller body
  bodySmall: {
    fontSize: 13,
    fontWeight: '400',
    lineHeight: 19,
    color: colors.textTertiary,
  } as TextStyle,

  // Captions and labels
  caption: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.textMuted,
  } as TextStyle,

  // Uppercase labels
  overline: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    color: colors.textMuted,
  } as TextStyle,

  // Stat numbers
  statNumber: {
    fontSize: 22,
    fontWeight: '800',
    fontFamily: FONT_FAMILY?.rounded,
    color: colors.primary,
  } as TextStyle,

  // Button text
  button: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.2,
  } as TextStyle,

  // Tab bar labels
  tabLabel: {
    fontSize: 10,
    fontWeight: '600',
    fontFamily: FONT_FAMILY?.rounded,
  } as TextStyle,
} as const;

// ── Spacing ──

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;

// ── Border Radius ──
// Standardized to 3 tiers

export const radii = {
  sm: 8,     // Chips, badges, small elements
  md: 12,    // Cards, inputs, buttons
  lg: 16,    // Large cards, modals
  xl: 20,    // Bottom sheets, full modals
  full: 999, // Circular elements (use with equal w/h)
} as const;

// ── Shadows ──

export const shadows = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  md: {
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  lg: {
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 5,
  },
} as const;

// ── Common Component Styles ──

export const commonStyles = {
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.borderLight,
    ...shadows.sm,
  },
  cardElevated: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.borderLight,
    ...shadows.md,
  },
  primaryButton: {
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    paddingVertical: 14,
    paddingHorizontal: 24,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radii.sm,
    backgroundColor: colors.borderLight,
  },
  chipActive: {
    backgroundColor: colors.primary,
  },
  input: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radii.md,
    padding: 14,
    fontSize: 15,
    color: colors.textPrimary,
    backgroundColor: colors.surface,
  },
} as const;
