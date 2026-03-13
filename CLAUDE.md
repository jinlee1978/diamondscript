# DiamondScript — Source of Truth

This file is the single source of truth for age constraints, subscription tiers, and design invariants.
Code that touches these domains references these definitions — never hardcodes them.

---

## Subscription Tiers

| Tier | Price    | Drill Catalog | Intensity | Assistants | Max Drills | Practice Log | Starred Drills | AI Generation |
|------|----------|---------------|-----------|------------|------------|--------------|----------------|---------------|
| Free | $0       | 34 free drills | 1–4      | 0–1 (0–2 for Intro/T-Ball/Coach Pitch) | 4 | Last 3 | 5 | No |
| Pro  | $9.99/mo | Full catalog  | 1–5       | 0–3        | 6          | Unlimited    | Unlimited      | Yes           |

**Age-specific overrides (all tiers):** Intro/T-Ball cap experience at 1, intensity at 3. Coach Pitch caps experience at 2, intensity at 3.
These overrides are in `YOUNG_GROUP_OVERRIDES` inside `src/subscription/tiers.ts`.

**Free generation limits:** Intro, T-Ball, and Coach Pitch get **unlimited** free engine generations. All other age groups get **5 free generations**, then paywall. AI generation always requires Pro.
Generation tracking is in `src/data/storage/generationTracker.ts`. The `UNLIMITED_AGE_GROUPS` set and `FREE_GENERATION_LIMIT = 5` are the source of truth.

Feature gating is in `src/subscription/featureGate.ts`.
The engine itself is tier-unaware. Tier constraints are applied at the request boundary BEFORE the engine is invoked.

---

## Age Group Definitions (Sacred Ordering — Do Not Flatten)

1. **Intro (3–4):** Pre-T-Ball. No gloves, no live pitching. Pure motor skills (rolling, running, underhand throwing). Max 30 min practice.
2. **T-Ball (5–6):** Ball on tee only. No live pitching. Basic motor fundamentals.
3. **Coach Pitch (7–8):** Coach throws underhand or overhand. Ball tracking and swing timing emerge.
4. **Machine Pitch (8–9):** Pitching machine delivers consistent strikes. Swing mechanics and live fielding.
5. **Kid Pitch (9–10):** Kids pitch to each other. Basic positional play emerges.
6. **Competitive (11–12):** Position specialization begins. Lead-offs, stealing, advanced situational play.
7. **Advanced (13–14):** Full baseball. Longer distances, pitch selection, travel ball readiness.

These map 1:1 to the `AgeGroup` enum in `src/data/types/ageGroup.ts`.
The ordering is encoded as an integer ordinal (0–6) and used for complexity ceiling lookups.
The array in `src/core/constants/ageGroups.ts` is frozen at runtime. Never sort or reorder it.

---

## Design Invariants

- **The engine is a pure function.** Same inputs always produce the same output. No I/O, no side effects.
- **Age/Level split-logic is sacred.** A Beginner 12U and an Advanced 12U MUST produce different drill selections.
  This is enforced by the Target Complexity calculation — not by separate code paths.
- **Experience scaling is non-linear (concave).** EWF uses exponent 0.6. Early years produce steeper gains.
  See `src/core/logic/experienceWeighting.ts`.
- **All complexity scores live on a 1.0–5.0 float scale.**
- **Drill categories are:** hitting, fielding, pitching, baserunning.
  Intro, T-Ball, and Coach Pitch suppress pitching from the candidate pool at the data level (ageGroupCompatibility).
- **NumDrills is a coach-configurable input.** The engine adapts reps and station layouts to any value.
- **Subscription gating sits outside the engine.** The engine never sees a SubscriptionTier.

---

## Paywall System

All upgrade paths route through `PaywallModal` via `openPaywall(trigger)` from `PracticeContext`.
The standalone `app/upgrade.tsx` screen still exists but is no longer the primary upgrade path.

| Trigger | Where Fired | Meaning |
|---------|-------------|---------|
| `ai_generator` | Generate tab | AI practice generation (Pro feature) |
| `generation_limit` | `PracticeContext` line ~748 | Free user exhausted 5 free plans |
| `history_limit` | Practice Log footer | Free user has >5 saved practices |
| `drill_catalog` | Add-drill picker, Drill Library | Free user tapped a Pro-only drill |
| `feature` | `UpgradeBanner` (default) | Generic feature gate (intensity, splitting) |

