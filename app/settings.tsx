/**
 * BUILD 105: Settings Screen
 *
 * App settings with:
 * - Backup & Restore (export/import all data as JSON via Share sheet)
 * - Data summary (practices, seasons, teams, custom drills)
 * - App version info
 */

import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Alert, Share, Platform, ActivityIndicator,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import {
  exportBackup, backupToString, parseBackup, importBackup,
  estimateBackupSize, formatBytes, BackupData,
} from '../src/data/storage/backupService';
import { usePractice } from '../context/PracticeContext';

export default function SettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { tier, openPaywall, showPaywall, paywallTrigger, closePaywall } = usePractice();

  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [lastBackup, setLastBackup] = useState<BackupData | null>(null);
  const [dataSummary, setDataSummary] = useState<BackupData['summary'] | null>(null);

  // Load data summary on mount
  useEffect(() => {
    exportBackup().then(backup => {
      setDataSummary(backup.summary);
    });
  }, []);

  // ── Export Backup ──

  const handleExportBackup = async () => {
    setIsExporting(true);
    try {
      const backup = await exportBackup();
      const json = backupToString(backup);
      const size = formatBytes(estimateBackupSize(backup));
      const dateStr = new Date().toLocaleDateString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric',
      });

      await Share.share({
        message: json,
        title: `DiamondScript Backup — ${dateStr}`,
      });

      setLastBackup(backup);
      Alert.alert(
        'Backup Created',
        `Your backup (${size}) includes ${backup.summary.practiceCount} practices, ${backup.summary.seasonCount} seasons, and ${backup.summary.teamCount} teams.\n\nSave the shared text somewhere safe — you can paste it back to restore your data later.`
      );
    } catch (error: any) {
      if (error?.message !== 'User did not share') {
        Alert.alert('Export Failed', 'Something went wrong while creating your backup. Please try again.');
      }
    } finally {
      setIsExporting(false);
    }
  };

  // ── Import Backup ──

  const handleImportBackup = async () => {
    Alert.alert(
      'Restore from Backup',
      'To restore your data, copy your backup text to the clipboard first, then tap "Restore from Clipboard".\n\nThis will replace all current data.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Restore from Clipboard',
          onPress: handleRestoreFromClipboard,
        },
      ]
    );
  };

  const handleRestoreFromClipboard = async () => {
    setIsImporting(true);
    try {
      const clipboardContent = await Clipboard.getStringAsync();

      if (!clipboardContent || clipboardContent.trim().length === 0) {
        Alert.alert('No Data Found', 'Your clipboard is empty. Copy your backup text first, then try again.');
        return;
      }

      const backup = parseBackup(clipboardContent);
      if (!backup) {
        Alert.alert(
          'Invalid Backup',
          'The clipboard content is not a valid DiamondScript backup. Make sure you copied the entire backup text.'
        );
        return;
      }

      // Confirm before overwriting
      const backupDate = new Date(backup.createdAt).toLocaleDateString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
      });

      Alert.alert(
        'Confirm Restore',
        `This backup was created on ${backupDate} and contains:\n\n` +
        `• ${backup.summary.practiceCount} practices\n` +
        `• ${backup.summary.seasonCount} seasons\n` +
        `• ${backup.summary.teamCount} teams\n` +
        `• ${backup.summary.customDrillCount} custom drills\n\n` +
        `This will replace ALL your current data. This cannot be undone.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Restore',
            style: 'destructive',
            onPress: async () => {
              try {
                const result = await importBackup(backup);
                const msg = result.failedKeys.length > 0
                  ? `Restored with ${result.failedKeys.length} partial failures. Most data was recovered.`
                  : `Successfully restored ${result.summary.practiceCount} practices, ${result.summary.seasonCount} seasons, and ${result.summary.teamCount} teams.`;
                Alert.alert(
                  'Restore Complete',
                  `${msg}\n\nPlease restart the app to see all restored data.`
                );
              } catch {
                Alert.alert('Restore Failed', 'Something went wrong during the restore. Your previous data may be partially overwritten.');
              }
            },
          },
        ]
      );
    } catch {
      Alert.alert('Error', 'Could not read from clipboard. Please try again.');
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: 'Settings' }} />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.container, { paddingBottom: insets.bottom + 32 }]}
      >
        {/* Data Summary */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Your Data</Text>
          <View style={styles.summaryCard}>
            <View style={styles.summaryRow}>
              <View style={styles.summaryItem}>
                <Ionicons name="journal-outline" size={20} color="#1B4332" />
                <Text style={styles.summaryNumber}>{dataSummary?.practiceCount ?? '—'}</Text>
                <Text style={styles.summaryLabel}>Practices</Text>
              </View>
              <View style={styles.summaryDivider} />
              <View style={styles.summaryItem}>
                <Ionicons name="calendar-outline" size={20} color="#1B4332" />
                <Text style={styles.summaryNumber}>{dataSummary?.seasonCount ?? '—'}</Text>
                <Text style={styles.summaryLabel}>Seasons</Text>
              </View>
              <View style={styles.summaryDivider} />
              <View style={styles.summaryItem}>
                <Ionicons name="people-outline" size={20} color="#1B4332" />
                <Text style={styles.summaryNumber}>{dataSummary?.teamCount ?? '—'}</Text>
                <Text style={styles.summaryLabel}>Teams</Text>
              </View>
              <View style={styles.summaryDivider} />
              <View style={styles.summaryItem}>
                <Ionicons name="construct-outline" size={20} color="#1B4332" />
                <Text style={styles.summaryNumber}>{dataSummary?.customDrillCount ?? '—'}</Text>
                <Text style={styles.summaryLabel}>Custom Drills</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Backup & Restore */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Backup & Restore</Text>
          <Text style={styles.sectionDescription}>
            Your data is stored on this device only. Export a backup to keep your practices, seasons, and teams safe. Restore from a backup if you switch phones or reinstall.
          </Text>

          {/* Export */}
          <TouchableOpacity
            style={styles.actionCard}
            onPress={handleExportBackup}
            disabled={isExporting}
            activeOpacity={0.7}
          >
            <View style={[styles.actionIconCircle, { backgroundColor: '#ECFDF5' }]}>
              {isExporting ? (
                <ActivityIndicator size="small" color="#1B4332" />
              ) : (
                <Ionicons name="cloud-upload-outline" size={22} color="#1B4332" />
              )}
            </View>
            <View style={styles.actionInfo}>
              <Text style={styles.actionTitle}>Export Backup</Text>
              <Text style={styles.actionDescription}>
                Share your data as a text file you can save anywhere
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#D1D5DB" />
          </TouchableOpacity>

          {/* Import */}
          <TouchableOpacity
            style={styles.actionCard}
            onPress={handleImportBackup}
            disabled={isImporting}
            activeOpacity={0.7}
          >
            <View style={[styles.actionIconCircle, { backgroundColor: '#DBEAFE' }]}>
              {isImporting ? (
                <ActivityIndicator size="small" color="#2563EB" />
              ) : (
                <Ionicons name="cloud-download-outline" size={22} color="#2563EB" />
              )}
            </View>
            <View style={styles.actionInfo}>
              <Text style={styles.actionTitle}>Restore from Backup</Text>
              <Text style={styles.actionDescription}>
                Paste a backup from your clipboard to restore your data
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#D1D5DB" />
          </TouchableOpacity>
        </View>

        {/* Subscription */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Subscription</Text>
          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => openPaywall('feature')}
            activeOpacity={0.7}
          >
            <View style={[styles.actionIconCircle, {
              backgroundColor: tier === 'pro' ? '#FEF3C7' : '#F3F4F6',
            }]}>
              <Ionicons
                name={tier === 'pro' ? 'diamond' : 'diamond-outline'}
                size={22}
                color={tier === 'pro' ? '#D4AF37' : '#6B7280'}
              />
            </View>
            <View style={styles.actionInfo}>
              <Text style={styles.actionTitle}>
                {tier === 'pro' ? 'DiamondScript Pro' : 'Free Plan'}
              </Text>
              <Text style={styles.actionDescription}>
                {tier === 'pro'
                  ? 'Full catalog, unlimited history, AI generation'
                  : 'Upgrade for full drill catalog and unlimited features'}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#D1D5DB" />
          </TouchableOpacity>
        </View>

        {/* App Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>About</Text>
          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Version</Text>
              <Text style={styles.infoValue}>1.0.0 (Build 105)</Text>
            </View>
            <View style={styles.infoDivider} />
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Data Storage</Text>
              <Text style={styles.infoValue}>On-Device Only</Text>
            </View>
          </View>
          <Text style={styles.disclaimer}>
            DiamondScript stores all data locally on your device. Export a backup regularly to protect against data loss.
          </Text>
        </View>
      </ScrollView>

    </>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: '#FAFBFC' },
  container: { padding: 20 },

  // Sections
  section: { marginBottom: 28 },
  sectionTitle: {
    fontSize: 18, fontWeight: '700', color: '#1B4332', marginBottom: 8,
  },
  sectionDescription: {
    fontSize: 13, color: '#6B7280', lineHeight: 19, marginBottom: 14,
  },

  // Data Summary
  summaryCard: {
    backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: '#E5E7EB',
  },
  summaryRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around',
  },
  summaryItem: { alignItems: 'center', gap: 4, flex: 1 },
  summaryNumber: { fontSize: 20, fontWeight: '700', color: '#111827' },
  summaryLabel: { fontSize: 10, fontWeight: '600', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 0.3 },
  summaryDivider: { width: 1, height: 40, backgroundColor: '#F3F4F6' },

  // Action cards
  actionCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: '#FFFFFF', borderRadius: 14, padding: 16,
    marginBottom: 10, borderWidth: 1, borderColor: '#E5E7EB',
  },
  actionIconCircle: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
  },
  actionInfo: { flex: 1 },
  actionTitle: { fontSize: 15, fontWeight: '600', color: '#111827' },
  actionDescription: { fontSize: 12, color: '#6B7280', marginTop: 2, lineHeight: 17 },

  // Info card
  infoCard: {
    backgroundColor: '#FFFFFF', borderRadius: 14, padding: 16,
    borderWidth: 1, borderColor: '#E5E7EB',
  },
  infoRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 6,
  },
  infoLabel: { fontSize: 14, color: '#6B7280' },
  infoValue: { fontSize: 14, fontWeight: '600', color: '#111827' },
  infoDivider: { height: 1, backgroundColor: '#F3F4F6', marginVertical: 4 },
  disclaimer: {
    fontSize: 12, color: '#9CA3AF', marginTop: 10, lineHeight: 17,
    textAlign: 'center', fontStyle: 'italic',
  },
});
