/** Everything the Summary tab (k3) shows for one month, read from the local database. */
import type { BacchatDb, Entry, PayMethod } from '../../../data/db';
import { dailyTotals, spendByCategory, type CategorySpend, type DailySpend } from '../../../data/db/queries';
import { normalizeMerchant } from '../../../lib/reconciliation';
import { endOfMonth, monthWindow, type MonthWindow } from '../parts/live';

export type MethodShare = { method: PayMethod; paise: number; percent: number };
export type MerchantTotal = { name: string; paise: number; count: number; categoryId: string | null };

export type MonthSummary = {
  win: MonthWindow;
  /** Money out this month. */
  spentPaise: number;
  /** Money in this month. */
  inPaise: number;
  /** Money out in the month before (for "less than Sept"). */
  lastMonthPaise: number;
  /** Money out in the month before up to the same day of the month (a fair pace comparison). */
  lastMonthToDatePaise: number;
  /** Days of the month counted so far (all of them for a past month). */
  daysElapsed: number;
  daily: DailySpend;
  categories: CategorySpend[];
  methods: MethodShare[];
  merchants: MerchantTotal[];
  /** The month's largest single spends, biggest first. */
  biggest: Entry[];
  /** Spends of BIG_SPEND_PAISE or more (flights, a hospital bill) and the everyday rest. */
  oneOffPaise: number;
  oneOffCount: number;
  everydayPaise: number;
  /** False when nothing was spent or received that month. */
  hasData: boolean;
};

export const METHOD_ICON: Record<PayMethod, string> = {
  card: 'credit_card',
  upi: 'qr_code_2',
  debit: 'payment',
  cash: 'payments',
  bank: 'account_balance',
};

/** A single spend at or above this counts as a big one-off in the summary (Rs 2,000). */
export const BIG_SPEND_PAISE = 200000;

/** Money that left for someone else: not a move between your own accounts. */
export const isSpend = (e: Entry): boolean => e.direction === 'out' && !e.transferToAccountId;

export function methodSplit(entries: readonly Entry[]): MethodShare[] {
  const by = new Map<PayMethod, number>();
  for (const e of entries) if (isSpend(e)) by.set(e.method, (by.get(e.method) ?? 0) + e.amountPaise);
  const total = [...by.values()].reduce((s, v) => s + v, 0);
  return [...by.entries()]
    .map(([method, paise]) => ({ method, paise, percent: total > 0 ? Math.round((paise / total) * 100) : 0 }))
    .sort((a, b) => b.paise - a.paise);
}

export function topMerchants(entries: readonly Entry[], limit = 8): MerchantTotal[] {
  const by = new Map<string, MerchantTotal>();
  for (const e of [...entries].sort((a, b) => b.at - a.at)) {
    if (!isSpend(e)) continue;
    const key = normalizeMerchant(e.merchant) || e.merchant.toLowerCase();
    const cur = by.get(key) ?? { name: e.merchant, paise: 0, count: 0, categoryId: e.categoryId };
    cur.paise += e.amountPaise;
    cur.count += 1;
    by.set(key, cur);
  }
  return [...by.values()].sort((a, b) => b.paise - a.paise || a.name.localeCompare(b.name)).slice(0, limit);
}

/** Summary for the month `back` months before the one containing `now`. */
export async function monthSummary(db: BacchatDb, now: number, back: number): Promise<MonthSummary> {
  const win = monthWindow(now, back);
  // A past month counts every day as elapsed, so its "now" is the last instant of the month.
  const ref = win.isCurrent ? now : endOfMonth(win.fromMs);
  const prevFrom = monthWindow(now, back + 1).fromMs;
  const daysElapsed = new Date(ref).getDate();
  const prevTo = Math.min(win.fromMs, new Date(new Date(prevFrom).getFullYear(), new Date(prevFrom).getMonth(), daysElapsed + 1).getTime());
  const [entries, spend, daily, prevEntries] = await Promise.all([
    db.entries.between(win.fromMs, win.toMs),
    spendByCategory(db, ref),
    dailyTotals(db, ref),
    db.entries.between(prevFrom, prevTo),
  ]);
  // Money in from someone else; a move from your own account is not income.
  const inPaise = entries.filter((e) => e.direction === 'in' && !e.transferToAccountId).reduce((s, e) => s + e.amountPaise, 0);
  const spends = entries.filter(isSpend);
  const big = spends.filter((e) => e.amountPaise >= BIG_SPEND_PAISE);
  const oneOffPaise = big.reduce((s, e) => s + e.amountPaise, 0);
  return {
    win,
    spentPaise: spend.totalPaise,
    inPaise,
    lastMonthPaise: spend.lastMonthTotalPaise,
    lastMonthToDatePaise: prevEntries.filter(isSpend).reduce((t, e) => t + e.amountPaise, 0),
    daysElapsed,
    daily,
    categories: spend.categories,
    methods: methodSplit(entries),
    merchants: topMerchants(entries),
    biggest: [...spends].sort((a, b) => b.amountPaise - a.amountPaise || b.at - a.at).slice(0, 6),
    oneOffPaise,
    oneOffCount: big.length,
    everydayPaise: Math.max(0, spend.totalPaise - oneOffPaise),
    hasData: spend.totalPaise > 0 || inPaise > 0,
  };
}
