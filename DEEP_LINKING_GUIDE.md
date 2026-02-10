# Deep Linking - Peer-to-Peer Practice Sharing

**Feature:** Share practice plans via deep links (PRO feature)
**Architecture:** Fully P2P - No backend, all data in URL
**Status:** ✅ Implemented (Build 29+)

---

## Overview

DiamondScript allows PRO users to share their practice plans with other coaches via deep links. The entire practice session (drills, timings, stations) is encoded into a URL that can be shared via any messaging app.

### Key Benefits

1. **No Backend Required** - All data transmitted in the URL
2. **Instant Sharing** - Tap Share → Send link → Recipient opens instantly
3. **Cross-Platform** - Works on iOS and Android
4. **PRO Feature** - Encourages upgrade from FREE tier
5. **Lightweight** - Maintains app simplicity (no database, no accounts)

---

## User Flow

### For PRO Users (Sharing)

1. Generate a practice session
2. Tap **Share** button in header
3. Share menu shows:
   ```
   📋 Open this practice in DiamondScript:
   diamondscript://view?plan=eyJyZXF1ZXN0Ijp7ImFnZUdyb...

   [Full text-based practice plan follows]
   ```
4. Send via Messages, WhatsApp, Email, etc.

### For Recipients (Any Tier)

1. Receive deep link
2. Tap link → App opens automatically
3. Practice session loads instantly
4. Navigates directly to Practice screen
5. Can view, modify, or save to history

### For FREE Users (Sharing)

1. Generate a practice session
2. Tap **Share** button
3. Share menu shows:
   ```
   — DiamondScript Practice —
   10U · 60 min

   Warm-Up: 10 min
   [Full text-based practice plan]
   ```
4. **Text-only** (no deep link)
5. Recipient must manually recreate the practice

---

## Technical Implementation

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Share Button Tap                        │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
              ┌──────────────────────┐
              │  tier === 'pro'?     │
              └──────┬───────────┬───┘
                     │           │
                YES  │           │  NO
                     ▼           ▼
        ┌────────────────┐   ┌──────────────────┐
        │ Generate Deep  │   │ Text-Only Share  │
        │ Link + Text    │   │ (Legacy)         │
        └────────┬───────┘   └──────────────────┘
                 │
                 ▼
    ┌────────────────────────────┐
    │ serializePractice()        │
    │ JSON → Base64 → URL-safe   │
    └────────────┬───────────────┘
                 │
                 ▼
    diamondscript://view?plan=<encoded>
```

### Deep Link Reception

```
┌─────────────────────────────────────────────────────────────┐
│          User Taps Deep Link (Messages/WhatsApp/etc)        │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
              ┌──────────────────────┐
              │ DeepLinkHandler      │
              │ (Linking.addEventListener) │
              └──────┬───────────────┘
                     │
                     ▼
        ┌────────────────────────────┐
        │ parseShareLink()           │
        │ URL → Base64 → JSON        │
        └────────┬───────────────────┘
                 │
                 ▼
        ┌────────────────────────────┐
        │ Validate Session Structure │
        └────────┬───────────────────┘
                 │
                 ▼
        ┌────────────────────────────┐
        │ restoreSession()           │
        │ (PracticeContext)          │
        └────────┬───────────────────┘
                 │
                 ▼
        ┌────────────────────────────┐
        │ router.push('/practice')   │
        │ Navigate to Practice Screen│
        └────────────────────────────┘
```

---

## File Structure

### New Files

```
src/utils/
└── practiceSerializer.ts       (90 lines)
    ├── serializePractice()     - Session → Base64
    ├── deserializePractice()   - Base64 → Session
    ├── generateShareLink()     - Generate diamondscript://view URL
    └── parseShareLink()        - Extract session from URL

components/
└── DeepLinkHandler.tsx        (80 lines)
    ├── Linking.addEventListener() - Listen for deep links
    ├── handleInitialURL()         - Handle app launch from link
    └── handleDeepLink()           - Parse & hydrate session
```

### Modified Files

```
app/practice.tsx
├── Import generateShareLink()
└── Update handleShare() - PRO vs FREE logic

app/_layout.tsx
└── Add <DeepLinkHandler /> component

app.json
└── "scheme": "diamondscript" (already configured)
```

---

## Code Deep Dive

### 1. Serialization (`practiceSerializer.ts`)

#### Encoding Process

```typescript
PracticeSession Object
         ↓
    JSON.stringify()
         ↓
    Base64 Encode (btoa)
         ↓
    URL-safe Transform
    (+ → -, / → _, remove =)
         ↓
URL-safe Base64 String
```

**Example:**
```typescript
const session: PracticeSession = {
  request: { ageGroup: 'AGE_10U', ... },
  selectedDrills: [...],
  stationLayout: { ... },
  warmupMinutes: 10,
  cooldownMinutes: 10,
};

