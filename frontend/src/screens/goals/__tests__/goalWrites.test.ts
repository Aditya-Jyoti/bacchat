/** Goal money kept in an account moves that account's balance both ways. */
import { accountsWithBalances, createMemoryDb } from '../../../data/db';
import { adjustAllocation, createGoal, deleteGoal, updateGoal } from '../goalWrites';

async function setup() {
  const db = createMemoryDb();
  await db.accounts.put({ id: 'acc-slice', name: 'Slice savings', kind: 'bank', balancePaise: 5000000, openingBalancePaise: 5000000, icon: 'account_balance' });
  const id = await createGoal(db, { name: 'Fun', icon: 'celebration', targetPaise: 5000000, targetDate: null, allocations: [{ accountId: 'acc-slice', paise: 1000000 }], accountId: 'acc-slice' });
  const balance = async () => (await accountsWithBalances(db)).find((a) => a.id === 'acc-slice')?.balancePaise;
  return { db, id, balance };
}

it('set aside more raises the account; take out lowers it, never below what the goal holds', async () => {
  const { db, id, balance } = await setup();
  expect(await balance()).toBe(6000000);
  expect(await adjustAllocation(db, id, 250000)).toBe(250000);
  expect(await balance()).toBe(6250000);
  expect(await adjustAllocation(db, id, -9999999)).toBe(-1250000);
  expect(await balance()).toBe(5000000);
  expect((await db.allocations.list()).filter((a) => a.goalId === id)).toEqual([]);
});

it('an account with entries keeps them: only the opening figure moves', async () => {
  const { db, id, balance } = await setup();
  await db.entries.put({ id: 'e1', amountPaise: 20000, direction: 'out', at: 1, merchant: 'Chai', categoryId: null, accountId: 'acc-slice', method: 'bank', sources: [], status: 'confirmed', aiAdded: false });
  expect(await balance()).toBe(5980000);
  await adjustAllocation(db, id, 100000);
  expect(await balance()).toBe(6080000);
});

it('editing the account a goal is kept in moves its money from one balance to the other', async () => {
  const { db, id, balance } = await setup();
  await db.accounts.put({ id: 'acc-hdfc', name: 'HDFC', kind: 'bank', balancePaise: 100000, openingBalancePaise: 100000, icon: 'account_balance' });
  await updateGoal(db, { id, name: 'Fun money', icon: 'celebration', targetPaise: 0, targetDate: null, accountId: 'acc-hdfc' });
  expect(await balance()).toBe(5000000);
  expect((await accountsWithBalances(db)).find((a) => a.id === 'acc-hdfc')?.balancePaise).toBe(1100000);
  expect(await db.goals.get(id)).toMatchObject({ name: 'Fun money', targetPaise: 0, accountId: 'acc-hdfc' });
  expect((await db.allocations.list()).filter((a) => a.goalId === id).map((a) => [a.accountId, a.amountPaise])).toEqual([['acc-hdfc', 1000000]]);
});

it('deleting a goal removes it and its shares; the money stays in the account', async () => {
  const { db, id, balance } = await setup();
  await deleteGoal(db, id);
  expect(await db.goals.get(id)).toBeNull();
  expect((await db.allocations.list()).filter((a) => a.goalId === id)).toEqual([]);
  expect(await balance()).toBe(6000000);
});
