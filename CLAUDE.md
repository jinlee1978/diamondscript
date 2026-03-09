# DiamondScript — Source of Truth

This file is the single source of truth for age constraints, subscription tiers, and design invariants.
Code that touches these domains references these definitions — never hardcodes them.

---

## Subscription Tiers

| Tier | Price    | Drill Catalog   | Custom Intensity | Station Splitting | Practice Log |
|------|----------|-----------------|------------------|-------------------|--------------|
| Free | $0       | Top 30 only     | Locked at 3      | No (sequential)   | Last 5       |
| Pro  | $9.99/mo | Full catalog    | Yes (1–5)        | Yes               | Unlimited    |

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
| `generation_limit` | `PracticeContext` line ~748 | Free user exhausted 3 free plans |
| `history_limit` | Practice Log footer | Free user has >5 saved practices |
| `drill_catalog` | Add-drill picker, Drill Library | Free user tapped a Pro-only drill |
| `feature` | `UpgradeBanner` (default) | Generic feature gate (intensity, splitting) |

**PaywallModal** renders in: `app/practice.tsx`, `app/(tabs)/history.tsx`, `app/(tabs)/drills.tsx`.
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
- IAP product "DiamondScript Pro" must be attached to each app submission with a review screenshot

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
| `app.json` | Version: 1.1.0, buildNumber: 6, versionCode: 96 |
