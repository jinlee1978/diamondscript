import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { SubscriptionTier } from '../src/subscription/tiers';
import { getSubscriptionInfo, initiateUpgrade, restorePurchases } from '../src/subscription/service';

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
        // INTERNAL TESTING BYPASS: Force PRO tier for all users during testing phase
        // TODO: Remove this bypass before production release
        if (__DEV__) {
          setTier(SubscriptionTier.PRO);
          console.log('🔓 DEV BYPASS: Tier forced to PRO for internal testing');
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
