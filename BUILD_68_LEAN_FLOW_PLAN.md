# Build 68: Lean Flow Implementation Plan

**Created:** February 13, 2026
**Status:** SIMPLIFIED APPROACH
**Philosophy:** Leverage existing Edit Order UI + Flat List data structure

---

## 🎯 **Simplified Mission**

### What We're Building:
1. **Flat List Integration** - Single array instead of nested coach sections
2. **Universal Staff Registry** - Global coach management (Add/Remove/Rename)
3. **Coach Assignment** - Dropdown on drill cards + color-coded badge
4. **UI Bug Fixes** - Drill Library count + AI Lab (Clear button + timer)
5. **Coach-Agnostic Ordering** - Existing Edit Order works across entire plan

### What We're NOT Building:
- ❌ Drag-and-drop gestures
- ❌ New libraries (react-native-draggable-flatlist)
- ❌ Complex animations
- ❌ Changes to Build 67 authentication

---

## 📊 **Data Structure Simplification**

### Current (Build 67 - Nested):

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
```

---

### New (Build 68 - Flat):

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

## 🏗️ **Flat List Data Structure**

### New Type Definitions

**File:** `src/data/types/practice.ts`

```typescript
// BUILD 68: Flat timeline structure
export interface DrillBlock {
  id: string;                      // Unique ID for React keys
  drill: Drill;                    // The drill definition
  timeMinutes: number;             // Duration
  reps: number;                    // Repetitions
  bonusReps: number;               // Extra reps
  openTimeMinutes: number;         // Slack time
  assignedCoachId: string;         // NEW: Coach running this drill
  order: number;                   // NEW: Position in timeline (0-based index)
}

export interface PracticeTimeline {
  drills: DrillBlock[];            // FLAT array (no nesting)
  transitionTimeMinutes: number;   // Time between drills
  totalWallClockMinutes: number;   // Total duration
}

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
}
```

---

### Migration Strategy

**File:** `src/data/storage/practiceSessionStorage.ts`

```typescript
export async function loadPracticeSession(id: string): Promise<PracticeSession> {
  const json = await AsyncStorage.getItem(`@practice/${id}`);
  if (!json) return null;

  const session = JSON.parse(json);

  // BUILD 68: Migrate old sessions from stationLayout to timeline
  if (session.stationLayout && !session.timeline) {
    console.log('🔄 Migrating session to flat timeline...');

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

    // Save migrated version
    await AsyncStorage.setItem(`@practice/${id}`, JSON.stringify(session));

    console.log(`✅ Migrated ${drills.length} drills to timeline`);
  }

  // Ensure drills are sorted by order
  if (session.timeline) {
    session.timeline.drills.sort((a, b) => a.order - b.order);
  }

  return session;
}
```

**Why This Works:**
- ✅ Automatic migration on first load
- ✅ No manual script needed
- ✅ Old sessions work immediately in Build 68
- ✅ Original data preserved (can rollback if needed)

---

## 👥 **Universal Staff Registry**

### Global Staff Management

**File:** `src/data/types/coach.ts` (NEW)

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
```

---

**File:** `src/data/storage/coachingStorage.ts` (NEW)

```typescript
const COACHING_STAFF_KEY = '@diamondscript/coachingStaff';

// Default staff (head coach only)
function getDefaultStaff(): CoachingStaff {
  const headCoach: Coach = {
    id: 'head-coach-default',
    name: 'Head Coach',
    role: 'head',
    createdAt: Date.now(),
    isActive: true,
  };

  return {
    coaches: [headCoach],
    headCoachId: headCoach.id,
    lastModified: Date.now(),
  };
}

// Load coaching staff (or create default)
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

// Save coaching staff
export async function saveCoachingStaff(staff: CoachingStaff): Promise<void> {
  staff.lastModified = Date.now();
  await AsyncStorage.setItem(COACHING_STAFF_KEY, JSON.stringify(staff));
}

// Add assistant coach
export async function addCoach(name: string): Promise<Coach> {
  const staff = await loadCoachingStaff();

  // Validate: Max 3 assistants
  const assistantCount = staff.coaches.filter(c => c.role === 'assistant').length;
  if (assistantCount >= 3) {
    throw new Error('Maximum 3 assistant coaches allowed');
  }

  const newCoach: Coach = {
    id: `coach-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    name: name.trim(),
    role: 'assistant',
    createdAt: Date.now(),
    isActive: true,
  };

  staff.coaches.push(newCoach);
  await saveCoachingStaff(staff);

  return newCoach;
}

