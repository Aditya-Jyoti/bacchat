/**
 * k27: Long-press menu. The list dims under a scrim, the pressed row lifts onto a surface and a
 * menu of quick fixes opens beside it. Route params: id (entry id) or name (merchant; newest match);
 * with neither it opens the newest entry. Edit opens k5 on the entry, Change category picks from your
 * categories, Delete leaves an Undo for k4, Select opens k28; tapping outside returns to k4.
 */
import React, { useMemo, useState } from 'react';
import { Pressable, Text, View, useWindowDimensions, type LayoutChangeEvent } from 'react-native';

import { Amount } from '../../components/Amount';
import { CategoryIcon } from '../../components/CategoryIcon';
import type { Entry } from '../../data/db';
import { dateKey } from '../../data/db/dates';
import { formatTime } from '../../lib/format';
import { useDbQuery, useWriters } from '../../services';
import { useTheme } from '../../theme';
import { CategoryChoices } from './parts/CategoryChoices';
import { EMPTY_LOOKUPS, categoryName, dayHeading, groupByDay, rowFor, shortVia, useLookups, viaLabel } from './parts/live';
import { useMoneyNav } from './parts/nav';
import { S, fmt } from './parts/strings';
import { useUndo } from './parts/undoStore';
import { Icon, ScreenFrame, useSerif } from './parts/ui';

export type MenuAction = 'edit' | 'category' | 'split' | 'goal' | 'copy' | 'select' | 'delete';

const ITEMS: { id: MenuAction; icon: string; label: string }[] = [
  { id: 'edit', icon: 'edit', label: S.edit },
  { id: 'category', icon: 'category', label: S.changeCategory },
  { id: 'split', icon: 'call_split', label: S.splitWithFriends },
  { id: 'goal', icon: 'flag', label: S.addToGoal },
  { id: 'copy', icon: 'content_copy', label: S.copyAmount },
  { id: 'select', icon: 'checklist', label: S.select },
];

