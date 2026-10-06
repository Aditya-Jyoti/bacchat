/** k15: Budget. Amount left, pace bar with a today marker, caution banner when a category passes its limit, category rows. */
import React, { useEffect, useRef, useState } from 'react';
import { Text, View, type TextStyle } from 'react-native';

import { PaceBar } from '../../components/PaceBar';
import { SkeletonRows } from '../../components/SkeletonLoader';
import { StackScreen } from '../../components/StackScreen';
import { TopBarAction } from '../../components/TopBar';
import { takeBudgetAlerts, type BudgetAlert } from '../../data/db';
import { formatRupees } from '../../lib/format';
import { useServices, useWriters } from '../../services';
import { useTheme } from '../../theme';
import { useScreenNav } from '../shared/useScreenNav';
import { useBudget } from './budgetStore';
import { monthName } from './parts/monthName';
import { BudgetRow } from './sections/BudgetRow';
import { CautionBanner } from './sections/CautionBanner';
import { useBudgetData, useCategoryMap } from './useBudgetData';
import { t } from '../../lib/i18n';

export default function K15_Budget(): React.JSX.Element {
  const { colors, typography } = useTheme();
  const nav = useScreenNav();
  const services = useServices();
  const db = useWriters();
  const totalPaise = useBudget((s) => s.totalPaise);
  const d = useBudgetData();
  const cats = useCategoryMap();
  const [alerts, setAlerts] = useState<BudgetAlert[]>([]);
  const taken = useRef(false);
  const alive = useRef(true);

  // Calm rule: takeBudgetAlerts hands out each category's alert once per month and records it.
  useEffect(() => {
    alive.current = true;
    if (!taken.current) {
      taken.current = true;
      void services
        .whenReady()
        .then(() => takeBudgetAlerts(db, services.now()))
        .then((a) => {
          if (alive.current) setAlerts(a);
        })
        .catch(() => undefined);
    }
    return () => {
      alive.current = false;
    };
  }, [services, db]);

  const raise = async (a: BudgetAlert): Promise<void> => {
    const b = (await db.budgets.list()).find((x) => x.categoryId === a.categoryId);
    if (b) await db.budgets.put({ ...b, monthlyPaise: a.raiseToPaise });
    setAlerts((cur) => cur.filter((x) => x.categoryId !== a.categoryId));
  };

  const left = Math.max(0, totalPaise - d.spentPaise);
  const perDay = d.daysLeft > 0 ? Math.floor(left / d.daysLeft / 100) * 100 : left;
  const todayFraction = d.daysInMonth > 0 ? d.dayOfMonth / d.daysInMonth : 0;
  const pct = totalPaise > 0 ? Math.round((d.spentPaise / totalPaise) * 100) : 0;
  const muted: TextStyle = { ...typography.bodyMedium, color: colors.onSurfaceVariant };
  return (
    <StackScreen
      testID="screen-k15"
      title={t('budgetUi.title', { month: monthName(d.now) })}
      leading="back"
      onLeading={nav.back}
      trailing={<TopBarAction icon="edit" label={t('budgetUi.edit')} testID="edit-budget" onPress={() => nav.go('k16')} />}
    >
      {d.loading ? (
        <SkeletonRows count={5} />
      ) : (
        <>
          <Text testID="budget-left" style={[typography.headlineSmall, { fontSize: 34, lineHeight: 39, color: colors.onSurface }]}>
            {t('budgetUi.left', { amount: formatRupees(left) })}
          </Text>
          <Text style={[muted, { marginTop: 2 }]}>{t('budgetUi.forDays', { days: d.daysLeft, amount: formatRupees(perDay) })}</Text>
          <View style={{ marginTop: 16 }}>
            <PaceBar
              fraction={totalPaise > 0 ? d.spentPaise / totalPaise : 0}
              todayFraction={todayFraction}
              accessibilityLabel={t('budgetUi.paceLabel', { pct, month: Math.round(todayFraction * 100) })}
            />
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
            <Text style={[typography.bodySmall, { color: colors.onSurfaceVariant }]}>
              {t('budgetUi.ofTotal', { spent: formatRupees(d.spentPaise), total: formatRupees(totalPaise) })}
            </Text>
            <Text style={[typography.bodySmall, { color: colors.onSurfaceVariant }]}>{t('budgetUi.today')}</Text>
          </View>
          {alerts.map((a) => {
            const name = cats.get(a.categoryId)?.name ?? a.categoryId;
            return (
              <CautionBanner
                key={a.categoryId}
                lead={
                  a.kind === 'over'
                    ? t('budgetUi.over', { name, amount: formatRupees(a.overByPaise) })
                    : t('budgetUi.paceLead', { name })
                }
                body={a.kind === 'over' ? t(a.categoryId === 'eating-out' ? 'budgetUi.overBody' : 'budgetUi.overBodyGeneric') : t('budgetUi.paceBody')}
                primaryLabel={t('budgetUi.raiseTo', { amount: formatRupees(a.raiseToPaise) })}
                onPrimary={() => void raise(a)}
                secondaryLabel={t('budgetUi.okay')}
                onSecondary={() => setAlerts((cur) => cur.filter((x) => x.categoryId !== a.categoryId))}
              />
            );
          })}
          <View style={{ marginTop: 6 }}>
            {d.rows.length === 0 ? (
              <Text testID="budget-empty" style={[muted, { paddingVertical: 16 }]}>{t('budgetUi.noBudgets')}</Text>
            ) : null}
            {d.rows.map((r) => (
              <BudgetRow key={r.budgetId} name={r.name} icon={r.icon} spentPaise={r.spentPaise} limitPaise={r.limitPaise} />
            ))}
          </View>
        </>
      )}
    </StackScreen>
  );
}
