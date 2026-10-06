import { factories, entry } from './helpers';
import type { BacchatDb } from '../repositories';
import {
  SAMPLE_TODAY,
  accountsWithBalances,
  debtsWithOutstanding,
  ensureOpeningBalances,
  netWorth,
  seedFromSampleData,
  spendable,
  spendByCategory,
  upcoming,
} from '..';
import { createMemoryDb } from '../memory';

const D = SAMPLE_TODAY;

async function small(make: () => Promise<BacchatDb>): Promise<BacchatDb> {
  const db = await make();
  await db.accounts.putMany([
    { id: 'bank', name: 'Bank', kind: 'bank', balancePaise: 1_00_000_00, openingBalancePaise: 1_00_000_00, icon: 'x' },
    { id: 'bank2', name: 'Bank Two', kind: 'bank', balancePaise: 50_000_00, openingBalancePaise: 50_000_00, icon: 'x' },
    { id: 'cash', name: 'Cash', kind: 'cash', balancePaise: 2_000_00, openingBalancePaise: 2_000_00, icon: 'x' },
    { id: 'card', name: 'Card', kind: 'card', balancePaise: 0, openingBalancePaise: 0, icon: 'x' },
  ]);
  await db.debts.put({ id: 'dc', accountId: 'card', dueDay: 5, outstandingPaise: 10_000_00, openingOutstandingPaise: 10_000_00, limitPaise: 1_00_000_00 });
  await db.upiIds.put({ id: 'u1', handle: 'a@b', accountId: 'bank2' });
  return db;
}

