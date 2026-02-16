# DiamondScript Build 68 - Complete Technical Architecture

**Created:** February 12, 2026
**Updated:** February 13, 2026
**Status:** ARCHITECTURAL DOCUMENTATION ONLY - NO IMPLEMENTATION
**Build Type:** Feature Enhancement + Data Model Refactor + Bug Fixes
**Risk Level:** MEDIUM (UI/State changes, data structure migration, no auth modifications)

---

## 🎯 **Build 68 Objectives**

### Core Architecture Changes
1. **Flat Timeline Model** - Replace nested `stationLayout` with single `timeline.drills` array
2. **Universal Staff Registry** - Global coach management system with CRUD operations
3. **Plan-Centric Unified Flow** - Coach-agnostic drill ordering across entire practice
4. **Coach Badge System** - Visual coach assignments with color coding (Green/Blue/Amber/Emerald)

### UI Improvements
5. **Drill Library Fix** - Resolve saved count mismatch
6. **AI Lab UX Recovery** - Fix countdown timer + add Clear button

### Non-Goals
- ❌ NO drag-and-drop implementation (Lean Flow - keep existing Edit Order UI)
- ❌ NO changes to Build 67 authentication
- ❌ NO new external libraries for drag gestures

---

## 🔒 **Immutable Core (Build 67 Security)**

### Files That MUST NOT Be Modified:

```
✋ HANDS OFF - Authentication Core:
   ├── src/services/aiPracticeService.ts (AUTO-REPAIR LOGIC)
   ├── src/config/supabase.ts (initializeAuth)
   ├── supabase/functions/generate-practice-plan/index.ts (JWT VERIFICATION)
   ├── supabase/functions/deploy.sh (--no-verify-jwt flag)
   └── app/(tabs)/ai.tsx (Lines 28-50: Auth state management - except countdown fix)

✋ HANDS OFF - Build Configuration (Until Build 68 Ready):
   ├── app.json (versionCode: 67)
   ├── eas.json (production profile)
   └── .easignore (build optimization)
```

**Why Immutable:**
- Build 67 fixes critical 401 authentication errors
- Gateway bypass + code-level JWT verification is production-tested
- Any auth changes risk reintroducing Build 66 failures
- Edge Function deployment requires exact `--no-verify-jwt` flag

**Enforcement:**
- Pre-commit hook will block changes to these files
- Code review will verify no auth logic modifications
- Testing will confirm auth flow unchanged

---

## 📊 **PILLAR 1: Flat Timeline Architecture (Plan-Centric Model)**

### 1.1 Problem Statement

**Current State (Build 67 - Nested Stations):**
```typescript
// Drills are siloed by coach
interface StationLayout {
  stations: [
    { coachIndex: 0, drills: [A, B, C] },  // Head Coach section
    { coachIndex: 1, drills: [D, E] },     // Assistant section
  ]
}

// Problem: Moving drill D from station 1 → station 0 requires:
// 1. Remove D from station[1].drills
// 2. Insert D into station[0].drills at specific index
// 3. Update both stations
// 4. Re-calculate station durations
// 5. Validate coach assignments
```

**Desired State (Build 68 - Flat Timeline):**
```typescript
// Single flat array - coach is just a property
interface PracticeTimeline {
  drills: [
    { drill: A, assignedCoachId: "head", order: 0 },
    { drill: B, assignedCoachId: "head", order: 1 },
    { drill: C, assignedCoachId: "smith", order: 2 },
    { drill: D, assignedCoachId: "jones", order: 3 },
    { drill: E, assignedCoachId: "head", order: 4 },
  ]
}

// Solution: Moving drill D from position 3 → position 1 is simple:
// 1. Remove D from array (splice)
// 2. Insert D at new position (splice)
// 3. Re-index all drills (order = index)
// 4. assignedCoachId automatically moves with drill
```

---

### 1.2 Data Architecture

#### 1.2.1 New Type Definitions

**File:** `src/data/types/practice.ts`

**Current DrillBlock (Build 67):**
```typescript
export interface DrillBlock {
  drill: Drill;                  // The drill definition
  timeMinutes: number;           // Duration
  reps: number;                  // Repetitions
  bonusReps: number;             // Extra reps
  openTimeMinutes: number;       // Slack time
}
```

**New DrillBlock (Build 68):**
```typescript
export interface DrillBlock {
  id: string;                    // NEW: Unique ID for React keys
  drill: Drill;                  // The drill definition
  timeMinutes: number;           // Duration
  reps: number;                  // Repetitions
  bonusReps: number;             // Extra reps
  openTimeMinutes: number;       // Slack time
  assignedCoachId: string;       // NEW: Coach running this drill
  order: number;                 // NEW: Position in timeline (0-based index)
}
```

**New PracticeTimeline Interface:**
```typescript
export interface PracticeTimeline {
  drills: DrillBlock[];            // FLAT array (no nesting)
  transitionTimeMinutes: number;   // Time between drills
  totalWallClockMinutes: number;   // Total duration
}
```

**Updated PracticeSession (Build 68):**
```typescript
export interface PracticeSession {
  id: string;
  createdAt: number;
  request: PracticeRequest;
  targetComplexity: number;

  // BUILD 68: Replace stationLayout with timeline
  timeline: PracticeTimeline;      // NEW (replaces stationLayout)

  // BUILD 67: Keep for backward compatibility (optional)
  stationLayout?: StationLayout;   // DEPRECATED (auto-migrate to timeline)

  warmupMinutes: number;
  cooldownMinutes: number;
  source?: PracticeSource;
  coachNames?: string[];
}
```

**Why These Changes:**
1. **`id` field:** Required for React FlatList keys and stable references
2. **`assignedCoachId`:** Coach is a property of the drill, not a section boundary
3. **`order` field:** Explicit sequencing (not implicit by array index during mutations)
4. **Flat array:** Simplifies reordering, searching, filtering operations
5. **Backward compatibility:** Keep `stationLayout` optional for migration period

---

#### 1.2.2 Migration Strategy

**File:** `src/data/storage/practiceSessionStorage.ts`

**On-Demand Migration (Automatic, No User Action Required):**
```typescript
export async function loadPracticeSession(id: string): Promise<PracticeSession> {
  const json = await AsyncStorage.getItem(`@practice/${id}`);
  if (!json) return null;

  const session = JSON.parse(json);

  // BUILD 68: Migrate old sessions from stationLayout to timeline
  if (session.stationLayout && !session.timeline) {
    console.log('🔄 [BUILD 68] Migrating session to flat timeline...');

    const drills: DrillBlock[] = [];
    let order = 0;

    // Flatten all stations into single array
    session.stationLayout.stations.forEach((station, stationIndex) => {
      station.drills.forEach((drillBlock) => {
        drills.push({
          id: drillBlock.drill.id || `migrated-${Date.now()}-${order}`,
          drill: drillBlock.drill,
          timeMinutes: drillBlock.timeMinutes,
          reps: drillBlock.reps,
          bonusReps: drillBlock.bonusReps || 0,
          openTimeMinutes: drillBlock.openTimeMinutes || 0,
          assignedCoachId: drillBlock.assignedCoachId || getDefaultCoachId(),
          order: order++,
        });
      });
    });

    // Create timeline
    session.timeline = {
      drills,
      transitionTimeMinutes: session.stationLayout.transitionTimeMinutes,
      totalWallClockMinutes: session.stationLayout.totalWallClockMinutes,
    };

    // Save migrated version (persist to storage)
    await AsyncStorage.setItem(`@practice/${id}`, JSON.stringify(session));

    console.log(`✅ [BUILD 68] Migrated ${drills.length} drills to timeline`);
  }

  // Ensure drills are sorted by order
  if (session.timeline) {
    session.timeline.drills.sort((a, b) => a.order - b.order);
  }

  return session;
}
```

**Helper Function:**
```typescript
function getDefaultCoachId(): string {
  // Returns head coach ID from global coaching staff
  // Falls back to 'head-coach-default' if staff not initialized
  return 'head-coach-default';
}
```

**Migration Guarantees:**
1. ✅ Automatic migration on first load
2. ✅ No manual script needed
3. ✅ Old sessions work immediately in Build 68
4. ✅ Original `stationLayout` preserved (can rollback if needed)
5. ✅ Migration is idempotent (safe to run multiple times)

