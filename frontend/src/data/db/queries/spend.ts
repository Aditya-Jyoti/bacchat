import type { BacchatDb } from '../repositories';
import type { Entry } from '../models';
import { addMonths, daysInMonth, dayOfMonth, startOfMonth } from '../dates';

/** Spend entries only: money out. Refunds and income are not spend. */
const isSpend = (e: Entry): boolean => e.direction === 'out';

export type CategorySpend = {
  categoryId: string | null;
  totalPaise: number;
  count: number;
  /** Change versus the same category last month (positive = more). */
  deltaPaise: number;
  lastMonthPaise: number;
  /** Share of the month's spend, 0..1. */
  share: number;
};

export type MonthSpend = { totalPaise: number; lastMonthTotalPaise: number; categories: CategorySpend[] };

/** Spend by category for the month containing `now`, with the change versus last month. Largest first. */
export async function spendByCategory(db: BacchatDb, now: number): Promise<MonthSpend> {
  const thisStart = startOfMonth(now);
  const nextStart = addMonths(now, 1);
  const lastStart = addMonths(now, -1);
  const [cur, prev] = await Promise.all([
    db.entries.between(thisStart, nextStart),
    db.entries.between(lastStart, thisStart),
  ]);
  const sum = (list: Entry[]): Map<string | null, { total: number; count: number }> => {
    const m = new Map<string | null, { total: number; count: number }>();
    for (const e of list.filter(isSpend)) {
      const r = m.get(e.categoryId) ?? { total: 0, count: 0 };
      r.total += e.amountPaise;
      r.count += 1;
      m.set(e.categoryId, r);
    }
    return m;
  };
  const a = sum(cur);
  const b = sum(prev);
  const totalPaise = [...a.values()].reduce((s, r) => s + r.total, 0);
  const lastMonthTotalPaise = [...b.values()].reduce((s, r) => s + r.total, 0);
  const keys = new Set<string | null>([...a.keys(), ...b.keys()]);
  const categories: CategorySpend[] = [];
  for (const k of keys) {
    const t = a.get(k)?.total ?? 0;
    const l = b.get(k)?.total ?? 0;
    if (t === 0) continue; // categories with no spend this month are not listed
    categories.push({
      categoryId: k,
      totalPaise: t,
      count: a.get(k)?.count ?? 0,
      lastMonthPaise: l,
      deltaPaise: t - l,
      share: totalPaise > 0 ? t / totalPaise : 0,
    });
  }
  categories.sort((x, y) => y.totalPaise - x.totalPaise || String(x.categoryId).localeCompare(String(y.categoryId)));
  return { totalPaise, lastMonthTotalPaise, categories };
}

export type DayTotal = {
  /** 1-based day of month. */
  day: number;
  totalPaise: number;
  count: number;
  future: boolean;
  today: boolean;
  /** Two largest spends of the day. */
  top: { merchant: string; amountPaise: number; categoryId: string | null }[];
  /** Versus the average of days so far (negative = under). */
  vsAveragePaise: number;
};

export type DailySpend = { days: DayTotal[]; averagePaise: number; totalPaise: number };

/** Daily spend for the month containing `now`. Days after today are marked future with zero. */
export async function dailyTotals(db: BacchatDb, now: number): Promise<DailySpend> {
  const entries = (await db.entries.between(startOfMonth(now), addMonths(now, 1))).filter(isSpend);
  const n = daysInMonth(now);
  const today = dayOfMonth(now);
  const buckets: Entry[][] = Array.from({ length: n }, () => []);
  for (const e of entries) buckets[dayOfMonth(e.at) - 1].push(e);
  const totals = buckets.map((b) => b.reduce((s, e) => s + e.amountPaise, 0));
  const elapsed = totals.slice(0, today);
  const totalPaise = elapsed.reduce((s, v) => s + v, 0);
  const averagePaise = today > 0 ? Math.round(totalPaise / today) : 0;
  const days = buckets.map<DayTotal>((b, i) => {
    const future = i + 1 > today;
    const top = [...b]
      .sort((x, y) => y.amountPaise - x.amountPaise)
      .slice(0, 2)
      .map((e) => ({ merchant: e.merchant, amountPaise: e.amountPaise, categoryId: e.categoryId }));
    return {
      day: i + 1,
      totalPaise: future ? 0 : totals[i],
      count: future ? 0 : b.length,
      future,
      today: i + 1 === today,
      top: future ? [] : top,
      vsAveragePaise: future ? 0 : totals[i] - averagePaise,
    };
  });
  return { days, averagePaise, totalPaise };
}

export type MonthlyFlow = { month: string; inPaise: number; outPaise: number };

/** Money in and out for the last `months` months ending with the month of `now`, oldest first. */
export async function cashFlowByMonth(db: BacchatDb, now: number, months = 6): Promise<MonthlyFlow[]> {
  const out: MonthlyFlow[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const from = addMonths(now, -i);
    const entries = await db.entries.between(from, addMonths(from, 1));
    const d = new Date(from);
    out.push({
      month: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
      inPaise: entries.filter((e) => e.direction === 'in').reduce((s, e) => s + e.amountPaise, 0),
      outPaise: entries.filter(isSpend).reduce((s, e) => s + e.amountPaise, 0),
    });
  }
  return out;
}

