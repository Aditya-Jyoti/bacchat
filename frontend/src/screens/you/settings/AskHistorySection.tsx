/** k24: keep Ask history on this phone (separate from syncing it). Off by default. */
import React from 'react';
import { Switch } from 'react-native-paper';

import { t } from '../../../lib/i18n';
import { usePreferences } from '../../../lib/preferences';
import { YouRow } from '../parts/YouRow';

export function AskHistorySection(): React.JSX.Element {
  const on = usePreferences((s) => s.askHistoryLocal);
  const set = usePreferences((s) => s.setAskHistoryLocal);
  const title = t('moreUi.askHistoryTitle');
  return (
    <YouRow
      testID="settings-row-ask-history"
      icon="history"
      title={title}
      subtitle={t('moreUi.askHistorySub')}
      trailing={<Switch testID="settings-switch-ask-history" value={on} onValueChange={set} accessibilityLabel={title} />}
    />
  );
}
