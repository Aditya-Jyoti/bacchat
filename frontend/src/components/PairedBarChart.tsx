import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { formatRupeesCompact } from '../lib/format';
import { useTheme } from '../theme';
import { ChartTooltip } from './ChartTooltip';

export type PairedBarChartProps = {
  /** One label per month, shown under the columns. */
  months: readonly string[];
  /** Money in per month, integer paise. */
  income: readonly number[];
  /** Money out per month, integer paise. */
  spend: readonly number[];
  /** Plot height in dp (default 90). */
  height?: number;
  /** Initially selected month index, for tests and previews. */
  initialSelected?: number | null;
  testID?: string;
};

/** Cash flow: two rounded columns per month (in = primary, out = chart3). Tap a month for "net kept". */
export function PairedBarChart({
  months,
  income,
  spend,
  height = 90,
  initialSelected = null,
  testID = 'paired-bar-chart',
}: PairedBarChartProps): React.JSX.Element {
  const { colors, typography, spacing } = useTheme();
  const [selected, setSelected] = useState<number | null>(initialSelected);
  const max = Math.max(1, ...income, ...spend);
  const k = (p: number) => formatRupeesCompact(p, { symbol: true });
  const summary = `Cash flow, last ${months.length} months. ` +
    months.map((m, i) => `${m}: in ${k(income[i] ?? 0)}, out ${k(spend[i] ?? 0)}.`).join(' ');
  const n = months.length;
  const net = selected === null ? 0 : (income[selected] ?? 0) - (spend[selected] ?? 0);
  const pct = selected === null ? 0 : Math.min(85, Math.max(15, ((selected + 0.5) / n) * 100));
  const radius = { borderTopLeftRadius: 6, borderTopRightRadius: 6, borderBottomLeftRadius: 2, borderBottomRightRadius: 2 };
  return (
    <View testID={testID} accessible accessibilityLabel={summary}>
      <View style={{ height: height + 40, justifyContent: 'flex-end' }}>
        {selected !== null ? (
          <View style={{ position: 'absolute', top: 0, left: `${pct}%`, width: 0, alignItems: 'center' }}>
            <ChartTooltip testID="paired-tooltip" stemHeight={6} style={{ width: 160 }}>
              {`${months[selected]} \u00B7 net kept ${k(net)}`}
            </ChartTooltip>
          </View>
        ) : null}
        <View style={{ flexDirection: 'row', height, gap: 10, alignItems: 'flex-end', borderBottomWidth: 1, borderBottomColor: colors.outlineVariant }}>
          {months.map((m, i) => (
            <Pressable
              key={m}
              testID={`paired-col-${i}`}
              accessibilityRole="button"
              accessibilityLabel={`${m}, in ${k(income[i] ?? 0)}, out ${k(spend[i] ?? 0)}`}
              onPress={() => setSelected(selected === i ? null : i)}
              style={{ flex: 1, flexDirection: 'row', gap: 3, alignItems: 'flex-end', height: '100%' }}
            >
              <View testID={`paired-in-${i}`} style={[{ flex: 1, height: ((income[i] ?? 0) / max) * height, backgroundColor: colors.primary }, radius]} />
              <View testID={`paired-out-${i}`} style={[{ flex: 1, height: ((spend[i] ?? 0) / max) * height, backgroundColor: colors.chart3 }, radius]} />
            </Pressable>
          ))}
        </View>
      </View>
      <View style={{ flexDirection: 'row', gap: 10, marginTop: spacing.xs + 2 }}>
        {months.map((m) => (
          <Text key={m} style={[typography.labelSmall, { flex: 1, textAlign: 'center', color: colors.onSurfaceVariant }]}>
            {m}
          </Text>
        ))}
      </View>
    </View>
  );
}
