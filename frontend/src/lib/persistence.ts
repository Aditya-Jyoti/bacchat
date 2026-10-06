import { useEffect, useState } from 'react';
import { createJSONStorage, type PersistStorage } from 'zustand/middleware';

import { storage } from './storage';

/** zustand storage adapter over the key-value storage; swallows read and write errors. */
export function persistStorage<S>(): PersistStorage<S> {
  const safe = {
    getItem: async (key: string) => {
      try {
        return await storage.getItem(key);
      } catch {
        return null;
      }
    },
    setItem: async (key: string, value: string) => {
      try {
        await storage.setItem(key, value);
      } catch {
        /* keep working in memory */
      }
    },
    removeItem: async (key: string) => {
      try {
        await storage.removeItem(key);
      } catch {
        /* ignore */
      }
    },
  };
  return createJSONStorage<S>(() => safe) as PersistStorage<S>;
}

type Rehydratable = { persist: { rehydrate: () => Promise<void> | void; hasHydrated: () => boolean } };

const registry: Rehydratable[] = [];

/** Register a persisted store so the app can wait for all of them. Returns the store. */
export function registerPersisted<T extends Rehydratable>(store: T): T {
  registry.push(store);
  return store;
}

/** Re-read every registered store from storage and resolve when done. */
export async function hydrateAll(): Promise<void> {
  await Promise.all(registry.map((s) => Promise.resolve(s.persist.rehydrate())));
}

/** True once every registered store has loaded. Failures never block the app. */
export function useHydrated(): boolean {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let alive = true;
    hydrateAll()
      .catch(() => undefined)
      .then(() => {
        if (alive) setReady(true);
      });
    return () => {
      alive = false;
    };
  }, []);
  return ready;
}
