/** Phase A: shows the one-use pairing code for a new phone. */
import React from 'react';
import { Text } from 'react-native';
import { Button, Dialog, Portal } from 'react-native-paper';

import { t } from '../../../lib/i18n';
import { useTheme } from '../../../theme';

export type PairingDialogProps = { visible: boolean; code: string | null; error: string; onClose: () => void };

export function PairingDialog({ visible, code, error, onClose }: PairingDialogProps): React.JSX.Element {
  const { colors, typography } = useTheme();
  return (
    <Portal>
      <Dialog visible={visible} onDismiss={onClose} style={{ borderRadius: 28 }}>
        <Dialog.Title>{t('syncUi.pairingTitle')}</Dialog.Title>
        <Dialog.Content>
          {error ? (
            <Text testID="pairing-error" style={[typography.bodyMedium, { color: colors.onSurfaceVariant }]}>{error}</Text>
          ) : (
            <>
              <Text style={[typography.bodyMedium, { color: colors.onSurfaceVariant }]}>{t('syncUi.pairingBody')}</Text>
              {code ? (
                <Text testID="pairing-code" selectable accessibilityLabel={code} style={[typography.displayMedium, { color: colors.onSurface, paddingTop: 14, fontSize: 32, lineHeight: 40 }]}>
                  {code}
                </Text>
              ) : (
                <Text style={[typography.bodyMedium, { color: colors.onSurfaceVariant, paddingTop: 10 }]}>{t('syncUi.working')}</Text>
              )}
            </>
          )}
        </Dialog.Content>
        <Dialog.Actions>
          <Button testID="pairing-close" onPress={onClose}>{t('syncUi.done')}</Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}
