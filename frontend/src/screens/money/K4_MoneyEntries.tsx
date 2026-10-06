/**
 * k4: Money - Entries. Search bar, source filter chips, day groups with totals, rows tagged
 * MATCHED / RESOLVED / TO REVIEW, and docked add actions. Route params: filter
 * ('review' | 'sms' | 'mail' | 'shot') opens pre-filtered, category (id or name) narrows to one category.
 * Entries come from the local database. To review rows confirm by tap or by swiping right.
 */
import React, { useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { ScreenScaffold } from '../../components/ScreenScaffold';
import { SkeletonRows } from '../../components/SkeletonLoader';
import { useTabScrollToTop } from '../../components/useTabScrollToTop';
import { formatRupees } from '../../lib/format';
import { MoneySegmentedControl } from '../../navigation/MoneySegmentedControl';
import { useEntries, useNow, useToReviewEntries, useWriters, type EntryFilter as DbFilter } from '../../services';
import { useTheme } from '../../theme';
import { EntryRow } from './parts/EntryRow';
import { MoneyHeader } from './parts/MoneyHeader';
import { PendingRow } from './parts/PendingRow';
import { Snackbar } from './parts/Snackbar';
import { EMPTY_LOOKUPS, dayHeading, groupByDay, monthWindow, monthsBack, rowFor, useEarliestEntry, useLookups } from './parts/live';
import { parseFilter, type EntryFilter } from './parts/entries';
import { useMoneyNav } from './parts/nav';
import { S, fmt } from './parts/strings';
import { useUndo } from './parts/undoStore';
import { FilterChip, Icon, PillButton } from './parts/ui';
import { t } from '../../lib/i18n';

function dbFilter(f: EntryFilter, categoryId: string | undefined): DbFilter {
  const out: DbFilter = {};
  if (f === 'review') out.status = 'toReview';
  else if (f !== 'all') out.source = f;
  if (categoryId) out.categoryId = categoryId;
  return out;
}

export default function K4_MoneyEntries(): React.JSX.Element {
  const { colors, typography, spacing } = useTheme();
  const nav = useMoneyNav();
  const db = useWriters();
  const now = useNow();
  const scrollRef = useRef<ScrollView>(null);
  useTabScrollToTop(scrollRef);
  const [filter, setFilter] = useState<EntryFilter>(parseFilter(nav.params.filter));
  // Follow the route param when it changes (a notification opening this tab while mounted).
  const incoming = nav.params.filter;
  const [seen, setSeen] = useState(incoming);
  if (seen !== incoming) {
    setSeen(incoming);
    setFilter(parseFilter(incoming));
  }
  const categoryParam = typeof nav.params.category === 'string' ? nav.params.category : undefined;
  const [back, setBack] = useState(0);
  const win = monthWindow(now, back);
  const lookups = useLookups();
  const lk = lookups.data ?? EMPTY_LOOKUPS;
  const earliest = useEarliestEntry().data;
  const canPrev = earliest != null && monthsBack(now, earliest) > back;

  const categoryId = useMemo(() => {
    if (!categoryParam) return undefined;
    if (lk.cats.has(categoryParam)) return categoryParam;
    const wanted = categoryParam.toLowerCase();
    for (const c of lk.cats.values()) if (c.name.toLowerCase() === wanted) return c.id;
    // Not found, or lookups still loading: match nothing so no unfiltered rows flash by.
    return '\u0000none';
  }, [categoryParam, lk]);

  const entries = useEntries({ range: { fromMs: win.fromMs, toMs: win.toMs }, filter: dbFilter(filter, categoryId) });
  const review = useToReviewEntries();
  const undo = useUndo();
  const loading = entries.data === undefined || lookups.data === undefined;
  const groups = useMemo(() => (loading ? [] : groupByDay(entries.data ?? [], now)), [loading, entries.data, now]);
  const chips: { id: EntryFilter; label: string; icon?: string }[] = [
    { id: 'all', label: S.all },
    { id: 'review', label: `${S.toReview} \u00B7 ${review.data?.length ?? 0}`, icon: 'auto_awesome' },
    { id: 'sms', label: S.sms, icon: 'sms' },
    { id: 'mail', label: S.email, icon: 'mail' },
    { id: 'shot', label: S.screenshot, icon: 'screenshot_region' },
  ];

  const restore = (): void => {
    const item = useUndo.getState().item;
    if (!item) return;
    useUndo.getState().set(null);
    void Promise.all(item.entries.map((e) => db.entries.put(e)));
  };

  return (
    <ScreenScaffold testID="screen-k4" scroll={false} contentStyle={{ paddingHorizontal: 0 }}>
      <ScrollView ref={scrollRef} contentContainerStyle={{ paddingHorizontal: spacing.screenMargin, paddingBottom: spacing.lg }} keyboardShouldPersistTaps="handled">
        <MoneyHeader
          month={win.name}
          onPrev={() => setBack((b) => b + 1)}
          onNext={() => setBack((b) => Math.max(0, b - 1))}
          canPrev={canPrev}
          canNext={back > 0}
        />
        {nav.navigation ? <MoneySegmentedControl current="entries" /> : null}
        <Pressable
          testID="search-bar"
          accessibilityRole="search"
          accessibilityLabel={S.searchEntries}
          onPress={() => nav.go('k19')}
          style={{ marginTop: spacing.md, height: 48, borderRadius: 24, backgroundColor: colors.surfaceContainer, flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingLeft: spacing.lg, paddingRight: spacing.sm }}
        >
          <Icon name="search" size={22} color={colors.onSurfaceVariant} />
          <Text style={[typography.bodyLarge, { flex: 1, color: colors.onSurfaceVariant }]}>{S.searchEntries}</Text>
          <View accessibilityLabel={S.filter} style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="tune" size={22} color={colors.onSurfaceVariant} />
          </View>
        </Pressable>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm, paddingVertical: 10 }}>
          {chips.map((c) => (
            <FilterChip key={c.id} testID={`chip-${c.id}`} label={c.label} icon={c.icon} selected={filter === c.id} onPress={() => setFilter(c.id)} />
          ))}
        </ScrollView>
        {loading ? <SkeletonRows count={5} /> : null}
        {!loading && groups.length === 0 ? (
          <Text testID="entries-empty" style={[typography.bodyMedium, { color: colors.onSurfaceVariant, marginTop: spacing.xxl }]}>
            {S.noEntries}
          </Text>
        ) : null}
        {groups.map((g) => {
          const shots = g.entries.filter((e) => e.sources[0]?.kind === 'shot').length;
          const note =
            g.word === t('moneyUi.today') && filter === 'all' && !categoryId && shots > 0
              ? fmt(t('moneyLive.dayNote'), { n: g.entries.length, a: g.entries.length - shots, b: shots })
              : null;
          return (
            <View key={g.key} testID={`day-${g.word || g.key}`}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 14 }}>
                <Text style={[typography.labelMedium, { color: colors.onSurfaceVariant }]}>{dayHeading(g)}</Text>
                <Text style={[typography.labelMedium, { color: colors.onSurfaceVariant }]}>{formatRupees(g.totalPaise)}</Text>
              </View>
              {note ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                  <Icon name="fact_check" size={14} color={colors.onSurfaceVariant} />
                  <Text style={[typography.labelSmall, { color: colors.onSurfaceVariant, flexShrink: 1 }]}>{note}</Text>
                </View>
              ) : null}
              {g.entries.map((e) => {
                const row = rowFor(e, lk);
                const open = (): void => nav.open('k27', { id: e.id, name: e.merchant });
                if (row.pending) {
                  return <PendingRow key={e.id} testID={`entry-${e.merchant}`} row={row} onConfirm={() => void db.entries.confirm(e.id)} onLongPress={open} />;
                }
                return <EntryRow key={e.id} testID={`entry-${e.merchant}`} {...row} onLongPress={open} />;
              })}
            </View>
          );
        })}
      </ScrollView>
      {undo.item ? <Snackbar label={undo.item.label} onUndo={restore} /> : null}
      <View style={{ flexDirection: 'row', gap: 10, paddingHorizontal: spacing.lg, paddingVertical: 10, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.outlineVariant }}>
        <PillButton testID="action-hand" label={S.byHand} icon="edit" kind="tonal" onPress={() => nav.go('k5')} style={{ flex: 1, paddingHorizontal: spacing.xl }} />
        <PillButton testID="action-shot" label={S.fromScreenshot} icon="add_photo_alternate" onPress={() => nav.go('k7')} style={{ flex: 1.3, paddingHorizontal: spacing.xl }} />
      </View>
    </ScreenScaffold>
  );
}
