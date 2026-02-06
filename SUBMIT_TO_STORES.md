# DiamondScript - Your Submission Checklist

Everything is ready! Follow these steps to get DiamondScript into the App Store and Google Play Store.

---

## ✅ What's Already Done

- [x] Production app icons and splash screen
- [x] All code tested (36/36 tests passing)
- [x] TypeScript compilation validated (0 errors)
- [x] Error handling and crash reporting configured
- [x] Subscription architecture ready
- [x] Build configuration (eas.json) complete
- [x] Environment variables template (.env) created
- [x] Comprehensive documentation written

---

## 🎯 What You Need to Do

### Step 1: Create Developer Accounts (30 minutes)

#### Apple Developer Account
1. Go to https://developer.apple.com/programs/enroll/
2. Click "Start Your Enrollment"
3. Cost: **$99/year**
4. Approval time: Usually 24-48 hours

#### Google Play Developer Account
1. Go to https://play.google.com/console/signup
2. Pay registration fee: **$25 one-time**
3. Approval time: Usually instant to 48 hours

**⏸️ PAUSE HERE** - Wait for account approvals before continuing

---

### Step 2: Set Up Expo Account & EAS Build (10 minutes)

```bash
# 1. Install EAS CLI (if not already installed)
npm install -g eas-cli

# 2. Login to Expo (create free account if needed)
eas login

# 3. Configure your project with EAS
eas build:configure
```

When prompted:
- Would you like to create a new project? → **Yes**
- Select platforms → **iOS and Android**

This will:
- Create an Expo account project
- Generate a project ID
- Update your app.json automatically

---

### Step 3: Create Sentry Project (5 minutes) - OPTIONAL

Sentry is for crash reporting. You can skip this initially and add it later.

1. Go to https://sentry.io/signup/
2. Create a free account
3. Create new project:
   - Platform: **React Native**
   - Project name: **DiamondScript**
4. Copy your DSN (looks like: `https://xxx@xxx.ingest.sentry.io/xxx`)
5. Add to your EAS secrets:
   ```bash
   eas secret:create --scope project --name EXPO_PUBLIC_SENTRY_DSN --value "your-dsn-here"
   ```

**💡 TIP**: You can skip Sentry for your first build and add it later.

---

### Step 4: Build for Both Platforms (20 minutes)

```bash
# This runs in the cloud and takes about 15-20 minutes
eas build --platform all --profile production
```

You'll get two build IDs:
- One for iOS (an .ipa file)
- One for Android (an .aab file)

EAS will email you when builds complete. ☕ Take a break!

---

### Step 5: Create App in App Store Connect (15 minutes)

1. Go to https://appstoreconnect.apple.com/
2. Click **"My Apps"** → **"+"** → **"New App"**
3. Fill in:
   - **Platform**: iOS
   - **Name**: DiamondScript
   - **Primary Language**: English (U.S.)
   - **Bundle ID**: com.diamondscript.app (select from dropdown)
   - **SKU**: diamondscript-ios
   - **User Access**: Full Access
4. Click **"Create"**

#### Configure App Information
1. Go to **App Information** section:
   - **Category**: Primary → **Sports**
   - **Content Rights**: Check the box

2. Go to **Pricing and Availability**:
   - **Price**: Free
   - **Availability**: Select countries (or "All" for worldwide)

#### Configure In-App Purchase
1. Go to **Features** → **In-App Purchases**
2. Click **"+"** → **Auto-Renewable Subscription**
3. Fill in:
   - **Reference Name**: DiamondScript Pro Monthly
   - **Product ID**: com.diamondscript.pro.monthly
   - **Subscription Group**: Create new → "DiamondScript Pro"
4. Click **"Create"**
5. Configure subscription details:
   - **Duration**: 1 Month
   - **Price**: Select **$7.99 USD** (Tier 8)
6. Add **Localizations**:
   - **Subscription Display Name**: DiamondScript Pro
   - **Description**: Unlock custom intensity, station splitting, unlimited history, and full drill catalog access.
