/** k16: add a named budget ("Fun", "Food", "Tech") with a monthly amount. Spends are tagged with it in k5. */
import React, { useState } from 'react';
import { View } from 'react-native';
import { Button, Dialog, Portal } from 'react-native-paper';

import { OutlinedField } from '../../../components/OutlinedField';
import { groupIndian } from '../../../lib/format';
import { t } from '../../../lib/i18n';

export type NewBudgetDialogProps = {
  visible: boolean;
  /** Names already used (case-insensitive), so two budgets are never called the same. */
  taken: readonly string[];
  onAdd: (name: string, monthlyPaise: number) => void;
  onClose: () => void;
};

const digits = (s: string): string => s.replace(/[^0-9]/g, '').slice(0, 9);

export function NewBudgetDialog({ visible, taken, onAdd, onClose }: NewBudgetDialogProps): React.JSX.Element {
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const clash = taken.some((n) => n.trim().toLowerCase() === name.trim().toLowerCase());
  const ok = name.trim().length > 0 && !clash && parseInt(amount || '0', 10) > 0;
  const close = (): void => {
    setName('');
    setAmount('');
    onClose();
  };
  return (
    <Portal>
      <Dialog visible={visible} onDismiss={close} style={{ borderRadius: 28 }} testID="new-budget-dialog">
        <Dialog.Title>{t('budgetUi.newBudget')}</Dialog.Title>
        <Dialog.Content>
          <View style={{ gap: 12 }}>
            <OutlinedField testID="new-budget-name" label={t('budgetUi.budgetName')} value={name} onChangeText={setName} error={clash ? t('budgetUi.nameTaken') : undefined} />
            <OutlinedField
              testID="new-budget-amount"
              label={t('budgetUi.perMonth')}
              prefix={'₹'}
              keyboardType="number-pad"
              value={amount ? groupIndian(String(parseInt(amount, 10))) : ''}
              onChangeText={(v) => setAmount(digits(v))}
            />
          </View>
        </Dialog.Content>
        <Dialog.Actions>
          <Button testID="new-budget-cancel" onPress={close}>{t('common.cancel')}</Button>
          <Button
            testID="new-budget-add"
            disabled={!ok}
            onPress={() => {
              onAdd(name.trim(), parseInt(amount, 10) * 100);
              setName('');
              setAmount('');
            }}
          >
            {t('budgetUi.add')}
          </Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}
