import { factories, entry, ms } from './helpers';
import type { BacchatDb } from '../repositories';
import {
  accountAllocations,
  budgetPace,
  cashFlowByMonth,
  dailyTotals,
  detectOverspend,
  goalTotals,
  netWorth,
  nextDueDate,
  occurrences,
  projectCashFlow,
  spendable,
  spendByCategory,
  takeBudgetAlerts,
  upcoming,
  upiFlows,
} from '../queries';
import { parseDateKey } from '../dates';

const NOW = ms(2026, 10, 24, 21, 30);
const R = (rupees: number): number => rupees * 100;

describe.each(factories)('derived queries (%s)', (_n, make) => {
  let db: BacchatDb;
  beforeEach(async () => {
    db = await make();
  });
  afterEach(async () => db.close());

  describe('net worth and spendable', () => {
    beforeEach(async () => {
      await db.accounts.putMany([
        { id: 'hdfc', name: 'HDFC', kind: 'bank', balancePaise: R(300000), icon: 'a' },
        { id: 'cash', name: 'Cash', kind: 'cash', balancePaise: R(12000), icon: 'a' },
        { id: 'mf', name: 'MF', kind: 'mf', balancePaise: R(1), icon: 'a' },
        { id: 'nps', name: 'NPS', kind: 'nps', balancePaise: R(50000), icon: 'a' },
        { id: 'card', name: 'Card', kind: 'card', balancePaise: 0, icon: 'a' },
        { id: 'loan', name: 'Loan', kind: 'loan', balancePaise: 0, icon: 'a' },
      ]);
      await db.debts.putMany([
        { id: 'd1', accountId: 'card', dueDay: 5, outstandingPaise: R(20000), limitPaise: R(100000) },
        { id: 'd2', accountId: 'loan', dueDay: 1, outstandingPaise: R(100000), limitPaise: R(100000) },
      ]);
      await db.holdings.put({ id: 'h1', kind: 'mf', accountId: 'mf', schemeCode: '1', name: 'F', unitsMicro: 1000_000_000, lastNavMicro: 62_500_000 });
    });

    it('is own minus owe with live fund value, debt kept separate', async () => {
      const nw = await netWorth(db);
      expect(nw.ownBy).toEqual({ bank: R(300000), cash: R(12000), mf: R(62500), nps: R(50000) });
      expect(nw.ownPaise).toBe(R(424500));
      expect(nw.owePaise).toBe(R(120000));
      expect(nw.netPaise).toBe(R(304500));
      expect(nw.debts).toHaveLength(2);
    });

    it('falls back to the stored balance when a holding has no NAV', async () => {
      await db.holdings.put({ id: 'h2', kind: 'mf', accountId: 'mf', schemeCode: '2', name: 'G', unitsMicro: 1, lastNavMicro: null });
      expect((await netWorth(db)).ownBy.mf).toBe(R(1));
    });

    it('counts holdings that have no account', async () => {
      await db.holdings.put({ id: 'h3', kind: 'nps', accountId: null, schemeCode: '3', name: 'N', unitsMicro: 2_000_000, lastNavMicro: 30_000_000 });
      expect((await netWorth(db)).ownBy.nps).toBe(R(50000) + R(60));
    });

    it('can be negative when debts exceed assets', async () => {
      await db.debts.put({ id: 'd3', accountId: 'loan', dueDay: 1, outstandingPaise: R(10_000_000), limitPaise: 0 });
      expect((await netWorth(db)).netPaise).toBeLessThan(0);
    });

    it('spendable is banks plus cash minus card dues only', async () => {
      const s = await spendable(db);
      expect(s).toEqual({ paise: R(292000), liquidPaise: R(312000), cardDuesPaise: R(20000) });
    });

    it('ignores deleted accounts', async () => {
      await db.accounts.remove('hdfc');
      expect((await spendable(db)).liquidPaise).toBe(R(12000));
    });
  });

  describe('spend by category', () => {
    beforeEach(async () => {
      await db.entries.putMany([
        entry({ amountPaise: R(500), at: ms(2026, 10, 3), categoryId: 'food' }),
        entry({ amountPaise: R(300), at: ms(2026, 10, 20), categoryId: 'food' }),
        entry({ amountPaise: R(200), at: ms(2026, 10, 21), categoryId: 'fuel' }),
        entry({ amountPaise: R(100), at: ms(2026, 10, 22), categoryId: null }),
        entry({ amountPaise: R(999), at: ms(2026, 10, 22), categoryId: 'food', direction: 'in' }),
        entry({ amountPaise: R(600), at: ms(2026, 9, 12), categoryId: 'food' }),
        entry({ amountPaise: R(400), at: ms(2026, 9, 30, 23, 59), categoryId: 'fuel' }),
        entry({ amountPaise: R(700), at: ms(2026, 9, 5), categoryId: 'gone' }),
      ]);
    });

    it('sums spend only, sorts largest first and computes delta versus last month', async () => {
      const r = await spendByCategory(db, NOW);
      expect(r.totalPaise).toBe(R(1100));
      expect(r.lastMonthTotalPaise).toBe(R(1700));
      expect(r.categories.map((c) => c.categoryId)).toEqual(['food', 'fuel', null]);
      const food = r.categories[0];
      expect(food).toMatchObject({ totalPaise: R(800), lastMonthPaise: R(600), deltaPaise: R(200), count: 2 });
      expect(r.categories[1].deltaPaise).toBe(-R(200));
      expect(r.categories[2]).toMatchObject({ lastMonthPaise: 0, deltaPaise: R(100) });
      expect(r.categories.reduce((s, c) => s + c.share, 0)).toBeCloseTo(1, 10);
      expect(r.categories.find((c) => c.categoryId === 'gone')).toBeUndefined();
    });

    it('handles an empty month', async () => {
      const r = await spendByCategory(db, ms(2027, 2, 10));
      expect(r).toEqual({ totalPaise: 0, lastMonthTotalPaise: 0, categories: [] });
    });

    it('handles January (previous month is December)', async () => {
      await db.entries.put(entry({ amountPaise: R(50), at: ms(2026, 12, 31, 20), categoryId: 'food' }));
      await db.entries.put(entry({ amountPaise: R(80), at: ms(2027, 1, 2), categoryId: 'food' }));
      const r = await spendByCategory(db, ms(2027, 1, 15));
      expect(r.categories[0]).toMatchObject({ totalPaise: R(80), lastMonthPaise: R(50), deltaPaise: R(30) });
    });
  });

  describe('daily totals', () => {
    it('buckets by day, marks future and today, with top two and average', async () => {
      await db.entries.putMany([
        entry({ amountPaise: R(100), at: ms(2026, 10, 1), merchant: 'A' }),
        entry({ amountPaise: R(300), at: ms(2026, 10, 1, 15), merchant: 'B' }),
        entry({ amountPaise: R(200), at: ms(2026, 10, 1, 18), merchant: 'C' }),
        entry({ amountPaise: R(500), at: ms(2026, 10, 3), merchant: 'D' }),
        entry({ amountPaise: R(1000), at: ms(2026, 10, 3), merchant: 'Salary', direction: 'in' }),
        entry({ amountPaise: R(900), at: ms(2026, 10, 28), merchant: 'Future' }),
      ]);
      const now = ms(2026, 10, 4, 10);
      const r = await dailyTotals(db, now);
      expect(r.days).toHaveLength(31);
      expect(r.totalPaise).toBe(R(1100));
      expect(r.averagePaise).toBe(R(275));
      expect(r.days[0]).toMatchObject({ day: 1, totalPaise: R(600), count: 3, future: false, today: false, vsAveragePaise: R(325) });
      expect(r.days[0].top.map((t) => t.merchant)).toEqual(['B', 'C']);
      expect(r.days[1].totalPaise).toBe(0);
      expect(r.days[2].totalPaise).toBe(R(500));
      expect(r.days[3].today).toBe(true);
      expect(r.days[4]).toMatchObject({ future: true, totalPaise: 0, top: [] });
      expect(r.days[27].totalPaise).toBe(0); // future entries are not shown
    });
  });

  describe('cash flow by month', () => {
    it('returns oldest first with in and out per month', async () => {
      await db.entries.putMany([
        entry({ amountPaise: R(1000), at: ms(2026, 9, 1), direction: 'in' }),
        entry({ amountPaise: R(400), at: ms(2026, 9, 5) }),
        entry({ amountPaise: R(2000), at: ms(2026, 10, 1), direction: 'in' }),
        entry({ amountPaise: R(300), at: ms(2026, 10, 9) }),
      ]);
      const r = await cashFlowByMonth(db, NOW, 3);
      expect(r.map((m) => m.month)).toEqual(['2026-08', '2026-09', '2026-10']);
      expect(r[0]).toEqual({ month: '2026-08', inPaise: 0, outPaise: 0 });
      expect(r[1]).toEqual({ month: '2026-09', inPaise: R(1000), outPaise: R(400) });
      expect(r[2]).toEqual({ month: '2026-10', inPaise: R(2000), outPaise: R(300) });
    });
  });

  describe('UPI ingress and egress', () => {
    it('totals per id and lists idle ids', async () => {
      await db.upiIds.putMany([
        { id: 'u1', handle: 'a@okhdfc' },
        { id: 'u2', handle: 'b@ybl' },
        { id: 'u3', handle: 'idle@upi' },
      ]);
      await db.entries.putMany([
        entry({ amountPaise: R(100), at: ms(2026, 10, 2), upiId: 'u1' }),
        entry({ amountPaise: R(50), at: ms(2026, 10, 3), upiId: 'u1' }),
        entry({ amountPaise: R(900), at: ms(2026, 10, 4), upiId: 'u1', direction: 'in' }),
        entry({ amountPaise: R(70), at: ms(2026, 10, 5), upiId: 'u2' }),
        entry({ amountPaise: R(5), at: ms(2026, 9, 5), upiId: 'u2' }),
        entry({ amountPaise: R(11), at: ms(2026, 10, 5), upiId: null }),
        entry({ amountPaise: R(12), at: ms(2026, 10, 5), upiId: 'unknown' }),
      ]);
      const r = await upiFlows(db, NOW);
      expect(r.find((f) => f.upiId === 'u1')).toMatchObject({ handle: 'a@okhdfc', inPaise: R(900), outPaise: R(150), inCount: 1, outCount: 2 });
      expect(r.find((f) => f.upiId === 'u2')).toMatchObject({ inPaise: 0, outPaise: R(70) });
      expect(r.find((f) => f.upiId === 'u3')).toMatchObject({ inPaise: 0, outPaise: 0 });
      expect(r).toHaveLength(3);
      const all = await upiFlows(db, NOW, { fromMs: ms(2026, 1, 1), toMs: ms(2027, 1, 1) });
      expect(all.find((f) => f.upiId === 'u2')?.outPaise).toBe(R(75));
    });
  });

  describe('budget pace and calm alerts', () => {
    beforeEach(async () => {
      await db.budgets.putMany([
        { id: 'b-food', categoryId: 'food', monthlyPaise: R(6000) },
        { id: 'b-fuel', categoryId: 'fuel', monthlyPaise: R(4000) },
        { id: 'b-fun', categoryId: 'fun', monthlyPaise: R(3100) },
        { id: 'b-zero', categoryId: 'zero', monthlyPaise: 0 },
      ]);
      await db.entries.putMany([
        entry({ amountPaise: R(6640), at: ms(2026, 10, 10), categoryId: 'food' }),
        entry({ amountPaise: R(1000), at: ms(2026, 10, 10), categoryId: 'fuel' }),
        entry({ amountPaise: R(2800), at: ms(2026, 10, 10), categoryId: 'fun' }),
        entry({ amountPaise: R(9999), at: ms(2026, 9, 10), categoryId: 'fuel' }),
      ]);
    });

    it('computes pace, projection and status', async () => {
      const p = await budgetPace(db, NOW);
      expect(p.map((x) => x.categoryId).sort()).toEqual(['food', 'fuel', 'fun']);
      const food = p.find((x) => x.categoryId === 'food')!;
      expect(food).toMatchObject({ status: 'over', overByPaise: R(640), leftPaise: -R(640), perDayPaise: 0, daysLeft: 7 });
      const fuel = p.find((x) => x.categoryId === 'fuel')!;
      expect(fuel.status).toBe('ok');
      expect(fuel.expectedPaise).toBe(Math.round((R(4000) * 24) / 31));
      expect(fuel.perDayPaise).toBe(Math.floor(R(3000) / 8));
      const fun = p.find((x) => x.categoryId === 'fun')!;
      expect(fun.status).toBe('ahead'); // projected above the limit and well past pace
      expect(fun.projectedPaise).toBe(Math.round((R(2800) * 31) / 24));
    });

    it('detects over and late-pace categories with a raise-to suggestion', async () => {
      const a = await detectOverspend(db, NOW);
      const food = a.find((x) => x.categoryId === 'food')!;
      expect(food).toMatchObject({ kind: 'over', overByPaise: R(640), raiseToPaise: R(7000), month: '2026-10' });
      const fun = a.find((x) => x.categoryId === 'fun')!;
      expect(fun.kind).toBe('pace');
      expect(fun.raiseToPaise % R(500)).toBe(0);
      expect(fun.raiseToPaise).toBeGreaterThanOrEqual(R(2800));
      expect(a.find((x) => x.categoryId === 'fuel')).toBeUndefined();
    });

    it('does not warn early in the month about a small ahead-of-pace blip', async () => {
      await db.entries.put(entry({ amountPaise: R(1200), at: ms(2026, 10, 2), categoryId: 'fuel' }));
      const early = ms(2026, 10, 2, 20);
      const a = await detectOverspend(db, early);
      expect(a.find((x) => x.categoryId === 'fuel')).toBeUndefined();
    });

    it('raises at most one alert per category per month', async () => {
      const first = await takeBudgetAlerts(db, NOW);
      expect(first.map((a) => a.categoryId).sort()).toEqual(['food', 'fun']);
      expect(await takeBudgetAlerts(db, NOW)).toEqual([]);
      // Gets worse later in the month: still no second alert for the same category.
      await db.entries.put(entry({ amountPaise: R(5000), at: ms(2026, 10, 25), categoryId: 'food' }));
      expect(await takeBudgetAlerts(db, ms(2026, 10, 26))).toEqual([]);
      // A pace alert for fun does not block an over alert for another category.
      await db.entries.put(entry({ amountPaise: R(5000), at: ms(2026, 10, 26), categoryId: 'fuel' }));
      const later = await takeBudgetAlerts(db, ms(2026, 10, 27));
      expect(later.map((a) => a.categoryId)).toEqual(['fuel']);
    });

    it('allows a fresh alert next month', async () => {
      await takeBudgetAlerts(db, NOW);
      await db.entries.put(entry({ amountPaise: R(7000), at: ms(2026, 11, 3), categoryId: 'food' }));
      const nov = await takeBudgetAlerts(db, ms(2026, 11, 4));
      expect(nov.map((a) => a.categoryId)).toEqual(['food']);
      expect(nov[0].month).toBe('2026-11');
    });

    it('is quiet when nothing is over', async () => {
      const empty = await make();
      await empty.budgets.put({ id: 'b', categoryId: 'x', monthlyPaise: R(100) });
      expect(await detectOverspend(empty, NOW)).toEqual([]);
    });
  });

  describe('upcoming and recurring projection', () => {
    it('lists monthly, weekly, quarterly and yearly items in the window, sorted', async () => {
      const base = { icon: 'x', direction: 'out' as const, kind: 'bill' as const };
      await db.recurring.putMany([
        { id: 'rent', title: 'Rent', amountPaise: R(22000), cadence: 'monthly', nextDue: '2026-11-01', ...base },
        { id: 'sip', title: 'SIP', amountPaise: R(3000), cadence: 'monthly', nextDue: '2026-10-25', ...base, kind: 'sip' },
        { id: 'weekly', title: 'Milk', amountPaise: R(100), cadence: 'weekly', nextDue: '2026-10-24', ...base },
        { id: 'qtr', title: 'Water', amountPaise: R(500), cadence: 'quarterly', nextDue: '2026-08-31', ...base },
        { id: 'year', title: 'Insurance', amountPaise: R(9000), cadence: 'yearly', nextDue: '2025-11-15', ...base },
        { id: 'late', title: 'Far', amountPaise: R(1), cadence: 'monthly', nextDue: '2027-06-01', ...base },
      ]);
      const items = await upcoming(db, NOW, 30);
      const titles = items.map((i) => `${i.date} ${i.title}`);
      expect(titles).toEqual([
        '2026-10-24 Milk',
        '2026-10-25 SIP',
        '2026-10-31 Milk',
        '2026-11-01 Rent',
        '2026-11-07 Milk',
        '2026-11-14 Milk',
        '2026-11-15 Insurance',
        '2026-11-21 Milk',
      ].filter((t) => !t.endsWith('Water')));
      expect(items.find((i) => i.title === 'SIP')?.kind).toBe('sip');
      // Quarterly from 31 Aug: 30 Nov (clamped), outside 30 days from 24 Oct (ends 23 Nov).
      expect(items.find((i) => i.title === 'Water')).toBeUndefined();
    });

    it('includes card dues with the outstanding amount and skips settled cards', async () => {
      await db.accounts.putMany([
        { id: 'c1', name: 'ICICI card', kind: 'card', balancePaise: 0, icon: 'c' },
        { id: 'c2', name: 'Settled card', kind: 'card', balancePaise: 0, icon: 'c' },
        { id: 'l1', name: 'Loan', kind: 'loan', balancePaise: 0, icon: 'c' },
      ]);
      await db.debts.putMany([
        { id: 'd1', accountId: 'c1', dueDay: 31, outstandingPaise: R(14820), limitPaise: R(200000) },
        { id: 'd2', accountId: 'c2', dueDay: 5, outstandingPaise: 0, limitPaise: R(1) },
        { id: 'd3', accountId: 'l1', dueDay: 5, outstandingPaise: R(5), limitPaise: R(1) },
      ]);
      const items = await upcoming(db, NOW, 10);
      expect(items).toHaveLength(1);
      expect(items[0]).toMatchObject({ date: '2026-10-31', title: 'ICICI card bill', amountPaise: R(14820), kind: 'cardDue', accountId: 'c1' });
    });

    it('projects day totals for the cash flow strip', async () => {
      await db.recurring.putMany([
        { id: 'a', title: 'A', icon: 'x', amountPaise: R(10), cadence: 'monthly', nextDue: '2026-10-25', kind: 'bill', direction: 'out' },
        { id: 'b', title: 'B', icon: 'x', amountPaise: R(5), cadence: 'monthly', nextDue: '2026-10-25', kind: 'bill', direction: 'out' },
        { id: 'c', title: 'Pay', icon: 'x', amountPaise: R(100), cadence: 'monthly', nextDue: '2026-10-26', kind: 'monthly', direction: 'in' },
      ]);
      const flow = projectCashFlow(await upcoming(db, NOW, 5));
      expect(flow).toEqual([
        { date: '2026-10-25', inPaise: 0, outPaise: R(15) },
        { date: '2026-10-26', inPaise: R(100), outPaise: 0 },
      ]);
    });
  });

  describe('goal allocations', () => {
    it('totals per goal with a capped percent and per source parts', async () => {
      await db.accounts.putMany([
        { id: 'a1', name: 'HDFC', kind: 'bank', balancePaise: R(30000), icon: 'x' },
        { id: 'a2', name: 'Cash', kind: 'cash', balancePaise: R(1000), icon: 'x' },
      ]);
      await db.goals.putMany([
        { id: 'goa', name: 'Goa', icon: 'x', targetPaise: R(60000) },
        { id: 'over', name: 'Over', icon: 'x', targetPaise: R(1000) },
        { id: 'empty', name: 'Empty', icon: 'x', targetPaise: R(5000) },
        { id: 'free', name: 'No target', icon: 'x', targetPaise: 0 },
      ]);
      await db.allocations.putMany([
        { id: '1', goalId: 'goa', accountId: 'a1', amountPaise: R(25000) },
        { id: '2', goalId: 'goa', accountId: 'a2', amountPaise: R(1000) },
        { id: '3', goalId: 'over', accountId: 'a1', amountPaise: R(2000) },
        { id: '4', goalId: 'deleted-goal', accountId: 'a1', amountPaise: R(9999) },
      ]);
      const t = await goalTotals(db);
      const goa = t.find((x) => x.goalId === 'goa')!;
      expect(goa).toMatchObject({ savedPaise: R(26000), remainingPaise: R(34000), pct: 43 });
      expect(goa.parts).toHaveLength(2);
      expect(t.find((x) => x.goalId === 'over')).toMatchObject({ pct: 100, remainingPaise: 0 });
      expect(t.find((x) => x.goalId === 'empty')).toMatchObject({ savedPaise: 0, pct: 0 });
      expect(t.find((x) => x.goalId === 'free')?.pct).toBe(0);

      const acc = await accountAllocations(db);
      expect(acc.find((a) => a.accountId === 'a1')).toEqual({ accountId: 'a1', allocatedPaise: R(27000), freePaise: R(3000) });
      expect(acc.find((a) => a.accountId === 'a2')?.freePaise).toBe(0);
    });
  });
});

