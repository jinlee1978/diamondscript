import { supabase } from '../config/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { PracticeSession, PracticeRequest, DrillBlock, Station, StationLayout } from '../data/types/practice';
import { Drill, DrillCategory } from '../data/types/drill';
import { AgeGroup } from '../data/types/ageGroup';

// BUILD 67: TypeScript global for development mode flag
declare const __DEV__: boolean;

export interface AIPracticeRequest {
  ageGroup: string;
  experienceLevel: number;
  focusArea: string;
  duration: number;
  intensity: 'rec' | 'travel' | 'competitive';
  assistantCoaches?: number; // BUILD 59: Number of assistant coaches (0-3)
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
 * BUILD 67: AUTO-REPAIR LOGIC - Automatic session recovery with retry
 *
 * Flow:
 * 1. Freshness Check: Get current session
 * 2. Re-Auth Trigger: If null or 401 → sign in anonymously
 * 3. ID Lock: Save user ID to AsyncStorage immediately
 * 4. Retry: Attempt request again with fresh token
 *
 * @param request Practice plan parameters
 * @returns Structured practice plan with drills
 * @throws Error if generation fails after retry
 */
export async function generateAIPracticePlan(
  request: AIPracticeRequest
): Promise<AIPracticePlan> {
  const USER_ID_KEY = '@diamondscript/supabase_user_id';

  try {
    if (__DEV__) {
      console.log('🤖 [BUILD 67] Starting AI practice plan generation...');
      console.log('   🔍 Freshness Check: Checking current session...');
    }

    // STEP 1: FRESHNESS CHECK - Get current session
    let { data: { session } } = await supabase.auth.getSession();

    // If session exists but token is expired or expiring within 60s, refresh proactively
    if (session?.expires_at) {
      const expiresAt = session.expires_at * 1000; // Convert to ms
      const now = Date.now();
      if (expiresAt - now < 60_000) {
        if (__DEV__) {
          console.log('   ⏰ Token expiring soon, refreshing proactively...');
        }
        const { data: refreshData } = await supabase.auth.refreshSession();
        if (refreshData?.session) {
          session = refreshData.session;
        }
      }
    }

    // Check if session exists
    if (!session?.access_token) {
      if (__DEV__) {
        console.warn('   ⚠️ No active session found, triggering re-auth...');
      }

      // STEP 2: RE-AUTH TRIGGER - Sign in anonymously
      return await reAuthAndRetry(request, USER_ID_KEY);
    }

    if (__DEV__) {
      console.log('   ✅ Session found');
      console.log('   User ID:', session.user.id);
      console.log('   Token length:', session.access_token.length);
      console.log('   Expires at:', new Date(session.expires_at! * 1000).toISOString());
      console.log('   📤 Attempting Edge Function call...');
    }

    // STEP 3: ATTEMPT REQUEST - Try with current session
    try {
      const result = await invokeEdgeFunction(request, session.access_token);
      return result;
    } catch (error: any) {
      // Check if it's a 401 error (multiple detection strategies)
      const statusCode = error?.context?.status
        || error?.status
        || (error.message?.includes('401') ? 401 : null)
        || (error.message?.includes('Authentication failed') ? 401 : null);

      if (statusCode === 401) {
        if (__DEV__) {
          console.warn('   ⚠️ 401 Authentication failed, triggering re-auth...');
        }

        // STEP 4: RE-AUTH TRIGGER - Session token was rejected, sign in anonymously and retry
        return await reAuthAndRetry(request, USER_ID_KEY);
      }

      // Not a 401 error - re-throw
      throw error;
    }
  } catch (error) {
    // Re-throw with enhanced error context
    if (error instanceof Error) {
      throw error;
    }
    throw new Error(`Unexpected error during AI generation: ${String(error)}`);
  }
}

/**
 * Re-authenticate and retry the request once.
 * First tries refreshing the existing session. Falls back to fresh anonymous sign-in.
 */
async function reAuthAndRetry(
  request: AIPracticeRequest,
  userIdKey: string
): Promise<AIPracticePlan> {
  // STEP A: Try refreshing the existing session first
  if (__DEV__) {
    console.log('   🔄 Re-Auth: Attempting session refresh...');
  }

  const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();

  if (!refreshError && refreshData?.session?.access_token) {
    if (__DEV__) {
      console.log('   ✅ Session refreshed successfully');
      console.log('   User ID:', refreshData.session.user.id);
    }
    try {
      return await invokeEdgeFunction(request, refreshData.session.access_token);
    } catch (retryError: any) {
      if (__DEV__) {
        console.warn('   ⚠️ Refreshed token still failed, falling back to anonymous sign-in...');
      }
      // Fall through to anonymous sign-in below
    }
  } else if (__DEV__) {
    console.warn('   ⚠️ Session refresh failed:', refreshError?.message || 'No session');
  }

  // STEP B: Fresh anonymous sign-in
  if (__DEV__) {
    console.log('   🔄 Re-Auth: Signing in anonymously...');
  }

  // Sign out first to clear any stale session state
  await supabase.auth.signOut().catch(() => {});

  // Sign in anonymously
  const { data: signInData, error: signInError } = await supabase.auth.signInAnonymously();

  if (signInError || !signInData?.session?.access_token) {
    if (__DEV__) {
      console.error('   ❌ Anonymous sign-in failed:', signInError?.message);
    }
    throw new Error('Authentication failed. Please restart the app and try again.');
  }

  const freshToken = signInData.session.access_token;
  const userId = signInData.session.user.id;

  if (__DEV__) {
    console.log('   ✅ Anonymous session created');
    console.log('   User ID:', userId);
    console.log('   Token length:', freshToken.length);
  }

  // STEP 3: ID LOCK - Save user ID to AsyncStorage immediately (BUILD 73: migrated from SecureStore)
  try {
    await AsyncStorage.setItem(userIdKey, userId);
    if (__DEV__) {
      console.log('   ✅ User ID saved to storage');
    }
  } catch (error) {
    if (__DEV__) {
      console.warn('   ⚠️ Failed to save user ID to storage:', error);
    }
    // Non-fatal - continue with request
  }

  // STEP 4: RETRY - Attempt request again with fresh token
  if (__DEV__) {
    console.log('   🔁 Retry: Invoking Edge Function with fresh token...');
  }

  return await invokeEdgeFunction(request, freshToken);
}

/**
 * Helper function to invoke Edge Function with explicit token mapping
 */
async function invokeEdgeFunction(
  request: AIPracticeRequest,
  accessToken: string
): Promise<AIPracticePlan> {
  try {
    // 30-second timeout
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Request timeout: AI generation took too long. Please try again.')), 30000);
    });

