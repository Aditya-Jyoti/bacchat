import React from 'react';
import { Text, View } from 'react-native';

import { CategoryIcon } from '../../../components/CategoryIcon';
import { formatRupees } from '../../../lib/format';
import { useTheme } from '../../../theme';

export type BudgetRowProps = { name: string; icon: string; spentPaise: number; limitPaise: number };

/** Category row: icon, name, "spent / limit", 6dp bar. Over budget uses the caution colour. */
export function BudgetRow({ name, icon, spentPaise, limitPaise }: BudgetRowProps): React.JSX.Element {
  const { colors, typography } = useTheme();
  const over = spentPaise > limitPaise;
  const f = Math.min(1, spentPaise / limitPaise);
  return (
    <View
      testID={`budget-row-${name}`}
      accessible
      accessibilityLabel={`${name}, ${formatRupees(spentPaise)} of ${formatRupees(limitPaise)}${over ? ', over budget' : ''}`}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: colors.outlineVariant }}
    >
      <CategoryIcon name={icon} />
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text style={[typography.bodyMedium, { color: colors.onSurface }]}>{name}</Text>
          <Text style={[typography.bodyMedium, { color: colors.onSurfaceVariant }]}>
            <Text style={{ fontWeight: '700', color: colors.onSurface }}>{formatRupees(spentPaise)}</Text>
            {` / ${formatRupees(limitPaise)}`}
          </Text>
        </View>
        <View style={{ height: 6, borderRadius: 3, marginTop: 6, backgroundColor: colors.surfaceContainerHigh }}>
          <View testID={`budget-bar-${name}`} style={{ height: 6, borderRadius: 3, width: `${f * 100}%`, backgroundColor: over ? colors.caution : colors.primary }} />
        </View>
      </View>
    </View>
  );
}
