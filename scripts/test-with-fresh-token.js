#!/usr/bin/env node
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
);

async function test() {
  console.log('🔍 Testing Edge Function with fresh auth token\n');

  // Sign in anonymously
  const { data: authData, error: authError } = await supabase.auth.signInAnonymously();

  if (authError) {
    console.error('❌ Auth failed:', authError.message);
    return;
  }

  console.log('✅ Got fresh token');
  console.log('   User ID:', authData.user.id);
  console.log('   Token:', authData.session.access_token.substring(0, 30) + '...\n');

  // Call Edge Function
  console.log('📡 Calling Edge Function...');
  const { data, error } = await supabase.functions.invoke('generate-practice-plan', {
    body: {
      ageGroup: '10U',
      experienceLevel: 2,
      focusArea: 'Hitting',
      duration: 60,
      intensity: 'rec',
    },
  });

  if (error) {
    console.error('❌ Error:', error);
    console.error('   Name:', error.name);
    console.error('   Message:', error.message);
    console.error('   Context:', error.context);

    // Check if it's a GEMINI_API_KEY issue
    if (error.message && error.message.includes('GEMINI_API_KEY')) {
      console.error('\n🚨 GEMINI_API_KEY is not set in Supabase Secrets!');
      console.error('\n📋 TO FIX:');
      console.error('   supabase secrets set GEMINI_API_KEY=your_key --project-ref wgcunvzrknxqbkdaflil\n');
    }
    return;
  }

  console.log('✅ Success!');
  console.log('   Plan Title:', data.planTitle);
  console.log('   Duration:', data.estimatedDuration, 'minutes');
  console.log('   Sections:', data.sections?.length);
  console.log('\n🎉 FULL INTEGRATION WORKING!\n');
}

test();
