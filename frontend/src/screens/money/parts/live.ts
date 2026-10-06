/**
 * Live data helpers for the Money screens: lookups (categories, accounts, UPI ids), entry to row
 * mapping, day grouping and month ranges. Pure functions plus two small hooks over useDbQuery.
 */
import type { Account, Category, Entry, UpiId } from '../../../data/db';
import { addMonths, dateKey, startOfDay, startOfMonth } from '../../../data/db/dates';
import { formatDateLong, formatDateShort, formatRupees, formatTime } from '../../../lib/format';
import { t } from '../../../lib/i18n';
import { useDbQuery, type QueryResult } from '../../../services';
import { MONTH_NAMES } from './dates';
import type { EntryRowProps } from './EntryRow';

export type Lookups = {
  cats: Map<string, Category>;
  accounts: Map<string, Account>;
  upis: Map<string, UpiId>;
};

export const EMPTY_LOOKUPS: Lookups = { cats: new Map(), accounts: new Map(), upis: new Map() };

/** Categories, accounts and UPI ids by id. Re-reads whenever the database changes. */
export function useLookups(): QueryResult<Lookups> {
  return useDbQuery(async (db) => {
    const [cats, accounts, upis] = await Promise.all([db.categories.list(), db.accounts.list(), db.upiIds.list()]);
    return {
      cats: new Map(cats.map((c) => [c.id, c] as const)),
      accounts: new Map(accounts.map((a) => [a.id, a] as const)),
      upis: new Map(upis.map((u) => [u.id, u] as const)),
    };
  });
}

/** Time of the oldest live entry, or null when there is none. */
export function useEarliestEntry(): QueryResult<number | null> {
  return useDbQuery(async (db) => {
    const all = await db.entries.between(0, Number.MAX_SAFE_INTEGER);
    return all.length ? Math.min(...all.map((e) => e.at)) : null;
  });
}

export function categoryName(e: Pick<Entry, 'categoryId'>, lk: Lookups): string {
  return (e.categoryId ? lk.cats.get(e.categoryId)?.name : undefined) ?? t('moneyLive.noCategory');
}

/** "UPI . rahul@okhdfc", the card or account name, or "Cash". */
export function viaLabel(e: Entry, lk: Lookups): string {
  const acct = e.accountId ? lk.accounts.get(e.accountId) : undefined;
  switch (e.method) {
    case 'upi': {
      const handle = e.upiId ? lk.upis.get(e.upiId)?.handle : undefined;
      return handle ? `UPI \u00B7 ${handle}` : 'UPI';
    }
    case 'cash':
      return t('moneyLive.cash');
    case 'debit':
      return acct ? t('moneyLive.debitOf', { name: acct.name }) : t('moneyLive.debit');
    default:
      return acct?.name ?? t('moneyLive.bank');
  }
}

/** First part of the via label ("UPI", "ICICI Amazon Pay"). */
export function shortVia(via: string): string {
  return via.split(' \u00B7 ')[0];
}

export function isResolved(e: Entry): boolean {
  return e.sources.some((s) => s.rawRef === 'resolved');
}

/** Props for an EntryRow from a stored entry. */
export function rowFor(e: Entry, lk: Lookups, extra: Partial<EntryRowProps> = {}): EntryRowProps {
  const cat = e.categoryId ? lk.cats.get(e.categoryId) : undefined;
  const second = e.sources.length > 1;
  return {
    name: e.merchant,
    icon: cat?.icon ?? 'help',
    sub: `${categoryName(e, lk)} \u00B7 ${viaLabel(e, lk)}`,
    amountPaise: e.amountPaise,
    income: e.direction === 'in',
    source: e.sources[0]?.kind ?? 'hand',
    matched: second && !isResolved(e),
    resolved: second && isResolved(e),
    toReview: e.status === 'toReview',
    pending: e.status === 'toReview' && e.aiAdded,
    ...extra,
  };
}

export type DayGroup = {
  key: string;
  /** "Today", "Yesterday" or "" for older days. */
  word: string;
  /** "Sat, 24 Oct". */
  date: string;
  entries: Entry[];
  /** Money out that day, in paise. */
  totalPaise: number;
};

/** Group entries (any order) into days, newest day first, entries newest first. */
export function groupByDay(entries: readonly Entry[], now: number): DayGroup[] {
  const today = startOfDay(now);
  const yesterday = startOfDay(today - 12 * 3600 * 1000);
  const map = new Map<string, DayGroup>();
  for (const e of [...entries].sort((a, b) => b.at - a.at)) {
    const key = dateKey(e.at);
    let g = map.get(key);
    if (!g) {
      const sod = startOfDay(e.at);
      g = {
        key,
        word: sod === today ? t('moneyUi.today') : sod === yesterday ? t('moneyUi.yesterday') : '',
        date: formatDateLong(e.at),
        entries: [],
        totalPaise: 0,
      };
      map.set(key, g);
    }
    g.entries.push(e);
    if (e.direction === 'out') g.totalPaise += e.amountPaise;
  }
  return [...map.values()].sort((a, b) => (a.key < b.key ? 1 : -1));
}

/** "Today . Sat, 24 Oct" or just "Tue, 20 Oct". */
export function dayHeading(g: DayGroup): string {
  return g.word ? `${g.word} \u00B7 ${g.date}` : g.date;
}

/** "Today", "Yesterday" or "21 Oct". */
export function shortDayLabel(at: number, now: number): string {
  const sod = startOfDay(at);
  const today = startOfDay(now);
  if (sod === today) return t('moneyUi.today');
  if (sod === startOfDay(today - 12 * 3600 * 1000)) return t('moneyUi.yesterday');
  return formatDateShort(at);
}

export type MonthWindow = { fromMs: number; toMs: number; name: string; shortName: string; isCurrent: boolean };

/** The month `back` months before the one containing now. */
export function monthWindow(now: number, back: number): MonthWindow {
  const fromMs = addMonths(now, -back);
  const name = MONTH_NAMES[new Date(fromMs).getMonth()];
  return { fromMs, toMs: addMonths(now, -back + 1), name, shortName: monthAbbr(name), isCurrent: back === 0 };
}

/** "Sept" for September, the first three letters for the others. */
export function monthAbbr(name: string): string {
  return name === 'September' ? 'Sept' : name.slice(0, 3);
}

/** How many whole months before now's month the given time falls (0 when in the same month). */
export function monthsBack(now: number, at: number): number {
  const a = new Date(now);
  const b = new Date(at);
  return Math.max(0, (a.getFullYear() - b.getFullYear()) * 12 + (a.getMonth() - b.getMonth()));
}

export function isInMonth(ms: number, w: MonthWindow): boolean {
  return ms >= w.fromMs && ms < w.toMs;
}

/** Last instant of the month, used as "now" so every day of a past month counts as elapsed. */
export function endOfMonth(fromMs: number): number {
  return addMonths(fromMs, 1) - 1;
}

export { formatRupees, formatTime, startOfMonth };
