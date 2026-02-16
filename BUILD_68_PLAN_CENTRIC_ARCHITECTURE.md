# Build 68: Plan-Centric Architecture (Unified Flow)

**Created:** February 13, 2026
**Status:** ARCHITECTURAL SPECIFICATION
**Paradigm Shift:** Coach-Centric (Siloed) → Plan-Centric (Unified Flow)

---

## 🎯 **The Core Mandate**

### Old Model (Coach-Centric - DEPRECATED):
```
Practice Plan
├── Coach 1's Section
│   ├── Drill A
│   ├── Drill B
│   └── Drill C
├── Coach 2's Section
│   ├── Drill D
│   └── Drill E
└── Coach 3's Section
    └── Drill F
```
**Problem:** Drills are siloed by coach. Shuffling is restricted to within each section.

---

### New Model (Plan-Centric - BUILD 68):
```
Practice Plan (Single Timeline)
├── Drill A  [Coach: Head Coach]    ← Order: 0
├── Drill B  [Coach: Coach Smith]   ← Order: 1
├── Drill C  [Coach: Head Coach]    ← Order: 2
├── Drill D  [Coach: Coach Jones]   ← Order: 3
├── Drill E  [Coach: Coach Smith]   ← Order: 4
└── Drill F  [Coach: Head Coach]    ← Order: 5
```
**Solution:** Single flat list. Coach is a property on each drill. Universal shuffling enabled.

---

## 📋 **Philosophy**

1. **The Plan Owns the Drill:** Practice plan is the source of truth for drill sequence
2. **The Coach is a Property:** Coach assignment is an attribute on each drill
3. **Universal Shuffling:** Any drill can move to any position in the timeline
4. **Data Integrity:** Coach assignment persists through shuffles, saves, loads

---

## 🏗️ **Architecture Shift: Nested → Flat List**

### Current Structure (Build 67 - DEPRECATED):

```typescript
// File: src/data/types/practice.ts (CURRENT)

export interface Station {
  coachIndex: number;        // Coach assigned to this station
  drills: DrillBlock[];      // Drills for this coach
}

export interface StationLayout {
  stations: Station[];       // Array of coach stations (NESTED)
  transitionTimeMinutes: number;
  totalWallClockMinutes: number;
}

export interface PracticeSession {
  request: PracticeRequest;
  targetComplexity: number;
  selectedDrills: Drill[];
  stationLayout: StationLayout;  // ← NESTED BY COACH
  warmupMinutes: number;
  cooldownMinutes: number;
}
```

**Problem:**
- Drills are nested within `stations` array
- Each station is tied to a `coachIndex`
- To move a drill to another coach's section, must:
  1. Remove from source station's drills array
  2. Add to target station's drills array
  3. Update both stations
- Complex, error-prone, doesn't support universal shuffling

---

### New Structure (Build 68 - PLAN-CENTRIC):

```typescript
// File: src/data/types/practice.ts (NEW)

export interface DrillBlock {
  id: string;                      // Unique drill block ID (for React keys)
  drill: Drill;                    // The drill definition
  timeMinutes: number;             // Duration
  reps: number;                    // Repetitions
  bonusReps: number;               // Extra reps if time allows
  openTimeMinutes: number;         // Slack time
  assignedCoachId: string;         // Coach running this drill
  order: number;                   // Position in timeline (0, 1, 2, 3...)
}

export interface PracticeTimeline {
  drills: DrillBlock[];            // FLAT LIST (sorted by order)
  transitionTimeMinutes: number;   // Time between drills
  totalWallClockMinutes: number;   // Total duration including transitions
}

export interface PracticeSession {
  id: string;                      // Session ID
  createdAt: number;               // Timestamp
  request: PracticeRequest;        // Original request parameters
  targetComplexity: number;        // Complexity score
  timeline: PracticeTimeline;      // ← FLAT LIST (single timeline)
  warmupMinutes: number;           // Warmup duration
  cooldownMinutes: number;         // Cooldown duration
}
```

**Benefits:**
- Single flat array (`timeline.drills`)
- Each drill has explicit `order` property
- Coach is just another property on the drill
- Shuffling = reordering the flat list
- Simple, predictable, universal

---

### Order Management Strategy

