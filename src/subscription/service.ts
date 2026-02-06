/**
 * Subscription Service for DiamondScript
 *
 * This module manages subscription state and integrates with payment providers.
 * Currently uses local storage for development.
 * Ready to integrate with RevenueCat, Stripe, or other payment platforms.
 *
 * Integration steps:
 * 1. Install RevenueCat: npm install react-native-purchases
 * 2. Configure API keys in environment variables
 * 3. Replace checkSubscriptionStatus() with RevenueCat.getCustomerInfo()
 * 4. Replace initiateUpgrade() with RevenueCat.purchasePackage()
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { SubscriptionTier } from './tiers';
import config from '../config/env';
import { captureMessage, setUser } from '../config/sentry';

const SUBSCRIPTION_KEY = '@diamondscript/subscription';

export interface SubscriptionInfo {
  tier: SubscriptionTier;
  expiresAt?: number; // Unix timestamp (for pro subscriptions)
  purchaseDate?: number; // Unix timestamp
  isTrialing?: boolean;
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

      // Check if Pro subscription has expired
      if (info.tier === SubscriptionTier.PRO && info.expiresAt && info.expiresAt < Date.now()) {
        // Subscription expired - downgrade to free
        const freeInfo: SubscriptionInfo = { tier: SubscriptionTier.FREE };
        await AsyncStorage.setItem(SUBSCRIPTION_KEY, JSON.stringify(freeInfo));
        captureMessage('Subscription expired - downgraded to free', 'info');
        return freeInfo;
      }

      return info;
    }

    // Default to free tier
    const defaultInfo: SubscriptionInfo = { tier: SubscriptionTier.FREE };
    await AsyncStorage.setItem(SUBSCRIPTION_KEY, JSON.stringify(defaultInfo));
    return defaultInfo;
  } catch (error) {
    console.error('Failed to load subscription info:', error);
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
    console.error('Failed to save subscription info:', error);
    throw error;
  }
}

/**
 * Initiate upgrade to Pro tier
 * This is a placeholder - integrate with payment provider
 */
export async function initiateUpgrade(): Promise<boolean> {
  // TODO: Integrate with RevenueCat or Stripe
  // Example RevenueCat integration:
  // try {
  //   const offerings = await Purchases.getOfferings();
  //   const monthlyPackage = offerings.current?.monthly;
  //   if (monthlyPackage) {
  //     const purchaseResult = await Purchases.purchasePackage(monthlyPackage);
  //     if (purchaseResult.customerInfo.entitlements.active['pro']) {
  //       await updateSubscriptionInfo({
  //         tier: 'pro',
  //         expiresAt: purchaseResult.customerInfo.expirationDate,
  //         purchaseDate: Date.now(),
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
    console.log('⚠️ DEV MODE: Simulating Pro upgrade');
    await updateSubscriptionInfo({
      tier: SubscriptionTier.PRO,
      expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000, // 30 days from now
      purchaseDate: Date.now(),
    });
    return true;
  }

  // In production, this would trigger the payment flow
  console.warn('Purchase flow not implemented - please integrate payment provider');
  return false;
}

/**
 * Restore purchases (for users who already purchased on another device)
 */
export async function restorePurchases(): Promise<boolean> {
  // TODO: Integrate with payment provider
  // Example RevenueCat integration:
  // try {
  //   const customerInfo = await Purchases.restorePurchases();
  //   if (customerInfo.entitlements.active['pro']) {
  //     await updateSubscriptionInfo({
  //       tier: 'pro',
  //       expiresAt: customerInfo.expirationDate,
  //     });
  //     return true;
  //   }
  // } catch (error) {
  //   console.error('Restore failed:', error);
  // }

  console.warn('Restore purchases not implemented - please integrate payment provider');
  return false;
}

/**
 * Cancel subscription
 */
export async function cancelSubscription(): Promise<void> {
  // In production, this would redirect to App Store / Play Store subscription management
  // For now, just downgrade to free
  await updateSubscriptionInfo({ tier: SubscriptionTier.FREE });
  captureMessage('Subscription cancelled', 'info');
}

/**
 * Check if user has Pro access
 */
export async function hasProAccess(): Promise<boolean> {
  const info = await getSubscriptionInfo();
  return info.tier === SubscriptionTier.PRO;
}
