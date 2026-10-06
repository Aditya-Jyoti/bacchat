import { factories } from './helpers';
import type { BacchatDb } from '../repositories';
import * as S from '../../sampleData';
import {
  SAMPLE_TODAY,
  SEEDED_FUNDS_PAISE,
  budgetPace,
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

  it('matches the sample daily totals for days 1 to 22', async () => {
    const d = await dailyTotals(db, SAMPLE_TODAY);
    for (let i = 0; i < 22; i++) expect(d.days[i].totalPaise).toBe(S.dailySpendPaise[i]);
    expect(d.days[23].today).toBe(true);
    expect(d.days[24].future).toBe(true);
  });

  it('matches the sample deltas versus last month per category', async () => {
    const r = await spendByCategory(db, SAMPLE_TODAY);
    for (const c of S.spend) {
      const row = r.categories.find((x) => x.categoryId === c.name.toLowerCase().replace(/[^a-z]+/g, '-'));
      expect(row?.lastMonthPaise).toBe(c.amount.paise - c.vs.paise);
    }
  });

  it('has goals saved amounts equal to the sample', async () => {
    const t = await goalTotals(db);
    const goa = t.find((g) => g.goalId === 'goal-goa-with-friends')!;
    expect(goa.savedPaise).toBe(S.goals[0].saved.paise);
    expect(goa.targetPaise).toBe(S.goals[0].target.paise);
    expect(t).toHaveLength(4);
  });

  it('has budgets and flags eating out as over', async () => {
    const p = await budgetPace(db, SAMPLE_TODAY);
    expect(p).toHaveLength(5);
    expect(p.find((x) => x.categoryId === 'eating-out')?.limitPaise).toBe(S.budgets[0].limit.paise);
  });

  it('projects upcoming items including card bills', async () => {
    const items = await upcoming(db, SAMPLE_TODAY, 15);
    const titles = items.map((i) => i.title);
    expect(titles).toEqual(expect.arrayContaining(['Axis Bluechip SIP', 'Netflix', 'ICICI Amazon Pay bill', 'Rent']));
    expect(items[0].date).toBe('2026-10-25');
  });

  it('has UPI ids with ingress and egress, and pending AI entries to review', async () => {
    const f = await upiFlows(db, SAMPLE_TODAY);
    expect(f).toHaveLength(2);
    expect(f.find((x) => x.handle === 'rahul@okhdfc')!.inPaise).toBe(S.upi[0].inn.paise);
    expect(f.find((x) => x.handle === 'rahul@okhdfc')!.outPaise).toBeGreaterThan(0);
    const pending = await db.entries.toReview();
    expect(pending.length).toBeGreaterThan(0);
    expect(pending.every((e) => e.aiAdded)).toBe(true);
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
