import type { Account, AccountAllocation } from '../../../data/db';
import { isReached, type GoalView } from '../goalTypes';
import { dueAt } from './goalPlan';

export type DueInsight = { name: string; remainingPaise: number; days: number; account: string };

const DAY = 86400000;
const WINDOW_DAYS = 30;

/** The soonest active goal due within a month that still needs money, and an account that can cover it today. */
export function dueInsight(
  goals: readonly GoalView[],
  accounts: readonly Account[],
  free: readonly AccountAllocation[],
  now: number,
): DueInsight | null {
  const today = new Date(now);
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const due = goals
    .filter((g) => !isReached(g))
    .map((g) => ({ g, at: dueAt(g.targetDate, now) }))
    .filter((x): x is { g: GoalView; at: number } => x.at !== null && x.at >= start && x.at - start <= WINDOW_DAYS * DAY)
    .sort((a, b) => a.at - b.at)[0];
  if (!due) return null;
  const remaining = due.g.targetPaise - due.g.savedPaise;
  const holders = new Set(due.g.allocations.map((a) => a.accountId));
  const cover = free
    .filter((f) => f.freePaise >= remaining)
    .sort((a, b) => Number(holders.has(b.accountId)) - Number(holders.has(a.accountId)) || b.freePaise - a.freePaise)[0];
  const account = cover ? accounts.find((a) => a.id === cover.accountId) : undefined;
  if (!account) return null;
  return { name: due.g.name, remainingPaise: remaining, days: Math.round((due.at - start) / DAY), account: account.name };
}
