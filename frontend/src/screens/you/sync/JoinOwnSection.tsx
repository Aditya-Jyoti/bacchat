/** New phone on Google Drive, WebDAV or S3: connect to the backup already stored there with its passphrase. */
import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { Button, TextInput } from 'react-native-paper';

import { t } from '../../../lib/i18n';
import { useServices } from '../../../services';
import { useTheme } from '../../../theme';
import { joinOwnTarget, setupErrorText, type WhereDraft } from './actions';
import { useSyncDeps } from './deps';

export function JoinOwnSection({ draft, onJoined }: { draft: Exclude<WhereDraft, { where: 'cloud' }> | null; onJoined: () => void }): React.JSX.Element {
  const { colors, typography } = useTheme();
  const services = useServices();
  const deps = useSyncDeps();
  const [pass, setPass] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const go = async (): Promise<void> => {
    if (!draft || !pass || busy) return;
    setBusy(true);
    setError('');
    try {
      await joinOwnTarget(services, deps, draft, { secret: { passphrase: pass } });
      setPass('');
      onJoined();
    } catch (e) {
      setError(setupErrorText(e, 'syncUi.joinFailed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View testID="join-own-section" style={{ gap: 10 }}>
      <Text style={[typography.labelLarge, { color: colors.onSurface }]}>{t('syncUi.joinOwnTitle')}</Text>
      <Text style={[typography.bodySmall, { color: colors.onSurfaceVariant }]}>{t('syncUi.joinOwnSub')}</Text>
      <TextInput testID="join-own-pass" mode="outlined" label={t('syncUi.joinPass')} value={pass} onChangeText={setPass} secureTextEntry autoCapitalize="none" autoCorrect={false} />
      {!draft ? <Text style={[typography.bodySmall, { color: colors.onSurfaceVariant }]}>{t('syncUi.ownMissing')}</Text> : null}
      {error ? <Text testID="join-own-error" style={[typography.bodySmall, { color: colors.onSurfaceVariant }]}>{error}</Text> : null}
      <Button testID="join-own-go" mode="contained" disabled={!draft || !pass || busy} contentStyle={{ height: 48 }} onPress={() => void go()}>
        {busy ? t('syncUi.working') : t('syncUi.joinOwnGo')}
      </Button>
    </View>
  );
}
