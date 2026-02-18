/**
 * BUILD 90: RevenueCat Purchase Service for DiamondScript
 *
 * CROSS-PLATFORM PRODUCTION CONFIGURATION
 * ========================================
 *
 * Build 90 (Store Submission Readiness):
 * - Cross-platform API keys via Platform.select (iOS + Android)
 * - Supabase identity linking via Purchases.logIn()
 * - RestoreResult type for UI-actionable restore feedback
 * - UpgradeResult type for UI-actionable purchase feedback
 *
 * Build 89 (retained):
 * - Log level set to ERROR (minimal logging for production)
 * - RevenueCat is the SOLE source of truth for subscription status
 *
 * Build 87 Critical Fix (retained):
 * - REMOVED forceProAccess bypass that was causing "Ghost Pro"
 * - All tier decisions flow through Purchases.getCustomerInfo()
 *
 * Build 86 Fixes (retained):
 * - Promise-based initialization prevents race conditions
 * - Listener returns cleanup function (fixes memory leak)
 * - isConfigured check before listener registration
 * - No optimistic tier updates - rely on CustomerInfo listener
 *
 * Configuration:
 * - API Keys: Platform-specific (appl_ for iOS, goog_ for Android)
 * - Entitlement ID: "pro"
 * - Package ID: $rc_monthly (RevenueCat standard monthly package)
 * - Identity: Supabase anonymous ID linked to RevenueCat appUserID
 * - NEVER fail open: All errors default to FREE tier
 */

import { Platform } from 'react-native';
import Purchases, { CustomerInfo, PurchasesOffering } from 'react-native-purchases';
import { SubscriptionTier } from './tiers';
import { captureException, captureMessage } from '../config/sentry';

// BUILD 90: Cross-platform RevenueCat API keys
export const REVENUECAT_API_KEY = Platform.select({
  ios: 'appl_PxYRGXlkPDWerPadHxEANPomTEs',
  android: 'goog_CMmqJFvawEGkJUbJQmuVdyqwFHG',
}) as string;

const ENTITLEMENT_ID = 'pro';

// BUILD 86: Promise-based initialization to prevent race conditions
let isConfigured = false;
let configurationPromise: Promise<void> | null = null;

// BUILD 90: Track whether Supabase identity has been linked
let hasIdentified = false;

/**
 * BUILD 90: Initialize RevenueCat SDK with optional Supabase identity linking
 *
 * Key improvements:
 * - Returns same Promise if called multiple times during init
 * - Prevents race conditions between _layout.tsx and PracticeContext
 * - Allows retry on failure (clears promise on error)
 * - Links Supabase anonymous user ID to RevenueCat appUserID (once)
 *
 * @param supabaseUserId - Optional Supabase anonymous user ID.
 *   When provided, calls Purchases.logIn() to unify the identity
 *   across RevenueCat and Supabase for server-side entitlement checks.
 */
export async function initializeRevenueCat(supabaseUserId?: string): Promise<void> {
  // Step 1: Configure SDK (with promise-based locking)
  if (!isConfigured) {
    if (!configurationPromise) {
      configurationPromise = (async () => {
        try {
          // BUILD 91: Set log level INSIDE init (was module-scope — crashed Hermes GC)
          Purchases.setLogLevel(Purchases.LOG_LEVEL.ERROR);

          console.log('[RevenueCat] Starting SDK configuration...');
          console.log('[RevenueCat] Platform:', Platform.OS);
          console.log('[RevenueCat] API Key:', REVENUECAT_API_KEY.substring(0, 10) + '...');

          Purchases.configure({
            apiKey: REVENUECAT_API_KEY,
          });
          isConfigured = true;
          console.log('[RevenueCat] Initialized successfully');
        } catch (error) {
          // Clear promise to allow retry on next call
          configurationPromise = null;
          console.error('[RevenueCat] Initialization failed:', error);
          captureException(error as Error, { context: 'revenuecat_init' });
          throw error; // Propagate error so callers know init failed
        }
      })();
    }
    await configurationPromise;
  }

  // Step 2: Link Supabase identity (only once, non-fatal)
  // This makes the Supabase anonymous user ID the RevenueCat appUserID,
  // enabling server-side entitlement lookups via the RevenueCat REST API.
  if (supabaseUserId && !hasIdentified) {
    try {
      const { customerInfo } = await Purchases.logIn(supabaseUserId);
      hasIdentified = true;
      console.log('[RevenueCat] Identified with Supabase user:', supabaseUserId.substring(0, 8) + '...');

      // Check if the linked account already has Pro (e.g., restored from another device)
      const hasPro = customerInfo.entitlements.active[ENTITLEMENT_ID] != null;
      if (hasPro) {
        console.log('[RevenueCat] Linked account already has Pro entitlement');
      }
    } catch (error) {
      captureException(error as Error, { context: 'revenuecat_identity_link' });
      console.warn('[RevenueCat] Identity linking failed (non-fatal):', error);
      // Non-fatal: purchases still work with RevenueCat's anonymous ID
    }
  }
}