describe.each(factories)('balances follow entries (%s)', (_n, make) => {
  it('a spend lowers the bank and net worth; income raises them', async () => {
    const db = await small(make);
    const before = await netWorth(db);
    await db.entries.put(entry({ id: 's', amountPaise: 500_00, at: D, accountId: 'bank', method: 'debit' }));
    const mid = await netWorth(db);
    expect(mid.ownBy.bank).toBe(before.ownBy.bank - 500_00);
    expect(mid.netPaise).toBe(before.netPaise - 500_00);
    await db.entries.put(entry({ id: 'i', amountPaise: 2_000_00, at: D, accountId: 'bank', direction: 'in', method: 'bank' }));
    expect((await netWorth(db)).ownBy.bank).toBe(before.ownBy.bank - 500_00 + 2_000_00);
    expect((await spendable(db)).liquidPaise).toBe(before.ownPaise + 1_500_00);
  });

  it('card spend raises what you owe and leaves what you own alone', async () => {
    const db = await small(make);
    const before = await netWorth(db);
    await db.entries.put(entry({ id: 'c', amountPaise: 3_000_00, at: D, accountId: 'card', method: 'card' }));
    const after = await netWorth(db);
    expect(after.ownPaise).toBe(before.ownPaise);
    expect(after.owePaise).toBe(before.owePaise + 3_000_00);
    expect(after.netPaise).toBe(before.netPaise - 3_000_00);
    expect((await spendable(db)).cardDuesPaise).toBe(13_000_00);
    // A refund lowers the dues again.
    await db.entries.put(entry({ id: 'r', amountPaise: 1_000_00, at: D, accountId: 'card', method: 'card', direction: 'in' }));
    expect((await netWorth(db)).owePaise).toBe(12_000_00);
  });

  it('UPI entries debit the linked account; cash entries use the cash wallet', async () => {
    const db = await small(make);
    await db.entries.put(entry({ id: 'u', amountPaise: 700_00, at: D, accountId: null, method: 'upi', upiId: 'u1' }));
    await db.entries.put(entry({ id: 'k', amountPaise: 200_00, at: D, accountId: null, method: 'cash' }));
    const by = Object.fromEntries((await accountsWithBalances(db)).map((a) => [a.id, a.balancePaise]));
    expect(by.bank2).toBe(50_000_00 - 700_00);
    expect(by.cash).toBe(2_000_00 - 200_00);
    expect(by.bank).toBe(1_00_000_00);
  });

  it('moved money leaves one account and reaches another; it is not spend', async () => {
    const db = await small(make);
    const before = await netWorth(db);
    await db.entries.put(entry({ id: 'm', amountPaise: 5_000_00, at: D, accountId: 'bank', transferToAccountId: 'bank2', method: 'bank' }));
    const by = Object.fromEntries((await accountsWithBalances(db)).map((a) => [a.id, a.balancePaise]));
    expect(by.bank).toBe(95_000_00);
    expect(by.bank2).toBe(55_000_00);
    expect((await netWorth(db)).netPaise).toBe(before.netPaise);
    expect((await spendByCategory(db, D)).totalPaise).toBe(0);
  });

  it('paying a card bill from a bank lowers both the bank and the dues', async () => {
    const db = await small(make);
    await db.entries.put(entry({ id: 'p', amountPaise: 4_000_00, at: D, accountId: 'bank', transferToAccountId: 'card', method: 'bank' }));
    const nw = await netWorth(db);
    expect(nw.ownBy.bank).toBe(1_00_000_00 + 50_000_00 - 4_000_00);
    expect(nw.owePaise).toBe(6_000_00);
    expect((await upcoming(db, D)).find((i) => i.kind === 'cardDue')?.amountPaise).toBe(6_000_00);
  });

  it('add then delete returns the same net worth, spendable and upcoming (property style)', async () => {
    const db = await small(make);
    const snap = async (): Promise<string> => JSON.stringify([await netWorth(db), await spendable(db), await upcoming(db, D)]);
    const base = await snap();
    let seed = 7;
    const rnd = (n: number): number => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed % n;
    };
    const ids = ['bank', 'bank2', 'cash', 'card', null];
    const methods = ['debit', 'upi', 'cash', 'card', 'bank'] as const;
    let changed = 0;
    for (let round = 0; round < 12; round++) {
      const added: string[] = [];
      for (let k = 0; k < 1 + rnd(5); k++) {
        const id = `p${round}-${k}`;
        const to = rnd(4) === 0 ? ids[rnd(4)] : null;
        await db.entries.put(
          entry({
            id,
            amountPaise: 1 + rnd(900_000),
            at: D - rnd(40) * 86_400_000,
            accountId: ids[rnd(5)],
            transferToAccountId: to,
            direction: rnd(3) === 0 ? 'in' : 'out',
            method: methods[rnd(5)],
            upiId: rnd(2) ? 'u1' : null,
          }),
        );
        added.push(id);
      }
      if ((await snap()) !== base) changed += 1;
      for (const id of added) await db.entries.remove(id);
      expect(await snap()).toBe(base);
    }
    expect(changed).toBeGreaterThan(6);
  });

  it('editing an entry moves the balance by the difference only', async () => {
    const db = await small(make);
    const e = await db.entries.put(entry({ id: 'x', amountPaise: 1_000_00, at: D, accountId: 'bank', method: 'debit' }));
    await db.entries.put({ ...e, amountPaise: 400_00 });
    expect((await netWorth(db)).ownBy.bank).toBe(1_00_000_00 + 50_000_00 - 400_00);
    await db.entries.put({ ...e, amountPaise: 400_00, accountId: 'bank2' });
    expect((await accountsWithBalances(db)).find((a) => a.id === 'bank')?.balancePaise).toBe(1_00_000_00);
  });

  it('a card account with entries but no debt record still shows its dues', async () => {
    const db = await make();
    await db.accounts.put({ id: 'card', name: 'Card', kind: 'card', balancePaise: 0, openingBalancePaise: 0, icon: 'x' });
    await db.entries.put(entry({ id: 'c', amountPaise: 900_00, at: D, accountId: 'card', method: 'card' }));
    expect((await debtsWithOutstanding(db))[0].outstandingPaise).toBe(900_00);
    expect((await netWorth(db)).owePaise).toBe(900_00);
  });

  it('writing a new balance onto an account re-bases it, and later entries still apply', async () => {
    const db = await small(make);
    await db.entries.put(entry({ id: 'a', amountPaise: 1_000_00, at: D, accountId: 'bank', method: 'debit' }));
    const raw = (await db.accounts.list()).find((a) => a.id === 'bank')!;
    await db.accounts.put({ ...raw, balancePaise: 2_00_000_00 });
    expect((await netWorth(db)).ownBy.bank).toBe(2_00_000_00 + 50_000_00);
    await db.entries.put(entry({ id: 'b', amountPaise: 1_00_00, at: D, accountId: 'bank', method: 'debit' }));
    expect((await netWorth(db)).ownBy.bank).toBe(2_00_000_00 + 50_000_00 - 1_00_00);
  });

  it('legacy accounts without an opening balance keep their stored figure until upgraded', async () => {
    const db = await make();
    await db.accounts.put({ id: 'l', name: 'Old', kind: 'bank', balancePaise: 9_000_00, icon: 'x' });
    await db.entries.put(entry({ id: 'o', amountPaise: 1_000_00, at: D, accountId: 'l', method: 'debit' }));
    expect((await netWorth(db)).ownBy.bank).toBe(9_000_00);
    expect(await ensureOpeningBalances(db)).toBe(true);
    expect((await netWorth(db)).ownBy.bank).toBe(9_000_00); // today's figure is unchanged by the upgrade
    expect((await db.accounts.get('l'))!.openingBalancePaise).toBe(10_000_00);
    await db.entries.put(entry({ id: 'o2', amountPaise: 500_00, at: D, accountId: 'l', method: 'debit' }));
    expect((await netWorth(db)).ownBy.bank).toBe(8_500_00);
    expect(await ensureOpeningBalances(db)).toBe(false);
  });

  it('the seeded sample keeps every design figure and then follows new entries', async () => {
    const db = await make();
    await seedFromSampleData(db);
    const nw = await netWorth(db);
    const sp = await spendable(db);
    expect(nw.netPaise).toBe(18_22_350_00);
    await db.entries.put(entry({ id: 'seed-new', amountPaise: 1_000_00, at: D, accountId: 'acc-hdfc', method: 'debit' }));
    const nw2 = await netWorth(db);
    expect(nw2.netPaise).toBe(nw.netPaise - 1_000_00);
    expect((await spendable(db)).paise).toBe(sp.paise - 1_000_00);
    await db.entries.put(entry({ id: 'seed-card', amountPaise: 2_000_00, at: D, accountId: 'acc-icici', method: 'card' }));
    const nw3 = await netWorth(db);
    expect(nw3.ownPaise).toBe(nw2.ownPaise);
    expect(nw3.owePaise).toBe(nw2.owePaise + 2_000_00);
    await db.entries.remove('seed-new');
    await db.entries.remove('seed-card');
    expect(await netWorth(db)).toEqual(nw);
  });
});

it('memory db: tombstoned entries do not count', async () => {
  const db = createMemoryDb();
  await db.accounts.put({ id: 'a', name: 'A', kind: 'bank', balancePaise: 100, openingBalancePaise: 100, icon: 'x' });
  await db.entries.put(entry({ id: 'z', amountPaise: 40, at: D, accountId: 'a', method: 'debit' }));
  await db.entries.remove('z');
  expect((await netWorth(db)).ownBy.bank).toBe(100);
});
