import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { useTheme } from '../theme';
import { t } from '../lib/i18n';

export type MonthStripDot = { index: number; kind: 'sip' | 'bill' };

export type MonthStripProps = {
  /** Day-of-month number for each cell, in order (28 cells = 4 weeks). */
  days: readonly number[];
  /** Index of today; it gets a primary circle. */
  todayIndex: number;
  /** Event dots: bills in primary, SIPs in chart2. */
  dots: readonly MonthStripDot[];
  /** Hide dots of kinds not listed (filter chips). Default: both. */
  visibleKinds?: readonly ('sip' | 'bill')[];
  /** Weekday header, Sunday first. */
  weekdays?: readonly string[];
  onSelect?: (index: number) => void;
  testID?: string;
};

/** Calendar grid of 7 columns with a today circle and one event dot per day. */
export function MonthStrip({
  days,
  todayIndex,
  dots,
  visibleKinds = ['sip', 'bill'],
  weekdays = ['S', 'M', 'T', 'W', 'T', 'F', 'S'],
  onSelect,
  testID = 'month-strip',
}: MonthStripProps): React.JSX.Element {
  const { colors, typography } = useTheme();
  const [selected, setSelected] = useState<number | null>(null);
  const dotOf = (i: number) => dots.find((d) => d.index === i && visibleKinds.includes(d.kind));
  const rows: number[][] = [];
  for (let i = 0; i < days.length; i += 7) rows.push(days.slice(i, i + 7).map((_, j) => i + j));
  const summary = dots
    .filter((d) => visibleKinds.includes(d.kind))
    .map((d) => `${days[d.index]} ${d.kind === 'sip' ? t('componentsUi.sip') : t('componentsUi.billOrCardDue')}`)
    .join(', ');
  return (
    <View testID={testID} accessibilityLabel={t('componentsUi.calendarSummary', { today: days[todayIndex], summary })}>
      <View style={{ flexDirection: 'row', marginBottom: 4 }}>
        {weekdays.map((w, i) => (
          <Text key={i} style={[typography.labelSmall, { flex: 1, textAlign: 'center', color: colors.onSurfaceVariant }]}>
            {w}
          </Text>
        ))}
      </View>
      {rows.map((row, r) => (
        <View key={r} style={{ flexDirection: 'row', marginBottom: 2 }}>
          {row.map((i) => {
            const today = i === todayIndex;
            const dot = dotOf(i);
            const sel = selected === i && !today;
            return (
              <Pressable
                key={i}
                testID={`month-cell-${i}`}
                accessibilityRole="button"
                accessibilityLabel={`${days[i]}${today ? `, ${t('componentsUi.todayWord')}` : ''}${dot ? (dot.kind === 'sip' ? `, ${t('componentsUi.sip')}` : `, ${t('componentsUi.billDue')}`) : ''}`}
                onPress={() => {
                  setSelected(i);
                  onSelect?.(i);
                }}
                style={{ flex: 1, height: 48, alignItems: 'center', justifyContent: 'center', gap: 2 }}
              >
                <View
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: 15,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: today ? colors.primary : sel ? colors.secondaryContainer : 'transparent',
                  }}
                >
                  <Text style={[typography.labelMedium, { color: today ? colors.onPrimary : colors.onSurface }]}>{days[i]}</Text>
                </View>
                {dot ? (
                  <View
                    testID={`month-dot-${i}`}
                    style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: dot.kind === 'sip' ? colors.chart2 : colors.primary }}
                  />
                ) : (
                  <View style={{ height: 5 }} />
                )}
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}
