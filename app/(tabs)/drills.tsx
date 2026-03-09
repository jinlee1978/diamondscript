import React, { useState, useMemo, Component, ErrorInfo } from 'react';
import { View, Text, ScrollView, FlatList, TouchableOpacity, TextInput, StyleSheet, Keyboard, Alert, Share, KeyboardAvoidingView, Platform } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import { usePractice, PaywallTrigger } from '../../context/PracticeContext';
import { SEED_DRILL_CATALOG } from '../../src/data/seedDrills';
import { DrillCategory } from '../../src/data/types';
import CategoryBadge from '../../components/CategoryBadge';
import PaywallModal from '../../components/PaywallModal';
import Toast from '../../components/Toast';

// Local Error Boundary: prevents list rendering errors from crashing the entire app
class LocalErrorBoundary extends Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(_: Error) {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Silently log error in dev mode only
    if (__DEV__) {
      console.error('LocalErrorBoundary caught error:', error, errorInfo);
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={localErrorStyles.container}>
          <Text style={localErrorStyles.icon}>⚠️</Text>
          <Text style={localErrorStyles.message}>Unable to load drills</Text>
          <TouchableOpacity
            style={localErrorStyles.retryButton}
            onPress={() => this.setState({ hasError: false })}
          >
            <Text style={localErrorStyles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return this.props.children;
  }
}

const localErrorStyles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  icon: {
    fontSize: 32,
    marginBottom: 12,
  },
  message: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: '#1B4332',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  retryText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
});

const CATEGORIES: DrillCategory[] = ['hitting', 'fielding', 'pitching', 'baserunning'];
const CATEGORY_LABELS: Record<DrillCategory, string> = {
  hitting: 'Hitting',
  fielding: 'Fielding',
  pitching: 'Pitching',
  baserunning: 'Baserunning',
};

