#!/usr/bin/env node
/**
 * Direct HTTP Test for Edge Function
 * Tests the Edge Function via direct HTTP call to see actual response
 */

require('dotenv').config();

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

console.log('🔍 Direct Edge Function HTTP Test\n');

async function testDirect() {
  const functionUrl = `${SUPABASE_URL}/functions/v1/generate-practice-plan`;

  console.log(`📡 Calling: ${functionUrl}\n`);

  // Test 1: Without authentication (should return 401)
  console.log('Test 1: Unauthenticated request (expect 401)');
  try {
    const response = await fetch(functionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({
        ageGroup: '10U',
        experienceLevel: 2,
        focusArea: 'Hitting',
        duration: 60,
        intensity: 'rec',
      }),
    });

    console.log(`   Status: ${response.status}`);
    console.log(`   Status Text: ${response.statusText}`);

    const responseText = await response.text();
    console.log(`   Response: ${responseText}\n`);

    if (response.status === 401) {
      console.log('✅ Authentication is enforced correctly!\n');

      // Try to parse error response
      try {
        const errorData = JSON.parse(responseText);
        // Check for Supabase platform auth error OR Edge Function auth error
        if (
          (errorData.code === 401) ||
          (errorData.message && (errorData.message.includes('authorization') || errorData.message.includes('Authentication'))) ||
          (errorData.error && errorData.error.includes('Authentication'))
        ) {
          console.log('✅ Edge Function security verified:');
          console.log('   - Function is deployed');
          console.log('   - Authentication enforced (Supabase platform or Edge Function)');
          console.log('   - Returns proper 401 for unauthenticated requests');
          console.log(`   - Response: ${responseText}\n`);
          return true;
        }
      } catch (e) {
        // Not JSON, but 401 status is still good
        console.log('✅ Edge Function returns 401 (authentication enforced)\n');
        return true;
      }
    } else if (response.status === 200) {
      console.log('⚠️  Warning: Function accepted unauthenticated request');
      console.log('   Authentication check may not be working correctly\n');
      return false;
    } else {
      console.log(`⚠️  Unexpected status: ${response.status}`);
      return false;
    }

  } catch (error) {
    console.error('   ❌ Error:', error.message);
    return false;
  }
}

testDirect().then(success => {
  if (success) {
    console.log('🎉 Edge Function Security Verified!\n');
    process.exit(0);
  } else {
    console.log('❌ Security verification failed\n');
    process.exit(1);
  }
});
