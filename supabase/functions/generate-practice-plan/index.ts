/**
 * Supabase Edge Function: generate-practice-plan
 *
 * Generates AI-powered baseball practice plans using Google Gemini AI.
 *
 * BUILD 67: CODE-LEVEL SECURITY (Gateway JWT Bypass)
 * - Security Model: Manual JWT verification in code (lines 105-164)
 * - Deployment: MUST use --no-verify-jwt flag to bypass gateway auth
 * - Why: Gateway rejects valid tokens with empty 'authorization' metadata
 * - Solution: Gateway bypass + code-level verification = reliable auth
 * - Primary model: Configurable via GEMINI_MODEL secret (default: gemini-2.5-flash)
 * - Fallback model: Configurable via GEMINI_FALLBACK_MODEL secret (default: gemini-2.0-flash)
 * - API version: Configurable via GEMINI_API_VERSION secret (default: v1beta)
 * - CORS: Strict allowlist (Expo dev + production domains)
 * - Auto-Repair: Frontend automatically retries 401 errors with fresh session
 *
 * BUILD 75: PRECISION PROMPTING + BULLETPROOF PARSER
 * - Word limit: 40-80 words per drill description
 * - Format: SETUP (1-2 sentences) + ACTION (3-4 bullet points)
 * - Parser: Auto-repair truncated JSON by balancing braces/brackets
 * - Token headroom: maxOutputTokens increased to 8192
 *
 * DEPLOYMENT COMMAND:
 * npx supabase functions deploy generate-practice-plan --no-verify-jwt
 *
 * Zero hardcoded model names - fully hot-swappable via Supabase secrets dashboard
 */

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.95.3';

// Request interface matching client-side AIPracticeRequest
interface GeneratePlanRequest {
  ageGroup: string;
  experienceLevel: number;
  focusArea: string;
  duration: number;
  intensity: 'rec' | 'travel' | 'competitive';
  assistantCoaches?: number;
  userInstructions?: string;
}

// Response interfaces matching client-side AIPracticePlan
interface AIDrill {
  name: string;
  description: string;
  duration: number;
  equipment?: string[];
}

interface AIPlanSection {
  title: string;
  drills: AIDrill[];
}

interface AIPracticePlan {
  planTitle: string;
  estimatedDuration: number;
  sections: AIPlanSection[];
}

