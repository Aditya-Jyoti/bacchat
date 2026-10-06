import type { BacchatDb } from '../repositories';
import { addMonths, daysInMonth, dayOfMonth, monthKey, startOfMonth } from '../dates';

/** Round a number up to the next multiple of 500 rupees (in paise). */
export const RAISE_STEP_PAISE = 500 * 100;

export type BudgetPaceStatus = 'ok' | 'ahead' | 'over';

export type BudgetPace = {
  budgetId: string;
  categoryId: string;
  limitPaise: number;
  spentPaise: number;
  leftPaise: number;
  /** 0..1+ share of the limit used. */
  usedRatio: number;
  /** Where spend would be if it were even across the month. */
  expectedPaise: number;
  /** Month-end projection at the current pace. */
  projectedPaise: number;
  daysLeft: number;
  /** Remaining budget per remaining day (including today). Zero when over. */
  perDayPaise: number;
  status: BudgetPaceStatus;
  overByPaise: number;
};

/** A calm heads-up. Never an error: screens show it in the caution container. */
export type BudgetAlert = {
  categoryId: string;
  month: string;
  kind: 'over' | 'pace';
  overByPaise: number;
  /** Suggested new limit for the "Raise to" action. */
  raiseToPaise: number;
  limitPaise: number;
  spentPaise: number;
};

/** Pace for every budget for the month containing `now`. */
export async function budgetPace(db: BacchatDb, now: number): Promise<BudgetPace[]> {
  const [budgets, entries] = await Promise.all([
    db.budgets.list(),
    db.entries.between(startOfMonth(now), addMonths(now, 1)),
  ]);
  const spentBy = new Map<string, number>();
  for (const e of entries) {
    if (e.direction !== 'out' || !e.categoryId) continue;
    spentBy.set(e.categoryId, (spentBy.get(e.categoryId) ?? 0) + e.amountPaise);
  }
  const n = daysInMonth(now);
  const today = dayOfMonth(now);
  return budgets
    .filter((b) => b.monthlyPaise > 0)
    .map<BudgetPace>((b) => {
      const spent = spentBy.get(b.categoryId) ?? 0;
      const expected = Math.round((b.monthlyPaise * today) / n);
      const projected = Math.round((spent * n) / today);
      const daysLeft = n - today;
      const left = b.monthlyPaise - spent;
      const status: BudgetPaceStatus = spent > b.monthlyPaise ? 'over' : spent > expected * 1.15 && projected > b.monthlyPaise ? 'ahead' : 'ok';
      return {
        budgetId: b.id,
        categoryId: b.categoryId,
        limitPaise: b.monthlyPaise,
        spentPaise: spent,
        leftPaise: left,
        usedRatio: spent / b.monthlyPaise,
        expectedPaise: expected,
        projectedPaise: projected,
        daysLeft,
        perDayPaise: left > 0 ? Math.floor(left / (daysLeft + 1)) : 0,
        status,
        overByPaise: Math.max(0, -left),
      };
    });
}

function toAlert(p: BudgetPace, month: string): BudgetAlert | null {
  if (p.status === 'ok') return null;
  // "ahead" only warns once most of the budget is used, so early-month blips stay quiet.
  if (p.status === 'ahead' && p.usedRatio < 0.75) return null;
  const target = Math.max(p.spentPaise, p.status === 'ahead' ? p.projectedPaise : p.spentPaise);
  return {
    categoryId: p.categoryId,
    month,
    kind: p.status === 'over' ? 'over' : 'pace',
    overByPaise: p.overByPaise,
    raiseToPaise: Math.ceil(target / RAISE_STEP_PAISE) * RAISE_STEP_PAISE,
    limitPaise: p.limitPaise,
    spentPaise: p.spentPaise,
  };
}

/** Categories that currently deserve a heads-up (ignores whether one was already shown). */
export async function detectOverspend(db: BacchatDb, now: number): Promise<BudgetAlert[]> {
  const month = monthKey(now);
  return (await budgetPace(db, now)).map((p) => toAlert(p, month)).filter((a): a is BudgetAlert => a !== null);
}

/**
 * Calm alert rule: at most one alert per category per month. Returns only alerts not shown yet and
 * records them, so calling it again in the same month returns nothing for those categories.
 */
export async function takeBudgetAlerts(db: BacchatDb, now: number): Promise<BudgetAlert[]> {
  const fresh: BudgetAlert[] = [];
  for (const a of await detectOverspend(db, now)) {
    if (await db.alerts.has(a.categoryId, a.month)) continue;
    await db.alerts.record(a.categoryId, a.month, now);
    fresh.push(a);
  }
  return fresh;
}