    // Invoke Edge Function with explicit Authorization header
    const invokePromise = supabase.functions.invoke('generate-practice-plan', {
      body: request,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    const { data, error } = await Promise.race([invokePromise, timeoutPromise]);

    if (error) {
      const statusCode = (error as any).context?.status;

      // BUILD 67: Enhanced error logging for debugging
      if (__DEV__) {
        const errorMessage = error.message || 'Unknown error';
        console.error('🚨 AI Generation Failed');
        console.error('   Status Code:', statusCode || 'Unknown');
        console.error('   Error Message:', errorMessage);
        console.error('   Token Length:', accessToken.length);
        console.error('   Full Error:', error);
      }

      // BUILD 67: Specific error messages for debugging
      if (statusCode === 401) {
        const err = new Error('Authentication failed. Please try again.');
        (err as any).status = 401;
        throw err;
      } else if (statusCode === 403) {
        throw new Error('Access denied. Your account may not have permission to use AI features.');
      } else if (statusCode === 429) {
        throw new Error('Rate limit exceeded. Please wait a moment before trying again.');
      }

      // Generic user-facing error (don't expose internal details in production)
      throw new Error('Unable to generate AI practice plan. Please check your connection and try again.');
    }

    if (!data || !data.planTitle || !data.sections) {
      if (__DEV__) {
        console.error('   ❌ Invalid response structure:', data);
      }
      throw new Error('Invalid practice plan format received from AI');
    }

    if (__DEV__) {
      console.log('   ✅ AI plan generated successfully');
      console.log('   Title:', data.planTitle);
      console.log('   Sections:', data.sections.length);
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
  // BUILD 100: Map age group string to AgeGroup enum (7 groups)
  const ageGroupMap: Record<string, AgeGroup> = {
    'Intro (3-4)': AgeGroup.INTRO,
    'T-Ball (5-6)': AgeGroup.T_BALL,
    'T-Ball': AgeGroup.T_BALL,
    'Coach Pitch (7-8)': AgeGroup.COACH_PITCH,
    '8U': AgeGroup.COACH_PITCH,
    'Machine Pitch (8-9)': AgeGroup.MACHINE_PITCH,
    'Kid Pitch (9-10)': AgeGroup.KID_PITCH,
    '10U': AgeGroup.KID_PITCH,
    'Competitive (11-12)': AgeGroup.COMPETITIVE,
    '12U': AgeGroup.COMPETITIVE,
    'Advanced (13-14)': AgeGroup.ADVANCED,
    '14U': AgeGroup.ADVANCED,
  };

  const ageGroup = ageGroupMap[request.ageGroup] ?? AgeGroup.KID_PITCH;

  // Infer category from section title or focus area
  // Order matters: check fielding before pitching so "Throwing" maps to fielding not pitching
  const inferCategory = (sectionTitle: string, focusArea: string): DrillCategory => {
    const combined = `${sectionTitle} ${focusArea}`.toLowerCase();
    if (combined.includes('hit') || combined.includes('bat') || combined.includes('swing') || combined.includes('bunt')) return 'hitting';
    if (combined.includes('field') || combined.includes('catch') || combined.includes('ground ball') || combined.includes('fly ball') || combined.includes('throw') || combined.includes('cut-off') || combined.includes('relay') || combined.includes('defensive')) return 'fielding';
    if (combined.includes('pitch') || combined.includes('mound')) return 'pitching';
    if (combined.includes('base') || combined.includes('run') || combined.includes('steal') || combined.includes('lead')) return 'baserunning';
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

  // BUILD 100: Age-based warmup/cooldown (in minutes) — 7 groups
  const warmupCooldownMap: Record<AgeGroup, { warmup: number; cooldown: number }> = {
    [AgeGroup.INTRO]: { warmup: 5, cooldown: 5 },
    [AgeGroup.T_BALL]: { warmup: 8, cooldown: 5 },
    [AgeGroup.COACH_PITCH]: { warmup: 8, cooldown: 5 },
    [AgeGroup.MACHINE_PITCH]: { warmup: 8, cooldown: 5 },
    [AgeGroup.KID_PITCH]: { warmup: 10, cooldown: 5 },
    [AgeGroup.COMPETITIVE]: { warmup: 10, cooldown: 7 },
    [AgeGroup.ADVANCED]: { warmup: 12, cooldown: 8 },
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
    assistantCoaches: request.assistantCoaches ?? 0, // BUILD 59: Use actual value or default to 0
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
