import React, { useState } from 'react';
import { Pressable, Text, View, type LayoutChangeEvent } from 'react-native';

import { formatRupees, formatRupeesCompact } from '../lib/format';
import { useTheme } from '../theme';
import { ChartTooltip } from './ChartTooltip';
import { t } from '../lib/i18n';

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
  tooltipWidth?: number;
};

const GAP = 3;
/** Room on the left for the amount scale ("2.5k"). */
const AXIS_W = 34;

/** The top of the amount scale: the tallest day rounded up to 1, 2, 2.5 or 5 times a power of ten (in rupees). */
export function niceMax(maxPaise: number): number {
  const rupees = Math.max(1, maxPaise / 100);
  const pow = Math.pow(10, Math.floor(Math.log10(rupees)));
  const step = [1, 2, 2.5, 5, 10].find((m) => m * pow >= rupees) ?? 10;
  return Math.round(step * pow * 100);
}

/**
 * Daily spend as rounded bars over a light amount scale (0, half, top). Selected is primary, today
 * chart2, days over the threshold chart3 and the rest surfaceContainerHigh. Future days share one
 * dashed block. Each bar is focusable. The tooltip only shows for a picked bar; it floats over the
 * bars inside the chart, clamped to its edges, with a stem down to the bar.
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
  barAreaHeight = 150,
  tooltipWidth = 208,
}: DailyBarsProps): React.JSX.Element {
  const { colors, typography } = useTheme();
  const [width, setWidth] = useState(0);
  const [tipH, setTipH] = useState(0);
  const n = values.length;
  const future = Math.max(0, daysInMonth - n);
  const top = niceMax(Math.max(0, ...values));
  const plotW = Math.max(0, width - AXIS_W);
  const unit = Math.max(0, (plotW - GAP * (n + (future ? 0 : -1))) / Math.max(1, n + future));
  const centerOf = (i: number): number => AXIS_W + i * (unit + GAP) + unit / 2;
  const show = selectedIndex != null && selectedIndex < n && tooltip != null && width > 0;
  const center = show ? centerOf(selectedIndex) : 0;
  const left = Math.max(0, Math.min(center - tooltipWidth / 2, Math.max(0, width - tooltipWidth)));
  const barTop = show ? barAreaHeight * (1 - Math.max(0.02, values[selectedIndex] / top)) : 0;
  const stemH = Math.max(0, barTop - tipH);
  const colorFor = (i: number): string => {
    if (i === selectedIndex) return colors.primary;
    if (i === todayIndex) return colors.chart2;
    if (values[i] > highThresholdPaise) return colors.chart3;
    return colors.surfaceContainerHigh;
  };
  const tick = (fraction: number) => (
    <View
      key={fraction}
      pointerEvents="none"
      style={{ position: 'absolute', left: 0, right: 0, top: barAreaHeight * (1 - fraction) - 7, flexDirection: 'row', alignItems: 'center' }}
    >
      <Text style={[typography.labelSmall, { width: AXIS_W - 4, color: colors.onSurfaceVariant }]} numberOfLines={1}>
        {formatRupeesCompact(Math.round(top * fraction), { symbol: false })}
      </Text>
      {fraction > 0 ? <View style={{ flex: 1, borderTopWidth: 1, borderStyle: 'dashed', borderColor: colors.outlineVariant }} /> : null}
    </View>
  );
  return (
    <View
      testID="daily-bars"
      accessible={summary != null}
      accessibilityLabel={summary}
      onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}
      style={{ marginTop: 18 }}
    >
      <View style={{ height: barAreaHeight }}>
        <View testID="daily-axis" style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }} pointerEvents="none">
          {[0, 0.5, 1].map(tick)}
        </View>
        <View
          style={{
            position: 'absolute',
            left: AXIS_W,
            right: 0,
            top: 0,
            bottom: 0,
            flexDirection: 'row',
            gap: GAP,
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
              accessibilityLabel={labelFor ? labelFor(i) : t('componentsUi.dayAmount', { day: i + 1, amount: formatRupees(v) })}
              onPress={() => onSelect(i)}
              onHoverIn={() => onSelect(i)}
              onFocus={() => onSelect(i)}
              style={{ flex: 1, height: '100%', justifyContent: 'flex-end' }}
            >
              <View
                testID={`daily-bar-fill-${i}`}
                style={{
                  width: '100%',
                  height: `${Math.max(2, (v / top) * 100)}%`,
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
              {futureLabel ? <Text style={[typography.labelSmall, { color: colors.onSurfaceVariant }]}>{futureLabel}</Text> : null}
            </View>
          ) : null}
        </View>
        {show && stemH > 0 ? (
          <View pointerEvents="none" style={{ position: 'absolute', top: tipH, left: center - 1, width: 2, height: stemH, backgroundColor: colors.inverseSurface }} />
        ) : null}
        {show ? (
          <Pressable
            testID="daily-tooltip"
            accessibilityRole="button"
            accessibilityLabel={tooltipAccessibilityLabel}
            onPress={onTooltipPress}
            onLayout={(e: LayoutChangeEvent) => setTipH(e.nativeEvent.layout.height)}
            style={{ position: 'absolute', top: 0, left, width: tooltipWidth }}
          >
            <ChartTooltip>{tooltip}</ChartTooltip>
          </Pressable>
        ) : null}
      </View>
      {axisLabels ? (
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4, marginLeft: AXIS_W }}>
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
