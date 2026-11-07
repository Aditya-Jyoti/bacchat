import React, { useEffect, useMemo, useRef } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Banner } from '../../../components/Banner';
import { Glyph } from '../../../components/Glyph';
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
  useNetWorth,
  useNow,
  useSpendByCategory,
  useUpcoming,
  useWriters,
} from '../../../services';
import { useTheme } from '../../../theme';
import { MONTH_NAMES } from '../../money/parts/dates';
import { EMPTY_LOOKUPS, useLookups } from '../../money/parts/live';
import { useAiInsightText } from '../aiInsight';
import { useBudgetAlerts } from '../alertsStore';
import { useBudget } from '../../you/budgetStore';
import { dayOfMonth, daysInMonth } from '../../../data/db';
import { homeCopy } from '../copy';
import { alertCopy, duesCopy, useDuesInsight } from '../liveData';
import { signedAmount } from '../../you/parts/signedAmount';
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
  const aiText = useAiInsightText(dues.data);
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
          <Banner variant="insight" testID="banner-insight">{aiText ?? duesCopy(dues.data)}</Banner>
        </View>
      ) : null}
    </Pressable>
  );
}

function Accounts({ go, arrange }: SectionsProps): React.JSX.Element {
  const c = homeCopy;
  const now = useNow();
  const net = useNetWorth();
  const debts = useDebts();
  const accounts = useAccounts();
  const { colors, typography } = useTheme();
  const ready = net.data && debts.data && accounts.data;
  // One row per kind with its total (Bank, Cash, Mutual funds, NPS), then cards and loans on their own.
  const list = accounts.data ?? [];
  const count = (k: string): number => list.filter((a) => a.kind === k).length;
  const kindOf = new Map(list.map((a) => [a.id, a.kind] as const));
  const owed = (debts.data ?? []).filter((d) => d.outstandingPaise > 0);
  const cards = owed.filter((d) => kindOf.get(d.accountId) === 'card');
  const loans = owed.filter((d) => kindOf.get(d.accountId) === 'loan');
  const sum = (xs: { outstandingPaise: number }[]): number => xs.reduce((s, d) => s + d.outstandingPaise, 0);
  const next = cards.length ? Math.min(...cards.map((d) => nextDueDate(d.dueDay, now))) : null;
  const nextText = next ? `${new Date(next).getDate()} ${MONTH_NAMES[new Date(next).getMonth()].slice(0, 3)}` : '';
  const own = net.data?.ownBy;
  const groups = own
    ? [
        { id: 'bank', title: t('homeLive.groupBank'), icon: 'account_balance', paise: own.bank, n: count('bank') },
        { id: 'cash', title: t('homeLive.groupCash'), icon: 'payments', paise: own.cash, n: count('cash') },
        { id: 'mf', title: t('homeLive.groupMf'), icon: 'trending_up', paise: own.mf, n: count('mf') },
        { id: 'nps', title: t('homeLive.groupNps'), icon: 'elderly', paise: own.nps, n: count('nps') },
      ].filter((g) => g.n > 0)
    : [];
  const countText = (n: number): string => (n === 1 ? t('homeLive.oneAccount') : t('homeLive.nAccounts', { n }));
  return (
    <HomeSection testID="section-accounts" title={sectionMeta.accounts.label} onPress={() => go('k10')} onLongPress={arrange}>
      {!ready ? (
        <Loading />
      ) : (
        <>
          {groups.length === 0 && cards.length === 0 && loans.length === 0 ? (
            <Text style={[typography.bodyMedium, { color: colors.onSurfaceVariant }]}>{t('homeLive.noAccounts')}</Text>
          ) : null}
          {groups.map((g) => (
            <Row key={g.id} title={g.title} subtitle={countText(g.n)} amount={formatRupees(g.paise)} icon={g.icon} paddingVertical={9} />
          ))}
          {cards.length > 0 ? (
            <Row
              title={c.dues.name}
              subtitle={t(cards.length === 1 ? 'homeLive.duesSubOne' : 'homeLive.duesSub', { n: cards.length, date: nextText })}
              amount={formatRupees(sum(cards))}
              icon={c.dues.icon}
              neutral
              paddingVertical={9}
            />
          ) : null}
          {loans.length > 0 ? (
            <Row title={t('homeLive.groupLoans')} subtitle={countText(loans.length)} amount={formatRupees(sum(loans))} icon="request_quote" neutral paddingVertical={9} />
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

const KIND_KEY = { sip: 'kindSip', bill: 'kindBill', monthly: 'kindMonthly', income: 'kindIncome', transfer: 'kindTransfer', cardDue: 'kindCardDue' } as const;
/** Home shows the next item and the two after it; the rest are in Coming up (k17). */
const UPCOMING_ON_HOME = 3;

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
        <>
          {upcoming.data.slice(0, UPCOMING_ON_HOME).map((u) => {
            const d = new Date(u.atMs);
            const from = u.accountId ? names.get(u.accountId) : undefined;
            const kind = t(`homeLive.${KIND_KEY[u.kind]}`);
            return (
              <Row
                key={`${u.date}${u.title}`}
                title={u.title}
                subtitle={from ? `${kind} \u00B7 ${from}` : kind}
                amount={u.noAmount ? '' : signedAmount(u)}
                amountColor={u.direction === 'in' ? colors.moneyIn : colors.moneyOut}
                leading={
                  <View style={{ width: 36, alignItems: 'center' }}>
                    <Text style={[typography.titleMedium, { fontSize: 17, lineHeight: 17, color: colors.onSurface }]}>{d.getDate()}</Text>
                    <Text style={[typography.labelSmall, { color: colors.onSurfaceVariant, marginTop: 2 }]}>{MONTH_NAMES[d.getMonth()].slice(0, 3)}</Text>
                  </View>
                }
              />
            );
          })}
          <Pressable
            testID="upcoming-see-all"
            accessibilityRole="button"
            onPress={() => go('k17')}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 48 }}
          >
            <Text style={[typography.labelLarge, { color: colors.primary, flex: 1 }]}>
              {upcoming.data.length > UPCOMING_ON_HOME ? t('homeLive.moreUpcoming', { n: upcoming.data.length - UPCOMING_ON_HOME }) : t('homeLive.seeAllUpcoming')}
            </Text>
            <Glyph name="chevron_right" size={20} color={colors.primary} />
          </Pressable>
        </>
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

/** A small swatch and its words under the Home budget bar. */
function Caption({ color, text }: { color: string; text: string }): React.JSX.Element {
  const { colors, typography } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 }}>
      <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: color, borderWidth: 1, borderColor: colors.outlineVariant }} />
      <Text numberOfLines={1} style={[typography.bodySmall, { color: colors.onSurfaceVariant, flexShrink: 1 }]}>
        {text}
      </Text>
    </View>
  );
}

