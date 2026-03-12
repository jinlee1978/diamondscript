import { SubscriptionTier, getTierCapabilities } from './tiers';
import { PracticeRequest } from '../data/types';

/**
 * Feature gating layer. Sits OUTSIDE the engine.
 * Adjusts the incoming PracticeRequest to comply with tier limits
 * before it reaches the engine. The engine itself is tier-unaware.
 */

/**
 * Applies tier-based constraints to a practice request.
 * Returns a sanitized request safe to pass to the engine.
 */
export function applyTierConstraints(request: PracticeRequest, tier: SubscriptionTier): PracticeRequest {
  const caps = getTierCapabilities(tier, request.ageGroup);

  // Sanitize inputs and clamp to tier limits
  const safeIntensity = Math.max(1, Math.min(caps.maxIntensity, request.intensity ?? 3));
  const safeAssistants = Math.max(0, Math.min(caps.maxAssistants, request.assistantCoaches ?? 0));
  const safeNumDrills = Math.max(1, Math.min(caps.maxDrills, request.numDrills ?? 4));

  return {
    ...request,
    subscriptionTier: tier,
    intensity: safeIntensity,
    assistantCoaches: safeAssistants,
    numDrills: safeNumDrills,
  };
}
