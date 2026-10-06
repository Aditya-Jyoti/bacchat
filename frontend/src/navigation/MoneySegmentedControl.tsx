import { StackActions, useNavigation } from '@react-navigation/native';
import React, { useEffect } from 'react';
import { SegmentedButtons } from 'react-native-paper';

import { t } from '../lib/i18n';
import { ROUTES } from './screenManifest';
import { useMoneySegment, type MoneySegment } from './moneySegment';

/**
 * Summary / Entries switch for the Money tab (k3 and k4). Embed it at the top of both screens.
 * It records the current segment so Money reopens where you left it.
 */
export function MoneySegmentedControl({ current }: { current: MoneySegment }): React.JSX.Element {
  const navigation = useNavigation();
  const setLast = useMoneySegment((s) => s.setLast);

  useEffect(() => {
    setLast(current);
  }, [current, setLast]);

  return (
    <SegmentedButtons
      value={current}
      onValueChange={(v) => {
        if (v === current) return;
        navigation.dispatch(StackActions.replace(v === 'entries' ? ROUTES.k4 : ROUTES.k3));
      }}
      buttons={[
        { value: 'summary', label: t('money.summary'), testID: 'segment-summary' },
        { value: 'entries', label: t('money.entries'), testID: 'segment-entries' },
      ]}
    />
  );
}