**Problem:** How to maintain order when shuffling?

**Solution:** Sequential integer order with re-indexing

**Algorithm:**
```typescript
// When user drags Drill C from position 2 to position 0:
// Before:
drills = [
  { id: 'a', order: 0 },  // Drill A
  { id: 'b', order: 1 },  // Drill B
  { id: 'c', order: 2 },  // Drill C ← DRAG
  { id: 'd', order: 3 },  // Drill D
]

// After drag (C moves to position 0):
drills = [
  { id: 'c', order: 0 },  // Drill C ← MOVED
  { id: 'a', order: 1 },  // Drill A (was 0, now 1)
  { id: 'b', order: 2 },  // Drill B (was 1, now 2)
  { id: 'd', order: 3 },  // Drill D (unchanged)
]

// Re-index function:
function reindexDrills(drills: DrillBlock[]): DrillBlock[] {
  return drills.map((drill, index) => ({
    ...drill,
    order: index  // Simple: order = array index
  }));
}
```

**Why This Works:**
- Order is always synchronized with array index
- No gaps in sequence (0, 1, 2, 3...)
- Drag-and-drop libraries work with array indices
- Simple to reason about
- Survives saves/loads

---

## 🎨 **UI/UX Implementation: DraggableFlatList**

### Component Library Choice

**Recommendation:** `react-native-draggable-flatlist`
- Most popular React Native drag-and-drop library
- Works with FlatList performance optimizations
- Smooth animations
- Minimal dependencies

**Installation:**
```bash
npm install react-native-draggable-flatlist
npm install react-native-reanimated react-native-gesture-handler
```

---

### DraggableFlatList Implementation

**File:** `app/(tabs)/practice-plan.tsx` (or wherever practice plan is displayed)

```typescript
import DraggableFlatList, {
  ScaleDecorator,
  RenderItemParams,
} from 'react-native-draggable-flatlist';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

interface PracticePlanScreenProps {
  session: PracticeSession;
}

export default function PracticePlanScreen({ session }: PracticePlanScreenProps) {
  const [drills, setDrills] = useState<DrillBlock[]>(session.timeline.drills);
  const coachingStaff = useCoachingStaff(); // Load from storage

  const handleDragEnd = ({ data }: { data: DrillBlock[] }) => {
    // Re-index drills to match new order
    const reindexed = data.map((drill, index) => ({
      ...drill,
      order: index
    }));

    setDrills(reindexed);

    // Save updated session
    savePracticeSession({
      ...session,
      timeline: {
        ...session.timeline,
        drills: reindexed
      }
    });
  };

  const renderDrill = ({ item, drag, isActive }: RenderItemParams<DrillBlock>) => {
    return (
      <ScaleDecorator>
        <DrillCard
          drillBlock={item}
          coachingStaff={coachingStaff}
          onDrag={drag}
          isActive={isActive}
          onCoachChange={handleCoachChange}
        />
      </ScaleDecorator>
    );
  };

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <DraggableFlatList
        data={drills}
        renderItem={renderDrill}
        keyExtractor={(item) => item.id}
        onDragEnd={handleDragEnd}
      />
    </GestureHandlerRootView>
  );
}
```

---

### Coach Badge System

**Visual Design:**

```
┌─────────────────────────────────────────────┐
│  [≡≡]  Drill Name                           │  ← Drag handle
│        Duration: 10 min | Reps: 5           │
│                                             │
│  👤 Head Coach                              │  ← COACH BADGE
│     [Change Coach ▼]                        │
│                                             │
│  [View Details]                             │
└─────────────────────────────────────────────┘
```

**Color Coding:**
```typescript
const COACH_COLORS = {
  'head': '#1B4332',       // Dark green (authority)
  'assistant-1': '#3B82F6', // Blue
  'assistant-2': '#F59E0B', // Amber
  'assistant-3': '#10B981', // Emerald
};

function getCoachColor(coachId: string, staff: CoachingStaff): string {
  const coach = staff.coaches.find(c => c.id === coachId);
  if (!coach) return '#9CA3AF'; // Gray for unassigned

  if (coach.id === staff.headCoachId) return COACH_COLORS.head;

  const assistantIndex = staff.coaches
    .filter(c => c.role === 'assistant')
    .findIndex(c => c.id === coachId);

  return COACH_COLORS[`assistant-${assistantIndex + 1}`] || '#9CA3AF';
}
```

