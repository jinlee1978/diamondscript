import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

// Allowed origins for CORS (BUILD 51-Alpha-QC: Security Enhancement)
const ALLOWED_ORIGINS = [
  'https://diamondscript.app',
  'https://www.diamondscript.app',
  'exp://192.168.1.1',      // Expo Go development
  'http://localhost:8081',  // Local development
];

interface GeneratePlanRequest {
  ageGroup: string;
  experienceLevel: number;
  focusArea: string;
  duration: number;
  intensity: 'rec' | 'travel' | 'competitive';
  userInstructions?: string; // BUILD 54: Custom coach instructions
}

interface Drill {
  name: string;
  description: string;
  duration: number;
  equipment?: string[];
}

interface PlanSection {
  title: string;
  drills: Drill[];
}

interface PracticePlan {
  planTitle: string;
  estimatedDuration: number;
  sections: PlanSection[];
}

// BUILD 53: Rate limiting - track user requests (in-memory, per function instance)
const userRequestTimestamps = new Map<string, number[]>();
const RATE_LIMIT_MAX_REQUESTS = 5;
const RATE_LIMIT_WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours

function checkRateLimit(userId: string): { allowed: boolean; remainingRequests: number } {
  const now = Date.now();
  const userTimestamps = userRequestTimestamps.get(userId) || [];

  // Remove timestamps older than 24 hours
  const recentTimestamps = userTimestamps.filter(ts => now - ts < RATE_LIMIT_WINDOW_MS);

  // Check if user exceeded limit
  if (recentTimestamps.length >= RATE_LIMIT_MAX_REQUESTS) {
    return { allowed: false, remainingRequests: 0 };
  }

  // Add current timestamp and update map
  recentTimestamps.push(now);
  userRequestTimestamps.set(userId, recentTimestamps);

  return { allowed: true, remainingRequests: RATE_LIMIT_MAX_REQUESTS - recentTimestamps.length };
}

// BUILD 51-Alpha-QC: Input validation function
function validateRequest(req: GeneratePlanRequest): string | null {
  const validAgeGroups = ['T-Ball', '8U', '10U', '12U', '14U'];
  const validIntensities = ['rec', 'travel', 'competitive'];

  if (!validAgeGroups.includes(req.ageGroup)) {
    return 'Invalid age group. Must be one of: T-Ball, 8U, 10U, 12U, 14U';
  }

  if (typeof req.experienceLevel !== 'number' || req.experienceLevel < 0 || req.experienceLevel > 5) {
    return 'Experience level must be a number between 0 and 5';
  }

  if (!req.focusArea || req.focusArea.length > 100) {
    return 'Focus area is required and must be less than 100 characters';
  }

  // Sanitize: Block prompt injection attempts
  if (/[\n\r\t]|IGNORE|SYSTEM|ADMIN|DELETE|DROP/i.test(req.focusArea)) {
    return 'Invalid characters detected in focus area';
  }

  if (typeof req.duration !== 'number' || req.duration < 15 || req.duration > 180) {
    return 'Duration must be a number between 15 and 180 minutes';
  }

  if (!validIntensities.includes(req.intensity)) {
    return 'Invalid intensity type. Must be one of: rec, travel, competitive';
  }

  // BUILD 54: Validate userInstructions (prevent prompt injection)
  if (req.userInstructions) {
    if (req.userInstructions.length > 500) {
      return 'Special instructions must be less than 500 characters';
    }

    // Block prompt injection attempts
    if (/[\n\r\t]|IGNORE|SYSTEM|ADMIN|DELETE|DROP/i.test(req.userInstructions)) {
      return 'Invalid characters detected in special instructions';
    }
  }

  return null; // Valid
}

