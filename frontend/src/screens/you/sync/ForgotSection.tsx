/** Linked phone: forgot the passphrase. The recovery key opens the keyring, then a new passphrase wraps it. */
import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { Button, TextInput } from 'react-native-paper';

import { t } from '../../../lib/i18n';
import type { SyncHandle } from '../../../services';
import { useTheme } from '../../../theme';
import { MIN_PASSPHRASE, recoverPassphrase, setupErrorText } from './actions';
import { useSyncDeps } from './deps';

export function ForgotSection({ getHandle }: { getHandle: () => Promise<SyncHandle | null> }): React.JSX.Element {
  const { colors, typography } = useTheme();
  const deps = useSyncDeps();
  const [key, setKey] = useState('');
  const [pass, setPass] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const ready = key.trim().length > 0 && pass.length >= MIN_PASSPHRASE;

  const go = async (): Promise<void> => {
    if (!ready || busy) return;
    setBusy(true);
    setError('');
    try {
      const handle = await getHandle();
      if (!handle) throw new Error('no sync');
      await recoverPassphrase(handle, deps, key, pass);
      setKey('');
      setPass('');
      setDone(true);
    } catch (e) {
      setError(setupErrorText(e, 'syncUi.joinFailed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View testID="forgot-section" style={{ gap: 10 }}>
      <Text style={[typography.labelLarge, { color: colors.onSurface }]}>{t('syncUi.forgot')}</Text>
      <Text style={[typography.bodySmall, { color: colors.onSurfaceVariant }]}>{t('syncUi.forgotSub')}</Text>
      <TextInput testID="forgot-key" mode="outlined" label={t('syncUi.forgotKey')} value={key} onChangeText={(v) => { setKey(v); setDone(false); }} autoCapitalize="characters" autoCorrect={false} />
      <TextInput testID="forgot-new" mode="outlined" label={t('syncUi.forgotNew')} value={pass} onChangeText={(v) => { setPass(v); setDone(false); }} secureTextEntry autoCapitalize="none" autoCorrect={false} />
      {error ? <Text testID="forgot-error" style={[typography.bodySmall, { color: colors.onSurfaceVariant }]}>{error}</Text> : null}
      {done ? <Text testID="forgot-done" style={[typography.bodySmall, { color: colors.primary }]}>{t('syncUi.forgotDone')}</Text> : null}
      <Button testID="forgot-go" mode="outlined" disabled={!ready || busy} style={{ borderColor: colors.outline }} contentStyle={{ height: 48 }} onPress={() => void go()}>
        {busy ? t('syncUi.working') : t('syncUi.forgotGo')}
      </Button>
    </View>
  );
}