export default function K27_LongPressMenu({ onAction }: { onAction?: (a: MenuAction, entry: Entry) => void } = {}): React.JSX.Element {
  const { colors, typography, shapes, spacing } = useTheme();
  const serif = useSerif();
  const nav = useMoneyNav();
  const db = useWriters();
  const lookups = useLookups();
  const lk = lookups.data ?? EMPTY_LOOKUPS;
  const wantedId = typeof nav.params.id === 'string' ? nav.params.id : null;
  const wantedName = typeof nav.params.name === 'string' ? nav.params.name : null;
  // The pressed entry and the other entries of its day (newest first), read from the database.
  const found = useDbQuery(
    async (d, now) => {
      let entry: Entry | null = wantedId ? await d.entries.get(wantedId) : null;
      const all = await d.entries.between(0, Number.MAX_SAFE_INTEGER);
      if (!entry && wantedName) entry = all.find((e) => e.merchant === wantedName) ?? null;
      if (!entry) entry = all[0] ?? null;
      if (!entry) return null;
      const key = dateKey(entry.at);
      const sameDay = all.filter((e) => dateKey(e.at) === key);
      return { entry, sameDay, now };
    },
    [wantedId, wantedName],
  );
  const entry = found.data?.entry ?? null;
  const rows = (found.data?.sameDay ?? []).slice(0, 6);
  const group = useMemo(() => (found.data ? groupByDay(found.data.sameDay, found.data.now)[0] : null), [found.data]);
  const [y, setY] = useState<number | null>(null);
  const [picking, setPicking] = useState(false);
  const cats = useMemo(() => [...lk.cats.values()].sort((a, b) => a.name.localeCompare(b.name)), [lk]);

  const act = (a: MenuAction): void => {
    if (!entry) return;
    onAction?.(a, entry);
    if (a === 'select') nav.open('k28', { ids: [entry.id], name: entry.merchant });
    else if (a === 'edit' || a === 'split') nav.open('k5', { id: entry.id });
    else if (a === 'category') setPicking(true);
    else if (a === 'delete') {
      void db.entries.remove(entry.id).then(() => {
        useUndo.getState().set({ label: fmt(S.deleted, { name: entry.merchant }), entries: [entry] });
      });
      nav.back('k4');
    } else nav.back('k4');
  };
  const recategorise = (categoryId: string): void => {
    if (!entry) return;
    void db.entries.put({ ...entry, categoryId }).then(() => db.merchants.record(entry.merchant, categoryId, entry.amountPaise, entry.at));
    nav.back('k4');
  };
  const lifted = (e: Entry): React.JSX.Element => {
    const r = rowFor(e, lk);
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm }}>
        <CategoryIcon name={r.icon} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[typography.bodyLarge, { color: colors.onSurface }]}>{e.merchant}</Text>
          <Text numberOfLines={1} style={[typography.bodySmall, { color: colors.onSurfaceVariant }]}>{`${categoryName(e, lk)} \u00B7 ${shortVia(viaLabel(e, lk))} \u00B7 ${formatTime(e.at)}`}</Text>
        </View>
        <Amount paise={e.amountPaise} income={e.direction === 'in'} variant="bodyLarge" style={{ fontWeight: '600' }} />
      </View>
    );
  };
  const { height } = useWindowDimensions();
  const top = y ?? 130;
  if (!entry) {
    return (
      <ScreenFrame testID="screen-k27">
        <Pressable testID="scrim" accessibilityRole="button" accessibilityLabel={S.close} onPress={() => nav.back('k4')} style={{ flex: 1, backgroundColor: colors.scrim }} />
      </ScreenFrame>
    );
  }
  const menuTop = Math.max(top + 76, Math.min(top + 76, height - 420));
  return (
    <ScreenFrame testID="screen-k27">
      <View style={{ flex: 1, paddingHorizontal: spacing.screenMargin }}>
        <View style={{ height: 52, justifyContent: 'center' }}>
          <Text style={[serif(24), { color: colors.onSurface }]}>{S.money}</Text>
        </View>
        <Text style={[typography.labelMedium, { color: colors.onSurfaceVariant, marginTop: 6, marginBottom: 2 }]}>{group ? dayHeading(group) : ''}</Text>
        {rows.map((e) => {
          const r = rowFor(e, lk);
          return (
            <View
              key={e.id}
              onLayout={e.id === entry.id ? (ev: LayoutChangeEvent) => setY(ev.nativeEvent.layout.y) : undefined}
              style={{ borderBottomWidth: 1, borderBottomColor: colors.outlineVariant }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm }}>
                <CategoryIcon name={r.icon} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={[typography.bodyLarge, { color: colors.onSurface }]}>{e.merchant}</Text>
                  <Text style={[typography.bodySmall, { color: colors.onSurfaceVariant }]}>{`${categoryName(e, lk)} \u00B7 ${shortVia(viaLabel(e, lk))}`}</Text>
                </View>
                <Amount paise={e.amountPaise} income={e.direction === 'in'} variant="bodyLarge" style={{ fontWeight: '600' }} />
              </View>
            </View>
          );
        })}
        <Pressable
          testID="scrim"
          accessibilityRole="button"
          accessibilityLabel={S.close}
          onPress={() => nav.back('k4')}
          style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: colors.scrim }}
        />
        <View
          testID="lifted-row"
          style={{
            position: 'absolute',
            left: 12,
            right: 12,
            top,
            backgroundColor: colors.surface,
            borderRadius: shapes.card,
            paddingHorizontal: spacing.sm,
            transform: [{ scale: 1.02 }],
            elevation: 8,
            shadowColor: colors.onSurface,
            shadowOpacity: 0.28,
            shadowRadius: 14,
            shadowOffset: { width: 0, height: 10 },
          }}
        >
          {lifted(entry)}
        </View>
        {picking ? (
          <View
            testID="category-panel"
            style={{ position: 'absolute', left: 12, right: 12, top: top + 76, backgroundColor: colors.surfaceContainer, borderRadius: shapes.card, padding: spacing.md, elevation: 8 }}
          >
            <Text style={[typography.labelLarge, { color: colors.onSurface, marginBottom: spacing.sm }]}>{S.changeCategory}</Text>
            <CategoryChoices categories={cats} onPick={(c) => recategorise(c.id)} />
          </View>
        ) : (
        <View
          testID="entry-menu"
          accessibilityRole="menu"
          style={{
            position: 'absolute',
            right: spacing.screenMargin,
            top: menuTop,
            width: 236,
            backgroundColor: colors.surfaceContainer,
            borderRadius: shapes.card,
            paddingVertical: 6,
            elevation: 8,
            shadowColor: colors.onSurface,
            shadowOpacity: 0.28,
            shadowRadius: 14,
            shadowOffset: { width: 0, height: 10 },
          }}
        >
          {ITEMS.map((it) => (
            <Pressable key={it.id} testID={`menu-${it.id}`} accessibilityRole="menuitem" onPress={() => act(it.id)} style={{ flexDirection: 'row', alignItems: 'center', gap: 14, height: 48, paddingHorizontal: spacing.lg }}>
              <Icon name={it.icon} size={22} color={colors.onSurfaceVariant} />
              <Text style={[typography.bodyLarge, { color: colors.onSurface }]}>{it.label}</Text>
            </Pressable>
          ))}
          <View style={{ height: 1, backgroundColor: colors.outlineVariant, marginVertical: 6 }} />
          <Pressable testID="menu-delete" accessibilityRole="menuitem" onPress={() => act('delete')} style={{ flexDirection: 'row', alignItems: 'center', gap: 14, height: 48, paddingHorizontal: spacing.lg }}>
            <Icon name="delete" size={22} color={colors.error} />
            <Text style={[typography.bodyLarge, { color: colors.error }]}>{S.delete}</Text>
          </Pressable>
        </View>
        )}
      </View>
    </ScreenFrame>
  );
}
