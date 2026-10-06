import React from 'react';
import { Text, type StyleProp, type TextStyle } from 'react-native';

import { formatRupees, formatRupeesCompact } from '../lib/format';
import { useTheme } from '../theme';

export type AmountProps = {
  /** Magnitude in integer paise. The sign is ignored: spends never show a minus. */
  paise: number;
  /** Income shows in primary with a "+". Spends use onSurface. */
  income?: boolean;
  compact?: boolean;
  /** Typography token, default labelLarge (tabular figures). */
  variant?: 'labelLarge' | 'bodyLarge' | 'titleMedium' | 'headlineSmall' | 'displayMedium';
  style?: StyleProp<TextStyle>;
};

export function Amount({ paise, income = false, compact = false, variant = 'labelLarge', style }: AmountProps): React.JSX.Element {
  const { colors, typography } = useTheme();
  const mag = Math.abs(paise);
  const body = compact ? formatRupeesCompact(mag, { symbol: true }) : formatRupees(mag);
  const text = income ? `+${body}` : body;
  return (
    <Text
      testID="amount"
      style={[typography[variant], { color: income ? colors.primary : colors.onSurface, fontVariant: ['tabular-nums'] }, style]}
    >
      {text}
    </Text>
  );
}
