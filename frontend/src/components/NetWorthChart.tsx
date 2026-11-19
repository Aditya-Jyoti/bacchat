import React, { useMemo, useRef, useState } from 'react';
import { Text, View, type GestureResponderEvent, type LayoutChangeEvent } from 'react-native';
import Svg, { Line, Path } from 'react-native-svg';

import { useTheme } from '../theme';
import { ChartTooltip } from './ChartTooltip';
import { t } from '../lib/i18n';

export type NetWorthChartProps = {
  /** Values in any unit (the sample uses lakhs); drawn min to max. At least 2 points. */
  values: readonly number[];
  /** One label per point, shown on the x axis (first, middle, last), in the scrub tooltip and the a11y summary. */
  labels: readonly string[];
  /** Formats a value for the y axis, the tooltip and the a11y summary (compact: 1.1L, 52k). */
  formatValue: (v: number) => string;
  /** Formats the value in the tooltip (full amount); defaults to formatValue. */
  formatTooltip?: (v: number) => string;
  /** Optional third tooltip line for a point: what changed since the point before (for example a day's spend). */
  describeChange?: (change: number, index: number) => string | null;
  /** Height of the plot itself; the axis labels add to it. */
  height?: number;
};

const PAD = 8;
/** Width of the y axis label column. */
const AXIS_W = 46;
const TIP_W = 150;

/**
 * 2dp line, pale primaryContainer area, dashed rules at the top, middle and bottom with their values on
 * the y axis, dates on the x axis, end dot, and a scrub tooltip. The plot claims the touch (a scroll
 * cannot take it away mid-scrub) and reads the finger from page coordinates, so the tooltip follows
 * the finger whatever part of the drawing is under it.
 */
