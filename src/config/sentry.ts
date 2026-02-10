/**
 * Sentry initialization for crash reporting and error tracking
 *
 * Setup instructions:
 * 1. Create a Sentry project at https://sentry.io/
 * 2. Get your DSN from the project settings
 * 3. Add it to .env: EXPO_PUBLIC_SENTRY_DSN=your-dsn-here
 * 4. For EAS builds, set it via: eas secret:create --scope project --name EXPO_PUBLIC_SENTRY_DSN --value your-dsn
 */

import * as Sentry from '@sentry/react-native';
import config from './env';

/**
 * Initialize Sentry for crash reporting and performance monitoring
 */
export function initSentry() {
  // Only initialize if crash reporting is enabled and DSN is configured
  if (!config.enableCrashReporting) {
    if (__DEV__) {
      console.log('📊 Sentry: Disabled in development');
    }
    return;
  }

  if (!config.sentryDsn) {
    if (__DEV__) {
      console.warn('⚠️ Sentry: DSN not configured. Set EXPO_PUBLIC_SENTRY_DSN in your environment.');
    }
    return;
  }

  try {
    Sentry.init({
      dsn: config.sentryDsn,

      // Enable in production and staging
      enabled: config.enableCrashReporting,

      // Environment
      environment: config.env,

      // Release version (app version + build number)
      release: `diamondscript@${config.appVersion}+${config.buildNumber}`,

      // Distribution (build number)
      dist: config.buildNumber,

      // Performance Monitoring
      tracesSampleRate: config.isProduction ? 0.2 : 1.0, // 20% in prod, 100% in staging

      // Enable auto session tracking
      enableAutoSessionTracking: true,

      // Session timeout (30 minutes)
      sessionTrackingIntervalMillis: 30000,

      // Breadcrumbs
      maxBreadcrumbs: 50,

      // Attach stack trace to messages
      attachStacktrace: true,

      // Debug mode (only in development)
      debug: config.isDevelopment,

      // Before send callback - filter sensitive data
      beforeSend(event) {
        // Don't send events in development
        if (config.isDevelopment) {
          return null;
        }

        // Filter sensitive data from breadcrumbs and context
        if (event.breadcrumbs) {
          event.breadcrumbs = event.breadcrumbs.map(breadcrumb => {
            // Remove potential PII from messages
            if (breadcrumb.message) {
              breadcrumb.message = breadcrumb.message.replace(/email=[^&\s]+/gi, 'email=[FILTERED]');
              breadcrumb.message = breadcrumb.message.replace(/token=[^&\s]+/gi, 'token=[FILTERED]');
            }
            return breadcrumb;
          });
        }

        return event;
      },
    });

    if (__DEV__) {
      console.log('✅ Sentry initialized successfully');
    }
  } catch (error) {
    if (__DEV__) {
      console.error('❌ Failed to initialize Sentry:', error);
    }
  }
}

/**
 * Manually capture an exception
 */
export function captureException(error: Error, context?: Record<string, any>) {
  if (config.enableCrashReporting && config.sentryDsn) {
    Sentry.captureException(error, {
      extra: context,
    });
  } else if (config.isDevelopment) {
    console.error('Sentry (dev mode):', error, context);
  }
}

/**
 * Manually capture a message
 */
export function captureMessage(message: string, level: Sentry.SeverityLevel = 'info') {
  if (config.enableCrashReporting && config.sentryDsn) {
    Sentry.captureMessage(message, level);
  } else if (config.isDevelopment) {
    console.log(`Sentry (dev mode) [${level}]:`, message);
  }
}

/**
 * Set user context for crash reports
 */
export function setUser(user: { id: string; email?: string; tier?: string }) {
  if (config.enableCrashReporting && config.sentryDsn) {
    Sentry.setUser({
      id: user.id,
      email: user.email,
      tier: user.tier,
    });
  }
}

/**
 * Clear user context
 */
export function clearUser() {
  if (config.enableCrashReporting && config.sentryDsn) {
    Sentry.setUser(null);
  }
}

/**
 * Add custom context to crash reports
 */
export function addBreadcrumb(breadcrumb: {
  message: string;
  category?: string;
  level?: Sentry.SeverityLevel;
  data?: Record<string, any>;
}) {
  if (config.enableCrashReporting && config.sentryDsn) {
    Sentry.addBreadcrumb(breadcrumb);
  } else if (config.isDevelopment) {
    console.log('Sentry breadcrumb (dev mode):', breadcrumb);
  }
}

export default Sentry;