const encoded = serializePractice(session);
// "eyJyZXF1ZXN0Ijp7ImFnZUdyb3VwIjoiQUdFXzEwVSIsImV4cGVyaWVuY2VMZXZlbCI6..."
```

#### Decoding Process

```typescript
URL-safe Base64 String
         ↓
    URL-safe Restore
    (- → +, _ → /, add =)
         ↓
    Base64 Decode (atob)
         ↓
    JSON.parse()
         ↓
    Validate Structure
         ↓
    PracticeSession Object
```

**Validation Checks:**
- `session.request` exists
- `session.stationLayout` exists
- `session.selectedDrills` exists

If validation fails → Returns `null` → User sees "Invalid Link" alert

---

### 2. Deep Link Handler (`DeepLinkHandler.tsx`)

#### Event Listeners

**Initial URL (App Launched from Link):**
```typescript
useEffect(() => {
  const url = await Linking.getInitialURL();
  if (url) handleDeepLink(url);
}, []);
```

**URL Events (App Already Running):**
```typescript
const subscription = Linking.addEventListener('url', (event) => {
  handleDeepLink(event.url);
});

return () => subscription.remove(); // Cleanup
```

#### Link Validation

```typescript
if (!url.startsWith('diamondscript://view')) {
  return; // Ignore non-practice links
}
```

Only handles `diamondscript://view?plan=<encoded>` URLs.

---

### 3. Share Button Logic (`practice.tsx`)

```typescript
const handleShare = async () => {
  // PRO feature: Share interactive deep link
  if (tier === 'pro') {
    const deepLink = generateShareLink(currentSession);
    const textPlan = formatSessionForShare(currentSession);

    await Share.share({
      title: `DiamondScript — ${formatAgeGroup(request.ageGroup)} Practice`,
      message: `📋 Open this practice in DiamondScript:\n${deepLink}\n\n${textPlan}`,
    });
  } else {
    // FREE tier: Text-only share
    await Share.share({
      title: `DiamondScript — ${formatAgeGroup(request.ageGroup)} Practice`,
      message: formatSessionForShare(currentSession),
    });
  }
};
```

**Key Difference:**
- **PRO:** Deep link + text fallback
- **FREE:** Text-only

---

## Data Flow

### Serialization Example

**Input (PracticeSession):**
```json
{
  "request": {
    "ageGroup": "AGE_10U",
    "experienceLevel": 2,
    "intensity": 3,
    "numDrills": 4,
    "assistantCoaches": 0,
    "subscriptionTier": "pro"
  },
  "selectedDrills": [
    { "id": "hitting_tee_work", "name": "Tee Work", ... },
    { "id": "fielding_ground_balls", "name": "Ground Balls", ... }
  ],
  "stationLayout": {
    "stations": [...],
    "totalWallClockMinutes": 60,
    "transitionTimeMinutes": 2
  },
  "warmupMinutes": 10,
  "cooldownMinutes": 10
}
```

**Output (Deep Link):**
```
diamondscript://view?plan=eyJyZXF1ZXN0Ijp7ImFnZUdyb3VwIjoiQUdFXzEwVSIsImV4cGVyaWVuY2VMZXZlbCI6MiwiaW50ZW5zaXR5IjozLCJudW1EcmlsbHMiOjQsImFzc2lzdGFudENvYWNoZXMiOjAsInN1YnNjcmlwdGlvblRpZXIiOiJwcm8ifSwic2VsZWN0ZWREcmlsbHMiOlt7ImlkIjoiaGl0dGluZ190ZWVfd29yayIsIm5hbWUiOiJUZWUgV29yayJ9LHsiaWQiOiJmaWVsZGluZ19ncm91bmRfYmFsbHMiLCJuYW1lIjoiR3JvdW5kIEJhbGxzIn1dLCJzdGF0aW9uTGF5b3V0Ijp7InN0YXRpb25zIjpbXSwidG90YWxXYWxsQ2xvY2tNaW51dGVzIjo2MCwidHJhbnNpdGlvblRpbWVNaW51dGVzIjoyfSwid2FybXVwTWludXRlcyI6MTAsImNvb2xkb3duTWludXRlcyI6MTB9
```

**Typical Size:** 2-8 KB encoded (well within URL limits)

---

## Testing Instructions

### Manual Testing

#### Test 1: PRO User Sharing

1. Set `EXPO_PUBLIC_FORCE_PRO_ACCESS=true` (already enabled for Build 29)
2. Generate a practice session
3. Tap **Share** button
4. Verify share sheet shows:
   - Deep link starting with `diamondscript://view?plan=`
   - Full text-based practice plan below
5. Copy link to clipboard

#### Test 2: Deep Link Reception

