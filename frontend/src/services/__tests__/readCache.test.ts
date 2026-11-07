/** observeDb read cache: one database read per table between writes, cleared by any write. */
import { createMemoryDb } from '../../data/db';
import { observeDb } from '../observable';

function counted() {
  const raw = createMemoryDb();
  let reads = 0;
  const list = raw.categories.list.bind(raw.categories);
  raw.categories.list = async () => {
    reads += 1;
    return list();
  };
  return { db: observeDb(raw), reads: () => reads };
}

describe('observeDb read cache', () => {
  it('shares one read between queries until something is written', async () => {
    const { db, reads } = counted();
    await db.categories.put({ id: 'c1', name: 'Food', icon: 'restaurant' });
    const [a, b] = await Promise.all([db.categories.list(), db.categories.list()]);
    expect(a).toEqual(b);
    expect(a).not.toBe(b);
    await db.categories.list();
    expect(reads()).toBe(1);
    await db.entries.put({ id: 'e1', amountPaise: 100, direction: 'out', at: 1, merchant: 'X', categoryId: 'c1', accountId: null, method: 'upi', sources: [], status: 'confirmed', aiAdded: false });
    await db.categories.list();
    expect(reads()).toBe(2);
  });

  it('sees its own writes and wipes', async () => {
    const { db } = counted();
    await db.categories.list();
    await db.categories.put({ id: 'c2', name: 'Fuel', icon: 'local_gas_station' });
    expect((await db.categories.list()).map((c) => c.name)).toEqual(['Fuel']);
    await db.wipe();
    expect(await db.categories.list()).toEqual([]);
  });

  it('cached records are frozen; callers may still sort their own copy', async () => {
    const { db } = counted();
    await db.categories.putMany([
      { id: 'b', name: 'B', icon: 'x' },
      { id: 'a', name: 'A', icon: 'x' },
    ]);
    const rows = await db.categories.list();
    rows.sort((x, y) => x.name.localeCompare(y.name));
    expect(Object.isFrozen(rows[0])).toBe(true);
    expect(() => {
      'use strict';
      (rows[0] as { name: string }).name = 'Z';
    }).toThrow();
    expect((await db.categories.list()).map((c) => c.id).sort()).toEqual(['a', 'b']);
  });
});
