/**
 * Subscription Service for DiamondScript
 *
 * This module manages ONE-TIME PURCHASE (not recurring subscription) for Pro tier.
 * Currently uses local storage for development.
 * Ready to integrate with RevenueCat for one-time purchase, or Stripe.
 *
 * Integration steps:
 * 1. Install RevenueCat: npm install react-native-purchases
 * 2. Configure API keys in environment variables
 * 3. Configure "Pro" as a NON-RENEWING (one-time) entitlement in RevenueCat
 * 4. Replace initiateUpgrade() with RevenueCat.purchasePackage() for non-consumable
 *
 * IMPORTANT: Pro is a ONE-TIME $9.99 purchase, NOT a recurring subscription.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { SubscriptionTier } from './tiers';
import config from '../config/env';
import { captureMessage, setUser } from '../config/sentry';

const SUBSCRIPTION_KEY = '@diamondscript/subscription';

export interface SubscriptionInfo {
  tier: SubscriptionTier;
  purchaseDate?: number; // Unix timestamp (for one-time purchases)
  purchasePrice?: number; // In cents (e.g., 999 = $9.99)
}

/**
 * Get the current subscription status
 */
export async function getSubscriptionInfo(): Promise<SubscriptionInfo> {
  try {
    // Try to load from storage
    const stored = await AsyncStorage.getItem(SUBSCRIPTION_KEY);
    if (stored) {
      const info: SubscriptionInfo = JSON.parse(stored);
      // One-time purchase - Pro tier never expires
      return info;
    }

    // Default to free tier
    const defaultInfo: SubscriptionInfo = { tier: SubscriptionTier.FREE };
    await AsyncStorage.setItem(SUBSCRIPTION_KEY, JSON.stringify(defaultInfo));
    return defaultInfo;
  } catch (error) {
    if (__DEV__) {
      console.error('Failed to load subscription info:', error);
    }
    // Fail safe: return free tier
    return { tier: SubscriptionTier.FREE };
  }
}

/**
 * Update subscription status (called after successful purchase)
 */
export async function updateSubscriptionInfo(info: SubscriptionInfo): Promise<void> {
  try {
    await AsyncStorage.setItem(SUBSCRIPTION_KEY, JSON.stringify(info));

    // Update Sentry user context
    setUser({
      id: 'anonymous', // Replace with actual user ID when auth is implemented
      tier: info.tier,
    });

    captureMessage(`Subscription updated to ${info.tier}`, 'info');
  } catch (error) {
    if (__DEV__) {
      console.error('Failed to save subscription info:', error);
    }
    throw error;
  }
}

/**
 * Initiate one-time $9.99 Pro purchase
 * This is a placeholder - integrate with payment provider
 */
export async function initiateUpgrade(): Promise<boolean> {
  // TODO: Integrate with RevenueCat for one-time purchase
  // Example RevenueCat integration for NON-RENEWING purchase:
  // try {
  //   const offerings = await Purchases.getOfferings();
  //   const proPackage = offerings.current?.lifetime; // Or custom non-renewing package
  //   if (proPackage) {
  //     const purchaseResult = await Purchases.purchasePackage(proPackage);
  //     if (purchaseResult.customerInfo.entitlements.active['pro']) {
  //       await updateSubscriptionInfo({
  //         tier: 'pro',
  //         purchaseDate: Date.now(),
  //         purchasePrice: 999, // $9.99
  //       });
  //       return true;
  //     }
  //   }
  // } catch (error) {
  //   console.error('Purchase failed:', error);
  //   return false;
  // }

  if (config.isDevelopment) {
    // In development, allow instant "purchase" for testing
    console.log('⚠️ DEV MODE: Simulating $9.99 one-time Pro purchase');
    await updateSubscriptionInfo({
      tier: SubscriptionTier.PRO,
      purchaseDate: Date.now(),
      purchasePrice: 999, // $9.99 in cents
    });
    return true;
  }

  // In production, this would trigger the payment flow
  if (__DEV__) {
    console.warn('Purchase flow not implemented - please integrate payment provider');
  }
  return false;
}

/**
 * Restore purchases (for users who already purchased on another device)
 */
export async function restorePurchases(): Promise<boolean> {
  // TODO: Integrate with payment provider
  // Example RevenueCat integration for one-time purchase:
  // try {
  //   const customerInfo = await Purchases.restorePurchases();
  //   if (customerInfo.entitlements.active['pro']) {
  //     await updateSubscriptionInfo({
  //       tier: 'pro',
  //       purchaseDate: Date.now(),
  //       purchasePrice: 999,
  //     });
  //     return true;
  //   }
  // } catch (error) {
  //   console.error('Restore failed:', error);
  // }

  if (__DEV__) {
    console.warn('Restore purchases not implemented - please integrate payment provider');
  }
  return false;
}

/**
 * Refund one-time purchase (admin function - not exposed to users)
 * One-time purchases cannot be "cancelled" like subscriptions
 */
export async function refundPurchase(): Promise<void> {
  // In production, refunds are handled through App Store / Play Store support
  // This function is for testing/admin purposes only
  await updateSubscriptionInfo({ tier: SubscriptionTier.FREE });
  captureMessage('Purchase refunded (admin action)', 'warning');
}

/**
 * Check if user has Pro access
 */
export async function hasProAccess(): Promise<boolean> {
  const info = await getSubscriptionInfo();
  return info.tier === SubscriptionTier.PRO;
}
