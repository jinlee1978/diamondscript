#!/bin/bash
# DiamondScript - Gemini Connection Test Suite
# Tests the full Client → Edge Function → Gemini API chain

set -e

echo "🧪 DiamondScript Gemini Connection Test Suite"
echo "=============================================="
echo ""

# Configuration
SUPABASE_URL="https://wgcunvzrknxqbkdaflil.supabase.co"
SUPABASE_ANON_KEY="sb_publishable_Decb7Q-lz3XQFS8VrxTZGg_jvK49WHt"

# Step 1: Test anonymous authentication
echo "📋 Step 1: Testing Anonymous Authentication"
echo "-------------------------------------------"

AUTH_RESPONSE=$(curl -s -X POST "${SUPABASE_URL}/auth/v1/signup" \
  -H "apikey: ${SUPABASE_ANON_KEY}" \
  -H "Content-Type: application/json" \
  -d "{
    \"options\": {
      \"data\": {}
    }
  }")

TOKEN=$(echo "$AUTH_RESPONSE" | grep -o '"access_token":"[^"]*' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
  echo "❌ FAILED: Could not obtain auth token"
  echo "Response: $AUTH_RESPONSE"
  exit 1
fi

echo "✅ SUCCESS: Auth token obtained"
echo "   Token: ${TOKEN:0:30}..."
echo ""

# Step 2: Test Edge Function with valid request
echo "📋 Step 2: Testing Edge Function (Valid Request)"
echo "------------------------------------------------"

EDGE_RESPONSE=$(curl -s -X POST "${SUPABASE_URL}/functions/v1/generate-practice-plan" \
  -H "Authorization: Bearer $TOKEN" \
  -H "apikey: ${SUPABASE_ANON_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "ageGroup": "10U",
    "experienceLevel": 2,
    "focusArea": "Hitting",
    "duration": 60,
    "intensity": "travel"
  }')

# Check if response contains expected fields
if echo "$EDGE_RESPONSE" | grep -q '"planTitle"'; then
  echo "✅ SUCCESS: Edge Function returned valid practice plan"

  PLAN_TITLE=$(echo "$EDGE_RESPONSE" | grep -o '"planTitle":"[^"]*' | cut -d'"' -f4)
  DURATION=$(echo "$EDGE_RESPONSE" | grep -o '"estimatedDuration":[0-9]*' | cut -d':' -f2)
  SECTIONS=$(echo "$EDGE_RESPONSE" | grep -o '"sections":\[' | wc -l | tr -d ' ')

  echo "   Plan Title: $PLAN_TITLE"
  echo "   Duration: ${DURATION} minutes"
  echo "   Sections: $SECTIONS"
  echo ""
  echo "📝 Full Response (formatted):"
  echo "$EDGE_RESPONSE" | jq '.' 2>/dev/null || echo "$EDGE_RESPONSE"

elif echo "$EDGE_RESPONSE" | grep -q '"error"'; then
  echo "❌ FAILED: Edge Function returned error"
  echo "   Error: $(echo "$EDGE_RESPONSE" | grep -o '"error":"[^"]*' | cut -d'"' -f4)"
  echo ""
  echo "📝 Full Response:"
  echo "$EDGE_RESPONSE" | jq '.' 2>/dev/null || echo "$EDGE_RESPONSE"
  exit 1
else
  echo "❌ FAILED: Unexpected response format"
  echo "   Response: $EDGE_RESPONSE"
  exit 1
fi

echo ""
echo "=============================================="
echo "🎉 ALL TESTS PASSED"
echo "=============================================="
echo ""
echo "✅ Anonymous authentication working"
echo "✅ Edge Function deployed and accessible"
echo "✅ Gemini API responding with valid practice plans"
echo ""
echo "🔍 View Edge Function logs:"
echo "   https://supabase.com/dashboard/project/wgcunvzrknxqbkdaflil/logs/edge-functions"
