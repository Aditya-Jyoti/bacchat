/** k16: Edit budget. Monthly total, one slider per category, nudge threshold, rollover, Save. */
import React, { useState } from 'react';
import { Text, View, type TextStyle } from 'react-native';
import { Switch } from 'react-native-paper';

import { OutlinedField } from '../../components/OutlinedField';
import { SegmentedChoice } from '../../components/SegmentedChoice';
import { StackScreen } from '../../components/StackScreen';
import { TopBarAction } from '../../components/TopBar';
import { SkeletonRows } from '../../components/SkeletonLoader';
import { formatRupees, groupIndian } from '../../lib/format';
import { useNow, useWriters } from '../../services';
import { useTheme } from '../../theme';
import { useScreenNav } from '../shared/useScreenNav';
import { useBudget, type NudgeAt } from './budgetStore';
import { monthName } from './parts/monthName';
import { LimitRow } from './sections/LimitRow';
import { useEditableBudgets } from './useBudgetData';
import { t } from '../../lib/i18n';

const MAX_CATEGORY = 20000;

export default function K16_EditBudget(): React.JSX.Element {
  const { colors, typography } = useTheme();
  const nav = useScreenNav();
  const db = useWriters();
  const now = useNow();
  const saved = useBudget();
  const { loading, budgets } = useEditableBudgets();
  // Edits sit on top of what is stored; untouched fields keep following the database.
  const [totalEdit, setTotalEdit] = useState<number | null>(null);
  const [edits, setEdits] = useState<Record<string, number>>({});
  const [nudge, setNudge] = useState<NudgeAt>(saved.nudge);
  const [rollover, setRollover] = useState(saved.rollover);
  const total = totalEdit ?? saved.totalPaise / 100;
  const limitOf = (b: { id: string; monthlyPaise: number }): number => edits[b.id] ?? b.monthlyPaise / 100;
  const split = budgets.reduce((a, b) => a + limitOf(b), 0);
  const unplanned = total - split;
  const label: TextStyle = { ...typography.labelSmall, color: colors.onSurfaceVariant, fontWeight: '600', letterSpacing: 0.4, marginTop: 18, marginBottom: 8 };
  const onSave = async () => {
    saved.save({ totalPaise: total * 100, nudge, rollover });
    for (const b of budgets) {
      const v = edits[b.id];
      if (v !== undefined && v * 100 !== b.monthlyPaise) await db.budgets.put({ id: b.id, categoryId: b.categoryId, monthlyPaise: v * 100 });
    }
    nav.go('k15');
  };
  return (
    <StackScreen
      testID="screen-k16"
      title={t('budgetUi.editTitle')}
      leading="close"
      onLeading={nav.back}
      trailing={<TopBarAction text={t('budgetUi.save')} label={t('budgetUi.save')} testID="save-budget" onPress={() => void onSave()} />}
    >
      <View style={{ marginTop: 6 }}>
        <OutlinedField
          testID="budget-total"
          label={t('budgetUi.monthly')}
          prefix={'\u20B9'}
          keyboardType="number-pad"
          value={total ? groupIndian(String(total)) : ''}
          onChangeText={(x) => setTotalEdit(parseInt(x.replace(/[^0-9]/g, '').slice(0, 9) || '0', 10))}
        />
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 }}>
        <Text style={[typography.bodyMedium, { fontSize: 13, color: colors.onSurfaceVariant }]}>{t('budgetUi.split')}</Text>
        <Text testID="split-summary" style={[typography.bodyMedium, { fontSize: 13, color: colors.onSurfaceVariant }]}>
          <Text style={{ fontWeight: '700', color: colors.onSurface }}>{formatRupees(split * 100)}</Text>
          {unplanned >= 0
            ? t('budgetUi.unplanned', { amount: formatRupees(unplanned * 100) })
            : t('budgetUi.overTotal', { amount: formatRupees(-unplanned * 100) })}
        </Text>
      </View>
      <View style={{ marginTop: 8 }}>
        {loading ? <SkeletonRows count={5} /> : null}
        {budgets.map((b) => (
          <LimitRow
            key={b.id}
            name={b.name}
            icon={b.icon}
            rupees={limitOf(b)}
            maxRupees={Math.max(MAX_CATEGORY, limitOf(b))}
            onChange={(v) => setEdits((l) => ({ ...l, [b.id]: v }))}
          />
        ))}
      </View>
      <Text style={label}>{t('budgetUi.nudgeMe')}</Text>
      <SegmentedChoice
        testID="nudge"
        accessibilityLabel={t('budgetUi.nudgeLabel')}
        value={nudge}
        onChange={setNudge}
        options={[
          { id: '80', label: '80%' },
          { id: '90', label: '90%' },
          { id: '100', label: '100%' },
        ]}
      />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 16 }}>
        <View style={{ flex: 1 }}>
          <Text style={[typography.bodyLarge, { fontSize: 15, color: colors.onSurface }]}>{t('budgetUi.rollover', { month: monthName(now, 1) })}</Text>
          <Text style={[typography.bodySmall, { color: colors.onSurfaceVariant }]}>{t('budgetUi.rolloverSub')}</Text>
        </View>
        <Switch testID="rollover-switch" accessibilityLabel={t('budgetUi.rollover', { month: monthName(now, 1) })} value={rollover} onValueChange={setRollover} />
      </View>
    </StackScreen>
  );
}
