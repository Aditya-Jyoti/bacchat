import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { budgets, budgetSummary } from '../../data';
import { persistStorage, registerPersisted } from '../../lib/persistence';

export type NudgeAt = '80' | '90' | '100';

type State = {
  totalPaise: number;
  /** Limit per category name, in paise. */
  limits: Record<string, number>;
  nudge: NudgeAt;
  rollover: boolean;
  /** True after "Okay" on the Eating out caution. */
  cautionDismissed: boolean;
};

type Actions = {
  save: (next: Pick<State, 'totalPaise' | 'limits' | 'nudge' | 'rollover'>) => void;
  setLimit: (name: string, paise: number) => void;
  dismissCaution: () => void;
  reset: () => void;
};

const initial = (): State => ({
  totalPaise: budgetSummary.total.paise,
  limits: Object.fromEntries(budgets.map((b) => [b.name, b.limit.paise])),
  nudge: '90',
  rollover: true,
  cautionDismissed: false,
});

/** Budget settings shared by k15 (view) and k16 (edit). Kept on this phone. */
export const useBudget = registerPersisted(
  create<State & Actions>()(
    persist(
      (set) => ({
        ...initial(),
        save: (next) => {
          set({ ...next, cautionDismissed: false });
        },
        setLimit: (name, paise) => {
          set((s) => ({ limits: { ...s.limits, [name]: paise } }));
        },
        dismissCaution: () => {
          set({ cautionDismissed: true });
        },
        reset: () => {
          set(initial());
        },
      }),
      {
        name: 'bacchat.budget',
        version: 1,
        storage: persistStorage<State>(),
        partialize: (s): State => ({
          totalPaise: s.totalPaise,
          limits: s.limits,
          nudge: s.nudge,
          rollover: s.rollover,
          cautionDismissed: s.cautionDismissed,
        }),
      },
    ),
  ),
);
