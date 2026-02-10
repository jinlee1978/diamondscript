import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { SubscriptionTier } from '../src/subscription/tiers';
import { getSubscriptionInfo, initiateUpgrade, restorePurchases } from '../src/subscription/service';
import config from '../src/config/env';

interface SubscriptionContextValue {
  tier: SubscriptionTier;
  upgradeToPro: () => Promise<boolean>;
  restorePurchases: () => Promise<boolean>;
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

  const upgradeToPro = useCallback(async (): Promise<boolean> => {
    const success = await initiateUpgrade();
    if (success) {
      // Reload subscription info to update tier
      const info = await getSubscriptionInfo();
      setTier(info.tier);
    }
    return success;
  }, []);

  const handleRestorePurchases = useCallback(async (): Promise<boolean> => {
    const success = await restorePurchases();
    if (success) {
      // Reload subscription info to update tier
      const info = await getSubscriptionInfo();
      setTier(info.tier);
    }
    return success;
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