**PaywallModal** renders as a **single root-level instance** in `app/_layout.tsx`.
It was removed from all individual screens (practice.tsx, history.tsx, drills.tsx, generate.tsx, ai.tsx, setup.tsx, settings.tsx, index.tsx) in BUILD 107 to fix a critical freeze bug (see Known Issues below).
**UpgradeBanner** calls `openPaywall(trigger)` — does NOT navigate to `/upgrade`.

RevenueCat integration lives in `src/subscription/service.ts`.
`initiateUpgrade()` and `restorePurchases()` are called only from inside `PaywallModal`.

---

## Legal & App Store Compliance

| Asset | Location | Live URL |
|-------|----------|----------|
| Privacy Policy source | `privacy-policy.html` (repo root) | `https://jinlee1978.github.io/diamondscript/privacy/` |
| Privacy Policy (Pages) | `privacy/index.html` | Same URL — served by GitHub Pages |
| Terms of Use (EULA) | Apple Standard EULA | `https://www.apple.com/legal/internet-services/itunes/dev/stdeula/` |

Both URLs are referenced in `components/PaywallModal.tsx` (constants `PRIVACY_URL`, `TERMS_URL`) and `app/upgrade.tsx`.

Apple Guideline 3.1.2 requirements (all met in-app):
- Subscription title: "DiamondScript Pro"
- Price: $9.99/month (also fetched dynamically from RevenueCat)
- Length: Monthly, auto-renews until cancelled
- Disclosure text + legal links in PaywallModal and upgrade.tsx

App Store Connect metadata checklist (manual):
- Privacy Policy URL field → `https://jinlee1978.github.io/diamondscript/privacy/`
- EULA → Apple Standard License Agreement (default)
- Terms of Use link added to App Description text
- IAP product "DiamondScript Pro" must be attached to each app submission
- IAP promotional image (1024×1024) must NOT contain price references (Apple Guideline 2.3.2)
- App Store screenshots must match accepted sizes: 1284×2778 or 1242×2688 (portrait)

---

## Key File Map

| File | Responsibility |
|------|---------------|
| `src/core/engine/index.ts` | Public API — `generatePracticeSession()` |
| `src/core/engine/drillSelector.ts` | Greedy drill selection loop |
| `src/core/engine/repFlowEngine.ts` | `calculateOptimalRepFlow()` — station layout + reps |
| `src/core/logic/experienceWeighting.ts` | `applyExperienceWeighting()` — EWF(x) = (x/5)^0.6 |
| `src/core/logic/complexityScoring.ts` | `calculateTargetComplexity()` — TC formula |
| `src/core/logic/drillMatchScoring.ts` | `calculateDrillMatchScore()` — DMS composite |
| `src/core/logic/categoryBalance.ts` | `applyCategoryBalanceBonus()` — diversity nudge |
| `src/core/constants/ageGroups.ts` | Frozen age group definitions |
| `src/core/constants/weights.ts` | ALPHA, BETA, GAMMA, MAX_COMPLEXITY_DISTANCE |
| `src/core/constants/intensityConfig.ts` | Transition time & RPM constants |
| `src/subscription/featureGate.ts` | Tier constraint application |
| `src/subscription/service.ts` | RevenueCat SDK — purchase, restore, offerings |
| `src/data/seedDrills.ts` | Initial drill catalog (30 free + 18 pro = 48) |
| `components/PaywallModal.tsx` | Unified paywall UI — all upgrade flows land here |
| `components/UpgradeBanner.tsx` | Inline upgrade nudge — calls `openPaywall()` |
| `context/PracticeContext.tsx` | App state — includes paywall state + trigger management |
| `privacy-policy.html` | Privacy policy source (also copied to `privacy/index.html`) |
| `src/data/storage/generationTracker.ts` | Age-aware free generation tracking (UNLIMITED_AGE_GROUPS, FREE_GENERATION_LIMIT) |
| `app/_layout.tsx` | Root layout — single PaywallModal instance lives here |
| `app.json` | Version: 1.1.3, buildNumber: 17, versionCode: 107 |

---

## App Store Submission Status

**Current version:** 1.1.3 (buildNumber 17, versionCode 107)
**Status:** Building for submission (March 12, 2026).
**IAP:** "DiamondScript Pro" (com.diamondscript.app.monthly) — Approved, attached to submission.

