/**
 * Screenshot reconciliation. For each incoming entry, compare with same-day existing entries on
 * three signals: amount (exact), time (within 10 minutes), merchant (fuzzy).
 *   all three agree -> 'match'    (skipped; existing row gains a second source)
 *   two of three    -> 'conflict' (blocks import until resolved)
 *   otherwise       -> 'new'
 */

export type EntrySource = 'sms' | 'mail' | 'shot' | 'hand';

export type ReconEntry = {
  id?: string;
  merchant: string;
  /** Integer paise. */
  amountPaise: number;
  /** Epoch milliseconds. */
  time: number;
};

export type ReconStatus = 'match' | 'conflict' | 'new';

export type ReconSignals = { amount: boolean; time: boolean; merchant: boolean };

export type ReconResult = {
  status: ReconStatus;
  /** The best existing candidate for match and conflict. */
  against: ReconEntry | null;
  signals: ReconSignals;
  /** Merchant similarity 0..1 for the chosen candidate. */
  merchantScore: number;
};

export const TIME_WINDOW_MS = 10 * 60 * 1000;
export const MERCHANT_THRESHOLD = 0.75;

export function normalizeMerchant(s: string): string {
  return s
    .toLowerCase()
    .replace(/\(.*?\)/g, ' ')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
    }
    prev = cur;
  }
  return prev[b.length];
}

/** Fuzzy merchant similarity 0..1: edit-distance ratio, boosted when one name starts with the other. */
export function merchantSimilarity(a: string, b: string): number {
  const x = normalizeMerchant(a);
  const y = normalizeMerchant(b);
  if (!x || !y) return 0;
  if (x === y) return 1;
  const ratio = 1 - levenshtein(x, y) / Math.max(x.length, y.length);
  const prefix = x.startsWith(y) || y.startsWith(x) || x.split(' ')[0] === y.split(' ')[0];
  return prefix ? Math.max(ratio, 0.8) : ratio;
}

function sameDay(a: number, b: number): boolean {
  const x = new Date(a);
  const y = new Date(b);
  return (
    x.getFullYear() === y.getFullYear() && x.getMonth() === y.getMonth() && x.getDate() === y.getDate()
  );
}

function compare(candidate: ReconEntry, existing: ReconEntry): { signals: ReconSignals; score: number; count: number } {
  const merchantScore = merchantSimilarity(candidate.merchant, existing.merchant);
  const signals: ReconSignals = {
    amount: candidate.amountPaise === existing.amountPaise,
    time: Math.abs(candidate.time - existing.time) <= TIME_WINDOW_MS,
    merchant: merchantScore >= MERCHANT_THRESHOLD,
  };
  const count = Number(signals.amount) + Number(signals.time) + Number(signals.merchant);
  return { signals, score: merchantScore, count };
}

/** Classify one incoming entry against the existing entries of the same day. */
export function reconcileEntry(candidate: ReconEntry, existing: readonly ReconEntry[]): ReconResult {
  let best: { entry: ReconEntry; signals: ReconSignals; score: number; count: number } | null = null;
  for (const e of existing) {
    if (!sameDay(candidate.time, e.time)) continue;
    const c = compare(candidate, e);
    if (!best || c.count > best.count || (c.count === best.count && c.score > best.score)) {
      best = { entry: e, ...c };
    }
  }
  if (!best || best.count < 2) {
    return {
      status: 'new',
      against: null,
      signals: best?.signals ?? { amount: false, time: false, merchant: false },
      merchantScore: best?.score ?? 0,
    };
  }
  return {
    status: best.count === 3 ? 'match' : 'conflict',
    against: best.entry,
    signals: best.signals,
    merchantScore: best.score,
  };
}

/** Classify a batch. Each existing entry can be matched by one incoming entry only. */
export function reconcileBatch(
  incoming: readonly ReconEntry[],
  existing: readonly ReconEntry[],
): ReconResult[] {
  const used = new Set<ReconEntry>();
  return incoming.map((c) => {
    const pool = existing.filter((e) => !used.has(e));
    const r = reconcileEntry(c, pool);
    if (r.against) used.add(r.against);
    return r;
  });
}

/** True when any row is a conflict: import is blocked until each is resolved (k9). */
export function hasBlockingConflict(results: readonly ReconResult[]): boolean {
  return results.some((r) => r.status === 'conflict');
}
