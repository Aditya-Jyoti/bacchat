/**
 * k24 (AI group): "Read screenshots with AI". Off by default. When on, a screenshot imported in k7 is
 * shrunk and sent to the owner's cloud model to be read; on-phone text recognition stays the
 * fallback. On an OpenAI-compatible endpoint a separate, cheaper vision model can be named.
 */
import React from 'react';
import { Switch, Text, View } from 'react-native';

import { useAiPreferences } from '../../../lib/ai';
import { t } from '../../../lib/i18n';
import { useTheme } from '../../../theme';
import { YouRow } from '../parts/YouRow';

export function ScreenshotAiSection(): React.JSX.Element {
  const { colors, typography } = useTheme();
  const on = useAiPreferences((s) => s.aiScreenshotRead);
  const setOn = useAiPreferences((s) => s.setScreenshotRead);
  const mode = useAiPreferences((s) => s.aiMode);
  const note = [typography.bodySmall, { color: colors.onSurfaceVariant, paddingTop: 4 }];
  const title = t('aiUi.shotTitle');
  return (
    <View testID="settings-shot-ai" style={{ paddingTop: 8 }}>
      <YouRow
        testID="settings-row-shot-ai"
        icon="document_scanner"
        title={title}
        subtitle={on ? t('aiUi.shotOn') : t('aiUi.shotOff')}
        trailing={<Switch testID="settings-switch-shot-ai" value={on} onValueChange={setOn} accessibilityLabel={title} />}
      />
      <Text testID="shot-ai-disclosure" style={note}>{t('aiUi.shotDisclosure')}</Text>
      {on && mode === 'off' ? <Text testID="shot-ai-mode" style={note}>{t('aiUi.shotNeedsCloud')}</Text> : null}
      {on ? <Text style={note}>{t('aiUi.shotSameModel')}</Text> : null}
    </View>
  );
}
