import React, { useEffect, useMemo, useRef } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Banner } from '../../../components/Banner';
import { SegmentedProgress } from '../../../components/SegmentedProgress';
import { SkeletonLoader } from '../../../components/SkeletonLoader';
import { sectionMeta } from '../../../data';
import { takeBudgetAlerts, nextDueDate } from '../../../data/db/queries';
import type { HomeSectionId } from '../../../data/types';
import { formatRupees } from '../../../lib/format';
import { t } from '../../../lib/i18n';
import type { KId } from '../../../navigation/screenManifest';
import {
  useAccounts,
  useBudgetPace,
  useDebts,
  useGoalsWithTotals,
  useNow,
  useSpendable,
  useSpendByCategory,
  useUpcoming,
  useWriters,
} from '../../../services';
import { useTheme } from '../../../theme';
import { MONTH_NAMES } from '../../money/parts/dates';
import { EMPTY_LOOKUPS, useLookups } from '../../money/parts/live';
import { useBudgetAlerts } from '../alertsStore';
import { homeCopy } from '../copy';
import { alertCopy, duesCopy, monthFraction, useDuesInsight } from '../liveData';
import { HomeSection } from './HomeSection';
import { Row } from './Rows';

export type SectionsProps = { go: (kid: KId) => void; arrange: () => void };

function Loading(): React.JSX.Element {
  return (
    <View testID="section-loading" style={{ gap: 10, paddingVertical: 6 }}>
      <SkeletonLoader height={16} />
      <SkeletonLoader width="70%" height={16} />
    </View>
  );
}

function AlertBanner({ alert }: { alert: ReturnType<typeof useBudgetAlerts.getState>['alerts'][number] }): React.JSX.Element {
  const { colors, typography } = useTheme();
  const db = useWriters();
  const lookups = useLookups();
  const name = lookups.data?.cats.get(alert.categoryId)?.name ?? t('moneyLive.noCategory');
  const done = (): void => useBudgetAlerts.getState().dismiss(alert.categoryId, alert.month);
  const raise = (): void => {
    void db.budgets.list().then(async (all) => {
      const b = all.find((x) => x.categoryId === alert.categoryId);
      if (b) await db.budgets.put({ ...b, monthlyPaise: alert.raiseToPaise });
      done();
    });
  };
  const link = [typography.labelLarge, { color: colors.onCaution, fontWeight: '700' as const }];
  return (
    <View style={{ marginTop: 10 }}>
      <Banner variant="caution" testID={`alert-${alert.categoryId}`}>
        {`${alertCopy(alert, name)} ${t('homeLive.alertTip')}\n`}
        <Text testID={`alert-raise-${alert.categoryId}`} accessibilityRole="button" onPress={raise} style={link}>
          {t('homeLive.raiseTo', { amount: formatRupees(alert.raiseToPaise) })}
        </Text>
        {'   '}
        <Text testID={`alert-okay-${alert.categoryId}`} accessibilityRole="button" onPress={done} style={link}>
          {t('homeLive.okay')}
        </Text>
      </Banner>
    </View>
  );
}

function Insight({ arrange }: SectionsProps): React.JSX.Element {
  const db = useWriters();
  const now = useNow();
  const dues = useDuesInsight();
  const alerts = useBudgetAlerts((s) => s.alerts);
  const asked = useRef(false);
  useEffect(() => {
    if (asked.current) return;
    asked.current = true;
    let live = true;
    void takeBudgetAlerts(db, now).then((fresh) => {
      if (live && fresh.length) useBudgetAlerts.getState().add(fresh);
    });
    return () => {
      live = false;
      asked.current = false;
    };
  }, [db, now]);
  return (
    <Pressable
      testID="section-insight"
      accessibilityActions={[{ name: 'longpress', label: t('homeUi.arrangeHome') }]}
      onAccessibilityAction={() => arrange()}
      onLongPress={arrange}
      style={{ marginTop: 18 }}
    >
      {alerts.map((a) => (
        <AlertBanner key={`${a.categoryId}-${a.month}`} alert={a} />
      ))}
      {dues.data ? (
        <View style={{ marginTop: alerts.length ? 10 : 0 }}>
          <Banner variant="insight">{duesCopy(dues.data)}</Banner>
        </View>
      ) : null}
    </Pressable>
  );
}

