import { addDays, startOfDay } from '../dates';
import type { DebtCard } from '../models';
import { nextDueDate } from './dueDate';

/**
 * A credit card's billing cycle. On the bill day (say the 25th) everything owed so far becomes the
 * bill, due on the due day (the 9th); spends from the bill day on start the next cycle from zero.
 * Paying the bill is a move from a bank account into the card; payments made since the bill day
 * count against the bill first. Refunds in the new cycle lower this cycle's spends.
 */
export type CardCycle = {
  /** Start of the last bill day (the first day of the current cycle). */
  statementAt: number;
  /** Start of the next bill day. */
  nextStatementAt: number;
  /** The last bill: what was owed when it was made. */
  billPaise: number;
  /** Paid toward it since the bill day. */
  paidPaise: number;
  /** Still to pay on the last bill. 0 once it is paid. */
  billLeftPaise: number;
  /** When the last bill is due. */
  billDueAt: number;
  /** Spent in the current cycle so far (not billed yet). */
  cyclePaise: number;
};

/** Start of the most recent day-of-month `day` on or before `now` (clamped to short months). */
export function lastBillDay(day: number, now: number): number {
  const d = new Date(startOfDay(now));
  const on = (y: number, m: number): number => new Date(y, m, Math.min(day, new Date(y, m + 1, 0).getDate())).getTime();
  const thisMonth = on(d.getFullYear(), d.getMonth());
  return thisMonth <= d.getTime() ? thisMonth : on(d.getFullYear(), d.getMonth() - 1);
}

/** Next bill day strictly after `statementAt`. */
export function nextBillDay(day: number, statementAt: number): number {
  const d = new Date(statementAt);
  return new Date(d.getFullYear(), d.getMonth() + 1, Math.min(day, new Date(d.getFullYear(), d.getMonth() + 2, 0).getDate())).getTime();
}

/** One dated change in what the card owes: + a spend, - a refund or payment; payment marks a move into the card. */
export type DueChange = { at: number; deltaPaise: number; payment: boolean };

/**
 * The cycle for a card with a bill day. totalPaise is what the card owes now (opening plus every
 * change); changes are the card's dated changes.
 */
export function cardCycle(debt: Pick<DebtCard, 'statementDay' | 'dueDay'>, totalPaise: number, openingPaise: number, changes: DueChange[], now: number): CardCycle | null {
  if (!debt.statementDay) return null;
  const statementAt = lastBillDay(debt.statementDay, now);
  let billPaise = openingPaise;
  let paidPaise = 0;
  for (const c of changes) {
    if (c.at < statementAt) billPaise += c.deltaPaise;
    else if (c.payment && c.deltaPaise < 0) paidPaise -= c.deltaPaise;
  }
  billPaise = Math.max(0, billPaise);
  const billLeftPaise = Math.max(0, Math.min(billPaise - paidPaise, Math.max(0, totalPaise)));
  return {
    statementAt,
    nextStatementAt: nextBillDay(debt.statementDay, statementAt),
    billPaise,
    paidPaise,
    billLeftPaise,
    billDueAt: nextDueDate(debt.dueDay, addDays(statementAt, 1)),
    cyclePaise: totalPaise - billLeftPaise,
  };
}
