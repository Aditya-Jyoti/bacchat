import React from 'react';
import { View } from 'react-native';

import { useTheme } from '../theme';

export type SegmentedProgressProps = {
  /** 0..1 */
  fraction: number;
  /** Number of quarter-style ticks (default 4 = 25/50/75 milestones). */
  segments?: number;
  height?: number;
  /** Fill colour override, e.g. caution. Defaults to primary. */
  color?: string;
  accessibilityLabel?: string;
};

/** Segmented bar with milestone ticks. Track is surfaceContainerHigh. */
export function SegmentedProgress({
  fraction,
  segments = 4,
  height = 10,
  color,
  accessibilityLabel,
}: SegmentedProgressProps): React.JSX.Element {
  const { colors } = useTheme();
  const f = Math.max(0, Math.min(1, fraction));
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(f * 100) }}
      testID="segmented-progress"
      style={{ height, borderRadius: height / 2, backgroundColor: colors.surfaceContainerHigh, overflow: 'hidden' }}
    >
      <View style={{ width: `${f * 100}%`, height, backgroundColor: color ?? colors.primary }} />
      {Array.from({ length: segments - 1 }, (_, i) => (
        <View
          key={i}
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: `${((i + 1) / segments) * 100}%`,
            width: 2,
            backgroundColor: colors.surface,
          }}
        />
      ))}
    </View>
  );
}
