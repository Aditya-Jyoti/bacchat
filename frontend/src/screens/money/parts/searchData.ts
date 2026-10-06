import { entryDays, recentSearches, searchResults, type EntrySourceKey, type SearchResult } from '../../../data';

export type AmountRange = { id: 'any' | 'under500' | 'mid' | 'over2000'; label: string; min: number; max: number };

export const AMOUNT_RANGES: readonly AmountRange[] = [
  { id: 'any', label: 'Any amount', min: 0, max: Number.MAX_SAFE_INTEGER },
  { id: 'under500', label: 'Under \u20B9500', min: 0, max: 49999 },
  { id: 'mid', label: '\u20B9500 to \u20B92,000', min: 50000, max: 200000 },
  { id: 'over2000', label: 'Over \u20B92,000', min: 200001, max: Number.MAX_SAFE_INTEGER },
];

export const SOURCE_FILTERS: readonly { id: EntrySourceKey | 'all'; label: string }[] = [
  { id: 'all', label: 'Source' },
  { id: 'sms', label: 'SMS' },
  { id: 'mail', label: 'Email' },
  { id: 'shot', label: 'Screenshot' },
  { id: 'hand', label: 'Added by you' },
];

/** Search pool: the design's sample results plus every entry on the Entries list (deduplicated). */
export function searchPool(): SearchResult[] {
  const pool = [...searchResults];
  for (const d of entryDays) {
    for (const e of d.items) {
      if (pool.some((p) => p.name === e.name && p.amount.paise === e.amount.paise)) continue;
      pool.push({ name: e.name, icon: e.icon, amount: e.amount, category: e.category, via: e.via, source: e.source, income: e.income, when: d.day });
    }
  }
  return pool;
}

export function runSearch(query: string, range: AmountRange, source: EntrySourceKey | 'all'): SearchResult[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return searchPool().filter(
    (r) =>
      (r.name.toLowerCase().includes(q) || r.category.toLowerCase().includes(q)) &&
      Math.abs(r.amount.paise) >= range.min &&
      Math.abs(r.amount.paise) <= range.max &&
      (source === 'all' || r.source === source),
  );
}

export { recentSearches };
