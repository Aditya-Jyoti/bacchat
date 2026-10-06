/** k24: sync server address. Empty means Bacchat Cloud. */
import React, { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { Button, TextInput } from 'react-native-paper';

import { t } from '../../../lib/i18n';
import { useServices } from '../../../services';
import { useTheme } from '../../../theme';
import { GroupCaption } from '../parts/YouRow';
import { DEFAULT_CLOUD_URL, getServerUrl, setServerUrl } from '../sync/server';

export function ServerSection(): React.JSX.Element {
  const { colors, typography } = useTheme();
  const { secure } = useServices();
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    let alive = true;
    void getServerUrl(secure).then((u) => alive && setUrl(u === DEFAULT_CLOUD_URL ? '' : u));
    return () => {
      alive = false;
    };
  }, [secure]);

  const save = async (): Promise<void> => {
    const ok = await setServerUrl(secure, url);
    setError(ok ? '' : t('settingsUi.serverBad'));
    if (ok) setDirty(false);
  };

  return (
    <View testID="settings-server">
      <GroupCaption>{t('settingsUi.serverCaption')}</GroupCaption>
      <TextInput
        testID="server-url"
        mode="outlined"
        label={t('settingsUi.serverLabel')}
        placeholder={DEFAULT_CLOUD_URL}
        value={url}
        onChangeText={(v) => {
          setUrl(v);
          setDirty(true);
          setError('');
        }}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
        left={<TextInput.Icon icon="dns" />}
      />
      <Text style={[typography.bodySmall, { color: colors.onSurfaceVariant, paddingHorizontal: 16, paddingTop: 4 }]}>
        {error || t('settingsUi.serverHelp')}
      </Text>
      <View style={{ flexDirection: 'row', paddingTop: 8 }}>
        <Button testID="server-save" mode="outlined" disabled={!dirty} contentStyle={{ height: 48 }} style={{ borderColor: colors.outline }} onPress={() => void save()}>
          {t('settingsUi.serverSave')}
        </Button>
      </View>
    </View>
  );
}
