/**
 * k24: AI engine. Pick where AI runs (off, your own key, this phone, or auto), the provider and its
 * settings, consent for message text, per-feature overrides, and the on-device model manager.
 * Keys go to the secure store and are never shown again.
 */
import React, { useEffect, useState } from 'react';
import { Switch, Text, View } from 'react-native';
import { Button, Chip, SegmentedButtons, TextInput } from 'react-native-paper';

import {
  FEATURE_GROUPS,
  OPENAI_COMPATIBLE_PRESETS,
  consentKey,
  useAiPreferences,
  type AiFeatureGroup,
  type AiMode,
  type CloudProviderId,
} from '../../../lib/ai';
import { t } from '../../../lib/i18n';
import { useServices } from '../../../services';
import { hostOf } from '../../../services/aiService';
import { useTheme } from '../../../theme';
import { GroupCaption, YouRow } from '../parts/YouRow';
import { AiModelsSection } from './AiModelsSection';

const MODES: { value: AiMode; label: string }[] = [
  { value: 'off', label: 'aiUi.modeOff' },
  { value: 'cloud', label: 'aiUi.modeCloud' },
  { value: 'device', label: 'aiUi.modeDevice' },
  { value: 'auto', label: 'aiUi.modeAuto' },
];
const LONG: Record<AiMode, string> = { off: 'aiUi.modeOffLong', cloud: 'aiUi.modeCloudLong', device: 'aiUi.modeDeviceLong', auto: 'aiUi.modeAutoLong' };
const SUMMARY: Record<AiMode, string> = { off: 'aiUi.summaryOff', cloud: 'aiUi.summaryCloud', device: 'aiUi.summaryDevice', auto: 'aiUi.summaryAuto' };
const FEATURE_TITLE: Record<AiFeatureGroup, string> = { advisor: 'aiUi.featAdvisor', ingestion: 'aiUi.featIngestion', categorise: 'aiUi.featCategorise' };
const CHIP_LABEL: Record<AiMode, string> = { off: 'aiUi.modeOff', cloud: 'aiUi.modeCloud', device: 'aiUi.overridePhone', auto: 'aiUi.modeAuto' };

const validUrl = (u: string): boolean => /^https?:\/\/[^\s/]+/i.test(u.trim());

