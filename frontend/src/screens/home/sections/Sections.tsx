import { monthSummary } from '../../money/summary/summaryData';
import { monthWindow , EMPTY_LOOKUPS, useLookups } from '../../money/parts/live';
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
  useDbQuery,
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
import { useAiInsightText } from '../aiInsight';
import { useBudgetAlerts } from '../alertsStore';
import { useBudget } from '../../you/budgetStore';
import { dayOfMonth, daysInMonth } from '../../../data/db';
import { homeCopy } from '../copy';
import { alertCopy, duesCopy, useDuesInsight } from '../liveData';
import { signedAmount } from '../../you/parts/signedAmount';
import { HomeSection } from './HomeSection';
import { isOpenEnded, isReached } from '../../goals/goalTypes';
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
  // Cards with a bill day show the bill still to pay and this cycle's spends apart; others show their dues.
  const cycled = cards.filter((d) => d.cycle);
  const plain = cards.filter((d) => !d.cycle);
  const billLeft = cycled.reduce((s, d) => s + (d.cycle?.billLeftPaise ?? 0), 0);
  const cycleSpent = cycled.reduce((s, d) => s + Math.max(0, d.cycle?.cyclePaise ?? 0), 0);
  const billDue = Math.min(...cycled.filter((d) => (d.cycle?.billLeftPaise ?? 0) > 0).map((d) => d.cycle?.billDueAt ?? Infinity));
  const nextBill = Math.min(...cycled.map((d) => d.cycle?.nextStatementAt ?? Infinity));
  const shortDate = (ms: number): string => (Number.isFinite(ms) ? `${new Date(ms).getDate()} ${MONTH_NAMES[new Date(ms).getMonth()].slice(0, 3)}` : '');
  const next = plain.length ? Math.min(...plain.map((d) => nextDueDate(d.dueDay, now))) : null;
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
          {plain.length > 0 ? (
            <Row
              title={c.dues.name}
              subtitle={t(plain.length === 1 ? 'homeLive.duesSubOne' : 'homeLive.duesSub', { n: plain.length, date: nextText })}
              amount={formatRupees(sum(plain))}
              icon={c.dues.icon}
              neutral
              paddingVertical={9}
            />
          ) : null}
          {billLeft > 0 ? (
            <Row
              title={t('homeLive.cardBill')}
              subtitle={t('homeLive.cardBillSub', { date: shortDate(billDue) })}
              amount={formatRupees(billLeft)}
              icon="receipt_long"
              neutral
              paddingVertical={9}
            />
          ) : null}
          {cycled.length > 0 ? (
            <Row
              title={t('homeLive.cardCycle')}
              subtitle={t('homeLive.cardCycleSub', { date: shortDate(nextBill) })}
              amount={formatRupees(cycleSpent)}
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

const SHARE_ROLES = ['primary', 'chart2', 'chart3', 'chart4'] as const;

/**
 * This month, at a glance: one plain line on the pace, a share bar of where the money went (four
 * colours at most, the rest together), the top three with their amounts, and the way to the full
 * month in Summary.
 */
function Spend({ go, arrange }: SectionsProps): React.JSX.Element {
  const { colors, typography, spacing } = useTheme();
  const spend = useSpendByCategory();
  const lookups = useLookups();
  const now = useNow();
  const month = useDbQuery((db, n) => monthSummary(db, n, 0));
  const lk = lookups.data ?? EMPTY_LOOKUPS;
  const all = spend.data?.categories ?? [];
  const total = spend.data?.totalPaise ?? 0;
  const top = all.slice(0, 3);
  const restPaise = all.slice(3).reduce((x, c) => x + c.totalPaise, 0);
  const name = (id: string | null): string => (id ? lk.cats.get(id)?.name : undefined) ?? t('moneyLive.noCategory');
  const m = month.data;
  const pace =
    m && m.daysElapsed > 0 && m.spentPaise > 0
      ? m.lastMonthToDatePaise > 0
        ? t(m.spentPaise <= m.lastMonthToDatePaise ? 'homeLive.paceLess' : 'homeLive.paceMore', {
            perDay: formatRupees(Math.round(m.spentPaise / m.daysElapsed / 100) * 100),
            diff: formatRupees(Math.round(Math.abs(m.spentPaise - m.lastMonthToDatePaise) / 100) * 100),
            month: monthWindow(now, 1).shortName,
          })
        : t('homeLive.paceNew', { perDay: formatRupees(Math.round(m.spentPaise / m.daysElapsed / 100) * 100) })
      : null;
  return (
    <HomeSection
      testID="section-spend"
      title={sectionMeta.spend.label}
      trailing={spend.data ? `${formatRupees(total)} ${homeCopy.spentSuffix}` : undefined}
      onPress={() => go('k3')}
      onLongPress={arrange}
    >
      {!spend.data || !lookups.data ? (
        <Loading />
      ) : all.length === 0 ? (
        <Text style={{ color: colors.onSurfaceVariant }}>{t('homeLive.noSpend')}</Text>
      ) : (
        <View style={{ gap: spacing.md }}>
          {pace ? (
            <Text testID="spend-pace" style={[typography.bodyMedium, { color: colors.onSurfaceVariant }]}>
              {pace}
            </Text>
          ) : null}
          <View testID="spend-share" accessible accessibilityLabel={all.map((c) => `${name(c.categoryId)} ${formatRupees(c.totalPaise)}`).join(', ')} style={{ flexDirection: 'row', gap: 3, height: 12 }}>
            {top.map((c, i) => (
              <View key={c.categoryId ?? 'none'} style={{ flex: total > 0 ? c.totalPaise / total : 0, borderRadius: 4, backgroundColor: colors[SHARE_ROLES[i]] }} />
            ))}
            {restPaise > 0 ? <View style={{ flex: restPaise / total, borderRadius: 4, backgroundColor: colors.outlineVariant }} /> : null}
          </View>
          {top.map((c, i) => (
            <View key={c.categoryId ?? 'none'} testID={`spend-top-${name(c.categoryId)}`} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
              <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: colors[SHARE_ROLES[i]] }} />
              <Text numberOfLines={1} style={[typography.bodyLarge, { color: colors.onSurface, flex: 1 }]}>
                {name(c.categoryId)}
              </Text>
              <Text style={[typography.bodySmall, { color: colors.onSurfaceVariant }]}>{`${Math.round(c.share * 100)}%`}</Text>
              <Text style={[typography.labelLarge, { color: colors.onSurface, minWidth: 80, textAlign: 'right' }]}>{formatRupees(c.totalPaise)}</Text>
            </View>
          ))}
          {restPaise > 0 ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
              <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: colors.outlineVariant }} />
              <Text style={[typography.bodyLarge, { color: colors.onSurfaceVariant, flex: 1 }]}>{t('homeLive.spendRest', { n: all.length - 3 })}</Text>
              <Text style={[typography.labelLarge, { color: colors.onSurfaceVariant, minWidth: 80, textAlign: 'right' }]}>{formatRupees(restPaise)}</Text>
            </View>
          ) : null}
          <Text style={[typography.labelLarge, { color: colors.primary }]}>{t('homeLive.spendSeeMonth')}</Text>
        </View>
      )}
    </HomeSection>
  );
}

