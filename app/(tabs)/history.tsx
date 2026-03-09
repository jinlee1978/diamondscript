/**
 * BUILD 104: Practice Log (formerly History)
 *
 * Redesigned as a coaching journal with:
 * - Summary stats header (total, streak, most practiced age group)
 * - Search bar + filter chips (age group, source, category)
 * - Enhanced card design with stronger visual hierarchy
 * - Timeline feel with coach notes and drill previews
 */

import React, { useMemo, useState, useCallback } from 'react';
import {
  View, Text, SectionList, TouchableOpacity, StyleSheet,
  TextInput, Share, Alert, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { animateExpand, animateFade } from '../../src/utils/animations';
import { usePractice, HistoryEntry } from '../../context/PracticeContext';
import CategoryBadge from '../../components/CategoryBadge';
import SourceBadge from '../../components/SourceBadge';
import { DrillCategory, PracticeSession, PracticeSource } from '../../src/data/types';
import { AgeGroup } from '../../src/data/types/ageGroup';
import { generateShareLink } from '../../src/utils/practiceSerializer';

// ── Helpers ──

function formatDate(timestamp: number): string {
  const now = new Date();
  const date = new Date(timestamp);
  if (date.toDateString() === now.toDateString()) return 'Today';
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function formatAgeGroup(raw: string): string {
  const map: Record<string, string> = {
    INTRO: 'Intro (3-4)',
    T_BALL: 'T-Ball (5-6)',
    COACH_PITCH: 'Coach Pitch (7-8)',
    MACHINE_PITCH: 'Machine Pitch (8-9)',
    KID_PITCH: 'Kid Pitch (9-10)',
    COMPETITIVE: 'Competitive (11-12)',
    ADVANCED: 'Advanced (13-14)',
  };
  return map[raw] || raw.replace('AGE_', '').replace('_', '-');
}

function formatAgeGroupShort(raw: string): string {
  const map: Record<string, string> = {
    INTRO: 'Intro',
    T_BALL: 'T-Ball',
    COACH_PITCH: 'Coach Pitch',
    MACHINE_PITCH: 'Machine Pitch',
    KID_PITCH: 'Kid Pitch',
    COMPETITIVE: 'Competitive',
    ADVANCED: 'Advanced',
  };
  return map[raw] || raw;
}

/** Calculate practice streak (consecutive days with at least 1 practice) */
function calculateStreak(history: HistoryEntry[]): number {
  if (history.length === 0) return 0;
  const dates = [...new Set(
    history.map(h => new Date(h.savedAt).toDateString())
  )].sort((a, b) => new Date(b).getTime() - new Date(a).getTime());

  let streak = 0;
  const today = new Date();
  let checkDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  // Allow today or yesterday as starting point
  const firstDate = new Date(dates[0]);
  const firstDateNorm = new Date(firstDate.getFullYear(), firstDate.getMonth(), firstDate.getDate());
  const diffMs = checkDate.getTime() - firstDateNorm.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  if (diffDays > 1) return 0; // Last practice was more than 1 day ago

  for (const dateStr of dates) {
    const d = new Date(dateStr);
    const dNorm = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    if (dNorm.getTime() === checkDate.getTime()) {
      streak++;
      checkDate.setDate(checkDate.getDate() - 1);
    } else if (dNorm.getTime() < checkDate.getTime()) {
      break;
    }
  }
  return streak;
}

/** Find the most practiced age group */
function getMostPracticedAge(history: HistoryEntry[]): string | null {
  if (history.length === 0) return null;
  const counts: Record<string, number> = {};
  history.forEach(h => {
    const ag = h.session?.request?.ageGroup;
    if (ag) counts[ag] = (counts[ag] || 0) + 1;
  });
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  return sorted[0]?.[0] || null;
}

const FREE_HISTORY_LIMIT = 5;
const CATEGORY_ORDER: DrillCategory[] = ['hitting', 'fielding', 'pitching', 'baserunning'];

// Filter chip options
const AGE_GROUPS = Object.values(AgeGroup);
const SOURCE_OPTIONS: PracticeSource[] = ['ai', 'manual', 'library'];
const SOURCE_LABELS: Record<PracticeSource, string> = { ai: 'AI', manual: 'Manual', library: 'Library' };

export default function HistoryScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { tier, history, restoreSession, deletePracticeHistory, updateCoachNote } = usePractice();

  // Search & filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [filterAge, setFilterAge] = useState<AgeGroup | null>(null);
  const [filterSource, setFilterSource] = useState<PracticeSource | null>(null);
  const [filterCategory, setFilterCategory] = useState<DrillCategory | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  // Coach notes editing
  const [editingNotes, setEditingNotes] = useState<Record<number, string>>({});
  const [expandedNote, setExpandedNote] = useState<number | null>(null);

  const handleNoteChange = useCallback((savedAt: number, text: string) => {
    setEditingNotes(prev => ({ ...prev, [savedAt]: text }));
  }, []);

  const handleNoteBlur = useCallback((savedAt: number) => {
    const note = editingNotes[savedAt];
    if (note !== undefined) {
      updateCoachNote(savedAt, note);
    }
  }, [editingNotes, updateCoachNote]);

  // Share
  const handleSharePractice = useCallback(async (session: PracticeSession) => {
    try {
      const ageLabel = formatAgeGroupShort(session.request.ageGroup);
      const drillCount = session.selectedDrills.length;
      const duration = session.stationLayout.totalWallClockMinutes;
      const shareData = {
        type: 'practice',
        ageGroup: ageLabel,
        totalMinutes: duration,
        coachCount: (session.coachNames?.length ?? 1),
        session,
      };
      const shareMessage = `Check out this practice from DiamondScript:\n\n${ageLabel} \u2022 ${drillCount} drills \u2022 ${duration} min\n\nCopy this message to import it!\n\n{DIAMONDSCRIPT_DATA:${JSON.stringify(shareData)}}`;
      await Share.share({ message: shareMessage });
    } catch { /* cancelled */ }
  }, []);

  // Delete confirmation
  const handleDelete = useCallback((savedAt: number) => {
    Alert.alert('Delete Practice?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deletePracticeHistory(savedAt) },
    ]);
  }, [deletePracticeHistory]);

  // Cap at 5 for free tier
  const allVisible = tier === 'pro' ? history : history.slice(0, FREE_HISTORY_LIMIT);

  // Active filter count
  const activeFilterCount = [filterAge, filterSource, filterCategory].filter(Boolean).length;

  // Apply search + filters
  const filteredHistory = useMemo(() => {
    return allVisible.filter(item => {
      const s = item.session;
      if (!s?.request) return false;

      // Age group filter
      if (filterAge && s.request.ageGroup !== filterAge) return false;

      // Source filter
      if (filterSource && s.source !== filterSource) return false;

      // Category filter
      if (filterCategory && !s.selectedDrills?.some(d => d.category === filterCategory)) return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const ageMatch = formatAgeGroup(s.request.ageGroup).toLowerCase().includes(q);
        const drillMatch = s.selectedDrills?.some(d => d.name.toLowerCase().includes(q));
        const noteMatch = item.coachNote?.toLowerCase().includes(q);
        if (!ageMatch && !drillMatch && !noteMatch) return false;
      }

      return true;
    });
  }, [allVisible, filterAge, filterSource, filterCategory, searchQuery]);

  // Stats (from full visible history, not filtered)
  const stats = useMemo(() => {
    const total = allVisible.length;
    const streak = calculateStreak(allVisible);
    const mostAge = getMostPracticedAge(allVisible);
    const totalDrills = allVisible.reduce((sum, h) =>
      sum + (h.session?.selectedDrills?.length ?? 0), 0
    );
    return { total, streak, mostAge, totalDrills };
  }, [allVisible]);

  // Group filtered history by date
  const sections = useMemo(() => {
    const groups: { [key: string]: typeof filteredHistory } = {};
    filteredHistory.forEach(item => {
      const dateKey = new Date(item.savedAt).toDateString();
      if (!groups[dateKey]) groups[dateKey] = [];
      groups[dateKey].push(item);
    });
    return Object.entries(groups).map(([dateKey, items]) => ({
      title: formatDate(items[0].savedAt),
      date: dateKey,
      data: items,
    }));
  }, [filteredHistory]);

  const clearFilters = () => {
    setFilterAge(null);
    setFilterSource(null);
    setFilterCategory(null);
    setSearchQuery('');
  };

  // ── Empty State ──

  if (allVisible.length === 0) {
    return (
      <View style={[styles.emptyContainer, { paddingBottom: insets.bottom }]}>
        <View style={styles.emptyIconCircle}>
          <Ionicons name="time-outline" size={36} color="#1B4332" />
        </View>
        <Text style={styles.emptyTitle}>No Practices Yet</Text>
        <Text style={styles.emptyBody}>
          Your practice plans will appear here after you generate them. Each plan is saved automatically so you can review, reuse, and share.
        </Text>
        <TouchableOpacity
          style={styles.emptyButton}
          onPress={() => router.push('/(tabs)/generate')}
        >
          <Ionicons name="flash-outline" size={18} color="#FFFFFF" />
          <Text style={styles.emptyButtonText}>Generate a Practice</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── List Header: Stats + Search + Filters ──

  const renderListHeader = () => (
    <View style={styles.listHeader}>
      {/* Stats Row */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{stats.total}</Text>
          <Text style={styles.statLabel}>Practices</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statNumber, { color: '#D97706' }]}>{stats.streak}</Text>
          <Text style={styles.statLabel}>Day Streak</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statNumber, { color: '#059669' }]}>{stats.totalDrills}</Text>
          <Text style={styles.statLabel}>Drills Run</Text>
        </View>
      </View>

      {/* Most practiced age group */}
      {stats.mostAge && (
        <View style={styles.insightRow}>
          <Ionicons name="trophy-outline" size={14} color="#D97706" />
          <Text style={styles.insightText}>
            Most practiced: <Text style={styles.insightBold}>{formatAgeGroupShort(stats.mostAge)}</Text>
          </Text>
        </View>
      )}

      {/* Search Bar */}
      <View style={styles.searchRow}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={16} color="#9CA3AF" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search drills, age groups, notes..."
            placeholderTextColor="#9CA3AF"
            value={searchQuery}
            onChangeText={setSearchQuery}
            returnKeyType="search"
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={16} color="#9CA3AF" />
            </TouchableOpacity>
          ) : null}
        </View>
        <TouchableOpacity
          style={[styles.filterToggle, showFilters && styles.filterToggleActive]}
          onPress={() => { animateExpand(); setShowFilters(!showFilters); }}
        >
          <Ionicons
            name="options-outline"
            size={18}
            color={showFilters ? '#FFFFFF' : '#1B4332'}
          />
          {activeFilterCount > 0 && (
            <View style={styles.filterBadge}>
              <Text style={styles.filterBadgeText}>{activeFilterCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Filter Chips */}
      {showFilters && (
        <View style={styles.filterSection}>
          {/* Age Group Filters */}
          <Text style={styles.filterGroupLabel}>Age Group</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
            <View style={styles.chipRow}>
              {AGE_GROUPS.map(ag => (
                <TouchableOpacity
                  key={ag}
                  style={[styles.chip, filterAge === ag && styles.chipActive]}
                  onPress={() => setFilterAge(filterAge === ag ? null : ag)}
                >
                  <Text style={[styles.chipText, filterAge === ag && styles.chipTextActive]}>
                    {formatAgeGroupShort(ag)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>

          {/* Source Filters */}
          <Text style={styles.filterGroupLabel}>Source</Text>
          <View style={styles.chipRow}>
            {SOURCE_OPTIONS.map(src => (
              <TouchableOpacity
                key={src}
                style={[styles.chip, filterSource === src && styles.chipActive]}
                onPress={() => setFilterSource(filterSource === src ? null : src)}
              >
                <Text style={[styles.chipText, filterSource === src && styles.chipTextActive]}>
                  {SOURCE_LABELS[src]}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Category Filters */}
          <Text style={styles.filterGroupLabel}>Category</Text>
          <View style={styles.chipRow}>
            {CATEGORY_ORDER.map(cat => (
              <TouchableOpacity
                key={cat}
                style={[styles.chip, filterCategory === cat && styles.chipActive]}
                onPress={() => setFilterCategory(filterCategory === cat ? null : cat)}
              >
                <Text style={[styles.chipText, filterCategory === cat && styles.chipTextActive]}>
                  {cat.charAt(0).toUpperCase() + cat.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {activeFilterCount > 0 && (
            <TouchableOpacity style={styles.clearFilters} onPress={clearFilters}>
              <Ionicons name="close-circle-outline" size={14} color="#EF4444" />
              <Text style={styles.clearFiltersText}>Clear all filters</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Active filter summary */}
      {!showFilters && activeFilterCount > 0 && (
        <View style={styles.activeFilterBar}>
          <Text style={styles.activeFilterText}>
            {filteredHistory.length} result{filteredHistory.length !== 1 ? 's' : ''}
          </Text>
          <TouchableOpacity onPress={clearFilters}>
            <Text style={styles.clearFilterLink}>Clear filters</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

  // ── Section Header ──

  const renderSectionHeader = ({ section }: { section: typeof sections[0] }) => (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionDot} />
      <Text style={styles.sectionHeaderText}>{section.title}</Text>
      <View style={styles.sectionLine} />
      <Text style={styles.sectionHeaderCount}>
        {section.data.length}
      </Text>
    </View>
  );

  // ── History Card ──

  const renderHistoryItem = ({ item }: { item: HistoryEntry }) => {
    const { session, savedAt } = item;
    if (!session?.request) return null;

    const categories = CATEGORY_ORDER.filter(cat =>
      session.selectedDrills?.some(d => d.category === cat)
    );
    const timeStr = new Date(savedAt).toLocaleTimeString('en-US', {
      hour: 'numeric', minute: '2-digit', hour12: true,
    });
    const drillCount = session.selectedDrills?.length ?? 0;
    const duration = session.stationLayout?.totalWallClockMinutes ?? 0;
    const coachCount = (session.coachNames?.length ?? 1);
    const hasNote = !!(editingNotes[savedAt] ?? item.coachNote);
    const isExpanded = expandedNote === savedAt;

    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => { restoreSession(session); router.push('/practice'); }}
        activeOpacity={0.8}
      >
        {/* Card accent stripe based on source */}
        <View style={[
          styles.cardAccent,
          session.source === 'ai' ? styles.cardAccentAI :
          session.source === 'manual' ? styles.cardAccentManual :
          styles.cardAccentLibrary,
        ]} />

        <View style={styles.cardBody}>
          {/* Top row: age group label + source badge + actions */}
          <View style={styles.cardTopRow}>
            <View style={styles.cardTitleArea}>
              <Text style={styles.cardTitle} numberOfLines={1}>
                {formatAgeGroup(session.request.ageGroup)}
              </Text>
              {session.source && <SourceBadge source={session.source} size="small" />}
            </View>
            <View style={styles.cardActions}>
              <View onStartShouldSetResponder={() => true}>
                <TouchableOpacity
                  onPress={() => handleSharePractice(session)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="share-outline" size={17} color="#3B82F6" />
                </TouchableOpacity>
              </View>
              <View onStartShouldSetResponder={() => true}>
                <TouchableOpacity
                  onPress={() => handleDelete(savedAt)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="trash-outline" size={17} color="#EF4444" />
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* Stats row with icons */}
          <View style={styles.cardStatsRow}>
            <View style={styles.cardStat}>
              <Ionicons name="time-outline" size={13} color="#6B7280" />
              <Text style={styles.cardStatText}>{timeStr}</Text>
            </View>
            <View style={styles.cardStatDivider} />
            <View style={styles.cardStat}>
              <Ionicons name="barbell-outline" size={13} color="#6B7280" />
              <Text style={styles.cardStatText}>{drillCount} drills</Text>
            </View>
            <View style={styles.cardStatDivider} />
            <View style={styles.cardStat}>
              <Ionicons name="hourglass-outline" size={13} color="#6B7280" />
              <Text style={styles.cardStatText}>{duration} min</Text>
            </View>
            {coachCount > 1 && (
              <>
                <View style={styles.cardStatDivider} />
                <View style={styles.cardStat}>
                  <Ionicons name="people-outline" size={13} color="#6B7280" />
                  <Text style={styles.cardStatText}>{coachCount} coaches</Text>
                </View>
              </>
            )}
          </View>

          {/* Category badges */}
          <View style={styles.cardCategories}>
            {categories.map(cat => (
              <CategoryBadge key={cat} category={cat} />
            ))}
          </View>

          {/* Drill preview (first 3 drills) */}
          <View style={styles.drillPreview}>
            {session.selectedDrills?.slice(0, 3).map((d, i) => (
              <Text key={d.id + '-' + i} style={styles.drillPreviewText} numberOfLines={1}>
                {i + 1}. {d.name}
              </Text>
            ))}
            {drillCount > 3 && (
              <Text style={styles.drillPreviewMore}>+{drillCount - 3} more</Text>
            )}
          </View>

          {/* Coach notes */}
          <View onStartShouldSetResponder={() => true}>
            <TouchableOpacity
              style={styles.noteToggle}
              onPress={() => { animateFade(); setExpandedNote(isExpanded ? null : savedAt); }}
              activeOpacity={0.7}
            >
              <Ionicons
                name={hasNote ? 'document-text' : 'document-text-outline'}
                size={14}
                color={hasNote ? '#1B4332' : '#9CA3AF'}
              />
              <Text style={[styles.noteToggleText, hasNote && styles.noteToggleTextFilled]}>
                {hasNote ? 'Coach Notes' : 'Add notes'}
              </Text>
              <Ionicons
                name={isExpanded ? 'chevron-up' : 'chevron-down'}
                size={14}
                color="#9CA3AF"
              />
            </TouchableOpacity>
            {isExpanded && (
              <TextInput
                style={styles.coachNoteInput}
                placeholder="What went well? What to improve next time?"
                placeholderTextColor="#9CA3AF"
                value={editingNotes[savedAt] ?? item.coachNote ?? ''}
                onChangeText={text => handleNoteChange(savedAt, text)}
                onBlur={() => handleNoteBlur(savedAt)}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />
            )}
          </View>
        </View>

        {/* Chevron */}
        <View style={styles.cardChevron}>
          <Ionicons name="chevron-forward" size={16} color="#D1D5DB" />
        </View>
      </TouchableOpacity>
    );
  };

  // ── Footer ──

  const renderFooter = () => {
    if (filteredHistory.length === 0 && allVisible.length > 0) {
      return (
        <View style={styles.noResults}>
          <Ionicons name="search-outline" size={28} color="#D1D5DB" />
          <Text style={styles.noResultsText}>No practices match your filters</Text>
          <TouchableOpacity onPress={clearFilters}>
            <Text style={styles.clearFilterLink}>Clear all filters</Text>
          </TouchableOpacity>
        </View>
      );
    }
    if (tier === 'free' && history.length > FREE_HISTORY_LIMIT) {
      return (
        <TouchableOpacity
          style={styles.upgradeNote}
          onPress={() => router.push('/upgrade')}
          activeOpacity={0.7}
        >
          <Ionicons name="diamond-outline" size={16} color="#92400E" />
          <Text style={styles.upgradeNoteText}>
            Keep unlimited practice log with <Text style={styles.upgradeNoteBold}>Pro</Text>
          </Text>
        </TouchableOpacity>
      );
    }
    return <View style={{ height: 20 }} />;
  };

  // ── Render ──

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <SectionList
        style={styles.scroll}
        contentContainerStyle={[styles.container, { paddingBottom: insets.bottom + 20 }]}
        sections={sections}
        renderSectionHeader={renderSectionHeader}
        renderItem={renderHistoryItem}
        keyExtractor={item => item.savedAt.toString()}
        ListHeaderComponent={renderListHeader}
        ListFooterComponent={renderFooter}
        ListEmptyComponent={null}
        stickySectionHeadersEnabled={false}
        initialNumToRender={10}
        maxToRenderPerBatch={5}
        windowSize={5}
        keyboardShouldPersistTaps="handled"
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: '#FAFBFC' },
  container: { padding: 16 },

  // ── Empty State ──
  emptyContainer: {
    flex: 1, backgroundColor: '#FAFBFC',
    alignItems: 'center', justifyContent: 'center', padding: 32,
  },
  emptyIconCircle: {
    width: 64, height: 64, borderRadius: 32, backgroundColor: '#ECFDF5',
    alignItems: 'center', justifyContent: 'center', marginBottom: 20,
  },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: '#111827' },
  emptyBody: {
    fontSize: 14, color: '#6B7280', textAlign: 'center',
    marginTop: 8, lineHeight: 21, paddingHorizontal: 10,
  },
  emptyButton: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#1B4332', borderRadius: 14,
    paddingVertical: 14, paddingHorizontal: 24, marginTop: 24,
  },
  emptyButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },

  // ── List Header ──
  listHeader: { marginBottom: 8 },

  // Stats
  statsRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  statCard: {
    flex: 1, backgroundColor: '#FFFFFF', borderRadius: 12, padding: 12,
    alignItems: 'center', borderWidth: 1, borderColor: '#F3F4F6',
  },
  statNumber: { fontSize: 22, fontWeight: '700', color: '#1B4332' },
  statLabel: {
    fontSize: 10, fontWeight: '600', color: '#9CA3AF', marginTop: 2,
    textTransform: 'uppercase', letterSpacing: 0.3,
  },

  // Insight
  insightRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#FEF3C7', borderRadius: 10,
    paddingVertical: 8, paddingHorizontal: 12, marginBottom: 12,
  },
  insightText: { fontSize: 13, color: '#92400E' },
  insightBold: { fontWeight: '700' },

  // Search
  searchRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  searchBar: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#FFFFFF', borderRadius: 12, paddingHorizontal: 12,
    height: 42, borderWidth: 1, borderColor: '#E5E7EB',
  },
  searchInput: { flex: 1, fontSize: 14, color: '#111827', paddingVertical: 0 },
  filterToggle: {
    width: 42, height: 42, borderRadius: 12, backgroundColor: '#FFFFFF',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: '#E5E7EB', position: 'relative',
  },
  filterToggleActive: { backgroundColor: '#1B4332', borderColor: '#1B4332' },
  filterBadge: {
    position: 'absolute', top: -4, right: -4,
    width: 16, height: 16, borderRadius: 8, backgroundColor: '#EF4444',
    alignItems: 'center', justifyContent: 'center',
  },
  filterBadgeText: { color: '#FFFFFF', fontSize: 9, fontWeight: '700' },

  // Filters
  filterSection: {
    backgroundColor: '#FFFFFF', borderRadius: 12, padding: 14,
    marginBottom: 8, borderWidth: 1, borderColor: '#E5E7EB',
  },
  filterGroupLabel: {
    fontSize: 11, fontWeight: '600', color: '#9CA3AF',
    textTransform: 'uppercase', letterSpacing: 0.5,
    marginBottom: 6, marginTop: 8,
  },
  chipScroll: { marginBottom: 2 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 4 },
  chip: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16,
    backgroundColor: '#F3F4F6', borderWidth: 1, borderColor: '#E5E7EB',
  },
  chipActive: { backgroundColor: '#1B4332', borderColor: '#1B4332' },
  chipText: { fontSize: 12, fontWeight: '500', color: '#374151' },
  chipTextActive: { color: '#FFFFFF' },
  clearFilters: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    alignSelf: 'center', marginTop: 10,
  },
  clearFiltersText: { fontSize: 12, fontWeight: '500', color: '#EF4444' },

  // Active filter bar (collapsed)
  activeFilterBar: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 6, paddingHorizontal: 4,
  },
  activeFilterText: { fontSize: 13, color: '#6B7280' },
  clearFilterLink: { fontSize: 13, fontWeight: '600', color: '#3B82F6' },

  // ── Section Header ──
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 10, marginTop: 4,
  },
  sectionDot: {
    width: 8, height: 8, borderRadius: 4, backgroundColor: '#1B4332',
  },
  sectionHeaderText: { fontSize: 15, fontWeight: '700', color: '#1B4332' },
  sectionLine: { flex: 1, height: 1, backgroundColor: '#E5E7EB' },
  sectionHeaderCount: {
    fontSize: 12, fontWeight: '600', color: '#9CA3AF',
    backgroundColor: '#F3F4F6', borderRadius: 10,
    paddingHorizontal: 8, paddingVertical: 2,
  },

  // ── Card ──
  card: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF', borderRadius: 16,
    marginBottom: 12, overflow: 'hidden',
    borderWidth: 1, borderColor: '#F3F4F6',
    shadowColor: '#1B4332', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },
  cardAccent: { width: 4 },
  cardAccentAI: { backgroundColor: '#D4AF37' },
  cardAccentManual: { backgroundColor: '#059669' },
  cardAccentLibrary: { backgroundColor: '#3B82F6' },
  cardBody: { flex: 1, padding: 14 },
  cardChevron: {
    justifyContent: 'center', paddingRight: 12,
  },

  // Card top row
  cardTopRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    marginBottom: 8,
  },
  cardTitleArea: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardTitle: { fontSize: 16, fontWeight: '700', color: '#111827' },
  cardActions: { flexDirection: 'row', gap: 12, marginLeft: 8 },

  // Card stats
  cardStatsRow: {
    flexDirection: 'row', alignItems: 'center',
    marginBottom: 10, flexWrap: 'wrap', gap: 4,
  },
  cardStat: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  cardStatText: { fontSize: 12, color: '#6B7280' },
  cardStatDivider: {
    width: 3, height: 3, borderRadius: 1.5, backgroundColor: '#D1D5DB',
    marginHorizontal: 4,
  },

  // Categories
  cardCategories: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginBottom: 10 },

  // Drill preview
  drillPreview: {
    backgroundColor: '#F9FAFB', borderRadius: 10, padding: 10,
    marginBottom: 8, gap: 3,
  },
  drillPreviewText: { fontSize: 12, color: '#374151', lineHeight: 17 },
  drillPreviewMore: { fontSize: 12, color: '#9CA3AF', fontStyle: 'italic', marginTop: 2 },

  // Note toggle
  noteToggle: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingVertical: 4,
  },
  noteToggleText: { flex: 1, fontSize: 12, fontWeight: '500', color: '#9CA3AF' },
  noteToggleTextFilled: { color: '#1B4332' },

  // Coach note input
  coachNoteInput: {
    marginTop: 6, padding: 10,
    backgroundColor: '#F9FAFB', borderRadius: 10,
    borderWidth: 1, borderColor: '#E5E7EB',
    fontSize: 13, color: '#374151', minHeight: 60,
    textAlignVertical: 'top',
  },

  // No results
  noResults: {
    alignItems: 'center', paddingVertical: 32, gap: 8,
  },
  noResultsText: { fontSize: 15, fontWeight: '500', color: '#9CA3AF' },

  // Upgrade
  upgradeNote: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#FEF3C7', borderRadius: 14,
    paddingHorizontal: 18, paddingVertical: 14,
    marginTop: 8,
  },
  upgradeNoteText: { fontSize: 14, color: '#92400E' },
  upgradeNoteBold: { fontWeight: '700' },
});