**Component:**

```typescript
// File: components/DrillCard.tsx

interface DrillCardProps {
  drillBlock: DrillBlock;
  coachingStaff: CoachingStaff;
  onDrag: () => void;               // Trigger drag
  isActive: boolean;                // Currently being dragged
  onCoachChange: (drillId: string, coachId: string) => void;
}

export function DrillCard({
  drillBlock,
  coachingStaff,
  onDrag,
  isActive,
  onCoachChange
}: DrillCardProps) {
  const assignedCoach = coachingStaff.coaches.find(
    c => c.id === drillBlock.assignedCoachId
  ) || coachingStaff.coaches.find(c => c.id === coachingStaff.headCoachId);

  const coachColor = getCoachColor(drillBlock.assignedCoachId, coachingStaff);

  return (
    <View style={[styles.card, isActive && styles.cardActive]}>
      {/* Drag Handle */}
      <TouchableOpacity onLongPress={onDrag} style={styles.dragHandle}>
        <Ionicons name="reorder-three" size={24} color="#9CA3AF" />
      </TouchableOpacity>

      {/* Drill Info */}
      <View style={styles.drillInfo}>
        <Text style={styles.drillName}>{drillBlock.drill.name}</Text>
        <Text style={styles.drillMeta}>
          Duration: {drillBlock.timeMinutes} min | Reps: {drillBlock.reps}
        </Text>
      </View>

      {/* COACH BADGE */}
      <View style={[styles.coachBadge, { borderLeftColor: coachColor }]}>
        <View style={styles.coachIcon}>
          <Ionicons name="person" size={16} color={coachColor} />
        </View>
        <Text style={styles.coachName}>{assignedCoach?.name}</Text>
      </View>

      {/* Coach Dropdown */}
      <Picker
        selectedValue={drillBlock.assignedCoachId}
        onValueChange={(coachId) => onCoachChange(drillBlock.id, coachId)}
        style={styles.coachPicker}
      >
        {coachingStaff.coaches.map(coach => (
          <Picker.Item
            key={coach.id}
            label={coach.name}
            value={coach.id}
            color={getCoachColor(coach.id, coachingStaff)}
          />
        ))}
      </Picker>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  cardActive: {
    backgroundColor: '#F3F4F6',  // Light gray when dragging
    borderColor: '#3B82F6',      // Blue border
    elevation: 8,
  },
  dragHandle: {
    position: 'absolute',
    left: 8,
    top: 16,
    padding: 4,
  },
  drillInfo: {
    marginLeft: 36,  // Space for drag handle
  },
  drillName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4,
  },
  drillMeta: {
    fontSize: 14,
    color: '#6B7280',
  },
  coachBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    paddingLeft: 8,
    borderLeftWidth: 4,  // Color-coded left border
  },
  coachIcon: {
    marginRight: 8,
  },
  coachName: {
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

## 👥 **Staff Registry Integration**

### Global Staff Management

**File:** `src/data/storage/coachingStorage.ts` (from original plan)

```typescript
export interface Coach {
  id: string;
  name: string;
  role: 'head' | 'assistant';
  createdAt: number;
  isActive: boolean;
}

export interface CoachingStaff {
  coaches: Coach[];
  headCoachId: string;
  lastModified: number;
}

