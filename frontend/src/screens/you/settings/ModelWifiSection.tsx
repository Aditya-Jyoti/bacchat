/** k24: on-device model downloads only on Wi-Fi. Honoured by the download manager through the network probe. */
import React from 'react';
import { Switch } from 'react-native-paper';

import { useAiPreferences } from '../../../lib/ai';
import { t } from '../../../lib/i18n';
import { YouRow } from '../parts/YouRow';

export function ModelWifiSection(): React.JSX.Element {
  const on = useAiPreferences((s) => s.aiModelsWifiOnly);
  const set = useAiPreferences((s) => s.setModelsWifiOnly);
  const title = t('moreUi.wifiTitle');
  return (
    <YouRow
      testID="settings-row-model-wifi"
      icon="wifi"
      title={title}
      subtitle={t('moreUi.wifiSub')}
      trailing={<Switch testID="settings-switch-model-wifi" value={on} onValueChange={set} accessibilityLabel={title} />}
    />
  );
}