### Rejection History

1. **v1.0.7 — Rejected Feb 24, 2026:**
   - Guideline 2.1: IAP product not attached to submission → Fixed: attached DiamondScript Monthly Pro
   - Guideline 3.1.2: Missing legal links → Fixed: updated Privacy Policy + Terms URLs in code and App Store Connect metadata

2. **v1.1.0 — Rejected March 10, 2026:**
   - Guideline 2.3.2: IAP promotional image contained price references → Fixed: replaced with price-free image

### Changes in v1.1.0 (vs rejected v1.0.7)
- Unified paywall system: all upgrade flows route through PaywallModal via contextual triggers
- Pro lock indicators on drill picker and Drill Library
- Prominent upgrade gate in Practice Log (replaces passive banner)
- Fixed filterCandidates to show Pro drills with lock badges for free users
- Updated legal URLs (Privacy Policy → GitHub Pages, Terms → Apple Standard EULA)
- Comprehensive privacy policy update (RevenueCat, Supabase, coach notes, sharing, export)
- Version bump: 1.0.7 → 1.1.0

### Changes in v1.1.2 (vs rejected v1.1.0)
- **PaywallModal freeze fix (CRITICAL):** Moved PaywallModal to single root instance in `_layout.tsx`. Removed from 8 screens. Multiple `<Modal>` instances bound to shared state left phantom touch-blocking layers on iOS.
- **Dead navigation fix:** Changed all `router.push()` to `router.navigate()` for tab routes across the app. `push` fails silently for tab siblings in iOS production builds.
- **Frozen scroll fix:** Removed `onStartShouldSetResponder={() => true}` wrappers inside SectionList/ScrollView containers in Practice Log. Replaced with `e.stopPropagation()` on individual buttons.
- **Modal scroll fix:** Added `onMoveShouldSetResponder={() => false}` to drill picker sheets in `practice.tsx` and `DrillCard.tsx` to allow scroll gestures through.
- **Age-aware generation limits:** Intro, T-Ball, Coach Pitch get unlimited free generations. All others get 5. Counter shown under Generate button.
- **Generation counter UI:** Free users see "Free for this age group — no limits" or "X of 5 free plans remaining."
- **IAP image fix:** Replaced promotional image to remove price references (Guideline 2.3.2).
- Version bump: 1.1.0 → 1.1.2