// CRUD operations (unchanged from original plan)
export async function loadCoachingStaff(): Promise<CoachingStaff>
export async function addCoach(name: string): Promise<Coach>
export async function removeCoach(coachId: string): Promise<void>
export async function renameCoach(coachId: string, newName: string): Promise<void>
```

---

### Dropdown Interaction with Registry

**Flow:**

1. **Load Practice Plan Screen:**
   ```typescript
   const coachingStaff = await loadCoachingStaff();
   const session = await loadPracticeSession(sessionId);
   ```

2. **Render Drill Cards:**
   - Each card shows current `assignedCoachId` as selected value
   - Dropdown options = all coaches from `coachingStaff.coaches`
   - Coach Badge shows name + color from registry

3. **User Changes Coach:**
   ```typescript
   const handleCoachChange = (drillId: string, newCoachId: string) => {
     const updatedDrills = drills.map(drill =>
       drill.id === drillId
         ? { ...drill, assignedCoachId: newCoachId }
         : drill
     );

     setDrills(updatedDrills);

     // Auto-save
     savePracticeSession({
       ...session,
       timeline: { ...session.timeline, drills: updatedDrills }
     });
   };
   ```

4. **User Removes Coach from Registry:**
   ```typescript
   const handleRemoveCoach = async (coachId: string) => {
     // Remove from registry
     await removeCoach(coachId);

     // Unassign from all drills (reassign to head coach)
     const staff = await loadCoachingStaff();
     const updatedDrills = drills.map(drill =>
       drill.assignedCoachId === coachId
         ? { ...drill, assignedCoachId: staff.headCoachId }
         : drill
     );

     setDrills(updatedDrills);

     // Save all affected sessions
     await unassignCoachFromAllSessions(coachId, staff.headCoachId);
   };
   ```

---

## 🔄 **Impact Evaluation**

### 1. Impact on AI Lab Generation

#### Current (Build 67 - SECTIONS):
```typescript
// AI returns sections
interface AIPracticePlan {
  planTitle: string;
  sections: AIPlanSection[];  // ← SECTIONS
}

interface AIPlanSection {
  title: string;             // "Warmup", "Main Drills", etc.
  drills: AIDrill[];
}
```

#### New (Build 68 - SEQUENCE):
```typescript
// AI returns flat sequence
interface AIPracticePlan {
  planTitle: string;
  drills: AIDrill[];         // ← FLAT SEQUENCE (no sections)
}

interface AIDrill {
  name: string;
  description: string;
  duration: number;
  equipment?: string[];
  order: number;             // NEW: Sequence position
}
```

---

#### Edge Function Changes Required

**File:** `supabase/functions/generate-practice-plan/index.ts`

⚠️ **CRITICAL:** This file is on the IMMUTABLE list for Build 67 auth!

**Solution:** Create NEW Edge Function or ADD parameter to existing one

**Option 1: Add `outputFormat` parameter (RECOMMENDED)**
```typescript
interface GeneratePlanRequest {
  ageGroup: string;
  experienceLevel: number;
  focusArea: string;
  duration: number;
  intensity: 'rec' | 'travel' | 'competitive';
  assistantCoaches?: number;
  userInstructions?: string;
  outputFormat?: 'sections' | 'sequence';  // NEW (default: 'sections' for backward compat)
}

function buildPrompt(request: GeneratePlanRequest): string {
  if (request.outputFormat === 'sequence') {
    // NEW: Prompt for sequence output
    return `Generate a JSON object with this structure:
    {
      "planTitle": "Practice title",
      "estimatedDuration": ${request.duration},
      "drills": [
        {
          "name": "Drill name",
          "description": "Instructions",
          "duration": number,
          "equipment": ["item1"],
          "order": 0
        }
      ]
    }`;
  } else {
    // EXISTING: Sections output (Build 67 backward compatible)
    return /* existing prompt */;
  }
}
```

**Why This Works:**
- ✅ NO changes to JWT verification logic
- ✅ Backward compatible (default to 'sections')
- ✅ Build 67 apps continue to work
- ✅ Build 68 apps request 'sequence' format
- ✅ Same auth flow, same headers, same deployment

---

#### Client-Side Changes

**File:** `src/services/aiPracticeService.ts`

⚠️ **CRITICAL:** This file is on the IMMUTABLE list!

**Solution:** Create NEW function, keep existing one

```typescript
// EXISTING (Build 67 - KEEP UNTOUCHED):
export async function generateAIPracticePlan(
  request: AIPracticeRequest
): Promise<AIPracticePlan> {
  // AUTO-REPAIR LOGIC (lines 39-109)
  // DO NOT MODIFY
}