---

### 1.3 Code Simplification Benefits

#### Lines of Code Comparison

| Component | Build 67 (Nested) | Build 68 (Flat) | Reduction |
|-----------|-------------------|-----------------|-----------|
| Data Structure | 3 interfaces (Station, StationLayout, DrillBlock) | 2 interfaces (DrillBlock, PracticeTimeline) | -33% |
| Drill Reordering | 15-20 lines (cross-station moves) | 5-8 lines (array splice) | -60% |
| Coach Assignment | N/A (implicit by station) | 3 lines (update property) | Simple |
| Migration Logic | N/A | 15 lines (one-time) | Auto |
| Total Complexity | HIGH (nested mutations) | LOW (flat array ops) | -50% |

#### Cognitive Complexity Reduction

**Build 67 (Nested):**
```typescript
// Move drill from station 1 → station 0
const sourceStation = stationLayout.stations[1];
const targetStation = stationLayout.stations[0];
const [drill] = sourceStation.drills.splice(drillIndex, 1);  // Remove from source
targetStation.drills.splice(targetIndex, 0, drill);          // Add to target
// Update both stations...
// Re-calculate station durations...
// Validate coach assignments...
```

**Build 68 (Flat):**
```typescript
// Move drill from position 3 → position 1
const [drill] = drills.splice(3, 1);  // Remove
drills.splice(1, 0, drill);           // Insert
drills.forEach((d, i) => d.order = i); // Re-index
// Done.
```

**Result: Simpler → Fewer Bugs → Easier Testing**

---

## 👥 **PILLAR 2: Universal Staff Registry**

### 2.1 Global Coach Management System

#### 2.1.1 Data Structure

**File:** `src/data/types/coach.ts` (NEW)

```typescript
export interface Coach {
  id: string;                    // UUID (e.g., 'coach-uuid-1234')
  name: string;                  // Display name (e.g., 'Coach Smith')
  role: 'head' | 'assistant';    // Coach role
  specialties: string[];         // NEW: Coach areas of expertise (e.g., ['Hitting', 'Infield'])
  createdAt: number;             // Timestamp (for sorting)
  isActive: boolean;             // For soft delete (future feature)
}

export interface CoachingStaff {
  coaches: Coach[];              // Array of coaches (max 4)
  headCoachId: string;           // ID of head coach (always present)
  lastModified: number;          // Timestamp for cache invalidation
}
```

**Valid Specialty Tags:**
```typescript
export type CoachSpecialty =
  | 'Hitting'
  | 'Infield'
  | 'Outfield'
  | 'Pitching'
  | 'Baserunning'
  | 'Catching'
  | 'Team';

// Head Coach automatically has ALL specialties
// Assistants can have 1-7 specialties selected by user
```

**Storage Location:** AsyncStorage (State-Based)

**Storage Key:**
```typescript
const COACHING_STAFF_KEY = '@diamondscript/coachingStaff';
```

**Decision Rationale:**
- Small dataset (1 Head Coach + max 3 Assistants = 4 total)
- Infrequent changes (set once per season)
- No multi-device sync needed (device-specific)
- Fast access for UI rendering
- No server/database overhead

**Default State:**
```typescript
{
  coaches: [
    {
      id: 'head-coach-default',
      name: 'Head Coach',
      role: 'head',
      specialties: ['Hitting', 'Infield', 'Outfield', 'Pitching', 'Baserunning', 'Catching', 'Team'],  // All specialties
      createdAt: Date.now(),
      isActive: true
    }
  ],
  headCoachId: 'head-coach-default',
  lastModified: Date.now()
}
```

**Why Head Coach Has All Specialties:**
- Head Coach is the fallback for all unassigned drills
- Ensures every drill can always be assigned to someone
- Simplifies auto-assignment logic (no "orphaned" drills)

---

#### 2.1.2 CRUD Operations

**File:** `src/data/storage/coachingStorage.ts` (NEW)

**Load Coaching Staff (or Create Default):**
```typescript
export async function loadCoachingStaff(): Promise<CoachingStaff> {
  try {
    const json = await AsyncStorage.getItem(COACHING_STAFF_KEY);
    if (!json) {
      const defaultStaff = getDefaultStaff();
      await saveCoachingStaff(defaultStaff);
      return defaultStaff;
    }
    return JSON.parse(json);
  } catch (error) {
    console.error('Failed to load coaching staff:', error);
    return getDefaultStaff();
  }
}
```

**Save Coaching Staff:**
```typescript
export async function saveCoachingStaff(staff: CoachingStaff): Promise<void> {
  staff.lastModified = Date.now();
  await AsyncStorage.setItem(COACHING_STAFF_KEY, JSON.stringify(staff));
}
```