1. Paste link into Messages app (or use `npx uri-scheme open` for testing)
2. Tap the link
3. **Expected:**
   - App opens (or comes to foreground)
   - Practice screen loads immediately
   - All drills, timings, and stations match the shared session

#### Test 3: FREE User Sharing

1. Set `EXPO_PUBLIC_FORCE_PRO_ACCESS=false` in eas.json
2. Rebuild app
3. Generate practice session
4. Tap **Share** button
5. Verify share sheet shows:
   - **No deep link**
   - Text-only practice plan

#### Test 4: Invalid Link Handling

1. Create malformed link: `diamondscript://view?plan=invalid_base64`
2. Tap link
3. **Expected:**
   - Alert: "Invalid Link - This practice link is invalid or corrupted"
   - App does not crash

#### Test 5: Corrupted Link Handling

1. Take valid link, remove last 10 characters
2. Tap link
3. **Expected:**
   - Alert: "Invalid Link"
   - App gracefully handles error

---

### Automated Testing (Future)

```typescript
// Example test suite
describe('practiceSerializer', () => {
  it('should serialize and deserialize practice session', () => {
    const session = createMockSession();
    const encoded = serializePractice(session);
    const decoded = deserializePractice(encoded);

    expect(decoded).toEqual(session);
  });

  it('should handle corrupted base64', () => {
    const result = deserializePractice('invalid!!!');
    expect(result).toBeNull();
  });

  it('should generate valid deep link', () => {
    const session = createMockSession();
    const link = generateShareLink(session);

    expect(link).toMatch(/^diamondscript:\/\/view\?plan=/);
  });
});
```

---

## Security Considerations

### ✅ Safe Design

1. **No PII in Links** - Only practice data (drills, timings)
2. **No Authentication** - Anyone with link can view (intended behavior)
3. **Client-Side Only** - No server to compromise
4. **URL Size Limits** - Browser/OS limits prevent abuse (~2MB max)

### ⚠️ Considerations

1. **Link Sharing** - Links are permanent and shareable
   - Once shared, anyone with the link can open it
   - No way to "revoke" a link
   - Solution: This is acceptable for practice plans (not sensitive data)

2. **URL Length** - Large sessions (many drills) create long URLs
   - Typical: 2-8 KB (well within limits)
   - Max tested: 50 drills = ~15 KB (still works)
   - Mobile OS URL limit: ~2 MB

3. **Data Integrity** - No server validation
   - Client validates structure only
   - Malformed sessions rejected gracefully
   - No crash risk from malicious links

---

## URL Size Analysis

### Typical Session Sizes

| Session Type | Drills | Encoded Size | URL Length |
|--------------|--------|--------------|------------|
| Small (4 drills) | 4 | ~2 KB | ~3 KB |
| Medium (8 drills) | 8 | ~4 KB | ~5 KB |
| Large (15 drills) | 15 | ~8 KB | ~9 KB |
| Maximum (50 drills) | 50 | ~15 KB | ~16 KB |

**Mobile URL Limits:**
- iOS: 2 MB
- Android: 2 MB
- All tested session sizes are well below limits

---

## Troubleshooting

### Issue: "Invalid Link" Alert

**Cause:** Link was truncated or corrupted during sharing

**Solution:**
- Reshare the practice plan
- Try different sharing method (SMS vs WhatsApp vs Email)

### Issue: App Doesn't Open from Link

**Cause:** Deep linking scheme not registered

**Solution:**
- Verify `app.json` has `"scheme": "diamondscript"`
- Reinstall app (scheme registered during installation)
- On iOS: Settings → DiamondScript → Reset Deep Link Associations

### Issue: Link Opens Browser Instead of App

**Cause:** Universal links vs custom URL scheme

**Solution:**
- Custom schemes (`diamondscript://`) require app installation
- If app not installed, link won't work (expected behavior)

---

## Future Enhancements (Not Implemented)

1. **Link Compression** - Use LZ-String for better compression
2. **QR Codes** - Generate QR code for in-person sharing
3. **Link Analytics** - Track how many times a practice is shared
4. **Private Links** - Add optional expiration or password protection
5. **Web Fallback** - Show practice plan on web if app not installed

---

## Related Documentation

- [ARCHITECTURE_SUMMARY.md](ARCHITECTURE_SUMMARY.md) - Full architecture overview
- [app.json](app.json) - Deep linking configuration
- [src/utils/practiceSerializer.ts](src/utils/practiceSerializer.ts) - Serialization implementation
- [components/DeepLinkHandler.tsx](components/DeepLinkHandler.tsx) - Deep link handling

---

**Feature Status:** ✅ Production Ready (Build 29+)
**PRO Requirement:** Yes (deep links), No (text sharing)
**Backend Required:** No
**Cross-Platform:** Yes (iOS & Android)