// NEW (Build 68 - ADD ALONGSIDE):
export async function generateAIPracticePlanSequence(
  request: AIPracticeRequest
): Promise<AIPracticePlanSequence> {
  // Same auth flow, just pass outputFormat: 'sequence'
  const response = await supabase.functions.invoke('generate-practice-plan', {
    body: { ...request, outputFormat: 'sequence' },
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  });

  return response.data as AIPracticePlanSequence;
}
```

**Why This Works:**
- ✅ NO modification to Build 67 auth logic
- ✅ New function reuses existing auth flow
- ✅ Build 67 apps use `generateAIPracticePlan()`
- ✅ Build 68 apps use `generateAIPracticePlanSequence()`
- ✅ Zero regression risk

---

#### Conversion Function Changes

**File:** `src/services/aiPracticeService.ts` (Lines 239-357)

**Current:** `convertAIPlanToPracticeSession()` (sections → stations)

**New:** `convertAISequenceToPracticeSession()` (sequence → timeline)

```typescript
// NEW (Build 68):
export function convertAISequenceToPracticeSession(
  aiPlan: AIPracticePlanSequence,
  request: AIPracticeRequest,
  tier: 'free' | 'pro',
  coachingStaff: CoachingStaff
): PracticeSession {
  // Convert AI drills to DrillBlock[]
  const drillBlocks: DrillBlock[] = aiPlan.drills.map((aiDrill, index) => ({
    id: `drill-${Date.now()}-${index}`,
    drill: {
      id: `ai-${Date.now()}-${index}`,
      name: aiDrill.name,
      description: aiDrill.description,
      complexityScore: 3.0,
      physicalIntensity: intensityMap[request.intensity],
      category: inferCategory(aiDrill.name),
      ageGroupCompatibility: [ageGroupMap[request.ageGroup]],
      minPlayers: 6,
      subscriptionTier: 'free',
      equipment: aiDrill.equipment ?? [],
    },
    timeMinutes: aiDrill.duration,
    reps: Math.ceil(aiDrill.duration * 2),
    bonusReps: 0,
    openTimeMinutes: 0,
    assignedCoachId: coachingStaff.headCoachId,  // Default to head coach
    order: aiDrill.order || index,               // Preserve AI's order or use index
  }));

  // Create timeline
  const timeline: PracticeTimeline = {
    drills: drillBlocks,
    transitionTimeMinutes: 2,
    totalWallClockMinutes: calculateTotalTime(drillBlocks),
  };

  return {
    id: `session-${Date.now()}`,
    createdAt: Date.now(),
    request: /* ... */,
    targetComplexity: 3.0,
    timeline,
    warmupMinutes: /* ... */,
    cooldownMinutes: /* ... */,
  };
}
```

---

### 2. Impact on Practice History Loading

#### Current (Build 67 - STATIONS):
```typescript
// File: src/data/storage/practiceSessionStorage.ts
export async function loadPracticeSession(id: string): Promise<PracticeSession> {
  const json = await AsyncStorage.getItem(`@practice/${id}`);
  const parsed = JSON.parse(json);

  // Expects: parsed.stationLayout.stations[]
  return parsed;
}
```

#### Migration Strategy (Build 68 - TIMELINE):

**Problem:** Old sessions have `stationLayout`, new sessions have `timeline`

**Solution:** On-demand migration

```typescript
// File: src/data/storage/practiceSessionStorage.ts (NEW)

export async function loadPracticeSession(id: string): Promise<PracticeSession> {
  const json = await AsyncStorage.getItem(`@practice/${id}`);
  if (!json) return null;

  const parsed = JSON.parse(json);

  // MIGRATION: Convert old stationLayout to new timeline
  if (parsed.stationLayout && !parsed.timeline) {
    console.log('🔄 Migrating old session to timeline format...');

    const drillBlocks: DrillBlock[] = [];
    let order = 0;

    // Flatten stations into single timeline
    parsed.stationLayout.stations.forEach((station: Station, stationIndex: number) => {
      station.drills.forEach((drillBlock: any) => {
        drillBlocks.push({
          id: drillBlock.drill.id || `migrated-${Date.now()}-${order}`,
          drill: drillBlock.drill,
          timeMinutes: drillBlock.timeMinutes,
          reps: drillBlock.reps,
          bonusReps: drillBlock.bonusReps || 0,
          openTimeMinutes: drillBlock.openTimeMinutes || 0,
          assignedCoachId: drillBlock.assignedCoachId || getHeadCoachId(),
          order: order++,
        });
      });
    });

    // Create timeline
    parsed.timeline = {
      drills: drillBlocks,
      transitionTimeMinutes: parsed.stationLayout.transitionTimeMinutes,
      totalWallClockMinutes: parsed.stationLayout.totalWallClockMinutes,
    };

    // Remove old stationLayout (optional - keep for rollback)
    // delete parsed.stationLayout;

    // Save migrated version
    await AsyncStorage.setItem(`@practice/${id}`, JSON.stringify(parsed));

    console.log(`✅ Migrated ${drillBlocks.length} drills to timeline format`);
  }

  return parsed;
}
```

**Why This Works:**
- ✅ Old sessions automatically migrate on first load
- ✅ No manual migration script needed
- ✅ Original data preserved (can rollback)
- ✅ Transparent to user

---

### 3. Impact on Build 67 Security Core

#### Files Modified (Build 68):
```
✅ SAFE - NEW FILES:
   ├── src/data/types/timeline.ts (NEW)
   ├── src/data/storage/coachingStorage.ts (NEW)
   ├── components/DrillCard.tsx (MODIFY - add Coach Badge)
   └── app/(tabs)/practice-plan.tsx (MODIFY - add DraggableFlatList)

