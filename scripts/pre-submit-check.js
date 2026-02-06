#!/usr/bin/env node

/**
 * Pre-submission checklist validator
 * Run this before submitting to app stores to ensure everything is ready
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🔍 DiamondScript Pre-Submission Check\n');

const checks = [];
let allPassed = true;

function check(name, test, suggestion) {
  try {
    const result = test();
    checks.push({ name, passed: result, suggestion });
    if (!result) allPassed = false;
    return result;
  } catch (error) {
    checks.push({ name, passed: false, suggestion: suggestion || error.message });
    allPassed = false;
    return false;
  }
}

// Check 1: Production icons exist and are properly sized
check(
  'Production app icons',
  () => {
    const iconPath = path.join(__dirname, '../assets/icon.png');
    const splashPath = path.join(__dirname, '../assets/splash.png');
    const adaptivePath = path.join(__dirname, '../assets/adaptive-icon.png');

    if (!fs.existsSync(iconPath)) return false;
    if (!fs.existsSync(splashPath)) return false;
    if (!fs.existsSync(adaptivePath)) return false;

    const iconSize = fs.statSync(iconPath).size;
    const splashSize = fs.statSync(splashPath).size;

    // Icons should be > 10KB (not placeholders)
    return iconSize > 10000 && splashSize > 10000;
  },
  'Run: npm run generate-icons'
);

// Check 2: .env file exists
check(
  'Environment file (.env)',
  () => {
    const envPath = path.join(__dirname, '../.env');
    return fs.existsSync(envPath);
  },
  'Copy .env.example to .env'
);

// Check 3: TypeScript compiles without errors
check(
  'TypeScript compilation',
  () => {
    try {
      execSync('npx tsc --noEmit', { stdio: 'pipe' });
      return true;
    } catch {
      return false;
    }
  },
  'Fix TypeScript errors: npm run build'
);

// Check 4: All tests pass
check(
  'Test suite',
  () => {
    try {
      execSync('npm test -- --passWithNoTests', { stdio: 'pipe' });
      return true;
    } catch {
      return false;
    }
  },
  'Fix failing tests: npm test'
);

// Check 5: package.json has correct name and version
check(
  'Package metadata',
  () => {
    const pkgPath = path.join(__dirname, '../package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    return pkg.name === 'diamondscript' && pkg.version;
  },
  'Check package.json name and version'
);

// Check 6: app.json has bundle identifiers
check(
  'Bundle identifiers',
  () => {
    const appJsonPath = path.join(__dirname, '../app.json');
    const appJson = JSON.parse(fs.readFileSync(appJsonPath, 'utf8'));
    return appJson.expo.ios?.bundleIdentifier && appJson.expo.android?.package;
  },
  'Check app.json for bundle IDs'
);

// Check 7: EAS configuration exists
check(
  'EAS Build configuration',
  () => {
    const easPath = path.join(__dirname, '../eas.json');
    return fs.existsSync(easPath);
  },
  'File eas.json should exist'
);

// Check 8: Git repository is clean (optional warning)
check(
  'Git status (optional)',
  () => {
    try {
      const status = execSync('git status --porcelain', { stdio: 'pipe' }).toString();
      return status.trim().length === 0;
    } catch {
      return true; // Not a git repo is fine
    }
  },
  'Consider committing changes before building'
);

// Print results
console.log('═══════════════════════════════════════════════════\n');

checks.forEach(({ name, passed, suggestion }) => {
  const icon = passed ? '✅' : '❌';
  console.log(`${icon} ${name}`);
  if (!passed && suggestion) {
    console.log(`   → ${suggestion}`);
  }
});

console.log('\n═══════════════════════════════════════════════════\n');

if (allPassed) {
  console.log('🎉 All checks passed! You\'re ready to build.');
  console.log('\nNext steps:');
  console.log('1. eas login');
  console.log('2. eas build:configure');
  console.log('3. eas build --platform all --profile production');
  console.log('\nSee SUBMIT_TO_STORES.md for detailed instructions.');
  process.exit(0);
} else {
  console.log('⚠️  Some checks failed. Please fix the issues above.');
  console.log('\nSee SUBMIT_TO_STORES.md for help.');
  process.exit(1);
}
