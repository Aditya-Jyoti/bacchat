import { newId, type BacchatDb } from '../../data/db';

export type AllocationInput = { accountId: string; paise: number };

/**
 * Account id for money set aside for a goal without saying which account holds it. Used when the
 * notebook has no bank or cash account, so saving for a goal never needs one.
 */
export const UNASSIGNED = 'unassigned';

const allocId = (goalId: string, accountId: string): string => `alloc-${goalId}-${accountId}`;

/** Replace the split of a goal across the given accounts. Zero removes that account's row. */
export async function saveAllocations(db: BacchatDb, goalId: string, rows: readonly AllocationInput[]): Promise<void> {
  const existing = (await db.allocations.list()).filter((a) => a.goalId === goalId);
  for (const r of rows) {
    const have = existing.find((a) => a.accountId === r.accountId);
    if (r.paise > 0) {
      await db.allocations.put({ id: have?.id ?? allocId(goalId, r.accountId), goalId, accountId: r.accountId, amountPaise: r.paise });
    } else if (have) {
      await db.allocations.remove(have.id);
    }
  }
}

/**
 * Raise (or lower) an account's balance by delta. Balances are derived from an opening figure plus
 * entries, so the opening figure moves; older accounts without one move their stored balance.
 */
export async function shiftAccountBalance(db: BacchatDb, accountId: string, deltaPaise: number): Promise<void> {
  if (!deltaPaise || accountId === UNASSIGNED) return;
  const prev = await db.accounts.get(accountId);
  if (!prev) return;
  if (prev.openingBalancePaise != null) await db.accounts.put({ ...prev, openingBalancePaise: prev.openingBalancePaise + deltaPaise });
  else await db.accounts.put({ ...prev, balancePaise: prev.balancePaise + deltaPaise });
}

/**
 * Set aside more or take out. A goal kept in an account: the money goes into (or comes out of) that
 * account's goal share and the account's balance moves with it. Otherwise the older rule: into the
 * first account that holds the goal, else UNASSIGNED; take out from the last accounts first, with
 * no balance change. Returns what actually moved.
 */
export async function adjustAllocation(db: BacchatDb, goalId: string, deltaPaise: number): Promise<number> {
  const goal = await db.goals.get(goalId);
  const keptIn = goal?.accountId ?? null;
  if (keptIn) {
    const id = allocId(goalId, keptIn);
    const have = await db.allocations.get(id);
    const current = have?.amountPaise ?? 0;
    const next = Math.max(0, current + deltaPaise);
    const moved = next - current;
    if (moved === 0) return 0;
    if (next > 0) await db.allocations.put({ id, goalId, accountId: keptIn, amountPaise: next });
    else if (have) await db.allocations.remove(id);
    await shiftAccountBalance(db, keptIn, moved);
    return moved;
  }
  const existing = (await db.allocations.list()).filter((a) => a.goalId === goalId && a.amountPaise > 0);
  if (deltaPaise >= 0) {
    if (deltaPaise === 0) return 0;
    const first = existing[0];
    if (first) {
      await db.allocations.put({ ...first, amountPaise: first.amountPaise + deltaPaise });
      return deltaPaise;
    }
    const acct = (await db.accounts.list()).find((a) => a.kind === 'bank' || a.kind === 'cash');
    const accountId = acct?.id ?? UNASSIGNED;
    await db.allocations.put({ id: allocId(goalId, accountId), goalId, accountId, amountPaise: deltaPaise });
    return deltaPaise;
  }
  let left = -deltaPaise;
  for (let i = existing.length - 1; i >= 0 && left > 0; i--) {
    const take = Math.min(left, existing[i].amountPaise);
    const rest = existing[i].amountPaise - take;
    if (rest > 0) await db.allocations.put({ ...existing[i], amountPaise: rest });
    else await db.allocations.remove(existing[i].id);
    left -= take;
  }
  return deltaPaise + left;
}

export type NewGoalInput = {
  name: string;
  icon: string;
  targetPaise: number;
  targetDate: string | null;
  allocations: readonly AllocationInput[];
  /** The account the goal is kept in (its money adds to that account's balance). */
  accountId?: string | null;
};

/**
 * Write a Goal and its allocation rows. Returns the new goal id. For a goal kept in an account,
 * the starting amount is set aside there and raises that account's balance.
 */
export async function createGoal(db: BacchatDb, input: NewGoalInput): Promise<string> {
  const id = newId('goal');
  const accountId = input.accountId ?? null;
  await db.goals.put({ id, name: input.name, icon: input.icon, targetPaise: input.targetPaise, targetDate: input.targetDate, accountId });
  if (accountId) {
    const total = input.allocations.reduce((s, a) => s + a.paise, 0);
    if (total > 0) await adjustAllocation(db, id, total);
  } else {
    await saveAllocations(db, id, input.allocations);
  }
  return id;
}

/**
 * Split an "already saved" amount across the chosen accounts (the remainder goes to the first). With
 * no accounts it is kept as UNASSIGNED, so it is never lost.
 */
export function splitSaved(totalPaise: number, accountIds: readonly string[]): AllocationInput[] {
  if (totalPaise <= 0) return [];
  if (accountIds.length === 0) return [{ accountId: UNASSIGNED, paise: totalPaise }];
  const each = Math.floor(totalPaise / accountIds.length / 100) * 100;
  return accountIds.map((accountId, i) => ({ accountId, paise: each + (i === 0 ? totalPaise - each * accountIds.length : 0) }));
}

export type GoalEdit = {
  id: string;
  name: string;
  icon: string;
  /** 0 means no target: an open-ended pot of money. */
  targetPaise: number;
  targetDate: string | null;
  accountId: string | null;
};

/**
 * Save changes to a goal. When the account it is kept in changes, its money moves too: off the old
 * account's balance and onto the new one's (or to "not in an account").
 */
export async function updateGoal(db: BacchatDb, edit: GoalEdit): Promise<void> {
  const prev = await db.goals.get(edit.id);
  if (!prev) return;
  const oldAcc = prev.accountId ?? null;
  const newAcc = edit.accountId ?? null;
  await db.goals.put({ ...prev, name: edit.name, icon: edit.icon, targetPaise: edit.targetPaise, targetDate: edit.targetDate, accountId: newAcc });
  if (oldAcc === newAcc) return;
  const rows = (await db.allocations.list()).filter((a) => a.goalId === edit.id && a.amountPaise > 0);
  const total = rows.reduce((s, a) => s + a.amountPaise, 0);
  for (const r of rows) {
    await db.allocations.remove(r.id);
    if (oldAcc && r.accountId === oldAcc) await shiftAccountBalance(db, oldAcc, -r.amountPaise);
  }
  if (total <= 0) return;
  const target = newAcc ?? UNASSIGNED;
  await db.allocations.put({ id: allocId(edit.id, target), goalId: edit.id, accountId: target, amountPaise: total });
  if (newAcc) await shiftAccountBalance(db, newAcc, total);
}

/**
 * Delete a goal and its share rows. Money it kept in an account stays in that account: the bank
 * still holds it, only the label goes.
 */
export async function deleteGoal(db: BacchatDb, id: string): Promise<void> {
  const rows = (await db.allocations.list()).filter((a) => a.goalId === id);
  for (const r of rows) await db.allocations.remove(r.id);
  await db.goals.remove(id);
}
