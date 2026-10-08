import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { persistStorage, registerPersisted } from '../../lib/persistence';

type State = {
  /** Planned monthly set-aside per goal id, in paise. Goals themselves live in the database. */
  monthly: Record<string, number>;
};

type Actions = {
  setMonthly: (goalId: string, paise: number) => void;
  /** Sample plan back (explore with sample data). */
  reset: () => void;
  /** No plans at all (a real, empty notebook). */
  clear: () => void;
};

/** The design's sample plan for the Goa goal: Rs 5,500 a month. */
const initial = (): State => ({ monthly: { 'goal-goa-with-friends': 550000 } });

/** Monthly plans chosen on k14, shown as the pace line on k13. Kept on this phone. */
export const useGoalPlans = registerPersisted(
  create<State & Actions>()(
    persist(
      (set) => ({
        ...initial(),
        setMonthly: (goalId, paise) => {
          set((s) => ({ monthly: { ...s.monthly, [goalId]: paise } }));
        },
        reset: () => {
          set(initial());
        },
        clear: () => {
          set({ monthly: {} });
        },
      }),
      {
        name: 'bacchat.goalplans',
        version: 1,
        storage: persistStorage<State>(),
        partialize: (s): State => ({ monthly: s.monthly }),
      },
    ),
  ),
);
