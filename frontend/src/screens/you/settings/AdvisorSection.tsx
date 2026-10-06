/** k24: AI advisor key and model. The key goes to the secure store and is never shown again. */
import React, { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { Button, TextInput } from 'react-native-paper';

import { t } from '../../../lib/i18n';
import { useServices } from '../../../services';
import { useTheme } from '../../../theme';
import { GroupCaption } from '../parts/YouRow';

export function AdvisorSection(): React.JSX.Element {
  const { colors, typography } = useTheme();
  const { settings } = useServices();
  const [saved, setSaved] = useState<boolean | null>(null);
  const [key, setKey] = useState('');
  const [show, setShow] = useState(false);
  const [model, setModel] = useState('');
  const [modelDirty, setModelDirty] = useState(false);

  useEffect(() => {
    let alive = true;
    void settings.getApiKey().then((k) => alive && setSaved(!!k));
    void settings.getModel().then((m) => alive && setModel(m));
    return () => {
      alive = false;
    };
  }, [settings]);

  const saveKey = async (): Promise<void> => {
    if (!key.trim()) return;
    await settings.setApiKey(key);
    setKey('');
    setShow(false);
    setSaved(true);
  };
  const removeKey = async (): Promise<void> => {
    await settings.setApiKey(null);
    setKey('');
    setSaved(false);
  };
  const saveModel = async (): Promise<void> => {
    await settings.setModel(model);
    setModel(await settings.getModel());
    setModelDirty(false);
  };

  return (
    <View testID="settings-advisor">
      <GroupCaption>{t('settingsUi.advisorCaption')}</GroupCaption>
      <Text testID="advisor-key-status" style={[typography.bodySmall, { color: colors.onSurfaceVariant, paddingBottom: 6 }]}>
        {saved ? t('settingsUi.apiKeySaved') : t('settingsUi.apiKeyNone')}
      </Text>
      <TextInput
        testID="advisor-key"
        mode="outlined"
        label={t('settingsUi.apiKeyLabel')}
        value={key}
        onChangeText={setKey}
        secureTextEntry={!show}
        autoCapitalize="none"
        autoCorrect={false}
        left={<TextInput.Icon icon="key" />}
        right={
          <TextInput.Icon
            icon={show ? 'eye-off' : 'eye'}
            onPress={() => setShow((s) => !s)}
            accessibilityLabel={show ? t('settingsUi.apiKeyHide') : t('settingsUi.apiKeyShow')}
          />
        }
      />
      <Text style={[typography.bodySmall, { color: colors.onSurfaceVariant, paddingHorizontal: 16, paddingTop: 4 }]}>{t('settingsUi.apiKeyHelp')}</Text>
      <View style={{ flexDirection: 'row', gap: 8, paddingTop: 8 }}>
        <Button testID="advisor-key-save" mode="contained" disabled={!key.trim()} contentStyle={{ height: 48 }} onPress={() => void saveKey()}>
          {t('settingsUi.apiKeySave')}
        </Button>
        {saved ? (
          <Button testID="advisor-key-remove" mode="outlined" contentStyle={{ height: 48 }} style={{ borderColor: colors.outline }} onPress={() => void removeKey()}>
            {t('settingsUi.apiKeyRemove')}
          </Button>
        ) : null}
      </View>
      <TextInput
        testID="advisor-model"
        mode="outlined"
        label={t('settingsUi.modelLabel')}
        value={model}
        onChangeText={(v) => {
          setModel(v);
          setModelDirty(true);
        }}
        autoCapitalize="none"
        autoCorrect={false}
        style={{ marginTop: 12 }}
      />
      <View style={{ flexDirection: 'row', paddingTop: 8 }}>
        <Button testID="advisor-model-save" mode="outlined" disabled={!modelDirty} contentStyle={{ height: 48 }} style={{ borderColor: colors.outline }} onPress={() => void saveModel()}>
          {t('settingsUi.modelSave')}
        </Button>
      </View>
      <Text style={[typography.bodySmall, { color: colors.onSurfaceVariant, paddingTop: 8 }]}>{t('settingsUi.advisorPrivacy')}</Text>
    </View>
  );
}
