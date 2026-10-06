import React from 'react';
import { Text, View } from 'react-native';

import { Amount } from '../../../components/Amount';
import { Hairline } from '../../../components/Hairline';
import { ListRow } from '../../../components/ListRow';
import { SectionHeader } from '../../../components/SectionHeader';
import { byMethod, merchants } from '../../../data';
import { useTheme } from '../../../theme';
import { S } from '../parts/strings';
import { Icon } from '../parts/ui';

/** "Paid with" rows: icon, name, share bar in chart2, amount. */
export function MethodSection(): React.JSX.Element {
  const { colors, typography, spacing } = useTheme();
  return (
    <View>
      <SectionHeader title={S.paidWith} />
      {byMethod.map((b) => (
        <View key={b.name} testID={`method-${b.name}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 36, paddingVertical: 5 }}>
          <Icon name={b.icon} size={18} color={colors.onSurfaceVariant} />
          <Text style={[typography.bodyMedium, { color: colors.onSurface, width: 96 }]}>{b.name}</Text>
          <View style={{ flex: 1, height: 6, borderRadius: 3, backgroundColor: colors.surfaceContainerHigh }}>
            <View style={{ width: b.w as `${number}%`, height: 6, borderRadius: 3, backgroundColor: colors.chart2 }} />
          </View>
          <Text style={[typography.labelLarge, { color: colors.onSurface, minWidth: 62, textAlign: 'right', marginLeft: spacing.xs }]}>{b.amount.text}</Text>
        </View>
      ))}
    </View>
  );
}

/** Top merchants: icon, name, number of times, total. */
export function MerchantSection(): React.JSX.Element {
  return (
    <View>
      <SectionHeader title={S.topMerchants} />
      {merchants.map((m) => (
        <View key={m.name}>
          <ListRow title={m.name} subtitle={m.timesText} icon={m.icon} trailing={<Amount paise={m.amount.paise} />} />
          <Hairline />
        </View>
      ))}
    </View>
  );
}
