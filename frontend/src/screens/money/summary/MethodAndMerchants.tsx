import React from 'react';
import { Text, View } from 'react-native';

import { Amount } from '../../../components/Amount';
import { Hairline } from '../../../components/Hairline';
import { ListRow } from '../../../components/ListRow';
import { SectionHeader } from '../../../components/SectionHeader';
import { t } from '../../../lib/i18n';
import { useTheme } from '../../../theme';
import { formatRupees } from '../../../lib/format';
import type { Lookups } from '../parts/live';
import { S } from '../parts/strings';
import { Icon } from '../parts/ui';
import { METHOD_ICON, type MerchantTotal, type MethodShare } from './summaryData';

const METHOD_KEY = { card: 'methodCard', upi: 'methodUpi', debit: 'methodDebit', cash: 'methodCash', bank: 'methodBank' } as const;

export function timesText(n: number): string {
  return n === 1 ? t('moneyLive.once') : t('moneyLive.times', { n });
}

/** "Paid with" rows: icon, name, share bar in chart2, amount. */
export function MethodSection({ methods }: { methods: readonly MethodShare[] }): React.JSX.Element | null {
  const { colors, typography, spacing } = useTheme();
  if (methods.length === 0) return null;
  return (
    <View>
      <SectionHeader title={S.paidWith} />
      {methods.map((b) => {
        const name = t(`moneyLive.${METHOD_KEY[b.method]}`);
        return (
          <View key={b.method} testID={`method-${name}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 36, paddingVertical: 5 }}>
            <Icon name={METHOD_ICON[b.method]} size={18} color={colors.onSurfaceVariant} />
            <Text style={[typography.bodyMedium, { color: colors.onSurface, width: 96 }]}>{name}</Text>
            <View style={{ flex: 1, height: 6, borderRadius: 3, backgroundColor: colors.surfaceContainerHigh }}>
              <View style={{ width: `${b.percent}%`, height: 6, borderRadius: 3, backgroundColor: colors.chart2 }} />
            </View>
            <Text style={[typography.labelLarge, { color: colors.onSurface, minWidth: 62, textAlign: 'right', marginLeft: spacing.xs }]}>{formatRupees(b.paise)}</Text>
          </View>
        );
      })}
    </View>
  );
}

/** Top merchants: icon, name, number of times, total. */
export function MerchantSection({ merchants, lookups }: { merchants: readonly MerchantTotal[]; lookups: Lookups }): React.JSX.Element | null {
  if (merchants.length === 0) return null;
  return (
    <View>
      <SectionHeader title={S.topMerchants} />
      {merchants.map((m) => (
        <View key={m.name}>
          <ListRow
            title={m.name}
            subtitle={timesText(m.count)}
            icon={(m.categoryId ? lookups.cats.get(m.categoryId)?.icon : undefined) ?? 'storefront'}
            trailing={<Amount paise={m.paise} />}
          />
          <Hairline />
        </View>
      ))}
    </View>
  );
}