function Accounts({ go, arrange }: SectionsProps): React.JSX.Element {
  const c = homeCopy;
  const now = useNow();
  const spendable = useSpendable();
  const debts = useDebts();
  const accounts = useAccounts();
  const ready = spendable.data && debts.data && accounts.data;
  const cardDebts = (debts.data ?? []).filter((d) => d.outstandingPaise > 0);
  const duesTotal = cardDebts.reduce((s, d) => s + d.outstandingPaise, 0);
  const next = cardDebts.length ? Math.min(...cardDebts.map((d) => nextDueDate(d.dueDay, now))) : null;
  const nextText = next
    ? `${new Date(next).getDate()} ${MONTH_NAMES[new Date(next).getMonth()].slice(0, 3)}`
    : '';
  return (
    <HomeSection testID="section-accounts" title={sectionMeta.accounts.label} onPress={() => go('k10')} onLongPress={arrange}>
      {!ready ? (
        <Loading />
      ) : (
        <>
          <Row title={c.spendable.name} subtitle={c.spendable.sub} amount={formatRupees(spendable.data?.paise ?? 0)} icon={c.spendable.icon} paddingVertical={9} />
          {cardDebts.length > 0 ? (
            <Row
              title={c.dues.name}
              subtitle={t(cardDebts.length === 1 ? 'homeLive.duesSubOne' : 'homeLive.duesSub', { n: cardDebts.length, date: nextText })}
              amount={formatRupees(duesTotal)}
              icon={c.dues.icon}
              neutral
              paddingVertical={9}
            />
          ) : null}
        </>
      )}
    </HomeSection>
  );
}

function Spend({ go, arrange }: SectionsProps): React.JSX.Element {
  const { colors } = useTheme();
  const spend = useSpendByCategory();
  const lookups = useLookups();
  const lk = lookups.data ?? EMPTY_LOOKUPS;
  const rows = useMemo(() => (spend.data?.categories ?? []).slice(0, 6), [spend.data]);
  const max = Math.max(1, ...rows.map((r) => r.totalPaise));
  return (
    <HomeSection
      testID="section-spend"
      title={sectionMeta.spend.label}
      trailing={spend.data ? `${formatRupees(spend.data.totalPaise)} ${homeCopy.spentSuffix}` : undefined}
      onPress={() => go('k3')}
      onLongPress={arrange}
    >
      {!spend.data || !lookups.data ? (
        <Loading />
      ) : rows.length === 0 ? (
        <Text style={{ color: colors.onSurfaceVariant }}>{t('homeLive.noSpend')}</Text>
      ) : (
        rows.map((s) => {
          const cat = s.categoryId ? lk.cats.get(s.categoryId) : undefined;
          return (
            <Row key={s.categoryId ?? 'none'} title={cat?.name ?? t('moneyLive.noCategory')} amount={formatRupees(s.totalPaise)} icon={cat?.icon ?? 'help'} paddingVertical={7}>
              <View style={{ height: 4, borderRadius: 2, backgroundColor: colors.surfaceContainerHigh, marginTop: 6 }}>
                <View style={{ height: 4, borderRadius: 2, backgroundColor: colors.primary, width: `${Math.min(100, (s.totalPaise / max) * 100)}%` }} />
              </View>
            </Row>
          );
        })
      )}
    </HomeSection>
  );
}

const KIND_KEY = { sip: 'kindSip', bill: 'kindBill', monthly: 'kindMonthly', cardDue: 'kindCardDue' } as const;

function Upcoming({ go, arrange }: SectionsProps): React.JSX.Element {
  const { colors, typography } = useTheme();
  const upcoming = useUpcoming();
  const accounts = useAccounts();
  const names = new Map((accounts.data ?? []).map((a) => [a.id, a.name] as const));
  return (
    <HomeSection testID="section-upcoming" title={sectionMeta.upcoming.label} onPress={() => go('k17')} onLongPress={arrange}>
      {!upcoming.data || !accounts.data ? (
        <Loading />
      ) : upcoming.data.length === 0 ? (
        <Text style={{ color: colors.onSurfaceVariant }}>{t('homeLive.nothingUpcoming')}</Text>
      ) : (
        upcoming.data.slice(0, 4).map((u) => {
          const d = new Date(u.atMs);
          const from = u.accountId ? names.get(u.accountId) : undefined;
          const kind = t(`homeLive.${KIND_KEY[u.kind]}`);
          return (
            <Row
              key={`${u.date}${u.title}`}
              title={u.title}
              subtitle={from ? `${kind} \u00B7 ${from}` : kind}
              amount={formatRupees(u.amountPaise)}
              leading={
                <View style={{ width: 36, alignItems: 'center' }}>
                  <Text style={[typography.titleMedium, { fontSize: 17, lineHeight: 17, color: colors.onSurface }]}>{d.getDate()}</Text>
                  <Text style={[typography.labelSmall, { color: colors.onSurfaceVariant, marginTop: 2 }]}>{MONTH_NAMES[d.getMonth()].slice(0, 3)}</Text>
                </View>
              }
            />
          );
        })
      )}
    </HomeSection>
  );
}

