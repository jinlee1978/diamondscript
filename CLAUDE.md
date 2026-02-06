# DiamondScript — Source of Truth

This file is the single source of truth for age constraints, subscription tiers, and design invariants.
Code that touches these domains references these definitions — never hardcodes them.

---

## Subscription Tiers

| Tier | Price    | Drill Catalog   | Custom Intensity | Station Splitting | Practice History |
|------|----------|-----------------|------------------|-------------------|------------------|
| Free | $0       | Top 30 only     | Locked at 3      | No (sequential)   | Last 5           |
| Pro  | $7.99/mo | Full catalog    | Yes (1–5)        | Yes               | Unlimited        |

Feature gating is in `src/subscription/featureGate.ts`.
The engine itself is tier-unaware. Tier constraints are applied at the request boundary BEFORE the engine is invoked.

---

## Age Group Definitions (Sacred Ordering — Do Not Flatten)

1. **T-Ball (5–6):** No live pitching. Pure motor fundamentals.
2. **8U (7–8):** Coach-pitch or beginner kid-pitch.
3. **10U (9–10):** Kid-pitch. Basic positional play emerges.
4. **12U (11–12):** Competitive. Position specialization begins.
5. **14U (13–14):** Advanced fundamentals. Travel ball readiness.

These map 1:1 to the `AgeGroup` enum in `src/data/types/ageGroup.ts`.
The ordering is encoded as an integer ordinal (0–4) and used for complexity ceiling lookups.
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
  T-Ball and 8U suppress pitching from the candidate pool at the data level (ageGroupCompatibility).
- **NumDrills is a coach-configurable input.** The engine adapts reps and station layouts to any value.
- **Subscription gating sits outside the engine.** The engine never sees a SubscriptionTier.

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
| `src/data/seedDrills.ts` | Initial drill catalog |
