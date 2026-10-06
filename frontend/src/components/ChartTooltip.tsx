import React from 'react';
import { View, Text, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '../theme';

export type ChartTooltipProps = {
  children: React.ReactNode;
  /** Optional 2px stem drawn below the bubble down to the touch point. */
  stemHeight?: number;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

/** inverseSurface bubble used above chart touch points. Position it with `style` (absolute left/top). */
export function ChartTooltip({ children, stemHeight = 0, style, testID }: ChartTooltipProps): React.JSX.Element {
  const { colors, shapes, spacing, typography } = useTheme();
  return (
    <View pointerEvents="none" testID={testID ?? 'chart-tooltip'} style={[{ alignItems: 'center' }, style]}>
      <View
        style={{
          backgroundColor: colors.inverseSurface,
          borderRadius: shapes.field,
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.sm,
        }}
      >
        {typeof children === 'string' ? (
          <Text style={[typography.bodySmall, { color: colors.inverseOnSurface }]}>{children}</Text>
        ) : (
          children
        )}
      </View>
      {stemHeight > 0 ? <View style={{ width: 2, height: stemHeight, backgroundColor: colors.inverseSurface }} /> : null}
    </View>
  );
}