### Changes in BUILD 107 (post-v1.1.2 hotfix)
- **Share freeze fix (CRITICAL):** Fixed race condition where dismissing the share preview modal before `Share.share()` completed caused iOS to leave phantom touch-blocking layers. Modal now stays open during share and dismisses only in `finally{}`. Added `isSharing` debounce guard to prevent double-tap on Share Now button.
- **Timing accuracy fix:** Replaced engine-computed per-drill times with render-time recalculation using the **weighted largest-remainder method**. Each drill's time is proportional to its original engine/AI weight, preserving the AI's intended pacing (e.g., a 12-min hitting drill stays ~2x a 6-min baserunning drill). For Quick Plan sessions where the engine assigns equal times, proportional = equal, so behavior is identical. Drill times are whole numbers that sum exactly to the total. Times automatically adjust when drills are moved between coaches. Applied to both on-screen display and share text.
- **Division by zero guards:** Added guards for empty coach groups (`drillCount === 0`) and negative available time (`Math.max(0, ...)`) in both the display memo and share formatter.
- **Memoization chain fix:** Memoized `timelineDrills` (fallback path) and `coachGroups` with `useMemo` so downstream hooks don't recompute every render. Chain: `timelineDrills` → `coachGroups` → `adjustedDrillValues`.
- **Responder safety:** Added `onMoveShouldSetResponder={() => false}` to share preview sheet to prevent touch gesture conflicts with native iOS share sheet.
- **Custom/AI drill badges:** Added "Custom" (blue) and "AI" (purple) badges next to drill names on practice cards. `isCustomDrill` detection memoized with `useMemo` to avoid O(n) lookup per render.
- **Settings version fix:** Replaced hardcoded version string with dynamic read from `expo-constants`. Falls back to 1.1.2 (Build 16) if config unavailable.
- **Home screen Recent Practices fix:** Fixed HistoryEntry property access (`s.request` → `s.session.request`). Recent Practices section was rendering zero cards because the filter always returned false.
- **History share freeze fix:** Applied same share freeze fix pattern to `history.tsx` (modal dismiss in `finally{}`, `isSharing` debounce guard, `onMoveShouldSetResponder` on share sheet). This was the SAME race condition bug as practice.tsx but in a different screen.
- **FREE_HISTORY_LIMIT fix:** history.tsx had `FREE_HISTORY_LIMIT = 5` while PracticeContext had `3` (matching CLAUDE.md). Aligned to 3.
- **Reorder empty array guard:** Added `if (drillsArray.length < 2) return prev` to `reorderDrillInTimeline` to prevent crash on empty timeline.
- **Coach group total fix:** Changed group header to show actual sum of drill times + transitions for that group (not the total wall-clock window), so a coach can manually verify the math.
- **Share modal full dismiss lockout:** Extended `isSharing` guard to ALL modal dismiss paths — Cancel button, backdrop tap, and Android back button (`onRequestClose`) — in both `practice.tsx` and `history.tsx`. Previously only the Share Now button was guarded, leaving Cancel/backdrop/back as escape hatches that could trigger the same race condition.
- **Generation counter stale closure fix:** Added `ageGroup` and `refreshGenerationsLeft` to `useFocusEffect` dependency array in `generate.tsx`. Counter was showing wrong value after switching age groups because the focus callback captured a stale `ageGroup`.
- **DrillCard modal mutual exclusivity:** Close one modal before opening another (Swap Drill vs Assign Coach) to prevent phantom touch-blocking layers from overlapping `<Modal>` instances.
- **CRITICAL: swapDrill/removeDrill wrong index fix:** DrillCard was passing group-relative `blockIndex` to `swapDrill` and `removeDrillFromSession`, but PracticeContext used it as a timeline index. With multiple coaches, this swapped/deleted the WRONG drill. Fixed by using `timelineIndex ?? blockIndex` in DrillCard. Also added timeline branch to `swapDrill` (previously only modified stationLayout, making swaps invisible for timeline-based sessions).
- **selectedDrills sync fix:** `swapDrill`, `addDrillToSession`, and `removeDrillFromSession` now sync `selectedDrills` from timeline after mutation. Previously `selectedDrills` was set once by the engine and never updated, causing stale drill names in Practice Log previews, wrong drill counts in history/season/home, and incorrect category filter results after any drill modification.
- **Files modified:** `app/practice.tsx`, `components/DrillCard.tsx`, `app/settings.tsx`, `app/(tabs)/index.tsx`, `app/(tabs)/history.tsx`, `context/PracticeContext.tsx`, `app/(tabs)/generate.tsx`

### Release Notes (What's New — Apple)
> Bug fixes and performance improvements:
> - Fixed an issue where the app could become unresponsive after dismissing the upgrade screen
> - Improved navigation reliability across all screens
> - Improved scrolling performance in Practice Log
> - Added free generation counter so coaches can see remaining practice plans
> - Intro, T-Ball, and Coach Pitch age groups now get unlimited free practice generation

---

## Known Issues & Lessons Learned (Do Not Repeat)

These are bugs we found and fixed. Reference this list when developing new features to avoid reintroducing them.

### 1. router.push() vs router.navigate() for Tab Routes
**Symptom:** Buttons on home screen appear dead — nothing happens on tap.
**Root cause:** `router.push()` fails silently for tab siblings in iOS production builds (works in dev).
**Rule:** ALWAYS use `router.navigate()` when switching between tab routes. Only use `router.push()` for stack routes (e.g., `/practice`, `/settings`).
**Files affected:** `app/(tabs)/index.tsx`, `app/(tabs)/generate.tsx`, `app/(tabs)/teams.tsx`, `app/(tabs)/ai.tsx`

### 2. onStartShouldSetResponder Inside Scroll Containers
**Symptom:** Screen appears frozen — can't scroll or interact with anything.
**Root cause:** `onStartShouldSetResponder={() => true}` on a View inside a ScrollView/FlatList/SectionList intercepts ALL touch gestures on iOS, including scroll.
**Rule:** NEVER use `onStartShouldSetResponder={() => true}` inside scrollable containers. Use `e.stopPropagation()` on individual button `onPress` handlers instead. For modal sheets containing ScrollViews, use `onMoveShouldSetResponder={() => false}` to let scroll gestures pass through.
**Files affected:** `app/(tabs)/history.tsx`, `app/practice.tsx`, `components/DrillCard.tsx`

