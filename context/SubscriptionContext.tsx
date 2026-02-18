/**
 * @deprecated BUILD 60 - This context has been merged into PracticeContext.
 *
 * As of Build 60, subscription management is handled directly in PracticeContext
 * to support RevenueCat real-time entitlement updates. This file is kept for
 * reference only and is no longer used in the app.
 *
 * Migration:
 * - Old: `const { tier, upgradeToPro } = useSubscription()`
 * - New: `const { tier, upgradeToPro } = usePractice()`
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { SubscriptionTier } from '../src/subscription/tiers';
import { getSubscriptionInfo, initiateUpgrade, restorePurchases, UpgradeResult, RestoreResult } from '../src/subscription/service';
import config from '../src/config/env';

interface SubscriptionContextValue {
  tier: SubscriptionTier;
  upgradeToPro: () => Promise<UpgradeResult>;
  restorePurchases: () => Promise<RestoreResult>;
}

const SubscriptionContext = createContext<SubscriptionContextValue | null>(null);

export function SubscriptionProvider({ children }: { children: React.ReactNode }) {
  const [tier, setTier] = useState<SubscriptionTier>('free');

  // Load subscription tier on mount
  useEffect(() => {
    let mounted = true;

    getSubscriptionInfo().then((info) => {
      if (mounted) {
        // INTERNAL TESTING BYPASS: Force PRO tier when flag is set
        // Remove EXPO_PUBLIC_FORCE_PRO_ACCESS from eas.json before production release
        if (config.forceProAccess) {
          setTier(SubscriptionTier.PRO);
          if (__DEV__) {
            console.log('🔓 INTERNAL TESTING: PRO tier forced via forceProAccess flag');
          }
        } else {
          setTier(info.tier);
        }
      }
    });

    return () => {
      mounted = false;
    };
  }, []);

  const upgradeToPro = useCallback(async (): Promise<UpgradeResult> => {
    const result = await initiateUpgrade();
    if (result.success) {
      const info = await getSubscriptionInfo();
      setTier(info.tier);
    }
    return result;
  }, []);

  const handleRestorePurchases = useCallback(async (): Promise<RestoreResult> => {
    const result = await restorePurchases();
    if (result.success) {
      const info = await getSubscriptionInfo();
      setTier(info.tier);
    }
    return result;
  }, []);

  return (
    <SubscriptionContext.Provider
      value={{
        tier,
        upgradeToPro,
        restorePurchases: handleRestorePurchases,
      }}
    >
      {children}
    </SubscriptionContext.Provider>
  );
}

export function useSubscription(): SubscriptionContextValue {
  const ctx = useContext(SubscriptionContext);
  if (!ctx) throw new Error('useSubscription must be used inside <SubscriptionProvider>');
  return ctx;
}
