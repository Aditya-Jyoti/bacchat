/** k15: Budget. Amount left, pace bar with a today marker, caution banner for Eating out, category rows. */
import React from 'react';
import { Text, View, type TextStyle } from 'react-native';

import { PaceBar } from '../../components/PaceBar';
import { StackScreen } from '../../components/StackScreen';
import { TopBarAction } from '../../components/TopBar';
import { budgets, budgetSummary } from '../../data';
import { formatRupees } from '../../lib/format';
import { useTheme } from '../../theme';
import { useScreenNav } from '../shared/useScreenNav';
import { useBudget } from './budgetStore';
import { BudgetRow } from './sections/BudgetRow';
import { CautionBanner } from './sections/CautionBanner';
import { t } from '../../lib/i18n';

const DAYS_IN_MONTH = 31;
const RAISE_TO = 700000;

export default function K15_Budget(): React.JSX.Element {
  const { colors, typography } = useTheme();
  const nav = useScreenNav();
  const { totalPaise, limits, cautionDismissed, setLimit, dismissCaution } = useBudget();
  const spent = budgetSummary.spent.paise;
  const left = Math.max(0, totalPaise - spent);
  const perDay = Math.floor(left / budgetSummary.daysLeft / 100) * 100;
  const todayFraction = (DAYS_IN_MONTH - budgetSummary.daysLeft) / DAYS_IN_MONTH;
  const rows = budgets.map((b) => ({ b, limit: limits[b.name] ?? b.limit.paise }));
  const overRow = rows.find((r) => r.b.spent.paise > r.limit);
  const pct = Math.round((spent / totalPaise) * 100);
  const muted: TextStyle = { ...typography.bodyMedium, color: colors.onSurfaceVariant };
  return (
    <StackScreen
      testID="screen-k15"
      title={t('budgetUi.title')}
      leading="back"
      onLeading={nav.back}
      trailing={<TopBarAction icon="edit" label={t('budgetUi.edit')} testID="edit-budget" onPress={() => nav.go('k16')} />}
    >
      <Text testID="budget-left" style={[typography.headlineSmall, { fontSize: 34, lineHeight: 39, color: colors.onSurface }]}>
        {t('budgetUi.left', { amount: formatRupees(left) })}
      </Text>
      <Text style={[muted, { marginTop: 2 }]}>{t('budgetUi.forDays', { days: budgetSummary.daysLeft, amount: formatRupees(perDay) })}</Text>
      <View style={{ marginTop: 16 }}>
        <PaceBar
          fraction={spent / totalPaise}
          todayFraction={todayFraction}
          accessibilityLabel={t('budgetUi.paceLabel', { pct, month: Math.round(todayFraction * 100) })}
        />
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
        <Text style={[typography.bodySmall, { color: colors.onSurfaceVariant }]}>{t('budgetUi.ofTotal', { spent: formatRupees(spent), total: formatRupees(totalPaise) })}</Text>
        <Text style={[typography.bodySmall, { color: colors.onSurfaceVariant }]}>{t('budgetUi.today')}</Text>
      </View>
      {overRow && !cautionDismissed ? (
        <CautionBanner
          lead={t('budgetUi.over', { name: overRow.b.name, amount: formatRupees(overRow.b.spent.paise - overRow.limit) })}
          body={t('budgetUi.overBody')}
          primaryLabel={t('budgetUi.raiseTo', { amount: formatRupees(RAISE_TO) })}
          onPrimary={() => setLimit(overRow.b.name, RAISE_TO)}
          secondaryLabel={t('budgetUi.okay')}
          onSecondary={dismissCaution}
        />
      ) : null}
      <View style={{ marginTop: 6 }}>
        {rows.map(({ b, limit }) => (
          <BudgetRow key={b.name} name={b.name} icon={b.icon} spentPaise={b.spent.paise} limitPaise={limit} />
        ))}
      </View>
    </StackScreen>
  );
}
