import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { persistStorage, registerPersisted } from '../lib/persistence';

export type MoneySegment = 'summary' | 'entries';

type MoneySegmentState = { last: MoneySegment; setLast: (s: MoneySegment) => void };

/** Money remembers whether you were last on Summary or Entries. Kept on this phone. */
export const useMoneySegment = registerPersisted(
  create<MoneySegmentState>()(
    persist(
      (set) => ({
        last: 'summary',
        setLast: (last) => {
          set({ last });
        },
      }),
      {
        name: 'bacchat.moneySegment',
        version: 1,
        storage: persistStorage<{ last: MoneySegment }>(),
        partialize: (s) => ({ last: s.last }),
        merge: (persisted, current) => {
          const last = (persisted as { last?: unknown } | undefined)?.last;
          return { ...current, last: last === 'entries' || last === 'summary' ? last : current.last };
        },
      },
    ),
  ),
);
