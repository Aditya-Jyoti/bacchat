import React from 'react';
import { Text, View } from 'react-native';

import { Amount } from '../../../components/Amount';
import { Hairline } from '../../../components/Hairline';
import { ListRow } from '../../../components/ListRow';
import { SectionHeader } from '../../../components/SectionHeader';
import type { Entry } from '../../../data/db';
import { formatDateShort, formatRupees } from '../../../lib/format';
import { t } from '../../../lib/i18n';
import { useTheme } from '../../../theme';
import type { Lookups } from '../parts/live';

/**
 * Where the month's money really went: one line splitting everyday spending from the few big
 * one-offs, then the largest single spends with their category and day, so a big month reads at a
 * glance ("a flight and a hospital bill") instead of as one large number.
 */
export function BiggestSection({
  biggest,
  oneOffPaise,
  oneOffCount,
  everydayPaise,
  lookups,
}: {
  biggest: readonly Entry[];
  oneOffPaise: number;
  oneOffCount: number;
  everydayPaise: number;
  lookups: Lookups;
}): React.JSX.Element | null {
  const { colors, typography, spacing } = useTheme();
  if (biggest.length === 0) return null;
  return (
    <View testID="biggest-section">
      <SectionHeader title={t('moneyLive.biggestTitle')} hint={t('moneyLive.biggestHint')} />
      <Text testID="biggest-split" style={[typography.bodyMedium, { color: colors.onSurfaceVariant, marginBottom: spacing.sm }]}>
        {oneOffCount > 0
          ? t(oneOffCount === 1 ? 'moneyLive.splitOne' : 'moneyLive.splitMany', {
              everyday: formatRupees(everydayPaise),
              big: formatRupees(oneOffPaise),
              n: oneOffCount,
            })
          : t('moneyLive.splitNone', { everyday: formatRupees(everydayPaise) })}
      </Text>
      {biggest.map((e) => {
        const cat = e.categoryId ? lookups.cats.get(e.categoryId) : undefined;
        const sub = `${formatDateShort(e.at)} · ${cat?.name ?? t('moneyLive.noCategory')}`;
        return (
          <View key={e.id}>
            <ListRow title={e.merchant} subtitle={sub} icon={cat?.icon ?? 'help'} trailing={<Amount paise={e.amountPaise} />} />
            <Hairline />
          </View>
        );
      })}
    </View>
  );
}
