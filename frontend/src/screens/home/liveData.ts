/**
 * Live data for Home (k1): the net worth series, the card dues insight and budget alert copy.
 * Pure functions over the db plus small hooks over useDbQuery.
 */
import { netWorth as sampleNetWorth, netWorthSeries as sampleSeries } from '../../data';
import type { BacchatDb } from '../../data/db';
import { addMonths, dayOfMonth, daysInMonth, startOfDay } from '../../data/db/dates';
import { netWorth, type BudgetAlert } from '../../data/db/queries';
import { nextDueDate } from '../../data/db/queries/upcoming';
import { formatRupees } from '../../lib/format';
import { t } from '../../lib/i18n';
import { useDbQuery, useServices, type QueryResult } from '../../services';
import { monthAbbr } from '../money/parts/live';
import { MONTH_NAMES } from '../money/parts/dates';

export type NetSeries = {
  /** Net worth in paise per point, oldest first, last = today. */
  values: number[];
  labels: string[];
  /** Change since `since`, in paise. */
  deltaPaise: number;
  /** "since 1 Sep". */
  since: string;
};

/** Short month name ("Oct") for a month start. */
const mon = (ms: number): string => monthAbbr(MONTH_NAMES[new Date(ms).getMonth()]).slice(0, 3);

/**
 * Rebuild month-end net worth from money in and out: what you have now, less everything that came
 * in after that month ended, plus everything that went out. It ignores market moves, so it is an
 * approximation and the chart says nothing it cannot back.
 */
export async function reconstructSeries(db: BacchatDb, now: number, months = 12): Promise<NetSeries> {
  const current = (await netWorth(db)).netPaise;
  const oldest = addMonths(now, -(months - 1));
  const entries = await db.entries.between(oldest, now + 1);
  const values: number[] = [];
  const labels: string[] = [];
  for (let k = months - 1; k >= 0; k--) {
    const from = addMonths(now, -k);
    const pointAt = k === 0 ? now : addMonths(now, -k + 1) - 1;
    let v = current;
    for (const e of entries) if (e.at > pointAt) v -= e.direction === 'in' ? e.amountPaise : -e.amountPaise;
    values.push(v);
    labels.push(mon(from));
  }
  const monthStart = addMonths(now, 0);
  return {
    values,
    labels,
    deltaPaise: current - (values.length > 1 ? values[values.length - 2] : current),
    since: t('homeLive.since', { date: `1 ${mon(monthStart)}` }),
  };
}

const LAKH_PAISE = 1e7;

/** The design's twelve points (lakhs), ending on today's live net worth. */
export function sampleSeriesFor(netPaise: number): NetSeries {
  const values = sampleSeries.map((v) => Math.round(v * LAKH_PAISE));
  values[values.length - 1] = netPaise;
  return {
    values,
    labels: ['Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct'],
    deltaPaise: sampleNetWorth.delta.paise,
    since: t('homeUi.since'),
  };
}

/** Net worth over time. Sample mode shows the design's curve, otherwise it is rebuilt from entries. */
export function useNetWorthSeries(): QueryResult<NetSeries> {
  const services = useServices();
  return useDbQuery(async (db, now) => {
    if (services.isSample()) return sampleSeriesFor((await netWorth(db)).netPaise);
    return reconstructSeries(db, now);
  });
}

export type DuesInsight = { count: number; totalPaise: number; days: number; bankName: string | null; bankPaise: number };

/** Card bills that are due soon and what could pay them, or null when no card owes anything. */
export async function duesInsight(db: BacchatDb, now: number): Promise<DuesInsight | null> {
  const [debts, accounts] = await Promise.all([db.debts.list(), db.accounts.list()]);
  const cards = new Set(accounts.filter((a) => a.kind === 'card').map((a) => a.id));
  const owing = debts.filter((d) => cards.has(d.accountId) && d.outstandingPaise > 0);
  if (owing.length === 0) return null;
  const today = startOfDay(now);
  const days = Math.max(...owing.map((d) => Math.round((nextDueDate(d.dueDay, now) - today) / 86400000)));
  const banks = accounts.filter((a) => a.kind === 'bank').sort((a, b) => b.balancePaise - a.balancePaise);
  return {
    count: owing.length,
    totalPaise: owing.reduce((s, d) => s + d.outstandingPaise, 0),
    days,
    bankName: banks[0]?.name ?? null,
    bankPaise: banks[0]?.balancePaise ?? 0,
  };
}

export function useDuesInsight(): QueryResult<DuesInsight | null> {
  return useDbQuery((db, now) => duesInsight(db, now));
}

/** Calm one-liner for the card dues insight. */
export function duesCopy(d: DuesInsight): string {
  const countText = d.count <= 5 ? t(`homeLive.count${d.count}`) : String(d.count);
  const head = t(d.count === 1 ? 'homeLive.duesHeadOne' : 'homeLive.duesHeadMany', { count: countText, amount: formatRupees(d.totalPaise), days: d.days });
  if (d.bankName && d.bankPaise >= d.totalPaise) {
    const roomy = d.bankPaise >= d.totalPaise * 2;
    return `${head} ${t(roomy ? 'homeLive.coversRoomy' : 'homeLive.covers', { name: d.bankName, both: t(d.count === 1 ? 'homeLive.it' : 'homeLive.both') })}`;
  }
  return `${head} ${t('homeLive.topUp')}`;
}

/** Text for a budget alert: what happened and a small next step. Never alarming. */
export function alertCopy(a: BudgetAlert, categoryName: string): string {
  if (a.kind === 'over') return t('homeLive.alertOver', { name: categoryName, amount: formatRupees(a.overByPaise) });
  return t('homeLive.alertPace', { name: categoryName, spent: formatRupees(a.spentPaise), limit: formatRupees(a.limitPaise) });
}

/** Fraction of the month that has passed (for the "today" marker on the budget track). */
export function monthFraction(now: number): number {
  return Math.min(1, Math.max(0, dayOfMonth(now) / daysInMonth(now)));
}
