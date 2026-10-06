/** k24: where NPS prices come from. Empty means the built-in address. Date placeholders are filled when fetching. */
import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { Button, TextInput } from 'react-native-paper';

import { t } from '../../../lib/i18n';
import { DEFAULT_NPS_URL, isValidNavUrl } from '../../../lib/nav/client';
import { usePreferences } from '../../../lib/preferences';
import { useTheme } from '../../../theme';
import { GroupCaption } from '../parts/YouRow';

export function NpsNavSection(): React.JSX.Element {
  const { colors, typography } = useTheme();
  const saved = usePreferences((s) => s.npsNavUrl);
  const setSaved = usePreferences((s) => s.setNpsNavUrl);
  const [url, setUrl] = useState(saved);
  const [note, setNote] = useState('');
  const dirty = url.trim() !== saved;

  const save = (): void => {
    const v = url.trim();
    if (v && !isValidNavUrl(v)) {
      setNote(t('moreUi.npsBad'));
      return;
    }
    setSaved(v);
    setUrl(v);
    setNote(t('moreUi.npsSaved'));
  };
  const reset = (): void => {
    setSaved('');
    setUrl('');
    setNote(t('moreUi.npsSaved'));
  };

  return (
    <View testID="settings-nps">
      <GroupCaption>{t('moreUi.npsCaption')}</GroupCaption>
      <TextInput
        testID="nps-url"
        mode="outlined"
        label={t('moreUi.npsLabel')}
        placeholder={DEFAULT_NPS_URL}
        value={url}
        onChangeText={(v) => {
          setUrl(v);
          setNote('');
        }}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
        left={<TextInput.Icon icon="link" />}
      />
      <Text testID="nps-help" style={[typography.bodySmall, { color: colors.onSurfaceVariant, paddingHorizontal: 16, paddingTop: 4 }]}>
        {note || t('moreUi.npsHelp')}
      </Text>
      <View style={{ flexDirection: 'row', gap: 8, paddingTop: 8 }}>
        <Button testID="nps-save" mode="outlined" disabled={!dirty} contentStyle={{ height: 48 }} style={{ borderColor: colors.outline }} onPress={save}>
          {t('moreUi.npsSave')}
        </Button>
        <Button testID="nps-reset" mode="text" disabled={!saved && !url} contentStyle={{ height: 48 }} onPress={reset}>
          {t('moreUi.npsReset')}
        </Button>
      </View>
    </View>
  );
}