**Add Assistant Coach:**
```typescript
export async function addCoach(name: string): Promise<Coach> {
  const staff = await loadCoachingStaff();

  // Validate: Max 3 assistants
  const assistantCount = staff.coaches.filter(c => c.role === 'assistant').length;
  if (assistantCount >= 3) {
    throw new Error('Maximum 3 assistant coaches allowed');
  }

  // Create new coach
  const newCoach: Coach = {
    id: `coach-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    name: name.trim(),
    role: 'assistant',
    specialties: [],               // Empty by default, user sets via UI
    createdAt: Date.now(),
    isActive: true,
  };

  // Save
  staff.coaches.push(newCoach);
  await saveCoachingStaff(staff);

  return newCoach;
}
```

**Remove Coach:**
```typescript
export async function removeCoach(coachId: string): Promise<void> {
  const staff = await loadCoachingStaff();

  // Validate: Cannot remove head coach
  if (coachId === staff.headCoachId) {
    throw new Error('Cannot remove head coach');
  }

  // Remove from list
  staff.coaches = staff.coaches.filter(c => c.id !== coachId);
  await saveCoachingStaff(staff);

  // Note: Practice sessions will auto-migrate removed coach to head coach on load
}
```

**Rename Coach:**
```typescript
export async function renameCoach(coachId: string, newName: string): Promise<void> {
  const staff = await loadCoachingStaff();
  const coach = staff.coaches.find(c => c.id === coachId);

  if (!coach) throw new Error('Coach not found');

  coach.name = newName.trim();
  await saveCoachingStaff(staff);
}
```

**Update Coach Specialties:**
```typescript
export async function updateCoachSpecialties(
  coachId: string,
  specialties: CoachSpecialty[]
): Promise<void> {
  const staff = await loadCoachingStaff();
  const coach = staff.coaches.find(c => c.id === coachId);

  if (!coach) throw new Error('Coach not found');

  // Head Coach always keeps all specialties (immutable)
  if (coach.id === staff.headCoachId) {
    console.warn('Cannot modify Head Coach specialties (always has all)');
    return;
  }

  // Update assistant coach specialties
  coach.specialties = specialties;
  await saveCoachingStaff(staff);

  // Note: Existing drill assignments are NOT changed
  // User must manually re-assign or use "Re-optimize Assignments" button
}
```

**Business Rules:**
1. Head Coach is **immutable** (cannot be removed, only renamed)
2. Head Coach **always has all specialties** (cannot be changed)
3. Max 3 assistant coaches (4 total including head coach)
4. Assistants can have 0-7 specialties (user-selected)
5. Removing a coach **unassigns** them from all drills (auto-migrate to head coach)
6. Deleting a practice plan **does not** delete coaches
7. Changing specialties **does not auto-reassign** existing drills (manual re-optimization required)

---

### 2.2 Coaching Management Screen

**File:** `app/(tabs)/coaching.tsx` (NEW)

**Screen Layout:**
```
┌─────────────────────────────────────┐
│  Coaching Staff                     │
│                                     │
│  ┌─────────────────────────────┐   │
│  │ Head Coach                  │   │
│  │ [Rename]                    │   │
│  │ Specialties: All (Fixed)    │   │  ← Immutable
│  └─────────────────────────────┘   │
│                                     │
│  Assistant Coaches (2/3)            │
│  ┌─────────────────────────────┐   │
│  │ Coach Smith    [Edit] [❌]  │   │
│  │ Specialties:                │   │
│  │ [Hitting] [Infield] [+]     │   │  ← Multi-select tags
│  └─────────────────────────────┘   │
│  ┌─────────────────────────────┐   │
│  │ Coach Jones    [Edit] [❌]  │   │
│  │ Specialties:                │   │
│  │ [Outfield] [Baserunning][+] │   │  ← Multi-select tags
│  └─────────────────────────────┘   │
│                                     │
│  [+ Add Assistant Coach]            │
│                                     │
│  ℹ️  Specialties help auto-assign  │
│     drills to coaches in practice.  │
└─────────────────────────────────────┘
```

**Specialty Selector Modal:**
```
┌─────────────────────────────────────┐
│  Set Specialties for Coach Smith    │
│                                     │
│  Select areas of expertise:         │
│  ┌─────────────────────────────┐   │
│  │ ☑ Hitting                   │   │
│  │ ☑ Infield                   │   │
│  │ ☐ Outfield                  │   │
│  │ ☐ Pitching                  │   │
│  │ ☐ Baserunning               │   │
│  │ ☐ Catching                  │   │
│  │ ☐ Team                      │   │
│  └─────────────────────────────┘   │
│                                     │
│  [Cancel]             [Save (2)]    │  ← Shows count
└─────────────────────────────────────┘
```

**Component Hierarchy:**
```typescript
export default function CoachingScreen() {
  const [staff, setStaff] = useState<CoachingStaff | null>(null);
  const [newCoachName, setNewCoachName] = useState('');
  const [editingCoachId, setEditingCoachId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  useEffect(() => {
    loadCoachingStaff().then(setStaff);
  }, []);

  const handleAddCoach = async () => { /* ... */ };
  const handleRemoveCoach = (coach: Coach) => { /* ... */ };
  const handleRenameCoach = async (coachId: string) => { /* ... */ };

  const headCoach = staff.coaches.find(c => c.id === staff.headCoachId);
  const assistants = staff.coaches.filter(c => c.role === 'assistant');

  return (
    <ScrollView>
      <HeadCoachCard coach={headCoach} onRename={handleRename} />
      <AssistantCoachList
        coaches={assistants}
        onEdit={handleEdit}
        onRemove={handleRemove}
      />
      <AddCoachButton onPress={() => setIsAddingCoach(true)} />
    </ScrollView>
  );
}
```

**Tab Bar Addition:**

**File:** `app/(tabs)/_layout.tsx`

```typescript
<Tabs.Screen
  name="coaching"
  options={{
    title: 'Coaching',
    tabBarIcon: ({ color, size }) => (
      <Ionicons name="people" size={size} color={color} />
    ),
  }}
/>
```

---

## 🎨 **PILLAR 3: Coach Assignment UI**

### 3.1 Coach Badge System

**Color Coding Scheme:**
```typescript
const COACH_COLORS = {
  head: '#1B4332',       // Forest Green (Head Coach)
  assistant1: '#3B82F6', // Blue (Assistant 1)
  assistant2: '#F59E0B', // Amber (Assistant 2)
  assistant3: '#10B981', // Emerald (Assistant 3)
};
```

**Why This Color Scheme:**
- **Green:** Primary brand color, highest contrast for head coach
- **Blue:** Strong visual distinction, common for secondary roles
- **Amber:** Warm contrast to blue, highly visible
- **Emerald:** Complements green, maintains color family

**Color Assignment Logic:**
```typescript
function getCoachColor(coachId: string, staff: CoachingStaff): string {
  const coach = staff.coaches.find(c => c.id === coachId);
  if (!coach) return '#9CA3AF'; // Gray fallback

  if (coach.id === staff.headCoachId) return COACH_COLORS.head;

  // Assign assistant colors based on creation order
  const assistantIndex = staff.coaches
    .filter(c => c.role === 'assistant')
    .findIndex(c => c.id === coachId);

  return COACH_COLORS[`assistant${assistantIndex + 1}`] || '#9CA3AF';
}
```

---

### 3.2 Coach Dropdown + Badge on Drill Cards

**File:** `components/DrillCard.tsx` (MODIFY)

**Current Props (Build 67):**
```typescript
interface DrillCardProps {
  drillBlock: DrillBlock;
  stationIndex: number;
  blockIndex: number;
  isLast: boolean;
  isFirst: boolean;
  transitionMinutes: number;
  isEditMode?: boolean;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
}
```

**New Props (Build 68):**
```typescript
interface DrillCardProps {
  drillBlock: DrillBlock;
  coachingStaff: CoachingStaff;        // NEW: Global coach list
  onCoachChange: (drillId: string, coachId: string) => void;  // NEW
  // ... existing props
}
```

**Component Structure:**
```typescript
import { Picker } from '@react-native-picker/picker';

export function DrillCard({ drillBlock, coachingStaff, onCoachChange }: DrillCardProps) {
  const assignedCoach = coachingStaff.coaches.find(c => c.id === drillBlock.assignedCoachId);
  const coachColor = getCoachColor(drillBlock.assignedCoachId, coachingStaff);

  return (
    <View style={styles.card}>
      {/* Drill Info */}
      <Text style={styles.drillName}>{drillBlock.drill.name}</Text>
      <Text style={styles.drillMeta}>
        Duration: {drillBlock.timeMinutes} min | Reps: {drillBlock.reps}
      </Text>

      {/* COACH BADGE (Color-coded bar + name) */}
      <View style={[styles.coachBadge, { borderLeftColor: coachColor }]}>
        <Ionicons name="person" size={16} color={coachColor} />
        <Text style={styles.coachBadgeText}>{assignedCoach?.name || 'Head Coach'}</Text>
      </View>

      {/* COACH DROPDOWN */}
      <Picker
        selectedValue={drillBlock.assignedCoachId}
        onValueChange={(coachId) => onCoachChange(drillBlock.id, coachId)}
        style={styles.coachPicker}
      >
        {coachingStaff.coaches.map(coach => (
          <Picker.Item key={coach.id} label={coach.name} value={coach.id} />
        ))}
      </Picker>

      {/* ... existing drill card content ... */}
    </View>
  );
}
```

**Styles:**
```typescript
const styles = StyleSheet.create({
  coachBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    paddingLeft: 8,
    borderLeftWidth: 4,  // Color bar (uses coachColor)
    gap: 8,
  },
  coachBadgeText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
  },
  coachPicker: {
    marginTop: 8,
    height: 40,
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
  },
});
```

---

### 3.3 Smart Coordinator: Auto-Assignment Engine

**Goal:** Minimize manual effort for Head Coach by intelligently matching drills to coaches based on specialties.

---

#### 3.3.1 Drill Category → Coach Specialty Mapping

**Mapping Logic:**

| Drill Category | Matches Coach Specialties |
|----------------|---------------------------|
| `hitting` | `Hitting` |
| `fielding` | `Infield`, `Outfield` |
| `pitching` | `Pitching` |
| `baserunning` | `Baserunning` |
| `catching` | `Catching` |
| *Any* | `Team` (universal fallback) |

**Implementation:**
```typescript
// File: src/logic/coachMatcher.ts (NEW)

export function getMatchingCoaches(
  drill: Drill,
  staff: CoachingStaff
): Coach[] {
  const category = drill.category.toLowerCase();

  // Define specialty mappings
  const specialtyMap: Record<string, CoachSpecialty[]> = {
    hitting: ['Hitting'],
    fielding: ['Infield', 'Outfield'],
    pitching: ['Pitching'],
    baserunning: ['Baserunning'],
    catching: ['Catching'],
  };

  const requiredSpecialties = specialtyMap[category] || [];

  // Find coaches that match ANY of the required specialties OR have 'Team'
  return staff.coaches.filter(coach =>
    coach.specialties.some(s =>
      requiredSpecialties.includes(s) || s === 'Team'
    )
  );
}
```

---

#### 3.3.2 Auto-Assignment Flow

**Assignment Logic:**

```typescript
// File: src/logic/coachMatcher.ts (continued)

