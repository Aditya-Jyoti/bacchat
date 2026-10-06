import React from 'react';
import { Text, View } from 'react-native';

import { CategoryIcon } from '../../../components/CategoryIcon';
import {
  BeachChairIllustration,
  ChaiIllustration,
  CoinIllustration,
  EmptyAccounts,
  EmptyBudget,
  EmptyEntries,
  EmptyGoals,
  EmptySearch,
  EmptyUpcoming,
  GoalReached,
  KhataIllustration,
  SyncDone,
  TiffinIllustration,
} from '../../../components/illustrations';
import { customIconNames } from '../../../components/icons';
import { useTheme } from '../../../theme';
import { GalleryCard } from './GalleryFrame';
import { t } from '../../../lib/i18n';

/** Every line illustration, two to a row, each with its design name. */
export function IllustrationsCard(): React.JSX.Element {
  const { colors, typography } = useTheme();
  const { onSurface } = colors;
  const items: [string, React.ReactNode][] = [
    ['Chai', <ChaiIllustration key="chai" ink={onSurface} blob={colors.primaryContainer} width={160} height={120} />],
    ['Tiffin', <TiffinIllustration key="tiffin" height={100} />],
    ['Coin', <CoinIllustration key="coin" height={100} />],
    ['Khata', <KhataIllustration key="khata" height={100} />],
    ['EmptyEntries', <EmptyEntries key="ee" height={100} />],
    ['EmptyGoals', <EmptyGoals key="eg" height={100} />],
    ['EmptyBudget', <EmptyBudget key="eb" height={100} />],
    ['EmptyAccounts', <EmptyAccounts key="ea" height={100} />],
    ['EmptySearch', <EmptySearch key="es" height={100} />],
    ['EmptyUpcoming', <EmptyUpcoming key="eu" height={100} />],
    ['GoalReached', <GoalReached key="gr" height={100} />],
    ['SyncDone', <SyncDone key="sd" height={100} />],
    ['BeachChair', <BeachChairIllustration key="bc" height={100} />],
  ];
  return (
    <GalleryCard title={t('artUi.galleryIllustrations')} caption={t('artUi.galleryIllustrationsNote')}>
      <View testID="gallery-illustrations" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {items.map(([name, node]) => (
          <View key={name} style={{ width: '48%' }}>
            {node}
            <Text style={[typography.labelSmall, { color: colors.onSurfaceVariant }]}>{name}</Text>
          </View>
        ))}
      </View>
    </GalleryCard>
  );
}

/** The custom India icon set, plain and selected, in the 40 circle. */
export function IndiaIconsCard(): React.JSX.Element {
  const { colors, typography } = useTheme();
  return (
    <GalleryCard title={t('artUi.galleryIcons')} caption={t('artUi.galleryIconsNote')}>
      <View testID="gallery-india-icons" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
        {customIconNames.map((n, i) => (
          <View key={n} style={{ alignItems: 'center', width: 64, gap: 4 }}>
            <CategoryIcon name={n} selected={i % 5 === 0} />
            <Text numberOfLines={1} style={[typography.labelSmall, { color: colors.onSurfaceVariant }]}>{n.replace(/_/g, ' ')}</Text>
          </View>
        ))}
      </View>
    </GalleryCard>
  );
}
