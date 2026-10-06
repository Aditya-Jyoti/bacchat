/** Messages set aside because they look like an entry the user already has, with that entry loaded. */
import { useCallback, useEffect, useRef, useState } from 'react';

import type { Entry } from '../../../data/db/models';
import { useIngestService, useServices } from '../../../services';
import type { PendingChoice, PendingItem } from '../../../services/ingestPending';

export type PendingView = { item: PendingItem; existing: Entry | null };

export function usePendingConflicts(): {
  items: PendingView[];
  /** False until the first read is back. */
  ready: boolean;
  resolve: (id: string, choice: PendingChoice) => Promise<void>;
} {
  const services = useServices();
  const ingest = useIngestService();
  const [items, setItems] = useState<PendingView[]>([]);
  const [ready, setReady] = useState(false);
  const alive = useRef(true);

  const load = useCallback(async (): Promise<void> => {
    try {
      await services.whenReady();
      const pending = await ingest.pending();
      const views = await Promise.all(pending.map(async (item) => ({ item, existing: (await services.db.entries.get(item.againstId)) ?? null })));
      if (alive.current) {
        setItems(views);
        setReady(true);
      }
    } catch {
      if (alive.current) setReady(true);
    }
  }, [ingest, services]);

  useEffect(() => {
    alive.current = true;
    // State is only set after the reads come back, not synchronously.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
    const off = services.db.onChange(() => void load());
    return () => {
      alive.current = false;
      off();
    };
  }, [load, services]);

  const resolve = useCallback(
    async (id: string, choice: PendingChoice): Promise<void> => {
      await ingest.resolve(id, choice);
      await load();
    },
    [ingest, load],
  );

  return { items, ready, resolve };
}
