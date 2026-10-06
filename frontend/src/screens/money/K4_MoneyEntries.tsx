/**
 * k4: Money - Entries. Search bar, source filter chips, day groups with totals, rows tagged
 * MATCHED / RESOLVED / TO REVIEW, and docked add actions. Route params: filter
 * ('review' | 'sms' | 'mail' | 'shot') opens pre-filtered, category narrows to one category.
 */
import React, { useRef, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { ScreenScaffold } from '../../components/ScreenScaffold';
import { useTabScrollToTop } from '../../components/useTabScrollToTop';
import { MoneySegmentedControl } from '../../navigation/MoneySegmentedControl';
import { useTheme } from '../../theme';
import { EntryRow, entryRowProps } from './parts/EntryRow';
import { MoneyHeader } from './parts/MoneyHeader';
import { REVIEW_COUNT, groupEntries, isToReview, parseFilter, type EntryFilter } from './parts/entries';
import { useMoneyNav } from './parts/nav';
import { S } from './parts/strings';
import { FilterChip, Icon, PillButton } from './parts/ui';

const MONTHS = ['August', 'September', 'October'];

export default function K4_MoneyEntries(): React.JSX.Element {
  const { colors, typography, spacing } = useTheme();
  const nav = useMoneyNav();
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
  const category = typeof nav.params.category === 'string' ? nav.params.category : undefined;
  const [month, setMonth] = useState(MONTHS.length - 1);
  const groups = month === MONTHS.length - 1 ? groupEntries(filter, category) : [];
  const chips: { id: EntryFilter; label: string; icon?: string }[] = [
    { id: 'all', label: S.all },
    { id: 'review', label: `${S.toReview} \u00B7 ${REVIEW_COUNT}`, icon: 'auto_awesome' },
    { id: 'sms', label: S.sms, icon: 'sms' },
    { id: 'mail', label: S.email, icon: 'mail' },
    { id: 'shot', label: S.screenshot, icon: 'screenshot_region' },
  ];
  return (
    <ScreenScaffold testID="screen-k4" scroll={false} contentStyle={{ paddingHorizontal: 0 }}>
      <ScrollView ref={scrollRef} contentContainerStyle={{ paddingHorizontal: spacing.screenMargin, paddingBottom: spacing.lg }} keyboardShouldPersistTaps="handled">
        <MoneyHeader
          month={MONTHS[month]}
          onPrev={() => setMonth((m) => Math.max(0, m - 1))}
          onNext={() => setMonth((m) => Math.min(MONTHS.length - 1, m + 1))}
          canPrev={month > 0}
          canNext={month < MONTHS.length - 1}
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
        {groups.length === 0 ? (
          <Text testID="entries-empty" style={[typography.bodyMedium, { color: colors.onSurfaceVariant, marginTop: spacing.xxl }]}>
            {S.noEntries}
          </Text>
        ) : null}
        {groups.map((g) => (
          <View key={g.day.day} testID={`day-${g.day.day}`}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 14 }}>
              <Text style={[typography.labelMedium, { color: colors.onSurfaceVariant }]}>{`${g.day.day} \u00B7 ${g.day.date}`}</Text>
              <Text style={[typography.labelMedium, { color: colors.onSurfaceVariant }]}>{g.totalText}</Text>
            </View>
            {g.day.note && filter === 'all' && !category ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                <Icon name="fact_check" size={14} color={colors.onSurfaceVariant} />
                <Text style={[typography.labelSmall, { color: colors.onSurfaceVariant, flexShrink: 1 }]}>{g.day.note}</Text>
              </View>
            ) : null}
            {g.items.map((e) => (
              <EntryRow
                key={`${g.day.day}-${e.name}-${e.time}`}
                testID={`entry-${e.name}`}
                {...entryRowProps(e, { toReview: isToReview(e) })}
                onLongPress={() => nav.open('k27', { name: e.name, day: g.day.day })}
              />
            ))}
          </View>
        ))}
      </ScrollView>
      <View style={{ flexDirection: 'row', gap: 10, paddingHorizontal: spacing.lg, paddingVertical: 10, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.outlineVariant }}>
        <PillButton testID="action-hand" label={S.byHand} icon="edit" kind="tonal" onPress={() => nav.go('k5')} style={{ flex: 1, paddingHorizontal: spacing.xl }} />
        <PillButton testID="action-shot" label={S.fromScreenshot} icon="add_photo_alternate" onPress={() => nav.go('k7')} style={{ flex: 1.3, paddingHorizontal: spacing.xl }} />
      </View>
    </ScreenScaffold>
  );
}
