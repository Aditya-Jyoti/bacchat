import React from 'react';
import { View } from 'react-native';

import { useTheme } from '../theme';

export type PaceBarProps = {
  /** Spent share of the budget, 0..1. */
  fraction: number;
  /** Where today sits in the month, 0..1. Draws a 2dp marker 20dp tall. */
  todayFraction: number;
  /** Fill override, e.g. colors.caution when over budget. Defaults to primary. */
  color?: string;
  /** Spoken summary, e.g. "69 percent spent, 77 percent of the month gone". */
  accessibilityLabel: string;
};

/** Budget track: 10dp bar with a "today" marker in onSurface. Over budget passes the caution colour. */
export function PaceBar({ fraction, todayFraction, color, accessibilityLabel }: PaceBarProps): React.JSX.Element {
  const { colors } = useTheme();
  const f = Math.max(0, Math.min(1, fraction));
  const d = Math.max(0, Math.min(1, todayFraction));
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(f * 100) }}
      testID="pace-bar"
      style={{ height: 10, borderRadius: 5, backgroundColor: colors.surfaceContainerHigh, justifyContent: 'center' }}
    >
      <View testID="pace-bar-fill" style={{ width: `${f * 100}%`, height: 10, borderRadius: 5, backgroundColor: color ?? colors.primary }} />
      <View
        testID="pace-bar-today"
        style={{ position: 'absolute', left: `${d * 100}%`, top: -5, width: 2, height: 20, borderRadius: 1, backgroundColor: colors.onSurface }}
      />
    </View>
  );
}
