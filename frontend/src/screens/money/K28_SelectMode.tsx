/**
 * k28: Select mode. Contextual app bar with the count and a running total, bulk actions, and
 * swipe actions (swipe right to confirm an AI entry, left to delete with an undo snackbar).
 */
import React, { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { Amount } from '../../components/Amount';
import { CategoryIcon } from '../../components/CategoryIcon';
import { SwipeRow } from '../../components/SwipeRow';
import { entryDays } from '../../data';
import { formatRupees } from '../../lib/format';
import { useTheme } from '../../theme';
import { EntryRow } from './parts/EntryRow';
import { useMoneyNav } from './parts/nav';
import { S, fmt } from './parts/strings';
import { Icon, ScreenFrame } from './parts/ui';

const today = entryDays[0];
const LIST = [today.items[0], today.items[1], today.items[2], today.items[3]];
const PRESELECTED = new Set(['Blinkit', 'Medplus', 'Third Wave Coffee']);

type Removed = { names: string[]; label: string };

export default function K28_SelectMode(): React.JSX.Element {
  const { colors, typography, spacing, shapes } = useTheme();
  const nav = useMoneyNav();
  const [selected, setSelected] = useState<Set<string>>(() => {
    const first = typeof nav.params.name === 'string' ? nav.params.name : null;
    return first && !PRESELECTED.has(first) ? new Set([first]) : new Set(PRESELECTED);
  });
  const [gone, setGone] = useState<string[]>([]);
  const [confirmed, setConfirmed] = useState(false);
  const [snack, setSnack] = useState<Removed | null>(null);

  const visible = LIST.filter((e) => !gone.includes(e.name));
  const chosen = visible.filter((e) => selected.has(e.name));
  const total = chosen.reduce((s, e) => s + e.amount.paise, 0);
  const toggle = (name: string): void =>
    setSelected((cur) => {
      const next = new Set(cur);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  const remove = (names: string[], label: string): void => {
    setGone((g) => [...g, ...names]);
    setSnack({ names, label });
  };
  const bulk = (icon: string, label: string, onPress: () => void): React.JSX.Element => (
    <Pressable key={icon} testID={`bulk-${icon}`} accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={{ width: 48, height: 48, alignItems: 'center', justifyContent: 'center' }}>
      <Icon name={icon} size={22} color={colors.onSecondaryContainer} />
    </Pressable>
  );
  const swipeRemoved = gone.includes('Chai Point');
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
        {bulk('category', S.changeCategory, () => undefined)}
        {bulk('call_split', S.splitWithFriends, () => undefined)}
        {bulk('delete', S.delete, () => chosen.length && remove(chosen.map((e) => e.name), fmt(S.deletedMany, { n: chosen.length })))}
      </View>
      <ScrollView contentContainerStyle={{ paddingHorizontal: spacing.screenMargin, paddingBottom: spacing.xxl }}>
        <Text style={[typography.labelMedium, { color: colors.onSurfaceVariant, marginTop: spacing.md, marginBottom: 2 }]}>{`${today.day} \u00B7 ${today.date}`}</Text>
        {visible.map((e) => (
          <EntryRow
            key={e.name}
            testID={`row-${e.name}`}
            name={e.name}
            icon={e.icon}
            sub={e.category}
            amountPaise={e.amount.paise}
            selected={selected.has(e.name)}
            onPress={() => toggle(e.name)}
          />
        ))}
        <Text style={[typography.labelMedium, { color: colors.onSurfaceVariant, marginTop: 22, marginBottom: spacing.sm }]}>{S.swipeActions}</Text>
        <SwipeRow
          testID="swipe-confirm"
          accessibilityLabel={`Swiggy, ${S.fromSms}${confirmed ? ', confirmed' : ''}`}
          peek={132}
          rightSwipe={{ label: S.looksRight, icon: 'check_circle', onTrigger: () => setConfirmed(true) }}
        >
          <CategoryIcon name="restaurant" />
          <View style={{ flex: 1 }}>
            <Text style={[typography.bodyLarge, { color: colors.onSurface }]}>Swiggy</Text>
            <Text style={[typography.bodySmall, { color: colors.onSurfaceVariant }]}>{confirmed ? S.looksRight : S.fromSms}</Text>
          </View>
          {confirmed ? <Icon name="check_circle" size={20} color={colors.primary} /> : null}
        </SwipeRow>
        {swipeRemoved ? null : (
          <View style={{ marginTop: 10 }}>
            <SwipeRow
              testID="swipe-delete"
              accessibilityLabel={`Chai Point, ${S.duplicate}`}
              peek={-110}
              leftSwipe={{ label: S.delete, icon: 'delete', destructive: true, onTrigger: () => remove(['Chai Point'], fmt(S.deleted, { name: 'Chai Point' })) }}
            >
              <CategoryIcon name="local_cafe" />
              <View style={{ flex: 1 }}>
                <Text style={[typography.bodyLarge, { color: colors.onSurface }]}>Chai Point</Text>
                <Text style={[typography.bodySmall, { color: colors.onSurfaceVariant }]}>{S.duplicate}</Text>
              </View>
              <Amount paise={4000} />
            </SwipeRow>
          </View>
        )}
      </ScrollView>
      {snack ? (
        <View testID="snackbar" accessibilityLiveRegion="polite" style={{ marginHorizontal: spacing.lg, marginBottom: spacing.lg, flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, minHeight: 48, borderRadius: shapes.field, backgroundColor: colors.inverseSurface }}>
          <Text style={[typography.bodyMedium, { flex: 1, color: colors.inverseOnSurface }]}>{snack.label}</Text>
          <Pressable
            testID="undo"
            accessibilityRole="button"
            onPress={() => {
              setGone((g) => g.filter((n) => !snack.names.includes(n)));
              setSnack(null);
            }}
            style={{ minHeight: 48, justifyContent: 'center' }}
          >
            <Text style={[typography.labelLarge, { color: colors.primaryContainer, fontWeight: '700' }]}>{S.undo}</Text>
          </Pressable>
        </View>
      ) : null}
    </ScreenFrame>
  );
}
