/** k19: Search. Active bar with the cursor, filter chips (month, amount, source), results with a running total, recent searches. */
import React, { useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import { formatRupees } from '../../lib/format';
import { useTheme } from '../../theme';
import { EntryRow } from './parts/EntryRow';
import { useMoneyNav } from './parts/nav';
import { AMOUNT_RANGES, SOURCE_FILTERS, recentSearches, runSearch } from './parts/searchData';
import { S, fmt } from './parts/strings';
import { FilterChip, Icon, ScreenFrame, useSerif } from './parts/ui';

type Open = 'amount' | 'source' | null;

export default function K19_Search(): React.JSX.Element {
  const { colors, typography, spacing } = useTheme();
  const serif = useSerif();
  const nav = useMoneyNav();
  const [query, setQuery] = useState('swiggy');
  const [range, setRange] = useState(AMOUNT_RANGES[0]);
  const [source, setSource] = useState(SOURCE_FILTERS[0]);
  const [open, setOpen] = useState<Open>(null);
  const results = runSearch(query, range, source.id);
  const total = results.reduce((s, r) => s + (r.income ? 0 : Math.abs(r.amount.paise)), 0);
  const toggle = (o: Exclude<Open, null>): void => setOpen((cur) => (cur === o ? null : o));
  return (
    <ScreenFrame testID="screen-k19">
      <View style={{ paddingHorizontal: spacing.md, paddingTop: spacing.sm }}>
        <View style={{ height: 56, borderRadius: 28, backgroundColor: colors.surfaceContainer, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingLeft: 4, paddingRight: spacing.sm }}>
          <Pressable testID="search-back" accessibilityRole="button" accessibilityLabel={S.back} onPress={() => nav.back('k4')} style={{ width: 48, height: 48, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="arrow_back" size={24} color={colors.onSurface} />
          </Pressable>
          <TextInput
            testID="search-input"
            accessibilityLabel={S.searchEntries}
            value={query}
            onChangeText={setQuery}
            autoFocus
            returnKeyType="search"
            placeholder={S.searchEntries}
            placeholderTextColor={colors.onSurfaceVariant}
            selectionColor={colors.primary}
            style={[typography.bodyLarge, { flex: 1, color: colors.onSurface, padding: 0 }]}
          />
          {query ? (
            <Pressable testID="search-clear" accessibilityRole="button" accessibilityLabel={S.clear} onPress={() => setQuery('')} style={{ width: 48, height: 48, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="close" size={22} color={colors.onSurfaceVariant} />
            </Pressable>
          ) : null}
        </View>
      </View>
      <ScrollView contentContainerStyle={{ paddingHorizontal: spacing.screenMargin, paddingBottom: spacing.xxl }} keyboardShouldPersistTaps="handled">
        <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md }}>
          <FilterChip testID="chip-month" label={S.month} icon="calendar_month" selected={false} />
          <FilterChip testID="chip-amount" label={range.label} selected={range.id !== 'any'} trailingIcon="arrow_drop_down" onPress={() => toggle('amount')} />
          <FilterChip testID="chip-source" label={source.label} selected={source.id !== 'all'} trailingIcon="arrow_drop_down" onPress={() => toggle('source')} />
        </View>
        {open ? (
          <View testID="filter-options" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm }}>
            {open === 'amount'
              ? AMOUNT_RANGES.map((r) => (
                  <FilterChip key={r.id} testID={`amount-${r.id}`} label={r.label} selected={r.id === range.id} onPress={() => { setRange(r); setOpen(null); }} />
                ))
              : SOURCE_FILTERS.map((s) => (
                  <FilterChip key={s.id} testID={`source-${s.id}`} label={s.id === 'all' ? 'All sources' : s.label} selected={s.id === source.id} onPress={() => { setSource(s); setOpen(null); }} />
                ))}
          </View>
        ) : null}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginTop: spacing.lg, paddingBottom: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.outlineVariant }}>
          <Text testID="result-count" style={[typography.bodyMedium, { color: colors.onSurfaceVariant }]}>{fmt(S.results, { n: results.length })}</Text>
          <Text testID="result-total" style={[serif(20), { color: colors.onSurface }]}>{formatRupees(total)}</Text>
        </View>
        {results.length === 0 && query.trim() ? (
          <Text testID="search-empty" style={[typography.bodyMedium, { color: colors.onSurfaceVariant, paddingVertical: spacing.lg }]}>{S.noEntries}</Text>
        ) : null}
        {results.map((r, i) => (
          <EntryRow
            key={`${r.name}-${r.when}-${i}`}
            name={r.name}
            icon={r.icon}
            sub={`${r.when} \u00B7 ${r.via}`}
            amountPaise={r.amount.paise}
            income={r.income}
            source={r.source}
          />
        ))}
        <Text style={[typography.labelMedium, { color: colors.onSurfaceVariant, letterSpacing: 0.4, marginTop: 18, marginBottom: spacing.sm }]}>{S.recent}</Text>
        {recentSearches.map((r) => (
          <Pressable key={r} testID={`recent-${r}`} accessibilityRole="button" accessibilityLabel={r} onPress={() => setQuery(r)} style={{ flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 48 }}>
            <Icon name="history" size={20} color={colors.onSurfaceVariant} />
            <Text style={[typography.bodyMedium, { flex: 1, color: colors.onSurface }]}>{r}</Text>
            <Icon name="north_west" size={18} color={colors.onSurfaceVariant} />
          </Pressable>
        ))}
      </ScrollView>
    </ScreenFrame>
  );
}
