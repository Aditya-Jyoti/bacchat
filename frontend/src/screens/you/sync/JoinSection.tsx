/** New phone: join an existing backup with a pairing code, using the passphrase or the recovery key. */
import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Button, TextInput } from 'react-native-paper';

import { t } from '../../../lib/i18n';
import { useServices } from '../../../services';
import { useTheme } from '../../../theme';
import { joinWithCode, MIN_PASSPHRASE, setupErrorText } from './actions';
import { useSyncDeps } from './deps';

export function JoinSection({ onJoined }: { onJoined: () => void }): React.JSX.Element {
  const { colors, typography } = useTheme();
  const services = useServices();
  const deps = useSyncDeps();
  const [code, setCode] = useState('');
  const [pass, setPass] = useState('');
  const [recovery, setRecovery] = useState(false);
  const [recoveryKey, setRecoveryKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const ready = code.trim().length > 0 && (recovery ? recoveryKey.trim().length > 0 && pass.length >= MIN_PASSPHRASE : pass.length > 0);

  const join = async (): Promise<void> => {
    if (!ready || busy) return;
    setBusy(true);
    setError('');
    try {
      await joinWithCode(services, deps, {
        code,
        secret: recovery ? { recoveryKey: recoveryKey.trim() } : { passphrase: pass },
        newPassphrase: recovery ? pass : undefined,
      });
      setPass('');
      setRecoveryKey('');
      setCode('');
      onJoined();
    } catch (e) {
      setError(setupErrorText(e, 'syncUi.joinFailed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View testID="join-section" style={{ gap: 10 }}>
      <Text style={[typography.labelLarge, { color: colors.onSurface }]}>{t('syncUi.joinTitle')}</Text>
      <Text style={[typography.bodySmall, { color: colors.onSurfaceVariant }]}>{t('syncUi.joinSub')}</Text>
      <TextInput testID="join-code" mode="outlined" label={t('syncUi.joinCode')} value={code} onChangeText={setCode} autoCapitalize="characters" autoCorrect={false} />
      {recovery ? (
        <TextInput testID="join-recovery" mode="outlined" label={t('syncUi.forgotKey')} value={recoveryKey} onChangeText={setRecoveryKey} autoCapitalize="characters" autoCorrect={false} />
      ) : null}
      <TextInput
        testID="join-pass"
        mode="outlined"
        label={recovery ? t('syncUi.forgotNew') : t('syncUi.joinPass')}
        value={pass}
        onChangeText={setPass}
        secureTextEntry
        autoCapitalize="none"
        autoCorrect={false}
      />
      {error ? <Text testID="join-error" style={[typography.bodySmall, { color: colors.onSurfaceVariant }]}>{error}</Text> : null}
      <Button testID="join-go" mode="contained" disabled={!ready || busy} contentStyle={{ height: 48 }} onPress={() => void join()}>
        {busy ? t('syncUi.working') : t('syncUi.joinGo')}
      </Button>
      <Pressable
        testID="join-forgot"
        accessibilityRole="button"
        onPress={() => {
          setRecovery((v) => !v);
          setPass('');
          setError('');
        }}
        style={{ minHeight: 48, justifyContent: 'center' }}
      >
        <Text style={[typography.labelLarge, { color: colors.primary }]}>{t('syncUi.forgot')}</Text>
      </Pressable>
    </View>
  );
}
