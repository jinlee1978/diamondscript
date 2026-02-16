/**
 * BUILD 60 STUB: react-native-purchases
 *
 * Temporary stub for RevenueCat SDK to allow builds without native configuration.
 * Replace with actual react-native-purchases in Build 61 when RevenueCat is configured.
 *
 * This stub provides type-safe mock implementations that:
 * - Never return Pro entitlements (all users get FREE tier)
 * - Log warnings in DEV mode when called
 * - Provide correct TypeScript types for existing code
 */

export interface CustomerInfo {
  entitlements: {
    active: Record<string, any>;
  };
  activeSubscriptions: string[];
}

export interface PurchasesPackage {
  product: {
    identifier: string;
    priceString: string;
  };
}

export interface PurchasesOfferings {
  current?: {
    availablePackages: PurchasesPackage[];
  };
}

export interface PurchaseResult {
  customerInfo: CustomerInfo;
}

/**
 * BUILD 60 STUB: Purchases SDK mock
 */
const Purchases = {
  /**
   * STUB: Configure - does nothing (no native SDK)
   */
  configure: (_options: { apiKey: string }) => {
    if (__DEV__) {
      console.warn('[BUILD 60 STUB] Purchases.configure() called but RevenueCat not configured');
    }
  },

  /**
   * STUB: Get customer info - always returns FREE tier
   */
  getCustomerInfo: async (): Promise<CustomerInfo> => {
    if (__DEV__) {
      console.warn('[BUILD 60 STUB] Purchases.getCustomerInfo() - returning FREE tier');
    }
    return {
      entitlements: { active: {} }, // No active entitlements
      activeSubscriptions: [],
    };
  },

  /**
   * STUB: Get offerings - returns empty (no products available)
   */
  getOfferings: async (): Promise<PurchasesOfferings> => {
    if (__DEV__) {
      console.warn('[BUILD 60 STUB] Purchases.getOfferings() - no products available');
    }
    return {
      current: {
        availablePackages: [],
      },
    };
  },

  /**
   * STUB: Purchase package - throws error (not implemented)
   */
  purchasePackage: async (_pkg: PurchasesPackage): Promise<PurchaseResult> => {
    throw new Error('RevenueCat not configured. Purchases are not available in this build.');
  },

  /**
   * STUB: Restore purchases - returns FREE tier
   */
  restorePurchases: async (): Promise<CustomerInfo> => {
    if (__DEV__) {
      console.warn('[BUILD 60 STUB] Purchases.restorePurchases() - returning FREE tier');
    }
    return {
      entitlements: { active: {} },
      activeSubscriptions: [],
    };
  },

  /**
   * STUB: Add listener - does nothing
   */
  addCustomerInfoUpdateListener: (_listener: (info: CustomerInfo) => void) => {
    if (__DEV__) {
      console.warn('[BUILD 60 STUB] Purchases.addCustomerInfoUpdateListener() - listener not registered');
    }
  },

  /**
   * STUB: Remove listener - does nothing
   */
  removeCustomerInfoUpdateListener: (_listener: (info: CustomerInfo) => void) => {
    // No-op
  },
};

export default Purchases;

export { Purchases };
