import { factories } from './helpers';
import type { BacchatDb } from '../repositories';
import * as S from '../../sampleData';
import {
  SAMPLE_TODAY,
  SEEDED_FUNDS_PAISE,
  budgetPace,
  cashFlowByMonth,
  takeBudgetAlerts,
  accountAllocations,
  dailyTotals,
  goalTotals,
  netWorth,
  seedFromSampleData,
  seedIfEmpty,
  spendByCategory,
  spendable,
  upcoming,
  upiFlows,
} from '..';
import { slug } from '../seed';

describe.each(factories)('seed from sample data (%s)', (_n, make) => {
  let db: BacchatDb;
  beforeEach(async () => {
    db = await make();
    await seedFromSampleData(db);
  });
  afterEach(async () => db.close());

  it('reproduces the design net worth, own and owe exactly', async () => {
    const nw = await netWorth(db);
    expect(nw.ownPaise).toBe(S.netWorth.own.paise);
    expect(nw.owePaise).toBe(S.netWorth.owe.paise);
    expect(nw.netPaise).toBe(S.netWorth.net.paise);
    expect(SEEDED_FUNDS_PAISE).toBe(S.own.find((o) => o.name === 'Mutual funds')!.amount.paise);
    expect(nw.ownBy.nps).toBe(S.own.find((o) => o.name === 'NPS Tier I')!.amount.paise);
  });

  it('spendable subtracts card dues from banks and cash', async () => {
    const s = await spendable(db);
    expect(s.liquidPaise).toBe(31240000 + 21875000 + 1200000);
    expect(s.paise).toBe(s.liquidPaise - s.cardDuesPaise);
    expect(s.cardDuesPaise).toBe(S.netWorth.owe.paise);
  });

  it('matches the design daily totals on the days with listed entries and keeps the month total', async () => {
    const d = await dailyTotals(db, SAMPLE_TODAY);
    for (const day of [4, 17, 22]) expect(d.days[day - 1].totalPaise).toBe(S.dailySpendPaise[day - 1]);
    expect(d.totalPaise).toBe(S.spendTotal.paise);
    expect(Math.round(d.averagePaise / 100)).toBe(Math.round(S.dailyAverage.paise / 100));
    expect(d.days[23].today).toBe(true);
    expect(d.days[24].future).toBe(true);
    // The Today and Yesterday lists add up to what the day shows.
    expect(d.days[23].totalPaise).toBe(3114 * 100);
    expect(d.days[22].totalPaise).toBe(2435 * 100);
  });

  it('has the design October spend by category and deltas', async () => {
    const r = await spendByCategory(db, SAMPLE_TODAY);
    expect(r.totalPaise).toBe(S.spendTotal.paise);
    expect(r.categories).toHaveLength(6);
    for (const c of S.spend) {
      const row = r.categories.find((x) => x.categoryId === slug(c.name))!;
      expect(row.totalPaise).toBe(c.amount.paise);
      expect(row.deltaPaise).toBe(c.vs.paise);
      expect(row.lastMonthPaise).toBe(c.amount.paise - c.vs.paise);
    }
  });

  it('has goals: 4 active and 2 done, saved amounts as designed, allocations within balances', async () => {
    const t = await goalTotals(db);
    const goa = t.find((g) => g.goalId === 'goal-goa-with-friends')!;
    expect(goa.savedPaise).toBe(S.goals[0].saved.paise);
    expect(goa.targetPaise).toBe(S.goals[0].target.paise);
    expect(t).toHaveLength(6);
    expect(t.filter((g) => g.savedPaise >= g.targetPaise)).toHaveLength(2);
    for (const g of S.goals) expect(t.find((x) => x.goalId === `goal-${slug(g.name)}`)!.savedPaise).toBe(g.saved.paise);
    const goals = await db.goals.list();
    expect(goals.find((g) => g.name === 'New phone')?.targetDate).toBe('done in March');
    expect(goals.find((g) => g.name === 'Jaipur weekend')?.targetDate).toBe('done in July');
    const free = await accountAllocations(db);
    for (const f of free) expect(f.freePaise).toBeGreaterThanOrEqual(0);
    const sbi = free.find((f) => f.accountId === 'acc-sbi')!;
    expect(sbi.freePaise).toBeGreaterThan(3000 * 100); // Diwali still needs Rs 3,000
  });

  it('has the design budgets, with only eating out over', async () => {
    const p = await budgetPace(db, SAMPLE_TODAY);
    expect(p).toHaveLength(5);
    for (const b of S.budgets) {
      const row = p.find((x) => x.categoryId === slug(b.name))!;
      expect(row.limitPaise).toBe(b.limit.paise);
      expect(row.status === 'over').toBe(!!b.over);
    }
    expect(p.find((x) => x.categoryId === 'eating-out')?.overByPaise).toBe(640 * 100);
    const alerts = await takeBudgetAlerts(db, SAMPLE_TODAY);
    expect(alerts).toHaveLength(1);
    expect(alerts[0].categoryId).toBe('eating-out');
    expect(alerts[0].raiseToPaise).toBe(7000 * 100);
  });

  it('matches the design cash flow from May to September, and October money in', async () => {
    const f = await cashFlowByMonth(db, SAMPLE_TODAY, 6);
    expect(f.map((x) => x.month)).toEqual(['2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10']);
    f.forEach((x, i) => {
      expect(x.inPaise).toBe(S.cashFlow.inRupees[i] * 1000 * 100);
      // October money out is everyday spend only (Rs 31,240); the design's 74 thousand cannot hold with it.
      if (i < 5) expect(x.outPaise).toBe(S.cashFlow.outRupees[i] * 1000 * 100);
    });
    expect(f[5].outPaise).toBe(S.spendTotal.paise);
  });

  it('has the design UPI ingress, a third id, and UPI spend of Rs 10,880', async () => {
    const f = await upiFlows(db, SAMPLE_TODAY);
    expect(f).toHaveLength(3);
    for (const u of S.upi) expect(f.find((x) => x.handle === u.id)!.inPaise).toBe(u.inn.paise);
    expect(f.reduce((s, x) => s + x.outPaise, 0)).toBe(S.byMethod[1].amount.paise);
    expect(f.every((x) => x.outPaise > 0)).toBe(true);
    const pending = await db.entries.toReview();
    expect(pending.length).toBeGreaterThan(0);
    expect(pending.every((e) => e.aiAdded)).toBe(true);
  });

  it('has the design spend by method', async () => {
    const octo = await db.entries.between(new Date(2026, 9, 1).getTime(), new Date(2026, 10, 1).getTime());
    const by = (m: string): number => octo.filter((e) => e.direction === 'out' && e.method === m).reduce((s, e) => s + e.amountPaise, 0);
    expect(by('card')).toBe(S.byMethod[0].amount.paise);
    expect(by('upi')).toBe(S.byMethod[1].amount.paise);
    expect(by('debit')).toBe(S.byMethod[2].amount.paise);
    expect(by('cash')).toBe(S.byMethod[3].amount.paise);
  });

  it('has the profile counts: 8 months, 1,284 entries, 2 goals reached, 3 UPI ids, 9 recurring', async () => {
    const entries = await db.entries.list();
    expect(entries).toHaveLength(1284);
    expect(new Set(entries.map((e) => e.id)).size).toBe(1284);
    const first = Math.min(...entries.map((e) => e.at));
    const a = new Date(first);
    expect((2026 - a.getFullYear()) * 12 + 9 - a.getMonth() + 1).toBe(8);
    expect((await db.upiIds.list()).length).toBe(3);
    expect((await db.recurring.list()).length).toBe(9);
    expect(entries.every((e) => e.amountPaise > 0 && Number.isInteger(e.amountPaise))).toBe(true);
  });

  it('only uses category ids that exist, for entries, budgets and recurring items', async () => {
    const ids = new Set((await db.categories.list()).map((c) => c.id));
    const entries = await db.entries.list();
    const bad = entries.filter((e) => e.categoryId !== null && !ids.has(e.categoryId)).map((e) => e.categoryId);
    expect(bad).toEqual([]);
    expect(ids.has('tea-and-coffee')).toBe(true);
    expect(ids.has('tea-coffee')).toBe(false);
    for (const b of await db.budgets.list()) expect(ids.has(b.categoryId)).toBe(true);
    for (const r of await db.recurring.list()) if (r.categoryId) expect(ids.has(r.categoryId)).toBe(true);
  });

  it('marks the Amazon second source as resolved, and only that one', async () => {
    const entries = await db.entries.list();
    const resolved = entries.filter((e) => e.sources.some((s) => s.rawRef === 'resolved'));
    expect(resolved.map((e) => e.merchant)).toEqual(['Amazon']);
    expect(resolved[0].sources).toHaveLength(2);
  });

  it('is deterministic', async () => {
    const other = await make();
    await seedFromSampleData(other);
    expect(await other.entries.list()).toEqual(
      (await db.entries.list()).map((e) => expect.objectContaining({ id: e.id, amountPaise: e.amountPaise, at: e.at, categoryId: e.categoryId })),
    );
    await other.close();
  });

  it('projects upcoming items including card bills', async () => {
    const items = await upcoming(db, SAMPLE_TODAY, 15);
    const titles = items.map((i) => i.title);
    expect(titles).toEqual(expect.arrayContaining(['Axis Bluechip SIP', 'Netflix', 'ICICI Amazon Pay bill', 'Rent']));
    expect(items[0].date).toBe('2026-10-25');
  });

  it('learns merchant history for known payees', async () => {
    const sw = await db.merchants.byName('Swiggy');
    expect(sw?.categoryId).toBe('eating-out');
    expect(sw!.count).toBeGreaterThan(1);
  });

  it('seedIfEmpty seeds once only', async () => {
    const fresh = await make();
    expect(await seedIfEmpty(fresh)).toBe(true);
    expect(await seedIfEmpty(fresh)).toBe(false);
    expect(await seedIfEmpty(db)).toBe(false);
  });
});
