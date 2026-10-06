import { create } from 'zustand';

import { budgets, budgetSummary } from '../../data';

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

/** Budget settings shared by k15 (view) and k16 (edit). In memory until the local database lands. */
export const useBudget = create<State & Actions>((set) => ({
  ...initial(),
  save: (next) => set({ ...next, cautionDismissed: false }),
  setLimit: (name, paise) => set((s) => ({ limits: { ...s.limits, [name]: paise } })),
  dismissCaution: () => set({ cautionDismissed: true }),
  reset: () => set(initial()),
}));