export function NetWorthChart({ values: given, labels: givenLabels, formatValue, formatTooltip, describeChange, height = 96 }: NetWorthChartProps): React.JSX.Element {
  const { colors, typography } = useTheme();
  const [width, setWidth] = useState(0);
  const [sel, setSel] = useState<number | null>(null);
  const plot = useRef<View>(null);
  const plotLeft = useRef<number | null>(null);
  // A new notebook has no history: nothing becomes a flat line at zero, one point a flat line at that value.
  const values = useMemo(() => (given.length === 0 ? [0, 0] : given.length === 1 ? [given[0], given[0]] : given.map((v) => (Number.isFinite(v) ? v : 0))), [given]);
  const labels = useMemo(() => (givenLabels.length >= values.length ? givenLabels : values.map((_, i) => givenLabels[i] ?? givenLabels[givenLabels.length - 1] ?? '')), [givenLabels, values]);
  const n = values.length;
  const min = Math.min(...values);
  const max = Math.max(...values);

  const pts = useMemo(() => {
    const span = max - min || 1;
    return values.map((v, i) => ({
      x: n > 1 ? (i / (n - 1)) * width : 0,
      y: PAD + (1 - (v - min) / span) * (height - PAD * 2),
    }));
  }, [values, n, width, height, min, max]);

  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
  const area = pts.length ? `${line} L${width} ${height} L0 ${height} Z` : '';
  const last = pts[n - 1];

  const pick = (e: GestureResponderEvent): void => {
    if (width <= 0 || n < 2) return;
    const { pageX, locationX } = e.nativeEvent;
    const x = plotLeft.current != null && typeof pageX === 'number' ? pageX - plotLeft.current : locationX;
    setSel(Math.max(0, Math.min(n - 1, Math.round((x / width) * (n - 1)))));
  };
  const grant = (e: GestureResponderEvent): void => {
    const pageX = e.nativeEvent.pageX;
    const locationX = e.nativeEvent.locationX;
    // Where the plot starts on screen, so later moves can use page coordinates.
    if (typeof pageX === 'number' && typeof locationX === 'number') plotLeft.current = pageX - locationX;
    plot.current?.measureInWindow?.((x) => {
      if (Number.isFinite(x)) plotLeft.current = x;
    });
    pick(e);
  };
  const clear = (): void => setSel(null);

  const p = sel !== null ? pts[sel] : null;
  const first = formatValue(values[0]);
  const end = formatValue(values[n - 1]);
  const summary = t('componentsUi.netWorthChart', { from: labels[0], to: labels[n - 1], first, end });
  const change = sel !== null && sel > 0 && describeChange ? describeChange(values[sel] - values[sel - 1], sel) : null;
  const flat = max === min;
  const axisText = [typography.labelSmall, { color: colors.onSurfaceVariant }];
  const mid = Math.floor((n - 1) / 2);

  return (
    <View accessible accessibilityRole="image" accessibilityLabel={summary} testID="networth-chart" style={{ overflow: 'visible' }}>
      <View style={{ flexDirection: 'row' }}>
        {/* y axis: the values at the top, middle and bottom rules */}
        <View testID="networth-y-axis" pointerEvents="none" style={{ width: AXIS_W, height }}>
          <Text style={[axisText, { position: 'absolute', top: PAD - 8 }]} numberOfLines={1}>
            {formatValue(max)}
          </Text>
          {!flat ? (
            <>
              <Text style={[axisText, { position: 'absolute', top: height / 2 - 8 }]} numberOfLines={1}>
                {formatValue((max + min) / 2)}
              </Text>
              <Text style={[axisText, { position: 'absolute', top: height - PAD - 8 }]} numberOfLines={1}>
                {formatValue(min)}
              </Text>
            </>
          ) : null}
        </View>
        {/* The plot and the date row below it take the touch together: pick a day by touching under the
            line (or on the dates) so the thumb never hides the point being read. Only x matters. */}
        <View
          ref={plot}
          testID="networth-plot"
          onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}
          onStartShouldSetResponder={() => true}
          onMoveShouldSetResponder={() => true}
          onResponderTerminationRequest={() => false}
          onResponderGrant={grant}
          onResponderMove={pick}
          onResponderRelease={clear}
          onResponderTerminate={clear}
          style={{ flex: 1, overflow: 'visible' }}
        >
          <View style={{ height, overflow: 'visible' }}>
            {width > 0 ? (
              <Svg pointerEvents="none" width={width} height={height} style={{ overflow: 'visible' }}>
                <Line x1={0} y1={PAD} x2={width} y2={PAD} stroke={colors.outlineVariant} strokeDasharray="3 4" strokeWidth={1} />
                <Line x1={0} y1={height / 2} x2={width} y2={height / 2} stroke={colors.outlineVariant} strokeDasharray="3 4" strokeWidth={1} />
                <Line x1={0} y1={height - PAD} x2={width} y2={height - PAD} stroke={colors.outlineVariant} strokeDasharray="3 4" strokeWidth={1} />
                <Path d={area} fill={colors.primaryContainer} opacity={0.5} />
                <Path d={line} fill="none" stroke={colors.primary} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
                {p ? <Line x1={p.x} y1={0} x2={p.x} y2={height} stroke={colors.inverseSurface} strokeWidth={2} /> : null}
              </Svg>
            ) : null}
            {last && !p ? (
              <View
                testID="networth-end-dot"
                pointerEvents="none"
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
                <View pointerEvents="none" style={{ position: 'absolute', left: p.x - 5, top: p.y - 5, width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary }} />
                <ChartTooltip
                  testID="networth-tooltip"
                  style={{ position: 'absolute', left: Math.max(-AXIS_W, Math.min(width - TIP_W, p.x - TIP_W / 2)), top: change ? -66 : -48, width: TIP_W }}
                >
                  <Text style={[typography.labelMedium, { color: colors.inverseOnSurface }]}>{(formatTooltip ?? formatValue)(values[sel])}</Text>
                  <Text style={[typography.bodySmall, { color: colors.inverseOnSurface }]}>{labels[sel]}</Text>
                  {change ? (
                    <Text testID="networth-tooltip-change" style={[typography.bodySmall, { color: colors.inverseOnSurface }]}>
                      {change}
                    </Text>
                  ) : null}
                </ChartTooltip>
              </>
            ) : null}
          </View>
          {/* x axis: first, middle and last labels; part of the touch area, with room for a thumb */}
          <View testID="networth-x-axis" pointerEvents="none" style={{ flexDirection: 'row', justifyContent: 'space-between', paddingTop: 4, minHeight: 32 }}>
            <Text style={axisText}>{labels[0]}</Text>
            {n > 2 ? <Text style={axisText}>{labels[mid]}</Text> : null}
            <Text style={axisText}>{labels[n - 1]}</Text>
          </View>
        </View>
      </View>
    </View>
  );
}
