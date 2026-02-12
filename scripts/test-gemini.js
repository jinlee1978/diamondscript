#!/usr/bin/env node
/**
 * Test Gemini API Connection
 * Verifies that we can connect to Google's Gemini API
 */

require('dotenv').config();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

console.log('🤖 Testing Gemini API Connection...\n');

if (!GEMINI_API_KEY) {
  console.error('❌ Missing GEMINI_API_KEY in .env file');
  process.exit(1);
}

console.log(`🔑 API Key: ${GEMINI_API_KEY.substring(0, 20)}...`);

// Test prompt
const testPrompt = 'You are a baseball coach. List 3 simple warmup drills for 10U players in JSON format with this structure: {"drills": [{"name": "drill name", "description": "brief description"}]}. Return ONLY valid JSON.';

async function testGemini() {
  // 2026 stable model aliases
  const modelsToTry = [
    'gemini-3-flash-preview',    // Primary: Current 2026 flash alias
    'gemini-2.5-flash',          // Fallback: Stable 2.5 version
  ];

  for (const model of modelsToTry) {
    try {
      console.log(`\n📡 Trying model: ${model}...`);

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': GEMINI_API_KEY
          },
          body: JSON.stringify({
            contents: [{ parts: [{ text: testPrompt }] }],
            generationConfig: {
              temperature: 0.7,
              maxOutputTokens: 500,
            },
          }),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.log(`   ❌ Failed (${response.status})`);
        continue; // Try next model
      }

      const data = await response.json();
      const generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!generatedText) {
        console.log('   ❌ No content generated');
        continue; // Try next model
      }

      console.log(`   ✅ Success with model: ${model}`);
      console.log('\n📋 Sample Response:');
      console.log(generatedText);

      // Try to parse as JSON
      try {
        const jsonMatch = generatedText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          console.log('\n✅ JSON parsing successful!');
          console.log('Drills returned:', parsed.drills?.length || 0);
        }
      } catch (e) {
        console.log('\n⚠️  Response is not valid JSON (AI may include extra text)');
      }

      console.log('\n🎉 Gemini API connection verified!');
      console.log(`💡 Use model: "${model}" in your Edge Function\n`);
      return; // Success - exit

    } catch (error) {
      console.log(`   ❌ Error: ${error.message}`);
      continue; // Try next model
    }
  }

  // If we get here, all models failed
  console.error('\n❌ All model attempts failed. Check your API key.');
  process.exit(1);
}

testGemini();
