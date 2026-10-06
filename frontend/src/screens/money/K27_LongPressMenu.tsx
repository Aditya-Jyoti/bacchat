/**
 * k27: Long-press menu. The list dims under a scrim, the pressed row lifts onto a surface and a
 * menu of quick fixes opens beside it. Route params: name (entry name, default Third Wave Coffee).
 * Select opens k28; tapping outside returns to k4.
 */
import React, { useState } from 'react';
import { Pressable, Text, View, useWindowDimensions, type LayoutChangeEvent } from 'react-native';

import { Amount } from '../../components/Amount';
import { CategoryIcon } from '../../components/CategoryIcon';
import { entryDays, type EntryItem } from '../../data';
import { useTheme } from '../../theme';
import { useMoneyNav } from './parts/nav';
import { S } from './parts/strings';
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

const today = entryDays[0];

function shortVia(via: string): string {
  return via.split(' \u00B7 ')[0].replace(' credit card', ' card');
}

export default function K27_LongPressMenu({ onAction }: { onAction?: (a: MenuAction, entry: EntryItem) => void } = {}): React.JSX.Element {
  const { colors, typography, shapes, spacing } = useTheme();
  const serif = useSerif();
  const nav = useMoneyNav();
  const wanted = typeof nav.params.name === 'string' ? nav.params.name : 'Third Wave Coffee';
  const rows = today.items.slice(0, 6);
  const entry = today.items.find((e) => e.name === wanted) ?? today.items[2];
  const [y, setY] = useState<number | null>(null);

  const act = (a: MenuAction): void => {
    onAction?.(a, entry);
    if (a === 'select') nav.open('k28', { name: entry.name });
    else if (a === 'edit' || a === 'split') nav.go('k5');
    else nav.back('k4');
  };
  const lifted = (e: EntryItem): React.JSX.Element => (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm }}>
      <CategoryIcon name={e.icon} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[typography.bodyLarge, { color: colors.onSurface }]}>{e.name}</Text>
        <Text numberOfLines={1} style={[typography.bodySmall, { color: colors.onSurfaceVariant }]}>{`${e.category} \u00B7 ${shortVia(e.via)} \u00B7 ${e.time}`}</Text>
      </View>
      <Amount paise={e.amount.paise} variant="bodyLarge" style={{ fontWeight: '600' }} />
    </View>
  );
  const { height } = useWindowDimensions();
  const top = y ?? 130;
  const menuTop = Math.max(top + 76, Math.min(top + 76, height - 420));
  return (
    <ScreenFrame testID="screen-k27">
      <View style={{ flex: 1, paddingHorizontal: spacing.screenMargin }}>
        <View style={{ height: 52, justifyContent: 'center' }}>
          <Text style={[serif(24), { color: colors.onSurface }]}>{S.money}</Text>
        </View>
        <Text style={[typography.labelMedium, { color: colors.onSurfaceVariant, marginTop: 6, marginBottom: 2 }]}>{`${today.day} \u00B7 ${today.date}`}</Text>
        {rows.map((e) => (
          <View
            key={e.name}
            onLayout={e.name === entry.name ? (ev: LayoutChangeEvent) => setY(ev.nativeEvent.layout.y) : undefined}
            style={{ borderBottomWidth: 1, borderBottomColor: colors.outlineVariant }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm }}>
              <CategoryIcon name={e.icon} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={[typography.bodyLarge, { color: colors.onSurface }]}>{e.name}</Text>
                <Text style={[typography.bodySmall, { color: colors.onSurfaceVariant }]}>{`${e.category} \u00B7 ${shortVia(e.via)}`}</Text>
              </View>
              <Amount paise={e.amount.paise} variant="bodyLarge" style={{ fontWeight: '600' }} />
            </View>
          </View>
        ))}
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
      </View>
    </ScreenFrame>
  );
}
