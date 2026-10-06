/** k14: New goal. Icon picker, name, target, date, already saved, linked monthly slider, funding chips, Create goal. */
import React, { useState } from 'react';
import { Text, View, type TextStyle } from 'react-native';

import { FilterChip } from '../../components/FilterChip';
import { NumberStepper } from '../../components/NumberStepper';
import { OutlinedField } from '../../components/OutlinedField';
import { PillButton } from '../../components/PillButton';
import { StackScreen } from '../../components/StackScreen';
import { ValueSlider } from '../../components/ValueSlider';
import { formatRupees, groupIndian } from '../../lib/format';
import { useTheme } from '../../theme';
import { useScreenNav } from '../shared/useScreenNav';
import { IconPicker } from './sections/IconPicker';
import {
  FREE_BASE,
  MONTHLY_MAX,
  MONTHLY_MIN,
  MONTHLY_STEP,
  dateLong,
  dateShort,
  monthlyFor,
  monthsFor,
} from './sections/goalPlan';
import { useGoals, type GoalAlloc } from './goalsStore';

const ACCOUNTS = [
  { name: 'HDFC Savings', icon: 'account_balance', color: 'p' },
  { name: 'SBI Salary', icon: 'account_balance', color: 'k2' },
  { name: 'Cash', icon: 'payments', color: 'k3' },
] as const;

const digits = (s: string): string => s.replace(/[^0-9]/g, '').slice(0, 9);
const num = (s: string): number => (s ? parseInt(s, 10) : 0);
const group = (s: string): string => (s ? groupIndian(String(num(s))) : '');

export default function K14_NewGoal(): React.JSX.Element {
  const { colors, typography } = useTheme();
  const nav = useScreenNav();
  const addGoal = useGoals((s) => s.addGoal);
  const [icon, setIcon] = useState('beach_access');
  const [name, setName] = useState('Goa with friends');
  const [target, setTarget] = useState('60000');
  const [saved, setSaved] = useState('38000');
  const [monthly, setMonthly] = useState(5500);
  const [months, setMonths] = useState(2);
  const [from, setFrom] = useState<string[]>(['HDFC Savings', 'SBI Salary']);
  const valid = name.trim().length > 0 && num(target) > 0;
  const label: TextStyle = { ...typography.labelSmall, color: colors.onSurfaceVariant, fontWeight: '600', letterSpacing: 0.4, marginTop: 18, marginBottom: 8 };

  const create = () => {
    const picked = ACCOUNTS.filter((a) => from.includes(a.name));
    const accts = picked.length ? picked : [ACCOUNTS[0]];
    const total = num(saved) * 100;
    const each = Math.floor(total / accts.length / 100) * 100;
    const allocations: GoalAlloc[] = accts.map((a, i) => ({
      from: a.name,
      icon: a.icon,
      color: a.color,
      paise: each + (i === 0 ? total - each * accts.length : 0),
    }));
    const id = addGoal({
      name: name.trim(),
      icon,
      savedPaise: total,
      targetPaise: num(target) * 100,
      by: `by ${dateShort(months)}`,
      allocations,
    });
    nav.go('k13', { id });
  };

  return (
    <StackScreen
      testID="screen-k14"
      title="New goal"
      leading="close"
      onLeading={nav.back}
      footer={<PillButton testID="create-goal" label="Create goal" height={52} disabled={!valid} onPress={create} style={{ width: '100%' }} />}
    >
      <Text style={label}>PICK AN ICON</Text>
      <IconPicker value={icon} onChange={setIcon} />
      <View style={{ gap: 16, marginTop: 22 }}>
        <OutlinedField testID="goal-name" label="What are you saving for?" value={name} onChangeText={setName} />
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <View style={{ flex: 1 }}>
            <OutlinedField
              testID="goal-target"
              label="Target"
              prefix={'\u20B9'}
              keyboardType="number-pad"
              value={group(target)}
              onChangeText={(t) => setTarget(digits(t))}
            />
          </View>
          <View style={{ flex: 1 }}>
            <OutlinedField testID="goal-date" label="By" leadingIcon="calendar_today" value={dateLong(months)} onPress={() => setMonths((m) => Math.min(60, m + 1))} />
          </View>
        </View>
        <OutlinedField
          testID="goal-saved"
          label="Already saved"
          prefix={'\u20B9'}
          keyboardType="number-pad"
          value={group(saved)}
          onChangeText={(t) => setSaved(digits(t))}
          helper="Optional. Counted from today."
        />
      </View>
      <Text style={label}>SET ASIDE EACH MONTH</Text>
      <View style={{ paddingTop: 22 }}>
        <ValueSlider
          testID="monthly-slider"
          label="Set aside each month"
          min={MONTHLY_MIN}
          max={MONTHLY_MAX}
          step={MONTHLY_STEP}
          value={monthly}
          bubble={formatRupees(monthly * 100)}
          valueText={formatRupees(monthly * 100)}
          onChange={(v) => {
            setMonthly(v);
            setMonths(monthsFor(num(target), num(saved), v));
          }}
        />
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text style={[typography.bodySmall, { color: colors.onSurfaceVariant }]}>{formatRupees(MONTHLY_MIN * 100)}</Text>
        <Text style={[typography.bodySmall, { color: colors.onSurfaceVariant }]}>{formatRupees(MONTHLY_MAX * 100)}</Text>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
        <Text style={[typography.bodyMedium, { color: colors.onSurface }]}>Months to go</Text>
        <NumberStepper
          label="Months to go"
          value={months}
          min={1}
          max={60}
          onChange={(n) => {
            setMonths(n);
            setMonthly(monthlyFor(num(target), num(saved), n));
          }}
        />
      </View>
      <Text testID="plan-line" style={[typography.bodyMedium, { color: colors.onSurface, marginTop: 8 }]}>
        {'That gets you there by '}
        <Text style={{ fontWeight: '700' }}>{dateShort(months)}</Text>
        {`, with ${formatRupees((FREE_BASE - monthly) * 100)} a month still free.`}
      </Text>
      <Text style={label}>TAKE IT FROM</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {ACCOUNTS.map((a) => (
          <FilterChip
            key={a.name}
            testID={`from-${a.name}`}
            label={a.name === 'Cash' ? 'Cash' : a.name}
            selected={from.includes(a.name)}
            onPress={() => setFrom((f) => (f.includes(a.name) ? f.filter((x) => x !== a.name) : [...f, a.name]))}
          />
        ))}
      </View>
    </StackScreen>
  );
}
