import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { persistStorage, registerPersisted } from '../../lib/persistence';

type FirstRunState = { seen: boolean; markSeen: () => void };

/** Whether the welcome has been shown. Kept on this phone. */
export const useFirstRun = registerPersisted(
  create<FirstRunState>()(
    persist(
      (set) => ({
        seen: false,
        markSeen: () => {
          set({ seen: true });
        },
      }),
      {
        name: 'bacchat.firstRun',
        version: 1,
        storage: persistStorage<{ seen: boolean }>(),
        partialize: (s) => ({ seen: s.seen }),
      },
    ),
  ),
);