7. Click **"Save"**

---

### Step 6: Prepare App Store Listing (20 minutes)

You'll need to prepare:

#### 1. Screenshots (REQUIRED)
You need screenshots of your app running. Here's how:

**On iPhone Simulator:**
```bash
# Start the app
npx expo start

# Press 'i' to open iOS simulator
# Take screenshots: Cmd + S
```

Required sizes:
- **6.7" Display** (1290 x 2796): iPhone 14 Pro Max
- **6.5" Display** (1242 x 2688): iPhone 11 Pro Max
- **5.5" Display** (1242 x 2208): iPhone 8 Plus

Take screenshots of:
1. Home screen with diamond logo
2. Setup screen with age group picker
3. Generated practice with drills
4. My Drills screen
5. Upgrade screen (optional)

#### 2. App Description
```
DiamondScript generates custom baseball practice plans tailored to your team's age, experience, and intensity level. Perfect for youth coaches managing T-Ball through 14U teams.

FEATURES:
• Smart practice plan generator
• 48+ professional drills with equipment lists
• Age-specific content (T-Ball, 8U, 10U, 12U, 14U)
• Station-based practice layouts
• Save and reuse favorite drills
• Practice history tracking

PRO FEATURES:
• Custom intensity control (1-5)
• Parallel station splitting with assistant coaches
• Unlimited practice history
• Full access to drill catalog

Perfect for volunteer coaches, travel ball teams, and recreation leagues. Generate a complete practice plan in seconds, then focus on coaching your team.
```

#### 3. Keywords
```
baseball,coaching,youth sports,practice plans,drills,softball,t-ball,little league
```

#### 4. Support URL
You'll need a support page. Options:
- Create a simple website: diamondscript.com/support
- Use GitHub Pages: your-repo/issues
- Use a Google Form for support requests

#### 5. Privacy Policy URL
You'll need a privacy policy. Since you don't collect personal data yet:
- Use a free generator: https://www.privacypolicygenerator.info/
- Or use a simple template and host on GitHub Pages

**💡 TIP**: Create a simple website with both support and privacy pages.

---

### Step 7: Submit iOS Build to App Store (10 minutes)

```bash
# Submit your iOS build
eas submit --platform ios --profile production

# Or if you want to specify the build:
eas submit --platform ios --id YOUR_BUILD_ID
```

When prompted, provide:
- **Apple ID**: Your Apple Developer account email
- **App-specific password**: Create one at appleid.apple.com

The build will upload to App Store Connect automatically.

#### Complete the Submission
1. Go back to App Store Connect
2. Select your app → **App Store** tab
3. Click **"+ VERSION"** or select your version
4. Upload your screenshots
5. Enter your app description
6. Set **Age Rating** (complete questionnaire - likely 4+)
7. Add **Privacy Policy URL**
8. Add **Support URL**
9. Set **App Review Information**:
   - **First Name**, **Last Name**, **Phone**, **Email**
   - **Sign-in required**: No
10. Click **"Add for Review"**
11. Click **"Submit to App Review"**

**⏰ Review Time**: Typically 24-48 hours

---

### Step 8: Create App in Google Play Console (15 minutes)

1. Go to https://play.google.com/console/
2. Click **"Create app"**
3. Fill in:
   - **App name**: DiamondScript
   - **Default language**: English (United States)
   - **App or game**: App
   - **Free or paid**: Free
4. Accept declarations
5. Click **"Create app"**

#### Set Up Store Listing
1. Go to **Store presence** → **Main store listing**
2. Fill in:

**Short description** (80 chars max):
```
Generate custom baseball practice plans for youth teams
```

