import { supabase } from '../config/supabase';
import { PracticeSession, PracticeRequest, DrillBlock, Station, StationLayout } from '../data/types/practice';
import { Drill, DrillCategory } from '../data/types/drill';
import { AgeGroup } from '../data/types/ageGroup';

export interface AIPracticeRequest {
  ageGroup: string;
  experienceLevel: number;
  focusArea: string;
  duration: number;
  intensity: 'rec' | 'travel' | 'competitive';
  userInstructions?: string; // BUILD 54: Custom coach instructions
}

export interface AIDrill {
  name: string;
  description: string;
  duration: number;
  equipment?: string[];
}

export interface AIPlanSection {
  title: string;
  drills: AIDrill[];
}

export interface AIPracticePlan {
  planTitle: string;
  estimatedDuration: number;
  sections: AIPlanSection[];
}

/**
 * Generate an AI-powered practice plan using Gemini 3 Flash via Supabase Edge Functions
 * @param request Practice plan parameters
 * @returns Structured practice plan with drills
 * @throws Error if generation fails or returns invalid data
 */
export async function generateAIPracticePlan(
  request: AIPracticeRequest
): Promise<AIPracticePlan> {
  try {
    const { data, error } = await supabase.functions.invoke('generate-practice-plan', {
      body: request,
    });

    if (error) {
      // Enhanced error reporting with status code
      const statusCode = (error as any).context?.status || 'Unknown';
      const errorMessage = error.message || 'Unknown error';

      if (__DEV__) {
        console.error('🚨 AI Generation Failed');
        console.error('   Status Code:', statusCode);
        console.error('   Error Message:', errorMessage);
        console.error('   Full Error:', error);
      }

      throw new Error(`AI generation failed [${statusCode}]: ${errorMessage}`);
    }

    if (!data || !data.planTitle || !data.sections) {
      throw new Error('Invalid practice plan format received from AI');
    }

    return data as AIPracticePlan;
  } catch (error) {
    // Re-throw with enhanced error context
    if (error instanceof Error) {
      throw error;
    }
    throw new Error(`Unexpected error during AI generation: ${String(error)}`);
  }
}

/**
 * Convert AI-generated practice plan to PracticeSession format for storage
 * Maps Gemini's output structure to DiamondScript's internal practice session format
 */
export function convertAIPlanToPracticeSession(
  aiPlan: AIPracticePlan,
  request: AIPracticeRequest,
  tier: 'free' | 'pro'
): PracticeSession {
  // Map age group string to AgeGroup enum
  const ageGroupMap: Record<string, AgeGroup> = {
    'T-Ball': AgeGroup.T_BALL,
    '8U': AgeGroup.AGE_8U,
    '10U': AgeGroup.AGE_10U,
    '12U': AgeGroup.AGE_12U,
    '14U': AgeGroup.AGE_14U,
  };

  const ageGroup = ageGroupMap[request.ageGroup] ?? AgeGroup.AGE_10U;

  // Infer category from section title or focus area
  const inferCategory = (sectionTitle: string, focusArea: string): DrillCategory => {
    const combined = `${sectionTitle} ${focusArea}`.toLowerCase();
    if (combined.includes('hit') || combined.includes('bat')) return 'hitting';
    if (combined.includes('field') || combined.includes('catch')) return 'fielding';
    if (combined.includes('pitch') || combined.includes('throw')) return 'pitching';
    if (combined.includes('base') || combined.includes('run')) return 'baserunning';
    return 'fielding'; // Default fallback
  };

  // Convert AI drills to internal Drill format
  const selectedDrills: Drill[] = [];
  const drillBlocks: DrillBlock[] = [];
  let drillIdCounter = 1;

  aiPlan.sections.forEach((section) => {
    section.drills.forEach((aiDrill) => {
      const category = inferCategory(section.title, request.focusArea);

      // Create Drill object
      const drill: Drill = {
        id: `ai-${Date.now()}-${drillIdCounter++}`,
        name: aiDrill.name,
        description: aiDrill.description,
        complexityScore: 3.0, // AI drills default to mid-complexity
        physicalIntensity: request.intensity === 'rec' ? 2 : request.intensity === 'travel' ? 3 : 4,
        category,
        ageGroupCompatibility: [ageGroup], // Only compatible with requested age group
        minPlayers: 6, // Reasonable default
        subscriptionTier: 'free', // AI-generated drills accessible to all
        equipment: aiDrill.equipment ?? [],
      };

      selectedDrills.push(drill);

      // Create DrillBlock with timing from AI
      drillBlocks.push({
        drill,
        timeMinutes: aiDrill.duration,
        reps: Math.ceil(aiDrill.duration * 2), // Estimate ~2 reps per minute
        bonusReps: 0,
        openTimeMinutes: 0,
      });
    });
  });

  // Create single station layout (AI plans run sequentially, not parallel stations)
  const station: Station = {
    coachIndex: 0, // Head coach
    drills: drillBlocks,
  };

  const stations: Station[] = [station];

  // Calculate total time
  const transitionTimeMinutes = 2; // Standard transition time between drills
  const totalDrillTime = drillBlocks.reduce((sum, block) => sum + block.timeMinutes, 0);
  const totalTransitionTime = Math.max(0, drillBlocks.length - 1) * transitionTimeMinutes;

  // Age-based warmup/cooldown (in minutes)
  const warmupCooldownMap: Record<AgeGroup, { warmup: number; cooldown: number }> = {
    [AgeGroup.T_BALL]: { warmup: 5, cooldown: 5 },
    [AgeGroup.AGE_8U]: { warmup: 8, cooldown: 5 },
    [AgeGroup.AGE_10U]: { warmup: 10, cooldown: 5 },
    [AgeGroup.AGE_12U]: { warmup: 12, cooldown: 8 },
    [AgeGroup.AGE_14U]: { warmup: 15, cooldown: 10 },
  };

  const { warmup, cooldown } = warmupCooldownMap[ageGroup];
  const totalWallClockMinutes = warmup + totalDrillTime + totalTransitionTime + cooldown;

  const stationLayout: StationLayout = {
    stations,
    transitionTimeMinutes,
    totalWallClockMinutes,
  };

  // Map intensity string to number (1-5 scale)
  const intensityMap = { rec: 2, travel: 3, competitive: 4 };
  const intensityNumber = intensityMap[request.intensity];

  // Create PracticeRequest for session metadata
  const practiceRequest: PracticeRequest = {
    ageGroup,
    experienceLevel: request.experienceLevel,
    intensity: intensityNumber,
    numDrills: selectedDrills.length,
    assistantCoaches: 0, // AI plans assume single coach
    subscriptionTier: tier,
  };

  // Assemble final PracticeSession
  const session: PracticeSession = {
    request: practiceRequest,
    targetComplexity: 3.0, // AI plans target mid-complexity
    selectedDrills,
    stationLayout,
    warmupMinutes: warmup,
    cooldownMinutes: cooldown,
  };

  return session;
}
