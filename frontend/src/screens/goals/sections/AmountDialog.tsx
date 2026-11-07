/** Small dialog asking how much to set aside for a goal, or take out of it (k13). */
import React, { useState } from 'react';
import { Text } from 'react-native';
import { Button, Dialog, Portal } from 'react-native-paper';

import { OutlinedField } from '../../../components/OutlinedField';
import { formatRupees, groupIndian } from '../../../lib/format';
import { t } from '../../../lib/i18n';
import { useTheme } from '../../../theme';

export type AmountDialogProps = {
  visible: boolean;
  title: string;
  /** The most that can be entered, in paise (what is saved, for Take out). Null for no limit. */
  maxPaise: number | null;
  confirmLabel: string;
  onConfirm: (paise: number) => void;
  onClose: () => void;
  testID?: string;
};

const digits = (s: string): string => s.replace(/[^0-9]/g, '').slice(0, 9);

export function AmountDialog({ visible, title, maxPaise, confirmLabel, onConfirm, onClose, testID = 'amount-dialog' }: AmountDialogProps): React.JSX.Element {
  const { colors, typography } = useTheme();
  const [value, setValue] = useState('');
  const paise = value ? parseInt(value, 10) * 100 : 0;
  const tooMuch = maxPaise != null && paise > maxPaise;
  const close = (): void => {
    setValue('');
    onClose();
  };
  return (
    <Portal>
      <Dialog visible={visible} onDismiss={close} style={{ borderRadius: 28 }} testID={testID}>
        <Dialog.Title>{title}</Dialog.Title>
        <Dialog.Content>
          <OutlinedField
            testID={`${testID}-amount`}
            label={t('goalsUi.amount')}
            prefix={'₹'}
            keyboardType="number-pad"
            value={value ? groupIndian(String(parseInt(value, 10))) : ''}
            onChangeText={(v) => setValue(digits(v))}
            error={tooMuch ? t('goalsUi.atMost', { amount: formatRupees(maxPaise ?? 0) }) : undefined}
          />
          {maxPaise != null && !tooMuch ? (
            <Text style={[typography.bodySmall, { color: colors.onSurfaceVariant, paddingTop: 6 }]}>
              {t('goalsUi.upTo', { amount: formatRupees(maxPaise) })}
            </Text>
          ) : null}
        </Dialog.Content>
        <Dialog.Actions>
          <Button testID={`${testID}-cancel`} onPress={close}>{t('common.cancel')}</Button>
          <Button
            testID={`${testID}-ok`}
            disabled={paise <= 0 || tooMuch}
            onPress={() => {
              setValue('');
              onConfirm(paise);
            }}
          >
            {confirmLabel}
          </Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}