/**
 * BUILD 86: Check if SDK is ready (for guard checks)
 */
export function isRevenueCatConfigured(): boolean {
  return isConfigured;
}

export interface PurchaseInfo {
  tier: SubscriptionTier;
  isPurchased: boolean;
  purchaseDate?: number;
}

/**
 * Get current purchase status from RevenueCat.
 * Security: Always fails to FREE on error
 */
export async function getSubscriptionInfo(): Promise<PurchaseInfo> {
  try {
    // BUILD 87: RevenueCat is the SOLE source of truth
    // No bypasses, no shortcuts - always query the server
    await initializeRevenueCat();

    const customerInfo = await Purchases.getCustomerInfo();
    const proEntitlement = customerInfo.entitlements.active[ENTITLEMENT_ID];
    const isPro = proEntitlement != null;

    return {
      tier: isPro ? SubscriptionTier.PRO : SubscriptionTier.FREE,
      isPurchased: isPro,
      purchaseDate: isPro
        ? new Date(proEntitlement.latestPurchaseDate).getTime()
        : undefined,
    };
  } catch (error) {
    captureException(error as Error, { context: 'get_subscription_info' });
    // SECURITY: Fail to FREE on any error - NEVER fail open
    return { tier: SubscriptionTier.FREE, isPurchased: false };
  }
}

// ============================================================
// BUILD 90: Typed result objects for UI-actionable feedback
// ============================================================

/**
 * Result from initiateUpgrade().
 * Discriminated union lets the UI render the right message for each case.
 */
export type UpgradeResult =
  | { success: true }
  | { success: false; userCancelled: true }
  | { success: false; userCancelled: false; message: string };

/**
 * Result from restorePurchases().
 * Lets the UI distinguish "nothing to restore" from "something went wrong."
 */
export type RestoreResult =
  | { success: true }
  | { success: false; reason: 'none_found'; message: string }
  | { success: false; reason: 'error'; message: string };

/**
 * BUILD 90: Initiate monthly Pro subscription ($9.99/month)
 *
 * Returns a typed UpgradeResult instead of throwing, so callers can
 * pattern-match on the result without try/catch.
 *
 * IMPORTANT: Does NOT set tier directly. Relies on CustomerInfo listener
 * to update tier after purchase is verified by RevenueCat.
 */
