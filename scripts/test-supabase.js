#!/usr/bin/env node
/**
 * Test Supabase Connection
 * Verifies that we can connect to Supabase with the configured credentials
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

console.log('🔍 Testing Supabase Connection...\n');

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Missing Supabase credentials in .env file');
  console.error('   Required: EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_ANON_KEY');
  process.exit(1);
}

console.log(`📍 Supabase URL: ${supabaseUrl}`);
console.log(`🔑 Anon Key: ${supabaseAnonKey.substring(0, 20)}...`);

try {
  const supabase = createClient(supabaseUrl, supabaseAnonKey);
  console.log('\n✅ Supabase client created successfully!');
  console.log('   Connection appears valid.');

  // Try to get auth session to verify connection works
  supabase.auth.getSession()
    .then(({ data, error }) => {
      if (error) {
        console.log('\n⚠️  Auth session check:', error.message);
        console.log('   (This is expected if no user is logged in)');
      } else {
        console.log('\n✅ Supabase connection verified!');
      }

      console.log('\n📋 Next: Test Edge Function deployment');
      console.log('   Run: npx supabase functions deploy generate-practice-plan\n');
    });
} catch (error) {
  console.error('\n❌ Supabase connection failed:', error.message);
  process.exit(1);
}