⚠️  CAUTION - MODIFIED FILES (Add code only):
   ├── src/data/types/practice.ts (ADD: timeline, DrillBlock.order)
   ├── src/services/aiPracticeService.ts (ADD: generateAIPracticePlanSequence)
   └── supabase/functions/generate-practice-plan/index.ts (ADD: outputFormat param)

✋ IMMUTABLE - NO CHANGES:
   ├── src/services/aiPracticeService.ts (Lines 39-109: AUTO-REPAIR)
   ├── src/services/aiPracticeService.ts (Lines 114-160: reAuthAndRetry)
   ├── src/services/aiPracticeService.ts (Lines 165-233: invokeEdgeFunction)
   ├── src/config/supabase.ts (Lines 25-66: initializeAuth)
   └── supabase/functions/generate-practice-plan/index.ts (Lines 99-164: JWT VERIFICATION)
```

#### Verification Checklist:

```
Authentication Flow (UNTOUCHED):
  [ ] Lines 39-109: AUTO-REPAIR LOGIC (no changes)
  [ ] Lines 114-160: reAuthAndRetry() (no changes)
  [ ] Lines 165-233: invokeEdgeFunction() (no changes)
  [ ] initializeAuth() (no changes)
  [ ] Edge Function JWT verification (no changes)

New Code (ADDITIVE ONLY):
  [ ] generateAIPracticePlanSequence() added AFTER existing function
  [ ] outputFormat parameter added to Edge Function interface
  [ ] Prompt generation has conditional branch (sections vs sequence)
  [ ] All changes are BACKWARD COMPATIBLE

Deployment:
  [ ] Same --no-verify-jwt flag
  [ ] Same deployment script
  [ ] Same auth headers
  [ ] No changes to Gateway bypass
```

---

## 🗺️ **System Map: Drill Lifecycle**

### State 1: Unassigned (New Drill)

```
User Creates Drill (Manual or AI)
         ↓
   ┌─────────────────────────┐
   │ DrillBlock              │
   │ - id: "drill-123"       │
   │ - drill: { Drill }      │
   │ - assignedCoachId: ???  │  ← UNASSIGNED
   │ - order: 0              │
   └─────────────────────────┘
         ↓
   Default Assignment:
   assignedCoachId = headCoachId