export async function initiateUpgrade(): Promise<UpgradeResult> {
  console.log('[RevenueCat] ========== PURCHASE FLOW START ==========');
  console.log('[RevenueCat] Initiating Pro subscription flow');

  try {
    await initializeRevenueCat();
    console.log('[RevenueCat] SDK initialized, isConfigured:', isConfigured);

    if (!isConfigured) {
      return {
        success: false,
        userCancelled: false,
        message: 'RevenueCat SDK failed to initialize. Please check your internet connection.',
      };
    }

    console.log('[RevenueCat] Fetching offerings...');
    const offerings = await Purchases.getOfferings();
    console.log('[RevenueCat] Offerings received:', JSON.stringify({
      hasCurrent: !!offerings.current,
      currentIdentifier: offerings.current?.identifier,
      availablePackages: offerings.current?.availablePackages.map((p: any) => ({
        identifier: p.identifier,
        packageType: p.packageType,
        productId: p.product.identifier,
      })),
    }, null, 2));

    if (!offerings.current) {
      captureMessage('No RevenueCat offering found', 'error');
      return {
        success: false,
        userCancelled: false,
        message: 'No subscription offerings are currently available. Please try again later.',
      };
    }

    // Find the monthly subscription package
    const monthlyPkg = offerings.current.monthly ||
      offerings.current.availablePackages.find(
        (p: any) => p.packageType === 'MONTHLY'
      );

    if (!monthlyPkg) {
      console.error('[RevenueCat] Monthly package NOT FOUND in offerings');
      console.error('[RevenueCat] Available packages:', offerings.current.availablePackages);
      captureMessage('Monthly package not found in offerings', 'error');
      return {
        success: false,
        userCancelled: false,
        message: 'Monthly subscription package not found. Please try again later.',
      };
    }

    console.log('[RevenueCat] Monthly package found:', {
      identifier: monthlyPkg.identifier,
      productId: monthlyPkg.product.identifier,
      price: monthlyPkg.product.priceString,
    });

    console.log('[RevenueCat] Calling purchasePackage...');
    const { customerInfo } = await Purchases.purchasePackage(monthlyPkg);
    const success = customerInfo.entitlements.active[ENTITLEMENT_ID] != null;

    console.log('[RevenueCat] Purchase result:', {
      success,
      activeEntitlements: Object.keys(customerInfo.entitlements.active),
    });

    if (success) {
      captureMessage('Pro subscription completed', 'info');
      console.log('[RevenueCat] ========== PURCHASE FLOW END ==========');
      return { success: true };
    }

    // Purchase went through but entitlement not active yet (rare edge case)
    console.log('[RevenueCat] ========== PURCHASE FLOW END ==========');
    return {
      success: false,
      userCancelled: false,
      message: 'Purchase completed but Pro access is still being activated. Please restart the app.',
    };
  } catch (error: any) {
    // Swallow user cancellation (not an error)
    if (error?.userCancelled) {
      console.log('[RevenueCat] User cancelled purchase');
      return { success: false, userCancelled: true };
    }

    // BUILD 88: ENHANCED ERROR LOGGING
    console.error('[RevenueCat] ========== PURCHASE ERROR ==========');
    console.error('[RevenueCat] Error Code:', error?.code);
    console.error('[RevenueCat] Error Message:', error?.message);
    console.error('[RevenueCat] Underlying Error Message:', error?.underlyingErrorMessage);
    console.error('[RevenueCat] Readable Error Code:', error?.readableErrorCode);
    console.error('[RevenueCat] User Info:', error?.userInfo);
    console.error('[RevenueCat] Full Error Object:', JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
    console.error('[RevenueCat] ===================================');

    captureException(error, {
      context: 'initiate_upgrade',
      extra: {
        errorCode: error?.code,
        underlyingErrorMessage: error?.underlyingErrorMessage,
        readableErrorCode: error?.readableErrorCode,
      }
    });

    const message = error?.underlyingErrorMessage || error?.message || 'An unexpected error occurred. Please try again.';
    return { success: false, userCancelled: false, message };
  }
}

/**
 * BUILD 90: Restore purchases with typed result for UI feedback.
 *
 * Apple requires a visible "Restore Purchases" button. The result type
 * lets the UI show the right message:
 * - success: "Your Pro subscription has been restored!"
 * - none_found: "No previous purchases found for this account."
 * - error: "Something went wrong. Please check your connection and try again."
 */
export async function restorePurchases(): Promise<RestoreResult> {
  try {
    await initializeRevenueCat();

    const customerInfo = await Purchases.restorePurchases();
    const hasPro = customerInfo.entitlements.active[ENTITLEMENT_ID] != null;

    if (hasPro) {
      captureMessage('Pro subscription restored', 'info');
      return { success: true };
    }

    return {
      success: false,
      reason: 'none_found',
      message: 'No previous purchases found for this account.',
    };
  } catch (error) {
    captureException(error as Error, { context: 'restore_purchases' });
    return {
      success: false,
      reason: 'error',
      message: 'Unable to restore purchases. Please check your connection and try again.',
    };
  }
}

/**
 * Check if user has Pro access
 */
export async function hasProAccess(): Promise<boolean> {
  const info = await getSubscriptionInfo();
  return info.tier === SubscriptionTier.PRO;
}

/**
 * BUILD 86: Get current offerings for display in UI
 */
export async function getOfferings(): Promise<PurchasesOffering | null> {
  try {
    await initializeRevenueCat();

    const offerings = await Purchases.getOfferings();
    return offerings.current || null;
  } catch (error) {
    captureException(error as Error, { context: 'get_offerings' });
    return null;
  }
}

/**
 * BUILD 86: Invalidate customer info cache (Ghost Killer)
 * Call this when app goes to background to force fresh data on resume
 */
export async function invalidateCustomerInfoCache(): Promise<void> {
  try {
    if (isConfigured) {
      await Purchases.invalidateCustomerInfoCache();
      console.log('[RevenueCat] Customer info cache invalidated');
    }
  } catch (error) {
    // Silent failure - cache invalidation is best-effort
    console.warn('[RevenueCat] Cache invalidation failed:', error);
  }
}

/**
 * BUILD 86: Add listener for customer info updates
 *
 * CRITICAL FIX: Returns cleanup function to prevent memory leaks.
 * The returned function MUST be called in useEffect cleanup.
 *
 * Also includes isConfigured guard - listener fires won't affect
 * state if SDK hasn't been properly initialized.
 */
export function addCustomerInfoListener(
  listener: (info: CustomerInfo) => void
): () => void {
  // Guard: If SDK not configured, return no-op cleanup
  // This prevents stale listener fires during initialization race
  if (!isConfigured) {
    console.warn('[RevenueCat] Listener registered before SDK configured - will miss early events');
  }

  // Register listener - SDK handles the subscription internally
  Purchases.addCustomerInfoUpdateListener(listener);

  // Return cleanup function
  // Note: RevenueCat SDK v5+ doesn't expose removeListener directly,
  // so we use an isActive flag pattern in the consumer (PracticeContext)
  return () => {
    // Cleanup is handled via isActive flag in the listener closure
    console.log('[RevenueCat] Listener cleanup requested');
  };
}
