import React, { useState, useMemo } from 'react';
import { View, Text, ScrollView, FlatList, TouchableOpacity, TextInput, StyleSheet } from 'react-native';
import { usePractice } from '../context/PracticeContext';
import { SEED_DRILL_CATALOG } from '../src/data/seedDrills';
import { DrillCategory } from '../src/data/types';
import CategoryBadge from '../components/CategoryBadge';

const CATEGORIES: DrillCategory[] = ['hitting', 'fielding', 'pitching', 'baserunning'];
const CATEGORY_LABELS: Record<DrillCategory, string> = {
  hitting: 'Hitting',
  fielding: 'Fielding',
  pitching: 'Pitching',
  baserunning: 'Baserunning',
};

export default function StarredScreen() {
  const { starredDrills, toggleStar, customDrills, addCustomDrill, deleteCustomDrill } = usePractice();
  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newCategory, setNewCategory] = useState<DrillCategory>('hitting');
  const [newEquipment, setNewEquipment] = useState('');

  // Memoize filtered starred drills to prevent recalculation on every render
  const starred = useMemo(
    () => SEED_DRILL_CATALOG.filter((d) => starredDrills.has(d.id)),
    [starredDrills]
  );
  const showHeaders = customDrills.length > 0 && starred.length > 0;
  const canSave = newName.trim().length > 0 && newDesc.trim().length > 0;

  const handleSave = () => {
    if (canSave) {
      const equipment = newEquipment.trim().length > 0
        ? newEquipment.split(',').map(item => item.trim()).filter(item => item.length > 0)
        : [];
      addCustomDrill(newName.trim(), newDesc.trim(), newCategory, equipment);
      setNewName('');
      setNewDesc('');
      setNewCategory('hitting');
      setNewEquipment('');
      setIsCreating(false);
    }
  };

  const cancelCreate = () => {
    setIsCreating(false);
    setNewName('');
    setNewDesc('');
    setNewCategory('hitting');
    setNewEquipment('');
  };

  // ── Create form ──────────────────────────────────────────────────────
  if (isCreating) {
    return (
      <ScrollView style={styles.scroll} contentContainerStyle={styles.container}>
        <View style={styles.formBar}>
          <TouchableOpacity onPress={cancelCreate}>
            <Text style={styles.formBarCancel}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.formBarTitle}>New Drill</Text>
          <TouchableOpacity onPress={handleSave} disabled={!canSave}>
            <Text style={[styles.formBarSave, !canSave && styles.formBarSaveDisabled]}>Save</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.formLabel}>Drill Name</Text>
        <TextInput
          style={styles.input}
          value={newName}
          onChangeText={setNewName}
          placeholder="e.g. My Fielding Drill"
          placeholderTextColor="#9CA3AF"
          maxLength={60}
        />

        <Text style={styles.formLabel}>Description</Text>
        <TextInput
          style={[styles.input, styles.inputMultiline]}
          value={newDesc}
          onChangeText={setNewDesc}
          placeholder="Describe the setup, what players do, and what to focus on."
          placeholderTextColor="#9CA3AF"
          multiline
          numberOfLines={4}
          textAlignVertical="top"
        />

        <Text style={styles.formLabel}>Equipment (optional)</Text>
        <TextInput
          style={styles.input}
          value={newEquipment}
          onChangeText={setNewEquipment}
          placeholder="e.g. Bats, Balls, Cones (comma-separated)"
          placeholderTextColor="#9CA3AF"
        />

        <Text style={styles.formLabel}>Category</Text>
        <View style={styles.categoryRow}>
          {CATEGORIES.map((cat) => (
            <TouchableOpacity
              key={cat}
              style={[styles.categoryPill, newCategory === cat && styles.categoryPillActive]}
              onPress={() => setNewCategory(cat)}
            >
              <Text style={[styles.categoryPillText, newCategory === cat && styles.categoryPillTextActive]}>
                {CATEGORY_LABELS[cat]}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    );
  }

  // ── Empty state ──────────────────────────────────────────────────────
  if (customDrills.length === 0 && starred.length === 0) {
    return (
      <View style={styles.container}>
        <Text style={styles.emptyIcon}>{'\u2606'}</Text>
        <Text style={styles.emptyTitle}>No drills saved yet</Text>
        <Text style={styles.emptyBody}>
          Tap the star on any drill during practice, or create your own.
        </Text>
        <TouchableOpacity style={styles.createButton} onPress={() => setIsCreating(true)}>
          <Text style={styles.createButtonText}>+ Create a Drill</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── Main list ────────────────────────────────────────────────────────
  // Combine custom and starred drills into a single flat array for FlatList
  type DrillItem =
    | { type: 'header'; title: string; id: string }
    | { type: 'custom'; drill: typeof customDrills[0]; id: string }
    | { type: 'starred'; drill: typeof starred[0]; id: string };

  const drillItems: DrillItem[] = useMemo(() => {
    const items: DrillItem[] = [];

    if (customDrills.length > 0) {
      if (showHeaders) {
        items.push({ type: 'header', title: 'Custom', id: 'header-custom' });
      }
      customDrills.forEach(drill => {
        items.push({ type: 'custom', drill, id: `custom-${drill.id}` });
      });
    }

    if (starred.length > 0) {
      if (showHeaders) {
        items.push({ type: 'header', title: 'Starred', id: 'header-starred' });
      }
      starred.forEach(drill => {
        items.push({ type: 'starred', drill, id: `starred-${drill.id}` });
      });
    }

    return items;
  }, [customDrills, starred, showHeaders]);

  const renderDrillItem = ({ item }: { item: DrillItem }) => {
    if (item.type === 'header') {
      return <Text style={styles.sectionHeader}>{item.title}</Text>;
    }

    if (item.type === 'custom') {
      const drill = item.drill;
      return (
        <View style={styles.card}>
          <View style={styles.header}>
            <Text style={styles.name}>{drill.name}</Text>
            <View style={styles.headerRight}>
              <TouchableOpacity
                onPress={() => deleteCustomDrill(drill.id)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={styles.deleteIcon}>{'\u00D7'}</Text>
              </TouchableOpacity>
              <CategoryBadge category={drill.category} />
            </View>
          </View>
          <View style={styles.customBadge}>
            <Text style={styles.customBadgeText}>Custom</Text>
          </View>
          <Text style={styles.description}>{drill.description}</Text>
          {drill.equipment && drill.equipment.length > 0 && (
            <View style={styles.equipmentSection}>
              <Text style={styles.equipmentLabel}>Equipment: </Text>
              <Text style={styles.equipmentList}>{drill.equipment.join(', ')}</Text>
            </View>
          )}
        </View>
      );
    }

    // type === 'starred'
    const drill = item.drill;
    return (
      <View style={styles.card}>
        <View style={styles.header}>
          <Text style={styles.name}>{drill.name}</Text>
          <View style={styles.headerRight}>
            <TouchableOpacity
              onPress={() => toggleStar(drill.id)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={styles.star}>{'\u2605'}</Text>
            </TouchableOpacity>
            <CategoryBadge category={drill.category} />
          </View>
        </View>
        <Text style={styles.description}>{drill.description}</Text>
        {drill.equipment && drill.equipment.length > 0 && (
          <View style={styles.equipmentSection}>
            <Text style={styles.equipmentLabel}>Equipment: </Text>
            <Text style={styles.equipmentList}>{drill.equipment.join(', ')}</Text>
          </View>
        )}
        <View style={styles.meta}>
          <Text style={styles.metaItem}>Complexity {drill.complexityScore.toFixed(1)}</Text>
          <Text style={styles.metaDot}>{'\u2022'}</Text>
          <Text style={styles.metaItem}>Intensity {drill.physicalIntensity}/5</Text>
          <Text style={styles.metaDot}>{'\u2022'}</Text>
          <Text style={styles.metaItem}>{drill.minPlayers}+ players</Text>
        </View>
      </View>
    );
  };

  const renderHeader = () => (
    <TouchableOpacity style={styles.createButton} onPress={() => setIsCreating(true)}>
      <Text style={styles.createButtonText}>+ Create a Drill</Text>
    </TouchableOpacity>
  );

  return (
    <FlatList
      style={styles.scroll}
      contentContainerStyle={styles.container}
      data={drillItems}
      renderItem={renderDrillItem}
      keyExtractor={(item) => item.id}
      ListHeaderComponent={renderHeader}
      initialNumToRender={10}
      maxToRenderPerBatch={5}
      windowSize={5}
    />
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  container: {
    flex: 1,
    padding: 20,
    paddingBottom: 40,
  },

  // ── Create button ──
  createButton: {
    borderWidth: 2,
    borderColor: '#1B4332',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 20,
    backgroundColor: '#FFFFFF',
    shadowColor: '#1B4332',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  createButtonText: {
    color: '#1B4332',
    fontSize: 15,
    fontWeight: '600',
  },

  // ── Create form ──
  formBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    marginBottom: 20,
  },
  formBarCancel: {
    fontSize: 15,
    color: '#6B7280',
  },
  formBarTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  formBarSave: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1B4332',
  },
  formBarSaveDisabled: {
    color: '#D1D5DB',
  },
  formLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 6,
  },
  input: {
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    color: '#111827',
    backgroundColor: '#FFFFFF',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  inputMultiline: {
    minHeight: 100,
  },
  categoryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryPill: {
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  categoryPillActive: {
    borderColor: '#1B4332',
    borderWidth: 2,
    backgroundColor: '#1B4332',
    shadowColor: '#1B4332',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  categoryPillText: {
    fontSize: 13,
    color: '#6B7280',
  },
  categoryPillTextActive: {
    color: '#FFFFFF',
  },

  // ── Section headers ──
  sectionHeader: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 8,
    marginTop: 4,
  },

  // ── Empty state ──
  emptyIcon: {
    fontSize: 48,
    color: '#D1D5DB',
    textAlign: 'center',
    marginTop: 80,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    textAlign: 'center',
    marginTop: 16,
  },
  emptyBody: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 22,
  },

  // ── Drill cards ──
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    shadowColor: '#1B4332',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  name: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
    flex: 1,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  star: {
    fontSize: 18,
    color: '#D4AF37',
  },
  deleteIcon: {
    fontSize: 20,
    color: '#9CA3AF',
  },
  customBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#ECFDF5',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginBottom: 6,
  },
  customBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#059669',
  },
  description: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 10,
    lineHeight: 18,
  },
  equipmentSection: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 10,
  },
  equipmentLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
  },
  equipmentList: {
    fontSize: 12,
    color: '#6B7280',
    flex: 1,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaItem: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  metaDot: {
    fontSize: 10,
    color: '#D1D5DB',
  },
});