### 3. Multiple Modal Instances Sharing Global State
**Symptom:** After closing a Modal on one screen and navigating to another, the destination screen freezes completely. Requires force-quit.
**Root cause:** React Native `<Modal>` with `visible={false}` can leave phantom touch-blocking layers on iOS when multiple instances exist across screens, all bound to the same global state variable.
**Rule:** NEVER render `<Modal>` in more than one screen if they share the same visibility state. Use a SINGLE root-level Modal instance (in `_layout.tsx`) controlled by context. This applies to PaywallModal and any future modals.
**Files affected:** `app/_layout.tsx` (single instance), removed from 8 individual screens.

### 4. App Store IAP Attachment
**Symptom:** Apple rejects with Guideline 2.1.
**Rule:** The IAP product "DiamondScript Pro" MUST be attached to EVERY submission in App Store Connect, even for updates. It doesn't auto-attach. Always verify before submitting.

### 5. IAP Promotional Image Cannot Contain Prices
**Symptom:** Apple rejects with Guideline 2.3.2.
**Rule:** The 1024×1024 IAP promotional image must NOT reference pricing ($9.99, "only $X/mo", etc.).

### 6. Generation Limit Exhaustion During Testing
**Symptom:** Paywall triggers unexpectedly during normal use.
**Root cause:** AsyncStorage-based generation counter persists across app updates. Testing exhausts the limit.
**Rule:** When testing generation limits, either reset AsyncStorage or test with an unlimited age group (Intro, T-Ball, Coach Pitch).

### 7. Share.share() Race Condition with Modal Dismiss (BUILD 107)
**Symptom:** Share sheet opens then immediately closes, screen freezes afterward.
**Root cause:** Calling `setShowSharePreview(false)` BEFORE `await Share.share()` triggers the React Modal dismiss animation concurrently with the native iOS share sheet opening. The animation overlap leaves phantom touch-blocking layers.
**Rule:** ALWAYS dismiss share preview modal in the `finally{}` block AFTER `Share.share()` resolves or rejects. Never dismiss the modal before the native share sheet completes.
**Additional protection:** Add an `isSharing` state guard to prevent double-tap on the Share Now button. Disable the button with `disabled={isSharing}` during the async operation.
**Files affected:** `app/practice.tsx` (executeShare function, Share Preview Modal)

### 8. Division by Zero in Timing Redistribution
**Symptom:** NaN displayed for drill time and reps, or negative times shown.
**Root cause:** `adjustedDrillValues` and `formatDrillGroup` divide `pureDrillMinutes / drillCount` without guarding against `drillCount === 0` (empty coach group) or `pureDrillMinutes < 0` (warmup + cooldown + transitions exceed total time).
**Rule:** ALWAYS guard timing math: `if (drillCount === 0) continue;` and `Math.max(0, availableDrillTime - totalTransitions)`. These guards exist in both the display memo (`adjustedDrillValues`) and the share formatter (`formatDrillGroup`).
**Files affected:** `app/practice.tsx` (adjustedDrillValues useMemo, formatDrillGroup function)

### 9. Unmemoized Derived Values Defeating useMemo Dependencies
**Symptom:** Performance jank during drill moves, unnecessary re-renders.
**Root cause:** Computed values like `timelineDrills` and `coachGroups` created new array/object references every render via inline `.flatMap()` or function calls. Downstream `useMemo` hooks that depend on these values recompute every render because the reference changes even when the data is identical.
**Rule:** ANY derived value that serves as a `useMemo` dependency MUST itself be memoized. Wrap with `useMemo` and provide stable dependencies. The chain in practice.tsx is: `timelineDrills` (memoized) → `coachGroups` (memoized) → `adjustedDrillValues` (memoized). If any link in this chain creates a new reference unnecessarily, the entire downstream chain recomputes.
**Files affected:** `app/practice.tsx` (timelineDrills, coachGroups, adjustedDrillValues)

