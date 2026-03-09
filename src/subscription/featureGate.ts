import { SubscriptionTier, getTierCapabilities } from './tiers';
import { PracticeRequest } from '../data/types';

/**
 * Feature gating layer. Sits OUTSIDE the engine.
 * Adjusts the incoming PracticeRequest to comply with tier limits
 * before it reaches the engine. The engine itself is tier-unaware.
 */

/** Default intensity for Free tier users who cannot set a custom value. */
const FREE_TIER_DEFAULT_INTENSITY = 3;

/**
 * Applies tier-based constraints to a practice request.
 * Returns a sanitized request safe to pass to the engine.
 */
export function applyTierConstraints(request: PracticeRequest, tier: SubscriptionTier): PracticeRequest {
  const caps = getTierCapabilities(tier);

  // Sanitize inputs to prevent downstream math errors
  const safeIntensity = Math.max(1, Math.min(5, request.intensity ?? FREE_TIER_DEFAULT_INTENSITY));
  const safeAssistants = Math.max(0, request.assistantCoaches ?? 0);
  const safeNumDrills = Math.max(1, request.numDrills ?? 4);

  return {
    ...request,
    subscriptionTier: tier,
    intensity: caps.customIntensity ? safeIntensity : FREE_TIER_DEFAULT_INTENSITY,
    assistantCoaches: caps.stationSplitting ? safeAssistants : 0,
    numDrills: safeNumDrills,
  };
}
