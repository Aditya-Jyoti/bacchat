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
import { useServices, useWriters } from '../../services';
import { useTheme } from '../../theme';
import { useScreenNav } from '../shared/useScreenNav';
import { IconPicker } from './sections/IconPicker';
import {
  FREE_BASE,
  MONTHLY_MAX,
  MONTHLY_MIN,
  MONTHLY_STEP,
  dateKeyFor,
  dateLong,
  dateShort,
  monthlyFor,
  monthsFor,
} from './sections/goalPlan';
import { createGoal } from './goalWrites';
import { useGoalPlans } from './goalPlanStore';
import { useGoalsData } from './useGoalsData';
import { t } from '../../lib/i18n';

const digits = (s: string): string => s.replace(/[^0-9]/g, '').slice(0, 9);
const num = (s: string): number => (s ? parseInt(s, 10) : 0);
const group = (s: string): string => (s ? groupIndian(String(num(s))) : '');

export default function K14_NewGoal(): React.JSX.Element {
  const { colors, typography } = useTheme();
  const nav = useScreenNav();
  const db = useWriters();
  const { spendAccounts } = useGoalsData();
  const setMonthlyPlan = useGoalPlans((s) => s.setMonthly);
  const [icon, setIcon] = useState('beach_access');
  // The design's example goal is only pre-filled while the sample notebook is showing; a real one starts blank.
  const sample = useServices().isSample();
  const [name, setName] = useState(sample ? 'Goa with friends' : '');
  const [target, setTarget] = useState(sample ? '60000' : '');
  const [saved, setSaved] = useState(sample ? '38000' : '');
  const [monthly, setMonthly] = useState(5500);
  const [months, setMonths] = useState(2);
  // Account ids the user switched on or off. Until they touch it, the first two bank accounts are on.
  const [picked, setPicked] = useState<string[] | null>(null);
  const [saving, setSaving] = useState(false);
  const from = picked ?? spendAccounts.filter((a) => a.kind === 'bank').slice(0, 2).map((a) => a.id);
  const valid = name.trim().length > 0 && num(target) > 0;
  const label: TextStyle = { ...typography.labelSmall, color: colors.onSurfaceVariant, fontWeight: '600', letterSpacing: 0.4, marginTop: 18, marginBottom: 8 };

  const create = async () => {
    if (saving) return;
    setSaving(true);
    const accts = from.length ? from : spendAccounts.slice(0, 1).map((a) => a.id);
    const total = num(saved) * 100;
    const each = Math.floor(total / Math.max(1, accts.length) / 100) * 100;
    const allocations = accts.map((accountId, i) => ({ accountId, paise: each + (i === 0 ? total - each * accts.length : 0) }));
    try {
      const id = await createGoal(db, {
        name: name.trim(),
        icon,
        targetPaise: num(target) * 100,
        targetDate: dateKeyFor(months),
        allocations: accts.length ? allocations : [],
      });
      setMonthlyPlan(id, monthly * 100);
      nav.go('k13', { id });
    } finally {
      setSaving(false);
    }
  };

  return (
    <StackScreen
      testID="screen-k14"
      title={t('goalsUi.newGoal')}
      leading="close"
      onLeading={nav.back}
      footer={<PillButton testID="create-goal" label={t('goalsUi.createGoal')} height={52} disabled={!valid || saving} onPress={() => void create()} style={{ width: '100%' }} />}
    >
      <Text style={label}>{t('goalsUi.pickIcon')}</Text>
      <IconPicker value={icon} onChange={setIcon} />
      <View style={{ gap: 16, marginTop: 22 }}>
        <OutlinedField testID="goal-name" label={t('goalsUi.saveFor')} value={name} onChangeText={setName} />
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <View style={{ flex: 1 }}>
            <OutlinedField
              testID="goal-target"
              label={t('goalsUi.target')}
              prefix={'\u20B9'}
              keyboardType="number-pad"
              value={group(target)}
              onChangeText={(v) => setTarget(digits(v))}
            />
          </View>
          <View style={{ flex: 1 }}>
            <OutlinedField testID="goal-date" label={t('goalsUi.by')} leadingIcon="calendar_today" value={dateLong(months)} onPress={() => setMonths((m) => Math.min(60, m + 1))} />
          </View>
        </View>
        <OutlinedField
          testID="goal-saved"
          label={t('goalsUi.alreadySaved')}
          prefix={'\u20B9'}
          keyboardType="number-pad"
          value={group(saved)}
          onChangeText={(v) => setSaved(digits(v))}
          helper={t('goalsUi.savedHelper')}
        />
      </View>
      <Text style={label}>{t('goalsUi.setAsideMonthly')}</Text>
      <View style={{ paddingTop: 22 }}>
        <ValueSlider
          testID="monthly-slider"
          label={t('goalsUi.setAsideEach')}
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
        <Text style={[typography.bodyMedium, { color: colors.onSurface }]}>{t('goalsUi.monthsToGo')}</Text>
        <NumberStepper
          label={t('goalsUi.monthsToGo')}
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
        {t('goalsUi.planStart')}
        <Text style={{ fontWeight: '700' }}>{dateShort(months)}</Text>
        {t('goalsUi.planEnd', { amount: formatRupees((FREE_BASE - monthly) * 100) })}
      </Text>
      <Text style={label}>{t('goalsUi.takeFrom')}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {spendAccounts.map((a) => {
          const label = a.kind === 'cash' ? t('goalsUi.cashChip') : a.name;
          return (
            <FilterChip
              key={a.id}
              testID={`from-${label}`}
              label={label}
              selected={from.includes(a.id)}
              onPress={() => setPicked(from.includes(a.id) ? from.filter((x) => x !== a.id) : [...from, a.id])}
            />
          );
        })}
      </View>
    </StackScreen>
  );
}
