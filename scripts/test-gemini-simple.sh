#!/bin/bash
# Simple Gemini Connection Test (using service role key for quick testing)

SUPABASE_URL="https://wgcunvzrknxqbkdaflil.supabase.co"
SERVICE_ROLE_KEY="SUPABASE_KEY="YOUR_KEY_HERE""

echo "🧪 Testing Gemini Edge Function (Service Role)"
echo "=============================================="
echo ""

RESPONSE=$(curl -s -X POST "${SUPABASE_URL}/functions/v1/generate-practice-plan" \
  -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" \
  -H "apikey: ${SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "ageGroup": "10U",
    "experienceLevel": 2,
    "focusArea": "Hitting",
    "duration": 60,
    "intensity": "travel"
  }')

if echo "$RESPONSE" | grep -q '"planTitle"'; then
  echo "✅ SUCCESS: Edge Function working!"
  echo ""
  echo "$RESPONSE" | jq '.'
else
  echo "❌ FAILED"
  echo "$RESPONSE"
fi