export function autoAssignDrill(
  drill: Drill,
  staff: CoachingStaff
): string | null {
  const matches = getMatchingCoaches(drill, staff);

  // CASE 1: Single Match (excluding head coach)
  const assistantMatches = matches.filter(c => c.role === 'assistant');
  if (assistantMatches.length === 1) {
    return assistantMatches[0].id;  // Auto-assign to assistant
  }

  // CASE 2: Multiple Matches (excluding head coach)
  if (assistantMatches.length > 1) {
    return assistantMatches[0].id;  // Assign to first assistant found
  }

  // CASE 3: No Match (Draft Mode)
  if (matches.length === 0 || matches.every(c => c.role === 'head')) {
    return null;  // Unassigned - triggers "Draft Mode"
  }

  // CASE 4: Only Head Coach matches (fallback to Draft Mode)
  return null;
}
```

**When Auto-Assignment Runs:**
1. **Manual Practice Creation:** When user finishes selecting drills in Setup screen
2. **AI Practice Generation:** After AI plan is converted to PracticeSession
3. **Manual Re-Optimization:** User taps "Re-optimize Assignments" button in Practice Detail view

---

#### 3.3.3 Draft Mode (Unassigned Drills)

**Trigger:** Drill has `assignedCoachId: null`

**Visual State:**

```typescript
// File: components/DrillCard.tsx (MODIFY)

function DrillCard({ drillBlock, coachingStaff }: DrillCardProps) {
  const isUnassigned = !drillBlock.assignedCoachId;

  if (isUnassigned) {
    return (
      <View style={[styles.card, styles.unassignedCard]}>
        {/* Drill Info */}
        <Text style={styles.drillName}>{drillBlock.drill.name}</Text>

        {/* UNASSIGNED BADGE */}
        <View style={styles.unassignedBadge}>
          <Ionicons name="alert-circle-outline" size={16} color="#9CA3AF" />
          <Text style={styles.unassignedText}>No Coach Match Found</Text>
        </View>

        {/* COACH DROPDOWN (Manual Override Always Available) */}
        <Picker
          selectedValue={drillBlock.assignedCoachId || coachingStaff.headCoachId}
          onValueChange={(coachId) => onCoachChange(drillBlock.id, coachId)}
          style={styles.coachPicker}
        >
          {coachingStaff.coaches.map(coach => (
            <Picker.Item key={coach.id} label={coach.name} value={coach.id} />
          ))}
        </Picker>
      </View>
    );
  }

  // ... normal assigned card rendering ...
}
```

**Styles:**
```typescript
const styles = StyleSheet.create({
  unassignedCard: {
    borderColor: '#D1D5DB',      // Gray border
    backgroundColor: '#F9FAFB',   // Light gray background
  },
  unassignedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    paddingLeft: 8,
    gap: 8,
  },
  unassignedText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#9CA3AF',
    fontStyle: 'italic',
  },
});
```

---

#### 3.3.4 Home Screen Notification

**Trigger:** Practice session has one or more unassigned drills

**Visual Alert:**

```typescript
// File: app/(tabs)/index.tsx (Home Screen)

function HomeScreen() {
  const [sessions, setSessions] = useState<PracticeSession[]>([]);

  // Check for unassigned drills
  const unassignedCounts = sessions.map(session => ({
    sessionId: session.id,
    count: session.timeline.drills.filter(d => !d.assignedCoachId).length,
  }));

  const totalUnassigned = unassignedCounts.reduce((sum, s) => sum + s.count, 0);

  return (
    <View>
      {totalUnassigned > 0 && (
        <View style={styles.alertBanner}>
          <Ionicons name="alert-circle" size={20} color="#F59E0B" />
          <Text style={styles.alertText}>
            {totalUnassigned} drill{totalUnassigned > 1 ? 's' : ''} need coach assignment
          </Text>
          <TouchableOpacity onPress={() => navigateToPracticePlans()}>
            <Text style={styles.alertLink}>Review →</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ... rest of home screen ... */}
    </View>
  );
}
```

---

#### 3.3.5 Bulk Actions: "Claim All Unassigned"

**Location:** Practice Detail view (wherever practice plan is displayed)

**Button Placement:**
```
┌─────────────────────────────────────┐
│  Practice Plan                      │
│  [Edit Order] [Claim All Unassigned]│  ← New button
│                                     │
│  ┌─────────────────────────────┐   │
│  │ Drill A   📦 Library        │   │
│  │ Coach: Head Coach           │   │
│  └─────────────────────────────┘   │
│  ┌─────────────────────────────┐   │
│  │ Drill B   👤 Created        │   │
│  │ Coach: [No Match Found] ⚠️  │   │  ← Unassigned (gray)
│  └─────────────────────────────┘   │
└─────────────────────────────────────┘
```

**Implementation:**
```typescript
// File: app/(tabs)/practice-plan.tsx

const handleClaimAllUnassigned = async () => {
  const unassignedDrills = session.timeline.drills.filter(d => !d.assignedCoachId);

  if (unassignedDrills.length === 0) {
    Alert.alert('No Unassigned Drills', 'All drills already have a coach.');
    return;
  }

  // Confirm action
  Alert.alert(
    'Claim All Unassigned',
    `Assign all ${unassignedDrills.length} unassigned drills to you (Head Coach)?`,
    [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Claim All',
        onPress: async () => {
          // Assign all to head coach
          const updatedDrills = session.timeline.drills.map(drill => ({
            ...drill,
            assignedCoachId: drill.assignedCoachId || staff.headCoachId,
          }));

          // Save updated session
          const updatedSession = {
            ...session,
            timeline: { ...session.timeline, drills: updatedDrills },
          };

          await savePracticeSession(updatedSession);
          setSession(updatedSession);

          Alert.alert('Success', `${unassignedDrills.length} drills assigned to Head Coach`);
        },
      },
    ]
  );
};
```

**Button Visibility:**
```typescript
const unassignedCount = session.timeline.drills.filter(d => !d.assignedCoachId).length;

return (
  <View>
    {unassignedCount > 0 && (
      <TouchableOpacity
        style={styles.claimButton}
        onPress={handleClaimAllUnassigned}
      >
        <Text style={styles.claimButtonText}>
          Claim All Unassigned ({unassignedCount})
        </Text>
      </TouchableOpacity>
    )}
  </View>
);
```

---

#### 3.3.6 Manual Override (Always Available)

**Principle:** User always has final control

**Implementation:**
- Coach dropdown on DrillCard ALWAYS allows manual selection
- Manual selection OVERRIDES auto-assignment
- No confirmation needed - immediate update
- Saved to `timeline.drills[].assignedCoachId`

```typescript
// File: components/DrillCard.tsx

