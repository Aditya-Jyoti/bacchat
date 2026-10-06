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
    bank: { title: 'Bank', options: BANKS as readonly string[], value: bank, set: setBank },
    bill: { title: 'Bill made on', options: DAYS, value: bill, set: setBill },
    due: { title: 'Due on', options: DAYS, value: due, set: setDue },
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
      title="Add account"
      leading="close"
      onLeading={nav.back}
      footer={
        <PillButton
          testID="add-account-submit"
          label={isCard ? 'Add card' : 'Add account'}
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
          Just a name and a balance. No bank login, ever.
        </Text>
      </View>
      <Text style={label}>TYPE</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {ACCOUNT_TYPES.map((tp) => (
          <FilterChip key={tp.id} testID={`type-${tp.id}`} label={tp.label} icon={tp.icon} keepIcon selected={type === tp.id} onPress={() => setType(tp.id)} />
        ))}
      </View>
      <View style={{ gap: 16, marginTop: 20 }}>
        <OutlinedField testID="acct-name" label="Name" value={name} onChangeText={setName} />
        {hasBank ? (
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <View style={{ flex: 1.4 }}>
              <OutlinedField testID="acct-bank" label="Bank" dropdown value={bank} onPress={() => setPicking('bank')} />
            </View>
            <View style={{ flex: 1 }}>
              <OutlinedField
                testID="acct-last4"
                label="Last 4 digits"
                keyboardType="number-pad"
                maxLength={4}
                value={last4}
                onChangeText={(x) => setLast4(digits(x, 4))}
                error={last4Bad ? 'Enter 4 digits' : undefined}
              />
            </View>
          </View>
        ) : null}
        <View style={{ flexDirection: 'row', gap: 12 }}>
          {isCard ? money('acct-limit', 'Credit limit', limit, setLimit) : null}
          {money('acct-owed', BALANCE_LABEL[type], owed, setOwed)}
        </View>
        {isCard || type === 'loan' ? (
          <Text style={[typography.bodySmall, { color: colors.onSurfaceVariant, marginTop: -10, paddingHorizontal: 4 }]}>
            {'\u201COwed today\u201D is counted as debt and taken off your net worth.'}
          </Text>
        ) : null}
        {isCard ? (
          <>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <View style={{ flex: 1 }}>
                <OutlinedField testID="acct-bill" label="Bill made on" dropdown value={bill} onPress={() => setPicking('bill')} />
              </View>
              <View style={{ flex: 1 }}>
                <OutlinedField testID="acct-due" label="Due on" dropdown value={due} onPress={() => setPicking('due')} />
              </View>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Glyph name="notifications" size={22} color={colors.onSurfaceVariant} />
              <Text style={[typography.bodyLarge, { flex: 1, fontSize: 15, color: colors.onSurface }]}>Remind me 3 days before</Text>
              <Switch testID="remind-switch" accessibilityLabel="Remind me 3 days before" value={remind} onValueChange={setRemind} />
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