function Budget({ go, arrange }: SectionsProps): React.JSX.Element {
  const { colors, typography } = useTheme();
  const now = useNow();
  const pace = useBudgetPace();
  const spend = useSpendByCategory();
  // The overall monthly budget (k16) when one is set; otherwise the sum of the separate budgets.
  const overallPaise = useBudget((s) => s.totalPaise);
  const totals = useMemo(() => {
    const list = pace.data ?? [];
    const daysLeft = daysInMonth(now) - dayOfMonth(now);
    if (overallPaise > 0) {
      const spent = spend.data?.totalPaise ?? 0;
      return { limit: overallPaise, spent, left: overallPaise - spent, daysLeft };
    }
    const limit = list.reduce((s, p) => s + p.limitPaise, 0);
    const spent = list.reduce((s, p) => s + p.spentPaise, 0);
    return { limit, spent, left: limit - spent, daysLeft };
  }, [pace.data, spend.data, overallPaise, now]);
  const empty = pace.data !== undefined && pace.data.length === 0 && overallPaise <= 0;
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
          {/* Within budget: the spent share fills in primary. Over: the bar is full, the budget's share in
              primary and the overspend in moneyOut, so it never reads as empty (caution was nearly the
              track's colour in dark mode). */}
          <View
            testID="home-budget-bar"
            accessible
            accessibilityRole="progressbar"
            accessibilityLabel={`${formatRupees(totals.spent)} spent of ${formatRupees(totals.limit)}`}
            style={{ height: 8, borderRadius: 4, backgroundColor: colors.surfaceContainerHigh, marginTop: 8, flexDirection: 'row', overflow: 'hidden' }}
          >
            {totals.left >= 0 ? (
              <View testID="home-budget-fill" style={{ height: 8, borderRadius: 4, backgroundColor: colors.primary, width: `${Math.min(100, (totals.limit > 0 ? totals.spent / totals.limit : 0) * 100)}%` }} />
            ) : (
              <>
                <View testID="home-budget-fill" style={{ height: 8, backgroundColor: colors.primary, width: `${(totals.limit / Math.max(1, totals.spent)) * 100}%` }} />
                <View style={{ width: 2, height: 8, backgroundColor: colors.surface }} />
                <View testID="home-budget-over" style={{ height: 8, flex: 1, backgroundColor: colors.moneyOut }} />
              </>
            )}
          </View>
          {/* Captions say what each part of the bar is. */}
          <View testID="home-budget-captions" style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6, gap: 8 }}>
            {totals.left >= 0 ? (
              <>
                <Caption color={colors.primary} text={t('homeLive.barSpent', { amount: formatRupees(totals.spent) })} />
                <Caption color={colors.surfaceContainerHigh} text={t('homeLive.barLeft', { amount: formatRupees(totals.left) })} />
              </>
            ) : (
              <>
                <Caption color={colors.primary} text={t('homeLive.barBudget', { amount: formatRupees(totals.limit) })} />
                <Caption color={colors.moneyOut} text={t('homeLive.barOver', { amount: formatRupees(-totals.left) })} />
              </>
            )}
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

