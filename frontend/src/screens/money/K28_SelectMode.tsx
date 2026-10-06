/**
 * k28: Select mode. Contextual app bar with the count and a running total, bulk actions (change
 * category, delete with undo), and swipe actions (swipe right to confirm an AI entry, left to
 * delete with an undo snackbar). Route params: ids (entry ids to start selected) or name.
 * Works on the entries of one day, newest day by default.
 */
import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { Amount } from '../../components/Amount';
import { CategoryIcon } from '../../components/CategoryIcon';
import { SwipeRow } from '../../components/SwipeRow';
import type { Entry } from '../../data/db';
import { dateKey } from '../../data/db/dates';
import { formatRupees } from '../../lib/format';
import { useDbQuery, useWriters } from '../../services';
import { useTheme } from '../../theme';
import { CategoryChoices } from './parts/CategoryChoices';
import { EntryRow } from './parts/EntryRow';
import { Snackbar } from './parts/Snackbar';
import { EMPTY_LOOKUPS, categoryName, dayHeading, groupByDay, rowFor, useLookups } from './parts/live';
import { useMoneyNav } from './parts/nav';
import { S, fmt } from './parts/strings';
import { Icon, ScreenFrame } from './parts/ui';

type Removed = { entries: Entry[]; label: string };

/** Entries sharing merchant, amount and day with an earlier one: likely the same payment twice. */
export function isLikelyDuplicate(e: Entry, others: readonly Entry[]): boolean {
  return others.some((o) => o.id !== e.id && o.merchant === e.merchant && o.amountPaise === e.amountPaise && dateKey(o.at) === dateKey(e.at) && o.at <= e.at);
}

