/**
 * Change notification over the repositories. Every write (put, putMany, remove, addSource,
 * confirm, record) emits once after it finishes, so reactive queries can re-run.
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
  const notify = (): void => {
    version += 1;
    [...listeners].forEach((l) => l());
  };
  const wrap = <R extends object>(repo: R): R =>
    new Proxy(repo, {
      get(target, prop) {
        const v = Reflect.get(target, prop, target) as unknown;
        if (typeof prop === 'string' && typeof v === 'function') {
          const fn = v as (...a: unknown[]) => unknown;
          if (!WRITE_METHODS.has(prop)) return fn.bind(target);
          return async (...args: unknown[]) => {
            const out = await fn.apply(target, args);
            notify();
            return out;
          };
        }
        return v;
      },
    });
  const out: Record<string, unknown> = {
    kind: db.kind,
    meta: db.meta,
    wipe: async () => {
      await db.wipe();
      notify();
    },
    close: () => db.close(),
  };
  for (const name of REPOS) out[name] = wrap(db[name] as object);
  out.onChange = (l: () => void) => {
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  };
  out.version = () => version;
  out.notify = notify;
  return out as unknown as ObservableDb;
}
