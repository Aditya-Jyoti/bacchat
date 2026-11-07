/**
 * k14: New goal, and Edit goal when opened with an id. A target is optional: switched off, the goal
 * is an open-ended pot (round-ups, a rainy-day jar) with no target and no date. Icon picker, name, target, an optional "By" date picked on a calendar, and an
 * optional "already saved" amount, and the account the goal is kept in (its money adds to that
 * account's balance). Optional settings (closed by default): a monthly amount. Create goal.
 */
import React, { useState } from 'react';
import { Pressable, Text, View, type TextStyle } from 'react-native';
import { Switch } from 'react-native-paper';

import { OptionPicker } from '../../components/OptionPicker';
import { Glyph } from '../../components/Glyph';
import { OutlinedField } from '../../components/OutlinedField';
import { PillButton } from '../../components/PillButton';
import { StackScreen } from '../../components/StackScreen';
import { formatRupees, groupIndian } from '../../lib/format';
import { t } from '../../lib/i18n';
import { useNow, useServices, useWriters } from '../../services';
import { useTheme } from '../../theme';
import { useScreenNav } from '../shared/useScreenNav';
import { createGoal, splitSaved, updateGoal } from './goalWrites';
import { useGoalPlans } from './goalPlanStore';
import { GoalDatePicker } from './sections/GoalDatePicker';
import { IconPicker } from './sections/IconPicker';
import { useGoalsData } from './useGoalsData';

const digits = (s: string): string => s.replace(/[^0-9]/g, '').slice(0, 9);
const num = (s: string): number => (s ? parseInt(s, 10) : 0);
const group = (s: string): string => (s ? groupIndian(String(num(s))) : '');
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const pad = (n: number): string => String(n).padStart(2, '0');

