import { AgeGroup } from './ageGroup';

export type DrillCategory = 'hitting' | 'fielding' | 'pitching' | 'baserunning';

export interface Drill {
  /** Globally unique, stable identifier. */
  id: string;
  /** Human-readable name shown to the coach. */
  name: string;
  /** Short description of what players actually do. */
  description: string;
  /** Complexity score on the 1.0–5.0 scale. Content-team authored, frozen. */
  complexityScore: number;
  /** Physical intensity on the 1–5 scale. How hard bodies work. */
  physicalIntensity: number;
  /** Primary drill category. Exactly one. Used by category balance scoring. */
  category: DrillCategory;
  /**
   * Age groups this drill is valid for.
   * Pitching drills exclude T_BALL and 8U at the data level —
   * the engine never sees an incompatible drill.
   */
  ageGroupCompatibility: AgeGroup[];
  /** Minimum players needed to run this drill. */
  minPlayers: number;
  /** Subscription tier required. 'free' or 'pro'. */
  subscriptionTier: 'free' | 'pro';
  /** Equipment needed to run this drill. Empty array if no special equipment required. */
  equipment: string[];
}
