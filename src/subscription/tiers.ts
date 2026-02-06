export enum SubscriptionTier {
  FREE = 'free',
  PRO = 'pro',
}

export interface TierCapabilities {
  /** Whether the coach can set a custom intensity (1–5). Free tier is locked to 3. */
  customIntensity: boolean;
  /** Whether the coach can use station splitting (requires assistant coaches). */
  stationSplitting: boolean;
  /** How many past practice sessions are stored. */
  practiceHistoryLimit: number;
  /** Whether the full drill catalog is accessible (vs. top-30 subset). */
  fullCatalogAccess: boolean;
}

const TIER_MAP: Record<SubscriptionTier, TierCapabilities> = {
  [SubscriptionTier.FREE]: {
    customIntensity: false,
    stationSplitting: false,
    practiceHistoryLimit: 5,
    fullCatalogAccess: false,
  },
  [SubscriptionTier.PRO]: {
    customIntensity: true,
    stationSplitting: true,
    practiceHistoryLimit: Infinity,
    fullCatalogAccess: true,
  },
};

export function getTierCapabilities(tier: SubscriptionTier): TierCapabilities {
  return TIER_MAP[tier];
}
