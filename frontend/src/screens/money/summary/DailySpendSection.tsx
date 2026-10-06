import React, { useState } from 'react';
import { Text, View } from 'react-native';

import { DailyBars } from '../../../components/DailyBars';
import {
  dailyAverage,
  dailyDefaultSelectedIndex,
  dailySpendPaise,
  dailyTodayIndex,
  dailyTooltip,
  dow,
  spendTotal,
} from '../../../data';
import { formatRupees } from '../../../lib/format';
import { useTheme } from '../../../theme';
import { S, fmt } from '../parts/strings';
import { Icon, useSerif } from '../parts/ui';

const DAYS_IN_MONTH = 31;

/** "Sat 17 Oct" for a day index of October 2026. */
export function dayLabel(i: number): string {
  return `${dow[i % 7]} ${i + 1} Oct`;
}

function vsText(vsPaise: number): string {
  return fmt(S.vsAverage, { amount: formatRupees(Math.abs(vsPaise)), dir: vsPaise < 0 ? S.below : S.above });
}

/** Daily spend bars with the tap or hover tooltip (total, top 2, versus average, See entries). */
export function DailySpendSection({ onSeeEntries }: { onSeeEntries: (dayIndex: number) => void }): React.JSX.Element {
  const { colors, typography } = useTheme();
  const serif = useSerif();
  const [sel, setSel] = useState<number>(dailyDefaultSelectedIndex);
  const tip = dailyTooltip(sel);
  const onInv = colors.inverseOnSurface;
  const content = (
    <View style={{ width: 184 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text style={[typography.labelSmall, { color: onInv, opacity: 0.8 }]}>{dayLabel(sel)}</Text>
        <Text style={[typography.labelSmall, { color: onInv, opacity: 0.8 }]}>{fmt(S.entriesCount, { n: tip.entries })}</Text>
      </View>
      <Text style={[serif(20), { color: onInv, marginTop: 2 }]}>{tip.total.text}</Text>
      {tip.top.map((e) => (
        <View key={e.name} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
          <Icon name={e.icon} size={15} color={onInv} />
          <Text numberOfLines={1} style={[typography.bodySmall, { color: onInv, flex: 1 }]}>
            {e.name}
          </Text>
          <Text style={[typography.bodySmall, { color: onInv, fontWeight: '600' }]}>{e.amount.text}</Text>
        </View>
      ))}
      <Text style={[typography.labelSmall, { color: onInv, opacity: 0.75, marginTop: 6 }]}>{vsText(tip.vsAverage.paise)}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6 }}>
        <Text style={[typography.labelMedium, { color: colors.primaryContainer, fontWeight: '700' }]}>{S.seeEntries}</Text>
        <Icon name="chevron_right" size={16} color={colors.primaryContainer} />
      </View>
    </View>
  );
  return (
    <DailyBars
      values={dailySpendPaise}
      daysInMonth={DAYS_IN_MONTH}
      todayIndex={dailyTodayIndex}
      selectedIndex={sel}
      onSelect={setSel}
      tooltip={content}
      onTooltipPress={() => onSeeEntries(sel)}
      tooltipAccessibilityLabel={`${S.seeEntries}: ${dayLabel(sel)}`}
      labelFor={(i) => {
        const tp = dailyTooltip(i);
        return fmt(S.barSummary, { amount: tp.total.text, day: dayLabel(i), vs: vsText(tp.vsAverage.paise) });
      }}
      summary={fmt(S.chartSummary, { total: spendTotal.text, avg: dailyAverage.text })}
      futureLabel={fmt(S.daysToGo, { n: DAYS_IN_MONTH - dailySpendPaise.length })}
      axisLabels={[S.axisStart, S.axisToday, S.axisEnd]}
    />
  );
}
