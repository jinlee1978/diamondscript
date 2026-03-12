export enum SubscriptionTier {
  FREE = 'free',
  PRO = 'pro',
}

export interface TierCapabilities {
  /** Max intensity level the coach can set (Free: 4, Pro: 5). */
  maxIntensity: number;
  /** Max number of assistant coaches (Free: 1, Pro: 3). */
  maxAssistants: number;
  /** Max drills per practice plan (Free: 4, Pro: 6). */
  maxDrills: number;
  /** Max experience level (0-5 default, lower for young age groups). */
  maxExperience: number;
  /** How many past practice sessions are stored. */
  practiceHistoryLimit: number;
  /** Max number of starred/saved drills (Free: 5, Pro: Infinity). */
  starredDrillsLimit: number;
  /** Whether the full drill catalog is accessible (vs. top-34 subset). */
  fullCatalogAccess: boolean;
}

const TIER_MAP: Record<SubscriptionTier, TierCapabilities> = {
  [SubscriptionTier.FREE]: {
    maxIntensity: 4,
    maxAssistants: 1,
    maxDrills: 4,
    maxExperience: 5,
    practiceHistoryLimit: 3,
    starredDrillsLimit: 5,
    fullCatalogAccess: false,
  },
  [SubscriptionTier.PRO]: {
    maxIntensity: 5,
    maxAssistants: 3,
    maxDrills: 6,
    maxExperience: 5,
    practiceHistoryLimit: Infinity,
    starredDrillsLimit: Infinity,
    fullCatalogAccess: true,
  },
};

/**
 * Age-specific overrides for young age groups.
 * These apply ON TOP of tier caps (the lower value wins).
 */
const YOUNG_GROUP_OVERRIDES: Record<string, Partial<TierCapabilities>> = {
  // Intro & T-Ball: max experience 1, intensity 3, 2 assistants (free tier)
  INTRO:       { maxExperience: 1, maxIntensity: 3, maxAssistants: 2 },
  T_BALL:      { maxExperience: 1, maxIntensity: 3, maxAssistants: 2 },
  // Coach Pitch: max experience 2, intensity 3, 2 assistants (free tier)
  COACH_PITCH: { maxExperience: 2, maxIntensity: 3, maxAssistants: 2 },
};

export function getTierCapabilities(tier: SubscriptionTier, ageGroup?: string): TierCapabilities {
  const caps = { ...TIER_MAP[tier] };

  if (ageGroup && ageGroup in YOUNG_GROUP_OVERRIDES) {
    const overrides = YOUNG_GROUP_OVERRIDES[ageGroup];
    // Apply the lower of tier cap vs age-group cap
    if (overrides.maxIntensity !== undefined) {
      caps.maxIntensity = Math.min(caps.maxIntensity, overrides.maxIntensity);
    }
    if (overrides.maxExperience !== undefined) {
      caps.maxExperience = Math.min(caps.maxExperience, overrides.maxExperience);
    }
    // Assistants: for free tier, young groups get MORE (override upward)
    if (tier === SubscriptionTier.FREE && overrides.maxAssistants !== undefined) {
      caps.maxAssistants = overrides.maxAssistants;
    }
  }

  return caps;
}