```

**Code:**
```typescript
const newDrill: DrillBlock = {
  id: `drill-${Date.now()}`,
  drill: selectedDrill,
  timeMinutes: 10,
  reps: 5,
  bonusReps: 0,
  openTimeMinutes: 0,
  assignedCoachId: coachingStaff.headCoachId,  // AUTO-ASSIGN
  order: drills.length,  // Append to end
};
```

---

### State 2: Assigned (Coach Selected)

```
User Selects Coach from Dropdown
         ↓
   ┌─────────────────────────┐
   │ DrillBlock              │
   │ - id: "drill-123"       │
   │ - drill: { Drill }      │
   │ - assignedCoachId: "coach-smith"  ← ASSIGNED
   │ - order: 0              │
   └─────────────────────────┘
         ↓
   Coach Badge Updates:
   - Name: "Coach Smith"
   - Color: Blue (#3B82F6)
```

**Code:**
```typescript
const handleCoachChange = (drillId: string, newCoachId: string) => {
  const updatedDrills = drills.map(drill =>
    drill.id === drillId
      ? { ...drill, assignedCoachId: newCoachId }  // UPDATE
      : drill
  );

  setDrills(updatedDrills);
  savePracticeSession({ ...session, timeline: { ...timeline, drills: updatedDrills } });
};
```

---

### State 3: Shuffled (Position Changed)

```
User Drags Drill from Position 2 → Position 0
         ↓
   BEFORE:
   [
     { id: "a", order: 0, assignedCoachId: "head" },
     { id: "b", order: 1, assignedCoachId: "smith" },
     { id: "c", order: 2, assignedCoachId: "jones" },  ← DRAG THIS
     { id: "d", order: 3, assignedCoachId: "head" },
   ]
         ↓
   AFTER:
   [
     { id: "c", order: 0, assignedCoachId: "jones" },  ← MOVED (Coach preserved!)
     { id: "a", order: 1, assignedCoachId: "head" },
     { id: "b", order: 2, assignedCoachId: "smith" },
     { id: "d", order: 3, assignedCoachId: "head" },
   ]
         ↓
   Re-index all drills:
   drill.order = arrayIndex
```

**Code:**
```typescript
const handleDragEnd = ({ data }: { data: DrillBlock[] }) => {
  // Re-index (order = index)
  const reindexed = data.map((drill, index) => ({
    ...drill,
    order: index  // NEW ORDER
    // assignedCoachId PRESERVED (no change)
  }));

  setDrills(reindexed);
  savePracticeSession({ ...session, timeline: { ...timeline, drills: reindexed } });
};
```

**Data Integrity Verification:**
```typescript
// Before drag:
const drill = { id: "c", order: 2, assignedCoachId: "jones" };

// After drag:
const movedDrill = reindexed.find(d => d.id === "c");

// VERIFY:
assert(movedDrill.assignedCoachId === "jones");  // ✅ Coach preserved
assert(movedDrill.order === 0);                  // ✅ Order updated
assert(movedDrill.drill === drill.drill);        // ✅ Drill unchanged
```

---

### State 4: Saved (Persisted to Storage)

```
Auto-Save After Every Change
         ↓
   ┌─────────────────────────────┐
   │ AsyncStorage                │
   │ Key: @practice/session-123  │
   │                             │
   │ {                           │
   │   timeline: {               │
   │     drills: [               │
   │       {                     │
   │         id: "drill-123",    │
   │         assignedCoachId: "jones",  ← PERSISTED
   │         order: 0,           │  ← PERSISTED
   │       }                     │
   │     ]                       │
   │   }                         │
   │ }                           │
   └─────────────────────────────┘
         ↓
   Load from storage:
   - Drills sorted by order
   - Coach assignments intact
```

**Code:**
```typescript
export async function savePracticeSession(session: PracticeSession): Promise<void> {
  const key = `@practice/${session.id}`;
  const json = JSON.stringify(session);
  await AsyncStorage.setItem(key, json);
}

export async function loadPracticeSession(id: string): Promise<PracticeSession> {
  const key = `@practice/${id}`;
  const json = await AsyncStorage.getItem(key);
  const session = JSON.parse(json);

  // Sort drills by order (defensive)
  session.timeline.drills.sort((a, b) => a.order - b.order);

  return session;
}
```

---

### State 5: Loaded (Retrieved & Rendered)

```
User Opens Practice Plan
         ↓
   Load from AsyncStorage
         ↓
   Sort drills by order
         ↓
   Render DraggableFlatList
         ↓
   ┌─────────────────────────────────────┐
   │  [≡≡]  Drill C                      │  ← Order: 0
   │        👤 Coach Jones (Amber)       │  ← Coach preserved
   ├─────────────────────────────────────┤
   │  [≡≡]  Drill A                      │  ← Order: 1
   │        👤 Head Coach (Green)        │
   ├─────────────────────────────────────┤
   │  [≡≡]  Drill B                      │  ← Order: 2
   │        👤 Coach Smith (Blue)        │
   └─────────────────────────────────────┘
```

**Code:**
```typescript
useEffect(() => {
  loadPracticeSession(sessionId).then(session => {
    setDrills(session.timeline.drills);  // Already sorted by order
  });
}, [sessionId]);

// Render
<DraggableFlatList
  data={drills}  // Sorted by order
  renderItem={({ item }) => (
    <DrillCard
      drillBlock={item}  // assignedCoachId intact
      coachingStaff={coachingStaff}
    />
  )}
/>
```

---

## 📊 **Data Integrity Guarantees**

### Invariants (MUST ALWAYS BE TRUE):

1. **Order Uniqueness:**
   ```typescript
   const orders = drills.map(d => d.order);
   const uniqueOrders = new Set(orders);
   assert(orders.length === uniqueOrders.size);  // No duplicate orders
   ```

2. **Order Continuity:**
   ```typescript
   const sortedDrills = drills.sort((a, b) => a.order - b.order);
   sortedDrills.forEach((drill, index) => {
     assert(drill.order === index);  // Order = 0, 1, 2, 3... (no gaps)
   });
   ```

3. **Coach Assignment Validity:**
   ```typescript
   const coachIds = coachingStaff.coaches.map(c => c.id);
   drills.forEach(drill => {
     assert(coachIds.includes(drill.assignedCoachId));  // Coach exists in registry
   });
   ```

4. **Coach Persistence Through Shuffle:**
   ```typescript
   const beforeShuffle = drills.find(d => d.id === "drill-123");
   // User shuffles...
   const afterShuffle = drills.find(d => d.id === "drill-123");
   assert(beforeShuffle.assignedCoachId === afterShuffle.assignedCoachId);  // Coach preserved
   ```

---

## 🎯 **Updated Implementation Milestones**

### Milestone 1: Data Architecture (4 hours)
- [ ] Create `src/data/types/timeline.ts` (PracticeTimeline, DrillBlock)
- [ ] Update `src/data/types/practice.ts` (add timeline, deprecate stationLayout)
- [ ] Create migration logic in `practiceSessionStorage.ts`
- [ ] Write unit tests for timeline structure

### Milestone 2: Coaching Staff Registry (4 hours)
- [ ] Create `src/data/storage/coachingStorage.ts` (CRUD)
- [ ] Create `app/(tabs)/coaching.tsx` (management screen)
- [ ] Add coaching tab to tab bar
- [ ] Test add/remove/rename coaches

### Milestone 3: DraggableFlatList Implementation (6 hours)
- [ ] Install `react-native-draggable-flatlist`
- [ ] Create practice plan screen with DraggableFlatList
- [ ] Implement drag-and-drop with re-indexing
- [ ] Add Coach Badge to drill cards
- [ ] Test shuffle preserves coach assignments

### Milestone 4: AI Lab Sequence Output (4 hours)
- [ ] Add `outputFormat` parameter to Edge Function
- [ ] Create `generateAIPracticePlanSequence()` function
- [ ] Create `convertAISequenceToPracticeSession()` function
- [ ] Update AI Lab to use sequence format
- [ ] Test backward compatibility (Build 67 still works)

### Milestone 5: Testing & Migration (4 hours)
- [ ] Write migration tests (stationLayout → timeline)
- [ ] Test data integrity invariants
- [ ] Test shuffle with coach assignments
- [ ] Verify Build 67 auth unchanged
- [ ] Test AI generation with sequence format

### Milestone 6: Build & Deploy (2 hours)
- [ ] Version bump to Build 68
- [ ] Build production AAB
- [ ] Test on physical device
- [ ] Verify no auth regression

**Total:** 24 hours (3-4 days)

---

## ✅ **Approval Checklist**

Before proceeding, confirm:

- [ ] **Architecture:** Flat List with order property approved?
- [ ] **UI/UX:** DraggableFlatList with Coach Badge approved?
- [ ] **AI Changes:** Sequence output format approved?
- [ ] **Migration:** On-demand stationLayout→timeline approved?
- [ ] **Security:** Verified no changes to Build 67 auth core?
- [ ] **Timeline:** 24-hour estimate acceptable?

---

**Next Steps:**
1. User reviews this architecture specification
2. User approves or requests modifications
3. Begin Milestone 1: Data Architecture implementation

**Status:** ⏳ AWAITING USER APPROVAL