function DrillCard({ drillBlock, coachingStaff, onCoachChange }: DrillCardProps) {
  return (
    <View style={styles.card}>
      {/* ... drill info, badges ... */}

      {/* MANUAL OVERRIDE DROPDOWN (ALWAYS PRESENT) */}
      <Picker
        selectedValue={drillBlock.assignedCoachId || coachingStaff.headCoachId}
        onValueChange={(coachId) => {
          // Immediate update - no confirmation
          onCoachChange(drillBlock.id, coachId);
        }}
        style={styles.coachPicker}
      >
        {coachingStaff.coaches.map(coach => (
          <Picker.Item key={coach.id} label={coach.name} value={coach.id} />
        ))}
      </Picker>
    </View>
  );
}
```

---

#### 3.3.7 Data Integrity & Safety Guarantees

**Frontend State Only:**
✅ No changes to `src/services/aiPracticeService.ts`
✅ No changes to Build 67 auth logic
✅ All matching logic in `src/logic/coachMatcher.ts` (NEW file)
✅ Pure functions - no side effects

**Persistence:**
✅ Assignments saved to `timeline.drills[].assignedCoachId`
✅ Stored in AsyncStorage via `practiceSessionStorage.ts`
✅ Survives app restarts
✅ Backward compatible with Build 67 sessions

**Migration Safety:**
✅ Old sessions without `assignedCoachId` → auto-assign to head coach
✅ Old sessions without `specialties` → empty array (no auto-assignment)
✅ No data loss on rollback

---

#### 3.3.8 Testing Checklist

**Auto-Assignment:**
- [ ] Create assistant with 'Hitting' specialty
- [ ] Add hitting drill → verify auto-assigned to assistant
- [ ] Add fielding drill → verify unassigned (no 'Infield' or 'Outfield' specialty)
- [ ] Add drill with 'Team' specialty assistant → verify assigned

**Draft Mode:**
- [ ] Add drill with no matching specialties → verify gray/unassigned state
- [ ] Verify Home Screen shows notification
- [ ] Tap "Claim All Unassigned" → verify all assigned to head coach

**Manual Override:**
- [ ] Auto-assigned drill → manually change coach → verify saved
- [ ] Unassigned drill → manually assign → verify saved

**Persistence:**
- [ ] Assign drills, close app, reopen → verify assignments persist
- [ ] Migrate old Build 67 session → verify drills assigned to head coach

---

## 🔄 **PILLAR 4: Coach-Agnostic Edit Order (Lean Flow)**

### 4.1 Existing Edit Order UI (No Changes Needed)

**Assumption:** DiamondScript already has an "Edit Order" button/mode that allows reordering drills.

**Current Implementation (Build 67):**
- Likely uses FlatList with manual up/down arrows
- Reorders drills within a coach's section
- Updates `drillBlock.order` or array index

**What Changes in Build 68:**
- ✅ Same UI (no visual changes)
- ✅ Same reorder logic (splice + insert)
- ✅ Works across entire flat array (not restricted to sections)
- ✅ `assignedCoachId` automatically moves with drill

---

### 4.2 Universal Shuffling Logic

**File:** `app/(tabs)/practice-plan.tsx` (or wherever practice plan is displayed)

**State Management:**
```typescript
const [drills, setDrills] = useState<DrillBlock[]>(session.timeline.drills);
```

**Move Up Logic:**
```typescript
const handleMoveUp = (index: number) => {
  if (index === 0) return; // Already at top

  const newDrills = [...drills];
  const [drill] = newDrills.splice(index, 1);   // Remove drill
  newDrills.splice(index - 1, 0, drill);        // Insert one position up

  // Re-index all drills
  const reindexed = newDrills.map((d, i) => ({ ...d, order: i }));

  setDrills(reindexed);
  savePracticeSession({ ...session, timeline: { ...timeline, drills: reindexed } });
};
```

**Move Down Logic:**
```typescript
const handleMoveDown = (index: number) => {
  if (index === drills.length - 1) return; // Already at bottom

  const newDrills = [...drills];
  const [drill] = newDrills.splice(index, 1);   // Remove drill
  newDrills.splice(index + 1, 0, drill);        // Insert one position down

  // Re-index
  const reindexed = newDrills.map((d, i) => ({ ...d, order: i }));

  setDrills(reindexed);
  savePracticeSession({ ...session, timeline: { ...timeline, drills: reindexed } });
};
```

**Key Point:** The existing UI works as-is. The only change is that it now operates on a flat array instead of nested sections.

---

## 🐛 **PILLAR 5: UI Bug Fixes**

### 5.1 Drill Library: The "Two Buckets" Problem

**Location:** `app/(tabs)/drills.tsx`

**Symptom:**
- Home Screen shows "Saved: 15"
- User clicks to Drill Library
- Only 10 drills actually appear in the list
- **5 starred library drills have "disappeared"**

**Root Cause: Display Logic Mismatch**

**Current Broken Behavior:**
```typescript
// HOME SCREEN: Counts BOTH buckets
const savedCount = starredDrills.size + customDrills.length;  // 10 starred + 5 custom = 15

// DRILL LIBRARY: Only displays ONE bucket
const displayedDrills = customDrills;  // Only shows user-created drills (5 items)
// Starred library drills are NOT shown!
```

**Why This Breaks UX:**
1. **Home Screen:** "You have 15 saved drills" ✅
2. **User clicks "View All"**
3. **Drill Library:** Shows only 10 drills ❌
4. **User Confusion:** "Where did the other 5 drills go?"

**The Two Buckets:**
- **Bucket 1:** Starred App Drills (from seed catalog) → Currently HIDDEN in Drill Library
- **Bucket 2:** User-Created Drills → Currently SHOWN in Drill Library

---

**Solution: Unified Filter with Source Badges**

**Step 1: Merge the Views**

Update the "Saved" tab filter to show BOTH buckets:

```typescript
// File: app/(tabs)/drills.tsx

// Get starred drills from seed catalog
const starredDrillObjects = Array.from(starredDrills)
  .map(drillId => seedDrills.find(d => d.id === drillId))
  .filter(Boolean);  // Filter out any undefined

// Combine both sources
const allSavedDrills = [
  ...starredDrillObjects.map(drill => ({ drill, source: 'library' as const })),
  ...customDrills.map(drill => ({ drill, source: 'created' as const })),
];

// Apply category filter (if needed)
const displayedDrills = allSavedDrills.filter(({ drill }) => {
  if (selectedCategory !== 'all') {
    return drill.category === selectedCategory;
  }
  return true;
});

// Count matches display
const savedCount = displayedDrills.length;
```

---

**Step 2: Add Visual Source Badges**

Each drill card in the Saved list needs a source indicator:

```typescript
// File: components/DrillCard.tsx (or inline in drills.tsx)

interface DrillItemProps {
  drill: Drill;
  source: 'library' | 'created';
}

function DrillItem({ drill, source }: DrillItemProps) {
  return (
    <View style={styles.drillCard}>
      <View style={styles.drillHeader}>
        <Text style={styles.drillName}>{drill.name}</Text>

        {/* SOURCE BADGE */}
        <View style={[styles.sourceBadge, source === 'library' ? styles.libraryBadge : styles.createdBadge]}>
          <Text style={styles.badgeIcon}>{source === 'library' ? '📦' : '👤'}</Text>
          <Text style={styles.badgeText}>{source === 'library' ? 'Library' : 'Created'}</Text>
        </View>
      </View>

      {/* ... rest of drill card ... */}
    </View>
  );
}
```

**Badge Styles:**
```typescript
const styles = StyleSheet.create({
  sourceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  libraryBadge: {
    backgroundColor: '#DBEAFE',  // Light blue
  },
  createdBadge: {
    backgroundColor: '#D1FAE5',  // Light green
  },
  badgeIcon: {
    fontSize: 12,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#374151',
  },
});
```

---

**Step 3: Home Screen Count Sync**

Ensure the Home Screen uses the SAME logic:

```typescript
// File: app/(tabs)/index.tsx (Home Screen)

const starredCount = starredDrills.size;
const customCount = customDrills.length;
const totalSaved = starredCount + customCount;

return (
  <View>
    <Text>Saved Drills: {totalSaved}</Text>
    {/* When user taps, navigate to drills.tsx with 'Saved' filter active */}
  </View>
);
```

**Guarantee:** This count will ALWAYS match what's displayed in the Drill Library "Saved" tab.

---

**Step 4: Filter UI (Optional Enhancement)**

Add a visual toggle to let users filter by source:

```
┌─────────────────────────────────────┐
│  Saved Drills (15)                  │
│                                     │
│  [All] [📦 Library] [👤 Created]   │  ← Source filter
│                                     │
│  ┌─────────────────────────────┐   │
│  │ Tee Ball Drill  📦 Library  │   │
│  └─────────────────────────────┘   │
│  ┌─────────────────────────────┐   │
│  │ My Custom Drill 👤 Created  │   │
│  └─────────────────────────────┘   │
└─────────────────────────────────────┘
```

**Implementation:**
```typescript
const [sourceFilter, setSourceFilter] = useState<'all' | 'library' | 'created'>('all');

