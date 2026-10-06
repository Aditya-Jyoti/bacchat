import React, { useState } from 'react';
import { Pressable, Text, View, type LayoutChangeEvent } from 'react-native';

import { formatRupees } from '../lib/format';
import { useTheme } from '../theme';
import { ChartTooltip } from './ChartTooltip';

export type DailyBarsProps = {
  /** Spend per elapsed day in integer paise (day 1 first). */
  values: readonly number[];
  /** Days in the month; days after values.length are drawn as the dashed future block. */
  daysInMonth: number;
  /** Index of today in values (drawn in chart2). */
  todayIndex: number;
  /** Selected bar (drawn in primary) or null. */
  selectedIndex: number | null;
  /** Called on tap, hover or keyboard focus press of a bar. */
  onSelect: (index: number) => void;
  /** Bars above this paise value use chart3. Default 2000 rupees. */
  highThresholdPaise?: number;
  /** Content of the tooltip for the selected bar (wrapped in ChartTooltip). */
  tooltip?: React.ReactNode;
  /** Called when the tooltip itself is pressed ("See entries"). */
  onTooltipPress?: () => void;
  tooltipAccessibilityLabel?: string;
  /** Per-bar TalkBack label. Default "Day 17: Rs 2,890". */
  labelFor?: (index: number) => string;
  /** Chart level TalkBack summary. */
  summary?: string;
  /** Label inside the dashed future block, e.g. "7 days to go". */
  futureLabel?: string;
  /** Three captions under the axis: start, today, end. */
  axisLabels?: readonly [string, string, string];
  barAreaHeight?: number;
  tooltipAreaHeight?: number;
  tooltipWidth?: number;
};

const GAP = 3;

/**
 * Daily spend as rounded bars. Selected is primary, today chart2, days over the threshold
 * chart3 and the rest surfaceContainerHigh. Future days share one dashed block. Each bar is
 * focusable; the tooltip tracks the selected bar and is clamped inside the chart.
 */
export function DailyBars({
  values,
  daysInMonth,
  todayIndex,
  selectedIndex,
  onSelect,
  highThresholdPaise = 200000,
  tooltip,
  onTooltipPress,
  tooltipAccessibilityLabel,
  labelFor,
  summary,
  futureLabel,
  axisLabels,
  barAreaHeight = 64,
  tooltipAreaHeight = 150,
  tooltipWidth = 208,
}: DailyBarsProps): React.JSX.Element {
  const { colors, typography } = useTheme();
  const [width, setWidth] = useState(0);
  const n = values.length;
  const future = Math.max(0, daysInMonth - n);
  const max = Math.max(1, ...values);
  const unit = (width - GAP * (n + (future ? 0 : -1))) / (n + future);
  const centerOf = (i: number): number => i * (unit + GAP) + unit / 2;
  const show = selectedIndex != null && tooltip != null && width > 0;
  const center = show ? centerOf(selectedIndex) : 0;
  const left = Math.max(0, Math.min(center - tooltipWidth / 2, Math.max(0, width - tooltipWidth)));
  const colorFor = (i: number): string => {
    if (i === selectedIndex) return colors.primary;
    if (i === todayIndex) return colors.chart2;
    if (values[i] > highThresholdPaise) return colors.chart3;
    return colors.surfaceContainerHigh;
  };
  return (
    <View
      testID="daily-bars"
      accessible={summary != null}
      accessibilityLabel={summary}
      onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}
    >
      <View style={{ height: tooltipAreaHeight }}>
        {show ? (
          <Pressable
            testID="daily-tooltip"
            accessibilityRole="button"
            accessibilityLabel={tooltipAccessibilityLabel}
            onPress={onTooltipPress}
            style={{ position: 'absolute', bottom: 0, left, width: tooltipWidth }}
          >
            <ChartTooltip>{tooltip}</ChartTooltip>
          </Pressable>
        ) : null}
      </View>
      <View style={{ height: 6 }}>
        {show ? (
          <View style={{ position: 'absolute', top: 0, left: center - 1, width: 2, height: 6, backgroundColor: colors.inverseSurface }} />
        ) : null}
      </View>
      <View
        style={{
          flexDirection: 'row',
          gap: GAP,
          height: barAreaHeight,
          alignItems: 'flex-end',
          borderBottomWidth: 1,
          borderBottomColor: colors.outlineVariant,
        }}
      >
        {values.map((v, i) => (
          <Pressable
            key={i}
            testID={`daily-bar-${i}`}
            focusable
            accessibilityRole="button"
            accessibilityState={{ selected: i === selectedIndex }}
            accessibilityLabel={labelFor ? labelFor(i) : `Day ${i + 1}: ${formatRupees(v)}`}
            onPress={() => onSelect(i)}
            onHoverIn={() => onSelect(i)}
            onFocus={() => onSelect(i)}
            style={{ flex: 1, height: '100%', justifyContent: 'flex-end' }}
          >
            <View
              testID={`daily-bar-fill-${i}`}
              style={{
                width: '100%',
                height: `${Math.max(2, (v / max) * 100)}%`,
                borderTopLeftRadius: 3,
                borderTopRightRadius: 3,
                borderBottomLeftRadius: 1,
                borderBottomRightRadius: 1,
                backgroundColor: colorFor(i),
              }}
            />
          </Pressable>
        ))}
        {future > 0 ? (
          <View
            testID="daily-future"
            style={{
              flex: future,
              height: '100%',
              alignItems: 'center',
              justifyContent: 'flex-end',
              paddingBottom: 4,
              borderLeftWidth: 1,
              borderStyle: 'dashed',
              borderColor: colors.outlineVariant,
            }}
          >
            {futureLabel ? (
              <Text style={[typography.labelSmall, { color: colors.onSurfaceVariant }]}>{futureLabel}</Text>
            ) : null}
          </View>
        ) : null}
      </View>
      {axisLabels ? (
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
          {axisLabels.map((l, i) => (
            <Text key={i} style={[typography.labelSmall, { color: colors.onSurfaceVariant }]}>
              {l}
            </Text>
          ))}
        </View>
      ) : null}
    </View>
  );
}