export function AiSection(): React.JSX.Element {
  const { colors, typography } = useTheme();
  const { ai } = useServices();
  const mode = useAiPreferences((s) => s.aiMode);
  const overrides = useAiPreferences((s) => s.aiFeatureModes);
  const provider = useAiPreferences((s) => s.aiCloudProvider);
  const baseUrl = useAiPreferences((s) => s.aiOpenAiBaseUrl);
  const savedModel = useAiPreferences((s) => s.aiOpenAiModel);
  const consent = useAiPreferences((s) => s.aiConsent);
  const skippedAt = useAiPreferences((s) => s.aiConsentSkippedAt);
  const prefs = useAiPreferences.getState();

  const [url, setUrl] = useState(baseUrl);
  const [model, setModel] = useState(savedModel);
  const [key, setKey] = useState('');
  const [hasKey, setHasKey] = useState<boolean | null>(null);
  const [showKey, setShowKey] = useState(false);

  useEffect(() => {
    let alive = true;
    void ai.hasOpenAiKey().then((k) => alive && setHasKey(k));
    return () => {
      alive = false;
    };
  }, [ai]);

  const cloudish = mode === 'cloud' || mode === 'auto' || Object.values(overrides).some((m) => m === 'cloud' || m === 'auto');
  const consentGiven = consent[consentKey(provider, baseUrl)] != null;
  const providerName = provider === 'anthropic' ? t('aiUi.providerAnthropic') : hostOf(baseUrl) || t('aiUi.providerOpenAi');
  const urlOk = validUrl(url);
  const local = /^(?:localhost|127\.|10\.|192\.168\.|172\.(?:1[6-9]|2\d|3[01])\.|.*\.local$)/i.test(hostOf(url));
  const note = [typography.bodySmall, { color: colors.onSurfaceVariant, paddingTop: 4 }];

  const saveEndpoint = (): void => {
    if (!urlOk) return;
    prefs.setOpenAi({ baseUrl: url.trim().replace(/\/+$/, ''), model: model.trim() || savedModel });
  };
  const saveKey = async (): Promise<void> => {
    if (!key.trim()) return;
    await ai.setOpenAiKey(key);
    setKey('');
    setShowKey(false);
    setHasKey(true);
  };
  const removeKey = async (): Promise<void> => {
    await ai.setOpenAiKey(null);
    setHasKey(false);
  };

  return (
    <View testID="settings-ai">
      <GroupCaption>{t('aiUi.caption')}</GroupCaption>
      <Text style={[typography.bodySmall, { color: colors.onSurfaceVariant, paddingBottom: 6 }]}>{t('aiUi.modeLabel')}</Text>
      <SegmentedButtons
        value={mode}
        onValueChange={(v) => prefs.setAiMode(v as AiMode)}
        buttons={MODES.map((m) => ({ value: m.value, label: t(m.label), testID: `ai-mode-${m.value}`, accessibilityLabel: t(LONG[m.value]), showSelectedCheck: false }))}
      />
      <View testID="ai-summary" style={{ paddingTop: 10 }}>
        <Text style={[typography.labelMedium, { color: colors.onSurface }]}>{t('aiUi.summaryTitle')}</Text>
        <Text style={note}>{t(SUMMARY[mode])}</Text>
      </View>

      {cloudish ? (
        <View testID="ai-cloud" style={{ paddingTop: 12 }}>
          <Text style={[typography.bodySmall, { color: colors.onSurfaceVariant, paddingBottom: 6 }]}>{t('aiUi.providerLabel')}</Text>
          <SegmentedButtons
            value={provider}
            onValueChange={(v) => prefs.setCloudProvider(v as CloudProviderId)}
            buttons={[
              { value: 'anthropic', label: t('aiUi.providerAnthropic'), testID: 'ai-provider-anthropic', showSelectedCheck: false },
              { value: 'openai', label: t('aiUi.providerOpenAi'), testID: 'ai-provider-openai', showSelectedCheck: false },
            ]}
          />
          {provider === 'anthropic' ? (
            <Text testID="ai-anthropic-note" style={note}>{t('aiUi.anthropicNote')}</Text>
          ) : (
            <View testID="ai-openai" style={{ gap: 8, paddingTop: 8 }}>
              <Text style={[typography.bodySmall, { color: colors.onSurfaceVariant }]}>{t('aiUi.presetCaption')}</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {OPENAI_COMPATIBLE_PRESETS.map((p) => (
                  <Chip
                    key={p.id}
                    testID={`ai-preset-${p.id}`}
                    compact={false}
                    onPress={() => {
                      setUrl(p.baseUrl);
                      setModel(p.model);
                    }}
                  >
                    {p.label}
                  </Chip>
                ))}
              </View>
              <TextInput testID="ai-base-url" mode="outlined" label={t('aiUi.baseUrlLabel')} value={url} onChangeText={setUrl} autoCapitalize="none" autoCorrect={false} keyboardType="url" error={!!url && !urlOk} />
              <Text style={note}>{!url || urlOk ? t('aiUi.baseUrlHelp') : t('aiUi.baseUrlBad')}</Text>
              <TextInput testID="ai-openai-model" mode="outlined" label={t('aiUi.modelLabel')} value={model} onChangeText={setModel} autoCapitalize="none" autoCorrect={false} />
              <View style={{ flexDirection: 'row' }}>
                <Button testID="ai-endpoint-save" mode="outlined" disabled={!urlOk} contentStyle={{ height: 48 }} style={{ borderColor: colors.outline }} onPress={saveEndpoint}>
                  {t('aiUi.save')}
                </Button>
              </View>
              <Text testID="ai-openai-key-status" style={note}>{hasKey ? t('aiUi.keySaved') : local ? t('aiUi.keyOptionalLocal') : t('aiUi.keyNone')}</Text>
              <TextInput
                testID="ai-openai-key"
                mode="outlined"
                label={t('aiUi.keyLabel')}
                value={key}
                onChangeText={setKey}
                secureTextEntry={!showKey}
                autoCapitalize="none"
                autoCorrect={false}
                left={<TextInput.Icon icon="key" />}
                right={<TextInput.Icon icon={showKey ? 'eye-off' : 'eye'} onPress={() => setShowKey((s) => !s)} accessibilityLabel={showKey ? t('settingsUi.apiKeyHide') : t('settingsUi.apiKeyShow')} />}
              />
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <Button testID="ai-openai-key-save" mode="contained" disabled={!key.trim()} contentStyle={{ height: 48 }} onPress={() => void saveKey()}>
                  {t('aiUi.save')}
                </Button>
                {hasKey ? (
                  <Button testID="ai-openai-key-remove" mode="outlined" contentStyle={{ height: 48 }} style={{ borderColor: colors.outline }} onPress={() => void removeKey()}>
                    {t('aiUi.removeKey')}
                  </Button>
                ) : null}
              </View>
            </View>
          )}

          <YouRow
            testID="ai-consent-row"
            icon="shield"
            title={t('aiUi.consentTitle')}
            subtitle={consentGiven ? t('aiUi.consentOn', { provider: providerName }) : t('aiUi.consentOff')}
            trailing={
              <Switch
                testID="ai-consent-switch"
                value={consentGiven}
                onValueChange={(v) => (v ? ai.grantConsent() : ai.revokeConsent())}
                accessibilityLabel={t('aiUi.consentTitle')}
                trackColor={{ true: colors.primary, false: colors.surfaceContainerHigh }}
                thumbColor={colors.surface}
              />
            }
          />
          <Text testID="ai-consent-disclosure" style={note}>{t('aiUi.consentDisclosure')}</Text>
          {!consentGiven ? <Text testID="ai-consent-first" style={note}>{t('aiUi.consentFirstUse')}</Text> : null}
          {!consentGiven && skippedAt != null ? <Text testID="ai-consent-skipped" style={note}>{t('aiUi.consentSkipped')}</Text> : null}
        </View>
      ) : null}

      <GroupCaption>{t('aiUi.overridesCaption')}</GroupCaption>
      <Text style={[typography.bodySmall, { color: colors.onSurfaceVariant }]}>{t('aiUi.overridesHelp')}</Text>
      {FEATURE_GROUPS.map((f) => {
        const current = overrides[f] ?? null;
        return (
          <View key={f} testID={`ai-override-${f}`} style={{ paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.outlineVariant, gap: 6 }}>
            <Text style={[typography.bodyLarge, { fontSize: 15, color: colors.onSurface }]}>{t(FEATURE_TITLE[f])}</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              <Chip testID={`ai-override-${f}-inherit`} selected={current == null} showSelectedCheck onPress={() => prefs.setFeatureMode(f, null)}>
                {t('aiUi.inherit')}
              </Chip>
              {(['off', 'cloud', 'device', 'auto'] as AiMode[]).map((m) => (
                <Chip key={m} testID={`ai-override-${f}-${m}`} selected={current === m} showSelectedCheck onPress={() => prefs.setFeatureMode(f, m)}>
                  {t(CHIP_LABEL[m])}
                </Chip>
              ))}
            </View>
          </View>
        );
      })}

      <AiModelsSection />
    </View>
  );
}
