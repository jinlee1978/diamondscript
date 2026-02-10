import React from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { usePractice } from '../context/PracticeContext';
import CategoryBadge from '../components/CategoryBadge';
import { DrillCategory } from '../src/data/types';

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
  const { tier, history, restoreSession, deletePracticeHistory } = usePractice();

  // Cap at 5 for free tier
  const visibleHistory = tier === 'pro' ? history : history.slice(0, FREE_HISTORY_LIMIT);

  if (visibleHistory.length === 0) {
    return (
      <View style={styles.container}>
        <Text style={styles.empty}>No practices saved yet. Generate one to get started.</Text>
      </View>
    );
  }

  const renderHistoryItem = ({ item }: { item: typeof visibleHistory[0] }) => {
    const { session, savedAt } = item;
    const categories = CATEGORY_ORDER.filter((cat) =>
      session.selectedDrills.some((d) => d.category === cat)
    );

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
          <Text style={styles.cardDate}>{formatDate(savedAt)}</Text>
          <View style={styles.cardActions}>
            <View onStartShouldSetResponder={() => true}>
              <TouchableOpacity
                onPress={() => deletePracticeHistory(savedAt)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={styles.cardDelete}>{'\u00D7'}</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.cardChevron}>{'\u203A'}</Text>
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
    <FlatList
      style={styles.scroll}
      contentContainerStyle={styles.container}
      data={visibleHistory}
      renderItem={renderHistoryItem}
      keyExtractor={(item) => item.savedAt.toString()}
      ListFooterComponent={renderFooter}
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
    padding: 20,
    paddingBottom: 40,
  },
  empty: {
    textAlign: 'center',
    marginTop: 80,
    color: '#6B7280',
    fontSize: 15,
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
  cardDate: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
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
