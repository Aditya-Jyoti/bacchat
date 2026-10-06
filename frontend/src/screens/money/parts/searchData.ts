import type { BacchatDb, Entry, EntrySourceKind } from '../../../data/db';
import { categoryName, type Lookups } from './live';

export type AmountRange = { id: 'any' | 'under500' | 'mid' | 'over2000'; label: string; min: number; max: number };

export const AMOUNT_RANGES: readonly AmountRange[] = [
  { id: 'any', label: 'Any amount', min: 0, max: Number.MAX_SAFE_INTEGER },
  { id: 'under500', label: 'Under \u20B9500', min: 0, max: 49999 },
  { id: 'mid', label: '\u20B9500 to \u20B92,000', min: 50000, max: 200000 },
  { id: 'over2000', label: 'Over \u20B92,000', min: 200001, max: Number.MAX_SAFE_INTEGER },
];

export const SOURCE_FILTERS: readonly { id: EntrySourceKind | 'all'; label: string }[] = [
  { id: 'all', label: 'Source' },
  { id: 'sms', label: 'SMS' },
  { id: 'mail', label: 'Email' },
  { id: 'shot', label: 'Screenshot' },
  { id: 'hand', label: 'Added by you' },
];

/** True when the text is in the merchant, the note or the category name (case-insensitive). */
export function matchesQuery(e: Entry, query: string, lk: Lookups): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return false;
  return `${e.merchant} ${e.note ?? ''} ${categoryName(e, lk)}`.toLowerCase().includes(q);
}

const RECENT_KEY = 'search.recent.v1';
const RECENT_MAX = 5;

export async function loadRecent(db: Pick<BacchatDb, 'meta'>): Promise<string[]> {
  try {
    const raw = await db.meta.get(RECENT_KEY);
    const list = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(list) ? list.filter((x): x is string => typeof x === 'string').slice(0, RECENT_MAX) : [];
  } catch {
    return [];
  }
}

/** Remember a search (newest first, no repeats, at most five). Returns the new list. */
export async function pushRecent(db: Pick<BacchatDb, 'meta'>, query: string): Promise<string[]> {
  const q = query.trim();
  if (!q) return loadRecent(db);
  const next = [q, ...(await loadRecent(db)).filter((r) => r.toLowerCase() !== q.toLowerCase())].slice(0, RECENT_MAX);
  await db.meta.set(RECENT_KEY, JSON.stringify(next));
  return next;
}
