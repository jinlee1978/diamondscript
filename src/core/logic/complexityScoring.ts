import { AgeGroupDefinition } from '../../data/types';
import { applyExperienceWeighting } from './experienceWeighting';

/**
 * Calculates the Target Complexity score for a given age group and experience level.
 *
 * TC = ageMin + EWF(experience) × (ageMax − ageMin)
 *
 * This is a linear interpolation across the age group's complexity band,
 * driven by the concave EWF curve. The non-linearity in experience is
 * baked into EWF — this function is intentionally simple.
 */
export function calculateTargetComplexity(
  ageGroupDef: AgeGroupDefinition,
  experienceYears: number,
): number {
  const ewf = applyExperienceWeighting(experienceYears);
  return ageGroupDef.minComplexity + ewf * (ageGroupDef.maxComplexity - ageGroupDef.minComplexity);
}
