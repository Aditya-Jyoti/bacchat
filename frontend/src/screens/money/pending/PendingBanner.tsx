/** A calm note on Entries (k4) when messages wait for a pick. Hidden when there is nothing waiting. */
import React from 'react';
import { View } from 'react-native';

import { Banner } from '../../../components/Banner';
import { t } from '../../../lib/i18n';
import { PendingConflictsSheet } from './PendingConflictsSheet';
import { usePendingConflicts } from './usePendingConflicts';

export function PendingBanner(): React.JSX.Element | null {
  const { items } = usePendingConflicts();
  const [open, setOpen] = React.useState(false);
  if (items.length === 0 && !open) return null;
  return (
    <View testID="pending-banner-wrap" style={{ marginTop: 12 }}>
      {items.length > 0 ? (
        <Banner testID="pending-banner" variant="insight" icon="help" actionLabel={t('moreUi.pendingBannerAction')} onAction={() => setOpen(true)}>
          {t('moreUi.pendingBanner', { n: items.length })}
        </Banner>
      ) : null}
      <PendingConflictsSheet visible={open} onClose={() => setOpen(false)} />
    </View>
  );
}