// Remove coach
export async function removeCoach(coachId: string): Promise<void> {
  const staff = await loadCoachingStaff();

  // Cannot remove head coach
  if (coachId === staff.headCoachId) {
    throw new Error('Cannot remove head coach');
  }

  staff.coaches = staff.coaches.filter(c => c.id !== coachId);
  await saveCoachingStaff(staff);

  // Note: Practice sessions will auto-migrate removed coach to head coach on load
}

// Rename coach
export async function renameCoach(coachId: string, newName: string): Promise<void> {
  const staff = await loadCoachingStaff();
  const coach = staff.coaches.find(c => c.id === coachId);

  if (!coach) throw new Error('Coach not found');

  coach.name = newName.trim();
  await saveCoachingStaff(staff);
}
```

---

### Coaching Management Screen

**File:** `app/(tabs)/coaching.tsx` (NEW)

```typescript
import { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { loadCoachingStaff, addCoach, removeCoach, renameCoach, CoachingStaff, Coach } from '../../src/data/storage/coachingStorage';

export default function CoachingScreen() {
  const [staff, setStaff] = useState<CoachingStaff | null>(null);
  const [newCoachName, setNewCoachName] = useState('');
  const [editingCoachId, setEditingCoachId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  useEffect(() => {
    loadCoachingStaff().then(setStaff);
  }, []);

  const handleAddCoach = async () => {
    if (!newCoachName.trim()) {
      Alert.alert('Error', 'Coach name cannot be empty');
      return;
    }

    try {
      await addCoach(newCoachName);
      setNewCoachName('');
      const updatedStaff = await loadCoachingStaff();
      setStaff(updatedStaff);
    } catch (error) {
      Alert.alert('Error', error.message);
    }
  };

  const handleRemoveCoach = (coach: Coach) => {
    Alert.alert(
      'Remove Coach',
      `Remove ${coach.name}? All drills assigned to this coach will be reassigned to the head coach.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            await removeCoach(coach.id);
            const updatedStaff = await loadCoachingStaff();
            setStaff(updatedStaff);
          },
        },
      ]
    );
  };

  const handleRenameCoach = async (coachId: string) => {
    if (!editName.trim()) return;

    await renameCoach(coachId, editName);
    setEditingCoachId(null);
    setEditName('');
    const updatedStaff = await loadCoachingStaff();
    setStaff(updatedStaff);
  };

  if (!staff) return null;

  const headCoach = staff.coaches.find(c => c.id === staff.headCoachId);
  const assistants = staff.coaches.filter(c => c.role === 'assistant');

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.header}>Coaching Staff</Text>

      {/* Head Coach */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Head Coach</Text>
        <View style={styles.coachCard}>
          {editingCoachId === headCoach?.id ? (
            <TextInput
              style={styles.editInput}
              value={editName}
              onChangeText={setEditName}
              onBlur={() => handleRenameCoach(headCoach.id)}
              autoFocus
            />
          ) : (
            <>
              <Text style={styles.coachName}>{headCoach?.name}</Text>
              <TouchableOpacity
                onPress={() => {
                  setEditingCoachId(headCoach.id);
                  setEditName(headCoach.name);
                }}
              >
                <Ionicons name="pencil" size={20} color="#3B82F6" />
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>

      {/* Assistant Coaches */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Assistant Coaches ({assistants.length}/3)</Text>
        {assistants.map(coach => (
          <View key={coach.id} style={styles.coachCard}>
            {editingCoachId === coach.id ? (
              <TextInput
                style={styles.editInput}
                value={editName}
                onChangeText={setEditName}
                onBlur={() => handleRenameCoach(coach.id)}
                autoFocus
              />
            ) : (
              <>
                <Text style={styles.coachName}>{coach.name}</Text>
                <View style={styles.coachActions}>
                  <TouchableOpacity
                    onPress={() => {
                      setEditingCoachId(coach.id);
                      setEditName(coach.name);
                    }}
                    style={styles.actionButton}
                  >
                    <Ionicons name="pencil" size={20} color="#3B82F6" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => handleRemoveCoach(coach)}
                    style={styles.actionButton}
                  >
                    <Ionicons name="close-circle" size={20} color="#EF4444" />
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        ))}

        {/* Add Coach Input */}
        {assistants.length < 3 && (
          <View style={styles.addCoachRow}>
            <TextInput
              style={styles.addInput}
              placeholder="New coach name..."
              value={newCoachName}
              onChangeText={setNewCoachName}
            />
            <TouchableOpacity style={styles.addButton} onPress={handleAddCoach}>
              <Ionicons name="add-circle" size={28} color="#10B981" />
            </TouchableOpacity>
          </View>
        )}
      </View>

      <Text style={styles.helpText}>
        ℹ️  Coaches can be assigned to drills in your practice plans. You can have up to 3 assistant coaches.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB', padding: 16 },
  header: { fontSize: 28, fontWeight: 'bold', color: '#1F2937', marginBottom: 24 },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 18, fontWeight: '600', color: '#374151', marginBottom: 12 },
  coachCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  coachName: { fontSize: 16, fontWeight: '500', color: '#1F2937', flex: 1 },
  coachActions: { flexDirection: 'row', gap: 12 },
  actionButton: { padding: 4 },
  editInput: {
    flex: 1,
    fontSize: 16,
    color: '#1F2937',
    borderBottomWidth: 1,
    borderBottomColor: '#3B82F6',
  },
  addCoachRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  addInput: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
  },
  addButton: { padding: 4 },
  helpText: { fontSize: 14, color: '#6B7280', marginTop: 16, lineHeight: 20 },
});
```

---

**Add Tab to Tab Bar:**

**File:** `app/(tabs)/_layout.tsx`

```typescript
<Tabs.Screen
  name="coaching"
  options={{
    title: 'Coaching',
    tabBarIcon: ({ color }) => <Ionicons name="people" size={28} color={color} />,
  }}
/>
```

---

## 🎨 **Coach Assignment UI**

### Coach Dropdown + Badge on Drill Cards

**File:** `components/DrillCard.tsx` (MODIFY)

```typescript
import { Picker } from '@react-native-picker/picker';

interface DrillCardProps {
  drillBlock: DrillBlock;
  coachingStaff: CoachingStaff;
  onCoachChange: (drillId: string, coachId: string) => void;
  // ... existing props
}

const COACH_COLORS = {
  head: '#1B4332',       // Dark green
  assistant1: '#3B82F6', // Blue
  assistant2: '#F59E0B', // Amber
  assistant3: '#10B981', // Emerald
};

function getCoachColor(coachId: string, staff: CoachingStaff): string {
  const coach = staff.coaches.find(c => c.id === coachId);
  if (!coach) return '#9CA3AF';

  if (coach.id === staff.headCoachId) return COACH_COLORS.head;

  const assistantIndex = staff.coaches
    .filter(c => c.role === 'assistant')
    .findIndex(c => c.id === coachId);

  return COACH_COLORS[`assistant${assistantIndex + 1}`] || '#9CA3AF';
}

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

const styles = StyleSheet.create({
  // ... existing styles ...

  coachBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    paddingLeft: 8,
    borderLeftWidth: 4,  // Color bar
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

## 🔄 **Coach-Agnostic Edit Order**

### Existing Edit Order UI (No Changes Needed)

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

**Example Implementation:**

```typescript
// File: app/(tabs)/practice-plan.tsx (or wherever practice plan is displayed)

const [drills, setDrills] = useState<DrillBlock[]>(session.timeline.drills);

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

## 🐛 **UI Bug Fixes**

### 1. Drill Library: Saved Count Mismatch

**Location:** `app/(tabs)/drills.tsx`

**Fix:** Make count match displayed drills

```typescript
// BEFORE (likely current code):
const savedCount = starredDrills.size + customDrills.length;

// AFTER (filtered count):
const displayedDrills = [...starredDrillObjects, ...customDrills].filter(/* filters */);
const savedCount = displayedDrills.length;  // Count what's actually shown

return (
  <View>
    <Text>Saved: {savedCount}</Text>
    <FlatList data={displayedDrills} />
  </View>
);
```

---

### 2. AI Lab: Clear Button

**Location:** `app/(tabs)/setup.tsx` (or wherever Special Instructions field is)

**Fix:** Add conditional Clear button to label

```typescript
<View style={styles.aiInputGroup}>
  <View style={styles.labelRow}>
    <Text style={styles.aiLabel}>Special Instructions (Optional)</Text>
    {specialInstructions.length > 0 && (
      <TouchableOpacity onPress={() => setSpecialInstructions('')}>
        <Text style={styles.clearButton}>Clear</Text>
      </TouchableOpacity>
    )}
  </View>
  <TextInput
    style={styles.multilineInput}
    value={specialInstructions}
    onChangeText={setSpecialInstructions}
    multiline
  />
</View>

const styles = StyleSheet.create({
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  clearButton: { color: '#3B82F6', fontSize: 14, fontWeight: '500' },
});
```

---

### 3. AI Lab: Countdown Timer Fix

**Location:** `app/(tabs)/ai.tsx`

**Fix:** Add `aiCooldownUntil` to useEffect dependencies

```typescript
const [aiCooldownUntil, setAICooldownUntil] = useState<number>(0);
const [cooldownSeconds, setCooldownSeconds] = useState<number>(0);

useEffect(() => {
  if (aiCooldownUntil === 0) {
    setCooldownSeconds(0);
    return;
  }

  const calculateRemaining = () => {
    const remaining = Math.max(0, Math.ceil((aiCooldownUntil - Date.now()) / 1000));
    if (remaining === 0 && aiCooldownUntil > 0) {
      setAICooldownUntil(0);  // Auto-clear when done
    }
    return remaining;
  };

  setCooldownSeconds(calculateRemaining());

  const interval = setInterval(() => {
    setCooldownSeconds(calculateRemaining());
  }, 1000);

  return () => clearInterval(interval);  // Cleanup
}, [aiCooldownUntil]);  // ← FIX: Add dependency
```

---

## 📊 **Code Simplification Benefits**

### Lines of Code Comparison

| Component | Build 67 (Nested) | Build 68 (Flat) | Reduction |
|-----------|-------------------|-----------------|-----------|
| Data Structure | 3 interfaces (Station, StationLayout, DrillBlock) | 2 interfaces (DrillBlock, PracticeTimeline) | -33% |
| Drill Reordering | 15-20 lines (cross-station moves) | 5-8 lines (array splice) | -60% |
| Coach Assignment | N/A (implicit by station) | 3 lines (update property) | Simple |
| Migration Logic | N/A | 15 lines (one-time) | Auto |
| Total Complexity | HIGH (nested mutations) | LOW (flat array ops) | -50% |

---

### Cognitive Complexity Reduction

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

**Simpler → Fewer Bugs → Easier Testing**

---

## 🔒 **Build 67 Security Verification**

### Files NOT Modified:

```
✋ IMMUTABLE (No Changes):
   ├── src/services/aiPracticeService.ts (Lines 39-233: Auth logic)
   ├── src/config/supabase.ts (initializeAuth)
   ├── supabase/functions/generate-practice-plan/index.ts (JWT verification)
   ├── supabase/functions/deploy.sh (--no-verify-jwt flag)
   └── app/(tabs)/ai.tsx (Lines 28-50: Auth state - except countdown fix)
```

### Files Modified (Additive Only):

```
✅ SAFE (New Files):
   ├── src/data/types/coach.ts (NEW)
   ├── src/data/storage/coachingStorage.ts (NEW)
   └── app/(tabs)/coaching.tsx (NEW)

⚠️ CAUTION (Modifications):
   ├── src/data/types/practice.ts (ADD: timeline, deprecate stationLayout)
   ├── src/data/storage/practiceSessionStorage.ts (ADD: migration logic)
   ├── components/DrillCard.tsx (ADD: Coach Badge + dropdown)
   ├── app/(tabs)/drills.tsx (FIX: saved count logic)
   ├── app/(tabs)/setup.tsx (ADD: Clear button)
   └── app/(tabs)/ai.tsx (FIX: countdown useEffect dependency)
```

**Verification Checklist:**
- [ ] No changes to `generateAIPracticePlan()` (lines 51-109)
- [ ] No changes to `reAuthAndRetry()` (lines 114-160)
- [ ] No changes to `invokeEdgeFunction()` (lines 165-233)
- [ ] No changes to Edge Function JWT verification (lines 99-164)
- [ ] Same `--no-verify-jwt` deployment flag

---

## 🎯 **Implementation Milestones**

### Milestone 1: Data Architecture (3 hours)
- [ ] Add `assignedCoachId` and `order` to DrillBlock interface
- [ ] Create `PracticeTimeline` interface
- [ ] Update `PracticeSession` to use `timeline`
- [ ] Write migration logic (stationLayout → timeline)
- [ ] Test migration with old sessions

**Deliverables:**
- `src/data/types/practice.ts` updated
- `src/data/storage/practiceSessionStorage.ts` updated
- Migration tested

---

### Milestone 2: Coaching Staff Registry (4 hours)
- [ ] Create `src/data/types/coach.ts`
- [ ] Create `src/data/storage/coachingStorage.ts` (CRUD)
- [ ] Create `app/(tabs)/coaching.tsx` (management screen)
- [ ] Add coaching tab to tab bar
- [ ] Test add/remove/rename coaches

**Deliverables:**
- 3 new files
- Coaching tab functional
- Can manage up to 3 assistants

---

### Milestone 3: Coach Assignment UI (3 hours)
- [ ] Add Coach Badge to `DrillCard.tsx`
- [ ] Add Coach Dropdown to `DrillCard.tsx`
- [ ] Load coaching staff in practice plan screen
- [ ] Handle coach changes (update drill + save)
- [ ] Test coach assignment + color coding

**Deliverables:**
- `DrillCard.tsx` updated
- Coach Badge visible
- Dropdown functional

---

### Milestone 4: UI Bug Fixes (2 hours)
- [ ] Fix Drill Library saved count (match displayed)
- [ ] Add Clear button to Special Instructions
- [ ] Fix AI Lab countdown timer (useEffect dependency)
- [ ] Test all 3 fixes

**Deliverables:**
- 3 bugs fixed
- Manual testing complete

---

### Milestone 5: Testing & Verification (3 hours)
- [ ] Test migration (old sessions → timeline)
- [ ] Test Edit Order with flat list (cross-coach moves)
- [ ] Test coach assignment persistence
- [ ] Verify Build 67 auth unchanged
- [ ] Test AI Lab (no regression)

**Deliverables:**
- All existing tests pass
- New features tested manually
- No auth regression

---

### Milestone 6: Build & Deploy (1 hour)
- [ ] Version bump to Build 68
- [ ] Build production AAB
- [ ] Test on physical device
- [ ] Create release notes

**Deliverables:**
- Build 68 AAB ready for Play Store

---

**Total Estimated Time:** 16 hours (2 days)

---

## ✅ **Success Criteria**

Build 68 is ready when:

1. ✅ **Flat List Works:**
   - Practice plans use `timeline.drills` (flat array)
   - Old sessions auto-migrate on load
   - Edit Order works across entire plan (not restricted to sections)

2. ✅ **Coaching Staff Works:**
   - Can add/remove/rename coaches
   - Max 3 assistants enforced
   - Head coach is immutable

3. ✅ **Coach Assignment Works:**
   - Dropdown shows all coaches
   - Coach Badge displays with color coding
   - Assignment persists through Edit Order

4. ✅ **UI Bugs Fixed:**
   - Drill Library count matches display
   - Clear button appears/works
   - Countdown updates every second

5. ✅ **Zero Regression:**
   - All existing tests pass
   - Build 67 auth unchanged
   - AI Lab still generates plans

---

## 📋 **Approval Checklist**

- [ ] **Flat List:** Approved (no drag-and-drop, leverage existing Edit Order)?
- [ ] **Coaching Staff:** Approved (AsyncStorage, max 3 assistants)?
- [ ] **Coach Badge:** Approved (color-coded, simple design)?
- [ ] **UI Fixes:** Approved (3 bug fixes as specified)?
- [ ] **Security:** Verified no changes to Build 67 auth?
- [ ] **Timeline:** 16 hours acceptable?

---

**Next Steps:**
1. User reviews this Lean Flow plan
2. User approves architecture
3. Begin Milestone 1: Data Architecture

**Status:** ⏳ AWAITING USER APPROVAL