### 10. onStartShouldSetResponder on Non-Scrollable Modal Content
**Symptom:** Potential touch gesture conflicts with native OS sheets (Share, Alerts).
**Root cause:** `onStartShouldSetResponder={() => true}` without `onMoveShouldSetResponder={() => false}` intercepts all touch events, including swipe gestures needed by native OS UI sheets that overlay the modal.
**Rule:** ALWAYS pair `onStartShouldSetResponder={() => true}` with `onMoveShouldSetResponder={() => false}` — even on Views that don't contain ScrollViews. This lets move/swipe gestures pass through to native components. Better yet: only use `onStartShouldSetResponder` when strictly necessary (e.g., to prevent backdrop taps from closing a sheet).
**Files affected:** `app/practice.tsx` (sharePreviewSheet), `components/DrillCard.tsx` (pickerSheet — already correct)

### 11. Share Modal Dismiss via Cancel/Backdrop/Back Button During Active Share
**Symptom:** Screen freezes after sharing — same phantom touch-blocking layers as Known Issue #7.
**Root cause:** The Cancel button, backdrop tap, and Android back button (`onRequestClose`) could all dismiss the share preview modal while `Share.share()` was still executing. The `isSharing` guard was only applied to the Share Now button, not to these other dismiss paths.
**Rule:** EVERY dismiss path for a share preview modal must check `isSharing` before dismissing. This includes: Cancel button (`disabled={isSharing}`), backdrop `onPress` (`if (!isSharing)`), and Modal `onRequestClose` (`if (!isSharing)`).
**Files affected:** `app/practice.tsx`, `app/(tabs)/history.tsx`

### 12. Stale ageGroup in useFocusEffect (generate.tsx)
**Symptom:** After switching age groups, leaving and returning to the Generate tab shows wrong generation counter (e.g., shows "unlimited" for Kid Pitch because the closure captured the previous Intro age group).
**Root cause:** `useFocusEffect` callback at line 143 used `ageGroup` in `refreshGenerationsLeft(ageGroup)` but the dependency array was `[tier]` only. The stale closure captured the old `ageGroup` value.
**Rule:** useFocusEffect dependency arrays MUST include ALL state variables read inside the callback. Add `ageGroup` and `refreshGenerationsLeft` to the dependency array.
**Files affected:** `app/(tabs)/generate.tsx`

### 13. DrillCard Modal Overlap Risk
**Symptom:** Potential phantom touch-blocking layers if both Swap Drill and Assign Coach modals are mounted simultaneously.
**Root cause:** DrillCard has two separate `<Modal>` instances controlled by independent state (`showPicker`, `showCoachPicker`). Rapid taps could theoretically open both.
**Rule:** When opening one modal in DrillCard, always close the other first. Use mutual exclusivity: `setShowPicker(false)` before `setShowCoachPicker(true)` and vice versa.
**Files affected:** `components/DrillCard.tsx`

---

### 14. swapDrill/removeDrill Wrong Index with Multiple Coaches (BUILD 107)
**Symptom:** With 2+ coaches, swapping or deleting a drill affects the WRONG drill, or swap appears to do nothing.
**Root cause:** practice.tsx passed `blockIndex` (drill's position within its coach GROUP) to `swapDrill` and `removeDrillFromSession`, but PracticeContext treated it as the TIMELINE index (absolute position across all groups). With a single coach these are identical; with multiple coaches they diverge. Additionally, `swapDrill` only modified `stationLayout` (not `timeline`), making swaps invisible for timeline-based sessions.
**Rule:** ALL drill operations that modify timeline data must use the absolute `timelineIndex`, not the group-relative `blockIndex`. In DrillCard, always use `timelineIndex ?? blockIndex` for `swapDrill` and `removeDrillFromSession`. Coach assignment (`manuallyAssignDrillToCoach`) and reorder (`reorderDrillInTimeline`) already used the correct index — only swap and remove were wrong.
**Files affected:** `components/DrillCard.tsx` (call sites), `context/PracticeContext.tsx` (added timeline branch to `swapDrill`)

---

## Future Roadmap

### Next Release (v1.2.0 — Planned)
- **Multi-season calendar:** Allow team assignment per practice. Support multiple teams per coach (e.g., T-Ball + 10U) with overlapping date ranges. Architecture: one season per team, calendar shows all teams with color coding.
- **Android build:** Retry after transient Supabase CLI download failure (502 Bad Gateway). No code changes needed.

### Backlog (Unscheduled)
- AI-generated practice plans (Pro-only feature, engine exists but gated)
- Advanced drill filtering and search
- Coach collaboration / team sharing
- Practice session templates (save & reuse configurations)
- Export practice plans to PDF
