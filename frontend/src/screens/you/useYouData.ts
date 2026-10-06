import { useEffect, useMemo, useState } from 'react';

import { groupIndian } from '../../lib/format';
import { t } from '../../lib/i18n';
import { usePreferences } from '../../lib/preferences';
import { useSyncStatus } from '../../lib/sync/useSyncStatus';
import { useDbQuery } from '../../services';
import { monthName } from './parts/monthName';

export type YouCounts = {
  entries: number;
  goalsReached: number;
  accounts: number;
  cards: number;
  upiIds: number;
  recurring: number;
  /** Time of the first entry, or null for a fresh notebook. */
  firstAt: number | null;
};

/** Counts for the profile header and row subtitles. */
export function useYouCounts(): YouCounts | undefined {
  return useDbQuery(async (db): Promise<YouCounts> => {
    const [entries, goals, allocs, accounts, upi, recurring] = await Promise.all([
      db.entries.list(),
      db.goals.list(),
      db.allocations.list(),
      db.accounts.list(),
      db.upiIds.list(),
      db.recurring.list(),
    ]);
    const saved = new Map<string, number>();
    for (const a of allocs) saved.set(a.goalId, (saved.get(a.goalId) ?? 0) + a.amountPaise);
    return {
      entries: entries.length,
      goalsReached: goals.filter((g) => g.targetPaise > 0 && (saved.get(g.id) ?? 0) >= g.targetPaise).length,
      accounts: accounts.filter((a) => a.kind === 'bank' || a.kind === 'cash' || a.kind === 'mf' || a.kind === 'nps').length,
      cards: accounts.filter((a) => a.kind === 'card').length,
      upiIds: upi.length,
      recurring: recurring.length,
      firstAt: entries.length ? Math.min(...entries.map((e) => e.at)) : null,
    };
  }).data;
}

/** Whole months from the first entry to now, counting the first month: March to October is 8. */
export function monthsSince(firstAt: number | null, now: number): number {
  if (firstAt === null) return 0;
  const a = new Date(firstAt);
  const b = new Date(now);
  return Math.max(1, (b.getFullYear() - a.getFullYear()) * 12 + b.getMonth() - a.getMonth() + 1);
}

export function profileLine(counts: YouCounts | undefined): string {
  return counts && counts.firstAt !== null ? t('youUi.since', { month: monthName(counts.firstAt) }) : t('youUi.sinceFresh');
}

export const grouped = (n: number): string => groupIndian(String(n));

/** "2 min ago", from a real clock reading. */
export function ago(iso: string, nowMs: number): string {
  const mins = Math.max(0, Math.round((nowMs - new Date(iso).getTime()) / 60000));
  if (mins < 1) return t('youUi.justNow');
  if (mins < 60) return t('youUi.minAgo', { n: mins });
  if (mins < 60 * 24) return t('youUi.hourAgo', { n: Math.floor(mins / 60) });
  return t('youUi.dayAgo', { n: Math.floor(mins / (60 * 24)) });
}

export type BackupCard = { title: string; subtitle: string; icon: string };

/** The "Backed up" card: off, syncing, paused, or the last good backup. */
export function useBackupCard(): BackupCard {
  const enabled = usePreferences((s) => s.syncEnabled);
  const state = useSyncStatus((s) => s.state);
  const lastSyncAt = useSyncStatus((s) => s.lastSyncAt);
  const error = useSyncStatus((s) => s.errorMessage);
  // Real clock for "2 min ago"; the services clock can be pinned to the sample day.
  const [clock, setClock] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setClock(Date.now()), 60000);
    return () => clearInterval(id);
  }, []);
  return useMemo(() => {
    if (!enabled || state === 'off') return { title: t('youUi.backupOff'), subtitle: t('youUi.backupOffSub'), icon: 'cloud_off' };
    if (state === 'syncing') return { title: t('youUi.backingUp'), subtitle: t('youUi.encryptedFirst'), icon: 'cloud_sync' };
    if (state === 'error') return { title: t('youUi.backupPaused'), subtitle: error ?? t('youUi.backupOffSub'), icon: 'cloud_off' };
    if (lastSyncAt) return { title: t('youUi.backedUp', { when: ago(lastSyncAt, clock) }), subtitle: t('youUi.encryptedFirst'), icon: 'cloud_done' };
    return { title: t('youUi.backingUp'), subtitle: t('youUi.encryptedFirst'), icon: 'cloud_sync' };
  }, [enabled, state, lastSyncAt, error, clock]);
}