**Full description** (4000 chars max):
```
DiamondScript is the ultimate practice planning tool for youth baseball coaches. Generate custom, station-based practice plans in seconds, tailored to your team's age group and skill level.

FEATURES:
✓ Smart practice generator
✓ 48+ professional drills
✓ Age-specific content (T-Ball through 14U)
✓ Station-based practice layouts
✓ Equipment lists for each drill
✓ Save favorite drills
✓ Practice history tracking

PRO FEATURES:
✓ Custom intensity control (1-5)
✓ Parallel station splitting
✓ Unlimited practice history
✓ Full drill catalog access

Perfect for volunteer coaches, travel ball teams, and recreation leagues. DiamondScript takes the guesswork out of practice planning so you can focus on what matters - coaching your team.

Whether you're managing a T-Ball team learning the basics or a 14U competitive squad, DiamondScript generates age-appropriate drills and optimal practice structures. No more scrambling the night before practice!
```

3. Upload assets:
   - **App icon**: Use assets/icon.png (512x512)
   - **Feature graphic**: You'll need to create this (1024 x 500)
   - **Screenshots**: Take Android screenshots (1080 x 1920 or similar)

4. **Categorization**:
   - **App category**: Sports
   - **Tags**: baseball, coaching, sports

---

### Step 9: Configure Android In-App Product (10 minutes)

1. Go to **Monetize** → **Products** → **Subscriptions**
2. Click **"Create subscription"**
3. Fill in:
   - **Product ID**: pro_monthly
   - **Name**: DiamondScript Pro
   - **Description**: Unlock all Pro features including custom intensity, station splitting, unlimited history, and full drill catalog.
   - **Billing period**: Monthly
   - **Price**: $7.99 USD
   - **Free trial**: Optional (e.g., 7 days)
4. Click **"Save"** → **"Activate"**

---

### Step 10: Submit Android Build (10 minutes)

```bash
# Submit your Android build
eas submit --platform android --profile production
```

This uploads your .aab file to Google Play Console.

#### Create a Release
1. Go back to Play Console
2. Go to **Release** → **Production**
3. Click **"Create new release"**
4. Your build should appear automatically
5. Add **Release notes**:
   ```
   Initial release of DiamondScript!

   • Generate custom practice plans
   • 48+ professional drills
   • Age-specific content (T-Ball - 14U)
   • Save favorite drills
   • Track practice history
   ```
6. Review and click **"Review release"**
7. Click **"Start rollout to Production"**

**⏰ Review Time**: 1-7 days (usually 2-3 days)

---

## 🎉 You're Done!

Both apps are now submitted for review. You'll receive emails when:
1. Apps are approved (celebrate! 🎊)
2. Apps are rejected (rare, but fix issues and resubmit)

---

## 📱 After Approval

### Monitor Your Apps
- Check Sentry for crashes (if configured)
- Respond to reviews within 24-48 hours
- Monitor subscription conversions

### Marketing
- Share on social media
- Create a landing page
- Reach out to baseball coaching communities
- Consider TestFlight beta for early feedback

---

## 🆘 If You Get Stuck

**Common Issues:**

1. **"Export Compliance" in App Store Connect**
   - Go to App Information
   - Set "Uses Encryption" → No
   - DiamondScript doesn't use encryption

2. **Build Fails**
   ```bash
   # Clear credentials and retry
   eas credentials
   eas build --platform ios --profile production --clear-cache
   ```

3. **Screenshots Wrong Size**
   - Use Xcode Simulator: File → New Simulator
   - Or use Android Studio AVD Manager

4. **Privacy Policy Required**
   - Create a simple page with template
   - Host on GitHub Pages (free)
   - Or use notion.so/yourpage

---

## 📞 Need Help?

- **Expo Documentation**: https://docs.expo.dev/
- **Expo Discord**: https://discord.gg/expo
- **Review Guidelines**:
  - iOS: https://developer.apple.com/app-store/review/guidelines/
  - Android: https://play.google.com/about/developer-content-policy/

---

**Good luck! You've got this! 🚀⚾**

The hardest part is done - the app is built and ready. The submission process is just form-filling and waiting for approval. Most apps get approved on the first try if you follow the guidelines above.
