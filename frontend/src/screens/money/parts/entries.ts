import { entryDays, type EntryDay, type EntryItem } from '../../../data';
import { formatRupees } from '../../../lib/format';

export type EntryFilter = 'all' | 'review' | 'sms' | 'mail' | 'shot';

/** Entries read from a screenshot whose category was guessed stay "to review" until confirmed. */
const TO_REVIEW_NAMES: ReadonlySet<string> = new Set(['Ramesh Fruits']);

export function isToReview(e: EntryItem): boolean {
  return TO_REVIEW_NAMES.has(e.name);
}

export function matchesFilter(e: EntryItem, f: EntryFilter): boolean {
  if (f === 'all') return true;
  if (f === 'review') return isToReview(e);
  return e.source === f;
}

export const REVIEW_COUNT = entryDays.reduce((n, d) => n + d.items.filter(isToReview).length, 0);

export function parseFilter(v: unknown): EntryFilter {
  return v === 'review' || v === 'sms' || v === 'mail' || v === 'shot' ? v : 'all';
}

export type DayGroup = { day: EntryDay; items: EntryItem[]; totalText: string };

/** Day groups after a source filter and an optional category. Totals are recomputed when filtered. */
export function groupEntries(filter: EntryFilter, category?: string): DayGroup[] {
  return entryDays
    .map((day) => {
      const items = day.items.filter((e) => matchesFilter(e, filter) && (!category || e.category === category));
      const filtered = filter !== 'all' || !!category;
      const sum = items.filter((e) => !e.income).reduce((s, e) => s + e.amount.paise, 0);
      return { day, items, totalText: filtered ? formatRupees(sum) : day.total.text };
    })
    .filter((g) => g.items.length > 0);
}
