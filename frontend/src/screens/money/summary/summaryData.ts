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
  daily: DailySpend;
  categories: CategorySpend[];
  methods: MethodShare[];
  merchants: MerchantTotal[];
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

export function methodSplit(entries: readonly Entry[]): MethodShare[] {
  const by = new Map<PayMethod, number>();
  for (const e of entries) if (e.direction === 'out') by.set(e.method, (by.get(e.method) ?? 0) + e.amountPaise);
  const total = [...by.values()].reduce((s, v) => s + v, 0);
  return [...by.entries()]
    .map(([method, paise]) => ({ method, paise, percent: total > 0 ? Math.round((paise / total) * 100) : 0 }))
    .sort((a, b) => b.paise - a.paise);
}

export function topMerchants(entries: readonly Entry[], limit = 4): MerchantTotal[] {
  const by = new Map<string, MerchantTotal>();
  for (const e of [...entries].sort((a, b) => b.at - a.at)) {
    if (e.direction !== 'out') continue;
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
  const [entries, spend, daily] = await Promise.all([
    db.entries.between(win.fromMs, win.toMs),
    spendByCategory(db, ref),
    dailyTotals(db, ref),
  ]);
  const inPaise = entries.filter((e) => e.direction === 'in').reduce((s, e) => s + e.amountPaise, 0);
  return {
    win,
    spentPaise: spend.totalPaise,
    inPaise,
    lastMonthPaise: spend.lastMonthTotalPaise,
    daily,
    categories: spend.categories,
    methods: methodSplit(entries),
    merchants: topMerchants(entries),
    hasData: spend.totalPaise > 0 || inPaise > 0,
  };
}
