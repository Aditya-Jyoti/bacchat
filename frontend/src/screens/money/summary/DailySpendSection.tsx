import React, { useState } from 'react';
import { Text, View } from 'react-native';

import { DailyBars } from '../../../components/DailyBars';
import type { DailySpend } from '../../../data/db/queries';
import { formatRupees } from '../../../lib/format';
import { useTheme } from '../../../theme';
import type { Lookups, MonthWindow } from '../parts/live';
import { S, fmt } from '../parts/strings';
import { Icon, useSerif } from '../parts/ui';

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

/** "Sat 17 Oct" for the 0-based day index of a month. */
export function dayLabel(win: MonthWindow, i: number): string {
  const d = new Date(win.fromMs);
  const x = new Date(d.getFullYear(), d.getMonth(), i + 1);
  return `${DOW[x.getDay()]} ${i + 1} ${MON[x.getMonth()]}`;
}

function vsText(vsPaise: number): string {
  return fmt(S.vsAverage, { amount: formatRupees(Math.round(Math.abs(vsPaise) / 100) * 100), dir: vsPaise < 0 ? S.below : S.above });
}

/** Daily spend bars with the tap or hover tooltip (total, top 2, versus average, See entries). */
export function DailySpendSection({
  daily,
  win,
  lookups,
  onSeeEntries,
}: {
  daily: DailySpend;
  win: MonthWindow;
  lookups: Lookups;
  onSeeEntries: (dayIndex: number) => void;
}): React.JSX.Element {
  const { colors, typography } = useTheme();
  const serif = useSerif();
  const elapsed = daily.days.filter((d) => !d.future);
  const todayIndex = Math.max(0, elapsed.length - 1);
  const [picked, setPicked] = useState<number | null>(null);
  const sel = Math.min(picked ?? todayIndex, Math.max(0, elapsed.length - 1));
  const day = daily.days[sel];
  const onInv = colors.inverseOnSurface;
  const values = elapsed.map((d) => d.totalPaise);
  const futureCount = daily.days.length - elapsed.length;
  const labelFor = (i: number): string => {
    const d = daily.days[i];
    return fmt(S.barSummary, { amount: formatRupees(d.totalPaise), day: dayLabel(win, i), vs: vsText(d.vsAveragePaise) });
  };
  const content = (
    <View style={{ width: 184 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text style={[typography.labelSmall, { color: onInv, opacity: 0.8 }]}>{dayLabel(win, sel)}</Text>
        <Text style={[typography.labelSmall, { color: onInv, opacity: 0.8 }]}>{fmt(S.entriesCount, { n: day.count })}</Text>
      </View>
      <Text style={[serif(20), { color: onInv, marginTop: 2 }]}>{formatRupees(day.totalPaise)}</Text>
      {day.top.map((e, i) => (
        <View key={`${e.merchant}-${i}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
          <Icon name={(e.categoryId ? lookups.cats.get(e.categoryId)?.icon : undefined) ?? 'storefront'} size={15} color={onInv} />
          <Text numberOfLines={1} style={[typography.bodySmall, { color: onInv, flex: 1 }]}>
            {e.merchant}
          </Text>
          <Text style={[typography.bodySmall, { color: onInv, fontWeight: '600' }]}>{formatRupees(e.amountPaise)}</Text>
        </View>
      ))}
      <Text style={[typography.labelSmall, { color: onInv, opacity: 0.75, marginTop: 6 }]}>{vsText(day.vsAveragePaise)}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6 }}>
        <Text style={[typography.labelMedium, { color: colors.primaryContainer, fontWeight: '700' }]}>{S.seeEntries}</Text>
        <Icon name="chevron_right" size={16} color={colors.primaryContainer} />
      </View>
    </View>
  );
  return (
    <DailyBars
      values={values}
      daysInMonth={daily.days.length}
      todayIndex={win.isCurrent ? todayIndex : -1}
      selectedIndex={sel}
      onSelect={setPicked}
      tooltip={content}
      onTooltipPress={() => onSeeEntries(sel)}
      tooltipAccessibilityLabel={`${S.seeEntries}: ${dayLabel(win, sel)}`}
      labelFor={labelFor}
      summary={fmt(S.chartSummary, { month: win.name, total: formatRupees(daily.totalPaise), avg: formatRupees(daily.averagePaise) })}
      futureLabel={futureCount > 0 ? fmt(S.daysToGo, { n: futureCount }) : undefined}
      axisLabels={[`1 ${win.shortName}`, win.isCurrent ? S.axisToday : '', String(daily.days.length)]}
    />
  );
}
