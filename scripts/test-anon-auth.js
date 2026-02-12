#!/usr/bin/env node
/**
 * Test Anonymous Authentication
 * Verifies that anonymous sign-in is enabled in Supabase
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

console.log('🔍 Testing Anonymous Authentication\n');

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('❌ Missing environment variables');
  process.exit(1);
}

async function testAnonAuth() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  console.log('📍 Supabase URL:', SUPABASE_URL);
  console.log('🔑 Anon Key:', SUPABASE_ANON_KEY.substring(0, 20) + '...\n');

  // Test 1: Try to sign in anonymously
  console.log('Test 1: Anonymous sign-in...');
  try {
    const { data, error } = await supabase.auth.signInAnonymously();

    if (error) {
      console.error('   ❌ Anonymous sign-in failed:', error.message);
      console.error('   Error code:', error.status);
      console.error('\n🚨 ISSUE: Anonymous authentication is NOT enabled in Supabase Dashboard');
      console.error('\n📋 TO FIX:');
      console.error('   1. Go to Supabase Dashboard → Authentication → Providers');
      console.error('   2. Find "Anonymous" provider');
      console.error('   3. Toggle it ON');
      console.error('   4. Save changes\n');
      return false;
    }

    if (data.session) {
      console.log('   ✅ Anonymous sign-in successful!');
      console.log('   Session token:', data.session.access_token.substring(0, 20) + '...');
      console.log('   User ID:', data.user?.id);
      console.log('\n✅ Anonymous authentication is ENABLED and working!\n');

      // Test 2: Try calling Edge Function with this token
      console.log('Test 2: Calling Edge Function with auth token...');
      const { data: functionData, error: functionError } = await supabase.functions.invoke('generate-practice-plan', {
        body: {
          ageGroup: '10U',
          experienceLevel: 2,
          focusArea: 'Hitting',
          duration: 60,
          intensity: 'rec',
        },
      });

      if (functionError) {
        console.error('   ❌ Edge Function error:', functionError.message);
        console.error('\n⚠️  Possible issues:');
        console.error('   - GEMINI_API_KEY not set in Supabase Secrets');
        console.error('   - Edge Function has internal errors');
        return false;
      }

      if (functionData && functionData.planTitle) {
        console.log('   ✅ Edge Function call successful!');
        console.log('   Plan title:', functionData.planTitle);
        console.log('   Sections:', functionData.sections?.length);
        console.log('\n🎉 FULL INTEGRATION VERIFIED!\n');
        return true;
      }

      console.log('   ⚠️  Edge Function returned data but no planTitle');
      console.log('   Response:', JSON.stringify(functionData, null, 2));
      return false;

    } else {
      console.error('   ❌ No session returned from sign-in');
      return false;
    }

  } catch (error) {
    console.error('   ❌ Unexpected error:', error.message);
    return false;
  }
}

testAnonAuth().then(success => {
  if (success) {
    console.log('✅ All tests passed!\n');
    process.exit(0);
  } else {
    console.log('❌ Tests failed\n');
    process.exit(1);
  }
});
