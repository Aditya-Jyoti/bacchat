import React from 'react';
import { Text, View } from 'react-native';

import type { UpiItem } from '../../../data';
import { useTheme } from '../../../theme';
import { t } from '../../../lib/i18n';

/** One UPI ID: id and bank, then came-in and went-out bars (primary and chart2) with amounts. */
export function UpiRow({ item }: { item: UpiItem }): React.JSX.Element {
  const { colors, typography } = useTheme();
  const bar = (label: string, amount: string, w: string, color: string) => (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={`${label} ${amount}`}
      accessibilityValue={{ min: 0, max: 100, now: parseFloat(w) }}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 }}
    >
      <Text style={[typography.labelSmall, { width: 52, color: colors.onSurfaceVariant }]}>{label}</Text>
      <View style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: colors.surfaceContainerHigh }}>
        <View style={{ width: w as `${number}%`, height: 4, borderRadius: 2, backgroundColor: color }} />
      </View>
      <Text style={[typography.labelMedium, { width: 72, textAlign: 'right', color: colors.onSurface }]}>{amount}</Text>
    </View>
  );
  return (
    <View testID={`upi-${item.id}`} style={{ paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: colors.outlineVariant }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text style={[typography.bodyMedium, { color: colors.onSurface }]}>{item.id}</Text>
        <Text style={[typography.bodySmall, { color: colors.onSurfaceVariant }]}>{item.bank}</Text>
      </View>
      {bar(t('accountsUi.cameIn'), item.inn.text, item.inW, colors.primary)}
      {bar(t('accountsUi.wentOut'), item.out.text, item.outW, colors.chart2)}
    </View>
  );
}
