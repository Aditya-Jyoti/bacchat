/**
 * Change notification over the repositories. Every write (put, putMany, remove, addSource,
 * confirm, record) emits once after it finishes, so reactive queries can re-run.
 *
 * Read cache: list() on each table is read from the database once and shared by every query until
 * the next write to any table (or notify() / wipe()). Screens run many queries that each list the
 * same tables, so this saves most of the SQLite reads and JSON decoding. Cached records are frozen
 * and each caller gets its own array, so a caller can sort or filter freely but cannot change a
 * shared record by accident.
 */
import type { BacchatDb } from '../data/db';

export type ObservableDb = BacchatDb & {
  /** Subscribe to writes. Returns an unsubscribe function. */
  onChange(listener: () => void): () => void;
  /** Bumped on every write. */
  version(): number;
  /** Emit by hand, for example after a bulk change made outside the repositories. */
  notify(): void;
};

const WRITE_METHODS = new Set(['put', 'putMany', 'remove', 'addSource', 'confirm', 'record']);
const REPOS = [
  'accounts',
  'debts',
  'entries',
  'categories',
  'merchants',
  'goals',
  'allocations',
  'budgets',
  'recurring',
  'upiIds',
  'holdings',
  'alerts',
  'screenshots',
  'asks',
] as const;

export function observeDb(db: BacchatDb): ObservableDb {
  const listeners = new Set<() => void>();
  let version = 0;
  const lists = new Map<string, Promise<readonly unknown[]>>();
  const notify = (): void => {
    version += 1;
    [...listeners].forEach((l) => l());
  };
  const notifyAll = (): void => {
    lists.clear();
    notify();
  };
  const wrap = <R extends object>(name: string, repo: R): R =>
    new Proxy(repo, {
      get(target, prop) {
        const v = Reflect.get(target, prop, target) as unknown;
        if (typeof prop === 'string' && typeof v === 'function') {
          const fn = v as (...a: unknown[]) => unknown;
          if (prop === 'list' && fn.length === 0) {
            return async () => {
              let p = lists.get(name);
              if (!p) {
                p = (fn.call(target) as Promise<unknown[]>).then((rows) => rows.map((r) => (r && typeof r === 'object' ? Object.freeze(r) : r)));
                lists.set(name, p);
                // A failed read is not kept.
                p.catch(() => lists.get(name) === p && lists.delete(name));
              }
              return [...(await p)];
            };
          }
          if (!WRITE_METHODS.has(prop)) return fn.bind(target);
          return async (...args: unknown[]) => {
            // Any write clears every table's cache: some reads are derived from other tables
            // (account balances follow entries, merchant history follows entries).
            lists.clear();
            try {
              return await fn.apply(target, args);
            } finally {
              // Clear again: a read that started during the write may have cached the old rows.
              lists.clear();
              notify();
            }
          };
        }
        return v;
      },
    });
  const out: Record<string, unknown> = {
    kind: db.kind,
    meta: db.meta,
    wipe: async () => {
      lists.clear();
      await db.wipe();
      notifyAll();
    },
    close: () => db.close(),
  };
  for (const name of REPOS) out[name] = wrap(name, db[name] as object);
  out.onChange = (l: () => void) => {
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  };
  out.version = () => version;
  out.notify = notifyAll;
  return out as unknown as ObservableDb;
}
