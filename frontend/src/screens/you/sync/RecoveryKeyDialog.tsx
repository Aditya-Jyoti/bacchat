/** Shows the recovery key once, right after setup. Without a key it explains where the key is. */
import React from 'react';
import { Text } from 'react-native';
import { Button, Dialog, Portal } from 'react-native-paper';

import { t } from '../../../lib/i18n';
import { useTheme } from '../../../theme';

export type RecoveryKeyDialogProps = { visible: boolean; recoveryKey: string | null; onClose: () => void };

export function RecoveryKeyDialog({ visible, recoveryKey, onClose }: RecoveryKeyDialogProps): React.JSX.Element {
  const { colors, typography } = useTheme();
  return (
    <Portal>
      <Dialog visible={visible} onDismiss={onClose} style={{ borderRadius: 28 }}>
        <Dialog.Title>{recoveryKey ? t('syncUi.recoveryShowTitle') : t('syncUi.recoveryTitle')}</Dialog.Title>
        <Dialog.Content>
          <Text style={[typography.bodyMedium, { color: colors.onSurfaceVariant }]}>
            {recoveryKey ? t('syncUi.recoveryShowBody') : t('syncUi.recoveryBody')}
          </Text>
          {recoveryKey ? (
            <Text
              testID="recovery-key-value"
              selectable
              accessibilityLabel={recoveryKey}
              style={[typography.titleMedium, { color: colors.onSurface, paddingTop: 14, fontSize: 18, lineHeight: 28 }]}
            >
              {recoveryKey}
            </Text>
          ) : null}
        </Dialog.Content>
        <Dialog.Actions>
          <Button testID="recovery-close" onPress={onClose}>
            {recoveryKey ? t('syncUi.recoveryWrote') : t('syncUi.done')}
          </Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}
