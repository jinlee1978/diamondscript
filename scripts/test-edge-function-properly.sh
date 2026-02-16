#!/bin/bash
# Test Edge Function with proper anonymous auth

SUPABASE_URL="https://wgcunvzrknxqbkdaflil.supabase.co"
ANON_KEY="sb_publishable_Decb7Q-lz3XQFS8VrxTZGg_jvK49WHt"

echo "🧪 Testing Edge Function with Anonymous Auth"
echo "=============================================="
echo ""

# Step 1: Create anonymous user
echo "📋 Step 1: Creating anonymous user session..."
AUTH_RESPONSE=$(curl -s -X POST "${SUPABASE_URL}/auth/v1/signup" \
  -H "apikey: ${ANON_KEY}" \
  -H "Content-Type: application/json" \
  -d '{}')

# Extract access token
TOKEN=$(echo "$AUTH_RESPONSE" | jq -r '.access_token // empty')

if [ -z "$TOKEN" ]; then
  echo "❌ FAILED: Could not get anonymous token"
  echo "Response:"
  echo "$AUTH_RESPONSE" | jq '.'
  exit 1
fi

echo "✅ Got anonymous token: ${TOKEN:0:30}..."
echo ""

# Step 2: Test Edge Function
echo "📋 Step 2: Testing Edge Function..."
EDGE_RESPONSE=$(curl -s -X POST "${SUPABASE_URL}/functions/v1/generate-practice-plan" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "apikey: ${ANON_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "ageGroup": "10U",
    "experienceLevel": 2,
    "focusArea": "Hitting",
    "duration": 60,
    "intensity": "travel"
  }')

# Check response
if echo "$EDGE_RESPONSE" | jq -e '.planTitle' > /dev/null 2>&1; then
  echo "✅ SUCCESS: Edge Function returned practice plan!"
  echo ""
  echo "Plan Title: $(echo "$EDGE_RESPONSE" | jq -r '.planTitle')"
  echo "Duration: $(echo "$EDGE_RESPONSE" | jq -r '.estimatedDuration') minutes"
  echo "Sections: $(echo "$EDGE_RESPONSE" | jq '.sections | length')"
  echo ""
  echo "Full response:"
  echo "$EDGE_RESPONSE" | jq '.'
elif echo "$EDGE_RESPONSE" | jq -e '.error' > /dev/null 2>&1; then
  echo "❌ FAILED: Edge Function returned error"
  echo ""
  echo "$EDGE_RESPONSE" | jq '.'
else
  echo "❌ FAILED: Unexpected response"
  echo ""
  echo "$EDGE_RESPONSE"
fi

echo ""
echo "📊 Check detailed logs:"
echo "https://supabase.com/dashboard/project/wgcunvzrknxqbkdaflil/logs/edge-functions"
