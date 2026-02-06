#!/usr/bin/env node

/**
 * Generate production-ready app icons from SVG source
 * Requires: npm install --save-dev sharp
 */

const fs = require('fs');
const path = require('path');

async function generateIcons() {
  try {
    const sharp = require('sharp');

    const svgPath = path.join(__dirname, '../assets/icon-source.svg');
    const svgBuffer = fs.readFileSync(svgPath);

    console.log('🎨 Generating production app icons...\n');

    // Generate standard app icon (1024x1024)
    await sharp(svgBuffer)
      .resize(1024, 1024)
      .png()
      .toFile(path.join(__dirname, '../assets/icon.png'));
    console.log('✓ Created icon.png (1024x1024)');

    // Generate adaptive icon (1024x1024)
    await sharp(svgBuffer)
      .resize(1024, 1024)
      .png()
      .toFile(path.join(__dirname, '../assets/adaptive-icon.png'));
    console.log('✓ Created adaptive-icon.png (1024x1024)');

    // Generate favicon (48x48 for web)
    await sharp(svgBuffer)
      .resize(48, 48)
      .png()
      .toFile(path.join(__dirname, '../assets/favicon.png'));
    console.log('✓ Created favicon.png (48x48)');

    // Generate splash screen (1284x2778 - iPhone 14 Pro Max)
    const splashSvgPath = path.join(__dirname, '../assets/splash-source.svg');
    const splashSvgBuffer = fs.readFileSync(splashSvgPath);
    await sharp(splashSvgBuffer)
      .resize(1284, 2778)
      .png()
      .toFile(path.join(__dirname, '../assets/splash.png'));
    console.log('✓ Created splash.png (1284x2778)');

    console.log('\n✨ All assets generated successfully!');
    console.log('\nNext steps:');
    console.log('1. Run: npx expo prebuild --clean');
    console.log('2. Verify icons in assets/ directory');
    console.log('3. Test on device: npx expo run:ios or npx expo run:android');

  } catch (error) {
    if (error.code === 'MODULE_NOT_FOUND') {
      console.error('❌ Error: sharp module not found');
      console.error('\nPlease install required dependency:');
      console.error('  npm install --save-dev sharp');
      console.error('\nThen run this script again:');
      console.error('  npm run generate-icons');
      process.exit(1);
    }
    throw error;
  }
}

generateIcons().catch(error => {
  console.error('❌ Icon generation failed:', error.message);
  process.exit(1);
});
