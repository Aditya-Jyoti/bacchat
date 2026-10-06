/**
 * Lock screen (no k-id). Shown over the app when app lock is on: cold start and after a minute in
 * the background. Calm: a quiet mark, one line, one button. No countdowns, no alarm colours.
 */
import React from 'react';
import { Text, View } from 'react-native';
import { Button } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Glyph } from '../../components/Glyph';
import { t } from '../../lib/i18n';
import { useTheme } from '../../theme';

export type LockScreenProps = {
  onUnlock: () => void;
  /** The last try did not go through. Shows a gentle line and "Try again". */
  failed?: boolean;
  busy?: boolean;
};

export default function LockScreen({ onUnlock, failed = false, busy = false }: LockScreenProps): React.JSX.Element {
  const { colors, typography } = useTheme();
  return (
    <SafeAreaView testID="lock-screen" edges={['top', 'bottom']} style={{ flex: 1, backgroundColor: colors.surface }}>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 }}>
        <View
          accessibilityLabel={t('lockUi.mark')}
          style={{ width: 132, height: 132, borderRadius: 66, backgroundColor: colors.primaryContainer, alignItems: 'center', justifyContent: 'center' }}
        >
          <Glyph name="lock" size={56} color={colors.onPrimaryContainer} />
        </View>
        <Text accessibilityRole="header" style={[typography.headlineSmall, { color: colors.onSurface, marginTop: 28, textAlign: 'center' }]}>
          {t('lockUi.title')}
        </Text>
        <Text style={[typography.bodyLarge, { color: colors.onSurfaceVariant, marginTop: 8, textAlign: 'center' }]}>{t('lockUi.body')}</Text>
        {failed ? (
          <Text testID="lock-failed" style={[typography.bodyMedium, { color: colors.onSurfaceVariant, marginTop: 16, textAlign: 'center' }]}>
            {t('lockUi.failed')}
          </Text>
        ) : null}
      </View>
      <View style={{ paddingHorizontal: 24, paddingBottom: 40 }}>
        <Button testID="lock-unlock" mode="contained" disabled={busy} onPress={onUnlock} contentStyle={{ height: 52 }}>
          {failed ? t('lockUi.tryAgain') : t('lockUi.unlock')}
        </Button>
      </View>
    </SafeAreaView>
  );
}
