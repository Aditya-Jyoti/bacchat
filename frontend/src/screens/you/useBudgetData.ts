import { useMemo } from 'react';

import { dayOfMonth, daysInMonth, type Budget } from '../../data/db';
import { useBudgetPace, useDbQuery, useNow, useSpendByCategory } from '../../services';

export type BudgetRowData = {
  budgetId: string;
  categoryId: string;
  name: string;
  icon: string;
  spentPaise: number;
  limitPaise: number;
};

export type BudgetData = {
  loading: boolean;
  now: number;
  /** All spend this month, in paise. */
  spentPaise: number;
  daysLeft: number;
  daysInMonth: number;
  dayOfMonth: number;
  rows: BudgetRowData[];
};

/** Category names and icons by id. */
export function useCategoryMap(): Map<string, { name: string; icon: string }> {
  const q = useDbQuery((db) => db.categories.list());
  return useMemo(() => new Map((q.data ?? []).map((c) => [c.id, { name: c.name, icon: c.icon }] as const)), [q.data]);
}

/** Month pace for every category budget plus the month's total spend. */
export function useBudgetData(): BudgetData {
  const pace = useBudgetPace();
  const spend = useSpendByCategory();
  const cats = useCategoryMap();
  const now = useNow();
  const dim = daysInMonth(now);
  const day = dayOfMonth(now);
  const rows = useMemo<BudgetRowData[]>(
    () =>
      (pace.data ?? []).map((p) => ({
        budgetId: p.budgetId,
        categoryId: p.categoryId,
        name: cats.get(p.categoryId)?.name ?? p.categoryId,
        icon: cats.get(p.categoryId)?.icon ?? 'category',
        spentPaise: p.spentPaise,
        limitPaise: p.limitPaise,
      })),
    [pace.data, cats],
  );
  return {
    loading: pace.loading || spend.loading || !pace.data || !spend.data,
    now,
    spentPaise: spend.data?.totalPaise ?? 0,
    daysLeft: dim - day,
    daysInMonth: dim,
    dayOfMonth: day,
    rows,
  };
}

export type EditableBudget = Budget & { name: string; icon: string };

/** Budget rows with their category names, for the edit screen. */
export function useEditableBudgets(): { loading: boolean; budgets: EditableBudget[] } {
  const q = useDbQuery((db) => db.budgets.list());
  const cats = useCategoryMap();
  const budgets = useMemo(
    () =>
      (q.data ?? []).map((b) => ({ ...b, name: cats.get(b.categoryId)?.name ?? b.categoryId, icon: cats.get(b.categoryId)?.icon ?? 'category' })),
    [q.data, cats],
  );
  return { loading: q.loading || !q.data, budgets };
}
