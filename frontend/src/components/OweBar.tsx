import React from 'react';
import { Text, View } from 'react-native';

import { useTheme } from '../theme';

export type OweBarProps = {
  /** Used share of the limit, 0..1. */
  fraction: number;
  /** Text after the bar, e.g. "7% of Rs 2,00,000 limit". */
  caption: string;
  /** Left indent so the bar lines up under the row title. Default 48. */
  indent?: number;
};

/** Used-of-limit bar for card dues: 4dp track in surfaceContainerHigh, chart3 fill, caption at 11. */
export function OweBar({ fraction, caption, indent = 48 }: OweBarProps): React.JSX.Element {
  const { colors, typography } = useTheme();
  const f = Math.max(0, Math.min(1, fraction));
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={caption}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(f * 100) }}
      testID="owe-bar"
      style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8, marginLeft: indent }}
    >
      <View style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: colors.surfaceContainerHigh }}>
        <View testID="owe-bar-fill" style={{ width: `${Math.round(f * 10000) / 100}%`, height: 4, borderRadius: 2, backgroundColor: colors.chart3 }} />
      </View>
      <Text style={[typography.labelSmall, { color: colors.onSurfaceVariant, fontSize: 11 }]}>{caption}</Text>
    </View>
  );
}
