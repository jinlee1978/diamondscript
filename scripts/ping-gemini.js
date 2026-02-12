#!/usr/bin/env node
/**
 * Ping Test for 2026 Gemini Models
 * Tests connection with current model aliases
 */

require('dotenv').config();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

console.log('🏓 Gemini Model Ping Test (2026)\n');

if (!GEMINI_API_KEY) {
  console.error('❌ Missing GEMINI_API_KEY');
  process.exit(1);
}

async function pingModel(modelName) {
  try {
    console.log(`📡 Pinging: ${modelName}...`);

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': GEMINI_API_KEY
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: 'Connection Test' }] }],
        }),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      console.log(`   ❌ ${response.status}: ${error.error?.message || 'Failed'}`);
      return null;
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (text) {
      console.log(`   ✅ SUCCESS! Response: "${text.substring(0, 50)}..."`);
      return modelName;
    }

    console.log('   ❌ No response text');
    return null;

  } catch (error) {
    console.log(`   ❌ Error: ${error.message}`);
    return null;
  }
}

async function runPingTest() {
  // Test models in priority order
  const models = [
    'gemini-3-flash-preview',    // Primary: Current 2026 flash alias
    'gemini-2.5-flash',          // Fallback: Stable 2.5 version
    'gemini-1.5-flash',          // Legacy: May still work
  ];

  console.log(`Testing ${models.length} model aliases...\n`);

  for (const model of models) {
    const success = await pingModel(model);
    if (success) {
      console.log(`\n🎯 Working Model Found: "${success}"`);
      console.log(`💡 Use this in your Edge Function\n`);
      return success;
    }
  }

  console.error('\n❌ All models failed. Check API key permissions.\n');
  process.exit(1);
}

runPingTest();
