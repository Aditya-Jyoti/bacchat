/**
 * Ready-made reactive reads. Everything returned is integer paise (or counts); format in screens.
 */
import { useMemo } from 'react';

import {
  budgetPace,
  cashFlowByMonth,
  dailyTotals,
  goalTotals,
  netWorth,
  spendable,
  spendByCategory,
  upcoming,
  upiFlows,
  type BudgetPace,
  type DailySpend,
  type GoalTotal,
  type MonthlyFlow,
  type MonthSpend,
  type NetWorth,
  type UpcomingItem,
  type UpiFlow,
} from '../data/db/queries';
import { accountsWithBalances, ledger } from '../data/db/queries/balances';
import type { Account, DebtCard, Entry, EntryDirection, EntrySourceKind, EntryStatus, Goal, PayMethod } from '../data/db/models';
import { useDbQuery, type QueryResult } from './useDbQuery';
import { useServices } from './AppServicesProvider';
import type { ObservableDb } from './observable';

export type DateRange = { fromMs: number; toMs: number };

export type EntryFilter = {
  categoryId?: string | null;
  accountId?: string;
  upiId?: string;
  method?: PayMethod;
  direction?: EntryDirection;
  status?: EntryStatus;
  source?: EntrySourceKind;
  /** Case-insensitive text in merchant, note or category id. */
  text?: string;
  minPaise?: number;
  maxPaise?: number;
};

export type Spendable = { paise: number; liquidPaise: number; cardDuesPaise: number };
export type GoalWithTotal = { goal: Goal; total: GoalTotal };
export type DebtWithAccount = DebtCard & { name: string; icon: string };

export function useNetWorth(): QueryResult<NetWorth> {
  return useDbQuery((db) => netWorth(db));
}

/** "Yours to spend": liquid money minus card dues. */
export function useSpendable(): QueryResult<Spendable> {
  return useDbQuery((db) => spendable(db));
}

/** Spend by category for the month containing now, with last month's total and per-category change. */
export function useSpendByCategory(): QueryResult<MonthSpend> {
  return useDbQuery((db, now) => spendByCategory(db, now));
}

export function useDailyTotals(): QueryResult<DailySpend> {
  return useDbQuery((db, now) => dailyTotals(db, now));
}

export function useCashFlow(months = 6): QueryResult<MonthlyFlow[]> {
  return useDbQuery((db, now) => cashFlowByMonth(db, now, months), [months]);
}

export function useGoalsWithTotals(): QueryResult<GoalWithTotal[]> {
  return useDbQuery(async (db) => {
    const [goals, totals] = await Promise.all([db.goals.list(), goalTotals(db)]);
    const byId = new Map(totals.map((t) => [t.goalId, t] as const));
    return goals.map((goal) => ({
      goal,
      total: byId.get(goal.id) ?? {
        goalId: goal.id,
        savedPaise: 0,
        targetPaise: goal.targetPaise,
        remainingPaise: goal.targetPaise,
        pct: 0,
        parts: [],
      },
    }));
  });
}

export function useBudgetPace(): QueryResult<BudgetPace[]> {
  return useDbQuery((db, now) => budgetPace(db, now));
}

/** Upcoming bills, SIPs and card dues for the next `days` days, soonest first. */
export function useUpcoming(days = 45): QueryResult<UpcomingItem[]> {
  return useDbQuery((db, now) => upcoming(db, now, days), [days]);
}

/** Money in and out per UPI id. Defaults to the month containing now. */
export function useUpiFlows(range?: DateRange): QueryResult<UpiFlow[]> {
  return useDbQuery((db, now) => upiFlows(db, now, range), [range?.fromMs, range?.toMs]);
}

const ALL: DateRange = { fromMs: 0, toMs: Number.MAX_SAFE_INTEGER };

export function matchesFilter(e: Entry, f: EntryFilter): boolean {
  if (f.categoryId !== undefined && e.categoryId !== f.categoryId) return false;
  if (f.accountId && e.accountId !== f.accountId) return false;
  if (f.upiId && e.upiId !== f.upiId) return false;
  if (f.method && e.method !== f.method) return false;
  if (f.direction && e.direction !== f.direction) return false;
  if (f.status && e.status !== f.status) return false;
  if (f.source && !e.sources.some((s) => s.kind === f.source)) return false;
  if (f.minPaise != null && e.amountPaise < f.minPaise) return false;
  if (f.maxPaise != null && e.amountPaise > f.maxPaise) return false;
  if (f.text) {
    const t = f.text.trim().toLowerCase();
    if (t && !`${e.merchant} ${e.note ?? ''} ${e.categoryId ?? ''}`.toLowerCase().includes(t)) return false;
  }
  return true;
}

/** Live entries in `range` (default: all time) that match `filter`, newest first. */
export function useEntries(opts: { range?: DateRange; filter?: EntryFilter } = {}): QueryResult<Entry[]> {
  const range = opts.range ?? ALL;
  const filterKey = JSON.stringify(opts.filter ?? {});
  return useDbQuery(
    async (db) => {
      const f = JSON.parse(filterKey) as EntryFilter;
      return (await db.entries.between(range.fromMs, range.toMs)).filter((e) => matchesFilter(e, f));
    },
    [range.fromMs, range.toMs, filterKey],
  );
}

/** Entries waiting for the user to confirm, newest first. */
export function useToReviewEntries(): QueryResult<Entry[]> {
  return useDbQuery((db) => db.entries.toReview());
}

export function useAccounts(): QueryResult<Account[]> {
  return useDbQuery((db) => accountsWithBalances(db));
}

/** Card dues and loans, each with its account name. Debt is always listed on its own. */
export function useDebts(): QueryResult<DebtWithAccount[]> {
  return useDbQuery(async (db) => {
    const { accounts, debts } = await ledger(db);
    const byId = new Map(accounts.map((a) => [a.id, a] as const));
    return debts.map((d) => ({
      ...d,
      name: byId.get(d.accountId)?.name ?? '',
      icon: byId.get(d.accountId)?.icon ?? 'credit_card',
    }));
  });
}

/** The database with change notification, for writing: await db.entries.put(...) and every open query refreshes. */
export function useWriters(): ObservableDb {
  return useServices().db;
}

/** Current time from the services clock (sample day or real). Read at render; not reactive. */
export function useNow(): number {
  const s = useServices();
  return useMemo(() => s.now(), [s]);
}