export const dateKey = (d: Date): string => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const dateText = (d: Date): string => `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;

/** Whole months from today to the date, at least 1. */
export function monthsUntil(date: Date, now: number): number {
  const n = new Date(now);
  const m = (date.getFullYear() - n.getFullYear()) * 12 + (date.getMonth() - n.getMonth());
  return Math.max(1, m);
}

export default function K14_NewGoal(): React.JSX.Element {
  const { colors, typography } = useTheme();
  const nav = useScreenNav();
  const db = useWriters();
  const now = useNow();
  const { spendAccounts, goals } = useGoalsData();
  // Edit mode: opened with an id from the goal's menu (k13).
  const editId = typeof nav.params.id === 'string' ? nav.params.id : null;
  const editing = editId ? goals.find((g) => g.id === editId) ?? null : null;
  const setMonthlyPlan = useGoalPlans((s) => s.setMonthly);
  const [icon, setIcon] = useState('beach_access');
  // The design's example goal is only pre-filled while the sample notebook is showing; a real one starts blank.
  const sample = useServices().isSample();
  const [name, setName] = useState(sample ? 'Goa with friends' : '');
  const [target, setTarget] = useState(sample ? '60000' : '');
  const [saved, setSaved] = useState(sample ? '38000' : '');
  const [date, setDate] = useState<Date | null>(null);
  const [picking, setPicking] = useState(false);
  const [more, setMore] = useState(false);
  // Only kept when the owner types one: a monthly plan is optional, with no upper limit.
  const [monthly, setMonthly] = useState<number | null>(null);
  // The account the goal's money is kept in (optional). Its balance grows with the goal.
  const [keptIn, setKeptIn] = useState<string | null>(null);
  const [pickingAccount, setPickingAccount] = useState(false);
  const [saving, setSaving] = useState(false);
  // Off: an open-ended pot with no target and no date (round-ups, a rainy-day jar).
  const [hasTarget, setHasTarget] = useState(true);
  // Fill the form once from the goal being edited (state set while rendering, not in an effect).
  const [filled, setFilled] = useState(false);
  if (editing && !filled) {
    setFilled(true);
    setIcon(editing.icon);
    setName(editing.name);
    setTarget(editing.targetPaise > 0 ? String(Math.round(editing.targetPaise / 100)) : '');
    setHasTarget(editing.targetPaise > 0);
    setSaved('');
    const k = editing.targetDate ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(editing.targetDate) : null;
    setDate(k ? new Date(+k[1], +k[2] - 1, +k[3]) : null);
    setKeptIn(editing.accountId);
    const plan = useGoalPlans.getState().monthly[editing.id];
    if (plan) {
      setMonthly(Math.round(plan / 100));
      setMore(true);
    }
  }
  const valid = name.trim().length > 0 && (!hasTarget || num(target) > 0);
  const NOT_IN = t('goalsUi.notInAccount');
  const keptName = keptIn ? spendAccounts.find((a) => a.id === keptIn)?.name ?? NOT_IN : NOT_IN;
  const left = Math.max(0, num(target) - num(saved));
  const needed = hasTarget && date && left > 0 ? Math.ceil(left / monthsUntil(date, now) / 100) * 100 : null;
  const label: TextStyle = { ...typography.labelSmall, color: colors.onSurfaceVariant, fontWeight: '600', letterSpacing: 0.4, marginTop: 18, marginBottom: 8 };

  const create = async () => {
    if (saving || !valid) return;
    setSaving(true);
    try {
      if (editId) {
        await updateGoal(db, {
          id: editId,
          name: name.trim(),
          icon,
          targetPaise: hasTarget ? num(target) * 100 : 0,
          targetDate: hasTarget && date ? dateKey(date) : null,
          accountId: keptIn,
        });
        if (monthly != null && monthly > 0) setMonthlyPlan(editId, monthly * 100);
        else useGoalPlans.getState().remove(editId);
        nav.back();
        return;
      }
      const id = await createGoal(db, {
        name: name.trim(),
        icon,
        targetPaise: hasTarget ? num(target) * 100 : 0,
        targetDate: hasTarget && date ? dateKey(date) : null,
        allocations: splitSaved(num(saved) * 100, keptIn ? [keptIn] : []),
        accountId: keptIn,
      });
      if (monthly != null && monthly > 0) setMonthlyPlan(id, monthly * 100);
      nav.finish('k13', { id });
    } finally {
      setSaving(false);
    }
  };

  return (
    <StackScreen
      testID="screen-k14"
      title={editId ? t('goalsUi.editGoal') : t('goalsUi.newGoal')}
      leading="close"
      onLeading={nav.back}
      footer={<PillButton testID="create-goal" label={editId ? t('goalsUi.saveGoal') : t('goalsUi.createGoal')} height={52} disabled={!valid || saving} onPress={() => void create()} style={{ width: '100%' }} />}
    >
      <Text style={label}>{t('goalsUi.pickIcon')}</Text>
      <IconPicker value={icon} onChange={setIcon} />
      <View style={{ gap: 16, marginTop: 22 }}>
        <OutlinedField testID="goal-name" label={t('goalsUi.saveFor')} value={name} onChangeText={setName} />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56 }}>
          <View style={{ flex: 1 }}>
            <Text style={[typography.bodyLarge, { color: colors.onSurface }]}>{t('goalsUi.hasTarget')}</Text>
            <Text style={[typography.bodySmall, { color: colors.onSurfaceVariant }]}>{hasTarget ? t('goalsUi.hasTargetOn') : t('goalsUi.hasTargetOff')}</Text>
          </View>
          <Switch testID="goal-has-target" accessibilityLabel={t('goalsUi.hasTarget')} value={hasTarget} onValueChange={setHasTarget} />
        </View>
        {hasTarget ? (
          <>
            <OutlinedField
              testID="goal-target"
              label={t('goalsUi.target')}
              prefix={'₹'}
              keyboardType="number-pad"
              value={group(target)}
              onChangeText={(v) => setTarget(digits(v))}
            />
            <OutlinedField
              testID="goal-date"
              label={t('goalsUi.byOptional')}
              leadingIcon="calendar_today"
              value={date ? dateText(date) : ''}
              onPress={() => setPicking(true)}
              helper={date ? undefined : t('goalsUi.noDateHelper')}
            />
          </>
        ) : null}
        {editId ? null : (
        <OutlinedField
          testID="goal-saved"
          label={t('goalsUi.alreadySaved')}
          prefix={'₹'}
          keyboardType="number-pad"
          value={group(saved)}
          onChangeText={(v) => setSaved(digits(v))}
          helper={t('goalsUi.savedHelper')}
        />
        )}
        {spendAccounts.length > 0 ? (
          <OutlinedField
            testID="goal-account"
            label={t('goalsUi.keepIn')}
            leadingIcon="account_balance"
            dropdown
            value={keptName}
            onPress={() => setPickingAccount(true)}
            helper={keptIn ? t('goalsUi.keepInHelp') : t('goalsUi.keepInNone')}
          />
        ) : null}
        {needed != null ? (
          <Text testID="plan-line" style={[typography.bodyMedium, { color: colors.onSurface }]}>
            {t('goalsUi.neededLine', { amount: formatRupees(needed * 100), date: date ? dateText(date) : '' })}
          </Text>
        ) : null}
      </View>

      <Pressable
        testID="goal-more"
        accessibilityRole="button"
        accessibilityState={{ expanded: more }}
        onPress={() => setMore((m) => !m)}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 56, marginTop: 18, borderBottomWidth: 1, borderBottomColor: colors.outlineVariant }}
      >
        <View style={{ flex: 1 }}>
          <Text style={[typography.titleMedium, { color: colors.onSurface }]}>{t('goalsUi.optionalSettings')}</Text>
          <Text style={[typography.bodySmall, { color: colors.onSurfaceVariant }]}>{t('goalsUi.optionalSettingsSub')}</Text>
        </View>
        <Glyph name={more ? 'expand_less' : 'expand_more'} color={colors.onSurfaceVariant} />
      </Pressable>

      {more ? (
        <View testID="goal-more-body">
          <Text style={label}>{t('goalsUi.setAsideMonthly')}</Text>
          <OutlinedField
            testID="monthly-amount"
            label={t('goalsUi.setAsideEach')}
            prefix={'\u20B9'}
            keyboardType="number-pad"
            value={monthly != null ? group(String(monthly)) : ''}
            onChangeText={(v) => {
              const d = digits(v);
              setMonthly(d ? num(d) : null);
            }}
            helper={needed != null ? t('goalsUi.monthlyHint', { amount: formatRupees(needed * 100) }) : undefined}
          />
          <Text testID="monthly-state" style={[typography.bodyMedium, { color: colors.onSurface, marginTop: 8 }]}>
            {monthly == null ? t('goalsUi.monthlyNotSet') : t('goalsUi.monthlySet', { amount: formatRupees(monthly * 100) })}
          </Text>
          {monthly != null ? (
            <Pressable testID="monthly-clear" accessibilityRole="button" onPress={() => setMonthly(null)} style={{ minHeight: 48, justifyContent: 'center' }}>
              <Text style={[typography.labelLarge, { color: colors.primary }]}>{t('goalsUi.noMonthly')}</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      <OptionPicker
        visible={pickingAccount}
        title={t('goalsUi.keepIn')}
        options={[NOT_IN, ...spendAccounts.map((a) => a.name)]}
        value={keptName}
        onSelect={(o) => {
          setKeptIn(spendAccounts.find((a) => a.name === o)?.id ?? null);
          setPickingAccount(false);
        }}
        onClose={() => setPickingAccount(false)}
      />
      <GoalDatePicker
        key={picking ? 'open' : 'closed'}
        visible={picking}
        value={date}
        today={new Date(now)}
        onPick={(d) => {
          setDate(d);
          setPicking(false);
        }}
        onClose={() => setPicking(false)}
      />
    </StackScreen>
  );
}