const filteredBySource = allSavedDrills.filter(({ source }) => {
  if (sourceFilter === 'all') return true;
  return source === sourceFilter;
});
```

---

**Technical Requirements:**

1. **Pure UI/State Level:** No changes to Build 67 auth core
2. **No Database Changes:** All data already exists in AsyncStorage
3. **Backward Compatible:** Works with existing starred drills and custom drills
4. **Performance:** Combine arrays only when "Saved" filter is active
5. **Testable:** Can verify count === displayedDrills.length

**Files Modified:**
- `app/(tabs)/drills.tsx` - Unified filter logic
- `components/DrillCard.tsx` (or inline) - Source badge rendering
- `app/(tabs)/index.tsx` - Ensure count sync (may already be correct)

**Testing Checklist:**
- [ ] Star 5 library drills
- [ ] Create 3 custom drills
- [ ] Home Screen shows "Saved: 8"
- [ ] Open Drill Library → "Saved" tab shows 8 drills
- [ ] Each drill has correct source badge (📦 or 👤)
- [ ] Category filter works on combined list
- [ ] Search works on combined list
- [ ] No starred drills "disappear"

---

### 5.2 AI Lab: Clear Button for Special Instructions

**Location:** `app/(tabs)/setup.tsx` (or wherever Special Instructions field is)

**Problem:**
- User types custom instructions in "Special Instructions" field
- No way to clear the field without manually deleting all text
- If user generates plan with instructions, then wants to generate without, must manually clear

**Solution: Add Conditional Clear Button to Label**

**UI Placement (iOS Pattern):**
```
┌─────────────────────────────────────────┐
│ Special Instructions (Optional)  [Clear]│ ← Clear link in label
│ ┌─────────────────────────────────────┐ │
│ │ Focus on bunting, avoid...          │ │
│ │                                     │ │
│ └─────────────────────────────────────┘ │
└─────────────────────────────────────────┘
```

**Implementation:**
```typescript
<View style={styles.aiInputGroup}>
  <View style={styles.labelRow}>
    <Text style={styles.aiLabel}>Special Instructions (Optional)</Text>
    {specialInstructions.length > 0 && (
      <TouchableOpacity
        onPress={() => setSpecialInstructions('')}
        style={styles.clearButton}
      >
        <Text style={styles.clearButtonText}>Clear</Text>
      </TouchableOpacity>
    )}
  </View>
  <TextInput
    style={styles.multilineInput}
    value={specialInstructions}
    onChangeText={setSpecialInstructions}
    placeholder="e.g., Focus on bunting, avoid long sprints..."
    placeholderTextColor="#9CA3AF"
    multiline
    numberOfLines={3}
    textAlignVertical="top"
  />
</View>
```

**Styles:**
```typescript
labelRow: {
  flexDirection: 'row',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: 8,
},
clearButton: {
  paddingHorizontal: 12,
  paddingVertical: 4,
},
clearButtonText: {
  color: '#3B82F6',  // Blue (iOS accent color)
  fontSize: 14,
  fontWeight: '500',
},
```

---

### 5.3 AI Lab: Countdown Timer Not Updating

**Location:** `app/(tabs)/ai.tsx`

**Symptom:**
- After generating AI plan, 5-minute cooldown starts
- Button shows "Cooldown: 5:00" but doesn't count down
- User must navigate away and back to see updated time

**Root Cause:**
Missing `aiCooldownUntil` in `useEffect` dependencies

**Current Code (Broken):**
```typescript
const [aiCooldownUntil, setAICooldownUntil] = useState<number>(0);
const [cooldownSeconds, setCooldownSeconds] = useState<number>(0);

useEffect(() => {
  const interval = setInterval(() => {
    const remaining = Math.max(0, Math.ceil((aiCooldownUntil - Date.now()) / 1000));
    setCooldownSeconds(remaining);
  }, 1000);

  return () => clearInterval(interval);
}, [/* MISSING: aiCooldownUntil */]);
```

**Fixed Implementation:**
```typescript
const [aiCooldownUntil, setAICooldownUntil] = useState<number>(0);
const [cooldownSeconds, setCooldownSeconds] = useState<number>(0);

