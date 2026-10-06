import type { BacchatDb } from '../repositories';
import type { Cadence, EntryDirection, Recurring } from '../models';
import { ledger } from './balances';
import { addDays, addMonthsClamped, dateKey, parseDateKey, startOfDay } from '../dates';

export type UpcomingKind = 'sip' | 'bill' | 'monthly' | 'cardDue';

export type UpcomingItem = {
  /** Local date key YYYY-MM-DD. */
  date: string;
  atMs: number;
  title: string;
  icon: string;
  amountPaise: number;
  direction: EntryDirection;
  kind: UpcomingKind;
  recurringId: string | null;
  accountId: string | null;
};

function step(ms: number, cadence: Cadence, k: number, anchorDay: number): number {
  switch (cadence) {
    case 'weekly':
      return addDays(ms, 7 * k);
    case 'monthly':
      return addMonthsClamped(withDay(ms, anchorDay), k);
    case 'quarterly':
      return addMonthsClamped(withDay(ms, anchorDay), 3 * k);
    case 'yearly':
      return addMonthsClamped(withDay(ms, anchorDay), 12 * k);
  }
}

function withDay(ms: number, day: number): number {
  const d = new Date(ms);
  return new Date(d.getFullYear(), d.getMonth(), day).getTime();
}

/** Occurrences of one recurring item in [fromMs, toMs). Month-end days clamp (31st -> 28th). */
export function occurrences(r: Recurring, fromMs: number, toMs: number): number[] {
  const first = parseDateKey(r.nextDue);
  const anchor = new Date(first).getDate();
  const out: number[] = [];
  for (let k = 0; k < 2000; k++) {
    const t = k === 0 ? first : step(first, r.cadence, k, anchor);
    if (t >= toMs) break;
    if (t >= fromMs) out.push(t);
  }
  return out;
}

/** Next date a card bill is due on or after `from`, given a due day of month. */
export function nextDueDate(dueDay: number, from: number): number {
  const d = new Date(from);
  const clampTo = (y: number, m: number): number =>
    new Date(y, m, Math.min(dueDay, new Date(y, m + 1, 0).getDate())).getTime();
  const thisMonth = clampTo(d.getFullYear(), d.getMonth());
  return thisMonth >= startOfDay(from) ? thisMonth : clampTo(d.getFullYear(), d.getMonth() + 1);
}

/**
 * Projection of what is coming up in the next `days` days from today: recurring items (SIPs,
 * bills, rent) plus card dues that have an outstanding balance. Sorted by date, then title.
 */
export async function upcoming(db: BacchatDb, now: number, days = 45): Promise<UpcomingItem[]> {
  const from = startOfDay(now);
  const to = addDays(from, days);
  const [recs, { accounts, debts }] = await Promise.all([db.recurring.list(), ledger(db)]);
  const items: UpcomingItem[] = [];
  for (const r of recs) {
    for (const t of occurrences(r, from, to)) {
      items.push({
        date: dateKey(t),
        atMs: t,
        title: r.title,
        icon: r.icon,
        amountPaise: r.amountPaise,
        direction: r.direction,
        kind: r.kind,
        recurringId: r.id,
        accountId: r.accountId ?? null,
      });
    }
  }
  for (const d of debts) {
    const acct = accounts.find((a) => a.id === d.accountId);
    if (!acct || acct.kind !== 'card' || d.outstandingPaise <= 0) continue;
    // A card bill repeats monthly; project each due date inside the window with the current outstanding for the first.
    let t = nextDueDate(d.dueDay, from);
    let first = true;
    while (t < to) {
      items.push({
        date: dateKey(t),
        atMs: t,
        title: `${acct.name} bill`,
        icon: 'credit_card',
        amountPaise: first ? d.outstandingPaise : 0,
        direction: 'out',
        kind: 'cardDue',
        recurringId: null,
        accountId: acct.id,
      });
      first = false;
      t = nextDueDate(d.dueDay, addDays(t, 1));
    }
  }
  return items
    .filter((i) => i.amountPaise > 0)
    .sort((a, b) => a.atMs - b.atMs || a.title.localeCompare(b.title));
}

/** Day-by-day outflow and inflow in the window, for the cash flow strip. */
export function projectCashFlow(items: UpcomingItem[]): { date: string; inPaise: number; outPaise: number }[] {
  const m = new Map<string, { date: string; inPaise: number; outPaise: number }>();
  for (const i of items) {
    const r = m.get(i.date) ?? { date: i.date, inPaise: 0, outPaise: 0 };
    if (i.direction === 'in') r.inPaise += i.amountPaise;
    else r.outPaise += i.amountPaise;
    m.set(i.date, r);
  }
  return [...m.values()].sort((a, b) => a.date.localeCompare(b.date));
}
