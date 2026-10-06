import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { persistStorage, registerPersisted } from '../../lib/persistence';

export type NudgeAt = '80' | '90' | '100';

type State = {
  /** The overall monthly budget in paise. Category limits live in the database (Budget rows). */
  totalPaise: number;
  nudge: NudgeAt;
  rollover: boolean;
};

type Actions = {
  save: (next: State) => void;
  reset: () => void;
};

/** The design's sample monthly budget: Rs 45,000. */
const initial = (): State => ({ totalPaise: 4500000, nudge: '90', rollover: true });

/** Budget preferences shared by k15 (view) and k16 (edit). Kept on this phone. */
export const useBudget = registerPersisted(
  create<State & Actions>()(
    persist(
      (set) => ({
        ...initial(),
        save: (next) => {
          set(next);
        },
        reset: () => {
          set(initial());
        },
      }),
      {
        name: 'bacchat.budget',
        version: 2,
        storage: persistStorage<State>(),
        partialize: (s): State => ({ totalPaise: s.totalPaise, nudge: s.nudge, rollover: s.rollover }),
        migrate: (persisted) => {
          const p = (persisted ?? {}) as Partial<State>;
          return { ...initial(), totalPaise: p.totalPaise ?? 4500000, nudge: p.nudge ?? '90', rollover: p.rollover ?? true };
        },
      },
    ),
  ),
);