serve(async (req) => {
  // BUILD 51-Alpha-QC: CORS security - restrict to allowed origins
  const origin = req.headers.get('origin') ?? '';
  const corsOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];

  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': corsOrigin,
        'Access-Control-Allow-Methods': 'POST',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    });
  }

  try {
    // BUILD 51-Alpha-QC: Authentication check
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': corsOrigin,
        },
      });
    }

    // BUILD 52-Alpha: JWT verification with Service Role Key
    if (!SUPABASE_SERVICE_ROLE_KEY) {
      console.error('❌ SUPABASE_SERVICE_ROLE_KEY is not configured');
      return new Response(JSON.stringify({ error: 'Server configuration error' }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': corsOrigin,
        },
      });
    }

    // Verify JWT token using Service Role Key (required for server-side auth verification)
    const supabaseClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();

    if (authError || !user) {
      console.error('JWT verification failed:', authError?.message || 'No user returned');
      return new Response(JSON.stringify({ error: 'Invalid authentication token' }), {
        status: 401,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': corsOrigin,
        },
      });
    }

    // BUILD 53: Rate limiting - prevent excessive AI usage
    const rateLimitCheck = checkRateLimit(user.id);
    if (!rateLimitCheck.allowed) {
      return new Response(
        JSON.stringify({
          error: 'Daily AI generation limit reached (5 plans per 24 hours). Please try again later.',
        }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': corsOrigin,
            'X-RateLimit-Limit': RATE_LIMIT_MAX_REQUESTS.toString(),
            'X-RateLimit-Remaining': '0',
            'Retry-After': '86400', // 24 hours in seconds
          },
        }
      );
    }

    if (!GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY is not configured');
    }

    const requestData: GeneratePlanRequest = await req.json();

    // BUILD 51-Alpha-QC: Input validation
    const validationError = validateRequest(requestData);
    if (validationError) {
      return new Response(JSON.stringify({ error: validationError }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': corsOrigin,
        },
      });
    }

    const { ageGroup, experienceLevel, focusArea, duration, intensity, userInstructions } = requestData;

    // Build AI prompt
    const prompt = buildPrompt(ageGroup, experienceLevel, focusArea, duration, intensity, userInstructions);

    // Call Gemini API (2026 stable model)
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 2048,
          },
        }),
      }
    );

    if (!response.ok) {
      const status = response.status;
      // BUILD 51-Alpha-QC: Don't leak internal API details
      if (status === 429) {
        throw new Error('AI service rate limit reached. Please try again later.');
      } else if (status >= 500) {
        throw new Error('AI service temporarily unavailable. Please try again later.');
      } else {
        throw new Error('Unable to generate practice plan at this time.');
      }
    }

    const data = await response.json();
    const generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!generatedText) {
      throw new Error('No content generated from Gemini');
    }

    // Parse JSON response (strip markdown code blocks if present)
    let jsonText = generatedText.trim();
    if (jsonText.startsWith('```json')) {
      jsonText = jsonText.replace(/```json\n?/, '').replace(/\n?```$/, '');
    } else if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/```\n?/, '').replace(/\n?```$/, '');
    }

    // BUILD 51-Alpha-QC: Improved JSON parsing with validation
    let practicePlan: PracticePlan;
    try {
      practicePlan = JSON.parse(jsonText);

      // Validate structure
      if (!practicePlan.planTitle || !practicePlan.sections || !Array.isArray(practicePlan.sections)) {
        throw new Error('Invalid practice plan structure');
      }
    } catch (parseError) {
      console.error('[Edge Function] Failed to parse AI response:', jsonText.substring(0, 200));
      throw new Error('AI returned invalid format. Please try again.');
    }

    return new Response(JSON.stringify(practicePlan), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': corsOrigin,
      },
    });
  } catch (error) {
    // BUILD 51-Alpha-QC: Generic error messages (don't leak internal details)
    console.error('[Edge Function] Error:', error);

    const userMessage = error.message.includes('GEMINI_API_KEY')
      ? 'Service configuration error'
      : error.message.includes('AI service')
      ? error.message  // Already sanitized above
      : error.message.includes('Authentication') || error.message.includes('Invalid')
      ? error.message  // Already sanitized validation errors
      : 'Unable to generate practice plan. Please try again.';

    return new Response(JSON.stringify({ error: userMessage }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': corsOrigin,
      },
    });
  }
});

function buildPrompt(
  ageGroup: string,
  experienceLevel: number,
  focusArea: string,
  duration: number,
  intensity: string,
  userInstructions?: string
): string {
  const persona =
    intensity === 'rec'
      ? 'a supportive recreational coach focused on fun and fundamentals'
      : 'a competitive travel ball coach emphasizing high-intensity skill development';

  return `You are a Professional Youth Baseball Practice Coordinator helping volunteer coaches create effective practice plans.

Context:
- Age Group: ${ageGroup}
- Experience Level: ${experienceLevel}/5
- Focus Area: ${focusArea}
- Duration: ${duration} minutes
- Intensity: ${intensity.toUpperCase()} (${persona})

Your Task:
Create a structured practice plan optimized for ${ageGroup} players. For younger ages (T-Ball, 8U), prioritize engagement, fun, and motor skill development. For older ages (12U, 14U) and travel/competitive settings, increase drill complexity and intensity.

Output Requirements:
Return ONLY valid JSON. Do not include any conversational text, explanations, or markdown. Use this exact structure:

{
  "planTitle": "Practice plan title",
  "estimatedDuration": ${duration},
  "sections": [
    {
      "title": "Warmup",
      "drills": [
        {
          "name": "Drill name",
          "description": "Clear, age-appropriate instructions",
          "duration": 10,
          "equipment": ["optional array of equipment"]
        }
      ]
    },
    {
      "title": "Main Drills",
      "drills": [...]
    },
    {
      "title": "Cooldown",
      "drills": [...]
    }
  ]
}

Guidelines:
- Include 3-5 sections (Warmup, Main Drills, Skills Focus, Scrimmage/Game, Cooldown)
- Each section should have 1-4 drills
- Drill durations must sum to approximately ${duration} minutes
- For ${ageGroup}: ${getAgeSpecificGuidance(ageGroup)}
- Focus on ${focusArea} but maintain balanced fundamentals
${userInstructions ? `\n\n**COACH'S SPECIAL INSTRUCTIONS:**\n${userInstructions}\n\nIncorporate these specific requests into the practice plan where applicable. Adjust drills, equipment, or intensity to honor these preferences while maintaining age-appropriate safety.` : ''}

Generate the practice plan now:`;
}

function getAgeSpecificGuidance(ageGroup: string): string {
  const guidance: Record<string, string> = {
    'T-Ball': 'Keep drills under 8 minutes, use games and fun activities, avoid live pitching, focus on throwing, catching, and running',
    '8U': 'Short drills (8-12 min), introduce basic positions, use coach-pitch or soft-toss, emphasize fundamental mechanics',
    '10U': 'Drills 10-15 min, introduce kid-pitch, develop positional awareness, balance fun with skill progression',
    '12U': 'Drills 12-18 min, competitive focus, position specialization begins, introduce advanced techniques',
    '14U': 'Drills 15-20 min, high intensity, travel ball readiness, advanced strategies and situational play',
  };
  return guidance[ageGroup] || 'Use age-appropriate drill complexity and duration';
}