const KIND_KEY = { sip: 'kindSip', bill: 'kindBill', monthly: 'kindMonthly', income: 'kindIncome', transfer: 'kindTransfer', cardDue: 'kindCardDue', cardBill: 'kindCardBill' } as const;
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
        // Every goal: in progress first, then reached ones (tagged Done) at the bottom, like the Goals tab.
        [...goals.data]
          .sort((x, y) => Number(isReached(x.total)) - Number(isReached(y.total)))
          .map(({ goal, total }) => (
          <Pressable
            key={goal.id}
            accessibilityRole="button"
            accessibilityLabel={
              isOpenEnded(total)
                ? `${goal.name}, ${t('goalsUi.openPot')}, ${formatRupees(total.savedPaise)}`
                : `${goal.name}, ${formatRupees(total.savedPaise)} of ${formatRupees(total.targetPaise)}${isReached(total) ? `, ${t('common.done')}` : ''}`
            }
            onPress={() => go('k13')}
            onLongPress={arrange}
            style={{ paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.outlineVariant }}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={[typography.bodyMedium, { color: colors.onSurface }]}>{goal.name}</Text>
              <Text style={[typography.bodyMedium, { color: colors.onSurfaceVariant }]}>
                {isOpenEnded(total)
                  ? formatRupees(total.savedPaise)
                  : isReached(total)
                    ? `${formatRupees(total.savedPaise)} \u00B7 ${t('common.done')}`
                    : `${formatRupees(total.savedPaise)} / ${formatRupees(total.targetPaise)}`}
              </Text>
            </View>
            {/* An open pot has no target: just the amount, no bar. */}
            {isOpenEnded(total) ? null : (
              <>
                <View style={{ height: 8 }} />
                <SegmentedProgress fraction={total.savedPaise / total.targetPaise} height={6} />
              </>
            )}
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