export default function StarredScreen() {
  // BUILD 45: ALL hooks at absolute top (React Rules of Hooks - Build 42 fix maintained)
  const insets = useSafeAreaInsets();
  const { tier, starredDrills, toggleStar, customDrills, addCustomDrill, deleteCustomDrill, importDrill, showPaywall, paywallTrigger, openPaywall, closePaywall } = usePractice();
  const [isCreating, setIsCreating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newCategory, setNewCategory] = useState<DrillCategory>('hitting');
  const [newEquipment, setNewEquipment] = useState('');

  // BUILD 43: Toast state restoration (kept at top level for hook safety)
  const [toastMessage, setToastMessage] = useState('');
  const [toastVisible, setToastVisible] = useState(false);

  // BUILD 46: Session tracking - prevent re-prompting for canceled imports
  const [promptedDrills, setPromptedDrills] = useState<Set<string>>(new Set());

  // BUILD 46: Clipboard listener - Magic Import detection (Gemini-hardened)
  useFocusEffect(
    React.useCallback(() => {
      const checkClipboard = async () => {
        try {
          const clipboardContent = await Clipboard.getStringAsync();

          // Check if clipboard contains the magic prefix
          if (clipboardContent.includes('{DIAMONDSCRIPT_DATA:')) {
            // BUILD 51: Robust regex - matches any character including newlines and special chars
            const match = clipboardContent.match(/\{DIAMONDSCRIPT_DATA:([\s\S]+?)\}\s*$/);
            if (match && match[1]) {
              try {
                const drillData = JSON.parse(match[1]);

                // BUILD 50: Validate ONLY name and description (category is optional)
                if (drillData.name && drillData.description) {
                  // BUILD 46: Session tracking - check if already prompted
                  const drillHash = `${drillData.name}|${drillData.description}`;
                  if (promptedDrills.has(drillHash)) {
                    return; // Already prompted in this session - skip
                  }

                  // BUILD 46: Duplicate detection - check existing drills
                  const isDuplicate = customDrills.some(
                    (d) => d.name === drillData.name && d.description === drillData.description
                  );

                  if (isDuplicate) {
                    // Mark as prompted (prevent re-asking on this session)
                    setPromptedDrills((prev) => new Set(prev).add(drillHash));

                    // Ask user if they want to import duplicate
                    Alert.alert(
                      'Duplicate Drill Detected',
                      `You already have "${drillData.name}" in your library. Import a duplicate anyway?`,
                      [
                        {
                          text: 'Cancel',
                          style: 'cancel',
                          onPress: () => {
                            // Clear clipboard to prevent re-prompt
                            Clipboard.setStringAsync('');
                          }
                        },
                        {
                          text: 'Import Anyway',
                          onPress: () => {
                            importDrill(
                              drillData.name,
                              drillData.description,
                              drillData.category || 'hitting',
                              drillData.equipment || []
                            );
                            setToastMessage('✓ Drill Imported');
                            setToastVisible(true);
                            Clipboard.setStringAsync('');
                          },
                        },
                      ]
                    );
                  } else {
                    // Mark as prompted
                    setPromptedDrills((prev) => new Set(prev).add(drillHash));

                    // Normal import flow
                    Alert.alert(
                      'Shared Drill Detected!',
                      `Would you like to import "${drillData.name}"?`,
                      [
                        {
                          text: 'Cancel',
                          style: 'cancel',
                          onPress: () => {
                            // BUILD 46: Don't clear clipboard on cancel - session tracking prevents re-prompt
                          }
                        },
                        {
                          text: 'Import',
                          onPress: () => {
                            importDrill(
                              drillData.name,
                              drillData.description,
                              drillData.category || 'hitting',
                              drillData.equipment || []
                            );
                            setToastMessage('✓ Drill Imported');
                            setToastVisible(true);
                            // Clear clipboard after successful import
                            Clipboard.setStringAsync('');
                          },
                        },
                      ]
                    );
                  }
                }
              } catch (parseError) {
                if (__DEV__) {
                  console.log('Failed to parse drill data:', parseError);
                }
              }
            }
          }
        } catch (error) {
          if (__DEV__) {
            console.log('Clipboard check failed:', error);
          }
        }
      };

      checkClipboard();
    }, [importDrill, setToastMessage, setToastVisible, promptedDrills, customDrills])
  );

  // Memoize filtered starred drills to prevent recalculation on every render
  const starred = useMemo(
    () => SEED_DRILL_CATALOG.filter((d) => starredDrills.has(d.id)),
    [starredDrills]
  );

  // BUILD 68: Two Buckets Fix - Unified drill list with source badges
  // Merge custom and starred drills into a single flat array (NO headers)
  type DrillItem =
    | { type: 'custom'; drill: typeof customDrills[0]; id: string; source: 'manual' }
    | { type: 'starred'; drill: typeof starred[0]; id: string; source: 'library' };

  const drillItems: DrillItem[] = useMemo(() => {
    const items: DrillItem[] = [];

    // Add custom drills first (user-created)
    customDrills.forEach(drill => {
      items.push({ type: 'custom', drill, id: `custom-${drill.id}`, source: 'manual' });
    });

    // Add starred app drills
    starred.forEach(drill => {
      items.push({ type: 'starred', drill, id: `starred-${drill.id}`, source: 'library' });
    });

    return items;
  }, [customDrills, starred]);

  const canSave = newName.trim().length > 0 && newDesc.trim().length > 0;

  const handleSave = () => {
    if (canSave && !isSaving) {
      // BUILD 40: OS-level conflict prevention - dismiss keyboard FIRST
      Keyboard.dismiss();

      // Disable button immediately
      setIsSaving(true);

      // Capture values before clearing
      const equipment = newEquipment.trim().length > 0
        ? newEquipment.split(',').map(item => item.trim()).filter(item => item.length > 0)
        : [];
      const drillName = newName.trim();
      const drillDesc = newDesc.trim();
      const drillCategory = newCategory;

      // INSTANT UI CLOSURE - Clear form and close immediately (non-blocking)
      setNewName('');
      setNewDesc('');
      setNewCategory('hitting');
      setNewEquipment('');
      setIsCreating(false);

      // Fire-and-forget: Add drill to state (background operation)
      addCustomDrill(drillName, drillDesc, drillCategory, equipment);

      // BUILD 43: Restored professional toast feedback
      setToastMessage('✓ Drill Saved');
      setToastVisible(true);

      // Reset saving state after a brief delay
      setTimeout(() => setIsSaving(false), 300);
    }
  };

  const handleDelete = (id: string) => {
    // BUILD 40: OS-level conflict prevention - dismiss keyboard FIRST
    Keyboard.dismiss();

    // BUILD 41: State-freezing - wait for touch event to complete before updating state
    requestAnimationFrame(() => {
      // Fire-and-forget: Delete drill from state (background operation)
      deleteCustomDrill(id);

      // BUILD 43: Restored professional toast feedback
      setToastMessage('✓ Drill Deleted');
      setToastVisible(true);
    });
  };

  const cancelCreate = () => {
    // BUILD 40: OS-level conflict prevention - dismiss keyboard FIRST
    Keyboard.dismiss();

    setIsCreating(false);
    setNewName('');
    setNewDesc('');
    setNewCategory('hitting');
    setNewEquipment('');
  };

  // BUILD 50: Universal share handler for drills
  const handleShareDrill = async (drill: any) => {
    try {
      const drillData = {
        type: 'drill',
        name: drill.name,
        description: drill.description,
        category: drill.category,
        equipment: drill.equipment || [],
      };
      const shareMessage = `Check out this baseball drill from DiamondScript:\n\n${drill.name}\n\n${drill.description}${
        drill.equipment && drill.equipment.length > 0
          ? `\n\nEquipment: ${drill.equipment.join(', ')}`
          : ''
      }\n\nCopy this message to import it into your app!\n\n{DIAMONDSCRIPT_DATA:${JSON.stringify(drillData)}}`;
      await Share.share({ message: shareMessage });
    } catch (error) {
      if (__DEV__) console.log('Share cancelled or failed:', error);
    }
  };

  // ── Create form ──────────────────────────────────────────────────────
  if (isCreating) {
    return (
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView style={styles.scroll} contentContainerStyle={[styles.container, { paddingBottom: insets.bottom }]} keyboardShouldPersistTaps="handled">
        <View style={styles.formBar}>
          <TouchableOpacity onPress={cancelCreate} disabled={isSaving}>
            <Text style={[styles.formBarCancel, isSaving && styles.formBarSaveDisabled]}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.formBarTitle}>New Drill</Text>
          <TouchableOpacity onPress={handleSave} disabled={!canSave || isSaving}>
            <Text style={[styles.formBarSave, (!canSave || isSaving) && styles.formBarSaveDisabled]}>
              {isSaving ? 'Saving...' : 'Save'}
            </Text>
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
      </KeyboardAvoidingView>
    );
  }

  // ── Empty state ──────────────────────────────────────────────────────
  if (customDrills.length === 0 && starred.length === 0) {
    return (
      <View style={[styles.container, { paddingBottom: insets.bottom }]}>
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

  // ── Main list ───────────────────────────────────���────────────────────
  // BUILD 68: Unified rendering with source badges (no section headers)
  const renderDrillItem = ({ item }: { item: DrillItem }) => {
    if (item.type === 'custom') {
      const drill = item.drill;
      return (
        <View style={[styles.card, drill.isImported && styles.cardImported]}>
          <View style={styles.header}>
            <Text style={styles.name}>{drill.name}</Text>
            <View style={styles.headerRight}>
              <TouchableOpacity
                onPress={() => handleShareDrill(drill)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={styles.shareIcon}>{'\u2197'}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => handleDelete(drill.id)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={styles.deleteIcon}>{'\u00D7'}</Text>
              </TouchableOpacity>
              <CategoryBadge category={drill.category} />
            </View>
          </View>
          {/* BUILD 68: Source badge - Coach Created */}
          <View style={styles.badgeRow}>
            <View style={styles.sourceBadgeManual}>
              <Text style={styles.sourceBadgeManualText}>👤 Coach Created</Text>
            </View>
            {drill.isImported && (
              <View style={styles.sharedBadge}>
                <Text style={styles.sharedBadgeText}>SHARED</Text>
              </View>
            )}
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

    // type === 'starred' (app library drill)
    const drill = item.drill;
    const isProLocked = tier === 'free' && drill.subscriptionTier === 'pro';
    return (
      <View style={[styles.card, isProLocked && styles.cardProLocked]}>
        <View style={styles.header}>
          <Text style={styles.name}>{drill.name}</Text>
          <View style={styles.headerRight}>
            {isProLocked && (
              <TouchableOpacity
                style={styles.proBadge}
                onPress={() => openPaywall('drill_catalog')}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="lock-closed" size={10} color="#D4AF37" />
                <Text style={styles.proBadgeText}>PRO</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              onPress={() => handleShareDrill(drill)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={styles.shareIcon}>{'\u2197'}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => toggleStar(drill.id)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={styles.star}>{'\u2605'}</Text>
            </TouchableOpacity>
            <CategoryBadge category={drill.category} />
          </View>
        </View>
        {/* BUILD 68: Source badge - App Library */}
        <View style={styles.badgeRow}>
          <View style={styles.sourceBadgeLibrary}>
            <Text style={styles.sourceBadgeLibraryText}>📦 App Library</Text>
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

  // BUILD 43: Toast component restored (safe with hooks at top)
  return (
    <LocalErrorBoundary>
      <FlatList
        style={styles.scroll}
        contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 40 }]}
        data={drillItems}
        renderItem={renderDrillItem}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={renderHeader}
        initialNumToRender={10}
        maxToRenderPerBatch={5}
        windowSize={5}
        showsVerticalScrollIndicator={true}
      />
      <PaywallModal
        visible={showPaywall}
        onClose={closePaywall}
        onSuccess={closePaywall}
        trigger={paywallTrigger ?? undefined}
      />
      <Toast
        message={toastMessage}
        visible={toastVisible}
        onHide={() => setToastVisible(false)}
      />
    </LocalErrorBoundary>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: '#FAFBFC',
  },
  container: {
    flex: 1,
    padding: 20,
    paddingBottom: 40,
  },
  // BUILD 89: FlatList content container - NO flex:1 (enables scrolling)
  listContent: {
    padding: 20,
    flexGrow: 1,
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
  cardImported: {
    borderColor: '#3B82F6',
    borderWidth: 2,
    shadowColor: '#3B82F6',
    shadowOpacity: 0.12,
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
  shareIcon: {
    fontSize: 18,
    color: '#3B82F6',
  },
  deleteIcon: {
    fontSize: 20,
    color: '#9CA3AF',
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  // BUILD 68: Source badges with consistent styling
  sourceBadgeManual: {
    backgroundColor: '#D1FAE5',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#059669',
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  sourceBadgeManualText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#065F46',
    letterSpacing: 0.3,
  },
  sourceBadgeLibrary: {
    backgroundColor: '#DBEAFE',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#3B82F6',
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  sourceBadgeLibraryText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#1E40AF',
    letterSpacing: 0.3,
  },
  sharedBadge: {
    backgroundColor: '#EFF6FF',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  sharedBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#3B82F6',
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
  cardProLocked: {
    borderColor: '#FEF3C7',
    borderWidth: 1.5,
  },
  proBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#FEF3C7',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  proBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#D4AF37',
  },
});
