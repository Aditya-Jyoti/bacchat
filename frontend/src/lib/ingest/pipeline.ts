import type { BacchatDb } from '../../data/db/repositories';
import type { Entry, EntrySourceKind } from '../../data/db/models';
import { reconcileEntry, type ReconResult } from '../reconciliation';
import { newId } from '../../data/db/ids';
import { startOfDay, addDays } from '../../data/db/dates';
import type { Candidate } from './types';
import { categorise } from './categorise';

export type IngestOutcome =
  | { kind: 'added'; entry: Entry }
  | { kind: 'matched'; entry: Entry; recon: ReconResult }
  | { kind: 'conflict'; against: Entry; recon: ReconResult; candidate: Candidate }
  | { kind: 'duplicate'; entry: Entry }
  | { kind: 'ignored'; reason: 'low-confidence' };

export type IngestOptions = {
  /** Candidates below this confidence are ignored. Default 0.5. */
  minConfidence?: number;
};

const sourceKind = (c: Candidate): EntrySourceKind => c.source;

/**
 * Put a parsed candidate into the database following the architecture flow:
 * same-day match adds a second source; a clash is returned for the user to resolve (k9);
 * otherwise a new entry is inserted flagged toReview and aiAdded, with a category from history.
 * Re-delivery of the same message (same rawRef) is a no-op.
 */
export async function ingestCandidate(db: BacchatDb, c: Candidate, opts: IngestOptions = {}): Promise<IngestOutcome> {
  if (c.confidence < (opts.minConfidence ?? 0.5)) return { kind: 'ignored', reason: 'low-confidence' };
  const dayStart = startOfDay(c.at);
  const sameDay = await db.entries.between(dayStart, addDays(dayStart, 1));

  if (c.rawRef) {
    const dup = sameDay.find((e) => e.sources.some((s) => s.rawRef === c.rawRef));
    if (dup) return { kind: 'duplicate', entry: dup };
  }

  const pool = sameDay.filter((e) => e.direction === c.direction);
  const recon = reconcileEntry(
    { merchant: c.merchant ?? '', amountPaise: c.amountPaise, time: c.at },
    pool.map((e) => ({ id: e.id, merchant: e.merchant, amountPaise: e.amountPaise, time: e.at })),
  );
  if (recon.status === 'match' && recon.against?.id) {
    const updated = await db.entries.addSource(recon.against.id, { kind: sourceKind(c), rawRef: c.rawRef });
    if (updated) return { kind: 'matched', entry: updated, recon };
  }
  if (recon.status === 'conflict' && recon.against?.id) {
    const against = pool.find((e) => e.id === recon.against!.id)!;
    return { kind: 'conflict', against, recon, candidate: c };
  }

  const [history, cats] = await Promise.all([db.merchants.list(), db.categories.list()]);
  const guess = categorise(c.merchant, history, cats);
  const [accounts, upis] = await Promise.all([db.accounts.list(), db.upiIds.list()]);
  const last4 = c.cardLast4 ?? c.accountLast4;
  const account = last4 ? accounts.find((a) => a.last4 === last4) : undefined;
  const upi = c.upiHandle ? upis.find((u) => u.handle.toLowerCase() === c.upiHandle) : undefined;
  const entry = await db.entries.put({
    id: newId('e'),
    amountPaise: c.amountPaise,
    direction: c.direction,
    at: c.at,
    merchant: c.merchant ?? 'Unknown',
    note: null,
    categoryId: guess.categoryId,
    accountId: account?.id ?? upi?.accountId ?? null,
    method: c.method ?? (upi ? 'upi' : 'bank'),
    upiId: upi?.id ?? null,
    sources: [{ kind: sourceKind(c), rawRef: c.rawRef }],
    status: 'toReview',
    aiAdded: true,
  });
  return { kind: 'added', entry };
}