function Goals({ go, arrange }: SectionsProps): React.JSX.Element {
  const { colors, typography } = useTheme();
  const goals = useGoalsWithTotals();
  return (
    <HomeSection testID="section-goals" title={sectionMeta.goals.label} onLongPress={arrange}>
      {!goals.data ? (
        <Loading />
      ) : goals.data.length === 0 ? (
        <Text style={{ color: colors.onSurfaceVariant }}>{t('homeLive.noGoals')}</Text>
      ) : (
        goals.data.slice(0, 2).map(({ goal, total }) => (
          <Pressable
            key={goal.id}
            accessibilityRole="button"
            accessibilityLabel={`${goal.name}, ${formatRupees(total.savedPaise)} of ${formatRupees(total.targetPaise)}`}
            onPress={() => go('k13')}
            onLongPress={arrange}
            style={{ paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.outlineVariant }}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={[typography.bodyMedium, { color: colors.onSurface }]}>{goal.name}</Text>
              <Text style={[typography.bodyMedium, { color: colors.onSurfaceVariant }]}>
                {formatRupees(total.savedPaise)} / {formatRupees(total.targetPaise)}
              </Text>
            </View>
            <View style={{ height: 8 }} />
            <SegmentedProgress fraction={total.targetPaise > 0 ? total.savedPaise / total.targetPaise : 0} height={6} />
          </Pressable>
        ))
      )}
    </HomeSection>
  );
}

function Budget({ go, arrange }: SectionsProps): React.JSX.Element {
  const { colors, typography } = useTheme();
  const now = useNow();
  const pace = useBudgetPace();
  const totals = useMemo(() => {
    const list = pace.data ?? [];
    const limit = list.reduce((s, p) => s + p.limitPaise, 0);
    const spent = list.reduce((s, p) => s + p.spentPaise, 0);
    return { limit, spent, left: limit - spent, daysLeft: list[0]?.daysLeft ?? 0 };
  }, [pace.data]);
  const empty = pace.data !== undefined && pace.data.length === 0;
  return (
    <HomeSection
      testID="section-budget"
      title={sectionMeta.budget.label}
      trailing={pace.data && !empty ? t('homeLive.daysLeft', { n: totals.daysLeft }) : undefined}
      onPress={() => go('k15')}
      onLongPress={arrange}
    >
      {!pace.data ? (
        <Loading />
      ) : empty ? (
        <Text style={[typography.bodyMedium, { color: colors.onSurfaceVariant }]}>{t('homeLive.noBudget')}</Text>
      ) : (
        <>
          <Text style={[typography.bodyMedium, { color: colors.onSurface }]}>
            {totals.left >= 0
              ? t('homeLive.budgetLeft', { left: formatRupees(totals.left), total: formatRupees(totals.limit) })
              : t('homeLive.budgetOver', { over: formatRupees(-totals.left), total: formatRupees(totals.limit) })}
          </Text>
          <View
            accessible
            accessibilityRole="progressbar"
            accessibilityLabel={`${formatRupees(totals.spent)} spent of ${formatRupees(totals.limit)}`}
            style={{ height: 6, borderRadius: 3, backgroundColor: colors.surfaceContainerHigh, marginTop: 8 }}
          >
            <View
              style={{
                height: 6,
                borderRadius: 3,
                backgroundColor: totals.left >= 0 ? colors.primary : colors.caution,
                width: `${Math.min(100, (totals.limit > 0 ? totals.spent / totals.limit : 0) * 100)}%`,
              }}
            />
            <View
              testID="budget-today"
              style={{ position: 'absolute', left: `${monthFraction(now) * 100}%`, top: -4, width: 2, height: 14, borderRadius: 1, backgroundColor: colors.onSurface }}
            />
          </View>
        </>
      )}
    </HomeSection>
  );
}

const BY_ID: Record<HomeSectionId, (p: SectionsProps) => React.JSX.Element> = {
  insight: Insight,
  accounts: Accounts,
  spend: Spend,
  upcoming: Upcoming,
  goals: Goals,
  budget: Budget,
};

/** Renders one configurable Home section by id. */
export function renderSection(id: HomeSectionId, p: SectionsProps): React.JSX.Element {
  const C = BY_ID[id];
  return <C key={id} {...p} />;
}

