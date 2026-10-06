import { create } from 'zustand';

import type { BudgetAlert } from '../../data/db/queries';

/**
 * Overspend alerts taken from the database (at most one per category per month) and not yet
 * answered. takeBudgetAlerts hands each alert out once, so they wait here until the user taps
 * "Raise to" or "Okay".
 */
type AlertsState = {
  alerts: BudgetAlert[];
  add: (fresh: BudgetAlert[]) => void;
  dismiss: (categoryId: string, month: string) => void;
  clear: () => void;
};

export const useBudgetAlerts = create<AlertsState>((set) => ({
  alerts: [],
  add: (fresh) =>
    set((s) => ({
      alerts: [...s.alerts, ...fresh.filter((f) => !s.alerts.some((a) => a.categoryId === f.categoryId && a.month === f.month))],
    })),
  dismiss: (categoryId, month) => set((s) => ({ alerts: s.alerts.filter((a) => !(a.categoryId === categoryId && a.month === month)) })),
  clear: () => set({ alerts: [] }),
}));
