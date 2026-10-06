import { accountsWithBalances } from './balances';
import type { BacchatDb } from '../repositories';

export type GoalTotal = {
  goalId: string;
  savedPaise: number;
  targetPaise: number;
  remainingPaise: number;
  /** Whole percent, capped at 100. */
  pct: number;
  /** Per source account. */
  parts: { accountId: string; amountPaise: number }[];
};

export type AccountAllocation = {
  accountId: string;
  allocatedPaise: number;
  /** Balance minus allocated (negative when over-allocated). */
  freePaise: number;
};

export async function goalTotals(db: BacchatDb): Promise<GoalTotal[]> {
  const [goals, allocs] = await Promise.all([db.goals.list(), db.allocations.list()]);
  return goals.map((g) => {
    const mine = allocs.filter((a) => a.goalId === g.id);
    const savedPaise = mine.reduce((s, a) => s + a.amountPaise, 0);
    return {
      goalId: g.id,
      savedPaise,
      targetPaise: g.targetPaise,
      remainingPaise: Math.max(0, g.targetPaise - savedPaise),
      pct: g.targetPaise > 0 ? Math.min(100, Math.floor((savedPaise * 100) / g.targetPaise)) : 0,
      parts: mine.map((a) => ({ accountId: a.accountId, amountPaise: a.amountPaise })),
    };
  });
}

/** How much of each account's balance is set aside for goals. Allocations to deleted goals do not count. */
export async function accountAllocations(db: BacchatDb): Promise<AccountAllocation[]> {
  const [accounts, allocs, goals] = await Promise.all([accountsWithBalances(db), db.allocations.list(), db.goals.list()]);
  const liveGoals = new Set(goals.map((g) => g.id));
  return accounts
    .filter((a) => a.kind === 'bank' || a.kind === 'cash')
    .map((a) => {
      const allocatedPaise = allocs
        .filter((x) => x.accountId === a.id && liveGoals.has(x.goalId))
        .reduce((s, x) => s + x.amountPaise, 0);
      return { accountId: a.id, allocatedPaise, freePaise: a.balancePaise - allocatedPaise };
    });
}
