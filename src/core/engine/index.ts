import { Drill, PracticeRequest, PracticeSession } from '../../data/types';
import { getAgeGroupDefinition } from '../constants/ageGroups';
import { calculateTargetComplexity } from '../logic/complexityScoring';
import { selectDrills, filterCandidates } from './drillSelector';
import { calculateOptimalRepFlow } from './repFlowEngine';

/**
 * The public engine API surface.
 *
 * generatePracticeSession() is the single entry point. It:
 *   1. Resolves the age group definition.
 *   2. Filters the drill catalog by age + tier compatibility.
 *   3. Calculates Target Complexity from age + experience.
 *   4. Runs the greedy drill selector.
 *   5. Feeds selected drills into the rep flow engine.
 *   6. Returns a fully structured PracticeSession.
 *
 * The engine is a pure function. Same inputs → same output. No I/O, no side effects.
 * Subscription tier checks must happen BEFORE calling this function.
 */
export function generatePracticeSession(
  request: PracticeRequest,
  drillCatalog: Drill[],
): PracticeSession {
  const ageGroupDef = getAgeGroupDefinition(request.ageGroup);

  // Pre-filter: age compatibility + subscription tier
  const candidates = filterCandidates(drillCatalog, request.ageGroup, request.subscriptionTier);

  // Calculate the target complexity sweet spot
  const targetComplexity = calculateTargetComplexity(ageGroupDef, request.experienceLevel);

  // Greedy drill selection with dynamic category balancing
  const selectedDrills = selectDrills(
    candidates,
    targetComplexity,
    request.intensity,
    request.numDrills,
  );

  // Station layout with rep counts and timing
  const stationLayout = calculateOptimalRepFlow(
    ageGroupDef,
    selectedDrills,
    request.intensity,
    request.assistantCoaches,
  );

  return {
    request,
    targetComplexity,
    selectedDrills,
    stationLayout,
    warmupMinutes: ageGroupDef.warmupMinutes,
    cooldownMinutes: ageGroupDef.cooldownMinutes,
  };
}
