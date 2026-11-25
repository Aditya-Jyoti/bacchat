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
import { METHOD_ICON, type AccountShare, type MerchantTotal } from './summaryData';


export function timesText(n: number): string {
  return n === 1 ? t('moneyLive.once') : t('moneyLive.times', { n });
}

/** "Paid from" rows: the account's icon and name, a share bar in chart2, the amount. */
export function MethodSection({ accounts, lookups }: { accounts: readonly AccountShare[]; lookups: Lookups }): React.JSX.Element | null {
  const { colors, typography, spacing } = useTheme();
  if (accounts.length === 0) return null;
  return (
    <View>
      <SectionHeader title={S.paidWith} hint={t('moneyLive.paidWithHint')} />
      {accounts.map((b) => {
        const acct = b.accountId ? lookups.accounts.get(b.accountId) : undefined;
        const name = acct?.name ?? (b.method === 'cash' ? t('moneyLive.cash') : t('moneyLive.noAccount'));
        return (
          <View key={b.accountId ?? b.method} testID={`method-${name}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 36, paddingVertical: 5 }}>
            <Icon name={acct?.icon ?? METHOD_ICON[b.method]} size={18} color={colors.onSurfaceVariant} />
            <Text numberOfLines={1} style={[typography.bodyMedium, { color: colors.onSurface, width: 110 }]}>{name}</Text>
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
      <SectionHeader title={S.topMerchants} hint={t('moneyLive.merchantsHint')} />
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
