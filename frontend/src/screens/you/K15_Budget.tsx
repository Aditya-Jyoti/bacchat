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
      title="October budget"
      leading="back"
      onLeading={nav.back}
      trailing={<TopBarAction icon="edit" label="Edit budget" testID="edit-budget" onPress={() => nav.go('k16')} />}
    >
      <Text testID="budget-left" style={[typography.headlineSmall, { fontSize: 34, lineHeight: 39, color: colors.onSurface }]}>
        {`${formatRupees(left)} left`}
      </Text>
      <Text style={[muted, { marginTop: 2 }]}>{`for ${budgetSummary.daysLeft} days \u00B7 about ${formatRupees(perDay)} a day`}</Text>
      <View style={{ marginTop: 16 }}>
        <PaceBar
          fraction={spent / totalPaise}
          todayFraction={todayFraction}
          accessibilityLabel={`${pct} percent of the budget spent, ${Math.round(todayFraction * 100)} percent of the month gone`}
        />
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
        <Text style={[typography.bodySmall, { color: colors.onSurfaceVariant }]}>{`${formatRupees(spent)} of ${formatRupees(totalPaise)}`}</Text>
        <Text style={[typography.bodySmall, { color: colors.onSurfaceVariant }]}>{'today \u2191'}</Text>
      </View>
      {overRow && !cautionDismissed ? (
        <CautionBanner
          lead={`${overRow.b.name} went ${formatRupees(overRow.b.spent.paise - overRow.limit)} past its budget.`}
          body="Nothing to worry about. A couple of home dinners this week evens it out."
          primaryLabel={`Raise to ${formatRupees(RAISE_TO)}`}
          onPrimary={() => setLimit(overRow.b.name, RAISE_TO)}
          secondaryLabel="Okay"
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
