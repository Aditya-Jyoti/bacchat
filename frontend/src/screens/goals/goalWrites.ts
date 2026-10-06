import { newId, type BacchatDb } from '../../data/db';

export type AllocationInput = { accountId: string; paise: number };

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
 * Set aside more (positive: into the first account that already holds this goal, else the first bank
 * or cash account) or take out (negative: from the last accounts first). Returns what actually moved.
 */
export async function adjustAllocation(db: BacchatDb, goalId: string, deltaPaise: number): Promise<number> {
  const existing = (await db.allocations.list()).filter((a) => a.goalId === goalId && a.amountPaise > 0);
  if (deltaPaise >= 0) {
    if (deltaPaise === 0) return 0;
    const first = existing[0];
    if (first) {
      await db.allocations.put({ ...first, amountPaise: first.amountPaise + deltaPaise });
      return deltaPaise;
    }
    const acct = (await db.accounts.list()).find((a) => a.kind === 'bank' || a.kind === 'cash');
    if (!acct) return 0;
    await db.allocations.put({ id: allocId(goalId, acct.id), goalId, accountId: acct.id, amountPaise: deltaPaise });
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
};

/** Write a Goal and its allocation rows. Returns the new goal id. */
export async function createGoal(db: BacchatDb, input: NewGoalInput): Promise<string> {
  const id = newId('goal');
  await db.goals.put({ id, name: input.name, icon: input.icon, targetPaise: input.targetPaise, targetDate: input.targetDate });
  await saveAllocations(db, id, input.allocations);
  return id;
}
