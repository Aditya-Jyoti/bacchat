/** k24: language (English or Hindi) and the name shown on Home. Changing the language re-renders the app in place. */
import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { Button, SegmentedButtons, TextInput } from 'react-native-paper';

import { t, type Locale } from '../../../lib/i18n';
import { usePreferences } from '../../../lib/preferences';
import { useTheme } from '../../../theme';
import { GroupCaption } from '../parts/YouRow';

export function LanguageSection(): React.JSX.Element {
  const { colors, typography } = useTheme();
  const locale = usePreferences((s) => s.locale);
  const setLocale = usePreferences((s) => s.setLocale);
  const stored = usePreferences((s) => s.profileName);
  const setProfileName = usePreferences((s) => s.setProfileName);
  const [name, setName] = useState(stored);
  return (
    <View testID="settings-language">
      <GroupCaption>{t('settingsUi.language')}</GroupCaption>
      <View style={{ paddingTop: 4, paddingBottom: 10 }}>
        <SegmentedButtons
          value={locale}
          onValueChange={(v) => setLocale(v as Locale)}
          buttons={[
            { value: 'en', label: t('settingsUi.languageEnglish'), testID: 'language-en', showSelectedCheck: true, accessibilityLabel: t('settingsUi.languageEnglish') },
            { value: 'hi', label: t('settingsUi.languageHindi'), testID: 'language-hi', showSelectedCheck: true, accessibilityLabel: t('settingsUi.languageHindi') },
          ]}
        />
      </View>
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