serve(async (req) => {
  // BUILD 67: Strict CORS - Allowlist for Expo dev and production
  const allowedOrigins = [
    'exp://127.0.0.1:8081',           // Expo Go dev (iOS)
    'exp://192.168.1.1:8081',         // Expo Go dev (Android - placeholder, adjust if needed)
    'https://diamondscript.app',      // Production web (future)
    'https://app.diamondscript.app',  // Production web alt domain
  ];

  const origin = req.headers.get('origin');

  // BUILD 67: CRITICAL FIX - Handle both browser and native mobile app requests
  // - Browsers send Origin header → validate against allowlist
  // - Native mobile apps (React Native production builds) DON'T send Origin → rely on JWT auth
  // - This is EXPECTED behavior: Origin is a browser-only security concept
  let allowedOrigin: string | null = null;

  if (origin) {
    // Browser request - validate Origin
    if (allowedOrigins.includes(origin)) {
      allowedOrigin = origin;
    } else {
      // Browser with unauthorized origin - reject
      return new Response(
        JSON.stringify({ error: 'Origin not allowed' }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }
  }
  // If no Origin header (native mobile app), allowedOrigin stays null - this is OK
  // Security relies on JWT verification instead (lines 105-164)

  // BUILD 67: CORS headers for browser requests (optional for native apps)
  const corsHeaders = allowedOrigin ? {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  } : {
    // Native mobile app (no Origin header) - minimal headers
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders, status: 200 });
  }

  try {
    // BUILD 67: CODE-LEVEL JWT VERIFICATION
    // Gateway auth is BYPASSED (--no-verify-jwt), so we verify manually here
    // This ensures we have full control over auth flow and avoid gateway metadata issues

    console.log('🔐 [BUILD 67] Manual JWT Verification Starting...');

    const authHeader = req.headers.get('Authorization');
    const apikeyHeader = req.headers.get('apikey');

    console.log('   Authorization header present:', !!authHeader);
    console.log('   Apikey header present:', !!apikeyHeader);

    if (!authHeader) {
      console.error('❌ Missing Authorization header');
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Extract Bearer token (sanitized)
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();
    console.log('   Token extracted, length:', token.length);

    // Initialize Supabase client for JWT verification
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');

    if (!supabaseUrl || !supabaseAnonKey) {
      console.error('❌ Missing SUPABASE_URL or SUPABASE_ANON_KEY environment variables');
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey);

    // BUILD 67: Manual JWT verification using supabaseClient.auth.getUser()
    // This bypasses the gateway and verifies the token directly
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);

    if (authError || !user) {
      console.error('❌ JWT verification failed:', authError?.message || 'No user found');
      console.error('   Error details:', authError);
      return new Response(
        JSON.stringify({
          error: 'Invalid or expired token',
          message: 'Authentication failed. Please restart the app and try again.',
          ...(Deno.env.get('DEBUG') === 'true' && { debug: authError?.message })
        }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Log authenticated user (anonymous UUID)
    console.log('✅ JWT Verification Successful');
    console.log('   User ID:', user.id);
    console.log('   Auth Method:', user.app_metadata?.provider || 'anonymous');

    // Parse request body
    const requestData: GeneratePlanRequest = await req.json();

    // DEBUG: Log incoming request
    console.log('📥 Incoming Request');
    console.log('   Age Group:', requestData.ageGroup);
    console.log('   Focus Area:', requestData.focusArea);
    console.log('   Duration:', requestData.duration);
    console.log('   Intensity:', requestData.intensity);
    console.log('   Experience:', requestData.experienceLevel);

    // Validate required fields
    if (!requestData.ageGroup || !requestData.focusArea || !requestData.duration) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: ageGroup, focusArea, duration' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Sanitize focusArea: cap length and strip non-alphanumeric chars (except commas, spaces, hyphens, ampersands)
    requestData.focusArea = requestData.focusArea
      .substring(0, 200)
      .replace(/[^a-zA-Z0-9,\s\-&()]/g, '')
      .trim();

    // Get Gemini API key from secrets
    const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
    if (!geminiApiKey) {
      console.error('GEMINI_API_KEY not configured in Supabase secrets');
      return new Response(
        JSON.stringify({ error: 'AI service not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Dynamic Model Selection: Fully configurable via secrets
    const primaryModel = Deno.env.get('GEMINI_MODEL') || 'gemini-2.5-flash';
    const fallbackModel = Deno.env.get('GEMINI_FALLBACK_MODEL') || 'gemini-2.0-flash';
    const apiVersion = Deno.env.get('GEMINI_API_VERSION') || 'v1beta';

    // Build AI prompt
    const prompt = buildPrompt(requestData);

    console.log('🤖 Gemini API - Dynamic Model Selection');
    console.log('   Primary Model:', primaryModel);
    console.log('   Fallback Model:', fallbackModel);
    console.log('   API Version:', apiVersion);
    console.log('   Prompt Length:', prompt.length, 'chars');

    // Attempt primary model with automatic failover
    let practicePlan: AIPracticePlan;
    try {
      practicePlan = await callGeminiAPI(geminiApiKey, primaryModel, apiVersion, prompt);
      console.log('✅ Success with primary model:', primaryModel);
    } catch (error: any) {
      // Check if 404 (model not found) - trigger failover
      if (error.status === 404) {
        console.warn('⚠️  PRIMARY MODEL DEPRECATED:', primaryModel);
        console.warn('   Error:', error.message);
        console.warn('   🔄 Attempting failover to stable model:', fallbackModel);

        try {
          practicePlan = await callGeminiAPI(geminiApiKey, fallbackModel, apiVersion, prompt);
          console.log('✅ Failover successful with:', fallbackModel);
          console.log('⚡ ACTION REQUIRED: Update GEMINI_MODEL secret to', fallbackModel);
        } catch (fallbackError: any) {
          console.error('❌ Failover also failed:', fallbackError.message);
          throw fallbackError;
        }
      } else {
        // Non-404 error - don't attempt failover
        throw error;
      }
    }

    // Return structured practice plan
    return new Response(
      JSON.stringify(practicePlan),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Edge function error:', error);
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : String(error)
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

/**
 * Call Gemini API with specified model
 * BUILD 75: Increased maxOutputTokens to 8192 for token headroom
 * @throws Error with status code on failure
 */
async function callGeminiAPI(
  apiKey: string,
  model: string,
  apiVersion: string,
  prompt: string
): Promise<AIPracticePlan> {
  const geminiResponse = await fetch(
    `https://generativelanguage.googleapis.com/${apiVersion}/models/${model}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [{ text: prompt }],
          },
        ],
        generationConfig: {
          temperature: 0.7,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 8192, // BUILD 75: Increased from 4096 for longer plans
        },
      }),
    }
  );

  if (!geminiResponse.ok) {
    const errorText = await geminiResponse.text();
    const error: any = new Error(`Gemini API error: ${errorText}`);
    error.status = geminiResponse.status;
    throw error;
  }

  const geminiData = await geminiResponse.json();

  // DEBUG: Log response structure
  console.log('   Response Status:', geminiResponse.status);
  console.log('   Candidates:', geminiData.candidates?.length || 0);

  // Extract generated text
  const generatedText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!generatedText) {
    console.error('No text in Gemini response:', geminiData);
    throw new Error('Invalid AI response format');
  }

  // Parse JSON from generated text (with auto-repair)
  const practicePlan = parseGeminiResponse(generatedText);

  // Validate response structure
  if (!practicePlan.planTitle || !practicePlan.sections || practicePlan.sections.length === 0) {
    console.error('Invalid practice plan structure:', practicePlan);
    throw new Error('Invalid practice plan generated');
  }

  return practicePlan;
}

/**
 * BUILD 75: PRECISION PROMPTING
 * - Word limit: 40-80 words per drill description
 * - Format: SETUP (1-2 sentences) + ACTION (3-4 bullet points)
 * - Technical style: Active verbs, no motivation/leadership fluff
 * - Focus: 100% physical setup and mechanical execution
 */
/**
 * BUILD 100: Updated for 7 age groups (Intro through Advanced).
 * Age group strings now include descriptions to help Gemini generate
 * age-appropriate content.
 */
function buildPrompt(request: GeneratePlanRequest): string {
  const experienceLabels = ['First Year', 'Beginner', 'Developing', 'Intermediate', 'Advanced', 'Veteran'];
  const experienceLabel = experienceLabels[request.experienceLevel] || 'Intermediate';

  const intensityDescriptions = {
    rec: 'recreational (fun-focused, low pressure)',
    travel: 'travel ball (competitive but age-appropriate)',
    competitive: 'highly competitive (tournament prep)',
  };
  const intensityDesc = intensityDescriptions[request.intensity];

  // BUILD 100: Age-specific constraints for the AI
  const ageConstraints: Record<string, string> = {
    'Intro (3-4)': 'Ages 3-4. Pre-T-Ball. No live pitching, no gloves required. Pure motor skills: rolling balls, running bases, throwing underhand at targets. Max 30 min practice, drills max 5 min each. Keep it playful.',
    'T-Ball (5-6)': 'Ages 5-6. Ball on tee only, no live pitching. Basic motor fundamentals: swing mechanics, fielding ground balls, base running. Max 45 min practice.',
    'Coach Pitch (7-8)': 'Ages 7-8. Coach throws underhand or overhand. Ball tracking and swing timing emerge. Basic defensive positioning. Max 50 min practice.',
    'Machine Pitch (8-9)': 'Ages 8-9. Pitching machine delivers consistent strikes. Focus on swing mechanics, pitch tracking, and fielding live batted balls. Max 55 min practice.',
    'Kid Pitch (9-10)': 'Ages 9-10. Kids pitch to each other. Include pitcher/catcher work, defensive positioning, situational awareness. Max 60 min practice.',
    'Competitive (11-12)': 'Ages 11-12. Position specialization begins. Lead-offs, stealing, advanced situational play, cut-offs. Max 75 min practice.',
    'Advanced (13-14)': 'Ages 13-14. Full baseball. Longer distances, pitch selection, advanced base running, relay plays. Max 90 min practice.',
  };
  const ageConstraint = ageConstraints[request.ageGroup] || '';

  const customInstructions = request.userInstructions
    ? `\n\n**COACH'S SPECIAL INSTRUCTIONS:**\n${request.userInstructions}\n\nIncorporate these specific requests into the practice plan where applicable.`
    : '';

  return `You are a technical baseball coach. Generate a CONCISE practice plan.

**Team Profile:**
- Age Group: ${request.ageGroup}
- Experience Level: ${experienceLabel}
- Focus Areas: ${request.focusArea}
- Practice Duration: ${request.duration} minutes
- Intensity: ${intensityDesc}
${request.assistantCoaches ? `- Assistant Coaches: ${request.assistantCoaches}` : '- Coach: Head coach only'}${customInstructions}

**DRILL DESCRIPTION FORMAT (STRICT):**
Each drill description must be 40-80 words using this exact format:

SETUP: [1-2 sentences on positioning, spacing in feet, equipment placement]
ACTION: • [verb] [specific action] • [verb] [specific action] • [verb] [specific action] • [rotate/repeat instruction]

**EXAMPLE:**
"SETUP: Two lines 60ft apart, coach at midpoint with bucket. ACTION: • Field grounder with two hands • Crow-hop and throw to partner • Catch and immediately return throw • Rotate to back of opposite line after each rep."

**FORBIDDEN:**
- Motivation words: "encourage", "energy", "positive", "focus on"
- Leadership fluff: "emphasize", "reinforce", "build confidence"
- Vague instructions: "good form", "proper technique", "fundamentals"
- Any word count over 80 per drill description

**OUTPUT JSON:**
{
  "planTitle": "string (under 50 chars)",
  "estimatedDuration": ${request.duration},
  "sections": [
    {
      "title": "Warmup|Drills|Skills|Scrimmage|Cooldown",
      "drills": [
        {
          "name": "Drill Name (3-5 words)",
          "description": "SETUP: ... ACTION: • ... • ... • ...",
          "duration": number,
          "equipment": ["item1", "item2"]
        }
      ]
    }
  ]
}

**AGE GROUP CONTEXT:**
${ageConstraint}

**RULES:**
- 3-5 sections total
- 1-3 drills per section
- Durations sum to ~${request.duration} minutes
- Equipment arrays required (use ["none"] if no equipment)
- Prioritize drills covering: ${request.focusArea}
- Age-appropriate for ${request.ageGroup}
- Respect the age group constraints above (max practice time, allowed activities)

Return ONLY valid JSON. No markdown, no code blocks, no extra text.`;
}

/**
 * BUILD 75: BULLETPROOF PARSER
 * - Aggressive markdown stripping
 * - Auto-repair truncated JSON by balancing braces/brackets
 * - Handles common Gemini output quirks
 */
function parseGeminiResponse(text: string): AIPracticePlan {
  console.log('🔧 [BUILD 75] Bulletproof Parser - Input length:', text.length);

  // Step 1: Aggressive markdown stripping
  let cleanedText = text.trim();

  // Remove any markdown code block wrappers (multiple patterns)
  cleanedText = cleanedText
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .replace(/^`+/g, '')
    .replace(/`+$/g, '');

  // Remove any leading/trailing whitespace or newlines
  cleanedText = cleanedText.trim();

  // Step 2: Find JSON boundaries (first { to last })
  const firstBrace = cleanedText.indexOf('{');
  const lastBrace = cleanedText.lastIndexOf('}');

  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    cleanedText = cleanedText.substring(firstBrace, lastBrace + 1);
  }

  console.log('   Cleaned text length:', cleanedText.length);

  // Step 3: Try direct parse first
  try {
    const parsed = JSON.parse(cleanedText);
    console.log('   ✅ Direct parse successful');
    return normalizeResponse(parsed);
  } catch (directError) {
    console.warn('   ⚠️ Direct parse failed, attempting auto-repair...');
  }

  // Step 4: Auto-repair truncated JSON
  try {
    const repairedText = autoRepairJson(cleanedText);
    console.log('   Repaired text length:', repairedText.length);

    const parsed = JSON.parse(repairedText);
    console.log('   ✅ Auto-repair successful');
    return normalizeResponse(parsed);
  } catch (repairError) {
    console.error('   ❌ Auto-repair failed');
    console.error('   First 500 chars:', cleanedText.substring(0, 500));
    console.error('   Last 200 chars:', cleanedText.substring(cleanedText.length - 200));
    throw new Error(`JSON parse error after auto-repair: ${repairError instanceof Error ? repairError.message : String(repairError)}`);
  }
}

/**
 * BUILD 75: Auto-repair truncated JSON
 * Counts open/close braces and brackets, appends missing closers
 */
function autoRepairJson(text: string): string {
  let openBraces = 0;
  let openBrackets = 0;
  let inString = false;
  let escapeNext = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    if (escapeNext) {
      escapeNext = false;
      continue;
    }

    if (char === '\\') {
      escapeNext = true;
      continue;
    }

    if (char === '"') {
      inString = !inString;
      continue;
    }

    if (inString) continue;

    if (char === '{') openBraces++;
    if (char === '}') openBraces--;
    if (char === '[') openBrackets++;
    if (char === ']') openBrackets--;
  }

  console.log('   Brace balance: open', openBraces, ', brackets open', openBrackets);

  // If we're inside a string, close it first
  let repaired = text;
  if (inString) {
    repaired += '"';
  }

  // Remove trailing comma if present (common truncation artifact)
  repaired = repaired.replace(/,\s*$/, '');

  // Close any open brackets first, then braces
  for (let i = 0; i < openBrackets; i++) {
    repaired += ']';
  }
  for (let i = 0; i < openBraces; i++) {
    repaired += '}';
  }

  return repaired;
}

/**
 * Normalize parsed response to ensure correct types
 */
function normalizeResponse(parsed: any): AIPracticePlan {
  // Ensure estimatedDuration is a number
  if (typeof parsed.estimatedDuration === 'string') {
    parsed.estimatedDuration = parseInt(parsed.estimatedDuration, 10);
  }

  // Ensure all drill durations are numbers
  if (parsed.sections) {
    parsed.sections.forEach((section: any) => {
      if (section.drills) {
        section.drills.forEach((drill: any) => {
          if (typeof drill.duration === 'string') {
            drill.duration = parseInt(drill.duration, 10);
          }
          // Ensure equipment is an array
          if (!drill.equipment) {
            drill.equipment = ['none'];
          } else if (!Array.isArray(drill.equipment)) {
            drill.equipment = [drill.equipment];
          }
        });
      }
    });
  }

  return parsed as AIPracticePlan;
}
