import React, { useMemo, useState, useCallback } from 'react';
import { View, Text, SectionList, TouchableOpacity, StyleSheet, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePractice } from '../../context/PracticeContext';
import CategoryBadge from '../../components/CategoryBadge';
import SourceBadge from '../../components/SourceBadge';
import { DrillCategory } from '../../src/data/types';


// Format timestamp to readable date
function formatDate(timestamp: number): string {
  const now = new Date();
  const date = new Date(timestamp);

  // Today
  if (date.toDateString() === now.toDateString()) return 'Today';

  // Yesterday
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';

  // Otherwise "Mon, Jan 15"
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function formatAgeGroup(raw: string): string {
  return raw.replace('AGE_', '').replace('_', '-').replace('T-BALL', 'T-Ball');
}

const FREE_HISTORY_LIMIT = 5;
const CATEGORY_ORDER: DrillCategory[] = ['hitting', 'fielding', 'pitching', 'baserunning'];

export default function HistoryScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { tier, history, restoreSession, deletePracticeHistory, updateCoachNote } = usePractice();

  // BUILD 74: Local state for coach notes (tracks in-progress edits)
  const [editingNotes, setEditingNotes] = useState<Record<number, string>>({});

  // Debounced save for coach notes
  const handleNoteChange = useCallback((savedAt: number, text: string) => {
    setEditingNotes((prev) => ({ ...prev, [savedAt]: text }));
  }, []);

  const handleNoteBlur = useCallback((savedAt: number) => {
    const note = editingNotes[savedAt];
    if (note !== undefined) {
      updateCoachNote(savedAt, note);
    }
  }, [editingNotes, updateCoachNote]);

  // Cap at 5 for free tier
  const visibleHistory = tier === 'pro' ? history : history.slice(0, FREE_HISTORY_LIMIT);

  // Group history by date (same calendar day)
  const sections = useMemo(() => {
    const groups: { [key: string]: typeof visibleHistory } = {};

    visibleHistory.forEach((item) => {
      const dateKey = new Date(item.savedAt).toDateString();
      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }
      groups[dateKey].push(item);
    });

    // Convert to SectionList format
    return Object.entries(groups).map(([dateKey, items]) => ({
      title: formatDate(items[0].savedAt), // Use first item's timestamp for title
      date: dateKey,
      data: items,
    }));
  }, [visibleHistory]);

  if (visibleHistory.length === 0) {
    return (
      <View style={[styles.container, { paddingBottom: insets.bottom }]}>
        <Text style={styles.empty}>No practices saved yet. Generate one to get started.</Text>
      </View>
    );
  }

  const renderSectionHeader = ({ section }: { section: typeof sections[0] }) => (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionHeaderText}>{section.title}</Text>
      <Text style={styles.sectionHeaderCount}>
        {section.data.length} practice{section.data.length !== 1 ? 's' : ''}
      </Text>
    </View>
  );

  const renderHistoryItem = ({ item }: { item: typeof visibleHistory[0] }) => {
    const { session, savedAt } = item;
    const categories = CATEGORY_ORDER.filter((cat) =>
      session.selectedDrills.some((d) => d.category === cat)
    );

    // Format time only (since date is in section header)
    const timeStr = new Date(savedAt).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });

    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => {
          restoreSession(session);
          router.push('/practice');
        }}
        activeOpacity={0.8}
      >
        <View style={styles.cardHeader}>
          <View style={styles.cardHeaderLeft}>
            <Text style={styles.cardTime}>{timeStr}</Text>
            {session.source && <SourceBadge source={session.source} size="small" />}
          </View>
          <View style={styles.cardActions}>
            <View onStartShouldSetResponder={() => true}>
              <TouchableOpacity
                onPress={() => deletePracticeHistory(savedAt)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="trash-outline" size={18} color="#EF4444" />
              </TouchableOpacity>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
          </View>
        </View>
        <View style={styles.cardMeta}>
          <Text style={styles.cardMetaText}>
            {formatAgeGroup(session.request.ageGroup)}
          </Text>
          <Text style={styles.cardMetaDot}>&#8226;</Text>
          <Text style={styles.cardMetaText}>
            {session.selectedDrills.length} drill{session.selectedDrills.length !== 1 ? 's' : ''}
          </Text>
          <Text style={styles.cardMetaDot}>&#8226;</Text>
          <Text style={styles.cardMetaText}>
            {session.stationLayout.totalWallClockMinutes} min
          </Text>
        </View>
        <View style={styles.cardCategories}>
          {categories.map((cat) => (
            <CategoryBadge key={cat} category={cat} />
          ))}
        </View>
        {/* BUILD 74: Coach Notes Input */}
        <View onStartShouldSetResponder={() => true}>
          <TextInput
            style={styles.coachNoteInput}
            placeholder="Add a post-practice note..."
            placeholderTextColor="#9CA3AF"
            value={editingNotes[savedAt] ?? item.coachNote ?? ''}
            onChangeText={(text) => handleNoteChange(savedAt, text)}
            onBlur={() => handleNoteBlur(savedAt)}
            multiline
            numberOfLines={2}
            textAlignVertical="top"
          />
        </View>
      </TouchableOpacity>
    );
  };

  const renderFooter = () => {
    if (tier === 'free' && history.length > FREE_HISTORY_LIMIT) {
      return (
        <TouchableOpacity
          style={styles.upgradeNote}
          onPress={() => router.push('/upgrade')}
          activeOpacity={0.7}
        >
          <Text style={styles.upgradeNoteText}>
            &#9733; Keep unlimited history with <Text style={styles.upgradeNoteBold}>Pro</Text>
          </Text>
        </TouchableOpacity>
      );
    }
    return null;
  };

  return (
    <SectionList
      style={styles.scroll}
      contentContainerStyle={[styles.container, { paddingBottom: insets.bottom }]}
      sections={sections}
      renderSectionHeader={renderSectionHeader}
      renderItem={renderHistoryItem}
      keyExtractor={(item) => item.savedAt.toString()}
      ListFooterComponent={renderFooter}
      stickySectionHeadersEnabled={false}
      initialNumToRender={10}
      maxToRenderPerBatch={5}
      windowSize={5}
    />
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  container: {
    padding: 20,
    paddingBottom: 40,
  },
  empty: {
    textAlign: 'center',
    marginTop: 80,
    color: '#6B7280',
    fontSize: 15,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 4,
    marginTop: 8,
    marginBottom: 8,
  },
  sectionHeaderText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1B4332',
  },
  sectionHeaderCount: {
    fontSize: 12,
    fontWeight: '600',
    color: '#9CA3AF',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 18,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    shadowColor: '#1B4332',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cardTime: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
  },
  cardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  cardDelete: {
    fontSize: 20,
    color: '#EF4444',
    fontWeight: '600',
  },
  cardChevron: {
    fontSize: 18,
    color: '#9CA3AF',
  },
  cardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  cardMetaText: {
    fontSize: 13,
    color: '#6B7280',
  },
  cardMetaDot: {
    color: '#D1D5DB',
    fontSize: 10,
  },
  cardCategories: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
  },
  coachNoteInput: {
    marginTop: 12,
    padding: 10,
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    fontSize: 13,
    color: '#374151',
    minHeight: 44,
  },
  upgradeNote: {
    backgroundColor: '#FEF3C7',
    borderRadius: 16,
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderLeftWidth: 4,
    borderLeftColor: '#D4AF37',
    marginTop: 8,
    shadowColor: '#D4AF37',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  upgradeNoteText: {
    fontSize: 14,
    color: '#92400E',
    textAlign: 'center',
  },
  upgradeNoteBold: {
    fontWeight: '700',
  },
});
