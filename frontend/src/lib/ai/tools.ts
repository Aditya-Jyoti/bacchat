/**
 * Read-only advisor tools. Each is a local function over the repositories that returns ONLY
 * aggregates: totals, counts, percentages and dates. Never merchant names, account names, UPI
 * handles, notes, message text or single transactions. User-chosen labels for goals and
 * categories are allowed because answers need them ("Goa with friends"); cards are anonymised as
 * "Card 1", "Card 2".
 */
import type { BacchatDb } from '../../data/db/repositories';
import {
  budgetPace,
  cashFlowByMonth,
  goalTotals,
  nextDueDate,
  spendByCategory,
  spendable,
  upcoming,
} from '../../data/db/queries';
import { dateKey, daysInMonth, monthKey, startOfDay } from '../../data/db/dates';
import { rupees } from './aggregates';

export type ToolDefinition = {
  name: string;
  description: string;
  input_schema: { type: 'object'; properties: Record<string, unknown>; required: string[]; additionalProperties: false };
};

export const TOOL_NAMES = ['goals', 'cash_flow', 'card_dues', 'affordability', 'spend_summary'] as const;
export type ToolName = (typeof TOOL_NAMES)[number];

export const TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    name: 'goals',
    description:
      'Read-only. Savings goals with target, amount set aside, remaining and percent. Amounts are in rupees.',
    input_schema: { type: 'object', properties: {}, required: [], additionalProperties: false },
  },
  {
    name: 'cash_flow',
    description:
      'Read-only. Money in and out per month for the last few months, plus what is coming up in the next 30 days. Amounts are in rupees.',
    input_schema: {
      type: 'object',
      properties: { months: { type: 'integer', minimum: 1, maximum: 12, description: 'How many months back, default 6.' } },
      required: [],
      additionalProperties: false,
    },
  },
  {
    name: 'card_dues',
    description:
      'Read-only. Credit card dues: outstanding amount, limit, percent used and the next due date for each card (cards are numbered, not named). Amounts are in rupees.',
    input_schema: { type: 'object', properties: {}, required: [], additionalProperties: false },
  },
  {
    name: 'affordability',
    description:
      'Read-only. Whether a purchase of a given amount fits: what is yours to spend now (banks and cash minus card dues), what is due in the next 30 days, and what would be left. Amounts are in rupees.',
    input_schema: {
      type: 'object',
      properties: { amount_rupees: { type: 'number', minimum: 0, description: 'Price of the purchase in rupees.' } },
      required: ['amount_rupees'],
      additionalProperties: false,
    },
  },
  {
    name: 'spend_summary',
    description:
      'Read-only. Spending for a month by category with the change versus the month before, and budget status per category. Amounts are in rupees.',
    input_schema: {
      type: 'object',
      properties: {
        month: { type: 'string', description: 'YYYY-MM, within the last 12 months. Defaults to this month.' },
      },
      required: [],
      additionalProperties: false,
    },
  },
];

export type ToolOutcome = { ok: true; value: unknown } | { ok: false; message: string };

export type AdvisorTools = {
  definitions: ToolDefinition[];
  run(name: string, input: unknown): Promise<ToolOutcome>;
};

const bad = (message: string): ToolOutcome => ({ ok: false, message });

function asObject(input: unknown): Record<string, unknown> {
  return input && typeof input === 'object' && !Array.isArray(input) ? (input as Record<string, unknown>) : {};
}

