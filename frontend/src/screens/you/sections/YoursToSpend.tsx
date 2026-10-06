import React from 'react';
import { Text, View } from 'react-native';

import { formatRupees } from '../../../lib/format';
import { useTheme } from '../../../theme';

export type YoursToSpendProps = { banksPaise: number; duesPaise: number };

/** Everyday version of net worth: banks and cash minus card dues. Surface container block, 16dp radius. */
export function YoursToSpend({ banksPaise, duesPaise }: YoursToSpendProps): React.JSX.Element {
  const { colors, typography, shapes } = useTheme();
  const dotRow = (color: string, label: string, value: string) => (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />
        <Text style={[typography.bodyMedium, { fontSize: 13, color: colors.onSurface }]}>{label}</Text>
      </View>
      <Text style={[typography.bodyMedium, { fontSize: 13, color: colors.onSurface }]}>{value}</Text>
    </View>
  );
  const share = Math.max(0, Math.min(1, (banksPaise - duesPaise) / banksPaise));
  return (
    <View testID="yours-to-spend" style={{ marginTop: 14, padding: 14, borderRadius: shapes.card, backgroundColor: colors.surfaceContainer, gap: 10 }}>
      <Text style={[typography.labelMedium, { color: colors.onSurfaceVariant, fontWeight: '600' }]}>MONEY YOU CAN ACTUALLY SPEND</Text>
      <View
        accessible
        accessibilityRole="image"
        accessibilityLabel={`${formatRupees(banksPaise - duesPaise)} of ${formatRupees(banksPaise)} is yours to spend`}
        style={{ flexDirection: 'row', gap: 3, height: 10 }}
      >
        <View style={{ flex: share, borderRadius: 5, backgroundColor: colors.primary }} />
        <View style={{ flex: 1 - share, borderRadius: 5, backgroundColor: colors.chart3 }} />
      </View>
      <View style={{ gap: 4 }}>
        {dotRow(colors.primary, 'Banks + cash', formatRupees(banksPaise))}
        {dotRow(colors.chart3, 'Card dues', `\u2212 ${formatRupees(duesPaise)}`)}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: colors.outlineVariant, paddingTop: 6 }}>
          <Text style={[typography.labelLarge, { fontWeight: '700', color: colors.onSurface }]}>Yours to spend</Text>
          <Text testID="yours-to-spend-amount" style={[typography.labelLarge, { fontWeight: '700', color: colors.onSurface }]}>
            {formatRupees(banksPaise - duesPaise)}
          </Text>
        </View>
      </View>
    </View>
  );
}
