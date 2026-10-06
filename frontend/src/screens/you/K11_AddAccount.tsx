/** k11: Add account. Type chips, then the field set for that type; credit card reveals limit, dues and dates. */
import React, { useState } from 'react';
import { Text, View, type TextStyle } from 'react-native';
import { Switch } from 'react-native-paper';

import { FilterChip } from '../../components/FilterChip';
import { Glyph } from '../../components/Glyph';
import { OptionPicker } from '../../components/OptionPicker';
import { OutlinedField } from '../../components/OutlinedField';
import { PillButton } from '../../components/PillButton';
import { StackScreen } from '../../components/StackScreen';
import { groupIndian } from '../../lib/format';
import { useTheme } from '../../theme';
import { useScreenNav } from '../shared/useScreenNav';
import { ACCOUNT_TYPES, BALANCE_LABEL, BANKS, DAYS, type AccountType } from './sections/accountTypes';
import { t } from '../../lib/i18n';

const RUPEE = '\u20B9';
const digits = (s: string, max = 9): string => s.replace(/[^0-9]/g, '').slice(0, max);
const group = (s: string): string => (s ? groupIndian(String(parseInt(s, 10))) : '');
type Picking = 'bank' | 'bill' | 'due' | null;

export default function K11_AddAccount(): React.JSX.Element {
  const { colors, typography } = useTheme();
  const nav = useScreenNav();
  const [type, setType] = useState<AccountType>('card');
  const [name, setName] = useState('HDFC Millennia');
  const [bank, setBank] = useState('HDFC Bank');
  const [last4, setLast4] = useState('44');
  const [limit, setLimit] = useState('100000');
  const [owed, setOwed] = useState('5180');
  const [bill, setBill] = useState('18th');
  const [due, setDue] = useState('5th');
  const [remind, setRemind] = useState(true);
  const [picking, setPicking] = useState<Picking>(null);
  const isCard = type === 'card';
  const hasBank = type === 'bank' || isCard;
  const last4Bad = hasBank && last4.length !== 4;
  const label: TextStyle = { ...typography.labelSmall, color: colors.onSurfaceVariant, fontWeight: '600', letterSpacing: 0.4, marginTop: 18, marginBottom: 8 };
  const picker = {
    bank: { title: t('accountsUi.bank'), options: BANKS as readonly string[], value: bank, set: setBank },
    bill: { title: t('accountsUi.billOn'), options: DAYS, value: bill, set: setBill },
    due: { title: t('accountsUi.dueOn'), options: DAYS, value: due, set: setDue },
  };
  const cur = picking ? picker[picking] : null;
  const money = (id: string, text: string, v: string, set: (s: string) => void) => (
    <View style={{ flex: 1 }}>
      <OutlinedField testID={id} label={text} prefix={RUPEE} keyboardType="number-pad" value={group(v)} onChangeText={(x) => set(digits(x))} />
    </View>
  );
  return (
    <StackScreen
      testID="screen-k11"
      title={t('accountsUi.addAccount')}
      leading="close"
      onLeading={nav.back}
      footer={
        <PillButton
          testID="add-account-submit"
          label={isCard ? t('accountsUi.addCard') : t('accountsUi.addAccount')}
          height={52}
          disabled={name.trim().length === 0 || last4Bad}
          onPress={() => nav.go('k10')}
          style={{ width: '100%' }}
        />
      }
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Glyph name="lock" size={16} color={colors.onSurfaceVariant} />
        <Text style={[typography.bodyMedium, { fontSize: 13, color: colors.onSurfaceVariant, flex: 1 }]}>
          {t('accountsUi.justName')}
        </Text>
      </View>
      <Text style={label}>{t('accountsUi.type_')}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {ACCOUNT_TYPES.map((tp) => (
          <FilterChip key={tp.id} testID={`type-${tp.id}`} label={tp.label} icon={tp.icon} keepIcon selected={type === tp.id} onPress={() => setType(tp.id)} />
        ))}
      </View>
      <View style={{ gap: 16, marginTop: 20 }}>
        <OutlinedField testID="acct-name" label={t('accountsUi.name')} value={name} onChangeText={setName} />
        {hasBank ? (
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <View style={{ flex: 1.4 }}>
              <OutlinedField testID="acct-bank" label={t('accountsUi.bank')} dropdown value={bank} onPress={() => setPicking('bank')} />
            </View>
            <View style={{ flex: 1 }}>
              <OutlinedField
                testID="acct-last4"
                label={t('accountsUi.last4')}
                keyboardType="number-pad"
                maxLength={4}
                value={last4}
                onChangeText={(x) => setLast4(digits(x, 4))}
                error={last4Bad ? t('accountsUi.enter4') : undefined}
              />
            </View>
          </View>
        ) : null}
        <View style={{ flexDirection: 'row', gap: 12 }}>
          {isCard ? money('acct-limit', t('accountsUi.creditLimit'), limit, setLimit) : null}
          {money('acct-owed', BALANCE_LABEL[type], owed, setOwed)}
        </View>
        {isCard || type === 'loan' ? (
          <Text style={[typography.bodySmall, { color: colors.onSurfaceVariant, marginTop: -10, paddingHorizontal: 4 }]}>
            {t('accountsUi.owedNote')}
          </Text>
        ) : null}
        {isCard ? (
          <>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <View style={{ flex: 1 }}>
                <OutlinedField testID="acct-bill" label={t('accountsUi.billOn')} dropdown value={bill} onPress={() => setPicking('bill')} />
              </View>
              <View style={{ flex: 1 }}>
                <OutlinedField testID="acct-due" label={t('accountsUi.dueOn')} dropdown value={due} onPress={() => setPicking('due')} />
              </View>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Glyph name="notifications" size={22} color={colors.onSurfaceVariant} />
              <Text style={[typography.bodyLarge, { flex: 1, fontSize: 15, color: colors.onSurface }]}>{t('accountsUi.remind')}</Text>
              <Switch testID="remind-switch" accessibilityLabel={t('accountsUi.remind')} value={remind} onValueChange={setRemind} />
            </View>
          </>
        ) : null}
      </View>
      <OptionPicker
        visible={picking !== null}
        title={cur?.title ?? ''}
        options={cur?.options ?? []}
        value={cur?.value ?? ''}
        onSelect={(o) => {
          cur?.set(o);
          setPicking(null);
        }}
        onClose={() => setPicking(null)}
      />
    </StackScreen>
  );
}
