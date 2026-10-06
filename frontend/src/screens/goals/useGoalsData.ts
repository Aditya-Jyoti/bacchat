import { useMemo } from 'react';

import type { ColorKey } from '../../data';
import { accountAllocations, type Account, type AccountAllocation } from '../../data/db';
import { useAccounts, useDbQuery, useGoalsWithTotals, useNow } from '../../services';
import { byText } from './sections/goalPlan';
import type { GoalAlloc, GoalView } from './goalTypes';

const COLORS: readonly ColorKey[] = ['p', 'k2', 'k3', 'k4'];

export type GoalsData = {
  loading: boolean;
  goals: GoalView[];
  /** Bank and cash accounts, the places money can be set aside in. */
  spendAccounts: Account[];
  /** Balance minus what is set aside, per bank or cash account. */
  free: AccountAllocation[];
  now: number;
};

/** Goals joined with their allocation split and account names. Reactive to every write. */
export function useGoalsData(): GoalsData {
  const g = useGoalsWithTotals();
  const a = useAccounts();
  const f = useDbQuery((db) => accountAllocations(db));
  const now = useNow();
  const accounts = a.data;
  const goals = useMemo<GoalView[]>(() => {
    if (!g.data || !accounts) return [];
    const byId = new Map(accounts.map((x) => [x.id, x] as const));
    return g.data.map(({ goal, total }) => ({
      id: goal.id,
      name: goal.name,
      icon: goal.icon,
      savedPaise: total.savedPaise,
      targetPaise: goal.targetPaise,
      by: byText(goal.targetDate),
      targetDate: goal.targetDate ?? null,
      allocations: total.parts
        .filter((p) => p.amountPaise > 0)
        .map<GoalAlloc>((p, i) => ({
          accountId: p.accountId,
          from: byId.get(p.accountId)?.name ?? '',
          icon: byId.get(p.accountId)?.icon ?? 'account_balance',
          paise: p.amountPaise,
          color: COLORS[i % COLORS.length],
        })),
    }));
  }, [g.data, accounts]);
  const spendAccounts = useMemo(() => (accounts ?? []).filter((x) => x.kind === 'bank' || x.kind === 'cash'), [accounts]);
  return {
    loading: g.loading || a.loading || !g.data || !accounts,
    goals,
    spendAccounts,
    free: f.data ?? [],
    now,
  };
}