export function createAdvisorTools(db: BacchatDb, now: () => number = Date.now): AdvisorTools {
  const names = async (): Promise<Map<string, string>> => new Map((await db.categories.list()).map((c) => [c.id, c.name]));

  const impl: Record<ToolName, (input: Record<string, unknown>) => Promise<ToolOutcome>> = {
    async goals() {
      const [goals, totals] = await Promise.all([db.goals.list(), goalTotals(db)]);
      return {
        ok: true,
        value: {
          count: goals.length,
          goals: goals.map((g) => {
            const t = totals.find((x) => x.goalId === g.id)!;
            return {
              name: g.name,
              targetRupees: rupees(t.targetPaise),
              savedRupees: rupees(t.savedPaise),
              remainingRupees: rupees(t.remainingPaise),
              percent: t.pct,
              ...(g.targetDate ? { targetDate: g.targetDate } : {}),
            };
          }),
          totalSavedRupees: rupees(totals.reduce((s, t) => s + t.savedPaise, 0)),
        },
      };
    },

    async cash_flow(input) {
      const months = input.months === undefined ? 6 : input.months;
      if (typeof months !== 'number' || !Number.isInteger(months) || months < 1 || months > 12) {
        return bad('months must be a whole number from 1 to 12');
      }
      const t = now();
      const flow = await cashFlowByMonth(db, t, months);
      const ahead = await upcoming(db, t, 30);
      const out = ahead.filter((i) => i.direction === 'out').reduce((s, i) => s + i.amountPaise, 0);
      const inn = ahead.filter((i) => i.direction === 'in').reduce((s, i) => s + i.amountPaise, 0);
      const full = flow.slice(0, -1); // the current month is still in progress
      const avg = (f: (m: (typeof flow)[number]) => number): number =>
        full.length ? Math.round(full.reduce((s, m) => s + f(m), 0) / full.length) : 0;
      return {
        ok: true,
        value: {
          months: flow.map((m, i) => ({
            month: m.month,
            inRupees: rupees(m.inPaise),
            outRupees: rupees(m.outPaise),
            netRupees: rupees(m.inPaise - m.outPaise),
            inProgress: i === flow.length - 1,
          })),
          averageMonthlyInRupees: rupees(avg((m) => m.inPaise)),
          averageMonthlyOutRupees: rupees(avg((m) => m.outPaise)),
          next30Days: { outRupees: rupees(out), inRupees: rupees(inn), items: ahead.length },
        },
      };
    },

    async card_dues() {
      const [accounts, debts] = await Promise.all([db.accounts.list(), db.debts.list()]);
      const cardIds = new Set(accounts.filter((a) => a.kind === 'card').map((a) => a.id));
      const today = startOfDay(now());
      const cards = debts
        .filter((d) => cardIds.has(d.accountId))
        .map((d) => {
          const due = nextDueDate(d.dueDay, today);
          return { d, due };
        })
        .sort((a, b) => a.due - b.due)
        .map(({ d, due }, i) => ({
          label: `Card ${i + 1}`,
          outstandingRupees: rupees(d.outstandingPaise),
          limitRupees: rupees(d.limitPaise),
          percentUsed: d.limitPaise > 0 ? Math.round((d.outstandingPaise * 100) / d.limitPaise) : 0,
          nextDueDate: dateKey(due),
          daysUntilDue: Math.round((due - today) / 86_400_000),
        }));
      return { ok: true, value: { cards, totalOutstandingRupees: rupees(debts.filter((d) => cardIds.has(d.accountId)).reduce((s, d) => s + d.outstandingPaise, 0)) } };
    },

    async affordability(input) {
      const a = input.amount_rupees;
      if (typeof a !== 'number' || !Number.isFinite(a) || a < 0 || a > 1e9) return bad('amount_rupees must be a number of rupees, zero or more');
      const price = Math.round(a * 100);
      const t = now();
      const [s, ahead, flow] = await Promise.all([spendable(db), upcoming(db, t, 30), cashFlowByMonth(db, t, 4)]);
      const dueOut = ahead.filter((i) => i.direction === 'out' && i.kind !== 'cardDue').reduce((x, i) => x + i.amountPaise, 0);
      // Card dues are already subtracted from spendable, so count only other outflows and expected inflows.
      const dueIn = ahead.filter((i) => i.direction === 'in').reduce((x, i) => x + i.amountPaise, 0);
      const afterPurchase = s.paise - price;
      const afterUpcoming = afterPurchase - dueOut + dueIn;
      const past = flow.slice(0, -1);
      const avgOut = past.length ? Math.round(past.reduce((x, m) => x + m.outPaise, 0) / past.length) : 0;
      const verdict = afterUpcoming < 0 ? 'not_now' : avgOut > 0 && afterUpcoming < avgOut ? 'tight' : 'comfortable';
      return {
        ok: true,
        value: {
          purchaseRupees: rupees(price),
          yoursToSpendRupees: rupees(s.paise),
          cardDuesRupees: rupees(s.cardDuesPaise),
          otherDueNext30DaysRupees: rupees(dueOut),
          expectedInNext30DaysRupees: rupees(dueIn),
          leftAfterPurchaseRupees: rupees(afterPurchase),
          leftAfterPurchaseAndUpcomingRupees: rupees(afterUpcoming),
          averageMonthlySpendRupees: rupees(avgOut),
          verdict,
        },
      };
    },

    async spend_summary(input) {
      const t = now();
      let at = t;
      if (input.month !== undefined) {
        const m = typeof input.month === 'string' ? /^(\d{4})-(\d{2})$/.exec(input.month) : null;
        if (!m || +m[2] < 1 || +m[2] > 12) return bad('month must look like 2026-10');
        at = new Date(+m[1], +m[2] - 1, 15).getTime();
        const back = (new Date(t).getFullYear() - +m[1]) * 12 + new Date(t).getMonth() - (+m[2] - 1);
        if (back < 0 || back > 12) return bad('month must be this month or within the last 12 months');
      }
      const isCurrent = monthKey(at) === monthKey(t);
      const [sp, cats, pace] = await Promise.all([spendByCategory(db, at), names(), isCurrent ? budgetPace(db, t) : Promise.resolve([])]);
      const label = (id: string | null): string => (id ? (cats.get(id) ?? 'Other') : 'Uncategorised');
      const top = sp.categories.slice(0, 8);
      const rest = sp.categories.slice(8);
      const elapsed = isCurrent ? new Date(t).getDate() : daysInMonth(at);
      return {
        ok: true,
        value: {
          month: monthKey(at),
          totalRupees: rupees(sp.totalPaise),
          lastMonthTotalRupees: rupees(sp.lastMonthTotalPaise),
          changeRupees: rupees(sp.totalPaise - sp.lastMonthTotalPaise),
          averagePerDayRupees: rupees(elapsed > 0 ? Math.round(sp.totalPaise / elapsed) : 0),
          categories: [
            ...top.map((c) => ({
              category: label(c.categoryId),
              rupees: rupees(c.totalPaise),
              percentOfSpend: Math.round(c.share * 100),
              changeVsLastMonthRupees: rupees(c.deltaPaise),
              entries: c.count,
            })),
            ...(rest.length
              ? [
                  {
                    category: 'Everything else',
                    rupees: rupees(rest.reduce((s, c) => s + c.totalPaise, 0)),
                    percentOfSpend: Math.round(rest.reduce((s, c) => s + c.share, 0) * 100),
                    changeVsLastMonthRupees: rupees(rest.reduce((s, c) => s + c.deltaPaise, 0)),
                    entries: rest.reduce((s, c) => s + c.count, 0),
                  },
                ]
              : []),
          ],
          budgets: pace.map((p) => ({
            category: label(p.categoryId),
            limitRupees: rupees(p.limitPaise),
            spentRupees: rupees(p.spentPaise),
            status: p.status,
            overByRupees: rupees(p.overByPaise),
            daysLeft: p.daysLeft,
          })),
        },
      };
    },
  };

  return {
    definitions: TOOL_DEFINITIONS,
    async run(name, input) {
      const fn = (impl as Record<string, (i: Record<string, unknown>) => Promise<ToolOutcome>>)[name];
      if (!fn) return bad(`Unknown tool: ${name}`);
      try {
        return await fn(asObject(input));
      } catch {
        return bad('That could not be read right now.');
      }
    },
  };
}
