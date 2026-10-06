import type { BacchatDb } from '../../data/db/repositories';

const esc = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Defence in depth: every string that must never leave the device (payee names, account names,
 * UPI handles, notes, message references). Tool results are scanned against this list before they
 * are sent; a hit blocks the result. Labels the user chose for goals and categories are allowed
 * because answers need them, so they are removed from the list.
 */
export async function buildSensitiveTerms(db: BacchatDb): Promise<string[]> {
  const [entries, merchants, accounts, upis, cats, goals] = await Promise.all([
    db.entries.between(0, 8_640_000_000_000_000),
    db.merchants.list(),
    db.accounts.list(),
    db.upiIds.list(),
    db.categories.list(),
    db.goals.list(),
  ]);
  const terms = new Set<string>();
  for (const e of entries) {
    terms.add(e.merchant);
    if (e.note) terms.add(e.note);
    for (const s of e.sources) if (s.rawRef) terms.add(s.rawRef);
  }
  for (const m of merchants) terms.add(m.name);
  for (const a of accounts) terms.add(a.name);
  for (const u of upis) {
    terms.add(u.handle);
    if (u.label) terms.add(u.label);
  }
  const allowed = new Set([...cats.map((c) => c.name), ...goals.map((g) => g.name)].map((x) => x.toLowerCase()));
  return [...terms]
    .map((t) => t.trim())
    .filter((t) => t.length >= 3 && !/^[\d.,\s]+$/.test(t) && !allowed.has(t.toLowerCase()))
    .filter((t, i, arr) => arr.indexOf(t) === i);
}

/** Returns the first sensitive term found in the serialised value, or null. */
export function findLeak(serialised: string, terms: readonly string[]): string | null {
  for (const t of terms) {
    const re = new RegExp(`(?<![A-Za-z0-9])${esc(t)}(?![A-Za-z0-9])`, 'i');
    if (re.test(serialised)) return t;
  }
  return null;
}
