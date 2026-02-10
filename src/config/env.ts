/**
 * Environment configuration for DiamondScript
 *
 * This module provides environment-specific configuration values.
 * In development, it uses default values.
 * In production, values should be provided via EAS environment variables.
 *
 * To set environment variables for EAS builds:
 * 1. Add them to eas.json under build profiles
 * 2. Or set them via: eas secret:create --scope project --name SECRET_NAME --value SECRET_VALUE
 */

import Constants from 'expo-constants';

export type Environment = 'development' | 'staging' | 'production';

interface Config {
  // Environment
  env: Environment;
  isDevelopment: boolean;
  isProduction: boolean;

  // App Info
  appVersion: string;
  buildNumber: string;

  // API Configuration (for future backend integration)
  apiUrl: string;
  apiTimeout: number;

  // Feature Flags
  enableCrashReporting: boolean;
  enableAnalytics: boolean;
  enableDebugLogs: boolean;
  forceProAccess: boolean; // For internal testing - grants Pro to all users

  // Subscription (for future payment integration)
  revenueCatApiKey?: string;

  // Sentry (for crash reporting)
  sentryDsn?: string;
}

function getEnvironment(): Environment {
  // In production builds, NODE_ENV will be set to 'production'
  if (process.env.NODE_ENV === 'production') {
    return 'production';
  }

  // Check for staging flag from EAS build
  if (process.env.EXPO_PUBLIC_ENV === 'staging') {
    return 'staging';
  }

  return 'development';
}

const env = getEnvironment();

const config: Config = {
  // Environment
  env,
  isDevelopment: env === 'development',
  isProduction: env === 'production',

  // App Info
  appVersion: Constants.expoConfig?.version || '1.0.0',
  buildNumber: Constants.expoConfig?.ios?.buildNumber ||
               Constants.expoConfig?.android?.versionCode?.toString() || '1',

  // API Configuration
  apiUrl: process.env.EXPO_PUBLIC_API_URL || 'https://api.diamondscript.app',
  apiTimeout: 30000, // 30 seconds

  // Feature Flags
  enableCrashReporting: env === 'production' || env === 'staging',
  enableAnalytics: env === 'production',
  enableDebugLogs: env === 'development',
  forceProAccess: process.env.EXPO_PUBLIC_FORCE_PRO_ACCESS === 'true',

  // Subscription (will be set when RevenueCat is integrated)
  revenueCatApiKey: process.env.EXPO_PUBLIC_REVENUECAT_API_KEY,

  // Sentry DSN (will be set when Sentry is configured)
  sentryDsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
};

// Log configuration in development
if (__DEV__) {
  console.log('🔧 App Configuration:', {
    env: config.env,
    version: config.appVersion,
    build: config.buildNumber,
    crashReporting: config.enableCrashReporting,
    analytics: config.enableAnalytics,
  });
}

export default config;
