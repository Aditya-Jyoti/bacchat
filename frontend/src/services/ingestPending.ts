/**
 * Messages that look like an entry the user already has (a conflict). They are never inserted on
 * their own: they wait here, in the local database meta table, until the user picks. Kept on this phone.
 */
import type { BacchatDb } from '../data/db/repositories';
import type { Entry } from '../data/db/models';
import { insertCandidate, type Candidate } from '../lib/ingest';

const KEY = 'ingest.pending.v1';

export type PendingItem = {
  /** The message's rawRef. */
  id: string;
  candidate: Candidate;
  /** The existing entry it clashed with. */
  againstId: string;
  addedAt: number;
};

export type PendingChoice = 'keepExisting' | 'keepBoth';

export async function listPending(db: BacchatDb): Promise<PendingItem[]> {
  try {
    const raw = await db.meta.get(KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(parsed) ? (parsed as PendingItem[]) : [];
  } catch {
    return [];
  }
}

async function save(db: BacchatDb, items: PendingItem[]): Promise<void> {
  await db.meta.set(KEY, JSON.stringify(items));
}

/** Returns true when the item was new. */
export async function addPending(db: BacchatDb, item: PendingItem): Promise<boolean> {
  const items = await listPending(db);
  if (items.some((i) => i.id === item.id)) return false;
  await save(db, [...items, item]);
  return true;
}

/**
 * keepExisting: the message becomes a second source on the entry already there.
 * keepBoth: the message is added as its own To review entry.
 * Either way the message is remembered by its rawRef, so it never comes back as a conflict.
 */
export async function resolvePending(db: BacchatDb, id: string, choice: PendingChoice): Promise<Entry | null> {
  const items = await listPending(db);
  const item = items.find((i) => i.id === id);
  if (!item) return null;
  let result: Entry | null;
  if (choice === 'keepBoth') result = await insertCandidate(db, item.candidate);
  else result = await db.entries.addSource(item.againstId, { kind: item.candidate.source, rawRef: item.candidate.rawRef });
  await save(db, items.filter((i) => i.id !== id));
  return result;
}
