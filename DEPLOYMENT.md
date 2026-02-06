# DiamondScript Production Deployment Guide

This guide provides complete instructions for deploying DiamondScript to the App Store and Google Play Store.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Environment Setup](#environment-setup)
- [Building for Production](#building-for-production)
- [iOS Deployment](#ios-deployment)
- [Android Deployment](#android-deployment)
- [Post-Deployment](#post-deployment)
- [Troubleshooting](#troubleshooting)

## Prerequisites

### Required Accounts

1. **Expo Account**: Sign up at https://expo.dev/
2. **Apple Developer Account**: $99/year - https://developer.apple.com/
3. **Google Play Developer Account**: $25 one-time fee - https://play.google.com/console/
4. **Sentry Account** (optional): For crash reporting - https://sentry.io/

### Required Tools

```bash
# Install EAS CLI globally
npm install -g eas-cli

# Login to Expo
eas login

# Verify installation
eas --version
```

## Environment Setup

### 1. Configure Environment Variables

Copy the example environment file and fill in your values:

```bash
cp .env.example .env
```

Edit `.env` with your production values:

```bash
# Production environment
EXPO_PUBLIC_ENV=production

# Sentry DSN (get from https://sentry.io/settings/projects/)
EXPO_PUBLIC_SENTRY_DSN=https://your-sentry-dsn@sentry.io/project-id

# RevenueCat API Key (for subscription management)
EXPO_PUBLIC_REVENUECAT_API_KEY=your_revenuecat_api_key
```

### 2. Set Up EAS Secrets

For sensitive values, use EAS secrets instead of committing them to your repository:

```bash
# Sentry DSN
eas secret:create --scope project --name EXPO_PUBLIC_SENTRY_DSN --value "your-sentry-dsn"

# RevenueCat API Key
eas secret:create --scope project --name EXPO_PUBLIC_REVENUECAT_API_KEY --value "your-api-key"
```

### 3. Initialize EAS Build

```bash
# Initialize EAS project
eas build:configure

# This will:
# - Create an EAS project
# - Generate a project ID
# - Update app.json with the project ID
```

Update the `projectId` in `app.json` with your actual EAS project ID.

## Building for Production

### Generate App Icons (First Time Only)

```bash
# Install dependencies (if not already done)
npm install

# Generate production icons from SVG source
npm run generate-icons
```

This creates:
- `icon.png` (1024x1024) - Main app icon
- `adaptive-icon.png` (1024x1024) - Android adaptive icon
- `splash.png` (1284x2778) - Splash screen
- `favicon.png` (48x48) - Web favicon

### Build for iOS

```bash
# Build for App Store submission
eas build --platform ios --profile production

# Or build for internal testing
eas build --platform ios --profile preview
```

### Build for Android

```bash
# Build AAB for Play Store submission
eas build --platform android --profile production

# Or build APK for testing
eas build --platform android --profile preview
```

### Build for Both Platforms

```bash
# Build for both iOS and Android
eas build --platform all --profile production
```

## iOS Deployment

### 1. Prepare App Store Connect

1. Go to [App Store Connect](https://appstoreconnect.apple.com/)
2. Create a new app:
   - Platform: iOS
   - Name: DiamondScript
   - Primary Language: English
   - Bundle ID: `com.diamondscript.app`
   - SKU: `diamondscript-ios`
3. Fill in app information:
   - Category: Sports
   - Content Rights: Check if you own the rights
4. Prepare screenshots (required sizes):
   - 6.7" (iPhone 14 Pro Max): 1290 x 2796
   - 6.5" (iPhone 11 Pro Max): 1242 x 2688
   - 5.5" (iPhone 8 Plus): 1242 x 2208

### 2. Configure Pricing & Availability

- **Price**: Free (with in-app purchases)
- **Availability**: All territories or specific countries

### 3. Configure In-App Purchases (Pro Subscription)

1. In App Store Connect, go to Features > In-App Purchases
2. Create a new Auto-Renewable Subscription:
   - Product ID: `com.diamondscript.pro.monthly`
   - Reference Name: DiamondScript Pro Monthly
   - Duration: 1 Month
   - Price: $7.99 USD
3. Add localizations and pricing for other regions

### 4. Submit for Review

Update `eas.json` with your App Store Connect credentials:

```json
{
  "submit": {
    "production": {
      "ios": {
        "appleId": "your-apple-id@example.com",
        "ascAppId": "your-app-store-connect-app-id",
        "appleTeamId": "YOUR_TEAM_ID"
      }
    }
  }
}
```

Submit using EAS:

```bash
# Submit latest iOS build to App Store Connect
eas submit --platform ios --profile production

# Or specify a specific build ID
eas submit --platform ios --id YOUR_BUILD_ID
```

### 5. Prepare for Review

Before submitting, ensure:
- [ ] App icons are production-ready (no placeholders)
- [ ] Screenshots uploaded for all required sizes
- [ ] App description is complete and accurate
- [ ] Privacy policy URL is provided
- [ ] Support URL is provided
- [ ] Contact information is current
- [ ] In-app purchases are configured
- [ ] Test account credentials provided (if needed)

## Android Deployment

### 1. Prepare Google Play Console

1. Go to [Google Play Console](https://play.google.com/console/)
2. Create a new app:
   - App name: DiamondScript
   - Default language: English
   - App or game: App
   - Free or paid: Free
3. Complete the store listing:
   - Short description (80 chars max)
   - Full description (4000 chars max)
   - App icon (512 x 512)
   - Feature graphic (1024 x 500)
   - Screenshots (at least 2, up to 8)

### 2. Configure In-App Products

1. In Play Console, go to Monetize > Products > Subscriptions
2. Create a subscription:
   - Product ID: `pro_monthly`
   - Name: DiamondScript Pro
   - Description: Unlock all Pro features
   - Price: $7.99 USD
   - Billing period: Monthly

### 3. Set Up Service Account (for automated submission)

1. In Google Cloud Console, create a service account
2. Download the JSON key file
3. Save it as `google-play-service-account.json` (don't commit to git)
4. In Play Console, grant access to the service account

Update `eas.json`:

```json
{
  "submit": {
    "production": {
      "android": {
        "serviceAccountKeyPath": "./google-play-service-account.json",
        "track": "internal"
      }
    }
  }
}
```

### 4. Submit to Play Store

```bash
# Submit latest Android build
eas submit --platform android --profile production

# Or specify a specific build ID
eas submit --platform android --id YOUR_BUILD_ID
```

### 5. Release Tracks

Google Play has multiple release tracks:
- **Internal testing**: Fast approval, up to 100 testers
- **Closed testing**: Beta testing with specific users
- **Open testing**: Open beta, anyone can join
- **Production**: Public release

Start with internal testing, then gradually promote to production.

## Post-Deployment

### Monitor Crashes with Sentry

1. Verify Sentry is receiving crash reports
2. Set up alerts for critical errors
3. Monitor performance metrics

### Monitor Subscription Health

1. Track subscription conversions
2. Monitor churn rate
3. Analyze upgrade funnel

### Update Checklist for Future Releases

1. Bump version number in `app.json`
2. Increment build numbers:
   - iOS: `buildNumber` in `app.json`
   - Android: `versionCode` in `app.json`
3. Update CHANGELOG.md
4. Run tests: `npm test`
5. Build: `eas build --platform all --profile production`
6. Submit: `eas submit --platform all --profile production`

## Troubleshooting

### Build Failures

**Error: "No valid iOS distribution certificate found"**
```bash
# Clear credentials and regenerate
eas credentials:delete --platform ios
eas build --platform ios --profile production
```

**Error: "Android keystore not found"**
```bash
# Generate new keystore
eas credentials --platform android
```

### Submission Issues

**iOS: "Missing compliance information"**
- In App Store Connect, go to app > App Information
- Set "Export Compliance" to "No" (DiamondScript doesn't use encryption)

**Android: "Version code already exists"**
- Increment `versionCode` in `app.json`
- Rebuild: `eas build --platform android --profile production`

### Runtime Issues

**Sentry not receiving crashes**
- Verify `EXPO_PUBLIC_SENTRY_DSN` is set correctly
- Check that `config.enableCrashReporting` is true in production
- Ensure app is built with production profile

**Subscription not working**
- Verify RevenueCat API key is correct
- Check that in-app products are configured
- Ensure subscription service is properly integrated

## Support

- Expo Documentation: https://docs.expo.dev/
- EAS Build Docs: https://docs.expo.dev/build/introduction/
- App Store Review Guidelines: https://developer.apple.com/app-store/review/guidelines/
- Play Store Policies: https://play.google.com/about/developer-content-policy/

## Security Checklist

- [ ] No hardcoded API keys in source code
- [ ] All secrets stored in EAS secrets or environment variables
- [ ] `.env` file is in `.gitignore`
- [ ] Service account JSON is in `.gitignore`
- [ ] Sentry DSN is configured for production
- [ ] Error messages don't expose sensitive information
- [ ] User data is handled according to privacy policy

---

**Ready to deploy?** Follow this guide step-by-step, and you'll have DiamondScript live on both app stores!

For questions or issues, refer to the [Expo Discord community](https://discord.gg/expo) or [GitHub Issues](https://github.com/your-repo/issues).
