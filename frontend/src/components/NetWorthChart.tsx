import React, { useMemo, useState } from 'react';
import { Text, View, type GestureResponderEvent, type LayoutChangeEvent } from 'react-native';
import Svg, { Line, Path } from 'react-native-svg';

import { useTheme } from '../theme';
import { ChartTooltip } from './ChartTooltip';
import { t } from '../lib/i18n';

export type NetWorthChartProps = {
  /** Values in any unit (the sample uses lakhs); drawn min to max. At least 2 points. */
  values: readonly number[];
  /** One label per point, shown in the scrub tooltip and the a11y summary. */
  labels: readonly string[];
  /** Formats a value for the tooltip and a11y summary. */
  formatValue: (v: number) => string;
  height?: number;
};

const PAD = 8;

/** 2dp line, pale primaryContainer area, two dashed rules, end dot, scrub tooltip. */
export function NetWorthChart({ values: given, labels: givenLabels, formatValue, height = 76 }: NetWorthChartProps): React.JSX.Element {
  const { colors, typography } = useTheme();
  const [width, setWidth] = useState(0);
  const [sel, setSel] = useState<number | null>(null);
  // A new notebook has no history: nothing becomes a flat line at zero, one point a flat line at that value.
  const values = useMemo(() => (given.length === 0 ? [0, 0] : given.length === 1 ? [given[0], given[0]] : given.map((v) => (Number.isFinite(v) ? v : 0))), [given]);
  const labels = useMemo(() => (givenLabels.length >= values.length ? givenLabels : values.map((_, i) => givenLabels[i] ?? givenLabels[givenLabels.length - 1] ?? '')), [givenLabels, values]);
  const n = values.length;

  const pts = useMemo(() => {
    const min = Math.min(...values);
    const span = Math.max(...values) - min || 1;
    return values.map((v, i) => ({
      x: n > 1 ? (i / (n - 1)) * width : 0,
      y: PAD + (1 - (v - min) / span) * (height - PAD * 2),
    }));
  }, [values, n, width, height]);

  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
  const area = pts.length ? `${line} L${width} ${height} L0 ${height} Z` : '';
  const last = pts[n - 1];

  const scrub = (e: GestureResponderEvent) => {
    if (width <= 0 || n < 2) return;
    const x = e.nativeEvent.locationX;
    setSel(Math.max(0, Math.min(n - 1, Math.round((x / width) * (n - 1)))));
  };
  const p = sel !== null ? pts[sel] : null;
  const first = formatValue(values[0]);
  const end = formatValue(values[n - 1]);
  const summary = t('componentsUi.netWorthChart', { from: labels[0], to: labels[n - 1], first, end });

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={summary}
      testID="networth-chart"
      onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}
      onTouchStart={scrub}
      onTouchMove={scrub}
      onTouchEnd={() => setSel(null)}
      onTouchCancel={() => setSel(null)}
      style={{ height, overflow: 'visible' }}
    >
      {width > 0 ? (
        <Svg width={width} height={height} style={{ overflow: 'visible' }}>
          <Line x1={0} y1={height / 3} x2={width} y2={height / 3} stroke={colors.outlineVariant} strokeDasharray="3 4" strokeWidth={1} />
          <Line x1={0} y1={(height * 2) / 3} x2={width} y2={(height * 2) / 3} stroke={colors.outlineVariant} strokeDasharray="3 4" strokeWidth={1} />
          <Path d={area} fill={colors.primaryContainer} opacity={0.5} />
          <Path d={line} fill="none" stroke={colors.primary} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          {p ? <Line x1={p.x} y1={0} x2={p.x} y2={height} stroke={colors.inverseSurface} strokeWidth={2} /> : null}
        </Svg>
      ) : null}
      {last && !p ? (
        <View
          testID="networth-end-dot"
          style={{
            position: 'absolute',
            left: last.x - 5,
            top: last.y - 5,
            width: 10,
            height: 10,
            borderRadius: 5,
            backgroundColor: colors.primary,
            borderWidth: 3,
            borderColor: colors.surface,
          }}
        />
      ) : null}
      {p && sel !== null ? (
        <>
          <View
            style={{
              position: 'absolute',
              left: p.x - 5,
              top: p.y - 5,
              width: 10,
              height: 10,
              borderRadius: 5,
              backgroundColor: colors.primary,
            }}
          />
          <ChartTooltip
            testID="networth-tooltip"
            style={{ position: 'absolute', left: Math.max(0, Math.min(width - 110, p.x - 55)), top: -44, width: 110 }}
          >
            <Text style={[typography.labelMedium, { color: colors.inverseOnSurface }]}>{formatValue(values[sel])}</Text>
            <Text style={[typography.bodySmall, { color: colors.inverseOnSurface }]}>{labels[sel]}</Text>
          </ChartTooltip>
        </>
      ) : null}
    </View>
  );
}