describe('recurrence helpers', () => {
  const d = (k: string): number => parseDateKey(k);
  it('clamps month-end days', () => {
    const r = { id: 'x', title: 'x', icon: 'x', amountPaise: 1, cadence: 'monthly' as const, nextDue: '2026-01-31', kind: 'bill' as const, direction: 'out' as const, updatedAt: 0 };
    const got = occurrences(r, d('2026-01-01'), d('2026-05-01')).map((t) => new Date(t).getDate());
    expect(got).toEqual([31, 28, 31, 30]);
  });
  it('returns nothing before the first due date', () => {
    const r = { id: 'x', title: 'x', icon: 'x', amountPaise: 1, cadence: 'weekly' as const, nextDue: '2026-12-01', kind: 'bill' as const, direction: 'out' as const, updatedAt: 0 };
    expect(occurrences(r, d('2026-10-01'), d('2026-11-01'))).toEqual([]);
  });
  it('finds the next card due date', () => {
    expect(new Date(nextDueDate(5, d('2026-10-24'))).getMonth()).toBe(10);
    expect(new Date(nextDueDate(31, d('2026-10-24'))).getDate()).toBe(31);
    expect(new Date(nextDueDate(31, d('2026-11-24'))).getDate()).toBe(30);
    expect(new Date(nextDueDate(24, d('2026-10-24'))).getDate()).toBe(24);
  });
  it('rejects bad date keys', () => {
    expect(() => parseDateKey('2026-13-01')).toThrow();
    expect(() => parseDateKey('2026-02-30')).toThrow();
    expect(() => parseDateKey('x')).toThrow();
  });
});
