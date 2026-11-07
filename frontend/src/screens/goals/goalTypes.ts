import type { ColorKey } from '../../data';

/** One account's share of a goal, in paise. */
export type GoalAlloc = { accountId: string; from: string; icon: string; paise: number; color: ColorKey };

/** A goal with its totals and per-account split, ready to show. */
export type GoalView = {
  id: string;
  name: string;
  icon: string;
  savedPaise: number;
  targetPaise: number;
  /** Display text such as "by 20 Dec" or "done in March". */
  by: string;
  /** Raw target date (date key or free text). */
  targetDate: string | null;
  /** The account the goal is kept in, if any. */
  accountId: string | null;
  allocations: GoalAlloc[];
};

export const isReached = (g: Pick<GoalView, 'savedPaise' | 'targetPaise'>): boolean => g.targetPaise > 0 && g.savedPaise >= g.targetPaise;

/** A goal with no target: an open-ended pot (round-ups, a rainy-day jar). Never "reached". */
export const isOpenEnded = (g: Pick<GoalView, 'targetPaise'>): boolean => !(g.targetPaise > 0);
