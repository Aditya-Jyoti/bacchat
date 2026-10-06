import { useCallback, useEffect, useRef, useState } from 'react';

import type { ObservableDb } from './observable';
import { useServices } from './AppServicesProvider';

export type QueryResult<T> = {
  /** Undefined until the first result arrives. Kept while a refresh runs. */
  data: T | undefined;
  loading: boolean;
  error: Error | null;
  /** Re-run now. Resolves when the new result is in. */
  refresh(): Promise<void>;
};

/**
 * Run an async read over the database and re-run it whenever the database changes (any put,
 * remove, confirm, ...), when `deps` change, or on refresh(). `now` is services.now() at run time.
 * The selector may close over props; list those props in deps.
 */
export function useDbQuery<T>(
  selector: (db: ObservableDb, now: number) => Promise<T>,
  deps: readonly unknown[] = [],
): QueryResult<T> {
  const services = useServices();
  const [state, setState] = useState<{ data: T | undefined; loading: boolean; error: Error | null }>({
    data: undefined,
    loading: true,
    error: null,
  });
  const selectorRef = useRef(selector);
  selectorRef.current = selector;
  const seq = useRef(0);
  const alive = useRef(true);

  const run = useCallback(async (): Promise<void> => {
    const mine = ++seq.current;
    try {
      await services.whenReady();
      const data = await selectorRef.current(services.db, services.now());
      if (alive.current && mine === seq.current) setState({ data, loading: false, error: null });
    } catch (e) {
      if (alive.current && mine === seq.current) {
        setState((s) => ({ data: s.data, loading: false, error: e instanceof Error ? e : new Error(String(e)) }));
      }
    }
  }, [services]);

  useEffect(() => {
    alive.current = true;
    setState((s) => (s.loading ? s : { ...s, loading: true }));
    void run();
    const off = services.db.onChange(() => {
      void run();
    });
    return () => {
      alive.current = false;
      off();
    };
    // deps is the caller's dependency list.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run, services, ...deps]);

  return { ...state, refresh: run };
}
