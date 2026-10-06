import { factories, entry, ms } from './helpers';
import type { BacchatDb } from '../repositories';

describe.each(factories)('repositories (%s)', (_name, make) => {
  let db: BacchatDb;
  beforeEach(async () => {
    db = await make();
  });
  afterEach(async () => {
    await db.close();
  });

  it('puts, gets, lists and stamps updatedAt', async () => {
    const a = await db.accounts.put({ id: 'a1', name: 'HDFC', kind: 'bank', balancePaise: 1000, icon: 'x' });
    expect(a.updatedAt).toBeGreaterThan(0);
    expect(await db.accounts.get('a1')).toEqual(a);
    expect(await db.accounts.get('nope')).toBeNull();
    expect((await db.accounts.list()).map((x) => x.id)).toEqual(['a1']);
  });

  it('replaces on second put and keeps one row', async () => {
    await db.accounts.put({ id: 'a1', name: 'HDFC', kind: 'bank', balancePaise: 1000, icon: 'x' });
    const b = await db.accounts.put({ id: 'a1', name: 'HDFC', kind: 'bank', balancePaise: 2500, icon: 'x' });
    expect(b.balancePaise).toBe(2500);
    expect(await db.accounts.list()).toHaveLength(1);
  });

  it('remove is a tombstone: hidden from get and list but visible to changedSince', async () => {
    const a = await db.accounts.put({ id: 'a1', name: 'HDFC', kind: 'bank', balancePaise: 1, icon: 'x' });
    await db.accounts.remove('a1');
    expect(await db.accounts.get('a1')).toBeNull();
    expect(await db.accounts.list()).toEqual([]);
    const changed = await db.accounts.changedSince(a.updatedAt);
    expect(changed).toHaveLength(1);
    expect(changed[0].deletedAt).toBeGreaterThan(0);
    await db.accounts.remove('missing'); // no throw
  });

  it('putMany stores all and changedSince filters by time', async () => {
    const [x] = await db.categories.putMany([
      { id: 'c1', name: 'A', icon: 'a' },
      { id: 'c2', name: 'B', icon: 'b' },
    ]);
    const later = await db.categories.put({ id: 'c3', name: 'C', icon: 'c' });
    expect((await db.categories.list()).length).toBe(3);
    const ids = (await db.categories.changedSince(x.updatedAt + 1)).map((c) => c.id);
    expect(ids).toContain('c3');
    expect(ids).not.toContain('c1');
    expect(later.updatedAt).toBeGreaterThan(x.updatedAt);
  });

  it('stores every model type', async () => {
    await db.debts.put({ id: 'd1', accountId: 'a', dueDay: 5, outstandingPaise: 10, limitPaise: 100 });
    await db.goals.put({ id: 'g1', name: 'Goa', icon: 'b', targetPaise: 600000, targetDate: '2026-12-20' });
    await db.allocations.put({ id: 'ga1', goalId: 'g1', accountId: 'a', amountPaise: 5 });
    await db.budgets.put({ id: 'b1', categoryId: 'c1', monthlyPaise: 6000_00 });
    await db.recurring.put({ id: 'r1', title: 'Rent', icon: 'home', amountPaise: 1, cadence: 'monthly', nextDue: '2026-11-01', kind: 'monthly', direction: 'out' });
    await db.upiIds.put({ id: 'u1', handle: 'a@b', label: 'x' });
    await db.holdings.put({ id: 'h1', kind: 'mf', schemeCode: '1', name: 'F', unitsMicro: 1_500_000, lastNavMicro: 52_345_600 });
    expect((await db.holdings.get('h1'))?.lastNavMicro).toBe(52_345_600);
    expect((await db.recurring.get('r1'))?.cadence).toBe('monthly');
    expect(await db.upiIds.list()).toHaveLength(1);
    expect(await db.budgets.list()).toHaveLength(1);
    expect(await db.goals.list()).toHaveLength(1);
    expect(await db.allocations.list()).toHaveLength(1);
    expect(await db.debts.list()).toHaveLength(1);
  });

  describe('entries', () => {
    it('between is half open and newest first', async () => {
      const a = entry({ amountPaise: 1, at: ms(2026, 10, 1, 0, 0) });
      const b = entry({ amountPaise: 2, at: ms(2026, 10, 15) });
      const c = entry({ amountPaise: 3, at: ms(2026, 11, 1, 0, 0) });
      await db.entries.putMany([a, b, c]);
      const got = await db.entries.between(ms(2026, 10, 1, 0, 0), ms(2026, 11, 1, 0, 0));
      expect(got.map((e) => e.id)).toEqual([b.id, a.id]);
    });

    it('between hides deleted entries', async () => {
      const a = entry({ amountPaise: 1, at: ms(2026, 10, 2) });
      await db.entries.put(a);
      await db.entries.remove(a.id);
      expect(await db.entries.between(0, ms(2030, 1, 1))).toEqual([]);
    });

    it('keeps sources, status and aiAdded', async () => {
      const e = entry({
        amountPaise: 4860,
        at: ms(2026, 10, 24, 13, 42),
        sources: [{ kind: 'sms', rawRef: 'sms-1' }],
        status: 'toReview',
        aiAdded: true,
      });
      await db.entries.put(e);
      const got = await db.entries.get(e.id);
      expect(got?.sources).toEqual([{ kind: 'sms', rawRef: 'sms-1' }]);
      expect(got?.status).toBe('toReview');
      expect(got?.aiAdded).toBe(true);
    });

    it('addSource adds a second source once', async () => {
      const e = entry({ amountPaise: 1, at: ms(2026, 10, 2), sources: [{ kind: 'sms', rawRef: 's1' }] });
      await db.entries.put(e);
      const withShot = await db.entries.addSource(e.id, { kind: 'shot' });
      expect(withShot?.sources.map((s) => s.kind)).toEqual(['sms', 'shot']);
      const again = await db.entries.addSource(e.id, { kind: 'shot' });
      expect(again?.sources).toHaveLength(2);
      expect(await db.entries.addSource('missing', { kind: 'shot' })).toBeNull();
    });

    it('toReview lists pending entries and confirm clears them', async () => {
      const p = entry({ amountPaise: 1, at: ms(2026, 10, 2), status: 'toReview', aiAdded: true });
      const q = entry({ amountPaise: 2, at: ms(2026, 10, 3) });
      await db.entries.putMany([p, q]);
      expect((await db.entries.toReview()).map((e) => e.id)).toEqual([p.id]);
      const done = await db.entries.confirm(p.id);
      expect(done?.status).toBe('confirmed');
      expect(await db.entries.toReview()).toEqual([]);
      expect(await db.entries.confirm('missing')).toBeNull();
    });
  });

  describe('merchant history', () => {
    it('learns counts, totals and category, matching names loosely', async () => {
      await db.merchants.record('Swiggy', 'eating-out', 48600, 100);
      const m = await db.merchants.record('SWIGGY ', null, 61200, 200);
      expect(m.count).toBe(2);
      expect(m.totalPaise).toBe(109800);
      expect(m.categoryId).toBe('eating-out');
      expect(m.lastAt).toBe(200);
      expect((await db.merchants.list()).length).toBe(1);
      expect((await db.merchants.byName('swiggy'))?.id).toBe(m.id);
      expect(await db.merchants.byName('zomato')).toBeNull();
    });
  });

  describe('alert log and meta', () => {
    it('tracks alerts per category and month', async () => {
      expect(await db.alerts.has('c1', '2026-10')).toBe(false);
      await db.alerts.record('c1', '2026-10', 5);
      expect(await db.alerts.has('c1', '2026-10')).toBe(true);
      expect(await db.alerts.has('c1', '2026-11')).toBe(false);
      expect(await db.alerts.has('c2', '2026-10')).toBe(false);
    });

    it('stores meta values', async () => {
      expect(await db.meta.get('k')).toBeNull();
      await db.meta.set('k', 'v1');
      await db.meta.set('k', 'v2');
      expect(await db.meta.get('k')).toBe('v2');
    });
  });
});
