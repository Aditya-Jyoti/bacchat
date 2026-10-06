/** k24: the name shown on Home and in You. */
import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { Button, TextInput } from 'react-native-paper';

import { t } from '../../../lib/i18n';
import { usePreferences } from '../../../lib/preferences';
import { useTheme } from '../../../theme';

export function NameSection(): React.JSX.Element {
  const { colors, typography } = useTheme();
  const stored = usePreferences((s) => s.profileName);
  const setProfileName = usePreferences((s) => s.setProfileName);
  const [name, setName] = useState(stored);
  return (
    <View testID="settings-name">
      <TextInput
        testID="profile-name"
        mode="outlined"
        label={t('youUi.nameLabel')}
        value={name}
        onChangeText={setName}
        maxLength={40}
        left={<TextInput.Icon icon="account" />}
      />
      <Text style={[typography.bodySmall, { color: colors.onSurfaceVariant, paddingHorizontal: 16, paddingTop: 4 }]}>{t('youUi.nameHelp')}</Text>
      <View style={{ flexDirection: 'row', paddingTop: 8 }}>
        <Button testID="profile-name-save" mode="outlined" disabled={name.trim() === stored} contentStyle={{ height: 48 }} style={{ borderColor: colors.outline }} onPress={() => setProfileName(name)}>
          {t('common.save')}
        </Button>
      </View>
    </View>
  );
}
