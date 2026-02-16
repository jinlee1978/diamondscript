#!/bin/bash

# DiamondScript Edge Function Deployment Script
# BUILD 67: Code-Level Security with Gateway JWT Bypass

set -e  # Exit on error

echo "🚀 Deploying Edge Function: generate-practice-plan"
echo ""
echo "BUILD 67 Security Model:"
echo "  ✓ Gateway JWT verification: DISABLED (--no-verify-jwt)"
echo "  ✓ Code-level JWT verification: ENABLED (manual)"
echo "  ✓ Why: Bypasses gateway auth metadata issues"
echo ""

# Deploy with --no-verify-jwt flag to bypass gateway authentication
# JWT verification is handled manually in index.ts (lines 99-159)
npx supabase functions deploy generate-practice-plan --no-verify-jwt

echo ""
echo "✅ Deployment complete!"
echo ""
echo "Test the deployment:"
echo "  1. Open DiamondScript app"
echo "  2. Navigate to AI Lab"
echo "  3. Generate a practice plan"
echo "  4. Check Supabase logs for '✅ JWT Verification Successful'"
echo ""
echo "Monitor logs:"
echo "  Supabase Dashboard → Edge Functions → generate-practice-plan → Logs"
echo ""