// FIX: Proper useEffect with dependencies
useEffect(() => {
  // If no cooldown active, clear state and exit
  if (aiCooldownUntil === 0) {
    setCooldownSeconds(0);
    return;
  }

  // Calculate initial remaining time
  const calculateRemaining = () => {
    const now = Date.now();
    const remaining = Math.max(0, Math.ceil((aiCooldownUntil - now) / 1000));

    // If cooldown expired, clear it
    if (remaining === 0 && aiCooldownUntil > 0) {
      setAICooldownUntil(0);
    }

    return remaining;
  };

  // Set initial value
  setCooldownSeconds(calculateRemaining());

  // Update every second
  const interval = setInterval(() => {
    setCooldownSeconds(calculateRemaining());
  }, 1000);

  // CRITICAL: Cleanup interval on unmount or when aiCooldownUntil changes
  return () => clearInterval(interval);
}, [aiCooldownUntil]);  // ← FIX: Include aiCooldownUntil in dependencies
```

**Why This Works:**
1. **Dependency array includes `aiCooldownUntil`:** Effect re-runs when cooldown is set
2. **Cleanup function:** Prevents timer leak on unmount
3. **Auto-clear on expiry:** Sets `aiCooldownUntil` to 0 when countdown reaches 0
4. **Edge case handling:** If `aiCooldownUntil` is 0, doesn't start interval

---

## 🧪 **Testing Strategy**

### Unit Tests

**File:** `tests/data/coachingStorage.test.ts` (NEW)

```typescript
describe('Coaching Storage', () => {
  it('should load default staff with head coach', async () => {
    const staff = await loadCoachingStaff();
    expect(staff.coaches).toHaveLength(1);
    expect(staff.coaches[0].role).toBe('head');
  });

  it('should add assistant coach', async () => {
    await addCoach('Coach Smith');
    const staff = await loadCoachingStaff();
    expect(staff.coaches).toHaveLength(2);
  });

  it('should reject adding 4th assistant coach', async () => {
    await addCoach('Coach 1');
    await addCoach('Coach 2');
    await addCoach('Coach 3');
    await expect(addCoach('Coach 4')).rejects.toThrow('Maximum 3 assistant coaches');
  });

  it('should prevent removing head coach', async () => {
    const staff = await loadCoachingStaff();
    await expect(removeCoach(staff.headCoachId)).rejects.toThrow('Cannot remove head coach');
  });
});
```

---

### Integration Tests

**File:** `tests/integration/timeline-migration.test.ts` (NEW)

```typescript
describe('Timeline Migration', () => {
  it('should auto-migrate old sessions to timeline on load', async () => {
    // Create old Build 67 session (stationLayout only)
    const oldSession = {
      id: 'test-session',
      stationLayout: {
        stations: [
          { coachIndex: 0, drills: [drillA, drillB] },
          { coachIndex: 1, drills: [drillC] },
        ],
        transitionTimeMinutes: 2,
        totalWallClockMinutes: 60,
      },
    };

    await AsyncStorage.setItem('@practice/test-session', JSON.stringify(oldSession));

    // Load session (should auto-migrate)
    const loaded = await loadPracticeSession('test-session');

    // Verify timeline exists
    expect(loaded.timeline).toBeDefined();
    expect(loaded.timeline.drills).toHaveLength(3);

    // Verify flat array
    expect(loaded.timeline.drills[0].drill).toBe(drillA);
    expect(loaded.timeline.drills[1].drill).toBe(drillB);
    expect(loaded.timeline.drills[2].drill).toBe(drillC);

    // Verify order field
    expect(loaded.timeline.drills[0].order).toBe(0);
    expect(loaded.timeline.drills[1].order).toBe(1);
    expect(loaded.timeline.drills[2].order).toBe(2);
  });

  it('should assign default coach during migration', async () => {
    const oldSession = {
      id: 'test-session',
      stationLayout: {
        stations: [
          { coachIndex: 0, drills: [drillA] },
        ],
      },
    };

    await AsyncStorage.setItem('@practice/test-session', JSON.stringify(oldSession));

    const loaded = await loadPracticeSession('test-session');

    expect(loaded.timeline.drills[0].assignedCoachId).toBe('head-coach-default');
  });
});
```

---

### Regression Tests

**File:** `tests/regression/build67-auth.test.ts` (NEW)

```typescript
describe('Build 67 Authentication (Regression)', () => {
  it('should generate AI plan with JWT verification', async () => {
    const plan = await generateAIPracticePlan(mockRequest);
    expect(plan).toBeDefined();
    expect(plan.sections).toHaveLength(greaterThan(0));
  });

  it('should auto-repair on 401 error', async () => {
    // Mock 401 error from Edge Function
    mockSupabase.functions.invoke.mockRejectedValueOnce({
      context: { status: 401 }
    });

    // Mock successful retry
    mockSupabase.functions.invoke.mockResolvedValueOnce({
      data: mockAIPlan
    });

    const plan = await generateAIPracticePlan(mockRequest);
    expect(plan).toBeDefined();
    expect(mockSupabase.auth.signInAnonymously).toHaveBeenCalled();
  });
});
```

---

## 🎯 **Implementation Milestones**

### Milestone 1: Data Architecture (3 hours)
**Goal:** Implement flat timeline data structure

**Tasks:**
- [ ] Add `id`, `assignedCoachId`, `order` to DrillBlock interface
- [ ] Create `PracticeTimeline` interface
- [ ] Update `PracticeSession` to use `timeline` (keep `stationLayout` optional)
- [ ] Write migration logic (stationLayout → timeline)
- [ ] Test migration with old sessions

**Deliverables:**
- `src/data/types/practice.ts` updated
- `src/data/storage/practiceSessionStorage.ts` updated
- Migration tested with Build 67 sessions

**Exit Criteria:**
- TypeScript compiles without errors
- Old sessions auto-migrate on load
- Timeline drills sorted by `order` field

---

### Milestone 2: Coaching Staff Registry + Specialties (5 hours)
**Goal:** Implement global coaching staff management with specialty tracking

**Tasks:**
- [ ] Create `src/data/types/coach.ts` (Coach, CoachingStaff, CoachSpecialty)
- [ ] Create `src/data/storage/coachingStorage.ts` (CRUD + updateSpecialties)
- [ ] Create `app/(tabs)/coaching.tsx` (management screen with specialty selector)
- [ ] Add coaching tab to `app/(tabs)/_layout.tsx`
- [ ] Implement multi-select specialty selector modal
- [ ] Test add/remove/rename coaches
- [ ] Test specialty selection (0-7 tags per assistant)
- [ ] Verify head coach always has all specialties (immutable)

**Deliverables:**
- 3 new files (coach.ts, coachingStorage.ts, coaching.tsx)
- Coaching tab functional with specialty management
- Can manage up to 3 assistants
- Multi-select specialty UI functional

**Exit Criteria:**
- Can add/remove/rename coaches
- Can select/update specialties for assistants
- Max 3 assistants enforced
- Head coach cannot be removed
- Head coach specialties cannot be changed (always all 7)

---

### Milestone 3: Coach Assignment UI + Smart Coordinator (5 hours)
**Goal:** Add coach badges, dropdowns, and auto-assignment intelligence

**Tasks:**
- [ ] **Coach Badge & Dropdown:**
  - [ ] Add Coach Badge to `DrillCard.tsx` with color coding
  - [ ] Add Coach Dropdown to `DrillCard.tsx`
  - [ ] Load coaching staff in practice plan screen
  - [ ] Handle coach changes (update drill + save session)
- [ ] **Smart Coordinator Auto-Assignment:**
  - [ ] Create `src/logic/coachMatcher.ts` (mapping logic)
  - [ ] Implement drill category → specialty matching
  - [ ] Implement auto-assignment flow (single/multiple/no match)
  - [ ] Add "Draft Mode" UI for unassigned drills (gray state)
  - [ ] Add Home Screen notification for unassigned drills
  - [ ] Add "Claim All Unassigned" bulk action button
- [ ] **Testing:**
  - [ ] Test auto-assignment with various specialties
  - [ ] Test manual override
  - [ ] Test Draft Mode and bulk claim

**Deliverables:**
- `components/DrillCard.tsx` updated with badges + unassigned state
- `src/logic/coachMatcher.ts` created (auto-assignment logic)
- Home Screen notification functional
- "Claim All Unassigned" button functional
- All assignments persist to AsyncStorage

**Exit Criteria:**
- ✅ Badge shows coach name + color bar
- ✅ Dropdown changes assignment (manual override)
- ✅ Auto-assignment works for matching specialties
- ✅ Unassigned drills show gray/draft state
- ✅ Home Screen shows notification for unassigned drills
- ✅ "Claim All Unassigned" assigns all to head coach
- ✅ Changes saved to AsyncStorage
- ✅ No changes to aiPracticeService.ts or auth logic

---

### Milestone 4: Edit Order Integration (2 hours)
**Goal:** Verify existing Edit Order UI works with flat list

**Tasks:**
- [ ] Update Edit Order to operate on `timeline.drills` array
- [ ] Test move up/down across entire practice (not restricted to sections)
- [ ] Verify `assignedCoachId` moves with drill
- [ ] Test re-indexing of `order` field

**Deliverables:**
- Edit Order works on flat array
- Drills can be shuffled regardless of coach assignment

**Exit Criteria:**
- Can move drills to any position
- Coach assignment persists during reorder
- Order field updates correctly

---

### Milestone 5: UI Bug Fixes (3 hours)
**Goal:** Fix "Two Buckets" display logic, AI Lab countdown, Clear button

**Tasks:**
- [ ] **Drill Library "Two Buckets" Fix:**
  - [ ] Merge starred library drills + user-created drills into unified "Saved" view
  - [ ] Add source badges (📦 Library or 👤 Created) to each drill card
  - [ ] Sync Home Screen count with Drill Library displayed count
  - [ ] Update filter logic to include both sources when "Saved" is active
  - [ ] Test with mixed drill sources (starred + custom)
- [ ] **AI Lab Clear Button:**
  - [ ] Add conditional Clear button to Special Instructions label
  - [ ] Test show/hide behavior based on field content
- [ ] **AI Lab Countdown Timer:**
  - [ ] Fix useEffect dependency (add aiCooldownUntil)
  - [ ] Test countdown updates every second
- [ ] **Manual Testing:**
  - [ ] Test all 3 fixes with real user scenarios

**Deliverables:**
- "Two Buckets" problem resolved with unified view + source badges
- AI Lab Clear button functional
- AI Lab countdown timer fixed
- Manual testing complete

**Exit Criteria:**
- ✅ Starred library drills AND custom drills both appear in "Saved" tab
- ✅ Home Screen count matches Drill Library count exactly
- ✅ Each saved drill shows correct source badge (📦 or 👤)
- ✅ No drills "disappear" when navigating from Home → Drill Library
- ✅ Clear button appears/disappears correctly
- ✅ Countdown updates every second without memory leaks

---

### Milestone 6: Testing & Verification (3 hours)
**Goal:** Comprehensive testing of all Build 68 features

**Tasks:**
- [ ] Write unit tests for coaching storage
- [ ] Write integration tests for timeline migration
- [ ] Write regression tests for Build 67 auth
- [ ] Run full test suite (all existing + new tests)
- [ ] Manual test on physical device
- [ ] Verify no auth regression

**Deliverables:**
- 3 new test suites
- All tests passing (existing + new)
- Manual test checklist completed

**Exit Criteria:**
- 100% of existing tests pass
- New feature tests pass
- No 401 errors in AI Lab
- Edge Function logs show successful JWT verification

---

### Milestone 7: Version Bump & Documentation (1 hour)
**Goal:** Prepare Build 68 for deployment

**Tasks:**
- [ ] Increment `versionCode` to 68 in `app.json`
- [ ] Increment `CURRENT_BUILD` to 68 in `context/DrillsContext.tsx`
- [ ] Update all BUILD 67 references to BUILD 68 in modified files
- [ ] Create `BUILD_68_RELEASE_NOTES.md`
- [ ] Remove debug console logs

**Deliverables:**
- Version bumped to 68
- Release notes document
- All BUILD references updated
- Clean code (no debug logs)

**Exit Criteria:**
- `versionCode` is 68
- All BUILD references say "BUILD 68"
- Release notes complete
- Code is production-ready

---

### Milestone 8: Production Build (1 hour)
**Goal:** Build and deploy Build 68

**Tasks:**
- [ ] Run: `npx tsc --noEmit` (verify no TypeScript errors)
- [ ] Run: `npm run test` (verify all tests pass)
- [ ] Build production AAB: `eas build --platform android --profile production`
- [ ] Download AAB to `/Users/jinlee1978/DiamondScript-Builds/build-68-production/`
- [ ] Verify AAB size (~35 MB)
- [ ] Test on physical device

**Deliverables:**
- Production AAB file
- Build 68 release notes
- Manual test confirmation

**Exit Criteria:**
- AAB builds successfully
- No build errors or warnings
- Manual testing confirms all features work
- No auth regression detected

---

## 📊 **Risk Assessment**

### High Risk (Requires Careful Testing)
- ⚠️ **Timeline migration breaking old sessions**
  - Mitigation: Extensive testing with Build 67 sessions
  - Fallback: Keep `stationLayout` optional, allow rollback

- ⚠️ **Coach dropdown breaking existing drill cards**
  - Mitigation: Extensive testing with old sessions
  - Fallback: Default to head coach if assignedCoachId invalid

- ⚠️ **Countdown timer memory leak**
  - Mitigation: Proper `useEffect` cleanup
  - Fallback: Restart interval on component mount

### Medium Risk (Test But Unlikely to Break)
- ⚠️ **Drill library count fix breaking category filters**
  - Mitigation: Test all filter combinations
  - Fallback: Revert count logic if breaks filters

- ⚠️ **Clear button interfering with TextInput**
  - Mitigation: Proper z-index and positioning
  - Fallback: Use button below field instead

### Low Risk (Safe Changes)
- ✅ **Adding new coaching screen**
  - No existing code affected
  - New files only

- ✅ **Adding fields to DrillBlock**
  - Optional fields (backward compatible)
  - Migration handles old sessions

---

## ✅ **Success Criteria**

**Build 68 is ready for deployment when:**

1. ✅ **Flat Timeline Works:**
   - Practice plans use `timeline.drills` (flat array)
   - Old sessions auto-migrate on load
   - Edit Order works across entire plan (not restricted to sections)

2. ✅ **Coaching Staff Works:**
   - Can add/remove/rename coaches
   - Max 3 assistants enforced
   - Head coach is immutable

3. ✅ **Coach Assignment Works:**
   - Dropdown shows all coaches
   - Coach Badge displays with color coding (Green/Blue/Amber/Emerald)
   - Assignment persists through Edit Order

4. ✅ **UI Bugs Fixed:**
   - Drill Library count matches display
   - Clear button appears/works
   - Countdown updates every second

5. ✅ **Zero Regression:**
   - All existing tests pass
   - Build 67 auth unchanged
   - AI Lab still generates plans
   - No 401 errors

6. ✅ **All Tests Pass:**
   - Existing test suite (56 tests)
   - New coaching tests (10+ tests)
   - New regression tests (5+ tests)
   - Total: 70+ tests passing

7. ✅ **Manual Testing Complete:**
   - Test on physical Android device
   - Test all 4 new features
   - Verify no auth errors
   - Verify practice plan save/load works

8. ✅ **Documentation Complete:**
   - Technical plan finalized (this document)
   - Release notes written
   - Code comments updated

---

## 📝 **Files to Create**

### New Files (8 total):
1. `src/data/types/coach.ts` - Coach, CoachingStaff, CoachSpecialty interfaces
2. `src/data/storage/coachingStorage.ts` - CRUD operations + specialty management
3. `src/logic/coachMatcher.ts` - Smart Coordinator auto-assignment logic
4. `app/(tabs)/coaching.tsx` - Coaching management screen with specialty selector
5. `tests/data/coachingStorage.test.ts` - Unit tests for coaching storage
6. `tests/integration/timeline-migration.test.ts` - Integration tests for migration
7. `tests/regression/build67-auth.test.ts` - Regression tests for auth
8. `BUILD_68_RELEASE_NOTES.md` - Release documentation

---

## 📝 **Files to Modify**

### Data Layer (3 files):
1. `src/data/types/practice.ts`
   - Add `id`, `assignedCoachId`, `order` to DrillBlock
   - Create PracticeTimeline interface
   - Update PracticeSession to use timeline

2. `src/data/storage/practiceSessionStorage.ts`
   - Add migration logic (stationLayout → timeline)
   - Ensure drills sorted by order

3. `src/data/types/index.ts`
   - Export new Coach and CoachingStaff types

### UI Layer (5 files):
4. `components/DrillCard.tsx`
   - Add Coach Badge with color coding
   - Add Coach Dropdown (manual override)
   - Add "Draft Mode" unassigned state (gray styling)
   - Accept new props (coachingStaff, onCoachChange)

5. `app/(tabs)/_layout.tsx`
   - Add coaching tab to tab bar

6. `app/(tabs)/drills.tsx`
   - Fix "Two Buckets" problem: merge starred library drills + custom drills
   - Add source badges (📦 Library or 👤 Created)
   - Unified filter logic for "Saved" tab

7. `app/(tabs)/index.tsx` (Home Screen)
   - Verify count sync with Drill Library (may already be correct)
   - Ensure count includes both starred and custom drills
   - Add notification banner for unassigned drills (Smart Coordinator)

8. `app/(tabs)/practice-plan.tsx` (or wherever practice plan is displayed)
   - Add "Claim All Unassigned" bulk action button
   - Integrate auto-assignment on practice creation

9. `app/(tabs)/setup.tsx` OR `app/(tabs)/ai.tsx`
   - Add Clear button to Special Instructions field
   - Fix countdown timer useEffect dependency

### Configuration (2 files):
10. `app.json`
   - Increment versionCode to 68

11. `context/DrillsContext.tsx`
   - Increment CURRENT_BUILD to 68

---

## 🔒 **Files NOT Modified (Immutable)**

```
✋ CRITICAL - DO NOT MODIFY:

