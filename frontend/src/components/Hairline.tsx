import React from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '../theme';

export type HairlineProps = {
  /** Indent from the left, for rules that start after an icon circle. */
  inset?: number;
  style?: StyleProp<ViewStyle>;
};

/** 1dp rule in outlineVariant. Used instead of cards. */
export function Hairline({ inset = 0, style }: HairlineProps): React.JSX.Element {
  const { colors, spacing } = useTheme();
  return (
    <View
      accessibilityRole="none"
      importantForAccessibility="no"
      testID="hairline"
      style={[{ height: spacing.hairline, marginLeft: inset, backgroundColor: colors.outlineVariant }, style]}
    />
  );
}
