/**
 * BUILD 103: Enhanced Season Mode Screen
 *
 * Calendar-based practice scheduling with:
 * - Practice details + notes
 * - Guided onboarding for adding practices
 * - Share full schedule or individual practice dates
 * - Inline note editing
 * - Link generated practice plans from History to scheduled dates
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Modal, TextInput, Alert, KeyboardAvoidingView, Platform, Share, FlatList,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AgeGroup } from '../src/data/types';
import { PracticeSession } from '../src/data/types/practice';
import { Season, ScheduledPractice, SeasonStore } from '../src/data/types/season';
import {
  loadSeasons, createSeason, deleteSeason,
  addPracticeToSeason, removePracticeFromSeason,
  togglePracticeComplete, updatePracticeNotes, getActiveSeason,
  linkPlanToPractice,
} from '../src/data/storage/seasonStorage';
import { usePractice, HistoryEntry } from '../context/PracticeContext';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function formatDateStr(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function formatDateReadable(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
}

export default function SeasonScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { history, restoreSession } = usePractice();
  const [store, setStore] = useState<SeasonStore | null>(null);
  const [activeSeason, setActiveSeason] = useState<Season | null>(null);

  // Calendar navigation
  const now = new Date();
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  // New season modal
  const [showNewSeason, setShowNewSeason] = useState(false);
  const [newName, setNewName] = useState('');

  // Add practice modal
  const [showAddPractice, setShowAddPractice] = useState(false);
  const [practiceTime, setPracticeTime] = useState('5:30 PM');
  const [practiceLocation, setPracticeLocation] = useState('');
  const [practiceNotes, setPracticeNotes] = useState('');

  // Edit notes
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editNoteText, setEditNoteText] = useState('');

  // Link plan modal
  const [showLinkPicker, setShowLinkPicker] = useState(false);
  const [linkingPracticeId, setLinkingPracticeId] = useState<string | null>(null);

  useEffect(() => {
    loadSeasons().then(s => {
      setStore(s);
      if (s.activeSeasonId) {
        const active = s.seasons.find(se => se.id === s.activeSeasonId);
        setActiveSeason(active ?? null);
      }
    });
  }, []);

  // Stats
  const seasonStats = useMemo(() => {
    if (!activeSeason) return { total: 0, completed: 0, upcoming: 0 };
    const today = new Date().toISOString().split('T')[0];
    const completed = activeSeason.practices.filter(p => p.completed).length;
    const upcoming = activeSeason.practices.filter(p => p.date >= today && !p.completed).length;
    return { total: activeSeason.practices.length, completed, upcoming };
  }, [activeSeason]);

  // Practice dates set for fast lookup
  const practiceDates = useMemo(() => {
    if (!activeSeason) return new Set<string>();
    return new Set(activeSeason.practices.map(p => p.date));
  }, [activeSeason]);

  // Calendar grid
  const calendarDays = useMemo(() => {
    const firstDay = new Date(viewYear, viewMonth, 1).getDay();
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const cells: (number | null)[] = [];
    for (let i = 0; i < firstDay; i++) cells.push(null);
    for (let i = 1; i <= daysInMonth; i++) cells.push(i);
    return cells;
  }, [viewYear, viewMonth]);

  // Practices for selected date
  const selectedPractices = useMemo(() => {
    if (!activeSeason || !selectedDate) return [];
    return activeSeason.practices.filter(p => p.date === selectedDate);
  }, [activeSeason, selectedDate]);

  const refreshSeason = (updated: SeasonStore) => {
    setStore(updated);
    if (activeSeason) {
      const season = updated.seasons.find(s => s.id === activeSeason.id);
      if (season) setActiveSeason(season);
    }
  };

  const handlePrevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(viewYear - 1); }
    else setViewMonth(viewMonth - 1);
  };

  const handleNextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(viewYear + 1); }
    else setViewMonth(viewMonth + 1);
  };

  const handleCreateSeason = async () => {
    if (!newName.trim()) return;
    const startDate = formatDateStr(viewYear, viewMonth, 1);
    const endDate = formatDateStr(viewYear, viewMonth + 2, 28);
    const { store: updated, newSeason } = await createSeason(
      newName.trim(), AgeGroup.KID_PITCH, startDate, endDate
    );
    setStore(updated);
    setActiveSeason(newSeason);
    setShowNewSeason(false);
    setNewName('');
  };

  const handleAddPractice = async () => {
    if (!activeSeason || !selectedDate) return;
    const updated = await addPracticeToSeason(
      activeSeason.id, selectedDate, practiceTime, practiceLocation || undefined
    );
    // Save notes if provided
    if (practiceNotes.trim()) {
      const season = updated.seasons.find(s => s.id === activeSeason.id);
      const newPractice = season?.practices.find(p => p.date === selectedDate && !selectedPractices.some(sp => sp.id === p.id));
      if (newPractice) {
        const updated2 = await updatePracticeNotes(activeSeason.id, newPractice.id, practiceNotes.trim());
        refreshSeason(updated2);
      } else {
        refreshSeason(updated);
      }
    } else {
      refreshSeason(updated);
    }
    setShowAddPractice(false);
    setPracticeTime('5:30 PM');
    setPracticeLocation('');
    setPracticeNotes('');
  };

  const handleToggleComplete = async (practice: ScheduledPractice) => {
    if (!activeSeason) return;
    const updated = await togglePracticeComplete(activeSeason.id, practice.id);
    refreshSeason(updated);
  };

  const handleRemovePractice = async (practice: ScheduledPractice) => {
    if (!activeSeason) return;
    Alert.alert('Remove Practice?', `Remove the practice on ${formatDateReadable(practice.date)}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove', style: 'destructive',
        onPress: async () => {
          const updated = await removePracticeFromSeason(activeSeason.id, practice.id);
          refreshSeason(updated);
        },
      },
    ]);
  };

  const handleSaveNote = async (practiceId: string) => {
    if (!activeSeason) return;
    const updated = await updatePracticeNotes(activeSeason.id, practiceId, editNoteText.trim());
    refreshSeason(updated);
    setEditingNoteId(null);
    setEditNoteText('');
  };

  // Link a practice plan from history
  const handleLinkPlan = (practiceId: string) => {
    setLinkingPracticeId(practiceId);
    setShowLinkPicker(true);
  };

  const handleSelectPlan = async (entry: HistoryEntry) => {
    if (!activeSeason || !linkingPracticeId) return;
    const updated = await linkPlanToPractice(activeSeason.id, linkingPracticeId, entry.savedAt);
    refreshSeason(updated);
    setShowLinkPicker(false);
    setLinkingPracticeId(null);
  };

  const handleUnlinkPlan = async (practiceId: string) => {
    if (!activeSeason) return;
    const updated = await linkPlanToPractice(activeSeason.id, practiceId, 0);
    refreshSeason(updated);
  };

  const handleViewLinkedPlan = (practice: ScheduledPractice) => {
    if (!practice.linkedHistoryId) return;
    const entry = history.find(h => h.savedAt === practice.linkedHistoryId);
    if (entry) {
      restoreSession(entry.session);
      router.push('/practice');
    } else {
      Alert.alert('Plan Not Found', 'The linked practice plan is no longer in your history.');
    }
  };

  // Helper: get linked history entry for a practice
  const getLinkedEntry = (practice: ScheduledPractice): HistoryEntry | undefined => {
    if (!practice.linkedHistoryId) return undefined;
    return history.find(h => h.savedAt === practice.linkedHistoryId);
  };

  // Share full schedule
  const handleShareSchedule = async () => {
    if (!activeSeason) return;
    const lines: string[] = [
      `${activeSeason.name} — Practice Schedule`,
      `${seasonStats.total} practices scheduled`,
      '',
    ];
    const sorted = [...activeSeason.practices].sort((a, b) => a.date.localeCompare(b.date));
    sorted.forEach(p => {
      const status = p.completed ? '[Done]' : '[ ]';
      const dateLabel = formatDateReadable(p.date);
      const time = p.time ? ` at ${p.time}` : '';
      const loc = p.location ? ` — ${p.location}` : '';
      const notes = p.notes ? `\n   Note: ${p.notes}` : '';
      lines.push(`${status} ${dateLabel}${time}${loc}${notes}`);
    });
    lines.push('', 'Shared from DiamondScript');
    await Share.share({ message: lines.join('\n') }).catch(() => {});
  };

  // Share single practice
  const handleSharePractice = async (practice: ScheduledPractice) => {
    const dateLabel = formatDateReadable(practice.date);
    const lines = [
      `Practice — ${dateLabel}`,
      practice.time ? `Time: ${practice.time}` : '',
      practice.location ? `Location: ${practice.location}` : '',
      practice.notes ? `Notes: ${practice.notes}` : '',
      practice.completed ? 'Status: Completed' : 'Status: Upcoming',
      '',
      'Shared from DiamondScript',
    ].filter(Boolean);
    await Share.share({ message: lines.join('\n') }).catch(() => {});
  };

  const todayStr = formatDateStr(now.getFullYear(), now.getMonth(), now.getDate());

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Season',
          headerRight: activeSeason ? () => (
            <TouchableOpacity onPress={handleShareSchedule} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="share-outline" size={22} color="#FFFFFF" />
            </TouchableOpacity>
          ) : undefined,
        }}
      />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.container, { paddingBottom: insets.bottom + 24 }]}
      >
        {!activeSeason ? (
          /* Onboarding empty state */
          <View style={styles.emptyState}>
            <View style={styles.emptyIconCircle}>
              <Ionicons name="calendar" size={36} color="#1B4332" />
            </View>
            <Text style={styles.emptyTitle}>Plan Your Season</Text>
            <Text style={styles.emptyBody}>
              Organize your practices across the season. Add dates, times, locations, and notes — then share the schedule with your coaching staff.
            </Text>

            <View style={styles.emptySteps}>
              <View style={styles.emptyStep}>
                <View style={styles.emptyStepDot}><Text style={styles.emptyStepDotText}>1</Text></View>
                <Text style={styles.emptyStepText}>Create a season (e.g. "Spring 2026")</Text>
              </View>
              <View style={styles.emptyStep}>
                <View style={styles.emptyStepDot}><Text style={styles.emptyStepDotText}>2</Text></View>
                <Text style={styles.emptyStepText}>Tap dates on the calendar to add practices</Text>
              </View>
              <View style={styles.emptyStep}>
                <View style={styles.emptyStepDot}><Text style={styles.emptyStepDotText}>3</Text></View>
                <Text style={styles.emptyStepText}>Add time, location, and notes for each practice</Text>
              </View>
            </View>

            <TouchableOpacity style={styles.createButton} onPress={() => setShowNewSeason(true)}>
              <Ionicons name="add" size={20} color="#FFFFFF" />
              <Text style={styles.createButtonText}>Create Season</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {/* Season Header + Stats */}
            <View style={styles.seasonHeader}>
              <Text style={styles.seasonName}>{activeSeason.name}</Text>
            </View>

            <View style={styles.statsRow}>
              <View style={styles.statCard}>
                <Text style={styles.statNumber}>{seasonStats.total}</Text>
                <Text style={styles.statLabel}>Scheduled</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={[styles.statNumber, { color: '#059669' }]}>{seasonStats.completed}</Text>
                <Text style={styles.statLabel}>Completed</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={[styles.statNumber, { color: '#D97706' }]}>{seasonStats.upcoming}</Text>
                <Text style={styles.statLabel}>Upcoming</Text>
              </View>
            </View>

            {/* Calendar Navigation */}
            <View style={styles.calNav}>
              <TouchableOpacity onPress={handlePrevMonth} style={styles.calNavButton}>
                <Ionicons name="chevron-back" size={20} color="#1B4332" />
              </TouchableOpacity>
              <Text style={styles.calNavTitle}>
                {MONTHS[viewMonth]} {viewYear}
              </Text>
              <TouchableOpacity onPress={handleNextMonth} style={styles.calNavButton}>
                <Ionicons name="chevron-forward" size={20} color="#1B4332" />
              </TouchableOpacity>
            </View>

            {/* Day Headers */}
            <View style={styles.dayHeaders}>
              {DAYS.map(d => (
                <Text key={d} style={styles.dayHeader}>{d}</Text>
              ))}
            </View>

            {/* Calendar Grid */}
            <View style={styles.calGrid}>
              {calendarDays.map((day, i) => {
                if (day === null) {
                  return <View key={`empty-${i}`} style={styles.calCell} />;
                }
                const dateStr = formatDateStr(viewYear, viewMonth, day);
                const hasPractice = practiceDates.has(dateStr);
                const isToday = dateStr === todayStr;
                const isSelected = dateStr === selectedDate;

                return (
                  <TouchableOpacity
                    key={dateStr}
                    style={[
                      styles.calCell,
                      isToday && styles.calCellToday,
                      isSelected && styles.calCellSelected,
                    ]}
                    onPress={() => setSelectedDate(dateStr)}
                    activeOpacity={0.7}
                  >
                    <Text style={[
                      styles.calCellText,
                      isToday && styles.calCellTextToday,
                      isSelected && styles.calCellTextSelected,
                    ]}>
                      {day}
                    </Text>
                    {hasPractice && (
                      <View style={[styles.practiceDot, isSelected && styles.practiceDotSelected]} />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Guided prompt when no date selected */}
            {!selectedDate && seasonStats.total === 0 && (
              <View style={styles.guideCard}>
                <Ionicons name="hand-left-outline" size={20} color="#D97706" />
                <Text style={styles.guideText}>
                  Tap a date above to schedule your first practice
                </Text>
              </View>
            )}

            {!selectedDate && seasonStats.total > 0 && (
              <View style={styles.guideCard}>
                <Ionicons name="calendar-outline" size={18} color="#6B7280" />
                <Text style={[styles.guideText, { color: '#6B7280' }]}>
                  Tap a date to view or add practices
                </Text>
              </View>
            )}

            {/* Selected Date Detail */}
            {selectedDate && (
              <View style={styles.dateDetail}>
                <View style={styles.dateDetailHeader}>
                  <Text style={styles.dateDetailTitle}>
                    {formatDateReadable(selectedDate)}
                  </Text>
                  <TouchableOpacity
                    style={styles.addPracticeButton}
                    onPress={() => setShowAddPractice(true)}
                  >
                    <Ionicons name="add" size={18} color="#FFFFFF" />
                  </TouchableOpacity>
                </View>

                {selectedPractices.length === 0 ? (
                  <TouchableOpacity
                    style={styles.emptyDatePrompt}
                    onPress={() => setShowAddPractice(true)}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="add-circle-outline" size={22} color="#1B4332" />
                    <Text style={styles.emptyDatePromptText}>Add a practice for this date</Text>
                  </TouchableOpacity>
                ) : (
                  selectedPractices.map(p => (
                    <View key={p.id} style={styles.practiceSlot}>
                      {/* Top row: checkbox, time, actions */}
                      <View style={styles.practiceTopRow}>
                        <TouchableOpacity
                          style={[styles.checkBox, p.completed && styles.checkBoxDone]}
                          onPress={() => handleToggleComplete(p)}
                        >
                          {p.completed && <Ionicons name="checkmark" size={14} color="#FFF" />}
                        </TouchableOpacity>
                        <View style={styles.practiceMainInfo}>
                          <Text style={[styles.practiceTime, p.completed && styles.practiceCompleted]}>
                            {p.time || 'Time TBD'}
                          </Text>
                          {p.location ? (
                            <View style={styles.practiceLocationRow}>
                              <Ionicons name="location-outline" size={13} color="#6B7280" />
                              <Text style={styles.practiceLocation}>{p.location}</Text>
                            </View>
                          ) : null}
                        </View>
                        <View style={styles.practiceActions}>
                          <TouchableOpacity
                            onPress={() => handleSharePractice(p)}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          >
                            <Ionicons name="share-outline" size={16} color="#3B82F6" />
                          </TouchableOpacity>
                          <TouchableOpacity
                            onPress={() => handleRemovePractice(p)}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          >
                            <Ionicons name="trash-outline" size={16} color="#EF4444" />
                          </TouchableOpacity>
                        </View>
                      </View>

                      {/* Notes section */}
                      {editingNoteId === p.id ? (
                        <View style={styles.noteEditArea}>
                          <TextInput
                            style={styles.noteInput}
                            value={editNoteText}
                            onChangeText={setEditNoteText}
                            placeholder="Add notes (drills to focus on, equipment, etc.)"
                            placeholderTextColor="#9CA3AF"
                            multiline
                            autoFocus
                          />
                          <View style={styles.noteEditActions}>
                            <TouchableOpacity onPress={() => setEditingNoteId(null)}>
                              <Text style={styles.noteCancel}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => handleSaveNote(p.id)}>
                              <Text style={styles.noteSave}>Save</Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      ) : p.notes ? (
                        <TouchableOpacity
                          style={styles.noteDisplay}
                          onPress={() => { setEditingNoteId(p.id); setEditNoteText(p.notes || ''); }}
                        >
                          <Ionicons name="document-text-outline" size={13} color="#6B7280" />
                          <Text style={styles.noteText}>{p.notes}</Text>
                          <Ionicons name="pencil-outline" size={12} color="#9CA3AF" />
                        </TouchableOpacity>
                      ) : (
                        <TouchableOpacity
                          style={styles.addNoteButton}
                          onPress={() => { setEditingNoteId(p.id); setEditNoteText(''); }}
                        >
                          <Ionicons name="add-circle-outline" size={13} color="#1B4332" />
                          <Text style={styles.addNoteText}>Add notes</Text>
                        </TouchableOpacity>
                      )}

                      {/* Linked Practice Plan */}
                      {(() => {
                        const linked = getLinkedEntry(p);
                        if (linked) {
                          const drillCount = linked.session.selectedDrills?.length ?? 0;
                          const mins = linked.session.stationLayout?.totalWallClockMinutes ?? 0;
                          const ageLabel = linked.session.request?.ageGroup ?? 'Practice';
                          return (
                            <View style={styles.linkedPlanCard}>
                              <TouchableOpacity
                                style={styles.linkedPlanMain}
                                onPress={() => handleViewLinkedPlan(p)}
                                activeOpacity={0.7}
                              >
                                <Ionicons name="clipboard-outline" size={16} color="#1B4332" />
                                <View style={styles.linkedPlanInfo}>
                                  <Text style={styles.linkedPlanTitle} numberOfLines={1}>
                                    {ageLabel} Plan
                                  </Text>
                                  <Text style={styles.linkedPlanMeta}>
                                    {drillCount} drills · {mins} min
                                  </Text>
                                </View>
                                <Ionicons name="chevron-forward" size={14} color="#9CA3AF" />
                              </TouchableOpacity>
                              <TouchableOpacity
                                onPress={() => handleUnlinkPlan(p.id)}
                                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                style={styles.unlinkButton}
                              >
                                <Ionicons name="close-circle-outline" size={16} color="#9CA3AF" />
                              </TouchableOpacity>
                            </View>
                          );
                        }
                        return (
                          <TouchableOpacity
                            style={styles.linkPlanButton}
                            onPress={() => handleLinkPlan(p.id)}
                          >
                            <Ionicons name="link-outline" size={14} color="#3B82F6" />
                            <Text style={styles.linkPlanText}>Link a practice plan</Text>
                          </TouchableOpacity>
                        );
                      })()}
                    </View>
                  ))
                )}
              </View>
            )}

            {/* Bottom actions */}
            <View style={styles.bottomActions}>
              <TouchableOpacity
                style={styles.newSeasonLink}
                onPress={() => setShowNewSeason(true)}
              >
                <Ionicons name="add-circle-outline" size={16} color="#1B4332" />
                <Text style={styles.newSeasonLinkText}>New Season</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </ScrollView>

      {/* New Season Modal */}
      <Modal visible={showNewSeason} transparent animationType="fade" onRequestClose={() => { setShowNewSeason(false); setNewName(''); }}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={styles.modalBackdrop}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>New Season</Text>
              <TextInput
                style={styles.modalInput}
                value={newName}
                onChangeText={setNewName}
                placeholder="e.g. Spring 2026"
                placeholderTextColor="#9CA3AF"
                autoFocus
              />
              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.modalCancel}
                  onPress={() => { setShowNewSeason(false); setNewName(''); }}
                >
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.modalSave} onPress={handleCreateSeason}>
                  <Text style={styles.modalSaveText}>Create</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Add Practice Modal */}
      <Modal visible={showAddPractice} transparent animationType="fade" onRequestClose={() => { setShowAddPractice(false); setPracticeNotes(''); }}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={styles.modalBackdrop}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Add Practice</Text>
              <Text style={styles.modalSubtitle}>
                {selectedDate ? formatDateReadable(selectedDate) : ''}
              </Text>
              <TextInput
                style={styles.modalInput}
                value={practiceTime}
                onChangeText={setPracticeTime}
                placeholder="Time (e.g. 5:30 PM)"
                placeholderTextColor="#9CA3AF"
              />
              <TextInput
                style={styles.modalInput}
                value={practiceLocation}
                onChangeText={setPracticeLocation}
                placeholder="Location (e.g. Diamond Field 3)"
                placeholderTextColor="#9CA3AF"
              />
              <TextInput
                style={[styles.modalInput, styles.modalInputMultiline]}
                value={practiceNotes}
                onChangeText={setPracticeNotes}
                placeholder="Notes (drills to focus on, equipment to bring...)"
                placeholderTextColor="#9CA3AF"
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />
              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.modalCancel}
                  onPress={() => { setShowAddPractice(false); setPracticeNotes(''); }}
                >
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.modalSave} onPress={handleAddPractice}>
                  <Text style={styles.modalSaveText}>Add</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Link Practice Plan Picker Modal */}
      <Modal visible={showLinkPicker} transparent animationType="fade" onRequestClose={() => { setShowLinkPicker(false); setLinkingPracticeId(null); }}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalContent, { maxHeight: '70%' }]}>
            <View style={styles.linkPickerHeader}>
              <Text style={styles.modalTitle}>Link a Practice Plan</Text>
              <TouchableOpacity
                onPress={() => { setShowLinkPicker(false); setLinkingPracticeId(null); }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close" size={22} color="#6B7280" />
              </TouchableOpacity>
            </View>
            <Text style={styles.linkPickerSubtitle}>
              Select a generated plan from your history
            </Text>

            {history.length === 0 ? (
              <View style={styles.linkPickerEmpty}>
                <Ionicons name="document-outline" size={28} color="#D1D5DB" />
                <Text style={styles.linkPickerEmptyText}>No practice plans yet</Text>
                <Text style={styles.linkPickerEmptyHint}>
                  Generate a practice plan first, then come back to link it here.
                </Text>
              </View>
            ) : (
              <FlatList
                data={history.filter(h => h.session?.request)}
                keyExtractor={(item) => String(item.savedAt)}
                style={styles.linkPickerList}
                renderItem={({ item }) => {
                  const s = item.session;
                  const drillCount = s.selectedDrills?.length ?? 0;
                  const mins = s.stationLayout?.totalWallClockMinutes ?? 0;
                  const ageLabel = s.request?.ageGroup ?? 'Practice';
                  const savedDate = new Date(item.savedAt);
                  const dateStr = savedDate.toLocaleDateString('en-US', {
                    month: 'short', day: 'numeric',
                  });
                  const source = s.source === 'ai' ? 'AI' : s.source === 'manual' ? 'Manual' : 'Engine';
                  return (
                    <TouchableOpacity
                      style={styles.linkPickerItem}
                      onPress={() => handleSelectPlan(item)}
                      activeOpacity={0.7}
                    >
                      <View style={styles.linkPickerItemIcon}>
                        <Ionicons
                          name={s.source === 'ai' ? 'sparkles' : 'clipboard-outline'}
                          size={18}
                          color="#1B4332"
                        />
                      </View>
                      <View style={styles.linkPickerItemInfo}>
                        <Text style={styles.linkPickerItemTitle} numberOfLines={1}>
                          {ageLabel} — {drillCount} drills
                        </Text>
                        <Text style={styles.linkPickerItemMeta}>
                          {source} · {mins} min · {dateStr}
                        </Text>
                      </View>
                      <Ionicons name="add-circle-outline" size={20} color="#1B4332" />
                    </TouchableOpacity>
                  );
                }}
                ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: '#F3F4F6' }} />}
              />
            )}
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: '#FAFBFC' },
  container: { padding: 20 },

  // Empty state / onboarding
  emptyState: { alignItems: 'center', paddingTop: 48 },
  emptyIconCircle: {
    width: 64, height: 64, borderRadius: 32, backgroundColor: '#ECFDF5',
    alignItems: 'center', justifyContent: 'center', marginBottom: 20,
  },
  emptyTitle: { fontSize: 22, fontWeight: '700', color: '#111827' },
  emptyBody: {
    fontSize: 14, color: '#6B7280', textAlign: 'center',
    marginTop: 8, lineHeight: 21, paddingHorizontal: 10,
  },
  emptySteps: { marginTop: 28, gap: 14, width: '100%', paddingHorizontal: 10 },
  emptyStep: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  emptyStepDot: {
    width: 24, height: 24, borderRadius: 12, backgroundColor: '#1B4332',
    alignItems: 'center', justifyContent: 'center',
  },
  emptyStepDotText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
  emptyStepText: { flex: 1, fontSize: 14, color: '#374151', lineHeight: 19 },
  createButton: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#1B4332', borderRadius: 14, paddingVertical: 14, paddingHorizontal: 28,
    marginTop: 28, shadowColor: '#1B4332', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3, shadowRadius: 4, elevation: 4,
  },
  createButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },

  // Season header + stats
  seasonHeader: { marginBottom: 12 },
  seasonName: { fontSize: 22, fontWeight: '700', color: '#1B4332' },
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  statCard: {
    flex: 1, backgroundColor: '#FFFFFF', borderRadius: 12, padding: 12,
    alignItems: 'center', borderWidth: 1, borderColor: '#F3F4F6',
  },
  statNumber: { fontSize: 22, fontWeight: '700', color: '#1B4332' },
  statLabel: { fontSize: 11, fontWeight: '600', color: '#9CA3AF', marginTop: 2, textTransform: 'uppercase', letterSpacing: 0.3 },

  // Calendar
  calNav: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 16,
  },
  calNavButton: { padding: 8 },
  calNavTitle: { fontSize: 18, fontWeight: '700', color: '#111827' },
  dayHeaders: { flexDirection: 'row', marginBottom: 8 },
  dayHeader: {
    flex: 1, textAlign: 'center', fontSize: 11, fontWeight: '600',
    color: '#9CA3AF', textTransform: 'uppercase',
  },
  calGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  calCell: {
    width: '14.285%', aspectRatio: 1, alignItems: 'center',
    justifyContent: 'center', position: 'relative',
  },
  calCellToday: { backgroundColor: '#ECFDF5', borderRadius: 20 },
  calCellSelected: { backgroundColor: '#1B4332', borderRadius: 20 },
  calCellText: { fontSize: 15, fontWeight: '500', color: '#374151' },
  calCellTextToday: { color: '#1B4332', fontWeight: '700' },
  calCellTextSelected: { color: '#FFFFFF', fontWeight: '700' },
  practiceDot: {
    position: 'absolute', bottom: 4, width: 6, height: 6,
    borderRadius: 3, backgroundColor: '#1B4332',
  },
  practiceDotSelected: { backgroundColor: '#D4AF37' },

  // Guide prompts
  guideCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    backgroundColor: '#FEF3C7', borderRadius: 12, paddingVertical: 12, paddingHorizontal: 16,
    marginTop: 20, borderWidth: 1, borderColor: '#FDE68A',
  },
  guideText: { fontSize: 14, fontWeight: '500', color: '#92400E' },

  // Selected date detail
  dateDetail: {
    marginTop: 20, backgroundColor: '#FFFFFF', borderRadius: 16,
    padding: 16, borderWidth: 1, borderColor: '#E5E7EB',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04, shadowRadius: 3, elevation: 1,
  },
  dateDetailHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 12,
  },
  dateDetailTitle: { fontSize: 16, fontWeight: '700', color: '#111827', flex: 1 },
  addPracticeButton: {
    width: 30, height: 30, borderRadius: 15, backgroundColor: '#1B4332',
    alignItems: 'center', justifyContent: 'center',
  },

  // Empty date prompt
  emptyDatePrompt: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 16, borderWidth: 1.5, borderColor: '#BBF7D0',
    borderRadius: 12, borderStyle: 'dashed',
  },
  emptyDatePromptText: { fontSize: 14, fontWeight: '500', color: '#1B4332' },

  // Practice slot
  practiceSlot: {
    paddingVertical: 12, borderTopWidth: 1, borderTopColor: '#F3F4F6',
  },
  practiceTopRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
  },
  checkBox: {
    width: 24, height: 24, borderRadius: 12, borderWidth: 2,
    borderColor: '#D1D5DB', alignItems: 'center', justifyContent: 'center',
  },
  checkBoxDone: { backgroundColor: '#1B4332', borderColor: '#1B4332' },
  practiceMainInfo: { flex: 1 },
  practiceTime: { fontSize: 15, fontWeight: '600', color: '#111827' },
  practiceCompleted: { textDecorationLine: 'line-through', color: '#9CA3AF' },
  practiceLocationRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  practiceLocation: { fontSize: 13, color: '#6B7280' },
  practiceActions: { flexDirection: 'row', gap: 14 },

  // Notes
  noteDisplay: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 6,
    marginTop: 8, marginLeft: 36, backgroundColor: '#F9FAFB',
    borderRadius: 10, padding: 10,
  },
  noteText: { flex: 1, fontSize: 13, color: '#374151', lineHeight: 18 },
  addNoteButton: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginTop: 8, marginLeft: 36,
  },
  addNoteText: { fontSize: 13, fontWeight: '500', color: '#1B4332' },
  noteEditArea: {
    marginTop: 8, marginLeft: 36,
  },
  noteInput: {
    backgroundColor: '#F9FAFB', borderRadius: 10, borderWidth: 1, borderColor: '#E5E7EB',
    padding: 10, fontSize: 13, color: '#111827', minHeight: 60, textAlignVertical: 'top',
  },
  noteEditActions: {
    flexDirection: 'row', justifyContent: 'flex-end', gap: 16, marginTop: 8,
  },
  noteCancel: { fontSize: 13, fontWeight: '500', color: '#6B7280' },
  noteSave: { fontSize: 13, fontWeight: '600', color: '#1B4332' },

  // Bottom actions
  bottomActions: { marginTop: 24, alignItems: 'center' },
  newSeasonLink: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
  },
  newSeasonLinkText: { fontSize: 14, fontWeight: '600', color: '#1B4332' },

  // Modals
  modalBackdrop: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center', alignItems: 'center', padding: 20,
  },
  modalContent: {
    backgroundColor: '#FFF', borderRadius: 20, padding: 24, width: '100%', maxWidth: 340,
  },
  modalTitle: { fontSize: 20, fontWeight: '700', color: '#111827', marginBottom: 8 },
  modalSubtitle: { fontSize: 14, color: '#6B7280', marginBottom: 16 },
  modalInput: {
    borderWidth: 1.5, borderColor: '#E5E7EB', borderRadius: 12,
    padding: 14, fontSize: 16, color: '#111827', marginBottom: 12,
  },
  modalInputMultiline: { minHeight: 70, textAlignVertical: 'top' },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 8 },
  modalCancel: {
    flex: 1, backgroundColor: '#F3F4F6', paddingVertical: 14,
    borderRadius: 12, alignItems: 'center',
  },
  modalCancelText: { fontSize: 15, fontWeight: '600', color: '#6B7280' },
  modalSave: {
    flex: 1, backgroundColor: '#1B4332', paddingVertical: 14,
    borderRadius: 12, alignItems: 'center',
  },
  modalSaveText: { fontSize: 15, fontWeight: '600', color: '#FFFFFF' },

  // Linked plan card
  linkedPlanCard: {
    flexDirection: 'row', alignItems: 'center',
    marginTop: 8, marginLeft: 36,
    backgroundColor: '#ECFDF5', borderRadius: 10, padding: 10,
    borderWidth: 1, borderColor: '#BBF7D0',
  },
  linkedPlanMain: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8,
  },
  linkedPlanInfo: { flex: 1 },
  linkedPlanTitle: { fontSize: 13, fontWeight: '600', color: '#1B4332' },
  linkedPlanMeta: { fontSize: 11, color: '#6B7280', marginTop: 1 },
  unlinkButton: { marginLeft: 8, padding: 2 },

  // Link plan button
  linkPlanButton: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginTop: 8, marginLeft: 36,
  },
  linkPlanText: { fontSize: 13, fontWeight: '500', color: '#3B82F6' },

  // Link picker modal
  linkPickerHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 4,
  },
  linkPickerSubtitle: { fontSize: 13, color: '#6B7280', marginBottom: 16 },
  linkPickerEmpty: {
    alignItems: 'center', paddingVertical: 28, gap: 8,
  },
  linkPickerEmptyText: { fontSize: 15, fontWeight: '600', color: '#9CA3AF' },
  linkPickerEmptyHint: { fontSize: 13, color: '#9CA3AF', textAlign: 'center', paddingHorizontal: 10 },
  linkPickerList: { maxHeight: 300 },
  linkPickerItem: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 12, paddingHorizontal: 4,
  },
  linkPickerItemIcon: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: '#ECFDF5',
    alignItems: 'center', justifyContent: 'center',
  },
  linkPickerItemInfo: { flex: 1 },
  linkPickerItemTitle: { fontSize: 14, fontWeight: '600', color: '#111827' },
  linkPickerItemMeta: { fontSize: 12, color: '#6B7280', marginTop: 1 },
});