Authentication Core:
├── src/services/aiPracticeService.ts (Lines 39-233: Auth logic)
├── src/config/supabase.ts (initializeAuth function)
├── supabase/functions/generate-practice-plan/index.ts (JWT verification)
└── supabase/functions/deploy.sh (--no-verify-jwt flag)

Build Configuration:
├── eas.json (production profile)
└── .easignore (build optimization)
```

---

## ⏱️ **Total Estimated Time**

| Milestone | Hours |
|-----------|-------|
| 1. Data Architecture | 3 |
| 2. Coaching Staff Registry | 4 |
| 3. Coach Assignment UI | 3 |
| 4. Edit Order Integration | 2 |
| 5. UI Bug Fixes | 3 |
| 6. Testing & Verification | 3 |
| 7. Version Bump & Documentation | 1 |
| 8. Production Build | 1 |
| **TOTAL** | **20 hours** |

**Expected Duration:** 2-3 days of focused work

---

## 📋 **Approval Checklist**

- [ ] **Flat Timeline Architecture:** Approved (single array, no nested stations)?
- [ ] **Universal Staff Registry:** Approved (AsyncStorage, max 3 assistants)?
- [ ] **Coach Badge System:** Approved (color-coded: Green/Blue/Amber/Emerald)?
- [ ] **Edit Order UI:** Approved (leverage existing UI, no drag-and-drop)?
- [ ] **UI Bug Fixes:** Approved (3 bug fixes as specified)?
- [ ] **Migration Strategy:** Approved (on-demand, automatic, no user action)?
- [ ] **Security:** Verified no changes to Build 67 auth?
- [ ] **Timeline:** 20 hours acceptable?

---

## 📝 **Next Steps After Approval**

1. **User reviews this complete architecture plan**
2. **User approves specific implementation approach for each pillar**
3. **Begin Milestone 1: Data Architecture** (only after user approval)
4. **Present implementation results before proceeding to next milestone**
5. **Implement features incrementally (one milestone at a time)**
6. **Test after each milestone**
7. **Final review before production build**

---

**Plan Status:** ⏳ AWAITING USER APPROVAL

**Estimated Total Time:** 20 hours (2-3 days of focused work)

**Key Architectural Decisions:**
1. ✅ Flat list architecture (no nested stations)
2. ✅ AsyncStorage for coaching staff (not database)
3. ✅ On-demand migration (no manual script)
4. ✅ Leverage existing Edit Order UI (no drag-and-drop)
5. ✅ Color-coded coach badges (Green/Blue/Amber/Emerald)
6. ✅ Zero changes to Build 67 authentication

---

**IMPORTANT REMINDER:**
This document is **ARCHITECTURAL DOCUMENTATION ONLY**. No code implementation should begin until:
1. User has reviewed this complete plan
2. User has explicitly approved the approach
3. User has given permission to begin Milestone 1

**User's Original Directive:**
> "you literally were not supposed to implement any of these code changes. You were supposed to add this to your architectural document!!!!"

This plan now contains ALL proposed changes in architectural documentation form, ready for user review and approval.