export default function K28_SelectMode(): React.JSX.Element {
  const { colors, typography, spacing } = useTheme();
  const nav = useMoneyNav();
  const db = useWriters();
  const lookups = useLookups();
  const lk = lookups.data ?? EMPTY_LOOKUPS;
  const startIds = Array.isArray(nav.params.ids) ? (nav.params.ids as unknown[]).filter((x): x is string => typeof x === 'string') : [];
  const startName = typeof nav.params.name === 'string' ? nav.params.name : null;
  const day = useDbQuery(
    async (d, now) => {
      const all = await d.entries.between(0, Number.MAX_SAFE_INTEGER);
      const first = startIds.length ? all.find((e) => e.id === startIds[0]) : startName ? all.find((e) => e.merchant === startName) : undefined;
      const key = dateKey((first ?? all[0])?.at ?? now);
      const entries = all.filter((e) => dateKey(e.at) === key);
      return { entries, now };
    },
    [startIds.join(','), startName],
  );
  const [selected, setSelected] = useState<Set<string>>(() => new Set(startIds));
  const [named, setNamed] = useState(false);
  // A name param selects the newest entry with that merchant once the day has loaded.
  if (!named && day.data) {
    setNamed(true);
    if (startIds.length === 0 && startName) {
      const hit = day.data.entries.find((e) => e.merchant === startName);
      if (hit) setSelected(new Set([hit.id]));
    }
  }
  const [picking, setPicking] = useState(false);
  const [snack, setSnack] = useState<Removed | null>(null);
  const list = day.data?.entries ?? [];
  const group = useMemo(() => (day.data ? groupByDay(day.data.entries, day.data.now)[0] : null), [day.data]);
  const chosen = list.filter((e) => selected.has(e.id));
  const total = chosen.reduce((s, e) => s + (e.direction === 'out' ? e.amountPaise : 0), 0);
  const cats = useMemo(() => [...lk.cats.values()].sort((a, b) => a.name.localeCompare(b.name)), [lk]);
  const toggle = (id: string): void =>
    setSelected((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const remove = (entries: Entry[], label: string): void => {
    void Promise.all(entries.map((e) => db.entries.remove(e.id)));
    setSelected((cur) => new Set([...cur].filter((id) => !entries.some((e) => e.id === id))));
    setSnack({ entries, label });
  };
  const undo = (): void => {
    if (!snack) return;
    void Promise.all(snack.entries.map((e) => db.entries.put(e)));
    setSnack(null);
  };
  const recategorise = (categoryId: string): void => {
    void Promise.all(chosen.map((e) => db.entries.put({ ...e, categoryId }).then(() => db.merchants.record(e.merchant, categoryId, e.amountPaise, e.at))));
    setPicking(false);
  };
  const bulk = (icon: string, label: string, onPress: () => void): React.JSX.Element => (
    <Pressable key={icon} testID={`bulk-${icon}`} accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={{ width: 48, height: 48, alignItems: 'center', justifyContent: 'center' }}>
      <Icon name={icon} size={22} color={colors.onSecondaryContainer} />
    </Pressable>
  );
  const reviewEntry = list.find((e) => e.status === 'toReview');
  const swipeDelete = list.find((e) => e.id !== reviewEntry?.id);
  return (
    <ScreenFrame testID="screen-k28">
      <View style={{ height: 64, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingLeft: 4, paddingRight: spacing.sm, backgroundColor: colors.secondaryContainer }}>
        <Pressable testID="select-close" accessibilityRole="button" accessibilityLabel={S.close} onPress={() => nav.back('k4')} style={{ width: 48, height: 48, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="close" size={24} color={colors.onSecondaryContainer} />
        </Pressable>
        <View style={{ flex: 1 }} accessibilityLiveRegion="polite">
          <Text testID="selected-count" accessibilityRole="header" style={[typography.labelLarge, { fontSize: 18, lineHeight: 24, color: colors.onSecondaryContainer }]}>
            {fmt(S.selected, { n: chosen.length })}
          </Text>
          <Text testID="selected-total" style={[typography.bodySmall, { color: colors.onSecondaryContainer }]}>{fmt(S.total, { amount: formatRupees(total) })}</Text>
        </View>
        {bulk('category', S.changeCategory, () => chosen.length > 0 && setPicking((p) => !p))}
        {bulk('call_split', S.splitWithFriends, () => undefined)}
        {bulk('delete', S.delete, () => chosen.length > 0 && remove(chosen, fmt(S.deletedMany, { n: chosen.length })))}
      </View>
      <ScrollView contentContainerStyle={{ paddingHorizontal: spacing.screenMargin, paddingBottom: spacing.xxl }}>
        {group ? <Text style={[typography.labelMedium, { color: colors.onSurfaceVariant, marginTop: spacing.md, marginBottom: 2 }]}>{dayHeading(group)}</Text> : null}
        {picking ? (
          <View style={{ marginTop: spacing.sm }}>
            <CategoryChoices categories={cats} onPick={(c) => recategorise(c.id)} />
          </View>
        ) : null}
        {list.map((e) => (
          <EntryRow
            key={e.id}
            testID={`row-${e.merchant}`}
            name={e.merchant}
            icon={rowFor(e, lk).icon}
            sub={categoryName(e, lk)}
            amountPaise={e.amountPaise}
            income={e.direction === 'in'}
            selected={selected.has(e.id)}
            onPress={() => toggle(e.id)}
          />
        ))}
        {reviewEntry || swipeDelete ? (
          <Text style={[typography.labelMedium, { color: colors.onSurfaceVariant, marginTop: 22, marginBottom: spacing.sm }]}>{S.swipeActions}</Text>
        ) : null}
        {reviewEntry ? (
          <SwipeRow
            testID="swipe-confirm"
            accessibilityLabel={`${reviewEntry.merchant}, ${S.fromSms}`}
            peek={132}
            rightSwipe={{ label: S.looksRight, icon: 'check_circle', onTrigger: () => void db.entries.confirm(reviewEntry.id) }}
          >
            <CategoryIcon name={rowFor(reviewEntry, lk).icon} />
            <View style={{ flex: 1 }}>
              <Text style={[typography.bodyLarge, { color: colors.onSurface }]}>{reviewEntry.merchant}</Text>
              <Text style={[typography.bodySmall, { color: colors.onSurfaceVariant }]}>{S.fromSms}</Text>
            </View>
          </SwipeRow>
        ) : null}
        {swipeDelete ? (
          <View style={{ marginTop: 10 }}>
            <SwipeRow
              testID="swipe-delete"
              accessibilityLabel={`${swipeDelete.merchant}, ${isLikelyDuplicate(swipeDelete, list) ? S.duplicate : categoryName(swipeDelete, lk)}`}
              peek={-110}
              leftSwipe={{ label: S.delete, icon: 'delete', destructive: true, onTrigger: () => remove([swipeDelete], fmt(S.deleted, { name: swipeDelete.merchant })) }}
            >
              <CategoryIcon name={rowFor(swipeDelete, lk).icon} />
              <View style={{ flex: 1 }}>
                <Text style={[typography.bodyLarge, { color: colors.onSurface }]}>{swipeDelete.merchant}</Text>
                <Text style={[typography.bodySmall, { color: colors.onSurfaceVariant }]}>{isLikelyDuplicate(swipeDelete, list) ? S.duplicate : categoryName(swipeDelete, lk)}</Text>
              </View>
              <Amount paise={swipeDelete.amountPaise} />
            </SwipeRow>
          </View>
        ) : null}
      </ScrollView>
      {snack ? <Snackbar label={snack.label} onUndo={undo} /> : null}
    </ScreenFrame>
  );
}
